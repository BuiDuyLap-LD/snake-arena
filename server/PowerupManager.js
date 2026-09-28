// server/PowerupManager.js

class PowerupManager {
  constructor(arenaRadius = 2200, targetCount = 14) {
    this.arenaRadius = arenaRadius;
    this.targetCount = targetCount;
    this.powerups = new Map(); // id -> { id, type, x, y, radius: 18 }
    this.nextId = 1;
    this.types = ['nitro', 'vision', 'magnet'];

    // Spawn initial powerups
    for (let i = 0; i < this.targetCount; i++) {
      this.spawnRandomPowerup();
    }
  }

  getRandomPosition() {
    const r = Math.sqrt(Math.random()) * (this.arenaRadius - 200);
    const theta = Math.random() * Math.PI * 2;
    return {
      x: Math.round(Math.cos(theta) * r),
      y: Math.round(Math.sin(theta) * r),
    };
  }

  spawnRandomPowerup() {
    const pos = this.getRandomPosition();
    const type = this.types[Math.floor(Math.random() * this.types.length)];
    const p = {
      id: this.nextId++,
      type,
      x: pos.x,
      y: pos.y,
      radius: 18,
    };
    this.powerups.set(p.id, p);
    return p;
  }

  checkHeadCollisions(snakes) {
    const collected = [];

    for (const snake of snakes) {
      if (!snake.alive) continue;
      const head = snake.head;
      const hitRadius = snake.radius + 18;
      const hitRadiusSq = hitRadius * hitRadius;

      for (const [id, p] of this.powerups.entries()) {
        const dx = p.x - head.x;
        const dy = p.y - head.y;
        if (dx * dx + dy * dy <= hitRadiusSq) {
          this.powerups.delete(id);
          const added = snake.addPowerup(p.type);
          collected.push({
            snakeId: snake.id,
            isBot: snake.isBot,
            type: p.type,
            added,
          });

          // Respawn a new powerup after delay
          setTimeout(() => {
            if (this.powerups.size < this.targetCount) {
              this.spawnRandomPowerup();
            }
          }, 8000 + Math.random() * 4000);
          break;
        }
      }
    }

    return collected;
  }

  getAllPowerups() {
    return Array.from(this.powerups.values());
  }
}

module.exports = PowerupManager;
