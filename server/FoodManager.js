// server/FoodManager.js

class FoodManager {
  constructor(arenaRadius = 2200, targetFoodCount = 500) {
    this.arenaRadius = arenaRadius;
    this.targetFoodCount = targetFoodCount;
    this.foods = new Map(); // id -> food object
    this.nextFoodId = 1;

    // Deltas to broadcast
    this.newFoodsBatch = [];
    this.eatenIdsBatch = [];

    this.neonColors = [
      '#00ffff', // Electric Cyan
      '#ff007f', // Hot Pink
      '#ffe600', // Bright Gold
      '#00ff66', // Toxic Lime
      '#bd00ff', // Cyber Violet
      '#ff6600', // Plasma Orange
      '#ffffff', // Supernova White
    ];

    // Seed initial food
    for (let i = 0; i < this.targetFoodCount; i++) {
      this.spawnRandomFood(false);
    }
  }

  getRandomPosition() {
    const r = Math.sqrt(Math.random()) * (this.arenaRadius - 60);
    const theta = Math.random() * Math.PI * 2;
    return {
      x: Math.round(Math.cos(theta) * r),
      y: Math.round(Math.sin(theta) * r),
    };
  }

  spawnRandomFood(trackBatch = true) {
    const pos = this.getRandomPosition();
    const isSpecial = Math.random() < 0.12;
    const value = isSpecial ? Math.floor(Math.random() * 3) + 3 : 1;
    const radius = isSpecial ? 5.5 : 3.8;
    const color = this.neonColors[Math.floor(Math.random() * this.neonColors.length)];

    const food = {
      id: this.nextFoodId++,
      x: pos.x,
      y: pos.y,
      v: value,
      r: radius,
      c: color,
    };

    this.foods.set(food.id, food);
    if (trackBatch) {
      this.newFoodsBatch.push(food);
    }
    return food;
  }

  addPellet(x, y, value = 1, color = null) {
    if (this.foods.size >= this.targetFoodCount * 2) {
      // Remove an older food
      const firstKey = this.foods.keys().next().value;
      if (firstKey) {
        this.foods.delete(firstKey);
        this.eatenIdsBatch.push(firstKey);
      }
    }

    const food = {
      id: this.nextFoodId++,
      x: Math.round(x),
      y: Math.round(y),
      v: value,
      r: Math.min(8, 3.5 + value * 0.7),
      c: color || this.neonColors[Math.floor(Math.random() * this.neonColors.length)],
    };

    this.foods.set(food.id, food);
    this.newFoodsBatch.push(food);
  }

  spawnDeadSnakeFood(bodySegments, snakeColor) {
    for (let i = 0; i < bodySegments.length; i += 2) {
      const seg = bodySegments[i];
      const count = Math.floor(Math.random() * 2) + 1;
      for (let j = 0; j < count; j++) {
        const spreadX = seg.x + (Math.random() - 0.5) * 36;
        const spreadY = seg.y + (Math.random() - 0.5) * 36;
        const value = Math.floor(Math.random() * 3) + 3;
        this.addPellet(spreadX, spreadY, value, snakeColor);
      }
    }
  }

  checkHeadCollisions(snake) {
    const head = snake.head;
    const eatRadius = snake.radius + 14;
    const eatRadiusSq = eatRadius * eatRadius;
    const eaten = [];

    for (const [id, f] of this.foods.entries()) {
      const dx = f.x - head.x;
      const dy = f.y - head.y;
      if (dx * dx + dy * dy <= eatRadiusSq) {
        eaten.push(f);
        this.foods.delete(id);
        this.eatenIdsBatch.push(id);
        snake.grow(f.v);
      }
    }

    // Maintain baseline food
    while (this.foods.size < this.targetFoodCount) {
      this.spawnRandomFood(true);
    }

    return eaten;
  }

  getDelta() {
    const added = this.newFoodsBatch;
    const eaten = this.eatenIdsBatch;
    this.newFoodsBatch = [];
    this.eatenIdsBatch = [];
    return { added, eaten };
  }

  getAllFoods() {
    return Array.from(this.foods.values());
  }
}

module.exports = FoodManager;
