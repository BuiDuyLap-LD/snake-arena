// server/GameRoom.js

const Snake = require('./Snake');
const FoodManager = require('./FoodManager');
const PowerupManager = require('./PowerupManager');
const leaderboardManager = require('./LeaderboardManager');
const accountManager = require('./AccountManager');

class GameRoom {
  constructor(roomId = 'arena-main') {
    this.roomId = roomId;
    this.arenaRadius = 2200;
    this.foodManager = new FoodManager(this.arenaRadius, 500);
    this.powerupManager = new PowerupManager(this.arenaRadius, 14);

    this.players = new Map(); // ws/id -> { ws, snake }
    this.bots = new Map();    // botId -> snake

    this.targetBotCount = 6;
    this.nextBotId = 1;

    // Match round system
    this.roundDuration = 180; // 3 minutes per round
    this.timeRemaining = this.roundDuration;
    this.isIntermission = false;
    this.intermissionDuration = 8;
    this.intermissionTimer = 0;

    // Tick loop (50 Hz physics)
    this.tickRate = 50;
    this.tickIntervalMs = 1000 / this.tickRate;
    this.lastTickTime = Date.now();
    this.running = false;
    this.broadcastTickCount = 0;

    // Colors available for bots
    this.botColors = [
      '#ff3366', '#33ccff', '#ffaa00', '#00ffaa', 
      '#cc33ff', '#ffff33', '#ff0055', '#00e5ff'
    ];

    // Maintain initial bots
    this.ensureBots();
  }

  getAllSnakes() {
    const list = [];
    for (const p of this.players.values()) {
      if (p.snake) list.push(p.snake);
    }
    for (const b of this.bots.values()) {
      list.push(b);
    }
    return list;
  }

  findSafeSpawn(existingSnakes) {
    let bestPos = { x: 0, y: 0 };
    let bestDist = -1;
    const maxRadius = this.arenaRadius - 400;

    const candidateCount = 20;
    for (let c = 0; c < candidateCount; c++) {
      const r = Math.sqrt(Math.random()) * maxRadius;
      const theta = Math.random() * Math.PI * 2;
      const candX = Math.cos(theta) * r;
      const candY = Math.sin(theta) * r;

      let minClearance = 99999;
      for (const s of existingSnakes) {
        if (!s.alive) continue;
        const dh = Math.hypot(candX - s.head.x, candY - s.head.y);
        if (dh < minClearance) minClearance = dh;

        for (let i = 0; i < s.body.length; i += 3) {
          const ds = Math.hypot(candX - s.body[i].x, candY - s.body[i].y);
          if (ds < minClearance) minClearance = ds;
        }
      }

      if (minClearance > 550) {
        bestPos = { x: Math.round(candX), y: Math.round(candY) };
        bestDist = minClearance;
        break;
      }

      if (minClearance > bestDist) {
        bestDist = minClearance;
        bestPos = { x: Math.round(candX), y: Math.round(candY) };
      }
    }

    const initialAngle = Math.atan2(-bestPos.y, -bestPos.x) + (Math.random() - 0.5) * 0.5;
    return { pos: bestPos, angle: initialAngle };
  }

  ensureBots() {
    const needed = Math.max(0, this.targetBotCount - this.players.size) - this.bots.size;
    const allSnakes = this.getAllSnakes();

    for (let i = 0; i < needed; i++) {
      const botId = `bot_${this.nextBotId++}`;
      const color = this.botColors[Math.floor(Math.random() * this.botColors.length)];
      const { pos, angle } = this.findSafeSpawn(allSnakes);
      const bot = new Snake(botId, `Bot #${Math.floor(Math.random() * 900 + 100)}`, color, true, pos, angle);
      this.bots.set(botId, bot);
      allSnakes.push(bot);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTickTime = Date.now();
    this.loopInterval = setInterval(() => this.tick(), this.tickIntervalMs);
    console.log(`[GameRoom] Room ${this.roomId} started at ${this.tickRate}Hz.`);
  }

  stop() {
    this.running = false;
    if (this.loopInterval) clearInterval(this.loopInterval);
  }

  addPlayer(ws, playerId, playerName, playerColor, accountUsername = null) {
    const { pos, angle } = this.findSafeSpawn(this.getAllSnakes());
    const snake = new Snake(playerId, playerName, playerColor, false, pos, angle);
    this.players.set(playerId, { ws, snake, accountUsername });

    this.sendTo(ws, {
      type: 'INIT_GAME',
      playerId,
      arenaRadius: this.arenaRadius,
      roundDuration: this.roundDuration,
      timeRemaining: Math.ceil(this.timeRemaining),
      foods: this.foodManager.getAllFoods(),
      powerups: this.powerupManager.getAllPowerups(),
    });

    const accInfo = accountUsername ? ` [Tài khoản: ${accountUsername}]` : ' [Khách]';
    console.log(`[GameRoom] Player joined: ${playerName} (${playerId})${accInfo} at (${pos.x}, ${pos.y}).`);
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      if (player.snake && player.snake.alive) {
        this.foodManager.spawnDeadSnakeFood(player.snake.body, player.snake.color);
        // Ghi stats theo accountUsername (nếu có tài khoản) hoặc theo tên hiển thị
        const statsTarget = player.accountUsername || player.snake.name;
        leaderboardManager.recordPlayerScore(statsTarget, player.snake.score, player.snake.kills);
        if (player.accountUsername) {
          accountManager.recordGameStats(player.accountUsername, player.snake.score, player.snake.kills);
        }
      }
      this.players.delete(playerId);
      console.log(`[GameRoom] Player left: ${playerId}. Remaining: ${this.players.size}`);
      this.ensureBots();
    }
  }

  handlePlayerInput(playerId, inputData) {
    const player = this.players.get(playerId);
    if (!player || !player.snake || !player.snake.alive) return;

    if (typeof inputData.angle === 'number') {
      player.snake.setTargetAngle(inputData.angle);
    }
    if (typeof inputData.boosting === 'boolean') {
      player.snake.setBoosting(inputData.boosting);
    }
    if (inputData.type === 'USE_POWERUP' && typeof inputData.powerup === 'string') {
      const success = player.snake.usePowerup(inputData.powerup);
      if (success) {
        this.sendTo(player.ws, {
          type: 'POWERUP_ACTIVATED',
          powerup: inputData.powerup,
        });
      }
    }
  }

  respawnPlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    // Ghi stats cũ trước khi tái sinh
    if (player.snake) {
      const statsTarget = player.accountUsername || player.snake.name;
      leaderboardManager.recordPlayerScore(statsTarget, player.snake.score, player.snake.kills);
      if (player.accountUsername) {
        accountManager.recordGameStats(player.accountUsername, player.snake.score, player.snake.kills);
      }
    }

    const { pos, angle } = this.findSafeSpawn(this.getAllSnakes());
    player.snake = new Snake(playerId, player.snake.name, player.snake.color, false, pos, angle);
    console.log(`[GameRoom] Player respawned at (${pos.x}, ${pos.y}) with 3s shield.`);
  }

  tick() {
    const now = Date.now();
    const dt = Math.min(0.06, (now - this.lastTickTime) / 1000);
    this.lastTickTime = now;

    // Handle Round Intermission or Timer
    if (this.isIntermission) {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) {
        this.startNewRound();
      }
    } else {
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 0) {
        this.endRound();
      }
    }

    const allSnakes = this.getAllSnakes();

    // Update positions and handle boost pellets
    for (const snake of allSnakes) {
      if (!snake.alive) continue;
      const pellet = snake.update(dt, this.arenaRadius, Array.from(this.foodManager.foods.values()), allSnakes);
      if (pellet) {
        this.foodManager.addPellet(pellet.x, pellet.y, pellet.value, pellet.color);
      }

      this.foodManager.checkHeadCollisions(snake);
    }

    // Check Powerup Collections
    const collected = this.powerupManager.checkHeadCollisions(allSnakes);
    for (const c of collected) {
      if (!c.isBot) {
        const p = this.players.get(c.snakeId);
        if (p && p.ws) {
          this.sendTo(p.ws, {
            type: 'POWERUP_COLLECTED',
            powerup: c.type,
            added: c.added,
          });
        }
      }
    }

    // Check Collisions with Shield Protection
    this.checkCollisions(allSnakes);

    // Broadcast snapshot
    this.broadcastTickCount++;
    this.broadcastSnapshot(allSnakes);
  }

  checkCollisions(snakes) {
    const killEvents = [];

    for (let i = 0; i < snakes.length; i++) {
      const s1 = snakes[i];
      if (!s1.alive) continue;

      // 1. Boundary check
      const distFromCenter = Math.hypot(s1.head.x, s1.head.y);
      if (distFromCenter >= this.arenaRadius - s1.radius) {
        if (!s1.isShielded()) {
          this.eliminateSnake(s1, null, 'va vào hàng rào năng lượng');
          continue;
        } else {
          s1.head.x *= 0.98;
          s1.head.y *= 0.98;
        }
      }

      // 2. Snake head vs Snake body check
      for (let j = 0; j < snakes.length; j++) {
        const s2 = snakes[j];
        if (!s2.alive) continue;

        if (s1.id !== s2.id) {
          if (s1.isShielded() || s2.isShielded()) {
            continue;
          }

          const hitRadius = s1.radius + s2.radius * 0.75;
          const hitRadiusSq = hitRadius * hitRadius;

          for (let k = 0; k < s2.body.length; k++) {
            const seg = s2.body[k];
            const dx = s1.head.x - seg.x;
            const dy = s1.head.y - seg.y;
            if (dx * dx + dy * dy < hitRadiusSq) {
              s2.kills += 1;
              s2.score += Math.floor(s1.score * 0.4) + 150;
              this.eliminateSnake(s1, s2, `bị hạ gục bởi ${s2.name}`);
              killEvents.push({
                killer: s2.name,
                victim: s1.name,
                killerId: s2.id,
                victimId: s1.id,
              });
              break;
            }
          }
        }
      }
    }

    if (killEvents.length > 0) {
      this.broadcast({
        type: 'KILL_EVENTS',
        events: killEvents,
      });
    }
  }

  eliminateSnake(victim, killer = null, reason = '') {
    if (!victim.alive) return;
    victim.alive = false;

    // Record human stats to persistent global leaderboard & user account
    if (!victim.isBot) {
      // Tìm player entry để lấy accountUsername
      const victimPlayer = this.players.get(victim.id);
      const victimAccount = victimPlayer ? victimPlayer.accountUsername : null;
      const victimTarget = victimAccount || victim.name;
      leaderboardManager.recordPlayerScore(victimTarget, victim.score, victim.kills);
      if (victimAccount) {
        accountManager.recordGameStats(victimAccount, victim.score, victim.kills);
      }
    }
    if (killer && !killer.isBot) {
      const killerPlayer = this.players.get(killer.id);
      const killerAccount = killerPlayer ? killerPlayer.accountUsername : null;
      const killerTarget = killerAccount || killer.name;
      leaderboardManager.recordPlayerScore(killerTarget, killer.score, killer.kills);
      if (killerAccount) {
        accountManager.recordGameStats(killerAccount, killer.score, killer.kills);
      }
    }

    this.foodManager.spawnDeadSnakeFood(victim.body, victim.color);

    if (victim.isBot) {
      this.bots.delete(victim.id);
      setTimeout(() => {
        if (this.running) {
          this.ensureBots();
        }
      }, 1800);
    }

    const playerEntry = this.players.get(victim.id);
    if (playerEntry && playerEntry.ws) {
      this.sendTo(playerEntry.ws, {
        type: 'YOU_DIED',
        killerName: killer ? killer.name : 'Hàng rào năng lượng',
        score: victim.score,
        kills: victim.kills,
        reason,
      });
    }
  }

  endRound() {
    this.isIntermission = true;
    this.intermissionTimer = this.intermissionDuration;

    const allSnakes = this.getAllSnakes();
    allSnakes.sort((a, b) => b.score - a.score);

    // Record stats for all human players
    for (const s of allSnakes) {
      if (!s.isBot) {
        const playerEntry = this.players.get(s.id);
        const accountUsr = playerEntry ? playerEntry.accountUsername : null;
        const target = accountUsr || s.name;
        leaderboardManager.recordPlayerScore(target, s.score, s.kills);
        if (accountUsr) {
          accountManager.recordGameStats(accountUsr, s.score, s.kills);
        }
      }
    }

    const rankings = allSnakes.map((s, index) => ({
      rank: index + 1,
      id: s.id,
      name: s.name,
      score: s.score,
      kills: s.kills,
      length: s.body.length,
      color: s.color,
      isBot: s.isBot,
    }));

    this.broadcast({
      type: 'MATCH_OVER',
      rankings: rankings,
      intermissionDuration: this.intermissionDuration,
    });

    console.log(`[GameRoom] Match over! Winner: ${rankings[0] ? rankings[0].name : 'None'}`);
  }

  startNewRound() {
    this.isIntermission = false;
    this.timeRemaining = this.roundDuration;
    this.foodManager = new FoodManager(this.arenaRadius, 500);
    this.powerupManager = new PowerupManager(this.arenaRadius, 14);

    const allSnakes = [];
    for (const [id, player] of this.players.entries()) {
      const { pos, angle } = this.findSafeSpawn(allSnakes);
      player.snake = new Snake(id, player.snake.name, player.snake.color, false, pos, angle);
      allSnakes.push(player.snake);
    }
    this.bots.clear();
    this.ensureBots();

    this.broadcast({
      type: 'MATCH_STARTED',
      roundDuration: this.roundDuration,
      foods: this.foodManager.getAllFoods(),
      powerups: this.powerupManager.getAllPowerups(),
    });
    console.log(`[GameRoom] New match round started!`);
  }

  broadcastSnapshot(allSnakes) {
    const sorted = [...allSnakes].sort((a, b) => b.score - a.score);
    const leaderboard = sorted.slice(0, 10).map((s, i) => ({
      rank: i + 1,
      id: s.id,
      name: s.name,
      score: s.score,
      kills: s.kills,
      isBot: s.isBot,
    }));

    const snakesData = allSnakes.map(s => s.getSnapshot());
    const foodDelta = this.foodManager.getDelta();

    const snapshot = {
      type: 'GAME_TICK',
      timeRemaining: Math.max(0, Math.ceil(this.timeRemaining)),
      isIntermission: this.isIntermission,
      intermissionTimer: Math.ceil(this.intermissionTimer),
      leaderboard,
      snakes: snakesData,
      foodAdded: foodDelta.added,
      foodEaten: foodDelta.eaten,
      powerups: this.powerupManager.getAllPowerups(),
    };

    this.broadcast(snapshot);
  }

  sendTo(ws, message) {
    if (ws && ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const p of this.players.values()) {
      if (p.ws && p.ws.readyState === 1) {
        p.ws.send(data);
      }
    }
  }
}

module.exports = GameRoom;
