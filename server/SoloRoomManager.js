const crypto = require("crypto");

class SoloRoomManager {
  constructor() {
    this.rooms = new Map();
    this.socketRooms = new Map();
    this.usernameRooms = new Map();
    this.minTeamSize = 2;
    this.maxTeamSize = 5;
    this.maxRooms = 200;
  }

  create(member, settings = {}) {
    if (this.socketRooms.has(member.socketId)) {
      return { success: false, error: "Bạn đang ở trong một phòng chờ khác." };
    }
    if (this.rooms.size >= this.maxRooms) {
      return { success: false, error: "Máy chủ đang có quá nhiều phòng chờ." };
    }

    let roomCode;
    do {
      roomCode = `5V5-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    } while (this.rooms.has(roomCode));

    const room = {
      roomCode,
      hostSocketId: member.socketId,
      members: new Map(),
      started: false,
      settings: {
        mapId: settings.mapId || "neon-grid",
        roundDuration: settings.roundDuration || 600,
        botsEnabled: settings.botsEnabled !== false,
      },
    };
    this.rooms.set(roomCode, room);
    const result = this.addMember(room, member);
    if (!result.success) this.rooms.delete(roomCode);
    return result;
  }

  join(roomCode, member) {
    if (this.socketRooms.has(member.socketId)) {
      return { success: false, error: "Bạn đang ở trong một phòng chờ khác." };
    }

    const room = this.rooms.get(this.normalizeCode(roomCode));
    if (!room || room.started) {
      return { success: false, error: "Không tìm thấy phòng chờ này." };
    }
    return this.addMember(room, member);
  }

  normalizeCode(roomCode) {
    return typeof roomCode === "string"
      ? roomCode.trim().replace(/^#/, "").toUpperCase()
      : "";
  }

  addMember(room, member) {
    const usernameKey = member.username.toLowerCase();
    if (this.usernameRooms.has(usernameKey)) {
      return { success: false, error: "Tài khoản này đã có trong một phòng." };
    }

    const teamId = this.chooseTeam(room, member.teamId);
    if (!teamId) {
      return { success: false, error: "Hai đội đã đủ 5 người." };
    }

    member.teamId = teamId;
    room.members.set(member.socketId, member);
    this.socketRooms.set(member.socketId, room.roomCode);
    this.usernameRooms.set(usernameKey, room.roomCode);
    this.broadcastState(room);
    return {
      success: true,
      roomCode: room.roomCode,
      state: this.getState(room),
    };
  }

  updateRoomSettings(roomCode, settings = {}) {
    const room = this.rooms.get(this.normalizeCode(roomCode));
    if (!room) return { success: false, error: "Phòng chờ không tồn tại." };
    room.settings = {
      ...room.settings,
      mapId: settings.mapId || room.settings.mapId || "neon-grid",
      roundDuration: settings.roundDuration || room.settings.roundDuration || 600,
      botsEnabled: settings.botsEnabled !== undefined ? settings.botsEnabled : room.settings.botsEnabled,
    };
    this.broadcastState(room);
    return { success: true, state: this.getState(room) };
  }

  chooseTeam(room, requestedTeam) {
    const redCount = this.countTeam(room, "red");
    const blueCount = this.countTeam(room, "blue");
    const teamId =
      requestedTeam === "red" || requestedTeam === "blue"
        ? requestedTeam
        : redCount <= blueCount
          ? "red"
          : "blue";

    return this.countTeam(room, teamId) < this.maxTeamSize ? teamId : null;
  }

  countTeam(room, teamId) {
    let count = 0;
    for (const member of room.members.values()) {
      if (member.teamId === teamId) count++;
    }
    return count;
  }

  changeTeam(socketId, teamId) {
    const room = this.getRoomForSocket(socketId);
    const member = room && room.members.get(socketId);
    if (!room || room.started || !member) {
      return { success: false, error: "Không thể đổi đội lúc này." };
    }
    if (teamId !== "red" && teamId !== "blue") {
      return { success: false, error: "Đội được chọn không hợp lệ." };
    }
    if (member.teamId === teamId) {
      return { success: true, state: this.getState(room) };
    }
    if (this.countTeam(room, teamId) >= this.maxTeamSize) {
      return { success: false, error: "Đội đã đủ 5 người." };
    }

    member.teamId = teamId;
    this.broadcastState(room);
    return { success: true, state: this.getState(room) };
  }

  start(roomCode, socketId) {
    const room = this.rooms.get(this.normalizeCode(roomCode));
    if (!room || room.started) {
      return { success: false, error: "Phòng chờ không còn khả dụng." };
    }
    if (room.hostSocketId !== socketId) {
      return { success: false, error: "Chỉ chủ phòng mới có thể bắt đầu." };
    }

    const redCount = this.countTeam(room, "red");
    const blueCount = this.countTeam(room, "blue");
    if (redCount < this.minTeamSize || blueCount < this.minTeamSize) {
      return {
        success: false,
        error: `Cần ít nhất ${this.minTeamSize} người ở mỗi đội để bắt đầu.`,
      };
    }

    room.started = true;
    const members = Array.from(room.members.values());
    this.rooms.delete(room.roomCode);
    for (const member of members) {
      this.socketRooms.delete(member.socketId);
      this.usernameRooms.delete(member.username.toLowerCase());
    }
    return { success: true, roomCode: room.roomCode, members };
  }

  leave(socketId) {
    const room = this.getRoomForSocket(socketId);
    if (!room) return null;

    const member = room.members.get(socketId);
    if (!member) return null;

    room.members.delete(socketId);
    this.socketRooms.delete(socketId);
    this.usernameRooms.delete(member.username.toLowerCase());

    if (room.members.size === 0) {
      this.rooms.delete(room.roomCode);
      return null;
    }
    if (!room.members.has(room.hostSocketId)) {
      room.hostSocketId = room.members.keys().next().value;
    }

    this.broadcastState(room);
    return this.getState(room);
  }

  getRoomForSocket(socketId) {
    const roomCode = this.socketRooms.get(socketId);
    return roomCode ? this.rooms.get(roomCode) || null : null;
  }

  getState(room) {
    const members = Array.from(room.members.values());
    const red = members
      .filter((member) => member.teamId === "red")
      .map((member) => this.publicMember(member, room.hostSocketId));
    const blue = members
      .filter((member) => member.teamId === "blue")
      .map((member) => this.publicMember(member, room.hostSocketId));

    return {
      roomCode: room.roomCode,
      hostSocketId: room.hostSocketId,
      red,
      blue,
      minTeamSize: this.minTeamSize,
      maxTeamSize: this.maxTeamSize,
      settings: room.settings || {
        mapId: "neon-grid",
        roundDuration: 600,
        botsEnabled: false,
      },
      canStart:
        red.length >= this.minTeamSize && blue.length >= this.minTeamSize,
    };
  }

  publicMember(member, hostSocketId) {
    return {
      socketId: member.socketId,
      username: member.username,
      teamId: member.teamId,
      isHost: member.socketId === hostSocketId,
    };
  }

  broadcastState(room) {
    const state = this.getState(room);
    const message = JSON.stringify({ type: "SOLO_ROOM_STATE", state });
    for (const member of room.members.values()) {
      if (member.ws && member.ws.readyState === 1) {
        member.ws.send(message);
      }
    }
  }
}

module.exports = SoloRoomManager;
