// server/server.js

const http = require("http");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const compression = require("compression");
const { WebSocketServer } = require("ws");
const path = require("path");
const os = require("os");
const GameRoom = require("./GameRoom");
const SoloRoomManager = require("./SoloRoomManager");
const leaderboardManager = require("./LeaderboardManager");
const accountManager = require("./AccountManager");
const socialManager = require("./SocialManager");
const supabaseStorage = require("./SupabaseStorage");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_ACTIVE_SOLO_ROOMS = 2;
let gameRoom;
let casualRoom;
const soloRoomManager = new SoloRoomManager();
const soloGameRooms = new Map();

app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));
app.use(compression({ threshold: 1024, level: 3 }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: "Quá nhiều lần thử. Vui lòng chờ 15 phút rồi thử lại.",
  },
});

// Serve public directory
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// Helper: extract authenticated user
function getAuthUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "") || req.query.token;
  if (!token) return null;
  return accountManager.getRawUserByToken(token);
}

async function respondAfterPersistence(res, payload) {
  try {
    await supabaseStorage.flush();
    return res.json(payload);
  } catch (error) {
    console.error("[Server] Could not persist account data:", error.message);
    return res.status(503).json({
      success: false,
      error: "Không thể lưu dữ liệu lúc này. Vui lòng thử lại.",
    });
  }
}

async function persistSocketAction(ws) {
  try {
    await supabaseStorage.flush();
    return true;
  } catch (error) {
    console.error("[Server] Could not persist socket action:", error.message);
    if (ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "PERSISTENCE_ERROR",
          error: "Không thể lưu dữ liệu lúc này. Vui lòng thử lại.",
        }),
      );
    }
    return false;
  }
}

// Health / info endpoint
app.get("/api/status", (req, res) => {
  res.json({
    status: "ok",
    players: gameRoom.players.size,
    bots: gameRoom.bots.size,
    timeRemaining: Math.ceil(gameRoom.timeRemaining),
    onlineTotal: socialManager.getOnlinePlayerCount(),
    storage: supabaseStorage.enabled ? "supabase" : "local-json",
  });
});

// Human Global Leaderboard endpoint
app.get("/api/leaderboard", (req, res) => {
  res.json({
    success: true,
    leaderboard: leaderboardManager.getTopPlayers(20),
  });
});

// Auth: Register
app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { username, password, skin } = req.body || {};
  const result = accountManager.register(username, password, skin);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return respondAfterPersistence(res, result);
});

// Auth: Login
app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const result = accountManager.login(username, password);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return respondAfterPersistence(res, result);
});

// Auth: Verify token / Get current profile
app.get("/api/auth/me", (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res
      .status(401)
      .json({ success: false, error: "Chưa đăng nhập hoặc phiên hết hạn" });
  }
  res.json({ success: true, user: accountManager.sanitize(user) });
});

// User Profile by username
app.get("/api/user/profile/:username", (req, res) => {
  const profile = accountManager.getUserProfile(req.params.username);
  if (!profile) {
    return res
      .status(404)
      .json({ success: false, error: "Không tìm thấy người chơi" });
  }
  profile.status = socialManager.getUserStatus(profile.username);
  res.json({ success: true, profile });
});

// ================= FRIEND APIS =================

// Get friend list
app.get("/api/friends/list", (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Chưa đăng nhập" });
  }
  const friends = accountManager.getFriendList(user.username, (u) =>
    socialManager.getUserStatus(u),
  );
  res.json({ success: true, friends });
});

// Get incoming friend requests
app.get("/api/friends/requests", (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Chưa đăng nhập" });
  }
  const requests = accountManager.getFriendRequests(user.username);
  res.json({ success: true, requests });
});

// Search users to add friend
app.get("/api/friends/search", (req, res) => {
  const user = getAuthUser(req);
  const query = req.query.q || "";
  const currentUsername = user ? user.username : null;
  const results = accountManager.searchUsers(query, currentUsername, (u) =>
    socialManager.getUserStatus(u),
  );
  res.json({ success: true, results });
});

// Send friend request via HTTP
app.post("/api/friends/send", async (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Chưa đăng nhập" });
  }
  const { targetUsername } = req.body || {};
  const result = accountManager.sendFriendRequest(
    user.username,
    targetUsername,
  );
  if (result.success) {
    socialManager.sendToUser(targetUsername, {
      type: "FRIEND_REQUEST_RECEIVED",
      from: user.username,
      tier: user.tier || "Đồng 🥉",
      skin: user.skin || "#00f0ff",
      highScore: user.highScore || 0,
      totalKills: user.totalKills || 0,
      time: Date.now(),
    });
  }
  return respondAfterPersistence(res, result);
});

// Respond to friend request (accept / decline)
app.post("/api/friends/respond", async (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Chưa đăng nhập" });
  }
  const { fromUsername, accept } = req.body || {};
  const result = accountManager.respondFriendRequest(
    user.username,
    fromUsername,
    accept,
  );
  if (result.success && accept) {
    const myProfile = accountManager.sanitize(user);
    myProfile.status = socialManager.getUserStatus(user.username);
    socialManager.sendToUser(fromUsername, {
      type: "FRIEND_REQUEST_ACCEPTED",
      message: `${user.username} đã chấp nhận lời mời kết bạn!`,
      friend: myProfile,
    });
  }
  return respondAfterPersistence(res, result);
});

// Remove friend
app.post("/api/friends/remove", async (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Chưa đăng nhập" });
  }
  const { friendUsername } = req.body || {};
  const result = accountManager.removeFriend(user.username, friendUsername);
  if (result.success) {
    socialManager.sendToUser(friendUsername, {
      type: "FRIEND_REMOVED",
      friendName: user.username,
    });
  }
  return respondAfterPersistence(res, result);
});

// Get Lobby Chat History
app.get("/api/chat/lobby", (req, res) => {
  res.json({
    success: true,
    messages: socialManager.getLobbyChatHistory(),
  });
});

// Get Private Chat History
app.get("/api/chat/private", (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Chưa đăng nhập" });
  }
  const withUser = req.query.with || "";
  const messages = socialManager.getPrivateChatHistory(user.username, withUser);
  res.json({ success: true, messages });
});

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  maxPayload: 16 * 1024,
  perMessageDeflate: {
    threshold: 1024,
    concurrencyLimit: 10,
    serverNoContextTakeover: true,
    clientNoContextTakeover: true,
    zlibDeflateOptions: { level: 3 },
  },
});

// Single main arena room
gameRoom = null;
casualRoom = null;

let nextClientId = 1000;

wss.on("connection", (ws) => {
  const socketId = `s_${nextClientId++}`;
  const playerId = `p_${socketId}`;
  let hasJoinedGame = false;
  let joinedRoom = null;

  const createSoloMember = (user, teamId) => ({
    socketId,
    playerId,
    username: user.username,
    playerName: user.username,
    playerColor: user.skin || "#00f0ff",
    teamId,
    ws,
    startGame: (room, assignedTeam) => {
      joinedRoom = room;
      hasJoinedGame = true;
      socialManager.setSocketStatus(socketId, "in_game", room.roomCode);
      room.addPlayer(
        ws,
        playerId,
        user.username,
        user.skin || "#00f0ff",
        user.username,
        assignedTeam,
      );
    },
  });

  // Register into social presence
  socialManager.registerSocket(socketId, ws);

  // Send initial data to client
  ws.send(
    JSON.stringify({
      type: "SOCKET_READY",
      socketId,
      leaderboard: leaderboardManager.getTopPlayers(20),
      lobbyChat: socialManager.getLobbyChatHistory(),
    }),
  );

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      // 1. Lobby Auth (bind token / guest info as soon as page loads)
      if (data.type === "LOBBY_AUTH") {
        const user = socialManager.authenticateSocket(
          socketId,
          data.token,
          data.guestName,
        );
        if (user) {
          const friends = accountManager.getFriendList(user.username, (u) =>
            socialManager.getUserStatus(u),
          );
          const requests = accountManager.getFriendRequests(user.username);
          ws.send(
            JSON.stringify({
              type: "AUTH_SUCCESS",
              user: accountManager.sanitize(user),
              friends,
              requests,
            }),
          );
        }
      }

      // 2. Joining Game
      else if (
        data.type === "SOLO_ROOM_CREATE" ||
        data.type === "SOLO_ROOM_JOIN"
      ) {
        if (hasJoinedGame) return;
        const user = data.token
          ? accountManager.getUserByToken(data.token)
          : null;
        if (!user) {
          ws.send(
            JSON.stringify({
              type: "SOLO_ROOM_ERROR",
              error: "Bạn cần đăng nhập để tạo hoặc vào phòng Solo 5v5.",
            }),
          );
          return;
        }

        const member = createSoloMember(user, data.teamId);
        const settings = {
          mapId: data.mapId || "neon-grid",
          roundDuration: data.roundDuration || 600,
          botsEnabled: false,
        };
        const result =
          data.type === "SOLO_ROOM_CREATE"
            ? soloRoomManager.create(member, settings)
            : soloRoomManager.join(data.roomCode, member);

        if (!result.success) {
          ws.send(
            JSON.stringify({ type: "SOLO_ROOM_ERROR", error: result.error }),
          );
          return;
        }

        socialManager.setSocketStatus(socketId, "lobby", result.roomCode);
        ws.send(
          JSON.stringify({
            type: "SOLO_ROOM_READY",
            roomCode: result.roomCode,
            state: result.state,
          }),
        );
      } else if (data.type === "SOLO_ROOM_CHANGE_TEAM") {
        const result = soloRoomManager.changeTeam(socketId, data.teamId);
        if (!result.success) {
          ws.send(
            JSON.stringify({ type: "SOLO_ROOM_ERROR", error: result.error }),
          );
        }
      } else if (data.type === "SOLO_ROOM_UPDATE_SETTINGS") {
        const result = soloRoomManager.updateRoomSettings(data.roomCode, {
          mapId: data.mapId,
          roundDuration: data.roundDuration,
          botsEnabled: data.botsEnabled,
        });
        if (!result.success) {
          ws.send(
            JSON.stringify({ type: "SOLO_ROOM_ERROR", error: result.error }),
          );
        }
      } else if (data.type === "SOLO_ROOM_LEAVE") {
        soloRoomManager.leave(socketId);
        socialManager.setSocketStatus(socketId, "lobby");
        ws.send(JSON.stringify({ type: "SOLO_ROOM_LEFT" }));
      } else if (data.type === "SOLO_ROOM_START") {
        if (soloGameRooms.size >= MAX_ACTIVE_SOLO_ROOMS) {
          ws.send(
            JSON.stringify({
              type: "SOLO_ROOM_ERROR",
              error:
                "Máy chủ đang chạy tối đa 2 trận Solo. Vui lòng thử lại sau.",
            }),
          );
          return;
        }
        const result = soloRoomManager.start(data.roomCode, socketId);
        if (!result.success) {
          ws.send(
            JSON.stringify({ type: "SOLO_ROOM_ERROR", error: result.error }),
          );
          return;
        }

        const soloGameRoom = new GameRoom(result.roomCode, {
          mode: "solo5v5",
          roomCode: result.roomCode,
          botsEnabled: false,
          mapId: result.settings?.mapId || "neon-grid",
          roundDuration: result.settings?.roundDuration || 600,
        });
        soloGameRoom.start();
        soloGameRooms.set(result.roomCode, soloGameRoom);
        for (const member of result.members) {
          member.startGame(soloGameRoom, member.teamId);
        }
      } else if (data.type === "JOIN_GAME") {
        if (hasJoinedGame) return;
        const playerName = (data.name || "Snake").substring(0, 16).trim();
        const playerColor = data.color || "#00ffcc";

        const user = data.token
          ? accountManager.getUserByToken(data.token)
          : null;
        if (!user) {
          ws.send(
            JSON.stringify({
              type: "JOIN_REJECTED",
              error: "Bạn cần đăng nhập để tham gia trận đấu.",
            }),
          );
          return;
        }
        if (data.mode === "solo5v5") {
          ws.send(
            JSON.stringify({
              type: "JOIN_REJECTED",
              error: "Hãy tạo hoặc vào phòng Solo 5v5 từ sảnh trước.",
            }),
          );
          return;
        }
        const accountUsername = user.username;
        socialManager.authenticateSocket(socketId, data.token, user.username);
        const mapId = data.mapId || "neon-grid";
        joinedRoom = data.mode === "casual" ? casualRoom : gameRoom;
        joinedRoom.setMap(mapId);
        joinedRoom.start();

        socialManager.setSocketStatus(
          socketId,
          "in_game",
          data.room || "ARENA-5V5",
        );
        joinedRoom.addPlayer(
          ws,
          playerId,
          playerName,
          playerColor,
          accountUsername,
        );
        hasJoinedGame = true;
      }

      // 3. Leaving Game (return to lobby)
      else if (data.type === "LEAVE_GAME" && hasJoinedGame) {
        const leavingRoom = joinedRoom;
        joinedRoom.removePlayer(playerId);
        if (joinedRoom === casualRoom && casualRoom.players.size === 0) {
          casualRoom.stop();
        }
        if (leavingRoom.mode === "solo5v5" && leavingRoom.players.size === 0) {
          leavingRoom.stop();
          soloGameRooms.delete(leavingRoom.roomCode);
        }
        joinedRoom = null;
        hasJoinedGame = false;
        socialManager.setSocketStatus(socketId, "lobby");
      }

      // 4. In-game inputs
      else if (data.type === "PLAYER_INPUT" && hasJoinedGame) {
        joinedRoom.handlePlayerInput(playerId, data);
      } else if (data.type === "USE_EMOTE" && hasJoinedGame) {
        joinedRoom.sendPlayerEmote(playerId, data.emoteId);
      } else if (data.type === "USE_POWERUP" && hasJoinedGame) {
        joinedRoom.handlePlayerInput(playerId, data);
      } else if (data.type === "RESPAWN" && hasJoinedGame) {
        joinedRoom.respawnPlayer(playerId);
      }

      // 5. Social & Friend Actions
      else if (data.type === "FRIEND_REQUEST_SEND") {
        const res = socialManager.sendFriendRequest(socketId, data.toUsername);
        if (res.success && !(await persistSocketAction(ws))) return;
        ws.send(
          JSON.stringify({
            type: "FRIEND_REQUEST_RESULT",
            ...res,
          }),
        );
      } else if (data.type === "FRIEND_REQUEST_RESPOND") {
        const res = socialManager.respondFriendRequest(
          socketId,
          data.fromUsername,
          data.accept !== false,
        );
        if (res.success && !(await persistSocketAction(ws))) return;
        ws.send(
          JSON.stringify({
            type: "FRIEND_RESPOND_RESULT",
            ...res,
          }),
        );
      } else if (data.type === "FRIEND_REMOVE") {
        const res = socialManager.removeFriend(socketId, data.friendUsername);
        if (res.success && !(await persistSocketAction(ws))) return;
        ws.send(
          JSON.stringify({
            type: "FRIEND_REMOVE_RESULT",
            ...res,
            friendUsername: data.friendUsername,
          }),
        );
      } else if (data.type === "SEND_CHAT_MESSAGE") {
        const res = socialManager.sendChatMessage(socketId, data);
        if (!res.success) {
          ws.send(
            JSON.stringify({
              type: "CHAT_ERROR",
              error: res.error,
            }),
          );
        }
      } else if (data.type === "INVITE_FRIEND") {
        const res = socialManager.inviteFriendToGame(
          socketId,
          data.toUsername,
          data.roomCode,
          data.mode,
        );
        ws.send(
          JSON.stringify({
            type: "INVITE_RESULT",
            ...res,
          }),
        );
      } else if (data.type === "POKE_FRIEND") {
        const res = socialManager.pokeFriend(socketId, data.toUsername);
        ws.send(
          JSON.stringify({
            type: "POKE_RESULT",
            ...res,
          }),
        );
      } else if (data.type === "COMMEND_PLAYER") {
        const res = socialManager.commendPlayer(socketId, data.targetName);
        ws.send(
          JSON.stringify({
            type: "COMMEND_RESULT",
            ...res,
          }),
        );
      }

      // 6. Data requests
      else if (data.type === "GET_FRIENDS") {
        const entry = socialManager.sockets.get(socketId);
        if (entry && !entry.isGuest && entry.username) {
          const friends = accountManager.getFriendList(entry.username, (u) =>
            socialManager.getUserStatus(u),
          );
          const requests = accountManager.getFriendRequests(entry.username);
          ws.send(
            JSON.stringify({
              type: "FRIEND_LIST_UPDATE",
              friends,
              requests,
            }),
          );
        }
      } else if (data.type === "GET_GLOBAL_LEADERBOARD") {
        ws.send(
          JSON.stringify({
            type: "GLOBAL_LEADERBOARD",
            leaderboard: leaderboardManager.getTopPlayers(20),
          }),
        );
      } else if (data.type === "PING") {
        ws.send(JSON.stringify({ type: "PONG", time: data.time }));
      }
    } catch (err) {
      console.error("[Server] Failed to parse message:", err);
    }
  });

  ws.on("close", () => {
    if (hasJoinedGame) {
      const closingRoom = joinedRoom;
      joinedRoom.removePlayer(playerId);
      if (joinedRoom === casualRoom && casualRoom.players.size === 0) {
        casualRoom.stop();
      }
      if (closingRoom.mode === "solo5v5" && closingRoom.players.size === 0) {
        closingRoom.stop();
        soloGameRooms.delete(closingRoom.roomCode);
      }
      hasJoinedGame = false;
      joinedRoom = null;
    } else {
      soloRoomManager.leave(socketId);
    }
    socialManager.unregisterSocket(socketId);
  });

  ws.on("error", (err) => {
    console.error(`[Server] Socket error for ${socketId}:`, err);
  });
});

function getLocalIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        const isVirtual = /vmnet|virtual|vbox|vethernet/i.test(name);
        const isWifiOrEth = /wi-fi|wifi|ethernet|wlan/i.test(name);
        candidates.push({ name, address: net.address, isVirtual, isWifiOrEth });
      }
    }
  }
  const best =
    candidates.find((c) => c.isWifiOrEth && !c.isVirtual) ||
    candidates.find((c) => !c.isVirtual) ||
    candidates[0];
  return best ? best.address : "localhost";
}

async function startServer() {
  await Promise.all([
    accountManager.initStorage(),
    leaderboardManager.initStorage(),
  ]);

  if (supabaseStorage.enabled) {
    console.log("[Storage] Persistent data is backed by Supabase.");
  } else {
    console.log(
      "[Storage] Supabase is not configured; using local JSON files.",
    );
  }

  gameRoom = new GameRoom("arena-main");
  gameRoom.start();
  casualRoom = new GameRoom("arena-casual", { recordStats: false });

  server.listen(PORT, "0.0.0.0", () => {
    const localIp = getLocalIp();
    console.log(`=======================================================`);
    console.log(`🐍 Multiplayer Snake Arena Server is RUNNING!`);
    console.log(`👉 Local:   http://localhost:${PORT}`);
    console.log(`👉 LAN:     http://${localIp}:${PORT}`);
    console.log(`=======================================================`);
  });
}

async function shutdown() {
  if (gameRoom) gameRoom.stop();
  if (casualRoom) casualRoom.stop();
  for (const room of soloGameRooms.values()) {
    room.stop();
  }
  for (const client of wss.clients) {
    client.terminate();
  }

  if (!server.listening) return;
  server.close(async () => {
    try {
      await supabaseStorage.flush();
    } catch (error) {
      console.error(
        "[Server] Could not flush Supabase writes on shutdown:",
        error.message,
      );
      process.exitCode = 1;
    }
  });
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

startServer().catch((error) => {
  console.error("[Server] Startup failed:", error);
  process.exitCode = 1;
});
