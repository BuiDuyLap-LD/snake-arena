// public/js/renderer.js

class GameRenderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    this.camX = 0;
    this.camY = 0;
    this.zoom = 1.0;

    // Entity Interpolation Cache (snakes smoothly updated at 60-144fps)
    this.interpolatedSnakes = new Map();

    // Particle FX
    this.particles = [];
    this.radarAngle = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    if (this.minimapCanvas) {
      this.minimapCanvas.width = 140;
      this.minimapCanvas.height = 140;
    }
  }

  // Update server snapshot targets
  syncServerSnakes(serverSnakes) {
    if (!serverSnakes) return;

    const currentIds = new Set();

    for (const s of serverSnakes) {
      currentIds.add(s.id);
      let interp = this.interpolatedSnakes.get(s.id);

      if (!interp) {
        // First time seeing this snake
        interp = {
          id: s.id,
          name: s.name,
          color: s.color,
          isBot: s.isBot,
          alive: s.alive,
          score: s.score,
          kills: s.kills,
          radius: s.radius || 14,
          head: { x: s.head.x, y: s.head.y },
          targetHead: { x: s.head.x, y: s.head.y },
          angle: s.angle,
          targetAngle: s.angle,
          isBoosting: s.isBoosting,
          shield: s.shield,
          length: s.length,
          body: s.body.map(pt => ({ x: pt.x, y: pt.y })),
        };
        this.interpolatedSnakes.set(s.id, interp);
      } else {
        interp.alive = s.alive;
        interp.score = s.score;
        interp.kills = s.kills;
        interp.radius = s.radius;
        interp.isBoosting = s.isBoosting;
        interp.shield = s.shield;
        interp.length = s.length;

        // Teleport threshold: if snake respawned or jumped, snap immediately without lerping across the screen
        const distFromCurrent = Math.hypot(s.head.x - interp.head.x, s.head.y - interp.head.y);
        if (distFromCurrent > 180) {
          interp.head.x = s.head.x;
          interp.head.y = s.head.y;
          interp.targetHead.x = s.head.x;
          interp.targetHead.y = s.head.y;
          interp.angle = s.angle;
          interp.targetAngle = s.angle;
          interp.body = s.body.map(pt => ({ x: pt.x, y: pt.y }));
        } else {
          interp.targetHead.x = s.head.x;
          interp.targetHead.y = s.head.y;
          interp.targetAngle = s.angle;

          // If body count changed significantly or length mismatch, sync segments
          if (Math.abs(interp.body.length - s.body.length) > 3) {
            interp.body = s.body.map(pt => ({ x: pt.x, y: pt.y }));
          }
        }
      }
    }

    // Clean up dead/disconnected snakes
    for (const id of this.interpolatedSnakes.keys()) {
      if (!currentIds.has(id)) {
        this.interpolatedSnakes.delete(id);
      }
    }
  }

  // Client-side prediction & smooth physics step per animation frame
  updateInterpolation(dt, localPlayerId, currentInput) {
    const segmentDist = 12;

    for (const [id, snake] of this.interpolatedSnakes.entries()) {
      if (!snake.alive) continue;

      if (id === localPlayerId && currentInput) {
        // CLIENT PREDICTION FOR LOCAL PLAYER: Zero-latency steering!
        let diff = currentInput.angle - snake.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const maxTurn = 5.2 * dt;
        if (Math.abs(diff) <= maxTurn) {
          snake.angle = currentInput.angle;
        } else {
          snake.angle += Math.sign(diff) * maxTurn;
        }
        snake.angle = (snake.angle + Math.PI * 2) % (Math.PI * 2);

        // Advance head predicted position
        const speed = currentInput.boosting ? 330 : 190;
        snake.head.x += Math.cos(snake.angle) * speed * dt;
        snake.head.y += Math.sin(snake.angle) * speed * dt;

        // Soft reconciliation towards authoritative server position
        if (snake.targetHead) {
          snake.head.x += (snake.targetHead.x - snake.head.x) * 0.12;
          snake.head.y += (snake.targetHead.y - snake.head.y) * 0.12;
        }

        snake.isBoosting = currentInput.boosting;
      } else {
        // ENTITY INTERPOLATION FOR OTHER SNAKES: Smooth 60fps gliding
        const lerpFactor = Math.min(1.0, dt * 24);
        snake.head.x += (snake.targetHead.x - snake.head.x) * lerpFactor;
        snake.head.y += (snake.targetHead.y - snake.head.y) * lerpFactor;

        // Angle lerp
        let diff = snake.targetAngle - snake.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        snake.angle += diff * Math.min(1.0, dt * 18);
        snake.angle = (snake.angle + Math.PI * 2) % (Math.PI * 2);
      }

      // Smooth segment following
      let prevX = snake.head.x;
      let prevY = snake.head.y;
      for (let i = 0; i < snake.body.length; i++) {
        const seg = snake.body[i];
        const dx = seg.x - prevX;
        const dy = seg.y - prevY;
        const dist = Math.hypot(dx, dy);

        if (dist > segmentDist) {
          const factor = segmentDist / dist;
          seg.x = prevX + dx * factor;
          seg.y = prevY + dy * factor;
        }
        prevX = seg.x;
        prevY = seg.y;
      }
    }
  }

  addExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 180 + 40;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color || '#ff3366',
        radius: Math.random() * 5 + 3,
        alpha: 1,
        life: 0.6,
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt / p.life;
      p.radius = Math.max(0.5, p.radius - dt * 2);
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(foodsMap, localPlayerId, arenaRadius = 2200, dt = 0.016, currentInput = null) {
    // 1. Advance interpolation & physics
    this.updateInterpolation(dt, localPlayerId, currentInput);
    this.updateParticles(dt);

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear background
    ctx.fillStyle = '#06080e';
    ctx.fillRect(0, 0, width, height);

    // Camera follow on local snake
    const localSnake = this.interpolatedSnakes.get(localPlayerId);
    if (localSnake && localSnake.head) {
      this.camX += (localSnake.head.x - this.camX) * 0.2;
      this.camY += (localSnake.head.y - this.camY) * 0.2;

      const targetZoom = Math.max(0.72, 1.0 - (localSnake.length / 500) * 0.28);
      this.zoom += (targetZoom - this.zoom) * 0.05;
    }

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    // 2. Draw Background Grid
    this.drawGrid(ctx, width, height);

    // 3. Draw Arena Boundary Forcefield
    this.drawArenaBoundary(ctx, arenaRadius);

    // 4. Draw Foods
    if (foodsMap && foodsMap.size > 0) {
      this.drawFoods(ctx, foodsMap);
    }

    // 5. Draw Snakes (other snakes first, local snake on top)
    const snakesList = Array.from(this.interpolatedSnakes.values());
    snakesList.sort((a, b) => {
      if (a.id === localPlayerId) return 1;
      if (b.id === localPlayerId) return -1;
      return a.length - b.length;
    });

    for (const snake of snakesList) {
      if (snake.alive) {
        this.drawSnake(ctx, snake, snake.id === localPlayerId);
      }
    }

    // 6. Draw Particle FX
    this.drawParticles(ctx);

    ctx.restore();

    // 7. Draw Minimap
    this.drawMinimap(snakesList, localPlayerId, arenaRadius, dt);
  }

  drawGrid(ctx, viewW, viewH) {
    const gridSize = 64;
    const halfW = (viewW / 2) / this.zoom;
    const halfH = (viewH / 2) / this.zoom;

    const startX = Math.floor((this.camX - halfW) / gridSize) * gridSize;
    const endX = Math.ceil((this.camX + halfW) / gridSize) * gridSize;
    const startY = Math.floor((this.camY - halfH) / gridSize) * gridSize;
    const endY = Math.ceil((this.camY + halfH) / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Subtle intersection dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = startX; x <= endX; x += gridSize * 2) {
      for (let y = startY; y <= endY; y += gridSize * 2) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }

  drawArenaBoundary(ctx, radius) {
    ctx.save();

    // Outer dark void
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.rect(radius + 1200, -radius - 1200, -2 * (radius + 1200), 2 * (radius + 1200));
    ctx.fillStyle = 'rgba(4, 6, 12, 0.85)';
    ctx.fill();

    // Fast layered forcefield glow (avoiding expensive shadowBlur)
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 51, 102, 0.25)';
    ctx.lineWidth = 20;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 51, 102, 0.8)';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Inner bright energy rim
    ctx.beginPath();
    ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  drawFoods(ctx, foodsMap) {
    const time = Date.now() * 0.003;
    const halfW = (this.canvas.width / 2) / this.zoom + 50;
    const halfH = (this.canvas.height / 2) / this.zoom + 50;

    for (const f of foodsMap.values()) {
      // Viewport culling
      const dx = f.x - this.camX;
      const dy = f.y - this.camY;
      if (Math.abs(dx) > halfW || Math.abs(dy) > halfH) {
        continue;
      }

      const pulse = 1 + Math.sin(time + f.id) * 0.12;
      const r = f.r * pulse;

      // Outer glow circle
      ctx.beginPath();
      ctx.arc(f.x, f.y, r * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = f.c;
      ctx.globalAlpha = 0.22;
      ctx.fill();

      // Main core
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fillStyle = f.c;
      ctx.globalAlpha = 0.95;
      ctx.fill();

      // White shine
      ctx.beginPath();
      ctx.arc(f.x - r * 0.25, f.y - r * 0.25, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.fill();

      ctx.globalAlpha = 1.0;
    }
  }

  drawSnake(ctx, snake, isLocal) {
    const body = snake.body;
    if (!body || body.length === 0) return;

    const baseRadius = snake.radius || 14;

    // 1. Draw Body Segments (from tail to neck)
    for (let i = body.length - 1; i >= 0; i--) {
      const seg = body[i];
      const taper = Math.max(0.55, 1 - (i / body.length) * 0.45);
      const segRadius = baseRadius * taper;

      ctx.beginPath();
      ctx.arc(seg.x, seg.y, segRadius, 0, Math.PI * 2);

      // Alternate color pattern for cyber stripe look
      ctx.fillStyle = i % 2 === 0 ? snake.color : '#111827';
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = snake.color;
      ctx.stroke();
    }

    // 2. Draw Boosting Flame
    if (snake.isBoosting && body.length > 0) {
      const tail = body[body.length - 1];
      ctx.beginPath();
      ctx.arc(tail.x + (Math.random() - 0.5) * 6, tail.y + (Math.random() - 0.5) * 6, baseRadius * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 170, 0, 0.8)';
      ctx.fill();
    }

    // 3. Draw Snake Head
    const head = snake.head;
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(snake.angle);

    // Fast outer glow halo for local player
    if (isLocal) {
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius + 7, 0, Math.PI * 2);
      ctx.fillStyle = snake.color;
      ctx.globalAlpha = 0.28;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // Head base circle
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = snake.color;
    ctx.fill();

    // Cute animated eyes
    const eyeOffsetX = baseRadius * 0.45;
    const eyeOffsetY = baseRadius * 0.6;
    const eyeRadius = baseRadius * 0.38;
    const pupilRadius = eyeRadius * 0.55;

    // Sclera
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeOffsetX, -eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Pupils looking forward
    ctx.fillStyle = '#05070d';
    ctx.beginPath();
    ctx.arc(eyeOffsetX + 2, -eyeOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeOffsetX + 2, eyeOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 4. Draw Spawn Protection Energy Shield
    if (snake.shield) {
      const time = Date.now() * 0.005;
      const pulse = Math.sin(time * 4) * 3;
      const shieldRadius = baseRadius + 14 + pulse;

      ctx.save();
      // Outer glowing bubble
      ctx.beginPath();
      ctx.arc(head.x, head.y, shieldRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
      ctx.fill();

      // Rotating dashed energy ring
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -time * 20;
      ctx.stroke();

      // Inner bright rim
      ctx.beginPath();
      ctx.arc(head.x, head.y, shieldRadius - 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.stroke();

      // Shield aura along body segments
      for (let i = 0; i < body.length; i += 3) {
        const seg = body[i];
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, baseRadius + 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. Floating Nickname & Shield Tag above head
    ctx.save();
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const tagY = head.y - baseRadius - (snake.shield ? 18 : 12);
    const shieldLabel = snake.shield ? '🛡️ [BẢO VỆ] ' : '';
    const nameText = `${shieldLabel}${snake.name} (${Math.round(snake.score)})`;

    // Background pill
    ctx.fillStyle = snake.shield ? 'rgba(0, 40, 70, 0.85)' : 'rgba(10, 15, 29, 0.75)';
    const textWidth = ctx.measureText(nameText).width;
    ctx.fillRect(head.x - textWidth / 2 - 6, tagY - 14, textWidth + 12, 18);

    if (snake.shield) {
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(head.x - textWidth / 2 - 6, tagY - 14, textWidth + 12, 18);
    }

    ctx.fillStyle = snake.shield ? '#00f0ff' : (isLocal ? '#00f0ff' : '#ffffff');
    ctx.fillText(nameText, head.x, tagY + 2);
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    }
  }

  drawMinimap(snakesList, localPlayerId, arenaRadius, dt) {
    if (!this.minimapCtx) return;
    const mctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const mapRadius = cx - 4;

    mctx.clearRect(0, 0, w, h);

    // Circular background
    mctx.beginPath();
    mctx.arc(cx, cy, mapRadius, 0, Math.PI * 2);
    mctx.fillStyle = 'rgba(8, 12, 22, 0.9)';
    mctx.fill();

    // Radar scan beam
    this.radarAngle += dt * 2.2;
    mctx.save();
    mctx.beginPath();
    mctx.moveTo(cx, cy);
    mctx.arc(cx, cy, mapRadius, this.radarAngle, this.radarAngle + 0.45);
    mctx.closePath();
    mctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
    mctx.fill();
    mctx.restore();

    // Boundary ring
    mctx.beginPath();
    mctx.arc(cx, cy, mapRadius, 0, Math.PI * 2);
    mctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    mctx.lineWidth = 1.5;
    mctx.stroke();

    const scale = mapRadius / arenaRadius;

    // Draw snake dots
    for (const s of snakesList) {
      if (!s.alive) continue;
      const isLocal = s.id === localPlayerId;
      const mx = cx + s.head.x * scale;
      const my = cy + s.head.y * scale;

      mctx.beginPath();
      mctx.arc(mx, my, isLocal ? 3.8 : 2.4, 0, Math.PI * 2);
      mctx.fillStyle = isLocal ? '#00f0ff' : '#ff3366';
      mctx.fill();

      if (isLocal) {
        mctx.beginPath();
        mctx.arc(mx, my, 6, 0, Math.PI * 2);
        mctx.strokeStyle = '#00f0ff';
        mctx.lineWidth = 1;
        mctx.stroke();
      }
    }
  }
}

window.GameRenderer = GameRenderer;
