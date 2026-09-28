// server/LeaderboardManager.js

const fs = require('fs');
const path = require('path');

class LeaderboardManager {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.filePath = path.join(this.dataDir, 'leaderboard.json');
    this.records = new Map(); // playerNameLower -> record

    this.initStorage();
  }

  initStorage() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            this.records.set(item.name.toLowerCase(), item);
          }
        }
      } else {
        // Seed initial hall of fame records
        const initial = [
          { name: 'DragonViper', highScore: 4250, kills: 28, matches: 35, tier: 'Kim Cương', lastPlayed: Date.now() },
          { name: 'ShadowSnake', highScore: 3820, kills: 22, matches: 28, tier: 'Kim Cương', lastPlayed: Date.now() },
          { name: 'CyberCobra', highScore: 2950, kills: 19, matches: 24, tier: 'Vàng', lastPlayed: Date.now() },
          { name: 'NeonPhantom', highScore: 2410, kills: 15, matches: 18, tier: 'Vàng', lastPlayed: Date.now() },
          { name: 'ToxicKing', highScore: 1890, kills: 12, matches: 15, tier: 'Vàng', lastPlayed: Date.now() },
          { name: 'SpeedHunter', highScore: 1450, kills: 9, matches: 12, tier: 'Bạc', lastPlayed: Date.now() },
        ];
        for (const item of initial) {
          this.records.set(item.name.toLowerCase(), item);
        }
        this.saveToFile();
      }
    } catch (err) {
      console.error('[LeaderboardManager] Error initializing storage:', err);
    }
  }

  getTier(highScore) {
    if (highScore >= 7000) return 'Thách Đấu 👑';
    if (highScore >= 3500) return 'Kim Cương 💎';
    if (highScore >= 1500) return 'Vàng 🥇';
    if (highScore >= 500) return 'Bạc 🥈';
    return 'Đồng 🥉';
  }

  recordPlayerScore(name, score, kills) {
    if (!name || typeof name !== 'string') return;
    const cleanName = name.trim();
    if (cleanName.length === 0 || cleanName.startsWith('Bot-') || cleanName.startsWith('Bot #')) {
      return; // Ignore bot scores
    }

    const key = cleanName.toLowerCase();
    const existing = this.records.get(key) || {
      name: cleanName,
      highScore: 0,
      kills: 0,
      matches: 0,
      tier: 'Đồng 🥉',
      lastPlayed: Date.now(),
    };

    existing.name = cleanName; // Preserve casing
    existing.matches = (existing.matches || 0) + 1;
    existing.kills = (existing.kills || 0) + (kills || 0);
    if (score > existing.highScore) {
      existing.highScore = score;
    }
    existing.tier = this.getTier(existing.highScore);
    existing.lastPlayed = Date.now();

    this.records.set(key, existing);
    this.saveToFile();
  }

  getTopPlayers(limit = 20) {
    const list = Array.from(this.records.values());
    list.sort((a, b) => b.highScore - a.highScore);
    return list.slice(0, limit).map((p, idx) => ({
      rank: idx + 1,
      name: p.name,
      highScore: p.highScore,
      kills: p.kills,
      matches: p.matches,
      tier: p.tier,
    }));
  }

  saveToFile() {
    try {
      const list = Array.from(this.records.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('[LeaderboardManager] Save failed:', err);
    }
  }
}

module.exports = new LeaderboardManager();
