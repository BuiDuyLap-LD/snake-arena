const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const rendererSource = fs.readFileSync(
  require.resolve("../public/js/renderer.js"),
  "utf8",
);
const rendererContext = {
  window: {
    innerWidth: 800,
    innerHeight: 600,
    addEventListener: () => {},
  },
};
vm.createContext(rendererContext);
vm.runInContext(
  `${rendererSource}\nglobalThis.GameRenderer = GameRenderer;`,
  rendererContext,
);

test("snake body interpolation follows every compressed server snapshot", () => {
  const renderer = new rendererContext.GameRenderer(
    { getContext: () => null },
    null,
  );
  const snapshot = {
    id: "remote-snake",
    alive: true,
    head: { x: 100, y: 0 },
    angle: 0,
    bodyStep: 2,
    length: 3,
    body: [
      [76, 0],
      [52, 0],
    ],
  };

  renderer.syncServerSnakes([snapshot]);
  const snake = renderer.interpolatedSnakes.get(snapshot.id);
  assert.equal(snake.body.length, 3);
  assert.equal(snake.body[1].x, 64);

  snapshot.head = { x: 110, y: 0 };
  snapshot.body = [
    [86, 0],
    [62, 0],
  ];
  renderer.syncServerSnakes([snapshot]);

  assert.equal(snake.targetBody[1].x, 74);
  const previousDistance = Math.abs(snake.body[1].x - snake.targetBody[1].x);
  renderer.updateInterpolation(0, null, null);

  assert.ok(
    Math.abs(snake.body[1].x - snake.targetBody[1].x) < previousDistance,
  );
});
