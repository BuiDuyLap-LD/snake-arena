// server/server.js

const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const os = require('os');
const GameRoom = require('./GameRoom');
const leaderboardManager = require('./LeaderboardManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve public directory
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Health / info endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    players: gameRoom.players.size,
    bots: gameRoom.bots.size,
    timeRemaining: Math.ceil(gameRoom.timeRemaining),
  });
});

// Human Global Leaderboard endpoint
app.get('/api/leaderboard', (req, res) => {
  res.json({
    success: true,
    leaderboard: leaderboardManager.getTopPlayers(20),
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Single main arena room
const gameRoom = new GameRoom('arena-main');
gameRoom.start();

let nextClientId = 1000;

wss.on('connection', (ws) => {
  const playerId = `p_${nextClientId++}`;
  let hasJoined = false;

  // Send global leaderboard on initial connect
  ws.send(JSON.stringify({
    type: 'GLOBAL_LEADERBOARD',
    leaderboard: leaderboardManager.getTopPlayers(20),
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'JOIN_GAME') {
        const playerName = (data.name || 'Snake').substring(0, 16).trim();
        const playerColor = data.color || '#00ffcc';
        gameRoom.addPlayer(ws, playerId, playerName, playerColor);
        hasJoined = true;
      } else if (data.type === 'PLAYER_INPUT' && hasJoined) {
        gameRoom.handlePlayerInput(playerId, data);
      } else if (data.type === 'USE_POWERUP' && hasJoined) {
        gameRoom.handlePlayerInput(playerId, data);
      } else if (data.type === 'RESPAWN' && hasJoined) {
        gameRoom.respawnPlayer(playerId);
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
    if (hasJoined) {
      gameRoom.removePlayer(playerId);
    }
  });

  ws.on('error', (err) => {
    console.error(`[Server] Socket error for ${playerId}:`, err);
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
