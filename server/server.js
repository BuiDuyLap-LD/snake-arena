// server/server.js

const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const os = require('os');
const GameRoom = require('./GameRoom');
const leaderboardManager = require('./LeaderboardManager');
const accountManager = require('./AccountManager');
const socialManager = require('./SocialManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve public directory
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Helper: extract authenticated user
function getAuthUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token;
  if (!token) return null;
  return accountManager.getRawUserByToken(token);
}

// Health / info endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    players: gameRoom.players.size,
    bots: gameRoom.bots.size,
    timeRemaining: Math.ceil(gameRoom.timeRemaining),
    onlineTotal: socialManager.getOnlinePlayerCount(),
  });
});

// Human Global Leaderboard endpoint
app.get('/api/leaderboard', (req, res) => {
  res.json({
    success: true,
    leaderboard: leaderboardManager.getTopPlayers(20),
  });
});

// Auth: Register
app.post('/api/auth/register', (req, res) => {
  const { username, password, skin } = req.body || {};
  const result = accountManager.register(username, password, skin);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Auth: Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const result = accountManager.login(username, password);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Auth: Verify token / Get current profile
app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập hoặc phiên hết hạn' });
  }
  res.json({ success: true, user: accountManager.sanitize(user) });
});

// User Profile by username
app.get('/api/user/profile/:username', (req, res) => {
  const profile = accountManager.getUserProfile(req.params.username);
  if (!profile) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy người chơi' });
  }
  profile.status = socialManager.getUserStatus(profile.username);
  res.json({ success: true, profile });
});

// ================= FRIEND APIS =================

// Get friend list
app.get('/api/friends/list', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }
  const friends = accountManager.getFriendList(user.username, u => socialManager.getUserStatus(u));
  res.json({ success: true, friends });
});

// Get incoming friend requests
app.get('/api/friends/requests', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }
  const requests = accountManager.getFriendRequests(user.username);
  res.json({ success: true, requests });
});

// Search users to add friend
app.get('/api/friends/search', (req, res) => {
  const user = getAuthUser(req);
  const query = req.query.q || '';
  const currentUsername = user ? user.username : null;
  const results = accountManager.searchUsers(query, currentUsername, u => socialManager.getUserStatus(u));
  res.json({ success: true, results });
});

// Send friend request via HTTP
app.post('/api/friends/send', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }
  const { targetUsername } = req.body || {};
  const result = accountManager.sendFriendRequest(user.username, targetUsername);
  if (result.success) {
    socialManager.sendToUser(targetUsername, {
      type: 'FRIEND_REQUEST_RECEIVED',
      from: user.username,
      tier: user.tier || 'Đồng 🥉',
      skin: user.skin || '#00f0ff',
      highScore: user.highScore || 0,
      totalKills: user.totalKills || 0,
      time: Date.now(),
    });
  }
  res.json(result);
});

// Respond to friend request (accept / decline)
app.post('/api/friends/respond', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }
  const { fromUsername, accept } = req.body || {};
  const result = accountManager.respondFriendRequest(user.username, fromUsername, accept);
  if (result.success && accept) {
    const myProfile = accountManager.sanitize(user);
    myProfile.status = socialManager.getUserStatus(user.username);
    socialManager.sendToUser(fromUsername, {
      type: 'FRIEND_REQUEST_ACCEPTED',
      message: `${user.username} đã chấp nhận lời mời kết bạn!`,
      friend: myProfile,
    });
  }
  res.json(result);
});

// Remove friend
app.post('/api/friends/remove', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }
  const { friendUsername } = req.body || {};
  const result = accountManager.removeFriend(user.username, friendUsername);
  if (result.success) {
    socialManager.sendToUser(friendUsername, {
      type: 'FRIEND_REMOVED',
      friendName: user.username,
    });
  }
  res.json(result);
});

// Get Lobby Chat History
app.get('/api/chat/lobby', (req, res) => {
  res.json({
    success: true,
    messages: socialManager.getLobbyChatHistory(),
  });
});

// Get Private Chat History
app.get('/api/chat/private', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }
  const withUser = req.query.with || '';
  const messages = socialManager.getPrivateChatHistory(user.username, withUser);
  res.json({ success: true, messages });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Single main arena room
const gameRoom = new GameRoom('arena-main');
gameRoom.start();

let nextClientId = 1000;

wss.on('connection', (ws) => {
  const socketId = `s_${nextClientId++}`;
  const playerId = `p_${socketId}`;
  let hasJoinedGame = false;

  // Register into social presence
  socialManager.registerSocket(socketId, ws);

  // Send initial data to client
  ws.send(JSON.stringify({
    type: 'SOCKET_READY',
    socketId,
    leaderboard: leaderboardManager.getTopPlayers(20),
    lobbyChat: socialManager.getLobbyChatHistory(),
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // 1. Lobby Auth (bind token / guest info as soon as page loads)
      if (data.type === 'LOBBY_AUTH') {
        const user = socialManager.authenticateSocket(socketId, data.token, data.guestName);
        if (user) {
          const friends = accountManager.getFriendList(user.username, u => socialManager.getUserStatus(u));
          const requests = accountManager.getFriendRequests(user.username);
          ws.send(JSON.stringify({
            type: 'AUTH_SUCCESS',
            user: accountManager.sanitize(user),
            friends,
            requests,
          }));
        }
      }

      // 2. Joining Game
      else if (data.type === 'JOIN_GAME') {
        const playerName = (data.name || 'Snake').substring(0, 16).trim();
        const playerColor = data.color || '#00ffcc';

        // Xác thực token để gắn đúng tài khoản
        let accountUsername = null;
        if (data.token) {
          const user = accountManager.getUserByToken(data.token);
          if (user) {
            accountUsername = user.username;
            socialManager.authenticateSocket(socketId, data.token, user.username);
          }
        }

        socialManager.setSocketStatus(socketId, 'in_game', data.room || 'ARENA-5V5');
        gameRoom.addPlayer(ws, playerId, playerName, playerColor, accountUsername);
        hasJoinedGame = true;
      }

      // 3. Leaving Game (return to lobby)
      else if (data.type === 'LEAVE_GAME' && hasJoinedGame) {
        gameRoom.removePlayer(playerId);
        hasJoinedGame = false;
        socialManager.setSocketStatus(socketId, 'lobby');
      }

      // 4. In-game inputs
      else if (data.type === 'PLAYER_INPUT' && hasJoinedGame) {
        gameRoom.handlePlayerInput(playerId, data);
      } else if (data.type === 'USE_POWERUP' && hasJoinedGame) {
        gameRoom.handlePlayerInput(playerId, data);
      } else if (data.type === 'RESPAWN' && hasJoinedGame) {
        gameRoom.respawnPlayer(playerId);
      }

      // 5. Social & Friend Actions
      else if (data.type === 'FRIEND_REQUEST_SEND') {
        const res = socialManager.sendFriendRequest(socketId, data.toUsername);
        ws.send(JSON.stringify({
          type: 'FRIEND_REQUEST_RESULT',
          ...res,
        }));
      } else if (data.type === 'FRIEND_REQUEST_RESPOND') {
        const res = socialManager.respondFriendRequest(socketId, data.fromUsername, data.accept !== false);
        ws.send(JSON.stringify({
          type: 'FRIEND_RESPOND_RESULT',
          ...res,
        }));
      } else if (data.type === 'FRIEND_REMOVE') {
        const res = socialManager.removeFriend(socketId, data.friendUsername);
        ws.send(JSON.stringify({
          type: 'FRIEND_REMOVE_RESULT',
          ...res,
          friendUsername: data.friendUsername,
        }));
      } else if (data.type === 'SEND_CHAT_MESSAGE') {
        const res = socialManager.sendChatMessage(socketId, data);
        if (!res.success) {
          ws.send(JSON.stringify({
            type: 'CHAT_ERROR',
            error: res.error,
          }));
        }
      } else if (data.type === 'INVITE_FRIEND') {
        const res = socialManager.inviteFriendToGame(socketId, data.toUsername, data.roomCode);
        ws.send(JSON.stringify({
          type: 'INVITE_RESULT',
          ...res,
        }));
      } else if (data.type === 'POKE_FRIEND') {
        const res = socialManager.pokeFriend(socketId, data.toUsername);
        ws.send(JSON.stringify({
          type: 'POKE_RESULT',
          ...res,
        }));
      } else if (data.type === 'COMMEND_PLAYER') {
        const res = socialManager.commendPlayer(socketId, data.targetName);
        ws.send(JSON.stringify({
          type: 'COMMEND_RESULT',
          ...res,
        }));
      }

      // 6. Data requests
      else if (data.type === 'GET_FRIENDS') {
        const entry = socialManager.sockets.get(socketId);
        if (entry && !entry.isGuest && entry.username) {
          const friends = accountManager.getFriendList(entry.username, u => socialManager.getUserStatus(u));
          const requests = accountManager.getFriendRequests(entry.username);
          ws.send(JSON.stringify({
            type: 'FRIEND_LIST_UPDATE',
            friends,
            requests,
          }));
        }
      } else if (data.type === 'GET_GLOBAL_LEADERBOARD') {
        ws.send(JSON.stringify({
          type: 'GLOBAL_LEADERBOARD',
          leaderboard: leaderboardManager.getTopPlayers(20),
        }));
      } else if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', time: data.time }));
      }
    } catch (err) {
      console.error('[Server] Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    if (hasJoinedGame) {
      gameRoom.removePlayer(playerId);
      hasJoinedGame = false;
    }
    socialManager.unregisterSocket(socketId);
  });

  ws.on('error', (err) => {
    console.error(`[Server] Socket error for ${socketId}:`, err);
  });
});

function getLocalIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        const isVirtual = /vmnet|virtual|vbox|vethernet/i.test(name);
        const isWifiOrEth = /wi-fi|wifi|ethernet|wlan/i.test(name);
        candidates.push({ name, address: net.address, isVirtual, isWifiOrEth });
      }
    }
  }
  const best = candidates.find(c => c.isWifiOrEth && !c.isVirtual) ||
               candidates.find(c => !c.isVirtual) ||
               candidates[0];
  return best ? best.address : 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`=======================================================`);
  console.log(`🐍 Multiplayer Snake Arena Server is RUNNING!`);
  console.log(`👉 Local:   http://localhost:${PORT}`);
  console.log(`👉 LAN:     http://${localIp}:${PORT}`);
  console.log(`=======================================================`);
});
