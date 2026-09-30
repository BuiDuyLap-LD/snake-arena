// server/GameRoom.js

const Snake = require("./Snake");
const FoodManager = require("./FoodManager");
const PowerupManager = require("./PowerupManager");
const leaderboardManager = require("./LeaderboardManager");
const accountManager = require("./AccountManager");

class GameRoom {
  static MAP_PRESETS = {
    "neon-grid": { id: "neon-grid", label: "Neon Grid", arenaRadius: 2200, foodCount: 500, powerupCount: 14 },
    "ash-maze": { id: "ash-maze", label: "Ash Maze", arenaRadius: 2400, foodCount: 560, powerupCount: 16 },
    "crystal-lake": { id: "crystal-lake", label: "Crystal Lake", arenaRadius: 2300, foodCount: 540, powerupCount: 15 },
    "sunfire-arena": { id: "sunfire-arena", label: "Sunfire Arena", arenaRadius: 2100, foodCount: 500, powerupCount: 14 },
  };

  constructor(roomId = "arena-main", options = {}) {
    this.roomId = roomId;
    this.roomCode = options.roomCode || roomId;
    this.mode = options.mode || "ranked";
    this.botsEnabled = options.botsEnabled !== false;
    this.recordStats = options.recordStats !== false;
    this.mapId = options.mapId || "neon-grid";
    this.setMap(this.mapId);

    this.players = new Map(); // ws/id -> { ws, snake }
    this.bots = new Map(); // botId -> snake

    this.targetBotCount = 6;
    this.nextBotId = 1;

    // Match round system
    this.roundDuration = 600; // 10 minutes per round
    this.timeRemaining = this.roundDuration;
    this.isIntermission = false;
    this.intermissionDuration = 8;
    this.intermissionTimer = 0;

    // Tick loop: physics at 50 Hz, broadcast at 25 Hz (every 2 ticks)
    // 25Hz gives 40ms max visual lag (at speed=190 → 7.6 units) — safe margin
    this.tickRate = 50;
    this.tickIntervalMs = 1000 / this.tickRate;
    this.lastTickTime = Date.now();
    this.running = false;
    this.broadcastTickCount = 0;
    this.BROADCAST_EVERY_N = 2; // Broadcast every 2 physics ticks (25Hz)

    // Powerup dirty flag: only broadcast when changed
    this.powerupsDirty = true;
    this.lastPowerupsJson = "";

    // Colors available for bots
    this.botColors = [
      "#ff3366",
      "#33ccff",
      "#ffaa00",
      "#00ffaa",
      "#cc33ff",
      "#ffff33",
      "#ff0055",
      "#00e5ff",
    ];

    // Maintain initial bots
    if (this.botsEnabled) this.ensureBots();
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

  findSafeSpawn(existingSnakes, teamId = null) {
    let bestPos = { x: 0, y: 0 };
    let bestDist = -1;
    const maxRadius = this.arenaRadius - 400;

    const candidateCount = 20;
    for (let c = 0; c < candidateCount; c++) {
      const r = Math.sqrt(Math.random()) * maxRadius;
      const theta = teamId
        ? (teamId === "red" ? Math.PI : 0) + (Math.random() - 0.5) * Math.PI
        : Math.random() * Math.PI * 2;
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

    const initialAngle =
      Math.atan2(-bestPos.y, -bestPos.x) + (Math.random() - 0.5) * 0.5;
    return { pos: bestPos, angle: initialAngle };
  }

  ensureBots() {
    if (!this.botsEnabled) return;
    const needed =
      Math.max(0, this.targetBotCount - this.players.size) - this.bots.size;
    const allSnakes = this.getAllSnakes();

    for (let i = 0; i < needed; i++) {
      const botId = `bot_${this.nextBotId++}`;
      const color =
        this.botColors[Math.floor(Math.random() * this.botColors.length)];
      const { pos, angle } = this.findSafeSpawn(allSnakes);
      const bot = new Snake(
        botId,
        `Bot #${Math.floor(Math.random() * 900 + 100)}`,
        color,
        true,
        pos,
        angle,
      );
      this.bots.set(botId, bot);
      allSnakes.push(bot);
    }
  }

  setMap(mapId) {
    const preset = GameRoom.MAP_PRESETS[mapId] || GameRoom.MAP_PRESETS["neon-grid"];
    this.mapId = preset.id;
    this.mapConfig = preset;
    this.arenaRadius = preset.arenaRadius || 2200;
    this.foodManager = new FoodManager(this.arenaRadius, preset.foodCount || 500);
    this.powerupManager = new PowerupManager(this.arenaRadius, preset.powerupCount || 14);
    this.powerupsDirty = true;
    this.lastPowerupsJson = "";
    console.log(`[GameRoom] Map set to ${preset.label} (${this.mapId}) for room ${this.roomId}.`);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTickTime = Date.now();
    this.loopInterval = setInterval(() => this.tick(), this.tickIntervalMs);
    console.log(
      `[GameRoom] Room ${this.roomId} started at ${this.tickRate}Hz.`,
    );
  }

  stop() {
    this.running = false;
    if (this.loopInterval) clearInterval(this.loopInterval);
  }

  addPlayer(
    ws,
    playerId,
    playerName,
    playerColor,
    accountUsername = null,
    teamId = null,
  ) {
    const { pos, angle } = this.findSafeSpawn(this.getAllSnakes(), teamId);
    const snake = new Snake(
      playerId,
      playerName,
      playerColor,
      false,
      pos,
      angle,
    );
    snake.teamId = teamId;
    this.players.set(playerId, {
      ws,
      snake,
      accountUsername,
      teamId,
      roundScore: 0,
      roundKills: 0,
    });

    this.sendTo(ws, {
      type: "INIT_GAME",
      playerId,
      arenaRadius: this.arenaRadius,
      roundDuration: this.roundDuration,
      timeRemaining: Math.ceil(this.timeRemaining),
      mode: this.mode,
      roomCode: this.roomCode,
      teamId,
      foods: this.foodManager.getAllFoods(),
      powerups: this.powerupManager.getAllPowerups(),
    });

    const accInfo = accountUsername
      ? ` [Tài khoản: ${accountUsername}]`
      : " [Khách]";
    console.log(
      `[GameRoom] Player joined: ${playerName} (${playerId})${accInfo} at (${pos.x}, ${pos.y}).`,
    );
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      if (player.snake && player.snake.alive) {
        this.foodManager.spawnDeadSnakeFood(
          player.snake.body,
          player.snake.color,
        );
        this.recordPlayerStats(player);
      }
      this.players.delete(playerId);
      console.log(
        `[GameRoom] Player left: ${playerId}. Remaining: ${this.players.size}`,
      );
      this.ensureBots();
    }
  }

  handlePlayerInput(playerId, inputData) {
    const player = this.players.get(playerId);
    if (!player || !player.snake || !player.snake.alive) return;

    if (typeof inputData.angle === "number") {
      player.snake.setTargetAngle(inputData.angle);
    }
    if (typeof inputData.boosting === "boolean") {
      player.snake.setBoosting(inputData.boosting);
    }
    if (
      inputData.type === "USE_POWERUP" &&
      typeof inputData.powerup === "string"
    ) {
      const success = player.snake.usePowerup(inputData.powerup);
      if (success) {
        this.sendTo(player.ws, {
          type: "POWERUP_ACTIVATED",
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
      player.roundScore += player.snake.score;
      player.roundKills += player.snake.kills;
      this.recordPlayerStats(player);
    }

    const { pos, angle } = this.findSafeSpawn(
      this.getAllSnakes(),
      player.teamId,
    );
    player.snake = new Snake(
      playerId,
      player.snake.name,
      player.snake.color,
      false,
      pos,
      angle,
    );
    player.snake.teamId = player.teamId;
    console.log(
      `[GameRoom] Player respawned at (${pos.x}, ${pos.y}) with 3s shield.`,
    );
  }

  recordPlayerStats(player, score, kills) {
    if (!this.recordStats) return;
    const finalScore = score ?? player.snake.score;
    const finalKills = kills ?? player.snake.kills;
    const statsTarget = player.accountUsername || player.snake.name;
    leaderboardManager.recordPlayerScore(statsTarget, finalScore, finalKills);
    if (player.accountUsername) {
      accountManager.recordGameStats(
        player.accountUsername,
        finalScore,
        finalKills,
      );
    }
  }

  getRoundStats(snake) {
    const player = this.players.get(snake.id);
    return {
      score: snake.score + (player ? player.roundScore : 0),
      kills: snake.kills + (player ? player.roundKills : 0),
    };
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
      const pellet = snake.update(
        dt,
        this.arenaRadius,
        Array.from(this.foodManager.foods.values()),
        allSnakes,
      );
      if (pellet) {
        this.foodManager.addPellet(
          pellet.x,
          pellet.y,
          pellet.value,
          pellet.color,
        );
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
            type: "POWERUP_COLLECTED",
            powerup: c.type,
            added: c.added,
          });
        }
      }
    }

    // Check Collisions with Shield Protection
    this.checkCollisions(allSnakes);

    // Broadcast snapshot (throttled to reduce network usage)
    this.broadcastTickCount++;
    if (this.broadcastTickCount % this.BROADCAST_EVERY_N === 0) {
      this.broadcastSnapshot(allSnakes);
    }
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
          this.eliminateSnake(s1, null, "va vào hàng rào năng lượng");
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
          if (this.mode === "solo5v5" && s1.teamId && s1.teamId === s2.teamId) {
            continue;
          }
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
        type: "KILL_EVENTS",
        events: killEvents,
      });
    }
  }

  eliminateSnake(victim, killer = null, reason = "") {
    if (!victim.alive) return;
    victim.alive = false;

    // Record human stats to persistent global leaderboard & user account
    if (!victim.isBot) {
      // Tìm player entry để lấy accountUsername
      const victimPlayer = this.players.get(victim.id);
      if (victimPlayer)
        this.recordPlayerStats(victimPlayer, victim.score, victim.kills);
    }
    if (killer && !killer.isBot) {
      const killerPlayer = this.players.get(killer.id);
      if (killerPlayer)
        this.recordPlayerStats(killerPlayer, killer.score, killer.kills);
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
        type: "YOU_DIED",
        killerName: killer ? killer.name : "Hàng rào năng lượng",
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
    allSnakes.sort(
      (a, b) => this.getRoundStats(b).score - this.getRoundStats(a).score,
    );

    // Record stats for all human players
    for (const s of allSnakes) {
      if (!s.isBot) {
        const playerEntry = this.players.get(s.id);
        if (playerEntry) this.recordPlayerStats(playerEntry, s.score, s.kills);
      }
    }

    const rankings = allSnakes.map((snake, index) => {
      const roundStats = this.getRoundStats(snake);
      return {
        rank: index + 1,
        id: snake.id,
        name: snake.name,
        score: roundStats.score,
        kills: roundStats.kills,
        length: snake.body.length,
        color: snake.color,
        isBot: snake.isBot,
        teamId: snake.teamId,
      };
    });

    let teamResult;
    if (this.mode === "solo5v5") {
      const totals = { red: 0, blue: 0 };
      for (const ranking of rankings) {
        if (ranking.teamId === "red" || ranking.teamId === "blue") {
          totals[ranking.teamId] += ranking.score;
        }
      }
      teamResult = {
        redScore: totals.red,
        blueScore: totals.blue,
        winnerTeam:
          totals.red === totals.blue
            ? null
            : totals.red > totals.blue
              ? "red"
              : "blue",
      };
    }

    this.broadcast({
      type: "MATCH_OVER",
      mode: this.mode,
      roomCode: this.roomCode,
      teamResult,
      rankings: rankings,
      intermissionDuration: this.intermissionDuration,
    });

    console.log(
      `[GameRoom] Match over! Winner: ${rankings[0] ? rankings[0].name : "None"}`,
    );
  }

  startNewRound() {
    this.isIntermission = false;
    this.timeRemaining = this.roundDuration;
    this.foodManager = new FoodManager(this.arenaRadius, 500);
    this.powerupManager = new PowerupManager(this.arenaRadius, 14);

    const allSnakes = [];
    for (const [id, player] of this.players.entries()) {
      player.roundScore = 0;
      player.roundKills = 0;
      const { pos, angle } = this.findSafeSpawn(allSnakes, player.teamId);
      player.snake = new Snake(
        id,
        player.snake.name,
        player.snake.color,
        false,
        pos,
        angle,
      );
      player.snake.teamId = player.teamId;
      allSnakes.push(player.snake);
    }
    this.bots.clear();
    this.ensureBots();

    this.broadcast({
      type: "MATCH_STARTED",
      roundDuration: this.roundDuration,
      mode: this.mode,
      roomCode: this.roomCode,
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

    // Use full snapshot (no body compression) to prevent visual drift / invisible deaths
    const snakesData = allSnakes.map((s) => s.getSnapshot());
    const foodDelta = this.foodManager.getDelta();

    // Only include powerups when they changed (dirty flag) — saves bandwidth
    let powerupsPayload = undefined;
    const currentPowerupsJson = JSON.stringify(
      this.powerupManager.getAllPowerups(),
    );
    if (currentPowerupsJson !== this.lastPowerupsJson) {
      this.lastPowerupsJson = currentPowerupsJson;
      powerupsPayload = JSON.parse(currentPowerupsJson);
    }

    const snapshot = {
      type: "GAME_TICK",
      timeRemaining: Math.max(0, Math.ceil(this.timeRemaining)),
      isIntermission: this.isIntermission,
      intermissionTimer: Math.ceil(this.intermissionTimer),
      leaderboard,
      snakes: snakesData,
      foodAdded: foodDelta.added,
      foodEaten: foodDelta.eaten,
    };

    if (powerupsPayload !== undefined) {
      snapshot.powerups = powerupsPayload;
    }

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
