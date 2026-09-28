// public/js/main.js

class GameClient {
  constructor() {
    this.ws = null;
    this.localPlayerId = null;
    this.arenaRadius = 2200;

    // Delta food storage on client
    this.foods = new Map();

    this.selectedColor = '#00f0ff';
    this.currentInput = { angle: 0, boosting: false };
    this.lastSentInput = { angle: null, boosting: null };
    this.lastInputSendTime = 0;

    // HUD throttles
    this.lastLeaderboardRender = 0;
    this.lastTimerText = '';
    this.lastPlayerCountText = '';

    this.initDOM();
    this.initRenderer();
    this.initInput();
    this.bindEvents();
    this.startGameLoop();
  }

  initDOM() {
    this.canvas = document.getElementById('game-canvas');
    this.minimapCanvas = document.getElementById('minimap-canvas');

    // Overlays & Modals
    this.screenLobby = document.getElementById('screen-lobby');
    this.modalDeath = document.getElementById('modal-death');
    this.modalMatchOver = document.getElementById('modal-match-over');

    // HUD Elements
    this.timerEl = document.getElementById('match-timer');
    this.playerCountEl = document.getElementById('player-count');
    this.leaderboardEl = document.getElementById('leaderboard-list');
    this.killFeedEl = document.getElementById('kill-feed');
    this.statLengthEl = document.getElementById('stat-length');
    this.statScoreEl = document.getElementById('stat-score');
    this.statKillsEl = document.getElementById('stat-kills');

    // Inputs & Buttons
    this.inputName = document.getElementById('player-name');
    this.btnJoin = document.getElementById('btn-join');
    this.btnRespawn = document.getElementById('btn-respawn');
    this.btnMute = document.getElementById('btn-mute');
    this.btnTouchBoost = document.getElementById('btn-touch-boost');

    // Skin options
    this.skinOptions = document.querySelectorAll('.skin-option');

    // Death modal stats
    this.deathReasonEl = document.getElementById('death-reason');
    this.deathScoreEl = document.getElementById('death-score');
    this.deathKillsEl = document.getElementById('death-kills');

    // Match Over
    this.podiumFirst = document.getElementById('podium-first');
    this.podiumSecond = document.getElementById('podium-second');
    this.podiumThird = document.getElementById('podium-third');
    this.intermissionTimeEl = document.getElementById('intermission-time');
  }

  initRenderer() {
    this.renderer = new GameRenderer(this.canvas, this.minimapCanvas);
  }

  initInput() {
    this.inputManager = new InputManager(this.canvas);
    this.inputManager.onInputChange = (input) => {
      this.currentInput = input;
      this.sendInputIfChanged();
    };
  }

  bindEvents() {
    // Skin selection
    this.skinOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        this.skinOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.selectedColor = opt.getAttribute('data-color');
      });
    });

    // Join button
    this.btnJoin.addEventListener('click', () => this.joinGame());
    this.inputName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinGame();
    });

    // Respawn button
    this.btnRespawn.addEventListener('click', () => {
      this.modalDeath.classList.add('hidden');
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'RESPAWN' }));
      }
    });

    // Sound toggle
    this.btnMute.addEventListener('click', () => {
      const enabled = window.soundEngine.toggle();
      this.btnMute.textContent = enabled ? '🔊' : '🔇';
    });

    // Touch boost
    if (this.btnTouchBoost) {
      this.btnTouchBoost.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.inputManager.setTouchBoost(true);
      });
      this.btnTouchBoost.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.inputManager.setTouchBoost(false);
      });
    }
  }

  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Client] Connected to server.');
      const playerName = this.inputName.value.trim() || 'Viper';
      this.ws.send(JSON.stringify({
        type: 'JOIN_GAME',
        name: playerName,
        color: this.selectedColor,
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleServerMessage(msg);
      } catch (e) {
        console.error('[Client] Message error:', e);
      }
    };

    this.ws.onclose = () => {
      console.warn('[Client] Disconnected. Reconnecting in 1.5s...');
      setTimeout(() => this.connectWebSocket(), 1500);
    };

    this.ws.onerror = (err) => {
      console.error('[Client] WebSocket error:', err);
    };
  }

  joinGame() {
    this.screenLobby.classList.add('hidden');
    window.soundEngine.init();
    this.connectWebSocket();
  }

  sendInputIfChanged() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const now = performance.now();
    const angleDiff = this.lastSentInput.angle === null 
      ? 999 
      : Math.abs(this.currentInput.angle - this.lastSentInput.angle);
    const boostChanged = this.currentInput.boosting !== this.lastSentInput.boosting;

    // Send immediately on boost toggle, or if angle changed significantly, throttled at 20ms minimum
    if ((boostChanged || angleDiff > 0.03) && (now - this.lastInputSendTime >= 20)) {
      this.lastInputSendTime = now;
      this.lastSentInput.angle = this.currentInput.angle;
      this.lastSentInput.boosting = this.currentInput.boosting;

      this.ws.send(JSON.stringify({
        type: 'PLAYER_INPUT',
        angle: Number(this.currentInput.angle.toFixed(3)),
        boosting: this.currentInput.boosting,
      }));
    }
  }

  handleServerMessage(msg) {
    switch (msg.type) {
      case 'INIT_GAME':
        this.localPlayerId = msg.playerId;
        this.arenaRadius = msg.arenaRadius;
        this.foods.clear();
        if (msg.foods) {
          for (const f of msg.foods) {
            this.foods.set(f.id, f);
          }
        }
        break;

      case 'GAME_TICK':
        this.updateGameState(msg);
        break;

      case 'YOU_DIED':
        window.soundEngine.playDeath();
        this.showDeathModal(msg);
        break;

      case 'KILL_EVENTS':
        this.handleKillEvents(msg.events);
        break;

      case 'MATCH_OVER':
        window.soundEngine.playMatchEnd();
        this.showMatchOverModal(msg.rankings, msg.intermissionDuration);
        break;

      case 'MATCH_STARTED':
        this.modalMatchOver.classList.add('hidden');
        this.modalDeath.classList.add('hidden');
        if (msg.foods) {
          this.foods.clear();
          for (const f of msg.foods) {
            this.foods.set(f.id, f);
          }
        }
        break;
    }
  }

  updateGameState(msg) {
    // 1. Delta Food update
    if (msg.foodEaten && msg.foodEaten.length > 0) {
      for (let i = 0; i < msg.foodEaten.length; i++) {
        this.foods.delete(msg.foodEaten[i]);
      }
    }
    if (msg.foodAdded && msg.foodAdded.length > 0) {
      for (let i = 0; i < msg.foodAdded.length; i++) {
        const f = msg.foodAdded[i];
        this.foods.set(f.id, f);
      }
    }

    // 2. Feed server snake data to renderer entity interpolation
    this.renderer.syncServerSnakes(msg.snakes);

    // 3. Local snake stats & sound
    const mySnake = msg.snakes.find(s => s.id === this.localPlayerId);
    if (mySnake) {
      const prevScore = parseInt(this.statScoreEl.textContent, 10) || 0;
      if (mySnake.score > prevScore) {
        window.soundEngine.playEat();
      }
      this.statLengthEl.textContent = mySnake.length;
      this.statScoreEl.textContent = mySnake.score;
      this.statKillsEl.textContent = mySnake.kills;
    }

    // 4. Timer update (only if second changed)
    const mins = Math.floor(msg.timeRemaining / 60);
    const secs = msg.timeRemaining % 60;
    const timerStr = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (timerStr !== this.lastTimerText) {
      this.lastTimerText = timerStr;
      this.timerEl.textContent = timerStr;
      if (msg.timeRemaining <= 30 && !msg.isIntermission) {
        this.timerEl.classList.add('hurry');
      } else {
        this.timerEl.classList.remove('hurry');
      }
    }

    // 5. Total player count badge (only if text changed)
    const activeHuman = msg.snakes.filter(s => !s.isBot).length;
    const countStr = `👥 ${activeHuman} người chơi | ${msg.snakes.length} rắn`;
    if (countStr !== this.lastPlayerCountText) {
      this.lastPlayerCountText = countStr;
      this.playerCountEl.textContent = countStr;
    }

    // 6. Throttled Leaderboard DOM update (every 250ms)
    const now = performance.now();
    if (now - this.lastLeaderboardRender >= 250) {
      this.lastLeaderboardRender = now;
      this.renderLeaderboard(msg.leaderboard);
    }

    // Intermission text
    if (msg.isIntermission && !this.modalMatchOver.classList.contains('hidden')) {
      this.intermissionTimeEl.textContent = `Vòng đấu mới trong: ${msg.intermissionTimer}s`;
    }
  }

  renderLeaderboard(leaderboard) {
    if (!leaderboard) return;
    this.leaderboardEl.innerHTML = '';

    leaderboard.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'leaderboard-row';
      if (entry.id === this.localPlayerId) li.classList.add('self');
      if (entry.rank === 1) li.classList.add('rank-1');

      const isFirst = entry.rank === 1 ? '👑 ' : `#${entry.rank} `;
      li.innerHTML = `
        <div class="row-left">
          <span class="row-rank">${isFirst}</span>
          <span>${entry.name}</span>
        </div>
        <span class="row-score">${entry.score}</span>
      `;
      this.leaderboardEl.appendChild(li);
    });
  }

  handleKillEvents(events) {
    if (!events) return;
    events.forEach(ev => {
      if (ev.killerId === this.localPlayerId) {
        window.soundEngine.playKill();
      }

      const item = document.createElement('div');
      item.className = 'kill-item';
      item.innerHTML = `<span class="killer-name">⚡ ${ev.killer}</span> đã hạ gục <span class="victim-name">${ev.victim}</span>!`;
      this.killFeedEl.prepend(item);

      setTimeout(() => {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 4200);
    });
  }

  showDeathModal(data) {
    this.deathReasonEl.textContent = data.reason || 'Bạn đã bị tiêu diệt!';
    this.deathScoreEl.textContent = data.score || 0;
    this.deathKillsEl.textContent = data.kills || 0;
    this.modalDeath.classList.remove('hidden');
  }

  showMatchOverModal(rankings, duration) {
    if (!rankings || rankings.length === 0) return;

    const r1 = rankings[0];
    const r2 = rankings[1];
    const r3 = rankings[2];

    if (r1) {
      this.podiumFirst.querySelector('.podium-name').textContent = r1.name;
      this.podiumFirst.querySelector('.podium-score').textContent = `${r1.score} pts`;
    }
    if (r2) {
      this.podiumSecond.querySelector('.podium-name').textContent = r2.name;
      this.podiumSecond.querySelector('.podium-score').textContent = `${r2.score} pts`;
    } else {
      this.podiumSecond.querySelector('.podium-name').textContent = '-';
      this.podiumSecond.querySelector('.podium-score').textContent = '-';
    }
    if (r3) {
      this.podiumThird.querySelector('.podium-name').textContent = r3.name;
      this.podiumThird.querySelector('.podium-score').textContent = `${r3.score} pts`;
    } else {
      this.podiumThird.querySelector('.podium-name').textContent = '-';
      this.podiumThird.querySelector('.podium-score').textContent = '-';
    }

    this.intermissionTimeEl.textContent = `Vòng đấu mới trong: ${duration}s`;
    this.modalMatchOver.classList.remove('hidden');
  }

  startGameLoop() {
    let lastTime = performance.now();

    const loop = (time) => {
      const dt = Math.min(0.08, (time - lastTime) / 1000);
      lastTime = time;

      // Keep sending input changes
      this.sendInputIfChanged();

      // Render at 60-144 FPS with local client prediction & smooth entity interpolation
      this.renderer.render(this.foods, this.localPlayerId, this.arenaRadius, dt, this.currentInput);

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameClient();
});
