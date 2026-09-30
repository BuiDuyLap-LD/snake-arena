// server/SocialManager.js

const accountManager = require("./AccountManager");

class SocialManager {
  constructor() {
    this.sockets = new Map(); // socketId -> { id, ws, username, isGuest, status: 'lobby'|'in_game', room }
    this.userSockets = new Map(); // usernameLower -> Set of socketIds

    // Global lobby chat (max 60 messages)
    this.lobbyChat = [
      {
        id: "msg_sys_1",
        sender: "Hệ Thống 🛡️",
        senderTier: "Quản Trị",
        senderSkin: "#00f0ff",
        isGuest: false,
        text: "Chào mừng các dũng sĩ đến với Đấu Trường Snake Arena 5v5! Hãy kết bạn và lập đội săn mồi ngay!",
        time: Date.now(),
      },
    ];

    // Private chats: pairKey -> Array of messages (max 50)
    this.privateChats = new Map();
  }

  getPairKey(u1, u2) {
    return [u1.toLowerCase(), u2.toLowerCase()].sort().join(":");
  }

  registerSocket(socketId, ws) {
    this.sockets.set(socketId, {
      id: socketId,
      ws,
      username: null,
      isGuest: true,
      status: "lobby",
      room: "ARENA-5V5",
    });
  }

  authenticateSocket(socketId, token, guestName = "Snake") {
    const entry = this.sockets.get(socketId);
    if (!entry) return null;

    let user = null;
    if (token) {
      user = accountManager.getUserByToken(token);
    }

    // Clean up old mapping if socket previously had a username
    if (entry.username) {
      const oldKey = entry.username.toLowerCase();
      const set = this.userSockets.get(oldKey);
      if (set) {
        set.delete(socketId);
        if (set.size === 0) this.userSockets.delete(oldKey);
      }
    }

    if (user) {
      entry.username = user.username;
      entry.isGuest = false;
      const key = user.username.toLowerCase();
      if (!this.userSockets.has(key)) {
        this.userSockets.set(key, new Set());
      }
      this.userSockets.get(key).add(socketId);

      // Notify friends that user is online
      this.notifyFriendsPresence(user.username, entry.status);
    } else {
      entry.username = guestName || "Khách";
      entry.isGuest = true;
    }

    return user;
  }

  setSocketStatus(socketId, status, room = "ARENA-5V5") {
    const entry = this.sockets.get(socketId);
    if (!entry) return;
    entry.status = status;
    if (room) entry.room = room;

    if (!entry.isGuest && entry.username) {
      this.notifyFriendsPresence(entry.username, status);
    }
  }

  unregisterSocket(socketId) {
    const entry = this.sockets.get(socketId);
    if (!entry) return;

    if (!entry.isGuest && entry.username) {
      const key = entry.username.toLowerCase();
      const set = this.userSockets.get(key);
      if (set) {
        set.delete(socketId);
        if (set.size === 0) {
          this.userSockets.delete(key);
          // Notify friends that user went offline
          this.notifyFriendsPresence(entry.username, "offline");
        }
      }
    }

    this.sockets.delete(socketId);
  }

  getUserStatus(username) {
    if (!username) return "offline";
    const key = username.toLowerCase();
    const set = this.userSockets.get(key);
    if (!set || set.size === 0) return "offline";

    for (const sId of set) {
      const s = this.sockets.get(sId);
      if (s) {
        if (s.status === "in_game") return "in_game";
      }
    }
    return "online";
  }

  getOnlinePlayerCount() {
    return this.sockets.size;
  }

  sendToSocket(ws, data) {
    if (ws && ws.readyState === 1 /* OPEN */) {
      try {
        ws.send(JSON.stringify(data));
      } catch (e) {
        console.error("[SocialManager] send error:", e);
      }
    }
  }

  sendToUser(username, data) {
    if (!username) return;
    const key = username.toLowerCase();
    const set = this.userSockets.get(key);
    if (!set) return;

    for (const sId of set) {
      const entry = this.sockets.get(sId);
      if (entry && entry.ws) {
        this.sendToSocket(entry.ws, data);
      }
    }
  }

  broadcastLobby(data, excludeSocketId = null) {
    for (const [id, entry] of this.sockets.entries()) {
      if (excludeSocketId && id === excludeSocketId) continue;
      this.sendToSocket(entry.ws, data);
    }
  }

  notifyFriendsPresence(username, status) {
    const raw = accountManager.getRawUser(username);
    if (!raw || !Array.isArray(raw.friends)) return;

    for (const fName of raw.friends) {
      this.sendToUser(fName, {
        type: "FRIEND_PRESENCE_UPDATE",
        friendName: username,
        status:
          status === "in_game"
            ? "in_game"
            : status === "offline"
              ? "offline"
              : "online",
      });
    }
  }

  // ================= FRIEND ACTIONS =================

  sendFriendRequest(socketId, toUsername) {
    const entry = this.sockets.get(socketId);
    if (!entry || entry.isGuest || !entry.username) {
      return {
        success: false,
        error: "Bạn cần đăng nhập tài khoản cố định để kết bạn!",
      };
    }

    const result = accountManager.sendFriendRequest(entry.username, toUsername);
    if (result.success) {
      // If auto accepted
      if (result.autoAccepted) {
        const myRaw = accountManager.getRawUser(entry.username);
        const myProfile = accountManager.sanitize(myRaw);
        myProfile.status = entry.status;

        this.sendToUser(toUsername, {
          type: "FRIEND_REQUEST_ACCEPTED",
          message: `Dũng sĩ ${entry.username} đã trở thành bạn bè với bạn!`,
          friend: myProfile,
        });

        const targetStatus = this.getUserStatus(toUsername);
        result.friend.status = targetStatus;
      } else {
        // Send real-time request to recipient
        const myRaw = accountManager.getRawUser(entry.username);
        this.sendToUser(toUsername, {
          type: "FRIEND_REQUEST_RECEIVED",
          from: entry.username,
          tier: myRaw ? myRaw.tier : "Đồng 🥉",
          skin: myRaw ? myRaw.skin : "#00f0ff",
          highScore: myRaw ? myRaw.highScore : 0,
          totalKills: myRaw ? myRaw.totalKills : 0,
          time: Date.now(),
        });
      }
    }

    return result;
  }

  respondFriendRequest(socketId, fromUsername, accept = true) {
    const entry = this.sockets.get(socketId);
    if (!entry || entry.isGuest || !entry.username) {
      return { success: false, error: "Chưa đăng nhập" };
    }

    const result = accountManager.respondFriendRequest(
      entry.username,
      fromUsername,
      accept,
    );
    if (result.success && accept) {
      const myRaw = accountManager.getRawUser(entry.username);
      const myProfile = accountManager.sanitize(myRaw);
      myProfile.status = entry.status;

      // Notify the requester that friend request was accepted
      this.sendToUser(fromUsername, {
        type: "FRIEND_REQUEST_ACCEPTED",
        message: `${entry.username} đã chấp nhận lời mời kết bạn của bạn!`,
        friend: myProfile,
      });

      if (result.friend) {
        result.friend.status = this.getUserStatus(fromUsername);
      }
    }

    return result;
  }

  removeFriend(socketId, friendUsername) {
    const entry = this.sockets.get(socketId);
    if (!entry || entry.isGuest || !entry.username) {
      return { success: false, error: "Chưa đăng nhập" };
    }

    const result = accountManager.removeFriend(entry.username, friendUsername);
    if (result.success) {
      this.sendToUser(friendUsername, {
        type: "FRIEND_REMOVED",
        friendName: entry.username,
      });
    }
    return result;
  }

  // ================= CHAT ACTIONS =================

  sendChatMessage(socketId, data = {}) {
    const entry = this.sockets.get(socketId);
    if (!entry) return { success: false, error: "Kết nối không hợp lệ" };

    const to = data.to || null;
    const text = data.text || "";
    const chatType =
      data.typeChat ||
      data.chatType ||
      data.target ||
      (to ? "private" : "lobby");

    const cleanText = text.trim();
    if (!cleanText || cleanText.length > 200) {
      return { success: false, error: "Tin nhắn không hợp lệ (1-200 ký tự)" };
    }

    const senderName = entry.username || "Khách";
    let senderTier = "Tân Binh";
    let senderSkin = "#00f0ff";

    if (!entry.isGuest) {
      const user = accountManager.getRawUser(senderName);
      if (user) {
        senderTier = user.tier || "Đồng 🥉";
        senderSkin = user.skin || "#00f0ff";
      }
    }

    const msgObj = {
      id: `m_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      sender: senderName,
      senderTier,
      senderSkin,
      isGuest: entry.isGuest,
      text: cleanText,
      time: Date.now(),
    };

    if (chatType === "lobby") {
      this.lobbyChat.push(msgObj);
      if (this.lobbyChat.length > 60) this.lobbyChat.shift();

      this.broadcastLobby({
        type: "LOBBY_CHAT_MESSAGE",
        message: msgObj,
      });

      return { success: true, message: msgObj };
    } else if (chatType === "private" && to) {
      if (entry.isGuest) {
        return {
          success: false,
          error: "Bạn cần đăng nhập để nhắn tin riêng với bạn bè!",
        };
      }

      const toUser = accountManager.getRawUser(to);
      if (!toUser) {
        return { success: false, error: "Người nhận không tồn tại" };
      }

      const pairKey = this.getPairKey(senderName, to);
      if (!this.privateChats.has(pairKey)) {
        this.privateChats.set(pairKey, []);
      }
      const history = this.privateChats.get(pairKey);

      const privateMsgObj = {
        ...msgObj,
        to: toUser.username,
      };

      history.push(privateMsgObj);
      if (history.length > 50) history.shift();

      // Send to recipient
      this.sendToUser(toUser.username, {
        type: "PRIVATE_CHAT_MESSAGE",
        message: privateMsgObj,
      });

      // Send back to sender sockets
      this.sendToUser(senderName, {
        type: "PRIVATE_CHAT_MESSAGE",
        message: privateMsgObj,
      });

      return { success: true, message: privateMsgObj };
    }

    return { success: false, error: "Loại tin nhắn không hợp lệ" };
  }

  getPrivateChatHistory(username1, username2) {
    if (!username1 || !username2) return [];
    const pairKey = this.getPairKey(username1, username2);
    return this.privateChats.get(pairKey) || [];
  }

  getLobbyChatHistory() {
    return this.lobbyChat;
  }

  // ================= SOCIAL INTERACTIONS =================

  inviteFriendToGame(
    socketId,
    toUsername,
    roomCode = "ARENA-5V5",
    mode = "ranked",
  ) {
    const entry = this.sockets.get(socketId);
    if (!entry) return { success: false, error: "Chưa kết nối" };

    const senderName = entry.username || "Bạn bè";
    const raw = entry.isGuest ? null : accountManager.getRawUser(senderName);

    this.sendToUser(toUsername, {
      type: "ROOM_INVITE",
      from: senderName,
      fromTier: raw ? raw.tier : "Đồng 🥉",
      fromSkin: raw ? raw.skin : "#00f0ff",
      roomCode: roomCode || entry.room || "ARENA-5V5",
      mode:
        mode === "solo5v5"
          ? "solo5v5"
          : mode === "casual"
            ? "casual"
            : "ranked",
      time: Date.now(),
    });

    return {
      success: true,
      message: `Đã gửi lời mời tham gia phòng tới ${toUsername}!`,
    };
  }

  pokeFriend(socketId, toUsername) {
    const entry = this.sockets.get(socketId);
    if (!entry) return { success: false, error: "Chưa kết nối" };

    const senderName = entry.username || "Chiến binh";
    this.sendToUser(toUsername, {
      type: "FRIEND_POKED",
      from: senderName,
      time: Date.now(),
    });

    return { success: true, message: `Đã vẫy tay chào ${toUsername}! 👋` };
  }

  commendPlayer(socketId, targetName) {
    const entry = this.sockets.get(socketId);
    if (!entry) return { success: false, error: "Chưa kết nối" };

    const senderName = entry.username || "Đồng đội";
    this.sendToUser(targetName, {
      type: "PLAYER_COMMENDED",
      from: senderName,
      time: Date.now(),
    });

    return {
      success: true,
      message: `Đã gửi lời khen ngợi tới ${targetName}! ❤️`,
    };
  }
}

module.exports = new SocialManager();
