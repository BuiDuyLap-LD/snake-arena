const assert = require("node:assert/strict");
const zlib = require("node:zlib");
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

test("snake growth slows at 80 and 120 segments and stops at the hard cap", () => {
  const snake = new Snake("growth-test", "Growth Test", "#ffffff");
  snake.body = Array.from({ length: 79 }, () => ({ x: 0, y: 0 }));

  snake.grow(1);
  assert.equal(snake.body.length, 80);
  snake.grow(1);
  assert.equal(snake.body.length, 80);
  snake.grow(1);
  assert.equal(snake.body.length, 81);

  snake.body = Array.from({ length: 120 }, () => ({ x: 0, y: 0 }));
  snake.growthProgress = 0;
  snake.grow(1);
  assert.equal(snake.body.length, 120);
  for (let i = 0; i < 4; i++) snake.grow(1);
  assert.equal(snake.body.length, 121);

  snake.body = Array.from({ length: Snake.MAX_BODY_LENGTH - 1 }, () => ({
    x: 0,
    y: 0,
  }));
  snake.growthProgress = 0;
  for (let i = 0; i < 5; i++) snake.grow(1);
  assert.equal(snake.body.length, Snake.MAX_BODY_LENGTH);

  const scoreAtCap = snake.score;
  snake.grow(5);
  assert.equal(snake.body.length, Snake.MAX_BODY_LENGTH);
  assert.equal(snake.score, scoreAtCap + 50);

  const largeFoodSnake = new Snake(
    "large-food-growth-test",
    "Large Food",
    "#ffffff",
  );
  largeFoodSnake.body = Array.from({ length: 79 }, () => ({ x: 0, y: 0 }));
  largeFoodSnake.grow(30);
  assert.equal(largeFoodSnake.body.length, 89);
});

test("player emotes broadcast once and reject invalid or rapid events", () => {
  const room = new GameRoom("emote-test", {
    botsEnabled: false,
    recordStats: false,
  });
  const messages = [];
  const player = {
    ws: {
      readyState: 1,
      send: (message) => messages.push(JSON.parse(message)),
    },
    snake: { alive: true },
  };
  room.players.set("player-1", player);

  assert.equal(room.sendPlayerEmote("player-1", "unknown", 2000), false);
  assert.equal(room.sendPlayerEmote("player-1", "emote-wave", 2000), true);
  assert.equal(room.sendPlayerEmote("player-1", "emote-heart", 2500), false);
  assert.deepEqual(messages, [
    {
      type: "PLAYER_EMOTE",
      playerId: "player-1",
      emoteId: "emote-wave",
      duration: 1800,
    },
  ]);
});

test("compressed snake snapshots preserve body length and reduce wire size", () => {
  const snake = new Snake("snapshot-test", "Snapshot", "#ffffff");
  snake.teamId = "red";
  snake.body = Array.from({ length: 200 }, (_, index) => ({
    x: index * 12 + 0.37,
    y: Math.sin(index / 5) * 120 + 0.63,
  }));

  const full = snake.getSnapshot();
  const compact = snake.getSnapshotCompressed();
  const fullWireSize = zlib.deflateRawSync(JSON.stringify(full), {
    level: 3,
  }).length;
  const compactWireSize = zlib.deflateRawSync(JSON.stringify(compact), {
    level: 3,
  }).length;

  assert.equal(compact.length, full.length);
  assert.equal(compact.bodyStep, 2);
  assert.equal(compact.body.length, 101);
  assert.deepEqual(compact.body.at(-1), [
    Math.round(full.body.at(-1).x),
    Math.round(full.body.at(-1).y),
  ]);
  assert.equal(compact.teamId, full.teamId);
  assert.ok(compactWireSize < fullWireSize);
});

test("game ticks broadcast compact snake bodies with team metadata", () => {
  const room = new GameRoom("compact-tick-test", {
    botsEnabled: false,
    recordStats: false,
  });
  const messages = [];
  const snake = new Snake("team-player", "Team Player", "#ffffff");
  snake.teamId = "blue";
  room.players.set(snake.id, {
    snake,
    ws: {
      readyState: 1,
      send: (message) => messages.push(JSON.parse(message)),
    },
  });

  room.broadcastSnapshot([snake]);

  assert.equal(messages[0].type, "GAME_TICK");
  assert.equal(messages[0].snakes[0].teamId, "blue");
  assert.ok(Array.isArray(messages[0].snakes[0].body[0]));
  assert.equal(messages[0].snakes[0].bodyStep, 2);
});
