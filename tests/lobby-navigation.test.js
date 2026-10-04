const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const mainSource = fs.readFileSync(
  require.resolve("../public/js/main.js"),
  "utf8",
);
const context = {
  window: { addEventListener: () => {} },
};
vm.createContext(context);
vm.runInContext(
  `${mainSource}\nglobalThis.GameClient = GameClient;`,
  context,
);

function createTab(view) {
  return {
    dataset: { lobbyViewTarget: view },
    active: false,
    ariaPressed: "false",
    classList: {
      toggle(name, active) {
        if (name === "active") this.owner.active = active;
      },
      owner: null,
    },
    setAttribute(name, value) {
      if (name === "aria-pressed") this.ariaPressed = value;
    },
  };
}

test("lobby navigation selects the matching view and heading", () => {
  const views = ["play", "progress", "ranking", "guide", "chat"];
  const tabs = views.map(createTab);
  for (const tab of tabs) tab.classList.owner = tab;

  const client = Object.create(context.GameClient.prototype);
  client.screenLobby = {
    dataset: {},
    querySelectorAll: () => tabs,
  };
  client.lobbyViewTitle = { textContent: "" };
  client.lobbyViewCaption = { textContent: "" };

  const expectedTitles = {
    play: "Chọn chế độ và vào trận",
    progress: "Hành trình chiến binh",
    ranking: "Bảng xếp hạng cao thủ",
    guide: "Làm chủ đấu trường",
    chat: "Chọn chế độ và vào trận",
  };

  for (const view of views) {
    client.setLobbyView(view);
    assert.equal(client.lobbyView, view);
    assert.equal(client.lobbyViewTitle.textContent, expectedTitles[view]);
    assert.equal(
      client.screenLobby.dataset.lobbyView,
      view === "chat" ? "play" : view,
    );
    assert.deepEqual(
      tabs.filter((tab) => tab.active).map((tab) => tab.dataset.lobbyViewTarget),
      [view],
    );
    assert.deepEqual(
      tabs
        .filter((tab) => tab.ariaPressed === "true")
        .map((tab) => tab.dataset.lobbyViewTarget),
      [view],
    );
  }

  client.setLobbyView("unsupported");
  assert.equal(client.lobbyView, "play");
  assert.equal(client.screenLobby.dataset.lobbyView, "play");
});
