// public/js/renderer.js

class GameRenderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas ? minimapCanvas.getContext("2d") : null;

    this.camX = 0;
    this.camY = 0;
    this.zoom = 1.0;

    // Entity Interpolation Cache (snakes smoothly updated at 60-144fps)
    this.interpolatedSnakes = new Map();
    this.activeEmotes = new Map();

    // Particle FX
    this.particles = [];
    this.radarAngle = 0;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    if (this.minimapCanvas) {
      this.minimapCanvas.width = 140;
      this.minimapCanvas.height = 140;
    }
  }

  // Decode body from server: handles {x,y} objects (standard) or [x,y] pairs (compressed)
  _decodeBody(body, targetLength = body?.length || 0, bodyStep = 1) {
    if (!body || body.length === 0) return [];
    if (Array.isArray(body[0])) {
      const points = body.map((pt) => ({ x: pt[0], y: pt[1] }));
      const length = Math.max(points.length, targetLength || points.length);
      const stride = Math.max(1, bodyStep || 1);
      if (stride === 1 || points.length === length) return points;

      const decoded = new Array(length);
      points.forEach((point, index) => {
        decoded[Math.min(index * stride, length - 1)] = point;
      });
      for (let i = 0; i < points.length - 1; i += 1) {
        const startIndex = Math.min(i * stride, length - 1);
        const endIndex = Math.min((i + 1) * stride, length - 1);
        const span = endIndex - startIndex;
        for (let step = 1; step < span; step += 1) {
          const amount = step / span;
          decoded[startIndex + step] = {
            x: points[i].x + (points[i + 1].x - points[i].x) * amount,
            y: points[i].y + (points[i + 1].y - points[i].y) * amount,
          };
        }
      }
      return decoded.filter(Boolean);
    }
    // Standard format: array of {x, y} objects
    return body.map((pt) => ({ x: pt.x, y: pt.y }));
  }

  showEmote(playerId, emoteId, duration = 1800) {
    const icons = {
      "emote-wave": "👋",
      "emote-heart": "💖",
      "emote-laugh": "😂",
      "emote-fire": "🔥",
      "emote-star": "⭐",
      "emote-cry": "😭",
      "emote-crown": "👑",
      "emote-gg": "🎉",
    };
    const icon = icons[emoteId];
    if (!icon || typeof playerId !== "string") return false;
    this.activeEmotes.set(playerId, {
      icon,
      expiresAt: performance.now() + Math.max(700, Math.min(duration, 2500)),
    });
    return true;
  }

  // Update server snapshot targets
  syncServerSnakes(serverSnakes) {
    if (!serverSnakes) return;

    const currentIds = new Set();

    for (const s of serverSnakes) {
      currentIds.add(s.id);
      if (!s.alive) this.activeEmotes.delete(s.id);
      let interp = this.interpolatedSnakes.get(s.id);
      const serverBody = this._decodeBody(s.body, s.length, s.bodyStep);

      if (!interp) {
        interp = {
          id: s.id,
          name: s.name,
          color: s.color,
          isBot: s.isBot,
          teamId: s.teamId || null,
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
          body: serverBody.map((segment) => ({ ...segment })),
          targetBody: serverBody,
          activeEffects: s.activeEffects || { nitro: 0, vision: 0, magnet: 0 },
          inventory: s.inventory || { nitro: 0, vision: 0, magnet: 0 },
        };
        this.interpolatedSnakes.set(s.id, interp);
      } else {
        interp.alive = s.alive;
        interp.score = s.score;
        interp.kills = s.kills;
        interp.radius = s.radius;
        interp.teamId = s.teamId || null;
        interp.isBoosting = s.isBoosting;
        interp.shield = s.shield;
        interp.length = s.length;
        interp.activeEffects = s.activeEffects || {
          nitro: 0,
          vision: 0,
          magnet: 0,
        };
        interp.inventory = s.inventory || { nitro: 0, vision: 0, magnet: 0 };
        interp.targetBody = serverBody;

        const distFromCurrent = Math.hypot(
          s.head.x - interp.head.x,
          s.head.y - interp.head.y,
        );
        if (distFromCurrent > 180) {
          interp.head.x = s.head.x;
          interp.head.y = s.head.y;
          interp.targetHead.x = s.head.x;
          interp.targetHead.y = s.head.y;
          interp.angle = s.angle;
          interp.targetAngle = s.angle;
          interp.body = serverBody.map((segment) => ({ ...segment }));
        } else {
          interp.targetHead.x = s.head.x;
          interp.targetHead.y = s.head.y;
          interp.targetAngle = s.angle;

          if (interp.body.length !== serverBody.length) {
            interp.body = serverBody.map((segment) => ({ ...segment }));
          }
        }
      }
    }

    for (const id of this.interpolatedSnakes.keys()) {
      if (!currentIds.has(id)) {
        this.interpolatedSnakes.delete(id);
        this.activeEmotes.delete(id);
      }
    }
  }

  // Client-side prediction & smooth physics step per animation frame
  updateInterpolation(dt, localPlayerId, currentInput) {
    const segmentDist = 12;

    for (const [id, snake] of this.interpolatedSnakes.entries()) {
      if (!snake.alive) continue;

      const isNitro = snake.activeEffects && snake.activeEffects.nitro > 0;

      if (id === localPlayerId && currentInput) {
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

        let speed = 190;
        if (isNitro) speed = 190 * 1.9;
        else if (currentInput.boosting && snake.length > 12) speed = 330;

        snake.head.x += Math.cos(snake.angle) * speed * dt;
        snake.head.y += Math.sin(snake.angle) * speed * dt;

        if (snake.targetHead) {
          snake.head.x += (snake.targetHead.x - snake.head.x) * 0.12;
          snake.head.y += (snake.targetHead.y - snake.head.y) * 0.12;
        }

        snake.isBoosting = isNitro || currentInput.boosting;
      } else {
        if (snake.targetHead) {
          snake.head.x += (snake.targetHead.x - snake.head.x) * 0.22;
          snake.head.y += (snake.targetHead.y - snake.head.y) * 0.22;
        }

        if (typeof snake.targetAngle === "number") {
          let diff = snake.targetAngle - snake.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          snake.angle += diff * 0.22;
          snake.angle = (snake.angle + Math.PI * 2) % (Math.PI * 2);
        }
      }

      // Smooth segment trailing
      const body = snake.body;
      if (body && body.length > 0) {
        let prevX = snake.head.x;
        let prevY = snake.head.y;

        for (let i = 0; i < body.length; i++) {
          const seg = body[i];
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

        if (snake.targetBody && snake.targetBody.length === body.length) {
          for (let i = 0; i < body.length; i++) {
            body[i].x += (snake.targetBody[i].x - body[i].x) * 0.35;
            body[i].y += (snake.targetBody[i].y - body[i].y) * 0.35;
          }
        }
      }

      // Particle spawn for nitro/boost
      if (snake.isBoosting && Math.random() < 0.45 && body && body.length > 0) {
        const tail = body[body.length - 1];
        this.particles.push({
          x: tail.x + (Math.random() - 0.5) * 8,
          y: tail.y + (Math.random() - 0.5) * 8,
          vx: -Math.cos(snake.angle) * (60 + Math.random() * 80),
          vy: -Math.sin(snake.angle) * (60 + Math.random() * 80),
          radius: Math.random() * 4 + 2,
          color: isNitro ? "#ff9900" : snake.color,
          alpha: 0.85,
          life: 0.35,
        });
      }
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

  render(
    foodsMap,
    localPlayerId,
    arenaRadius = 2200,
    dt = 0.016,
    currentInput = null,
    powerupsList = [],
  ) {
    this.updateInterpolation(dt, localPlayerId, currentInput);
    this.updateParticles(dt);

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear background
    ctx.fillStyle = "#06080e";
    ctx.fillRect(0, 0, width, height);

    // Camera follow on local snake
    const localSnake = this.interpolatedSnakes.get(localPlayerId);
    if (localSnake && localSnake.head) {
      this.camX += (localSnake.head.x - this.camX) * 0.2;
      this.camY += (localSnake.head.y - this.camY) * 0.2;

      const isVision =
        localSnake.activeEffects && localSnake.activeEffects.vision > 0;
      let targetZoom = Math.max(0.72, 1.0 - (localSnake.length / 500) * 0.28);
      if (isVision) {
        targetZoom *= 0.62; // 1.7x wide zoom out
      }
      this.zoom += (targetZoom - this.zoom) * 0.06;
    }

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    // 1. Draw Background Grid
    this.drawGrid(ctx, width, height);

    // 2. Draw Arena Boundary Forcefield
    this.drawArenaBoundary(ctx, arenaRadius);

    // 3. Draw Foods
    if (foodsMap && foodsMap.size > 0) {
      this.drawFoods(ctx, foodsMap);
    }

    // 4. Draw Powerup Orbs on Arena
    if (powerupsList && powerupsList.length > 0) {
      this.drawPowerups(ctx, powerupsList);
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
    this.drawMinimap(snakesList, localPlayerId, arenaRadius, dt, powerupsList);
  }

  drawGrid(ctx, viewW, viewH) {
    const gridSize = 64;
    const halfW = viewW / 2 / this.zoom;
    const halfH = viewH / 2 / this.zoom;

    const startX = Math.floor((this.camX - halfW) / gridSize) * gridSize;
    const endX = Math.ceil((this.camX + halfW) / gridSize) * gridSize;
    const startY = Math.floor((this.camY - halfH) / gridSize) * gridSize;
    const endY = Math.ceil((this.camY + halfH) / gridSize) * gridSize;

    ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
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

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
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
    ctx.rect(
      radius + 1200,
      -radius - 1200,
      -2 * (radius + 1200),
      2 * (radius + 1200),
    );
    ctx.fillStyle = "rgba(4, 6, 12, 0.85)";
    ctx.fill();

    // Forcefield glow
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 51, 102, 0.25)";
    ctx.lineWidth = 20;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 51, 102, 0.8)";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  drawFoods(ctx, foodsMap) {
    const halfW = this.canvas.width / 2 / this.zoom + 80;
    const halfH = this.canvas.height / 2 / this.zoom + 80;
    const minX = this.camX - halfW;
    const maxX = this.camX + halfW;
    const minY = this.camY - halfH;
    const maxY = this.camY + halfH;

    for (const f of foodsMap.values()) {
      if (f.x < minX || f.x > maxX || f.y < minY || f.y > maxY) continue;

      const r = f.r || 4;

      // Outer glow
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
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.85;
      ctx.fill();

      ctx.globalAlpha = 1.0;
    }
  }

  drawPowerups(ctx, powerupsList) {
    const time = Date.now() * 0.003;
    const halfW = this.canvas.width / 2 / this.zoom + 120;
    const halfH = this.canvas.height / 2 / this.zoom + 120;
    const minX = this.camX - halfW;
    const maxX = this.camX + halfW;
    const minY = this.camY - halfH;
    const maxY = this.camY + halfH;

    for (const p of powerupsList) {
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;

      ctx.save();
      ctx.translate(p.x, p.y);

      let color = "#ffbe0b";
      let icon = "⚡";
      if (p.type === "vision") {
        color = "#bd00ff";
        icon = "👁️";
      } else if (p.type === "magnet") {
        color = "#00f0ff";
        icon = "🧲";
      }

      const pulse = Math.sin(time * 3 + p.id) * 3;
      const radius = 18 + pulse;

      // Outer glow
      ctx.beginPath();
      ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.fill();

      // Rotating dashed ring
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -time * 20;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Glowing sphere body
      const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, radius);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.5, color);
      grad.addColorStop(1, "#0a0f1d");
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.95;
      ctx.fill();

      // Icon
      ctx.globalAlpha = 1.0;
      ctx.font = "15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, 0, 1);

      ctx.restore();
    }
  }

  drawSnake(ctx, snake, isLocal) {
    const body = snake.body;
    if (!body || body.length === 0) return;

    const baseRadius = snake.radius || 14;
    const isNitro = snake.activeEffects && snake.activeEffects.nitro > 0;
    const isMagnet = snake.activeEffects && snake.activeEffects.magnet > 0;
    const isVision = snake.activeEffects && snake.activeEffects.vision > 0;

    // 1. Draw Body Segments (from tail to neck)
    for (let i = body.length - 1; i >= 0; i--) {
      const seg = body[i];
      const taper = Math.max(0.55, 1 - (i / body.length) * 0.45);
      const segRadius = baseRadius * taper;

      ctx.beginPath();
      ctx.arc(seg.x, seg.y, segRadius, 0, Math.PI * 2);

      if (isNitro) {
        ctx.fillStyle = i % 2 === 0 ? "#ffbe0b" : "#ff0055";
      } else {
        ctx.fillStyle = i % 2 === 0 ? snake.color : "#111827";
      }
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isNitro ? "#ffd700" : snake.color;
      ctx.stroke();
    }

    // 2. Draw Boosting Flame / Nitro Aura
    if ((snake.isBoosting || isNitro) && body.length > 0) {
      const tail = body[body.length - 1];
      ctx.beginPath();
      ctx.arc(
        tail.x + (Math.random() - 0.5) * 6,
        tail.y + (Math.random() - 0.5) * 6,
        baseRadius * (isNitro ? 1.4 : 0.9),
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = isNitro
        ? "rgba(255, 190, 11, 0.95)"
        : "rgba(255, 170, 0, 0.8)";
      ctx.fill();
    }

    // 3. Draw Snake Head
    const head = snake.head;
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(snake.angle);

    if (isLocal) {
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius + 7, 0, Math.PI * 2);
      ctx.fillStyle = isNitro ? "#ffbe0b" : snake.color;
      ctx.globalAlpha = 0.32;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    if (snake.teamId === "red" || snake.teamId === "blue") {
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = snake.teamId === "red" ? "#ff4a61" : "#43a0ff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Head base circle
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = isNitro ? "#ff9900" : snake.color;
    ctx.fill();

    // Eyes
    const eyeOffsetX = baseRadius * 0.45;
    const eyeOffsetY = baseRadius * 0.6;
    const eyeRadius = baseRadius * 0.38;
    const pupilRadius = eyeRadius * 0.55;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeOffsetX, -eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#05070d";
    ctx.beginPath();
    ctx.arc(eyeOffsetX + 2, -eyeOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeOffsetX + 2, eyeOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 4. Draw Magnet Magnetic Wave Aura
    if (isMagnet) {
      const time = Date.now() * 0.008;
      for (let ring = 1; ring <= 3; ring++) {
        const ringRad = ((time * 30 + ring * 25) % 80) + baseRadius;
        const ringAlpha = Math.max(0, 1 - (ringRad - baseRadius) / 80);
        ctx.save();
        ctx.beginPath();
        ctx.arc(head.x, head.y, ringRad, 0, Math.PI * 2);
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2;
        ctx.globalAlpha = ringAlpha * 0.7;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Draw Vision Psychic Ring
    if (isVision) {
      const time = Date.now() * 0.004;
      ctx.save();
      ctx.beginPath();
      ctx.arc(head.x, head.y, baseRadius + 16, 0, Math.PI * 2);
      ctx.strokeStyle = "#bd00ff";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = time * 25;
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // 6. Draw Spawn Protection Energy Shield
    if (snake.shield) {
      const time = Date.now() * 0.005;
      const pulse = Math.sin(time * 4) * 3;
      const shieldRadius = baseRadius + 14 + pulse;

      ctx.save();
      ctx.beginPath();
      ctx.arc(head.x, head.y, shieldRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 240, 255, 0.18)";
      ctx.fill();

      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -time * 20;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(head.x, head.y, shieldRadius - 3, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 7. Draw Name Tag & Active Skill Badges
    ctx.save();
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.textAlign = "center";

    const tagY = head.y - baseRadius - (snake.shield ? 18 : 12);
    let badges = "";
    if (snake.shield) badges += "🛡️";
    if (isNitro) badges += "⚡";
    if (isMagnet) badges += "🧲";
    if (isVision) badges += "👁️";

    const prefix = badges ? `${badges} ` : "";
    const nameText = `${prefix}${snake.name} (${Math.round(snake.score)})`;

    ctx.fillStyle = snake.shield
      ? "rgba(0, 40, 70, 0.85)"
      : "rgba(10, 15, 29, 0.75)";
    const textWidth = ctx.measureText(nameText).width;
    ctx.fillRect(head.x - textWidth / 2 - 6, tagY - 14, textWidth + 12, 18);

    if (snake.shield) {
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 1;
      ctx.strokeRect(head.x - textWidth / 2 - 6, tagY - 14, textWidth + 12, 18);
    }

    ctx.fillStyle = isNitro
      ? "#ffd700"
      : snake.shield
        ? "#00f0ff"
        : isLocal
          ? "#00f0ff"
          : "#ffffff";
    ctx.fillText(nameText, head.x, tagY + 2);
    ctx.restore();

    this.drawEmote(ctx, snake, baseRadius);
  }

  drawEmote(ctx, snake, baseRadius) {
    const emote = this.activeEmotes.get(snake.id);
    if (!emote) return;

    const remaining = emote.expiresAt - performance.now();
    if (remaining <= 0) {
      this.activeEmotes.delete(snake.id);
      return;
    }

    const fade = Math.min(1, remaining / 320);
    const head = snake.head;
    const width = 50;
    const height = 44;
    const x = head.x - width / 2;
    const y = head.y - baseRadius - 70;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(250, 253, 255, 0.96)";
    ctx.strokeStyle = snake.color || "#00f0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 13);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(head.x - 6, y + height - 1);
    ctx.lineTo(head.x, y + height + 8);
    ctx.lineTo(head.x + 7, y + height - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = '27px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(emote.icon, head.x, y + height / 2 + 1);
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

  drawMinimap(snakesList, localPlayerId, arenaRadius, dt, powerupsList = []) {
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
    mctx.fillStyle = "rgba(8, 12, 22, 0.9)";
    mctx.fill();

    // Radar scan beam
    this.radarAngle += dt * 2.2;
    mctx.save();
    mctx.beginPath();
    mctx.moveTo(cx, cy);
    mctx.arc(cx, cy, mapRadius, this.radarAngle, this.radarAngle + 0.45);
    mctx.closePath();
    mctx.fillStyle = "rgba(0, 240, 255, 0.08)";
    mctx.fill();
    mctx.restore();

    // Boundary ring
    mctx.beginPath();
    mctx.arc(cx, cy, mapRadius, 0, Math.PI * 2);
    mctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
    mctx.lineWidth = 1.5;
    mctx.stroke();

    const scale = mapRadius / arenaRadius;

    // Draw powerups on minimap
    for (const p of powerupsList) {
      const px = cx + p.x * scale;
      const py = cy + p.y * scale;
      mctx.beginPath();
      mctx.arc(px, py, 2.2, 0, Math.PI * 2);
      mctx.fillStyle =
        p.type === "nitro"
          ? "#ffbe0b"
          : p.type === "vision"
            ? "#bd00ff"
            : "#00f0ff";
      mctx.fill();
    }

    // Draw snake dots
    for (const s of snakesList) {
      if (!s.alive) continue;
      const isLocal = s.id === localPlayerId;
      const mx = cx + s.head.x * scale;
      const my = cy + s.head.y * scale;

      mctx.beginPath();
      mctx.arc(mx, my, isLocal ? 3.8 : 2.4, 0, Math.PI * 2);
      mctx.fillStyle = isLocal ? "#00f0ff" : "#ff3366";
      mctx.fill();

      if (isLocal) {
        mctx.beginPath();
        mctx.arc(mx, my, 6, 0, Math.PI * 2);
        mctx.strokeStyle = "#00f0ff";
        mctx.lineWidth = 1;
        mctx.stroke();
      }
    }
  }
}

window.GameRenderer = GameRenderer;
