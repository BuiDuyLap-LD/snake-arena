// server/Snake.js

class Snake {
  static SLOW_GROWTH_THRESHOLD = 80;
  static VERY_SLOW_GROWTH_THRESHOLD = 120;
  static MAX_BODY_LENGTH = 160;

  constructor(
    id,
    name,
    color,
    isBot = false,
    spawnPos = null,
    initialAngle = null,
  ) {
    this.id = id;
    this.name =
      name ||
      (isBot ? `Bot-${Math.floor(Math.random() * 900 + 100)}` : "Player");
    this.color = color || "#00ffcc";
    this.isBot = isBot;
    this.alive = true;
    this.kills = 0;
    this.score = 0;

    // Spawn protection: 3 seconds of invulnerability
    this.shieldTimer = 3.0;

    // Power-up Inventory & Active Effects
    this.inventory = {
      nitro: 0,
      vision: 0,
      magnet: 0,
    };
    this.activeEffects = {
      nitro: 0,
      vision: 0,
      magnet: 0,
    };

    // Movement & Physics
    this.baseSpeed = 190;
    this.boostSpeed = 330;
    this.speed = this.baseSpeed;
    this.isBoosting = false;
    this.angle =
      initialAngle !== null ? initialAngle : Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.turnSpeed = 5.2; // radians/second

    // Dimensions & Segments
    this.baseRadius = 14;
    this.radius = this.baseRadius;
    this.segmentDist = 12;
    this.initialSegments = 22;
    this.growthProgress = 0;

    const startX = spawnPos ? spawnPos.x : (Math.random() - 0.5) * 1200;
    const startY = spawnPos ? spawnPos.y : (Math.random() - 0.5) * 1200;

    this.head = { x: startX, y: startY };
    this.body = [];
    for (let i = 0; i < this.initialSegments; i++) {
      this.body.push({
        x: startX - Math.cos(this.angle) * i * this.segmentDist,
        y: startY - Math.sin(this.angle) * i * this.segmentDist,
      });
    }

    // Bot AI state
    this.botDecisionTimer = 0;
    this.botTargetFood = null;
    this.boostDropCooldown = 0;
  }

  isShielded() {
    return this.shieldTimer > 0;
  }

  setTargetAngle(angle) {
    this.targetAngle = angle;
  }

  setBoosting(boosting) {
    if (this.body.length <= 12 && !this.activeEffects.nitro) {
      this.isBoosting = false;
      return;
    }
    this.isBoosting = boosting;
  }

  addPowerup(type) {
    if (this.inventory[type] !== undefined) {
      if (this.inventory[type] < 2) {
        this.inventory[type]++;
        return true;
      }
    }
    return false;
  }

  usePowerup(type) {
    if (!this.alive) return false;
    if (this.inventory[type] && this.inventory[type] > 0) {
      this.inventory[type]--;
      if (type === "nitro") {
        this.activeEffects.nitro = 3.0;
      } else if (type === "vision") {
        this.activeEffects.vision = 8.0; // 8s wide eagle-eye vision
      } else if (type === "magnet") {
        this.activeEffects.magnet = 6.0; // 6s food magnet
      }
      return true;
    }
    return false;
  }

  update(dt, arenaRadius, foods, allSnakes) {
    if (!this.alive) return null;

    // Decrement spawn protection shield
    if (this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    }

    // Decrement active effects
    if (this.activeEffects.nitro > 0) {
      this.activeEffects.nitro = Math.max(0, this.activeEffects.nitro - dt);
    }
    if (this.activeEffects.vision > 0) {
      this.activeEffects.vision = Math.max(0, this.activeEffects.vision - dt);
    }
    if (this.activeEffects.magnet > 0) {
      this.activeEffects.magnet = Math.max(0, this.activeEffects.magnet - dt);
      this.applyMagnetEffect(dt, foods);
    }

    if (this.isBot) {
      this.updateBotAI(dt, arenaRadius, foods, allSnakes);
    }

    // Smooth turn towards target angle (shortest angular distance)
    let diff = this.targetAngle - this.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const maxTurn = this.turnSpeed * dt;
    if (Math.abs(diff) <= maxTurn) {
      this.angle = this.targetAngle;
    } else {
      this.angle += Math.sign(diff) * maxTurn;
    }

    // Normalize angle
    this.angle = (this.angle + Math.PI * 2) % (Math.PI * 2);

    // Speed handling & boosting penalty
    let droppedPellet = null;

    if (this.activeEffects.nitro > 0) {
      this.speed = this.baseSpeed * 1.9;
    } else if (this.isBoosting && this.body.length > 12) {
      this.speed = this.boostSpeed;
      this.boostDropCooldown += dt;
      if (this.boostDropCooldown >= 0.16) {
        this.boostDropCooldown = 0;
        const tail = this.body[this.body.length - 1];
        if (tail) {
          droppedPellet = {
            x: tail.x + (Math.random() - 0.5) * 10,
            y: tail.y + (Math.random() - 0.5) * 10,
            value: 1,
            color: this.color,
            radius: 4,
          };
          if (Math.random() < 0.35 && this.body.length > 15) {
            this.body.pop();
          }
        }
      }
    } else {
      this.speed = this.baseSpeed;
      this.isBoosting = false;
    }

    // Move head
    const vx = Math.cos(this.angle) * this.speed * dt;
    const vy = Math.sin(this.angle) * this.speed * dt;
    this.head.x += vx;
    this.head.y += vy;

    // Update body segments to follow head smoothly
    this.updateBodySegments();

    // Dynamically adjust radius with length
    this.radius = Math.min(
      26,
      this.baseRadius + Math.floor(this.body.length / 40),
    );

    return droppedPellet;
  }

  applyMagnetEffect(dt, foods) {
    const pullRadius = 420;
    const pullRadiusSq = pullRadius * pullRadius;
    const pullSpeed = 480 * dt;

    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      if (!f) continue;
      const dx = this.head.x - f.x;
      const dy = this.head.y - f.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < pullRadiusSq && distSq > 4) {
        const dist = Math.sqrt(distSq);
        const factor = Math.min(1, pullSpeed / dist);
        f.x += dx * factor * 1.5;
        f.y += dy * factor * 1.5;
      }
    }
  }

  updateBodySegments() {
    if (this.body.length === 0) return;

    let prevX = this.head.x;
    let prevY = this.head.y;

    for (let i = 0; i < this.body.length; i++) {
      const seg = this.body[i];
      const dx = seg.x - prevX;
      const dy = seg.y - prevY;
      const dist = Math.hypot(dx, dy);

      if (dist > this.segmentDist) {
        const factor = this.segmentDist / dist;
        seg.x = prevX + dx * factor;
        seg.y = prevY + dy * factor;
      }

      prevX = seg.x;
      prevY = seg.y;
    }
  }

  grow(value = 1) {
    this.score += value * 10;
    if (this.body.length >= Snake.MAX_BODY_LENGTH) {
      this.growthProgress = 0;
      return;
    }

    const segmentsToAdd = Math.max(1, Math.floor(value / 1.5));
    const lastSeg = this.body[this.body.length - 1] || this.head;

    for (let i = 0; i < segmentsToAdd; i++) {
      if (this.body.length >= Snake.MAX_BODY_LENGTH) {
        this.growthProgress = 0;
        break;
      }

      const growthRate =
        this.body.length >= Snake.VERY_SLOW_GROWTH_THRESHOLD
          ? 20
          : this.body.length >= Snake.SLOW_GROWTH_THRESHOLD
            ? 50
            : 100;
      this.growthProgress += growthRate;
      if (this.growthProgress >= 100) {
        this.growthProgress -= 100;
        this.body.push({ x: lastSeg.x, y: lastSeg.y });
      }
    }
    if (this.body.length >= Snake.MAX_BODY_LENGTH) this.growthProgress = 0;
  }

  updateBotAI(dt, arenaRadius, foods, allSnakes) {
    this.botDecisionTimer -= dt;

    // Never boost while shielded
    if (this.shieldTimer > 0) {
      this.isBoosting = false;
    }

    // Check danger: near arena border
    const distToCenter = Math.hypot(this.head.x, this.head.y);
    if (distToCenter > arenaRadius - 250) {
      this.targetAngle = Math.atan2(-this.head.y, -this.head.x);
      this.isBoosting = false;
      return;
    }

    // Avoid other snakes
    let immediateThreat = false;
    const lookAheadDist = 110;
    const futureHeadX = this.head.x + Math.cos(this.angle) * lookAheadDist;
    const futureHeadY = this.head.y + Math.sin(this.angle) * lookAheadDist;

    for (const other of allSnakes) {
      if (!other.alive || other.id === this.id) continue;

      for (let i = 0; i < other.body.length; i += 2) {
        const seg = other.body[i];
        const d = Math.hypot(futureHeadX - seg.x, futureHeadY - seg.y);
        if (d < this.radius + other.radius + 50) {
          const avoidAngle = Math.atan2(
            this.head.y - seg.y,
            this.head.x - seg.x,
          );
          this.targetAngle = avoidAngle + (Math.random() > 0.5 ? 0.8 : -0.8);
          immediateThreat = true;
          this.isBoosting = this.body.length > 25 && Math.random() < 0.3;
          break;
        }
      }
      if (immediateThreat) break;
    }

    if (immediateThreat) return;

    // Re-evaluate target food
    if (this.botDecisionTimer <= 0) {
      this.botDecisionTimer = 0.35 + Math.random() * 0.2;
      this.isBoosting = false;

      let bestFood = null;
      let minDistSq = 450 * 450;

      for (let i = 0; i < foods.length; i += 2) {
        const f = foods[i];
        if (!f) continue;
        const dx = f.x - this.head.x;
        const dy = f.y - this.head.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          bestFood = f;
        }
      }

      if (bestFood) {
        this.targetAngle = Math.atan2(
          bestFood.y - this.head.y,
          bestFood.x - this.head.x,
        );
        if (bestFood.v > 5 && minDistSq < 220 * 220 && this.body.length > 30) {
          this.isBoosting = true;
        }
      } else {
        this.targetAngle += (Math.random() - 0.5) * 0.6;
      }
    }
  }

  getSnapshot() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      isBot: this.isBot,
      teamId: this.teamId,
      alive: this.alive,
      score: this.score,
      kills: this.kills,
      radius: this.radius,
      head: { x: Math.round(this.head.x), y: Math.round(this.head.y) },
      angle: Number(this.angle.toFixed(2)),
      isBoosting: this.isBoosting,
      shield: this.shieldTimer > 0,
      length: this.body.length,
      body: this.body.map((s) => ({ x: Math.round(s.x), y: Math.round(s.y) })),
      inventory: { ...this.inventory },
      activeEffects: {
        nitro: Number(this.activeEffects.nitro.toFixed(1)),
        vision: Number(this.activeEffects.vision.toFixed(1)),
        magnet: Number(this.activeEffects.magnet.toFixed(1)),
      },
    };
  }

  // Compressed snapshot for network broadcast: samples every 2nd body segment
  // and uses short keys to minimize JSON payload size (~40-50% smaller body data)
  getSnapshotCompressed() {
    // Sample body: every 2nd segment (visual quality preserved, half the data)
    const bodyStep = 2;
    const bodyCompressed = [];
    for (let i = 0; i < this.body.length; i += bodyStep) {
      const s = this.body[i];
      bodyCompressed.push([Math.round(s.x), Math.round(s.y)]);
    }
    if (this.body.length > 1 && (this.body.length - 1) % bodyStep !== 0) {
      const tail = this.body[this.body.length - 1];
      bodyCompressed.push([Math.round(tail.x), Math.round(tail.y)]);
    }

    return {
      id: this.id,
      name: this.name,
      color: this.color,
      isBot: this.isBot,
      teamId: this.teamId,
      alive: this.alive,
      score: this.score,
      kills: this.kills,
      radius: this.radius,
      head: { x: Math.round(this.head.x), y: Math.round(this.head.y) },
      angle: Number(this.angle.toFixed(2)),
      isBoosting: this.isBoosting,
      shield: this.shieldTimer > 0,
      length: this.body.length,
      body: bodyCompressed, // Array of [x, y] pairs (compressed)
      bodyStep, // Client uses this to know the sampling stride
      inventory: { ...this.inventory },
      activeEffects: {
        nitro: Number(this.activeEffects.nitro.toFixed(1)),
        vision: Number(this.activeEffects.vision.toFixed(1)),
        magnet: Number(this.activeEffects.magnet.toFixed(1)),
      },
    };
  }
}

module.exports = Snake;
