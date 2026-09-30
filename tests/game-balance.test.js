const assert = require("node:assert/strict");
const test = require("node:test");

const GameRoom = require("../server/GameRoom");
const Snake = require("../server/Snake");

test("map presets keep food and power-up density within a balanced range", () => {
  const foodDensities = [];
  const powerupDensities = [];

  for (const preset of Object.values(GameRoom.MAP_PRESETS)) {
    const area = Math.PI * preset.arenaRadius ** 2;
    foodDensities.push(preset.foodCount / area);
    powerupDensities.push(preset.powerupCount / area);
  }

  const relativeSpread = (values) =>
    (Math.max(...values) - Math.min(...values)) /
    (values.reduce((sum, value) => sum + value, 0) / values.length);

  assert.ok(relativeSpread(foodDensities) < 0.01);
  assert.ok(relativeSpread(powerupDensities) < 0.05);
});

test("new rounds preserve the selected map and configured round duration", () => {
  const room = new GameRoom("balance-test", {
    botsEnabled: false,
    recordStats: false,
    mapId: "ash-maze",
    roundDuration: 420,
  });

  room.startNewRound();

  assert.equal(room.timeRemaining, 420);
  assert.equal(
    room.foodManager.targetFoodCount,
    GameRoom.MAP_PRESETS["ash-maze"].foodCount,
  );
  assert.equal(
    room.powerupManager.targetCount,
    GameRoom.MAP_PRESETS["ash-maze"].powerupCount,
  );
});

test("joining players cannot change the active room map", () => {
  const room = new GameRoom("map-lock-test", {
    botsEnabled: false,
    recordStats: false,
    mapId: "neon-grid",
  });
  room.players.set("active-player", {});

  assert.equal(room.setMap("sunfire-arena"), false);
  assert.equal(room.mapId, "neon-grid");
});

test("Nitro is a short burst above normal boost speed", () => {
  const snake = new Snake("balance-test", "Test", "#ffffff");
  snake.inventory.nitro = 1;

  assert.equal(snake.usePowerup("nitro"), true);
  snake.update(0.1, 2200, [], [snake]);

  assert.equal(snake.speed, snake.baseSpeed * 1.9);
  assert.equal(snake.activeEffects.nitro, 2.9);
  assert.ok(snake.speed > snake.boostSpeed);
});
