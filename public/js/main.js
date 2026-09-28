// public/js/main.js

class GameClient {
  constructor() {
    this.ws = null;
    this.localPlayerId = null;
    this.arenaRadius = 2200;

    // Delta food storage on client
    this.foods = new Map();
    this.powerups = [];

    this.selectedColor = '#00f0ff';
    this.currentInput = { angle: 0, boosting: false };
    this.lastSentInput = { angle: null, boosting: null };
    this.lastInputSendTime = 0;

    // Room info
    this.roomCode = 'ARENA-5V5';

    // HUD throttles
    this.lastLeaderboardRender = 0;
    this.lastTimerText = '';
    this.lastPlayerCountText = '';

    // Career stats
    this.careerStats = this.loadCareerStats();

    this.initDOM();
    this.initRenderer();
    this.initInput();
    this.bindEvents();
    this.initLobby();
    this.startGameLoop();
  }

  loadCareerStats() {
    try {
      const data = localStorage.getItem('snake_career_stats');
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Could not read career stats:', e);
    }
    return { highScore: 0, totalKills: 0, matchesPlayed: 0 };
  }

  saveCareerStats(score = 0, kills = 0) {
    if (score > this.careerStats.highScore) {
      this.careerStats.highScore = score;
    }
    this.careerStats.totalKills += (kills || 0);
    this.careerStats.matchesPlayed += 1;
    try {
      localStorage.setItem('snake_career_stats', JSON.stringify(this.careerStats));
    } catch (e) {
      console.warn('Could not save career stats:', e);
    }
    this.updateCareerUI();
  }

  getTierName(score) {
    if (score >= 7000) return '👑 Thách Đấu';
    if (score >= 3500) return '💎 Kim Cương';
    if (score >= 1500) return '🥇 Vàng';
    if (score >= 500) return '🥈 Bạc';
    return '🥉 Đồng';
  }

  initDOM() {
    this.canvas = document.getElementById('game-canvas');
    this.minimapCanvas = document.getElementById('minimap-canvas');

    // Overlays & Modals
    this.screenLobby = document.getElementById('screen-lobby');
    this.modalDeath = document.getElementById('modal-death');
    this.modalMatchOver = document.getElementById('modal-match-over');
    this.toastContainer = document.getElementById('toast-container');

    // Lobby Elements
    this.inputName = document.getElementById('player-name');
    this.btnJoin = document.getElementById('btn-join');
    this.skinOptions = document.querySelectorAll('.skin-option');
    this.avatarPreview = document.getElementById('snake-avatar-preview');
    this.myTierBadge = document.getElementById('my-tier-badge');
    this.btnCopyInvite = document.getElementById('btn-copy-invite');
    this.lobbyRoomCode = document.getElementById('lobby-room-code');
    this.lobbyOnlineCount = document.getElementById('lobby-online-count');
    this.btnRefreshRank = document.getElementById('btn-refresh-rank');
    this.globalRankTbody = document.getElementById('global-rank-tbody');
    this.btnLobbySound = document.getElementById('btn-lobby-sound');

    // Career Stats Elements
    this.myHighScoreEl = document.getElementById('my-high-score');
    this.myTotalKillsEl = document.getElementById('my-total-kills');
    this.myMatchesCountEl = document.getElementById('my-matches-count');

    // In-Game HUD Elements
    this.timerEl = document.getElementById('match-timer');
    this.playerCountEl = document.getElementById('player-count');
    this.leaderboardEl = document.getElementById('leaderboard-list');
    this.leaderboardPanel = document.getElementById('leaderboard-panel');
    this.leaderboardToggle = document.getElementById('leaderboard-toggle');
    this.killFeedEl = document.getElementById('kill-feed');
    this.statLengthEl = document.getElementById('stat-length');
    this.statScoreEl = document.getElementById('stat-score');
    this.statKillsEl = document.getElementById('stat-kills');

    // In-Game Buttons
    this.btnHudLobby = document.getElementById('btn-hud-lobby');
    this.btnMute = document.getElementById('btn-mute');
    this.btnTouchBoost = document.getElementById('btn-touch-boost');
    this.btnRespawn = document.getElementById('btn-respawn');
    this.btnDeathLobby = document.getElementById('btn-death-lobby');
    this.btnMatchoverLobby = document.getElementById('btn-matchover-lobby');

    // Power-up Skill Hotbar
    this.btnSkillNitro = document.getElementById('btn-skill-nitro');
    this.btnSkillVision = document.getElementById('btn-skill-vision');
    this.btnSkillMagnet = document.getElementById('btn-skill-magnet');
    this.stockNitro = document.getElementById('stock-nitro');
    this.stockVision = document.getElementById('stock-vision');
    this.stockMagnet = document.getElementById('stock-magnet');
    this.cdNitro = document.getElementById('cd-nitro');
    this.cdVision = document.getElementById('cd-vision');
    this.cdMagnet = document.getElementById('cd-magnet');

    // Death Modal Stats
    this.deathReasonEl = document.getElementById('death-reason');
    this.deathScoreEl = document.getElementById('death-score');
    this.deathKillsEl = document.getElementById('death-kills');

    // Match Over Podium
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
    this.inputManager.onUseSkill = (skillType) => {
      this.usePowerup(skillType);
    };
  }

  initLobby() {
    // Check URL parameters for custom room code
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      this.roomCode = roomParam.toUpperCase();
      if (this.lobbyRoomCode) {
        this.lobbyRoomCode.textContent = `#${this.roomCode}`;
      }
    }

    // Load saved player name
    const savedName = localStorage.getItem('snake_player_name');
    if (savedName && this.inputName) {
      this.inputName.value = savedName;
    }

    this.updateCareerUI();
    this.updateAvatarPreview();
    this.fetchGlobalLeaderboard();
  }

  updateCareerUI() {
    if (this.myHighScoreEl) this.myHighScoreEl.textContent = this.careerStats.highScore;
    if (this.myTotalKillsEl) this.myTotalKillsEl.textContent = this.careerStats.totalKills;
    if (this.myMatchesCountEl) this.myMatchesCountEl.textContent = this.careerStats.matchesPlayed;
    if (this.myTierBadge) {
      this.myTierBadge.textContent = this.getTierName(this.careerStats.highScore);
    }
  }

  updateAvatarPreview() {
    if (this.avatarPreview) {
      this.avatarPreview.style.background = `radial-gradient(circle at 35% 35%, ${this.selectedColor} 0%, #0a1020 100%)`;
      this.avatarPreview.style.boxShadow = `0 0 25px ${this.selectedColor}`;
    }
  }

  showToast(text) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = text;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  async fetchGlobalLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        if (data.leaderboard) {
          this.renderGlobalLeaderboard(data.leaderboard);
        }
      }
    } catch (e) {
      console.warn('Failed to load global leaderboard:', e);
    }
  }

  renderGlobalLeaderboard(list) {
    if (!this.globalRankTbody) return;
    if (!list || list.length === 0) {
      this.globalRankTbody.innerHTML = '<tr><td colspan="5" class="table-loading">Chưa có người chơi nào trên bảng xếp hạng.</td></tr>';
      return;
    }

    this.globalRankTbody.innerHTML = '';
    list.forEach(p => {
      const tr = document.createElement('tr');

      let rankDisplay = `#${p.rank}`;
      let medalClass = '';
      if (p.rank === 1) { rankDisplay = '👑 1'; medalClass = 'gold'; }
      else if (p.rank === 2) { rankDisplay = '🥈 2'; medalClass = 'silver'; }
      else if (p.rank === 3) { rankDisplay = '🥉 3'; medalClass = 'bronze'; }

      let tierClass = 'bronze';
      if (p.tier.includes('Thách Đấu')) tierClass = 'challenger';
      else if (p.tier.includes('Kim Cương')) tierClass = 'diamond';
      else if (p.tier.includes('Vàng')) tierClass = 'gold';
      else if (p.tier.includes('Bạc')) tierClass = 'silver';

      tr.innerHTML = `
        <td><span class="rank-medal ${medalClass}">${rankDisplay}</span></td>
        <td><span class="rank-player-name">${p.name}</span></td>
        <td><span class="tier-tag ${tierClass}">${p.tier}</span></td>
        <td style="text-align: right; font-weight: 800; color: #00f0ff;">${p.highScore.toLocaleString()}</td>
        <td style="text-align: right; font-weight: 700; color: #ff3366;">${p.kills}</td>
      `;
      this.globalRankTbody.appendChild(tr);
    });
  }

  bindEvents() {
    // Skin selection
    this.skinOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        this.skinOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.selectedColor = opt.getAttribute('data-color');
        this.updateAvatarPreview();
      });
    });

    // Copy Invite Link
    if (this.btnCopyInvite) {
      this.btnCopyInvite.addEventListener('click', () => {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomCode}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(inviteUrl).then(() => {
            this.showToast('📋 Đã sao chép link mời bạn bè vào phòng!');
          }).catch(() => {
            prompt('Sao chép đường link này gửi bạn bè:', inviteUrl);
          });
        } else {
          prompt('Sao chép đường link này gửi bạn bè:', inviteUrl);
        }
      });
    }

    // Refresh rank button
    if (this.btnRefreshRank) {
      this.btnRefreshRank.addEventListener('click', () => {
        this.fetchGlobalLeaderboard();
        this.showToast('🔄 Đã làm mới bảng xếp hạng!');
      });
    }

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

    // Return to Lobby buttons
    const returnToLobby = () => {
      this.modalDeath.classList.add('hidden');
      this.modalMatchOver.classList.add('hidden');
      this.screenLobby.classList.remove('hidden');
      this.fetchGlobalLeaderboard();
      this.updateCareerUI();
    };

    if (this.btnHudLobby) this.btnHudLobby.addEventListener('click', returnToLobby);
    if (this.btnDeathLobby) this.btnDeathLobby.addEventListener('click', returnToLobby);
    if (this.btnMatchoverLobby) this.btnMatchoverLobby.addEventListener('click', returnToLobby);

    // Sound toggle buttons
    const toggleSound = () => {
      const enabled = window.soundEngine.toggle();
      const icon = enabled ? '🔊' : '🔇';
      if (this.btnMute) this.btnMute.textContent = icon;
      if (this.btnLobbySound) this.btnLobbySound.textContent = icon;
    };
    if (this.btnMute) this.btnMute.addEventListener('click', toggleSound);
    if (this.btnLobbySound) this.btnLobbySound.addEventListener('click', toggleSound);

    // Leaderboard toggle (mobile & desktop)
    if (this.leaderboardToggle && this.leaderboardPanel) {
      this.leaderboardToggle.addEventListener('click', () => {
        this.leaderboardPanel.classList.toggle('collapsed');
      });
    }

    // Skill Hotbar Clicks
    if (this.btnSkillNitro) this.btnSkillNitro.addEventListener('click', () => this.usePowerup('nitro'));
    if (this.btnSkillVision) this.btnSkillVision.addEventListener('click', () => this.usePowerup('vision'));
    if (this.btnSkillMagnet) this.btnSkillMagnet.addEventListener('click', () => this.usePowerup('magnet'));

    // Touch / Click boost
    if (this.btnTouchBoost) {
      const startBoost = (e) => {
        if (e.cancelable) e.preventDefault();
        this.btnTouchBoost.classList.add('active');
        this.inputManager.setTouchBoost(true);
      };
      const endBoost = (e) => {
        if (e.cancelable) e.preventDefault();
        this.btnTouchBoost.classList.remove('active');
        this.inputManager.setTouchBoost(false);
      };

      this.btnTouchBoost.addEventListener('touchstart', startBoost, { passive: false });
      this.btnTouchBoost.addEventListener('touchend', endBoost, { passive: false });
      this.btnTouchBoost.addEventListener('touchcancel', endBoost, { passive: false });
      this.btnTouchBoost.addEventListener('mousedown', startBoost);
      this.btnTouchBoost.addEventListener('mouseup', endBoost);
      this.btnTouchBoost.addEventListener('mouseleave', endBoost);
    }
  }

  usePowerup(type) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'USE_POWERUP',
      powerup: type,
    }));
  }

  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Client] Connected to server.');
      const playerName = this.inputName.value.trim() || 'Viper';
      localStorage.setItem('snake_player_name', playerName);

      this.ws.send(JSON.stringify({
        type: 'JOIN_GAME',
        name: playerName,
        color: this.selectedColor,
        room: this.roomCode,
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
        if (msg.powerups) {
          this.powerups = msg.powerups;
        }
        break;

      case 'GAME_TICK':
        this.updateGameState(msg);
        break;

      case 'POWERUP_COLLECTED':
        window.soundEngine.playPowerupPickup();
        let name = 'Vật phẩm';
        if (msg.powerup === 'nitro') name = '⚡ Tăng Tốc Đột Biến (Phím 1)';
        else if (msg.powerup === 'vision') name = '👁️ Thấu Kính Thần Nhãn (Phím 2)';
        else if (msg.powerup === 'magnet') name = '🧲 Nam Châm Hút Thức Ăn (Phím 3)';
        this.showToast(`✨ Đã nhặt: ${name}`);
        break;

      case 'POWERUP_ACTIVATED':
        if (msg.powerup === 'nitro') window.soundEngine.playSkillNitro();
        else if (msg.powerup === 'vision') window.soundEngine.playSkillVision();
        else if (msg.powerup === 'magnet') window.soundEngine.playSkillMagnet();
        break;

      case 'YOU_DIED':
        window.soundEngine.playDeath();
        this.saveCareerStats(msg.score, msg.kills);
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
        if (msg.powerups) {
          this.powerups = msg.powerups;
        }
        break;

      case 'GLOBAL_LEADERBOARD':
        if (msg.leaderboard) {
          this.renderGlobalLeaderboard(msg.leaderboard);
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

    // 2. Powerups update
    if (msg.powerups) {
      this.powerups = msg.powerups;
    }

    // 3. Sync snake data to renderer
    this.renderer.syncServerSnakes(msg.snakes);

    // 4. Local snake stats, sounds, and skill hotbar
    const mySnake = msg.snakes.find(s => s.id === this.localPlayerId);
    if (mySnake) {
      const prevScore = parseInt(this.statScoreEl.textContent, 10) || 0;
      if (mySnake.score > prevScore) {
        window.soundEngine.playEat();
      }
      this.statLengthEl.textContent = mySnake.length;
      this.statScoreEl.textContent = mySnake.score;
      this.statKillsEl.textContent = mySnake.kills;

      // Update Skill Hotbar
      this.updateSkillHotbar(mySnake);
    }

    // 5. Timer update
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

    // 6. Player count
    const activeHuman = msg.snakes.filter(s => !s.isBot).length;
    const countStr = `👥 ${activeHuman} người chơi | ${msg.snakes.length} rắn`;
    if (countStr !== this.lastPlayerCountText) {
      this.lastPlayerCountText = countStr;
      this.playerCountEl.textContent = countStr;
      if (this.lobbyOnlineCount) {
        this.lobbyOnlineCount.textContent = `Trực tuyến: ${activeHuman} người chơi`;
      }
    }

    // 7. Throttled in-game Leaderboard DOM update (every 250ms)
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

  updateSkillHotbar(snake) {
    if (!snake) return;
    const inv = snake.inventory || { nitro: 0, vision: 0, magnet: 0 };
    const effects = snake.activeEffects || { nitro: 0, vision: 0, magnet: 0 };

    // Nitro
    if (this.stockNitro) this.stockNitro.textContent = inv.nitro || 0;
    if (this.btnSkillNitro) {
      this.btnSkillNitro.classList.toggle('has-stock', (inv.nitro || 0) > 0);
      this.btnSkillNitro.classList.toggle('active-skill', (effects.nitro || 0) > 0);
    }
    if (this.cdNitro) {
      const pct = effects.nitro > 0 ? (effects.nitro / 5.0) * 100 : 0;
      this.cdNitro.style.width = `${pct}%`;
    }

    // Vision
    if (this.stockVision) this.stockVision.textContent = inv.vision || 0;
    if (this.btnSkillVision) {
      this.btnSkillVision.classList.toggle('has-stock', (inv.vision || 0) > 0);
      this.btnSkillVision.classList.toggle('active-skill', (effects.vision || 0) > 0);
    }
    if (this.cdVision) {
      const pct = effects.vision > 0 ? (effects.vision / 8.0) * 100 : 0;
      this.cdVision.style.width = `${pct}%`;
    }

    // Magnet
    if (this.stockMagnet) this.stockMagnet.textContent = inv.magnet || 0;
    if (this.btnSkillMagnet) {
      this.btnSkillMagnet.classList.toggle('has-stock', (inv.magnet || 0) > 0);
      this.btnSkillMagnet.classList.toggle('active-skill', (effects.magnet || 0) > 0);
    }
    if (this.cdMagnet) {
      const pct = effects.magnet > 0 ? (effects.magnet / 6.0) * 100 : 0;
      this.cdMagnet.style.width = `${pct}%`;
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

      this.sendInputIfChanged();

      this.renderer.render(
        this.foods,
        this.localPlayerId,
        this.arenaRadius,
        dt,
        this.currentInput,
        this.powerups
      );

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameClient();
});
