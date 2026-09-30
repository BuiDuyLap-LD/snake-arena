const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const accountManager = require("../server/AccountManager");
const leaderboardManager = require("../server/LeaderboardManager");
const supabaseStorage = require("../server/SupabaseStorage");

function useTemporaryAccountStorage() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snake-account-test-"));
  const original = {
    dataDir: accountManager.dataDir,
    filePath: accountManager.filePath,
    users: new Map(accountManager.users),
    tokens: new Map(accountManager.tokens),
    recordPlayerScore: leaderboardManager.recordPlayerScore,
    nodeEnv: process.env.NODE_ENV,
  };

  accountManager.dataDir = tempDir;
  accountManager.filePath = path.join(tempDir, "users.json");
  accountManager.users.clear();
  accountManager.tokens.clear();
  leaderboardManager.recordPlayerScore = () => {};

  return () => {
    accountManager.dataDir = original.dataDir;
    accountManager.filePath = original.filePath;
    accountManager.users = original.users;
    accountManager.tokens = original.tokens;
    leaderboardManager.recordPlayerScore = original.recordPlayerScore;
    if (original.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.nodeEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
  };
}

test("account passwords use scrypt and sessions are never persisted", (t) => {
  const restore = useTemporaryAccountStorage();
  t.after(restore);

  assert.equal(
    accountManager.register("SecureTester", "short").success,
    false,
  );
  const registration = accountManager.register(
    "SecureTester",
    "this-is-a-strong-password-42",
  );

  assert.equal(registration.success, true);
  assert.match(accountManager.getRawUser("SecureTester").passwordHash, /^scrypt\$/);
  assert.notEqual(
    accountManager.hashPassword("this-is-a-strong-password-42"),
    accountManager.hashPassword("this-is-a-strong-password-42"),
  );
  assert.equal(
    accountManager.verifyPassword(
      "this-is-a-strong-password-42",
      accountManager.getRawUser("SecureTester").passwordHash,
    ),
    true,
  );
  assert.equal(
    accountManager.verifyPassword(
      "wrong-password-42",
      accountManager.getRawUser("SecureTester").passwordHash,
    ),
    false,
  );

  const login = accountManager.login(
    "SecureTester",
    "this-is-a-strong-password-42",
  );
  assert.equal(login.success, true);
  assert.equal(login.token.length, 64);
  assert.equal(Object.hasOwn(accountManager.getRawUser("SecureTester"), "token"), false);

  accountManager.saveToFile();
  const [storedUser] = JSON.parse(fs.readFileSync(accountManager.filePath, "utf8"));
  assert.equal(Object.hasOwn(storedUser, "token"), false);
});

test("production startup resets legacy credentials and invalidates stored sessions", async (t) => {
  if (supabaseStorage.enabled) {
    t.skip("Uses an isolated local store; do not alter a configured Supabase project.");
    return;
  }

  const restore = useTemporaryAccountStorage();
  t.after(restore);
  process.env.NODE_ENV = "production";
  fs.writeFileSync(
    accountManager.filePath,
    JSON.stringify([
      {
        username: "LegacyUser",
        passwordHash: "legacy-fixed-salt-hash",
        token: "legacy-session-token",
        friends: [],
        friendRequests: [],
      },
    ]),
  );

  await accountManager.initStorage();

  assert.equal(accountManager.users.size, 0);
  assert.equal(accountManager.tokens.size, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(accountManager.filePath, "utf8")), []);
});
