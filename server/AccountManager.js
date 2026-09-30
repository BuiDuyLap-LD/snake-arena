// server/AccountManager.js

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const leaderboardManager = require("./LeaderboardManager");
const supabaseStorage = require("./SupabaseStorage");

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

class AccountManager {
  constructor() {
    this.dataDir = path.join(__dirname, "data");
    this.filePath = path.join(this.dataDir, "users.json");
    this.users = new Map(); // usernameLower -> user object
    this.tokens = new Map(); // token -> usernameLower
  }

  async initStorage() {
    fs.mkdirSync(this.dataDir, { recursive: true });

    let list = [];
    if (fs.existsSync(this.filePath)) {
      const raw = fs.readFileSync(this.filePath, "utf8");
      list = JSON.parse(raw);
      if (!Array.isArray(list)) {
        throw new Error("[AccountManager] users.json must contain an array.");
      }
    }

    if (supabaseStorage.enabled) {
      const stored = await supabaseStorage.loadDocument("users");
      if (stored !== null) {
        if (!Array.isArray(stored)) {
          throw new Error(
            "[AccountManager] Supabase users document must be an array.",
          );
        }
        list = stored;
      } else {
        if (process.env.SUPABASE_IMPORT_LOCAL_JSON !== "true") {
          list = [];
        } else {
          for (const user of list) {
            if (user && typeof user === "object") delete user.token;
          }
          console.warn(
            "[AccountManager] Imported local accounts; existing sessions were invalidated.",
          );
        }
        await supabaseStorage.saveDocument("users", list);
        await supabaseStorage.flush();
      }
    }

    const legacyUsers = list.filter(
      (user) => !this.isScryptHash(user?.passwordHash),
    );
    if (legacyUsers.length > 0) {
      if (process.env.NODE_ENV === "production") {
        console.warn(
          `[AccountManager] Reset ${legacyUsers.length} accounts with legacy credentials.`,
        );
        list = [];
        if (supabaseStorage.enabled) {
          await supabaseStorage.saveDocument("users", list);
          await supabaseStorage.flush();
        } else {
          fs.writeFileSync(this.filePath, "[]", "utf8");
        }
      } else {
        console.warn(
          `[AccountManager] Ignoring ${legacyUsers.length} accounts with legacy credentials in development.`,
        );
        list = list.filter((user) => this.isScryptHash(user?.passwordHash));
      }
    }

    let removedStoredSessions = false;
    for (const user of list) {
      if (!user || typeof user.username !== "string") continue;
      if (!Array.isArray(user.friends)) user.friends = [];
      if (!Array.isArray(user.friendRequests)) user.friendRequests = [];
      if (user.token) {
        delete user.token;
        removedStoredSessions = true;
      }

      const key = user.username.toLowerCase();
      this.users.set(key, user);
    }
    if (removedStoredSessions) {
      this.saveToFile();
      if (supabaseStorage.enabled) await supabaseStorage.flush();
    }
  }

  hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.scryptSync(password, salt, 64, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: 64 * 1024 * 1024,
    });
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
  }

  isScryptHash(encoded) {
    return typeof encoded === "string" &&
      /^scrypt\$16384\$8\$1\$[a-f\d]{32}\$[a-f\d]{128}$/i.test(encoded);
  }

  verifyPassword(password, encoded) {
    if (typeof password !== "string" || !this.isScryptHash(encoded)) return false;
    const [, , , , saltHex, keyHex] = encoded.split("$");
    const expected = Buffer.from(keyHex, "hex");
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: 64 * 1024 * 1024,
    });
    return crypto.timingSafeEqual(actual, expected);
  }

  isPasswordValid(password) {
    return typeof password === "string" &&
      password.length >= PASSWORD_MIN_LENGTH &&
      password.length <= PASSWORD_MAX_LENGTH;
  }

  generateToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  getTier(highScore) {
    if (highScore >= 7000) return "Thách Đấu 👑";
    if (highScore >= 3500) return "Kim Cương 💎";
    if (highScore >= 1500) return "Vàng 🥇";
    if (highScore >= 500) return "Bạc 🥈";
    return "Đồng 🥉";
  }

  sanitize(user) {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      highScore: user.highScore || 0,
      totalKills: user.totalKills || 0,
      matchesPlayed: user.matchesPlayed || 0,
      tier: user.tier || "Đồng 🥉",
      skin: user.skin || "#00f0ff",
      createdAt: user.createdAt,
      friendCount: (user.friends || []).length,
      friendRequestCount: (user.friendRequests || []).length,
    };
  }

  register(username, password, skin = "#00f0ff") {
    if (!username || typeof username !== "string") {
      return { success: false, error: "Tên người chơi không hợp lệ" };
    }
    const cleanName = username.trim();
    if (cleanName.length < 3 || cleanName.length > 16) {
      return { success: false, error: "Tên tài khoản phải từ 3 đến 16 ký tự" };
    }
    if (!this.isPasswordValid(password)) {
      return {
        success: false,
        error: `Mật khẩu phải có từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự`,
      };
    }

    const key = cleanName.toLowerCase();
    if (this.users.has(key)) {
      return {
        success: false,
        error:
          "Biệt danh này đã có người đăng ký! Vui lòng chọn tên khác hoặc đăng nhập.",
      };
    }

    const token = this.generateToken();
    const newUser = {
      id: `u_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      username: cleanName,
      passwordHash: this.hashPassword(password),
      highScore: 0,
      totalKills: 0,
      matchesPlayed: 0,
      tier: "Đồng 🥉",
      skin: skin || "#00f0ff",
      friends: [],
      friendRequests: [],
      createdAt: Date.now(),
      lastLogin: Date.now(),
    };

    this.users.set(key, newUser);
    this.tokens.set(token, key);
    this.saveToFile();

    // Sync into leaderboard manager
    leaderboardManager.recordPlayerScore(cleanName, 0, 0);

    return {
      success: true,
      user: this.sanitize(newUser),
      token,
    };
  }

  login(username, password) {
    if (!username || typeof password !== "string") {
      return { success: false, error: "Vui lòng nhập đầy đủ tên và mật khẩu" };
    }
    if (!this.isPasswordValid(password)) {
      return {
        success: false,
        error: `Mật khẩu phải có từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự`,
      };
    }
    const key = username.trim().toLowerCase();
    const user = this.users.get(key);

    if (!user) {
      return {
        success: false,
        error: "Tài khoản không tồn tại! Hãy bấm Đăng Ký để tạo tài khoản mới.",
      };
    }

    if (!this.verifyPassword(password, user.passwordHash)) {
      return { success: false, error: "Sai mật khẩu! Vui lòng thử lại." };
    }

    // Refresh token
    const token = this.generateToken();
    user.lastLogin = Date.now();
    this.tokens.set(token, key);
    this.saveToFile();

    return {
      success: true,
      user: this.sanitize(user),
      token,
    };
  }

  getUserByToken(token) {
    if (!token) return null;
    const key = this.tokens.get(token);
    if (!key) return null;
    const user = this.users.get(key);
    return this.sanitize(user);
  }

  getRawUserByToken(token) {
    if (!token) return null;
    const key = this.tokens.get(token);
    if (!key) return null;
    return this.users.get(key) || null;
  }

  getRawUser(username) {
    if (!username) return null;
    return this.users.get(username.trim().toLowerCase()) || null;
  }

  getUserProfile(username) {
    const raw = this.getRawUser(username);
    return this.sanitize(raw);
  }

  recordGameStats(username, score, kills) {
    if (!username) return;
    const key = username.trim().toLowerCase();
    const user = this.users.get(key);
    if (user) {
      user.matchesPlayed = (user.matchesPlayed || 0) + 1;
      user.totalKills = (user.totalKills || 0) + (kills || 0);
      if (score > (user.highScore || 0)) {
        user.highScore = score;
      }
      user.tier = this.getTier(user.highScore);
      this.saveToFile();
    }
    // Also record to persistent leaderboard
    leaderboardManager.recordPlayerScore(username, score, kills);
  }

  updateSkin(username, skin) {
    if (!username || !skin) return;
    const key = username.trim().toLowerCase();
    const user = this.users.get(key);
    if (user) {
      user.skin = skin;
      this.saveToFile();
    }
  }

  // ================= FRIEND SYSTEM =================

  getFriendList(username, getStatusFn) {
    const user = this.getRawUser(username);
    if (!user) return [];

    const list = [];
    const friends = user.friends || [];
    for (const fName of friends) {
      const fUser = this.getRawUser(fName);
      if (fUser) {
        const sanitized = this.sanitize(fUser);
        sanitized.status =
          typeof getStatusFn === "function"
            ? getStatusFn(fUser.username)
            : "offline";
        list.push(sanitized);
      }
    }

    // Sort: online first, then in_game, then offline, then by highScore
    const statusOrder = { online: 0, lobby: 0, in_game: 1, offline: 2 };
    list.sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 2;
      const orderB = statusOrder[b.status] ?? 2;
      if (orderA !== orderB) return orderA - orderB;
      return (b.highScore || 0) - (a.highScore || 0);
    });

    return list;
  }

  getFriendRequests(username) {
    const user = this.getRawUser(username);
    if (!user || !Array.isArray(user.friendRequests)) return [];

    const requests = [];
    for (const req of user.friendRequests) {
      const sender = this.getRawUser(req.from);
      if (sender) {
        requests.push({
          from: sender.username,
          tier: sender.tier || "Đồng 🥉",
          skin: sender.skin || "#00f0ff",
          highScore: sender.highScore || 0,
          totalKills: sender.totalKills || 0,
          time: req.time || Date.now(),
        });
      }
    }
    return requests;
  }

  sendFriendRequest(fromUsername, toUsername) {
    if (!fromUsername || !toUsername) {
      return { success: false, error: "Thiếu thông tin người chơi" };
    }

    const fromClean = fromUsername.trim();
    const toClean = toUsername.trim();

    if (fromClean.toLowerCase() === toClean.toLowerCase()) {
      return {
        success: false,
        error: "Bạn không thể tự kết bạn với chính mình!",
      };
    }

    const fromUser = this.getRawUser(fromClean);
    const toUser = this.getRawUser(toClean);

    if (!fromUser) {
      return { success: false, error: "Tài khoản của bạn không hợp lệ" };
    }
    if (!toUser) {
      return {
        success: false,
        error: `Không tìm thấy dũng sĩ có tên "${toClean}"!`,
      };
    }

    if (!Array.isArray(fromUser.friends)) fromUser.friends = [];
    if (!Array.isArray(toUser.friends)) toUser.friends = [];
    if (!Array.isArray(toUser.friendRequests)) toUser.friendRequests = [];

    // Check if already friends
    const isAlreadyFriend = fromUser.friends.some(
      (f) => f.toLowerCase() === toClean.toLowerCase(),
    );
    if (isAlreadyFriend) {
      return {
        success: false,
        error: `Bạn và "${toUser.username}" đã là bạn bè từ trước!`,
      };
    }

    // Check if request already pending
    const alreadyRequested = toUser.friendRequests.some(
      (r) => r.from.toLowerCase() === fromClean.toLowerCase(),
    );
    if (alreadyRequested) {
      return {
        success: false,
        error: `Bạn đã gửi lời mời kết bạn tới "${toUser.username}" rồi, vui lòng chờ đối phương đồng ý!`,
      };
    }

    // Check if toUser already sent a request to fromUser (Auto-accept!)
    if (Array.isArray(fromUser.friendRequests)) {
      const reverseIdx = fromUser.friendRequests.findIndex(
        (r) => r.from.toLowerCase() === toClean.toLowerCase(),
      );
      if (reverseIdx !== -1) {
        // Auto-accept!
        fromUser.friendRequests.splice(reverseIdx, 1);
        fromUser.friends.push(toUser.username);
        toUser.friends.push(fromUser.username);
        this.saveToFile();
        return {
          success: true,
          autoAccepted: true,
          message: `Hai bạn đã cùng gửi lời mời và trở thành bạn bè của nhau!`,
          friend: this.sanitize(toUser),
        };
      }
    }

    toUser.friendRequests.push({
      from: fromUser.username,
      time: Date.now(),
    });

    this.saveToFile();
    return {
      success: true,
      message: `Đã gửi lời mời kết bạn đến "${toUser.username}" thành công!`,
      targetUser: this.sanitize(toUser),
    };
  }

  respondFriendRequest(username, fromUsername, accept = true) {
    const user = this.getRawUser(username);
    const sender = this.getRawUser(fromUsername);

    if (!user) {
      return { success: false, error: "Không tìm thấy tài khoản người dùng" };
    }

    if (!Array.isArray(user.friendRequests)) user.friendRequests = [];
    const reqIndex = user.friendRequests.findIndex(
      (r) => r.from.toLowerCase() === fromUsername.trim().toLowerCase(),
    );

    if (reqIndex === -1) {
      return { success: false, error: "Lời mời kết bạn không còn tồn tại" };
    }

    user.friendRequests.splice(reqIndex, 1);

    if (accept && sender) {
      if (!Array.isArray(user.friends)) user.friends = [];
      if (!Array.isArray(sender.friends)) sender.friends = [];

      if (
        !user.friends.some(
          (f) => f.toLowerCase() === sender.username.toLowerCase(),
        )
      ) {
        user.friends.push(sender.username);
      }
      if (
        !sender.friends.some(
          (f) => f.toLowerCase() === user.username.toLowerCase(),
        )
      ) {
        sender.friends.push(user.username);
      }
    }

    this.saveToFile();

    return {
      success: true,
      action: accept ? "accepted" : "declined",
      friend: sender ? this.sanitize(sender) : null,
    };
  }

  removeFriend(username, friendUsername) {
    const user = this.getRawUser(username);
    const friend = this.getRawUser(friendUsername);

    if (!user) return { success: false, error: "Tài khoản không hợp lệ" };

    const fKey = friendUsername.trim().toLowerCase();
    if (Array.isArray(user.friends)) {
      user.friends = user.friends.filter((f) => f.toLowerCase() !== fKey);
    }
    if (friend && Array.isArray(friend.friends)) {
      const uKey = username.trim().toLowerCase();
      friend.friends = friend.friends.filter((f) => f.toLowerCase() !== uKey);
    }

    this.saveToFile();
    return { success: true };
  }

  searchUsers(query = "", currentUsername, getStatusFn) {
    const q = typeof query === "string" ? query.trim().toLowerCase() : "";

    const currentUser = this.getRawUser(currentUsername);
    const userFriends =
      currentUser && Array.isArray(currentUser.friends)
        ? new Set(currentUser.friends.map((f) => f.toLowerCase()))
        : new Set();
    const incomingReqs =
      currentUser && Array.isArray(currentUser.friendRequests)
        ? new Set(currentUser.friendRequests.map((r) => r.from.toLowerCase()))
        : new Set();

    const matches = [];
    for (const [key, u] of this.users.entries()) {
      if (currentUsername && key === currentUsername.toLowerCase()) continue;
      if (!q || u.username.toLowerCase().includes(q)) {
        const sanitized = this.sanitize(u);
        sanitized.status =
          typeof getStatusFn === "function"
            ? getStatusFn(u.username)
            : "offline";

        if (userFriends.has(key)) {
          sanitized.relationship = "friend";
        } else if (incomingReqs.has(key)) {
          sanitized.relationship = "pending_received";
        } else if (
          Array.isArray(u.friendRequests) &&
          currentUsername &&
          u.friendRequests.some(
            (r) => r.from.toLowerCase() === currentUsername.toLowerCase(),
          )
        ) {
          sanitized.relationship = "pending_sent";
        } else {
          sanitized.relationship = "none";
        }

        matches.push(sanitized);
        if (matches.length >= 10) break;
      }
    }
    return matches;
  }

  saveToFile() {
    const list = Array.from(this.users.values(), (user) => {
      const { token, ...safeUser } = user;
      return safeUser;
    });
    if (supabaseStorage.enabled) {
      supabaseStorage.saveDocument("users", list);
      return;
    }

    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), "utf8");
    } catch (err) {
      console.error("[AccountManager] File save error:", err);
    }
  }
}

module.exports = new AccountManager();
