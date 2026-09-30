// public/js/main.js

class GameClient {
  static EMOTE_CATALOG = [
    { id: "emote-wave", name: "Vẫy tay", icon: "👋", unlockLevel: 1 },
    { id: "emote-heart", name: "Thả tim", icon: "💖", unlockLevel: 2 },
    { id: "emote-laugh", name: "Cười lớn", icon: "😂", unlockLevel: 3 },
    { id: "emote-fire", name: "Bùng cháy", icon: "🔥", unlockLevel: 4 },
    { id: "emote-star", name: "Tỏa sáng", icon: "⭐", unlockLevel: 6 },
    { id: "emote-cry", name: "Khóc nhè", icon: "😭", unlockLevel: 8 },
    { id: "emote-crown", name: "Vương miện", icon: "👑", unlockLevel: 10 },
    { id: "emote-gg", name: "GG!", icon: "🎉", unlockLevel: 12 },
  ];

  constructor() {
    this.ws = null;
    this.localPlayerId = null;
    this.socketId = null;
    this.arenaRadius = 2200;

    // Delta food storage on client
    this.foods = new Map();
    this.powerups = [];

    this.selectedColor = "#00f0ff";
    this.currentInput = { angle: 0, boosting: false };
    this.lastSentInput = { angle: null, boosting: null };
    this.lastInputSendTime = 0;

    // Room info
    this.roomCode = "ARENA-5V5";
    this.selectedGameMode = "ranked";
    this.activeGameMode = "ranked";
    this.selectedMapId = "neon-grid";
    this.soloRoomState = null;
    this.mapPresets = [
      { id: "neon-grid", label: "Neon Grid", icon: "🌃", arenaRadius: 2200 },
      { id: "ash-maze", label: "Ash Maze", icon: "🧭", arenaRadius: 2400 },
      { id: "crystal-lake", label: "Crystal Lake", icon: "💎", arenaRadius: 2300 },
      { id: "sunfire-arena", label: "Sunfire Arena", icon: "🔥", arenaRadius: 2100 },
    ];

    // Account & Authentication
    this.currentUser = null;
    this.authToken = localStorage.getItem("snake_auth_token");
    this.authMode = "login"; // 'login' or 'register'

    // Social & Friends state
    this.friends = [];
    this.friendRequests = [];
    this.activePrivateChatUser = null;
    this.activeFriendsTab = "friends"; // 'friends', 'requests', 'search', 'lobbychat'
    this.lobbyView = "play";
    this.friendsDataLoaded = false;
    this.currentMatchRankings = [];
    this.likedPlayers = new Set();
    this.confettiRunning = false;
    this.confettiParticles = [];
    this.pendingRoomInvite = null;

    // HUD throttles
    this.lastLeaderboardRender = 0;
    this.lastTimerText = "";
    this.lastPlayerCountText = "";

    // Career stats
    this.careerStats = this.loadCareerStats();
    this.playerProgress = this.loadPlayerProgress();
    this.shopCategory = "all";
    this.shopCatalog = [
      {
        id: "starter-cyan",
        name: "Neon Cyan",
        type: "skin",
        icon: "🟦",
        color: "#00f0ff",
        category: "skins",
        rarity: "BASIC",
        price: { coins: 120 },
        bonus: "+2% Speed",
        description: "Rắn nhanh nhẹn, nhẹ như tia điện.",
        stats: { speed: 2, boost: 0, magnet: 1, shield: 0 },
      },
      {
        id: "blaze-red",
        name: "Crimson Blaze",
        type: "skin",
        icon: "🔴",
        color: "#ff3355",
        category: "skins",
        rarity: "RARE",
        price: { coins: 220, shards: 2 },
        bonus: "+3% Boost",
        description: "Tăng hiệu ứng boost trong trận đấu.",
        stats: { speed: 1, boost: 3, magnet: 0, shield: 1 },
      },
      {
        id: "trail-fire",
        name: "Trail Fire",
        type: "trail",
        icon: "🔥",
        category: "trails",
        rarity: "RARE",
        price: { coins: 180 },
        bonus: "Mẫu vệt lửa",
        description: "Mẫu vệt lửa trang trí trong bộ sưu tập đấu trường.",
        stats: { speed: 1, boost: 1, magnet: 2, shield: 1 },
      },
      {
        id: "booster-pack",
        name: "Booster Pack",
        type: "utility",
        icon: "⚡",
        category: "boosts",
        rarity: "EPIC",
        price: { coins: 260, tickets: 1 },
        bonus: "Bộ sưu tập boost",
        description: "Linh kiện boost phiên bản giới hạn để bổ sung bộ sưu tập.",
        stats: { speed: 0, boost: 2, magnet: 1, shield: 1 },
      },
      {
        id: "emerald-boost",
        name: "Emerald Rush",
        type: "skin",
        icon: "🟢",
        color: "#35e58b",
        category: "skins",
        rarity: "RARE",
        price: { coins: 280 },
        bonus: "+3% Magnet",
        description: "Lớp vảy lục bảo dành cho tay săn mồi lì lợm.",
        stats: { speed: 1, boost: 1, magnet: 3, shield: 0 },
      },
      {
        id: "solar-gold",
        name: "Solar Crown",
        type: "skin",
        icon: "🌟",
        color: "#ffc247",
        category: "skins",
        rarity: "EPIC",
        price: { coins: 360, shards: 2 },
        bonus: "+2% Boost · +2% Shield",
        description: "Ánh vàng rực cháy giữa tâm điểm đấu trường.",
        stats: { speed: 1, boost: 2, magnet: 0, shield: 2 },
      },
      {
        id: "violet-arc",
        name: "Arc Nebula",
        type: "skin",
        icon: "🟣",
        color: "#c179ff",
        category: "skins",
        rarity: "EPIC",
        price: { coins: 420, shards: 3 },
        bonus: "+2% Speed · +1% Boost",
        description: "Một vệt sáng lạ thường đến từ vùng không gian sâu.",
        stats: { speed: 2, boost: 1, magnet: 1, shield: 1 },
      },
      {
        id: "crimson-flare",
        name: "Crimson Flare",
        type: "skin",
        icon: "🔺",
        color: "#ff5b45",
        category: "skins",
        rarity: "LEGENDARY",
        price: { coins: 520, shards: 4 },
        bonus: "+3% Boost",
        description: "Sắc đỏ huyền thoại, bùng lên trong từng pha tăng tốc.",
        stats: { speed: 0, boost: 3, magnet: 1, shield: 1 },
      },
      {
        id: "trail-comet",
        name: "Comet Wake",
        type: "trail",
        icon: "☄️",
        category: "trails",
        rarity: "EPIC",
        price: { coins: 300, shards: 1 },
        bonus: "Vệt sao chổi",
        description: "Dấu vết sao băng cho bộ sưu tập của bạn.",
        stats: {},
      },
      {
        id: "trail-prism",
        name: "Prism Drift",
        type: "trail",
        icon: "💠",
        category: "trails",
        rarity: "RARE",
        price: { coins: 240 },
        bonus: "Vệt lăng kính",
        description: "Sắc màu khúc xạ theo mỗi vòng lượn.",
        stats: {},
      },
      {
        id: "emote-wave",
        name: "Wave Hello",
        type: "emote",
        icon: "👋",
        category: "emotes",
        rarity: "BASIC",
        price: { coins: 90 },
        bonus: "Biểu cảm khởi đầu · Lv. 1",
        description: "Vẫy tay chào đối thủ và đồng đội trên đấu trường.",
        stats: {},
      },
      {
        id: "emote-crown",
        name: "Victory Crown",
        type: "emote",
        icon: "👑",
        category: "emotes",
        rarity: "RARE",
        price: { coins: 190 },
        bonus: "Biểu cảm · mở khóa Lv. 10",
        description: "Đội vương miện ăn mừng giữa trận đấu.",
        stats: {},
      },
      {
        id: "emote-gg",
        name: "GG Spark",
        type: "emote",
        icon: "🎉",
        category: "emotes",
        rarity: "BASIC",
        price: { coins: 100 },
        bonus: "Biểu cảm · mở khóa Lv. 12",
        description: "Gửi lời chúc mừng bằng pháo giấy rực rỡ.",
        stats: {},
      },
      {
        id: "emote-heart",
        name: "Heart Pop",
        type: "emote",
        icon: "💖",
        category: "emotes",
        rarity: "BASIC",
        price: { coins: 120 },
        bonus: "Biểu cảm · mở khóa Lv. 2",
        description: "Thả một trái tim nổi bật để đồng đội thấy.",
        stats: {},
      },
      {
        id: "emote-laugh",
        name: "Laugh Riot",
        type: "emote",
        icon: "😂",
        category: "emotes",
        rarity: "BASIC",
        price: { coins: 130 },
        bonus: "Biểu cảm · mở khóa Lv. 3",
        description: "Một tràng cười vui nhộn giữa giao tranh.",
        stats: {},
      },
      {
        id: "emote-fire",
        name: "Flame On",
        type: "emote",
        icon: "🔥",
        category: "emotes",
        rarity: "RARE",
        price: { coins: 170 },
        bonus: "Biểu cảm · mở khóa Lv. 4",
        description: "Bùng lửa cổ vũ khi trận đấu nóng lên.",
        stats: {},
      },
      {
        id: "emote-star",
        name: "Starstruck",
        type: "emote",
        icon: "⭐",
        category: "emotes",
        rarity: "RARE",
        price: { coins: 180 },
        bonus: "Biểu cảm · mở khóa Lv. 6",
        description: "Tỏa sáng để đánh dấu một pha xử lý đẹp.",
        stats: {},
      },
      {
        id: "emote-cry",
        name: "Tiny Tears",
        type: "emote",
        icon: "😭",
        category: "emotes",
        rarity: "EPIC",
        price: { coins: 210, shards: 1 },
        bonus: "Biểu cảm · mở khóa Lv. 8",
        description: "Khóc thật to sau một pha thoát thân sát nút.",
        stats: {},
      },
      {
        id: "boost-nitro",
        name: "Nitro Cell",
        type: "utility",
        icon: "🧪",
        category: "boosts",
        rarity: "EPIC",
        price: { coins: 280, tickets: 1 },
        bonus: "Vật phẩm hỗ trợ",
        description: "Linh kiện sưu tầm thuộc bộ Nitro của đấu trường.",
        stats: {},
      },
      {
        id: "boost-magnet",
        name: "Magnet Core",
        type: "utility",
        icon: "🧲",
        category: "boosts",
        rarity: "RARE",
        price: { coins: 230 },
        bonus: "Vật phẩm hỗ trợ",
        description: "Lõi từ tính trang trí cho bộ sưu tập của bạn.",
        stats: {},
      },
    ];
    this.grantLevelEmotes(this.playerProgress.level);
    const equippedShopSkin = this.shopCatalog.find(
      (item) => item.id === this.playerProgress.equippedSkin && item.type === "skin",
    );
    if (equippedShopSkin) this.selectedColor = equippedShopSkin.color;
    this.skinStatMap = {
      "starter-cyan": { speed: 2, boost: 0, magnet: 1, shield: 0 },
      "blaze-red": { speed: 1, boost: 3, magnet: 0, shield: 1 },
      "emerald-boost": { speed: 1, boost: 1, magnet: 3, shield: 0 },
      "solar-gold": { speed: 1, boost: 2, magnet: 0, shield: 2 },
      "violet-arc": { speed: 2, boost: 1, magnet: 1, shield: 1 },
      "crimson-flare": { speed: 0, boost: 3, magnet: 1, shield: 1 },
    };
    this.battlePassLevels = [
      { level: 1, reward: { coins: 80 }, label: "Neon Badge" },
      { level: 2, reward: { coins: 100 }, label: "Boost Ticket" },
      { level: 3, reward: { coins: 120, shards: 1 }, label: "Rare Skin" },
      { level: 4, reward: { coins: 160 }, label: "Trail Glow" },
      { level: 5, reward: { coins: 180, tickets: 1 }, label: "Arena Pack" },
      { level: 6, reward: { coins: 220 }, label: "Neon Frame" },
      { level: 7, reward: { coins: 260, shards: 1 }, label: "Elite Skin" },
      { level: 8, reward: { coins: 300 }, label: "Season Crown" },
    ];

    this.initDOM();
    this.initRenderer();
    this.initInput();
    this.bindEvents();
    this.initLobby();
    this.startGameLoop();
  }

  loadCareerStats() {
    try {
      const data = localStorage.getItem("snake_career_stats");
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Could not read career stats:", e);
    }
    return { highScore: 0, totalKills: 0, matchesPlayed: 0 };
  }

  loadPlayerProgress() {
    try {
      const data = localStorage.getItem("snake_player_progress");
      if (data) {
        const parsed = JSON.parse(data);
        return {
          level: parsed.level || 1,
          xp: parsed.xp || 0,
          coins: parsed.coins || 250,
          shards: parsed.shards || 12,
          tickets: parsed.tickets || 3,
          ownedItems: parsed.ownedItems || ["starter-cyan"],
          equippedEmotes: parsed.equippedEmotes || [],
          seasonXp: parsed.seasonXp || 0,
          battlePassXp: parsed.battlePassXp || 0,
          battlePassLevel: parsed.battlePassLevel || 1,
          premiumPass: !!parsed.premiumPass,
          snakeLevel: parsed.snakeLevel || 1,
          equippedSkin: parsed.equippedSkin || "starter-cyan",
          quests: parsed.quests || this.getDefaultQuestState(),
        };
      }
    } catch (e) {
      console.warn("Could not read player progress:", e);
    }
    return {
      level: 1,
      xp: 0,
      coins: 250,
      shards: 12,
      tickets: 3,
      ownedItems: ["starter-cyan"],
      equippedEmotes: [],
      seasonXp: 0,
      battlePassXp: 0,
      battlePassLevel: 1,
      premiumPass: false,
      snakeLevel: 1,
      equippedSkin: "starter-cyan",
      quests: this.getDefaultQuestState(),
    };
  }

  getDefaultQuestState() {
    return {
      daily: [
        { id: "daily-win", type: "daily", title: "Thắng 1 trận", target: 1, progress: 0, reward: { coins: 50 }, claimed: false },
        { id: "daily-power", type: "daily", title: "Dùng 3 power-up", target: 3, progress: 0, reward: { shards: 1 }, claimed: false },
        { id: "daily-rank", type: "daily", title: "Đạt 1 trận Ranked", target: 1, progress: 0, reward: { tickets: 1 }, claimed: false },
      ],
      weekly: [
        { id: "weekly-xp", type: "weekly", title: "Thu thập 250 XP", target: 250, progress: 0, reward: { coins: 180, shards: 1 }, claimed: false },
        { id: "weekly-match", type: "weekly", title: "Chơi 5 trận", target: 5, progress: 0, reward: { coins: 120 }, claimed: false },
        { id: "weekly-solo", type: "weekly", title: "Hoàn thành 2 trận Solo", target: 2, progress: 0, reward: { tickets: 2 }, claimed: false },
      ],
    };
  }

  savePlayerProgress() {
    try {
      localStorage.setItem(
        "snake_player_progress",
        JSON.stringify(this.playerProgress),
      );
    } catch (e) {
      console.warn("Could not save player progress:", e);
    }
  }

  getLevelTarget(level = this.playerProgress.level) {
    return 100 + (level - 1) * 45;
  }

  getCurrentTierName() {
    if (this.playerProgress.level >= 20) return "👑 Thách Đấu";
    if (this.playerProgress.level >= 12) return "💎 Kim Cương";
    if (this.playerProgress.level >= 7) return "🥇 Vàng";
    if (this.playerProgress.level >= 3) return "🥈 Bạc";
    return "🥉 Đồng";
  }

  getSelectedSkinStats() {
    const key = this.playerProgress.equippedSkin || "starter-cyan";
    const base = this.skinStatMap[key] || { speed: 0, boost: 0, magnet: 0, shield: 0 };
    const levelBonus = (this.playerProgress.snakeLevel || 1) - 1;
    return {
      speed: Math.min(15, base.speed + levelBonus * 0.8),
      boost: Math.min(15, base.boost + levelBonus * 0.7),
      magnet: Math.min(15, base.magnet + levelBonus * 0.6),
      shield: Math.min(15, base.shield + levelBonus * 0.6),
    };
  }

  getSnakeUpgradeCost() {
    const level = this.playerProgress.snakeLevel || 1;
    return 60 + (level - 1) * 35;
  }

  renderSnakeStats() {
    const stats = this.getSelectedSkinStats();
    const level = this.playerProgress.snakeLevel || 1;
    if (this.snakeLevelBadge) {
      this.snakeLevelBadge.textContent = `Lv. ${level}`;
    }
    if (this.statSpeed) this.statSpeed.textContent = `+${stats.speed.toFixed(1)}%`;
    if (this.statBoost) this.statBoost.textContent = `+${stats.boost.toFixed(1)}%`;
    if (this.statMagnet) this.statMagnet.textContent = `+${stats.magnet.toFixed(1)}%`;
    if (this.statShield) this.statShield.textContent = `+${stats.shield.toFixed(1)}%`;
    if (this.snakeUpgradeCost) {
      this.snakeUpgradeCost.textContent = `Phí: ${this.getSnakeUpgradeCost()} 🪙`;
    }
  }

  upgradeSnake() {
    const cost = this.getSnakeUpgradeCost();
    if ((this.playerProgress.coins || 0) < cost) {
      this.showToast("⚠️ Không đủ vàng để nâng cấp rắn.");
      return;
    }

    this.playerProgress.coins -= cost;
    this.playerProgress.snakeLevel = (this.playerProgress.snakeLevel || 1) + 1;
    this.savePlayerProgress();
    this.renderPlayerProgress();
    this.renderSnakeStats();
    this.showToast(`✅ Rắn đã được nâng cấp lên Lv. ${this.playerProgress.snakeLevel}.`);
  }

  renderPlayerProgress() {
    const level = this.playerProgress.level || 1;
    const xp = this.playerProgress.xp || 0;
    const target = this.getLevelTarget(level);
    const percent = Math.min(100, (xp / target) * 100);

    if (this.accountLevelBadge) {
      this.accountLevelBadge.textContent = `Lv. ${level}`;
    }
    if (this.accountXpText) {
      this.accountXpText.textContent = `${xp} / ${target} XP`;
    }
    if (this.accountRankText) {
      this.accountRankText.textContent = `Hạng: ${this.getCurrentTierName()}`;
    }
    if (this.accountXpBar) {
      this.accountXpBar.style.width = `${percent}%`;
    }
    if (this.currencyCoins) {
      this.currencyCoins.textContent = String(this.playerProgress.coins || 0);
    }
    if (this.currencyShards) {
      this.currencyShards.textContent = String(this.playerProgress.shards || 0);
    }
    if (this.currencyTickets) {
      this.currencyTickets.textContent = String(
        this.playerProgress.tickets || 0,
      );
    }
    if (this.shopCoins) {
      this.shopCoins.textContent = String(this.playerProgress.coins || 0);
    }
    if (this.shopShards) {
      this.shopShards.textContent = String(this.playerProgress.shards || 0);
    }
    if (this.shopTickets) {
      this.shopTickets.textContent = String(this.playerProgress.tickets || 0);
    }
    if (this.battlePassFill) {
      const battleTarget = Math.max(100, (this.playerProgress.battlePassLevel || 1) * 120);
      const battleProgress = this.playerProgress.battlePassXp || 0;
      const battlePercent = Math.min(100, (battleProgress / battleTarget) * 100);
      this.battlePassFill.style.width = `${battlePercent}%`;
    }
    if (this.battlePassLevelLabel) {
      this.battlePassLevelLabel.textContent = `Lv. ${this.playerProgress.battlePassLevel || 1}`;
    }
    if (this.myTierBadge) {
      this.myTierBadge.textContent = this.getCurrentTierName();
    }

    this.renderBattlePassLevels();
    this.renderQuests();
    this.renderSnakeStats();
  }

  advanceQuestProgress(groupKey, questId, amount = 1) {
    const group = this.playerProgress.quests?.[groupKey];
    if (!group) return;
    const quest = group.find((item) => item.id === questId);
    if (!quest || quest.claimed) return;
    quest.progress = Math.min(quest.target, (quest.progress || 0) + amount);
    this.savePlayerProgress();
  }

  addPlayerXp(amount) {
    if (!amount) return;
    const previousLevel = this.playerProgress.level || 1;
    this.playerProgress.xp += amount;
    while (
      this.playerProgress.xp >= this.getLevelTarget(this.playerProgress.level)
    ) {
      this.playerProgress.xp -= this.getLevelTarget(this.playerProgress.level);
      this.playerProgress.level += 1;
    }
    if (this.playerProgress.level > previousLevel) {
      this.grantLevelEmotes(this.playerProgress.level, true);
    }
    const xpBoost = Math.max(5, Math.floor(amount * 0.6));
    this.playerProgress.battlePassXp = (this.playerProgress.battlePassXp || 0) + xpBoost;
    while ((this.playerProgress.battlePassXp || 0) >= (this.playerProgress.battlePassLevel || 1) * 120) {
      this.playerProgress.battlePassXp -= (this.playerProgress.battlePassLevel || 1) * 120;
      this.playerProgress.battlePassLevel += 1;
    }
    const weeklyXpQuest = this.playerProgress.quests?.weekly?.find(
      (quest) => quest.id === "weekly-xp",
    );
    if (weeklyXpQuest && !weeklyXpQuest.claimed) {
      weeklyXpQuest.progress = Math.min(
        weeklyXpQuest.target,
        (weeklyXpQuest.progress || 0) + Math.max(10, Math.min(25, Math.floor(amount * 0.75))),
      );
    }
    this.savePlayerProgress();
    this.renderPlayerProgress();
  }

  getOwnedEmotes() {
    const owned = new Set(this.playerProgress.ownedItems || []);
    return GameClient.EMOTE_CATALOG.filter((emote) => owned.has(emote.id));
  }

  grantLevelEmotes(level, notify = false) {
    const owned = new Set(this.playerProgress.ownedItems || []);
    const unlocked = GameClient.EMOTE_CATALOG.filter(
      (emote) => emote.unlockLevel <= level && !owned.has(emote.id),
    );
    unlocked.forEach((emote) => {
      owned.add(emote.id);
      this.playerProgress.ownedItems.push(emote.id);
    });
    const validIds = new Set(GameClient.EMOTE_CATALOG.map((emote) => emote.id));
    const loadout = Array.isArray(this.playerProgress.equippedEmotes)
      ? this.playerProgress.equippedEmotes
      : [];
    this.playerProgress.equippedEmotes = [...new Set(loadout)]
      .filter((id) => validIds.has(id) && owned.has(id))
      .slice(0, 4);
    if (this.playerProgress.equippedEmotes.length === 0 && owned.has("emote-wave")) {
      this.playerProgress.equippedEmotes = ["emote-wave"];
    }
    if (unlocked.length) {
      this.savePlayerProgress();
      if (notify) {
        this.showToast(`🎭 Đã mở khóa: ${unlocked.map((emote) => emote.name).join(", ")}`);
      }
    }
    this.renderEmoteLoadout();
    this.renderEmoteHotbar();
  }

  setEmoteLoadout(slot, emoteId) {
    const emote = GameClient.EMOTE_CATALOG.find((entry) => entry.id === emoteId);
    if (emoteId && (!emote || !this.playerProgress.ownedItems.includes(emoteId))) return;
    const loadout = [...this.playerProgress.equippedEmotes];
    if (emoteId && loadout.some((equippedId, index) => index !== slot && equippedId === emoteId)) {
      this.showToast("Biểu cảm này đã nằm trong một ô khác.");
      this.renderEmoteLoadout();
      return;
    }
    loadout[slot] = emoteId || "";
    this.playerProgress.equippedEmotes = loadout.slice(0, 4);
    this.savePlayerProgress();
    this.renderEmoteLoadout();
    this.renderEmoteHotbar();
  }

  renderEmoteLoadout() {
    if (!this.emoteLoadout) return;
    const ownedEmotes = this.getOwnedEmotes();
    this.emoteLoadout.innerHTML = "";
    for (let slot = 0; slot < 4; slot += 1) {
      const selectedId = this.playerProgress.equippedEmotes?.[slot] || "";
      const label = document.createElement("label");
      label.className = "emote-loadout-slot";
      label.innerHTML = `<span>Ô ${slot + 1}</span><select data-slot="${slot}" aria-label="Biểu cảm ô ${slot + 1}"><option value="">Trống</option>${ownedEmotes.map((emote) => `<option value="${emote.id}" ${emote.id === selectedId ? "selected" : ""}>${emote.icon} ${emote.name}</option>`).join("")}</select>`;
      this.emoteLoadout.appendChild(label);
    }
    if (this.emoteLoadoutCount) {
      const count = (this.playerProgress.equippedEmotes || []).filter(Boolean).length;
      this.emoteLoadoutCount.textContent = `${count}/4`;
    }
  }

  renderEmoteHotbar() {
    if (!this.emoteHotbar) return;
    this.emoteHotbar.innerHTML = "";
    for (let slot = 0; slot < 4; slot += 1) {
      const id = this.playerProgress.equippedEmotes?.[slot];
      const emote = GameClient.EMOTE_CATALOG.find((entry) => entry.id === id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "emote-hotbar-button hud-interactive";
      button.dataset.emoteId = emote?.id || "";
      button.disabled = !emote;
      button.setAttribute("aria-label", emote ? `Dùng biểu cảm ${emote.name}` : `Ô biểu cảm ${slot + 1} trống`);
      button.title = emote ? `${emote.name} · phím ${slot + 4}` : `Ô ${slot + 1} trống`;
      button.innerHTML = `<span>${emote?.icon || "＋"}</span><kbd>${slot + 4}</kbd>`;
      this.emoteHotbar.appendChild(button);
    }
  }

  useEmote(emoteId) {
    if (!emoteId || !this.playerProgress.equippedEmotes.includes(emoteId)) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.localPlayerId) return;
    this.ws.send(JSON.stringify({ type: "USE_EMOTE", emoteId }));
  }

  renderBattlePassLevels() {
    if (!this.battlePassGrid) return;
    this.battlePassGrid.innerHTML = "";
    this.battlePassLevels.forEach((passLevel) => {
      const eligible = passLevel.level <= (this.playerProgress.battlePassLevel || 1);
      const card = document.createElement("div");
      card.className = `battle-pass-tier ${eligible ? "earned" : ""}`;
      card.innerHTML = `
        <span class="battle-pass-tier-label">Lv. ${passLevel.level}</span>
        <span class="battle-pass-tier-reward">${passLevel.label}</span>
        <small>${(passLevel.reward.coins || 0)} 🪙${(passLevel.reward.shards || 0) ? ` · ${passLevel.reward.shards} 💎` : ""}${(passLevel.reward.tickets || 0) ? ` · ${passLevel.reward.tickets} 🎫` : ""}</small>
      `;
      this.battlePassGrid.appendChild(card);
    });
  }

  renderQuests() {
    if (!this.questList) return;
    const groups = Object.entries(this.playerProgress.quests || {});
    this.questList.innerHTML = "";

    groups.forEach(([groupKey, quests]) => {
      quests.forEach((quest) => {
        const card = document.createElement("div");
        const complete = (quest.progress || 0) >= quest.target;
        card.className = `quest-card ${complete ? "complete" : ""}`;
        card.innerHTML = `
          <div class="quest-main">
            <div class="quest-label">${groupKey === "daily" ? "Daily" : "Weekly"}</div>
            <div class="quest-title">${quest.title}</div>
            <div class="quest-progress">${Math.min(quest.progress || 0, quest.target)} / ${quest.target}</div>
          </div>
          <button class="quest-button" data-quest-id="${quest.id}" data-group="${groupKey}" ${quest.claimed || !complete ? "disabled" : ""}>
            ${quest.claimed ? "Đã nhận" : complete ? "Nhận thưởng" : "Chưa xong"}
          </button>
        `;
        this.questList.appendChild(card);
      });
    });

    this.questList.querySelectorAll(".quest-button").forEach((button) => {
      button.addEventListener("click", () => {
        const questId = button.dataset.questId;
        const groupKey = button.dataset.group;
        this.claimQuestReward(questId, groupKey);
      });
    });
  }

  claimQuestReward(questId, groupKey) {
    const quest = this.playerProgress.quests[groupKey].find((item) => item.id === questId);
    if (!quest || quest.claimed) return;
    if ((quest.progress || 0) < quest.target) {
      this.showToast("⚠️ Nhiệm vụ chưa hoàn thành.");
      return;
    }

    if (quest.reward.coins) this.playerProgress.coins += quest.reward.coins;
    if (quest.reward.shards) this.playerProgress.shards += quest.reward.shards;
    if (quest.reward.tickets) this.playerProgress.tickets += quest.reward.tickets;
    quest.claimed = true;
    this.addPlayerXp(30);
    this.savePlayerProgress();
    this.renderPlayerProgress();
    this.showToast("✅ Đã nhận thưởng nhiệm vụ!");
  }

  canAffordItem(item) {
    return (
      (this.playerProgress.coins || 0) >= (item.price.coins || 0) &&
      (this.playerProgress.shards || 0) >= (item.price.shards || 0) &&
      (this.playerProgress.tickets || 0) >= (item.price.tickets || 0)
    );
  }

  buyShopItem(itemId) {
    const item = this.shopCatalog.find((entry) => entry.id === itemId);
    if (!item) return;
    if (this.playerProgress.ownedItems.includes(itemId)) {
      this.showToast(`🧩 ${item.name} đã có trong bộ sưu tập.`);
      return;
    }
    if (!this.canAffordItem(item)) {
      this.showToast("⚠️ Không đủ tài nguyên để mua vật phẩm này.");
      return;
    }

    this.playerProgress.coins -= item.price.coins || 0;
    this.playerProgress.shards -= item.price.shards || 0;
    this.playerProgress.tickets -= item.price.tickets || 0;
    this.playerProgress.ownedItems.push(itemId);
    this.playerProgress.seasonXp += 20;
    this.addPlayerXp(25);
    this.savePlayerProgress();
    this.renderPlayerProgress();
    this.renderShopItems();
    this.renderEmoteLoadout();
    this.showToast(`✅ Đã mua ${item.name}!`);
  }

  toggleShopEmote(itemId) {
    const loadout = [...this.playerProgress.equippedEmotes];
    const equippedIndex = loadout.indexOf(itemId);
    if (equippedIndex >= 0) {
      loadout[equippedIndex] = "";
    } else {
      const emptySlot = loadout.findIndex((id) => !id);
      if (emptySlot < 0) {
        this.showToast("Đã trang bị đủ 4 biểu cảm. Hãy đổi ô ở sảnh.");
        return;
      }
      loadout[emptySlot] = itemId;
    }
    this.playerProgress.equippedEmotes = loadout;
    this.savePlayerProgress();
    this.renderEmoteLoadout();
    this.renderEmoteHotbar();
    this.renderShopItems();
  }

  equipShopItem(itemId) {
    const item = this.shopCatalog.find((entry) => entry.id === itemId);
    if (!item || item.type !== "skin" || !this.playerProgress.ownedItems.includes(itemId)) return;
    this.playerProgress.equippedSkin = itemId;
    this.selectedColor = item.color || this.selectedColor;
    this.savePlayerProgress();
    this.renderSnakeStats();
    this.updateAvatarPreview();
    this.renderShopItems();
    this.showToast(`✅ Đã trang bị ${item.name}!`);
  }

  renderShopItems() {
    if (!this.shopGrid) return;
    this.shopGrid.innerHTML = "";
    const allCount = this.modalShop?.querySelector('[data-category="all"] span');
    if (allCount) allCount.textContent = String(this.shopCatalog.length);
    const items = this.shopCategory === "all"
      ? this.shopCatalog
      : this.shopCatalog.filter((item) => item.category === this.shopCategory);
    items.forEach((item) => {
      const owned = this.playerProgress.ownedItems.includes(item.id);
      const affordable = this.canAffordItem(item);
      const equipped = this.playerProgress.equippedSkin === item.id;
      const emoteEquipped = this.playerProgress.equippedEmotes.includes(item.id);
      const buttonLabel = item.type === "emote" && owned
        ? emoteEquipped ? "Đang dùng · gỡ" : "Trang bị"
        : item.type === "skin" && owned
        ? equipped ? "Đang trang bị" : "Trang bị"
        : owned ? "Đã sở hữu" : affordable ? "Mua vật phẩm" : "Thiếu tài nguyên";
      const buttonAction = item.type === "emote" && owned
        ? "emote"
        : item.type === "skin" && owned ? "equip" : "buy";
      const disabled = item.type === "emote" && owned
        ? false
        : item.type === "skin" && owned ? equipped : owned || !affordable;
      const card = document.createElement("div");
      card.className = `shop-item-card rarity-${item.rarity.toLowerCase()}`;
      card.innerHTML = `
        <div class="shop-item-top">
          <span class="shop-item-badge ${item.rarity.toLowerCase()}">${item.rarity}</span>
          <span class="shop-item-type">${item.type === "skin" ? "Ngoại hình" : item.type === "trail" ? "Vệt sáng" : item.type === "emote" ? "Biểu cảm" : "Hỗ trợ"}</span>
        </div>
        <div class="shop-item-art" style="--item-color: ${item.color || "#ffb84d"}" aria-hidden="true"><span>${item.icon || "✨"}</span></div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-bonus">${item.bonus}</div>
        <p class="shop-item-desc">${item.description}</p>
        <div class="shop-item-price">
          ${item.price.coins ? `<span>🪙 ${item.price.coins}</span>` : ""}
          ${item.price.shards ? `<span>💎 ${item.price.shards}</span>` : ""}
          ${item.price.tickets ? `<span>🎫 ${item.price.tickets}</span>` : ""}
        </div>
        <button class="btn-buy-item" data-action="${buttonAction}" data-item-id="${item.id}" ${disabled ? "disabled" : ""}>
          ${buttonLabel}
        </button>
      `;
      this.shopGrid.appendChild(card);
    });

    this.shopGrid.querySelectorAll(".btn-buy-item").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.action === "emote") this.toggleShopEmote(button.dataset.itemId);
        else if (button.dataset.action === "equip") this.equipShopItem(button.dataset.itemId);
        else this.buyShopItem(button.dataset.itemId);
      });
    });
  }

  setShopCategory(category) {
    this.shopCategory = category;
    this.modalShop?.querySelectorAll(".shop-category-button").forEach((button) => {
      const active = button.dataset.category === category;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    this.renderShopItems();
  }

  openShopModal() {
    if (!this.modalShop) return;
    this.renderShopItems();
    this.renderPlayerProgress();
    this.modalShop.classList.remove("hidden");
  }

  closeShopModal() {
    if (this.modalShop) this.modalShop.classList.add("hidden");
  }

  saveCareerStats(score = 0, kills = 0) {
    if (score > this.careerStats.highScore) {
      this.careerStats.highScore = score;
    }
    this.careerStats.totalKills += kills || 0;
    this.careerStats.matchesPlayed += 1;
    try {
      localStorage.setItem(
        "snake_career_stats",
        JSON.stringify(this.careerStats),
      );
    } catch (e) {
      console.warn("Could not save career stats:", e);
    }

    if (this.currentUser) {
      if (score > this.currentUser.highScore) {
        this.currentUser.highScore = score;
      }
      this.currentUser.totalKills += kills || 0;
      this.currentUser.matchesPlayed += 1;
      this.currentUser.tier = this.getTierName(this.currentUser.highScore);
    }

    this.advanceQuestProgress("daily", "daily-win", 1);
    if (this.activeGameMode === "ranked") {
      this.advanceQuestProgress("daily", "daily-rank", 1);
    }
    this.advanceQuestProgress("weekly", "weekly-match", 1);
    this.addPlayerXp(Math.max(20, Math.floor(score / 80) + kills * 4));
    this.updateCareerUI();
  }

  getTierName(score) {
    if (score >= 7000) return "👑 Thách Đấu";
    if (score >= 3500) return "💎 Kim Cương";
    if (score >= 1500) return "🥇 Vàng";
    if (score >= 500) return "🥈 Bạc";
    return "🥉 Đồng";
  }

  getSelectedMapIdForMode() {
    if (this.selectedGameMode === "ranked") {
      const pool = this.mapPresets.map((map) => map.id);
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return this.selectedMapId || "neon-grid";
  }

  getSoloRulePreset() {
    const presets = {
      classic: { roundDuration: 600, foodCount: 500 },
      speed: { roundDuration: 420, foodCount: 600 },
      long: { roundDuration: 900, foodCount: 520 },
    };
    return presets[this.selectedSoloRule] || presets.classic;
  }

  initDOM() {
    this.canvas = document.getElementById("game-canvas");
    this.minimapCanvas = document.getElementById("minimap-canvas");
    this.confettiCanvas = document.getElementById("confetti-canvas");

    // Overlays & Modals
    this.screenLobby = document.getElementById("screen-lobby");
    this.modalDeath = document.getElementById("modal-death");
    this.modalMatchOver = document.getElementById("modal-match-over");
    this.modalSoloRoom = document.getElementById("modal-solo-room");
    this.modalAuth = document.getElementById("modal-auth");
    this.modalFriends = document.getElementById("modal-friends");
    this.modalShop = document.getElementById("modal-shop");
    this.modalProfileCard = document.getElementById("modal-profile-card");
    this.invitePromptBox = document.getElementById("invite-prompt-box");
    this.toastContainer = document.getElementById("toast-container");

    // Lobby Elements
    this.inputName = document.getElementById("player-name");
    this.btnJoin = document.getElementById("btn-join");
    this.btnOpenShop = document.getElementById("btn-open-shop");
    this.btnCloseShop = document.getElementById("btn-close-shop");
    this.btnEmoteShop = document.getElementById("btn-emote-shop");
    this.emoteLoadout = document.getElementById("emote-loadout");
    this.emoteLoadoutCount = document.getElementById("emote-loadout-count");
    this.shopGrid = document.getElementById("shop-grid");
    this.currencyCoins = document.getElementById("currency-coins");
    this.currencyShards = document.getElementById("currency-shards");
    this.currencyTickets = document.getElementById("currency-tickets");
    this.accountLevelBadge = document.getElementById("account-level-badge");
    this.accountXpText = document.getElementById("account-xp-text");
    this.accountRankText = document.getElementById("account-rank-text");
    this.accountXpBar = document.getElementById("account-xp-bar");
    this.shopCoins = document.getElementById("shop-coins");
    this.shopShards = document.getElementById("shop-shards");
    this.shopTickets = document.getElementById("shop-tickets");
    this.mapOptions = document.querySelectorAll(".map-option");
    this.soloRuleOptions = document.querySelectorAll(".solo-rule-option");
    this.soloRoomRulesPanel = document.getElementById("solo-room-rules");
    this.battlePassFill = document.getElementById("battle-pass-fill");
    this.battlePassGrid = document.getElementById("battle-pass-grid");
    this.battlePassLevelLabel = document.getElementById("battle-pass-level-label");
    this.questList = document.getElementById("quest-list");
    this.btnBattlePassPremium = document.getElementById("btn-battle-pass-premium");
    this.snakeLevelBadge = document.getElementById("snake-level-badge");
    this.statSpeed = document.getElementById("stat-speed");
    this.statBoost = document.getElementById("stat-boost");
    this.statMagnet = document.getElementById("stat-magnet");
    this.statShield = document.getElementById("stat-shield");
    this.snakeUpgradeCost = document.getElementById("snake-upgrade-cost");
    this.btnUpgradeSnake = document.getElementById("btn-upgrade-snake");
    this.modeSolo5v5 = document.getElementById("mode-solo5v5");
    this.soloRoomEntry = document.getElementById("solo-room-entry");
    this.inputSoloRoomCode = document.getElementById("input-solo-room-code");
    this.btnSoloRoomJoin = document.getElementById("btn-solo-room-join");
    this.lobbyInviteBox = document.getElementById("lobby-invite-box");
    this.btnSoloRoomLeave = document.getElementById("btn-solo-room-leave");
    this.soloRoomCodeLabel = document.getElementById("solo-room-code-label");
    this.btnSoloRoomCopy = document.getElementById("btn-solo-room-copy");
    this.btnSoloRoomInvite = document.getElementById("btn-solo-room-invite");
    this.soloRedCount = document.getElementById("solo-red-count");
    this.soloBlueCount = document.getElementById("solo-blue-count");
    this.soloRedRoster = document.getElementById("solo-red-roster");
    this.soloBlueRoster = document.getElementById("solo-blue-roster");
    this.btnSoloTeamRed = document.getElementById("btn-solo-team-red");
    this.btnSoloTeamBlue = document.getElementById("btn-solo-team-blue");
    this.soloRoomStatus = document.getElementById("solo-room-status");
    this.btnSoloRoomStart = document.getElementById("btn-solo-room-start");
    this.skinOptions = document.querySelectorAll(".skin-option");
    this.avatarPreview = document.getElementById("snake-avatar-preview");
    this.myTierBadge = document.getElementById("my-tier-badge");
    this.btnCopyInvite = document.getElementById("btn-copy-invite");
    this.btnInviteOnlineFriends = document.getElementById(
      "btn-invite-online-friends",
    );
    this.lobbyRoomCode = document.getElementById("lobby-room-code");
    this.lobbyOnlineCount = document.getElementById("lobby-online-count");
    this.btnRefreshRank = document.getElementById("btn-refresh-rank");
    this.globalRankTbody = document.getElementById("global-rank-tbody");
    this.btnLobbySound = document.getElementById("btn-lobby-sound");

    // Friends Hub Button in Header
    this.btnOpenFriends = document.getElementById("btn-open-friends");
    this.friendsBadgeOnline = document.getElementById("friends-badge-online");
    this.btnLobbyPlayView = document.getElementById("btn-lobby-play-view");
    this.btnLobbyChatView = document.getElementById("btn-lobby-chat-view");
    this.lobbySocialBadge = document.getElementById("lobby-social-badge");

    // Account Widget Elements
    this.btnOpenAuth = document.getElementById("btn-open-auth");
    this.userLoggedBox = document.getElementById("user-logged-box");
    this.loggedUsername = document.getElementById("logged-username");
    this.loggedTier = document.getElementById("logged-tier");
    this.btnLogout = document.getElementById("btn-logout");
    this.guestNotice = document.getElementById("guest-notice");
    this.linkCreateAcc = document.getElementById("link-create-acc");

    // Auth Modal Elements
    this.btnCloseAuth = document.getElementById("btn-close-auth");
    this.tabLogin = document.getElementById("tab-login");
    this.tabRegister = document.getElementById("tab-register");
    this.authForm = document.getElementById("auth-form");
    this.authInputUsername = document.getElementById("auth-input-username");
    this.authInputPassword = document.getElementById("auth-input-password");
    this.authErrorMsg = document.getElementById("auth-error-msg");
    this.btnSubmitAuth = document.getElementById("btn-submit-auth");

    // Career Stats Elements
    this.myHighScoreEl = document.getElementById("my-high-score");
    this.myTotalKillsEl = document.getElementById("my-total-kills");
    this.myMatchesCountEl = document.getElementById("my-matches-count");

    // In-Game HUD Elements
    this.timerEl = document.getElementById("match-timer");
    this.playerCountEl = document.getElementById("player-count");
    this.teamSideBadge = document.getElementById("team-side-badge");
    this.leaderboardEl = document.getElementById("leaderboard-list");
    this.leaderboardPanel = document.getElementById("leaderboard-panel");
    this.leaderboardToggle = document.getElementById("leaderboard-toggle");
    this.killFeedEl = document.getElementById("kill-feed");
    this.statLengthEl = document.getElementById("stat-length");
    this.statScoreEl = document.getElementById("stat-score");
    this.statKillsEl = document.getElementById("stat-kills");

    // In-Game Buttons
    this.btnHudLobby = document.getElementById("btn-hud-lobby");
    this.btnMute = document.getElementById("btn-mute");
    this.btnTouchBoost = document.getElementById("btn-touch-boost");
    this.btnRespawn = document.getElementById("btn-respawn");
    this.btnDeathLobby = document.getElementById("btn-death-lobby");

    // Power-up Skill Hotbar
    this.btnSkillNitro = document.getElementById("btn-skill-nitro");
    this.emoteHotbar = document.getElementById("emote-hotbar");
    this.btnSkillVision = document.getElementById("btn-skill-vision");
    this.btnSkillMagnet = document.getElementById("btn-skill-magnet");
    this.stockNitro = document.getElementById("stock-nitro");
    this.stockVision = document.getElementById("stock-vision");
    this.stockMagnet = document.getElementById("stock-magnet");
    this.cdNitro = document.getElementById("cd-nitro");
    this.cdVision = document.getElementById("cd-vision");
    this.cdMagnet = document.getElementById("cd-magnet");

    // Death Modal Stats
    this.deathReasonEl = document.getElementById("death-reason");
    this.deathScoreEl = document.getElementById("death-score");
    this.deathKillsEl = document.getElementById("death-kills");

    // ================= ENHANCED MATCH OVER DOM =================
    this.matchOverCard = document.querySelector(".match-over-card");
    this.matchOverTrophy = document.getElementById("match-over-trophy");
    this.matchOverTitle = document.getElementById("match-over-title");
    this.matchOverSubtitle = document.getElementById("match-over-subtitle");
    this.matchOverMode = document.getElementById("match-over-mode");
    this.matchOverRoom = document.getElementById("match-over-room");
    this.soloResultPanel = document.getElementById("solo-result-panel");
    this.soloRedResultScore = document.getElementById("solo-red-result-score");
    this.soloBlueResultScore = document.getElementById(
      "solo-blue-result-score",
    );
    this.soloWinnerBanner = document.getElementById("solo-winner-banner");
    this.podiumFirst = document.getElementById("podium-first");
    this.podiumSecond = document.getElementById("podium-second");
    this.podiumThird = document.getElementById("podium-third");
    this.perfRecordBadge = document.getElementById("perf-new-record");
    this.perfRank = document.getElementById("perf-rank");
    this.perfScore = document.getElementById("perf-score");
    this.perfKills = document.getElementById("perf-kills");
    this.perfLength = document.getElementById("perf-length");
    this.matchScoreboardTbody = document.getElementById(
      "match-scoreboard-tbody",
    );
    this.intermissionTimeEl = document.getElementById("intermission-time");
    this.intermissionProgressBar = document.getElementById(
      "intermission-progress-bar",
    );
    this.btnMatchoverReady = document.getElementById("btn-matchover-ready");
    this.btnMatchoverShare = document.getElementById("btn-matchover-share");
    this.btnMatchoverLobby = document.getElementById("btn-matchover-lobby");

    // ================= FRIENDS MODAL DOM =================
    this.btnCloseFriends = document.getElementById("btn-close-friends");
    this.tabBtnFriends = document.getElementById("tab-btn-friends");
    this.tabBtnRequests = document.getElementById("tab-btn-requests");
    this.tabBtnSearch = document.getElementById("tab-btn-search");
    this.tabBtnLobbychat = document.getElementById("tab-btn-lobbychat");
    this.friendsTabCount = document.getElementById("friends-tab-count");
    this.requestsTabBadge = document.getElementById("requests-tab-badge");

    this.tabContentFriends = document.getElementById("tab-content-friends");
    this.tabContentRequests = document.getElementById("tab-content-requests");
    this.tabContentSearch = document.getElementById("tab-content-search");
    this.tabContentLobbychat = document.getElementById("tab-content-lobbychat");

    this.friendsListContainer = document.getElementById(
      "friends-list-container",
    );
    this.requestsListContainer = document.getElementById(
      "requests-list-container",
    );
    this.searchResultsContainer = document.getElementById(
      "search-results-container",
    );
    this.inputSearchFriend = document.getElementById("input-search-friend");
    this.btnSearchFriendSubmit = document.getElementById(
      "btn-search-friend-submit",
    );

    // Lobby Chat DOM
    this.lobbyChatMessagesEl = document.getElementById("lobby-chat-messages");
    this.lobbyChatForm = document.getElementById("lobby-chat-form");
    this.inputLobbyChat = document.getElementById("input-lobby-chat");
    this.lobbyQuickEmojis = document.getElementById("lobby-quick-emojis");

    // Private Chat Drawer DOM
    this.privateChatDrawer = document.getElementById("private-chat-drawer");
    this.btnBackFromChat = document.getElementById("btn-back-from-chat");
    this.btnClosePrivateChat = document.getElementById(
      "btn-close-private-chat",
    );
    this.privateChatAvatar = document.getElementById("private-chat-avatar");
    this.privateChatName = document.getElementById("private-chat-name");
    this.privateChatStatus = document.getElementById("private-chat-status");
    this.privateChatMessagesEl = document.getElementById(
      "private-chat-messages",
    );
    this.privateChatForm = document.getElementById("private-chat-form");
    this.inputPrivateChat = document.getElementById("input-private-chat");
    this.privateQuickEmojis = document.getElementById("private-quick-emojis");

    // Profile Card DOM
    this.btnCloseProfile = document.getElementById("btn-close-profile");
    this.profileCardAvatar = document.getElementById("profile-card-avatar");
    this.profileCardStatusBadge = document.getElementById(
      "profile-card-status-badge",
    );
    this.profileCardName = document.getElementById("profile-card-name");
    this.profileCardTier = document.getElementById("profile-card-tier");
    this.profileCardScore = document.getElementById("profile-card-score");
    this.profileCardKills = document.getElementById("profile-card-kills");
    this.profileCardMatches = document.getElementById("profile-card-matches");
    this.profileCardFriends = document.getElementById("profile-card-friends");
    this.profileCardActions = document.getElementById("profile-card-actions");

    // Game Invite Prompt DOM
    this.invitePromptSender = document.getElementById("invite-prompt-sender");
    this.invitePromptRoom = document.getElementById("invite-prompt-room");
    this.btnInviteAccept = document.getElementById("btn-invite-accept");
    this.btnInviteDecline = document.getElementById("btn-invite-decline");
  }

  initRenderer() {
    this.renderer = new GameRenderer(this.canvas, this.minimapCanvas);
  }

  initInput() {
    this.inputManager = new InputManager(this.canvas);
    this.inputManager.onInputChange = (input) => {
      this.currentInput = input;
      this.sendInputIfChanged();
    };
    this.inputManager.onUseSkill = (skillType) => {
      this.usePowerup(skillType);
    };
  }

  async initLobby() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");
    if (roomParam) {
      this.roomCode = roomParam.toUpperCase();
      if (this.lobbyRoomCode) {
        this.lobbyRoomCode.textContent = `#${this.roomCode}`;
      }
    }

    await this.checkAuth();

    if (!this.currentUser) {
      const savedName = localStorage.getItem("snake_player_name");
      if (savedName && this.inputName) {
        this.inputName.value = savedName;
      }
    }

    this.updateCareerUI();
    this.updateAvatarPreview();
    this.renderEmoteLoadout();
    this.renderEmoteHotbar();
    if (this.currentUser) {
      this.connectWebSocket();
    }
    const modeParam = urlParams.get("mode");
    if (["casual", "ranked", "solo5v5"].includes(modeParam)) {
      this.setGameMode(modeParam, false);
    }
    if (roomParam && this.inputSoloRoomCode) {
      this.inputSoloRoomCode.value = this.roomCode;
    }
  }

  setGameMode(mode, showToast = true) {
    if (!["ranked", "casual", "solo5v5"].includes(mode)) return;
    this.selectedGameMode = mode;
    document.querySelectorAll(".mode-select-card").forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const joinLabel = document.getElementById("join-mode-label");
    if (joinLabel) {
      joinLabel.textContent = {
        ranked: "VÀO XẾP HẠNG",
        casual: "VÀO ĐẤU THƯỜNG",
        solo5v5: "TẠO PHÒNG SOLO 5V5",
      }[mode];
    }
    if (this.soloRoomEntry) {
      this.soloRoomEntry.classList.toggle("hidden", mode !== "solo5v5");
    }
    if (this.soloRoomRulesPanel) {
      this.soloRoomRulesPanel.classList.toggle("hidden", mode !== "solo5v5");
    }
    if (this.lobbyInviteBox) {
      this.lobbyInviteBox.classList.toggle("hidden", mode === "solo5v5");
    }
    if (
      showToast &&
      this.screenLobby &&
      !this.screenLobby.classList.contains("hidden")
    ) {
      const messages = {
        ranked: "🏆 Đã chọn hàng chờ xếp hạng.",
        casual: "🌿 Đã chọn đấu thường, không ảnh hưởng điểm rank.",
        solo5v5: "🛡️ Chọn tạo phòng hoặc nhập mã phòng Solo 5v5.",
      };
      this.showToast(messages[mode]);
    }
  }

  sendSoloRoomCommand(type, extra = {}) {
    if (!this.currentUser) {
      this.openAuthModal("login");
      return;
    }

    const send = () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.showToast("⚠️ Chưa kết nối máy chủ. Vui lòng thử lại.");
        return;
      }
      this.ws.send(
        JSON.stringify({
          type,
          token: this.authToken,
          ...extra,
        }),
      );
    };

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket(send);
    } else {
      send();
    }
  }

  createSoloRoom() {
    this.setGameMode("solo5v5", false);
    this.sendSoloRoomCommand("SOLO_ROOM_CREATE");
  }

  joinSoloRoom(roomCode) {
    const normalizedCode = (roomCode || "").trim().toUpperCase();
    if (!normalizedCode) {
      this.showToast("Nhập mã phòng Solo 5v5 trước nhé.");
      this.inputSoloRoomCode?.focus();
      return;
    }
    this.roomCode = normalizedCode;
    this.setGameMode("solo5v5", false);
    this.sendSoloRoomCommand("SOLO_ROOM_JOIN", { roomCode: normalizedCode });
  }

  renderSoloRoomState(state) {
    if (!state) return;
    this.soloRoomState = state;
    this.roomCode = state.roomCode;
    if (this.soloRoomCodeLabel) {
      this.soloRoomCodeLabel.textContent = state.roomCode;
    }
    if (this.inputSoloRoomCode) {
      this.inputSoloRoomCode.value = state.roomCode;
    }
    if (this.lobbyRoomCode) {
      this.lobbyRoomCode.textContent = `#${state.roomCode}`;
    }

    const red = state.red || [];
    const blue = state.blue || [];
    if (this.soloRedCount) this.soloRedCount.textContent = `${red.length} / 5`;
    if (this.soloBlueCount)
      this.soloBlueCount.textContent = `${blue.length} / 5`;

    const renderRoster = (container, members, teamId) => {
      if (!container) return;
      container.replaceChildren();
      if (members.length === 0) {
        const empty = document.createElement("span");
        empty.className = "solo-roster-empty";
        empty.textContent = "Đang chờ người chơi...";
        container.appendChild(empty);
        return;
      }
      for (const member of members) {
        const row = document.createElement("div");
        row.className = `solo-roster-player${member.isHost ? " host" : ""}`;
        const name = document.createElement("span");
        name.textContent =
          member.socketId === this.socketId
            ? `${member.username} (Bạn)`
            : member.username;
        row.appendChild(name);
        container.appendChild(row);
      }
    };

    renderRoster(this.soloRedRoster, red, "red");
    renderRoster(this.soloBlueRoster, blue, "blue");

    const myMember = [...red, ...blue].find(
      (member) => member.socketId === this.socketId,
    );
    if (this.btnSoloTeamRed) {
      this.btnSoloTeamRed.disabled =
        myMember?.teamId === "red" || red.length >= 5;
      this.btnSoloTeamRed.textContent =
        myMember?.teamId === "red" ? "Bạn đang ở Đội Đỏ" : "Chọn Đội Đỏ";
    }
    if (this.btnSoloTeamBlue) {
      this.btnSoloTeamBlue.disabled =
        myMember?.teamId === "blue" || blue.length >= 5;
      this.btnSoloTeamBlue.textContent =
        myMember?.teamId === "blue" ? "Bạn đang ở Đội Xanh" : "Chọn Đội Xanh";
    }

    const isHost = state.hostSocketId === this.socketId;
    const canStart = isHost && state.canStart;
    if (this.btnSoloRoomStart) this.btnSoloRoomStart.disabled = !canStart;
    if (this.soloRoomStatus) {
      if (state.canStart) {
        this.soloRoomStatus.textContent = isHost
          ? "Đội hình hợp lệ. Chủ phòng có thể bắt đầu trận."
          : "Đội hình đã đủ. Đang chờ chủ phòng bắt đầu.";
      } else {
        const minSize = state.minTeamSize || 2;
        const redMissing = Math.max(0, minSize - red.length);
        const blueMissing = Math.max(0, minSize - blue.length);
        this.soloRoomStatus.textContent = `Cần thêm ${redMissing} người đội Đỏ và ${blueMissing} người đội Xanh.`;
      }
    }
  }

  leaveSoloRoom() {
    this.sendSoloRoomCommand("SOLO_ROOM_LEAVE");
  }

  startSoloRoom() {
    if (!this.soloRoomState) return;
    this.sendSoloRoomCommand("SOLO_ROOM_START", {
      roomCode: this.soloRoomState.roomCode,
    });
  }

  copySoloRoomInvite() {
    if (!this.roomCode) return;
    const invite = new URL(window.location.href);
    invite.searchParams.set("room", this.roomCode);
    invite.searchParams.set("mode", "solo5v5");
    navigator.clipboard
      ?.writeText(invite.toString())
      .then(() => this.showToast("Đã sao chép link mời Solo 5v5."))
      .catch(() => this.showToast(`Mã phòng: ${this.roomCode}`));
  }

  async checkAuth() {
    if (!this.authToken) {
      this.applyLoggedOutUI();
      return;
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${this.authToken}` },
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.currentUser = data.user;
        this.applyLoggedInUI(data.user);
      } else {
        localStorage.removeItem("snake_auth_token");
        this.authToken = null;
        this.applyLoggedOutUI();
      }
    } catch (e) {
      console.warn("Check auth error:", e);
      this.applyLoggedOutUI();
    }
  }

  applyLoggedInUI(user) {
    document.body.classList.remove("account-required");
    this.screenLobby.classList.remove("hidden");
    this.modalAuth.classList.add("hidden");
    if (this.btnOpenAuth) this.btnOpenAuth.classList.add("hidden");
    if (this.userLoggedBox) this.userLoggedBox.classList.remove("hidden");
    if (this.guestNotice) this.guestNotice.classList.add("hidden");

    if (this.loggedUsername) this.loggedUsername.textContent = user.username;
    if (this.loggedTier) this.loggedTier.textContent = user.tier || "Đồng 🥉";

    if (this.inputName) {
      this.inputName.value = user.username;
      this.inputName.disabled = true;
      this.inputName.title = "Tài khoản cố định đã được xác thực";
    }

    if (this.myTierBadge) {
      this.myTierBadge.textContent = `${user.tier || "🥉 Đồng"}`;
    }

    if (user.skin) {
      this.selectedColor = user.skin;
      this.skinOptions.forEach((opt) => {
        opt.classList.toggle("active", opt.dataset.color === user.skin);
      });
      this.updateAvatarPreview();
    }

    this.updateCareerUI();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "LOBBY_AUTH",
          token: this.authToken,
        }),
      );
    }
  }

  applyLoggedOutUI() {
    document.body.classList.add("account-required");
    this.screenLobby.classList.add("hidden");
    this.openAuthModal("register");
    if (this.btnOpenAuth) this.btnOpenAuth.classList.remove("hidden");
    if (this.userLoggedBox) this.userLoggedBox.classList.add("hidden");
    if (this.guestNotice) this.guestNotice.classList.remove("hidden");
    if (this.inputName) {
      this.inputName.disabled = false;
      this.inputName.title = "";
    }
    this.updateCareerUI();
    this.friends = [];
    this.friendRequests = [];
    this.updateFriendsBadge();
  }

  updateCareerUI() {
    const stats = this.currentUser
      ? {
          highScore: this.currentUser.highScore || 0,
          totalKills: this.currentUser.totalKills || 0,
          matchesPlayed: this.currentUser.matchesPlayed || 0,
          tier: this.currentUser.tier || "Đồng 🥉",
        }
      : {
          highScore: this.careerStats.highScore || 0,
          totalKills: this.careerStats.totalKills || 0,
          matchesPlayed: this.careerStats.matchesPlayed || 0,
          tier: this.getTierName(this.careerStats.highScore || 0),
        };

    if (this.myHighScoreEl)
      this.myHighScoreEl.textContent = stats.highScore.toLocaleString();
    if (this.myTotalKillsEl)
      this.myTotalKillsEl.textContent = stats.totalKills.toLocaleString();
    if (this.myMatchesCountEl)
      this.myMatchesCountEl.textContent = stats.matchesPlayed.toLocaleString();
    if (this.myTierBadge) this.myTierBadge.textContent = stats.tier;

    this.renderPlayerProgress();
  }

  updateAvatarPreview() {
    if (!this.avatarPreview) return;
    this.avatarPreview.style.background = `radial-gradient(circle, ${this.selectedColor}, #050811)`;
    this.avatarPreview.style.boxShadow = `0 0 20px ${this.selectedColor}`;
  }

  showToast(message, duration = 3200) {
    if (!this.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "custom-toast";
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, duration);
  }

  // ================= WEBSOCKET & NETWORK =================

  connectWebSocket(onOpenCallback = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (typeof onOpenCallback === "function") onOpenCallback();
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("[Client] Connected to server socket.");
      const playerName = this.currentUser
        ? this.currentUser.username
        : this.inputName.value.trim() || "Viper";

      this.ws.send(
        JSON.stringify({
          type: "LOBBY_AUTH",
          token: this.authToken || null,
          guestName: playerName,
        }),
      );

      if (typeof onOpenCallback === "function") onOpenCallback();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleServerMessage(msg);
      } catch (e) {
        console.error("[Client] Message parse error:", e);
      }
    };

    this.ws.onclose = () => {
      console.warn("[Client] Disconnected. Reconnecting in 2s...");
      if (this.currentUser) {
        setTimeout(() => this.connectWebSocket(), 2000);
      }
    };

    this.ws.onerror = (err) => {
      console.error("[Client] WebSocket error:", err);
    };
  }

  handleServerMessage(msg) {
    switch (msg.type) {
      case "SOCKET_READY":
        this.socketId = msg.socketId;
        if (msg.leaderboard) this.renderGlobalLeaderboard(msg.leaderboard);
        if (msg.lobbyChat) this.renderLobbyChatHistory(msg.lobbyChat);
        break;

      case "SOLO_ROOM_READY":
        this.activeGameMode = "solo5v5";
        this.roomCode = msg.roomCode;
        if (this.lobbyRoomCode) {
          this.lobbyRoomCode.textContent = `#${this.roomCode}`;
        }
        if (this.inputSoloRoomCode) {
          this.inputSoloRoomCode.value = this.roomCode;
        }
        this.screenLobby.classList.add("hidden");
        this.modalSoloRoom.classList.remove("hidden");
        if (msg.state) this.renderSoloRoomState(msg.state);
        break;

      case "SOLO_ROOM_STATE":
        this.renderSoloRoomState(msg.state);
        break;

      case "SOLO_ROOM_ERROR":
        this.showToast(`⚠️ ${msg.error || "Không thể thao tác phòng Solo."}`);
        break;

      case "SOLO_ROOM_LEFT":
        this.soloRoomState = null;
        this.modalSoloRoom.classList.add("hidden");
        this.screenLobby.classList.remove("hidden");
        this.setGameMode("solo5v5", false);
        break;

      case "JOIN_REJECTED":
        this.screenLobby.classList.remove("hidden");
        this.showToast(msg.error || "Bạn cần đăng nhập để tham gia trận đấu.");
        if (!this.currentUser) this.openAuthModal("register");
        break;

      case "AUTH_SUCCESS":
        if (msg.friends) {
          this.friends = msg.friends;
          this.renderFriendsList();
        }
        if (msg.requests) {
          this.friendRequests = msg.requests;
          this.renderFriendRequests();
        }
        this.friendsDataLoaded = true;
        this.updateFriendsBadge();
        break;

      case "INIT_GAME":
        this.localPlayerId = msg.playerId;
        this.activeGameMode = msg.mode || this.selectedGameMode;
        if (msg.roomCode) this.roomCode = msg.roomCode;
        if (this.modalSoloRoom) this.modalSoloRoom.classList.add("hidden");
        this.screenLobby.classList.add("hidden");
        if (this.teamSideBadge) {
          const isSolo = this.activeGameMode === "solo5v5" && msg.teamId;
          this.teamSideBadge.classList.toggle("hidden", !isSolo);
          this.teamSideBadge.classList.toggle("red", msg.teamId === "red");
          this.teamSideBadge.classList.toggle("blue", msg.teamId === "blue");
          this.teamSideBadge.textContent =
            msg.teamId === "red" ? "ĐỘI ĐỎ" : "ĐỘI XANH";
        }
        this.arenaRadius = msg.arenaRadius || 2200;
        this.foods.clear();
        if (msg.foods) {
          for (let i = 0; i < msg.foods.length; i++) {
            this.foods.set(msg.foods[i].id, msg.foods[i]);
          }
        }
        if (msg.powerups) {
          this.powerups = msg.powerups;
        }
        break;

      case "GAME_TICK":
        this.updateGameState(msg);
        break;

      case "PLAYER_EMOTE":
        this.renderer.showEmote(msg.playerId, msg.emoteId, msg.duration);
        break;

      case "YOU_DIED":
        window.soundEngine.playDeath();
        if (this.activeGameMode === "ranked") {
          this.saveCareerStats(msg.score, msg.kills);
        }
        this.showDeathModal(msg);
        break;

      case "KILL_EVENTS":
        this.handleKillEvents(msg.events);
        break;

      case "MATCH_OVER":
        this.showMatchOverModal(msg.rankings, msg.intermissionDuration, msg);
        break;

      case "MATCH_STARTED":
        this.modalMatchOver.classList.add("hidden");
        this.modalDeath.classList.add("hidden");
        this.stopConfetti();
        if (msg.foods) {
          this.foods.clear();
          for (const f of msg.foods) {
            this.foods.set(f.id, f);
          }
        }
        if (msg.powerups) {
          this.powerups = msg.powerups;
        }
        break;

      case "GLOBAL_LEADERBOARD":
        if (msg.leaderboard) {
          this.renderGlobalLeaderboard(msg.leaderboard);
        }
        break;

      // ================= SOCIAL EVENTS =================
      case "FRIEND_REQUEST_RECEIVED":
        window.soundEngine.playNotification();
        this.friendRequests.unshift(msg);
        this.renderFriendRequests();
        this.updateFriendsBadge();
        this.showToast(`🔔 Dũng sĩ ${msg.from} vừa gửi lời mời kết bạn!`);
        break;

      case "FRIEND_REQUEST_ACCEPTED":
        window.soundEngine.playNotification();
        if (msg.friend) {
          this.friends.unshift(msg.friend);
          this.renderFriendsList();
          this.updateFriendsBadge();
        }
        this.showToast(
          `🎉 ${msg.message || "Lời mời kết bạn đã được chấp nhận!"}`,
        );
        break;

      case "FRIEND_REQUEST_RESULT":
        if (msg.success) {
          this.showToast(`📤 ${msg.message || "Đã gửi lời mời kết bạn!"}`);
          if (msg.autoAccepted && msg.friend) {
            this.friends.unshift(msg.friend);
            this.renderFriendsList();
            this.updateFriendsBadge();
          }
        } else {
          this.showToast(`⚠️ ${msg.error || "Không thể gửi lời mời kết bạn!"}`);
        }
        break;

      case "FRIEND_PRESENCE_UPDATE":
        const targetFriend = this.friends.find(
          (f) => f.username.toLowerCase() === msg.friendName.toLowerCase(),
        );
        if (targetFriend) {
          targetFriend.status = msg.status;
          this.renderFriendsList();
          this.updateFriendsBadge();
        }
        if (
          this.activePrivateChatUser &&
          this.activePrivateChatUser.toLowerCase() ===
            msg.friendName.toLowerCase()
        ) {
          this.updatePrivateChatStatusText(msg.status);
        }
        break;

      case "FRIEND_REMOVED":
        this.friends = this.friends.filter(
          (f) => f.username.toLowerCase() !== msg.friendName.toLowerCase(),
        );
        this.renderFriendsList();
        this.updateFriendsBadge();
        break;

      case "ROOM_INVITE":
        window.soundEngine.playNotification();
        this.handleRoomInvite(msg);
        break;

      case "INVITE_RESULT":
        if (msg.success) {
          this.showToast(`⚔️ ${msg.message || "Đã gửi lời mời vào phòng!"}`);
        } else {
          this.showToast(`⚠️ ${msg.error || "Không thể gửi lời mời!"}`);
        }
        break;

      case "FRIEND_POKED":
        window.soundEngine.playPoke();
        this.showToast(`👋 ${msg.from} vừa vẫy tay chào bạn!`);
        break;

      case "POKE_RESULT":
        if (msg.success) {
          this.showToast(`👋 ${msg.message || "Đã vẫy tay!"}`);
        }
        break;

      case "PLAYER_COMMENDED":
        window.soundEngine.playLike();
        this.showToast(`❤️ Dũng sĩ ${msg.from} đã khen ngợi phong độ của bạn!`);
        break;

      case "COMMEND_RESULT":
        if (msg.success) {
          this.showToast(`❤️ ${msg.message || "Đã gửi lời khen ngợi!"}`);
        }
        break;

      case "LOBBY_CHAT_MESSAGE":
        this.appendLobbyChatMessage(msg.message);
        break;

      case "PRIVATE_CHAT_MESSAGE":
        this.handlePrivateChatMessage(msg.message);
        break;

      case "FRIEND_LIST_UPDATE":
        if (msg.friends) this.friends = msg.friends;
        if (msg.requests) this.friendRequests = msg.requests;
        this.friendsDataLoaded = true;
        this.renderFriendsList();
        this.renderFriendRequests();
        this.updateFriendsBadge();
        break;
    }
  }

  // ================= GAMEPLAY ACTIONS =================

  joinGame() {
    if (!this.currentUser) {
      this.openAuthModal("register");
      return;
    }

    if (this.selectedGameMode === "solo5v5") {
      this.advanceQuestProgress("weekly", "weekly-solo", 1);
      this.createSoloRoom();
      return;
    }

    this.activeGameMode = this.selectedGameMode;
    this.screenLobby.classList.add("hidden");
    window.soundEngine.init();

    const doJoin = () => {
      const playerName = this.currentUser
        ? this.currentUser.username
        : this.inputName.value.trim() || "Viper";
      localStorage.setItem("snake_player_name", playerName);

      this.ws.send(
        JSON.stringify({
          type: "JOIN_GAME",
          name: playerName,
          color: this.selectedColor,
          room: this.roomCode,
          token: this.authToken || null,
          mode: this.activeGameMode,
          mapId: this.getSelectedMapIdForMode(),
          soloRule: this.selectedSoloRule,
        }),
      );
    };

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket(doJoin);
    } else {
      doJoin();
    }
  }

  returnToLobby() {
    this.modalDeath.classList.add("hidden");
    this.modalMatchOver.classList.add("hidden");
    this.screenLobby.classList.remove("hidden");
    this.stopConfetti();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "LEAVE_GAME" }));
    }

    this.updateCareerUI();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "GET_GLOBAL_LEADERBOARD" }));
    } else {
      this.fetchGlobalLeaderboard();
    }
  }

  sendInputIfChanged() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const now = performance.now();
    const angleDiff =
      this.lastSentInput.angle === null
        ? 999
        : Math.abs(this.currentInput.angle - this.lastSentInput.angle);
    const boostChanged =
      this.currentInput.boosting !== this.lastSentInput.boosting;

    if (
      (boostChanged || angleDiff > 0.03) &&
      now - this.lastInputSendTime >= 40
    ) {
      this.lastInputSendTime = now;
      this.lastSentInput.angle = this.currentInput.angle;
      this.lastSentInput.boosting = this.currentInput.boosting;

      this.ws.send(
        JSON.stringify({
          type: "PLAYER_INPUT",
          angle: Number(this.currentInput.angle.toFixed(3)),
          boosting: this.currentInput.boosting,
        }),
      );
    }
  }

  usePowerup(type) {
    this.advanceQuestProgress("daily", "daily-power", 1);
    this.ws.send(
      JSON.stringify({
        type: "USE_POWERUP",
        powerup: type,
      }),
    );
  }

  updateGameState(msg) {
    if (msg.foodEaten && msg.foodEaten.length > 0) {
      for (let i = 0; i < msg.foodEaten.length; i++) {
        this.foods.delete(msg.foodEaten[i]);
      }
    }
    if (msg.foodAdded && msg.foodAdded.length > 0) {
      for (let i = 0; i < msg.foodAdded.length; i++) {
        const f = msg.foodAdded[i];
        this.foods.set(f.id, f);
      }
    }

    if (msg.powerups) {
      this.powerups = msg.powerups;
    }
    // If msg.powerups is absent, we keep the existing this.powerups (delta-only broadcast)

    this.renderer.syncServerSnakes(msg.snakes);

    const mySnake = msg.snakes.find((s) => s.id === this.localPlayerId);
    if (mySnake) {
      const prevScore = parseInt(this.statScoreEl.textContent, 10) || 0;
      if (mySnake.score > prevScore) {
        window.soundEngine.playEat();
      }
      this.statLengthEl.textContent = mySnake.length;
      this.statScoreEl.textContent = mySnake.score;
      this.statKillsEl.textContent = mySnake.kills;

      this.updateSkillHotbar(mySnake);
    }

    const mins = Math.floor(msg.timeRemaining / 60);
    const secs = msg.timeRemaining % 60;
    const timerStr = `⏱️ ${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    if (timerStr !== this.lastTimerText) {
      this.lastTimerText = timerStr;
      this.timerEl.textContent = timerStr;
      if (msg.timeRemaining <= 30 && !msg.isIntermission) {
        this.timerEl.classList.add("hurry");
      } else {
        this.timerEl.classList.remove("hurry");
      }
    }

    const activeHuman = msg.snakes.filter((s) => !s.isBot).length;
    const countStr = `👥 ${activeHuman} người chơi | ${msg.snakes.length} rắn`;
    if (countStr !== this.lastPlayerCountText) {
      this.lastPlayerCountText = countStr;
      this.playerCountEl.textContent = countStr;
      if (this.lobbyOnlineCount) {
        this.lobbyOnlineCount.textContent = `Trực tuyến: ${activeHuman} người chơi`;
      }
    }

    const now = performance.now();
    if (now - this.lastLeaderboardRender >= 250) {
      this.lastLeaderboardRender = now;
      this.renderLeaderboard(msg.leaderboard);
    }

    if (
      msg.isIntermission &&
      !this.modalMatchOver.classList.contains("hidden")
    ) {
      this.intermissionTimeEl.textContent = `Vòng đấu mới trong: ${msg.intermissionTimer}s`;
    }
  }

  updateSkillHotbar(snake) {
    if (!snake) return;
    const inv = snake.inventory || { nitro: 0, vision: 0, magnet: 0 };
    const effects = snake.activeEffects || { nitro: 0, vision: 0, magnet: 0 };

    if (this.stockNitro) this.stockNitro.textContent = inv.nitro || 0;
    if (this.btnSkillNitro) {
      this.btnSkillNitro.classList.toggle("has-stock", (inv.nitro || 0) > 0);
      this.btnSkillNitro.classList.toggle(
        "active-skill",
        (effects.nitro || 0) > 0,
      );
    }
    if (this.cdNitro) {
      const pct = effects.nitro > 0 ? (effects.nitro / 5.0) * 100 : 0;
      this.cdNitro.style.width = `${pct}%`;
    }

    if (this.stockVision) this.stockVision.textContent = inv.vision || 0;
    if (this.btnSkillVision) {
      this.btnSkillVision.classList.toggle("has-stock", (inv.vision || 0) > 0);
      this.btnSkillVision.classList.toggle(
        "active-skill",
        (effects.vision || 0) > 0,
      );
    }
    if (this.cdVision) {
      const pct = effects.vision > 0 ? (effects.vision / 8.0) * 100 : 0;
      this.cdVision.style.width = `${pct}%`;
    }

    if (this.stockMagnet) this.stockMagnet.textContent = inv.magnet || 0;
    if (this.btnSkillMagnet) {
      this.btnSkillMagnet.classList.toggle("has-stock", (inv.magnet || 0) > 0);
      this.btnSkillMagnet.classList.toggle(
        "active-skill",
        (effects.magnet || 0) > 0,
      );
    }
    if (this.cdMagnet) {
      const pct = effects.magnet > 0 ? (effects.magnet / 6.0) * 100 : 0;
      this.cdMagnet.style.width = `${pct}%`;
    }
  }

  renderLeaderboard(leaderboard) {
    if (!leaderboard) return;
    this.leaderboardEl.innerHTML = "";

    leaderboard.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "leaderboard-row";
      if (entry.id === this.localPlayerId) li.classList.add("self");
      if (entry.rank === 1) li.classList.add("rank-1");

      const isFirst = entry.rank === 1 ? "👑 " : `#${entry.rank} `;
      li.innerHTML = `
        <div class="row-left">
          <span class="row-rank">${isFirst}</span>
          <span>${entry.name}</span>
        </div>
        <span class="row-score">${entry.score}</span>
      `;
      this.leaderboardEl.appendChild(li);
    });
  }

  handleKillEvents(events) {
    if (!events) return;
    events.forEach((ev) => {
      if (ev.killerId === this.localPlayerId) {
        window.soundEngine.playKill();
      }

      const item = document.createElement("div");
      item.className = "kill-item";
      item.innerHTML = `<span class="killer-name">⚡ ${ev.killer}</span> đã hạ gục <span class="victim-name">${ev.victim}</span>!`;
      this.killFeedEl.prepend(item);

      setTimeout(() => {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 4200);
    });
  }

  showDeathModal(data) {
    this.deathReasonEl.textContent = data.reason || "Bạn đã bị tiêu diệt!";
    this.deathScoreEl.textContent = data.score || 0;
    this.deathKillsEl.textContent = data.kills || 0;
    this.modalDeath.classList.remove("hidden");
  }

  // ================= ENHANCED MATCH OVER =================

  showMatchOverModal(rankings, intermissionDuration, matchInfo = {}) {
    this.currentMatchRankings = rankings || [];
    const mode = matchInfo.mode || this.activeGameMode || "ranked";
    const modeLabels = {
      ranked: "XẾP HẠNG",
      casual: "ĐẤU THƯỜNG",
      solo5v5: "SOLO 5V5 · NGƯỜI THẬT",
    };
    if (this.matchOverCard) this.matchOverCard.dataset.mode = mode;
    if (this.matchOverMode) {
      this.matchOverMode.textContent = modeLabels[mode] || "TRẬN ĐẤU";
    }
    if (this.matchOverRoom) {
      this.matchOverRoom.textContent =
        matchInfo.roomCode || this.roomCode || "ARENA-5V5";
    }

    this.modalMatchOver.classList.remove("hidden");

    const myRankIdx = this.currentMatchRankings.findIndex(
      (r) => r.id === this.localPlayerId,
    );
    const myRank = myRankIdx !== -1 ? myRankIdx + 1 : "-";
    const myEntry =
      myRankIdx !== -1 ? this.currentMatchRankings[myRankIdx] : null;

    const teamResult = matchInfo.teamResult;
    if (this.soloResultPanel) {
      this.soloResultPanel.classList.toggle(
        "hidden",
        mode !== "solo5v5" || !teamResult,
      );
    }
    if (mode === "solo5v5" && teamResult) {
      const winnerTeam = teamResult.winnerTeam;
      const winningEntry = myEntry && myEntry.teamId === winnerTeam;
      if (this.soloRedResultScore) {
        this.soloRedResultScore.textContent = Number(
          teamResult.redScore || 0,
        ).toLocaleString();
      }
      if (this.soloBlueResultScore) {
        this.soloBlueResultScore.textContent = Number(
          teamResult.blueScore || 0,
        ).toLocaleString();
      }
      if (teamResult.redScore === teamResult.blueScore) {
        this.matchOverTrophy.textContent = "🤝";
        this.matchOverTitle.textContent = "TRẬN ĐẤU HÒA!";
        this.matchOverSubtitle.textContent =
          "Hai đội kết thúc với cùng tổng điểm.";
        if (this.soloWinnerBanner) this.soloWinnerBanner.textContent = "HÒA";
      } else {
        this.matchOverTrophy.textContent = winnerTeam === "red" ? "🔴" : "🔵";
        this.matchOverTitle.textContent =
          winnerTeam === "red"
            ? "ĐỘI ĐỎ CHIẾN THẮNG!"
            : "ĐỘI XANH CHIẾN THẮNG!";
        this.matchOverSubtitle.textContent = myEntry
          ? winningEntry
            ? "Bạn cùng đồng đội đã giành chiến thắng."
            : "Trận sau cùng đồng đội lật ngược thế trận nhé."
          : "Tổng điểm được tính từ thành tích của cả đội.";
        if (this.soloWinnerBanner) {
          this.soloWinnerBanner.textContent =
            winnerTeam === "red" ? "ĐỘI ĐỎ THẮNG" : "ĐỘI XANH THẮNG";
        }
      }
      if (winningEntry) {
        window.soundEngine.playVictoryFanfare();
        this.startConfetti();
      } else if (!teamResult.winnerTeam) {
        window.soundEngine.playMatchEnd();
      } else {
        window.soundEngine.playMatchEnd();
      }
    } else if (myRank === 1) {
      window.soundEngine.playVictoryFanfare();
      this.startConfetti();
      this.matchOverTrophy.textContent = "👑";
      this.matchOverTitle.textContent = "CHIẾN THẮNG HUY HOÀNG!";
      this.matchOverSubtitle.textContent =
        "Xuất sắc giành ngôi vương bảng đấu rắn!";
    } else if (myRank <= 3 && myRank > 1) {
      window.soundEngine.playVictoryFanfare();
      this.startConfetti();
      this.matchOverTrophy.textContent = "🏆";
      this.matchOverTitle.textContent = "ĐỨNG TRÊN BỤC VINH QUANG!";
      this.matchOverSubtitle.textContent =
        "Top 3 chiến binh xuất sắc nhất vòng đấu!";
    } else {
      window.soundEngine.playMatchEnd();
      this.matchOverTrophy.textContent = "⚔️";
      this.matchOverTitle.textContent = "KẾT THÚC HIỆP ĐẤU!";
      this.matchOverSubtitle.textContent =
        "Bảng vinh danh chiến binh và tổng kết chiến tích";
    }

    const r1 = this.currentMatchRankings[0];
    const r2 = this.currentMatchRankings[1];
    const r3 = this.currentMatchRankings[2];

    if (r1) {
      this.podiumFirst.querySelector(".podium-name").textContent = r1.name;
      this.podiumFirst.querySelector(".podium-score").textContent =
        `${r1.score.toLocaleString()} pts`;
      this.podiumFirst.querySelector(".podium-kills").textContent =
        `⚡ ${r1.kills} kills`;
    }
    if (r2) {
      this.podiumSecond.querySelector(".podium-name").textContent = r2.name;
      this.podiumSecond.querySelector(".podium-score").textContent =
        `${r2.score.toLocaleString()} pts`;
      this.podiumSecond.querySelector(".podium-kills").textContent =
        `⚡ ${r2.kills} kills`;
    } else {
      this.podiumSecond.querySelector(".podium-name").textContent = "-";
      this.podiumSecond.querySelector(".podium-score").textContent = "-";
      this.podiumSecond.querySelector(".podium-kills").textContent = "-";
    }
    if (r3) {
      this.podiumThird.querySelector(".podium-name").textContent = r3.name;
      this.podiumThird.querySelector(".podium-score").textContent =
        `${r3.score.toLocaleString()} pts`;
      this.podiumThird.querySelector(".podium-kills").textContent =
        `⚡ ${r3.kills} kills`;
    } else {
      this.podiumThird.querySelector(".podium-name").textContent = "-";
      this.podiumThird.querySelector(".podium-score").textContent = "-";
      this.podiumThird.querySelector(".podium-kills").textContent = "-";
    }

    if (myEntry) {
      this.perfRank.textContent = `#${myRank} / ${this.currentMatchRankings.length}`;
      this.perfScore.textContent = myEntry.score.toLocaleString();
      this.perfKills.textContent = myEntry.kills;
      this.perfLength.textContent = myEntry.length || 22;

      const prevBest = this.careerStats.highScore || 0;
      if (myEntry.score > prevBest && myEntry.score > 0) {
        this.perfRecordBadge.classList.remove("hidden");
      } else {
        this.perfRecordBadge.classList.add("hidden");
      }
    }

    this.renderMatchScoreboard();

    let remaining = intermissionDuration || 8;
    const totalDuration = remaining;
    this.intermissionTimeEl.textContent = `Vòng đấu mới trong: ${remaining}s`;
    if (this.intermissionProgressBar)
      this.intermissionProgressBar.style.width = "100%";

    if (this.intermissionTimerInterval)
      clearInterval(this.intermissionTimerInterval);
    this.intermissionTimerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.intermissionTimerInterval);
        return;
      }
      this.intermissionTimeEl.textContent = `Vòng đấu mới trong: ${remaining}s`;
      if (this.intermissionProgressBar) {
        const pct = (remaining / totalDuration) * 100;
        this.intermissionProgressBar.style.width = `${pct}%`;
      }
    }, 1000);
  }

  renderMatchScoreboard() {
    if (!this.matchScoreboardTbody) return;
    this.matchScoreboardTbody.innerHTML = "";

    this.currentMatchRankings.forEach((entry, idx) => {
      const tr = document.createElement("tr");
      const isSelf = entry.id === this.localPlayerId;
      if (isSelf) tr.classList.add("is-self");

      const isFriend = this.friends.some(
        (f) => f.username.toLowerCase() === entry.name.toLowerCase(),
      );
      const isLiked = this.likedPlayers.has(entry.name);
      const teamTag =
        this.activeGameMode === "solo5v5" && entry.teamId
          ? `<span class="summary-team-tag ${entry.teamId}">${entry.teamId === "red" ? "ĐỎ" : "XANH"}</span>`
          : "";

      let actionHtml = "";
      if (!isSelf) {
        if (!entry.isBot) {
          if (!isFriend) {
            actionHtml += `<button class="btn-table-action btn-add-friend" data-username="${entry.name}" title="Gửi lời mời kết bạn">🤝 Kết bạn</button>`;
          }
          actionHtml += `<button class="btn-table-action btn-like-player ${isLiked ? "liked" : ""}" data-username="${entry.name}" title="Khen thưởng dũng sĩ">❤️ Khen</button>`;
        } else {
          actionHtml += `<span style="color:#64748b; font-size: 11px;">Bot</span>`;
        }
      } else {
        actionHtml += `<span style="color:var(--primary-cyan); font-size: 11px; font-weight:800;">Bạn</span>`;
      }

      tr.innerHTML = `
        <td style="font-weight: 800; color: ${idx === 0 ? "#ffd700" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "#cbd5e1"}">#${idx + 1}</td>
        <td>
          <div class="table-player-cell">
            <span class="table-color-dot" style="background: ${entry.color || "#00f0ff"};"></span>
            <span>${entry.name}</span>
            ${teamTag}
            <span class="table-tag ${entry.isBot ? "bot" : "human"}">${entry.isBot ? "BOT" : "NGƯỜI"}</span>
          </div>
        </td>
        <td style="font-weight: 700; color: var(--primary-cyan);">${entry.score.toLocaleString()}</td>
        <td style="font-weight: 700; color: #ff3366;">${entry.kills}</td>
        <td style="color: #94a3b8;">${entry.length || 22}</td>
        <td class="table-actions-cell">${actionHtml}</td>
      `;

      this.matchScoreboardTbody.appendChild(tr);
    });

    this.matchScoreboardTbody
      .querySelectorAll(".btn-add-friend")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = btn.dataset.username;
          this.sendFriendRequest(target);
          btn.textContent = "⏳ Đã gửi";
          btn.disabled = true;
        });
      });

    this.matchScoreboardTbody
      .querySelectorAll(".btn-like-player")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = btn.dataset.username;
          this.commendPlayer(target);
          btn.classList.add("liked");
          btn.textContent = "💖 Đã khen";
          btn.disabled = true;
        });
      });
  }

  shareMatchBrag() {
    const myRankIdx = this.currentMatchRankings.findIndex(
      (r) => r.id === this.localPlayerId,
    );
    const myRank = myRankIdx !== -1 ? myRankIdx + 1 : 1;
    const myEntry =
      myRankIdx !== -1 ? this.currentMatchRankings[myRankIdx] : null;

    const score = myEntry ? myEntry.score : 0;
    const kills = myEntry ? myEntry.kills : 0;
    const myName = this.currentUser ? this.currentUser.username : "Dũng sĩ";

    const bragText = `🐍 [Snake Arena 5v5] ${myName} vừa đạt Top #${myRank} với ${score.toLocaleString()} điểm và ${kills} kills tại phòng #${this.roomCode}! Thách thức tôi ngay tại: ${window.location.origin}`;

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(bragText)
        .then(() => {
          this.showToast(
            "📋 Đã sao chép chiến tích vào Clipboard! Bạn có thể dán để khoe với bạn bè!",
          );
        })
        .catch(() => {
          this.showToast("📋 " + bragText);
        });
    } else {
      this.showToast("📋 " + bragText);
    }
  }

  startConfetti() {
    if (!this.confettiCanvas) return;
    const canvas = this.confettiCanvas;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.confettiParticles = [];

    const colors = [
      "#ffd700",
      "#00f0ff",
      "#ff007f",
      "#00ff88",
      "#ffffff",
      "#ffaa00",
    ];
    for (let i = 0; i < 90; i++) {
      this.confettiParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.4 - 40,
        w: Math.random() * 10 + 6,
        h: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        vRotation: (Math.random() - 0.5) * 8,
        opacity: 1,
      });
    }

    this.confettiRunning = true;
    const loop = () => {
      if (!this.confettiRunning) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of this.confettiParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRotation;
        if (p.y > canvas.height - 40) p.opacity -= 0.02;
        if (p.opacity > 0) {
          alive++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      if (alive > 0) {
        requestAnimationFrame(loop);
      } else {
        this.confettiRunning = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    requestAnimationFrame(loop);
  }

  stopConfetti() {
    this.confettiRunning = false;
    if (this.confettiCanvas) {
      const ctx = this.confettiCanvas.getContext("2d");
      ctx.clearRect(
        0,
        0,
        this.confettiCanvas.width,
        this.confettiCanvas.height,
      );
    }
  }

  // ================= FRIENDS & SOCIAL HUB =================

  setLobbyView(view) {
    this.lobbyView = view === "chat" ? "chat" : "play";
    const showingChat = this.lobbyView === "chat";

    if (this.btnLobbyPlayView) {
      this.btnLobbyPlayView.classList.toggle("active", !showingChat);
      this.btnLobbyPlayView.setAttribute("aria-pressed", String(!showingChat));
    }
    if (this.btnLobbyChatView) {
      this.btnLobbyChatView.classList.toggle("active", showingChat);
      this.btnLobbyChatView.setAttribute("aria-pressed", String(showingChat));
    }
  }

  openFriendsModal() {
    if (this.modalFriends) {
      this.setLobbyView("chat");
      this.closePrivateChat();
      this.modalFriends.classList.remove("hidden");
      if (this.currentUser && !this.friendsDataLoaded) {
        this.loadFriendsData();
      }
      this.switchFriendsTab(this.activeFriendsTab);
    }
  }

  closeFriendsModal() {
    if (this.modalFriends) {
      this.closePrivateChat();
      this.modalFriends.classList.add("hidden");
      this.setLobbyView("play");
    }
  }

  switchFriendsTab(tabName) {
    this.activeFriendsTab = tabName;
    const tabs = [
      {
        id: "friends",
        btn: this.tabBtnFriends,
        content: this.tabContentFriends,
      },
      {
        id: "requests",
        btn: this.tabBtnRequests,
        content: this.tabContentRequests,
      },
      { id: "search", btn: this.tabBtnSearch, content: this.tabContentSearch },
      {
        id: "lobbychat",
        btn: this.tabBtnLobbychat,
        content: this.tabContentLobbychat,
      },
    ];

    tabs.forEach((t) => {
      if (t.btn && t.content) {
        const isActive = t.id === tabName;
        t.btn.classList.toggle("active", isActive);
        t.content.classList.toggle("hidden", !isActive);
      }
    });

    if (tabName === "friends") this.renderFriendsList();
    if (tabName === "requests") this.renderFriendRequests();
    if (tabName === "search")
      this.searchFriends(
        this.inputSearchFriend ? this.inputSearchFriend.value : "",
      );
  }

  async loadFriendsData() {
    if (!this.authToken) return;

    try {
      const [fRes, rRes] = await Promise.all([
        fetch("/api/friends/list", {
          headers: { Authorization: `Bearer ${this.authToken}` },
        }),
        fetch("/api/friends/requests", {
          headers: { Authorization: `Bearer ${this.authToken}` },
        }),
      ]);

      if (fRes.ok) {
        const fData = await fRes.json();
        if (fData.success) this.friends = fData.friends || [];
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        if (rData.success) this.friendRequests = rData.requests || [];
      }

      this.friendsDataLoaded = fRes.ok && rRes.ok;
      this.renderFriendsList();
      this.renderFriendRequests();
      this.updateFriendsBadge();
    } catch (e) {
      console.warn("Failed to load friends:", e);
    }
  }

  updateFriendsBadge() {
    const onlineCount = this.friends.filter(
      (f) => f.status === "online" || f.status === "in_game",
    ).length;
    const reqCount = this.friendRequests.length;

    if (this.friendsTabCount)
      this.friendsTabCount.textContent = this.friends.length;
    if (this.requestsTabBadge) {
      this.requestsTabBadge.textContent = reqCount;
      this.requestsTabBadge.classList.toggle("hidden", reqCount === 0);
    }

    if (this.friendsBadgeOnline) {
      const totalAlerts = onlineCount + reqCount;
      this.friendsBadgeOnline.textContent =
        totalAlerts > 0
          ? reqCount > 0
            ? `🔔 ${reqCount}`
            : `🟢 ${onlineCount}`
          : "0";
      this.friendsBadgeOnline.classList.toggle("hidden", totalAlerts === 0);
    }

    if (this.lobbySocialBadge) {
      this.lobbySocialBadge.textContent = String(reqCount);
      this.lobbySocialBadge.classList.toggle("hidden", reqCount === 0);
    }
  }

  renderFriendsList() {
    if (!this.friendsListContainer) return;
    this.friendsListContainer.innerHTML = "";

    if (!this.currentUser) {
      this.friendsListContainer.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">👤</div>
          <h4>Bạn đang chơi với tư cách Khách</h4>
          <p style="font-size: 13px; margin: 8px 0 14px 0;">Hãy tạo hoặc đăng nhập tài khoản để lưu danh sách bạn bè vĩnh viễn!</p>
          <button id="btn-friends-login-prompt" class="btn-primary-play" style="padding: 10px 18px; font-size: 13px; width: auto; margin: auto;">
            Đăng Nhập / Tạo Tài Khoản
          </button>
        </div>
      `;
      const btn = document.getElementById("btn-friends-login-prompt");
      if (btn)
        btn.addEventListener("click", () => {
          this.closeFriendsModal();
          this.openAuthModal("login");
        });
      return;
    }

    if (this.friends.length === 0) {
      this.friendsListContainer.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">🤝</div>
          <h4>Chưa có bạn bè nào</h4>
          <p style="font-size: 13px; margin: 8px 0 14px 0;">Tìm kiếm bạn bè qua tab Tìm Bạn Mới hoặc kết bạn ngay sau mỗi trận chiến!</p>
          <button id="btn-switch-search-tab" class="btn-secondary" style="width: auto; margin: auto;">
            ➕ Tìm Kiếm Bạn Mới
          </button>
        </div>
      `;
      const sBtn = document.getElementById("btn-switch-search-tab");
      if (sBtn)
        sBtn.addEventListener("click", () => this.switchFriendsTab("search"));
      return;
    }

    this.friends.forEach((f) => {
      const card = document.createElement("div");
      card.className = "friend-card";

      let statusDesc = "⚪ Ngoại tuyến";
      let statusClass = "offline";
      if (f.status === "online") {
        statusDesc = "🟢 Ở Sảnh";
        statusClass = "online";
      } else if (f.status === "in_game") {
        statusDesc = "⚔️ Trong Trận";
        statusClass = "in_game";
      }

      card.innerHTML = `
        <div class="friend-card-left">
          <div class="friend-avatar-wrap" style="background: radial-gradient(circle, ${f.skin || "#00f0ff"}, #0a1120);">
            <span>🐍</span>
            <span class="status-dot ${statusClass}"></span>
          </div>
          <div class="friend-info">
            <div class="friend-name-row">
              <span class="friend-name">${f.username}</span>
              <span class="friend-tier-pill">${f.tier || "🥉 Đồng"}</span>
            </div>
            <span class="friend-status-desc ${statusClass}">${statusDesc} • Kỷ lục: ${(f.highScore || 0).toLocaleString()}</span>
          </div>
        </div>
        <div class="friend-actions-group">
          ${f.status !== "offline" ? `<button class="btn-action-sm btn-f-invite" data-username="${f.username}" title="Mời vào phòng chơi">⚔️ Mời</button>` : ""}
          <button class="btn-action-sm btn-f-chat" data-username="${f.username}" title="Nhắn tin">💬 Chat</button>
          <button class="btn-action-sm btn-f-poke" data-username="${f.username}" title="Vẫy tay">👋</button>
          <button class="btn-action-sm btn-f-profile" data-username="${f.username}" title="Xem hồ sơ">ℹ️</button>
          <button class="btn-action-sm danger btn-f-remove" data-username="${f.username}" title="Xóa bạn">✕</button>
        </div>
      `;

      this.friendsListContainer.appendChild(card);
    });

    this.friendsListContainer
      .querySelectorAll(".btn-f-invite")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this.inviteFriendToRoom(btn.dataset.username),
        );
      });
    this.friendsListContainer.querySelectorAll(".btn-f-chat").forEach((btn) => {
      btn.addEventListener("click", () =>
        this.openPrivateChat(btn.dataset.username),
      );
    });
    this.friendsListContainer.querySelectorAll(".btn-f-poke").forEach((btn) => {
      btn.addEventListener("click", () =>
        this.pokeFriend(btn.dataset.username),
      );
    });
    this.friendsListContainer
      .querySelectorAll(".btn-f-profile")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this.showUserProfile(btn.dataset.username),
        );
      });
    this.friendsListContainer
      .querySelectorAll(".btn-f-remove")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this.removeFriend(btn.dataset.username),
        );
      });
  }

  renderFriendRequests() {
    if (!this.requestsListContainer) return;
    this.requestsListContainer.innerHTML = "";

    if (this.friendRequests.length === 0) {
      this.requestsListContainer.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">🔔</div>
          <h4>Không có lời mời nào</h4>
          <p style="font-size: 13px;">Khi dũng sĩ khác gửi lời mời kết bạn, bạn sẽ nhận được thông báo tại đây.</p>
        </div>
      `;
      return;
    }

    this.friendRequests.forEach((req) => {
      const card = document.createElement("div");
      card.className = "friend-card";
      card.innerHTML = `
        <div class="friend-card-left">
          <div class="friend-avatar-wrap" style="background: radial-gradient(circle, ${req.skin || "#00f0ff"}, #0a1120);">
            <span>🐍</span>
          </div>
          <div class="friend-info">
            <div class="friend-name-row">
              <span class="friend-name">${req.from}</span>
              <span class="friend-tier-pill">${req.tier || "🥉 Đồng"}</span>
            </div>
            <span class="friend-status-desc">Kỷ lục: ${(req.highScore || 0).toLocaleString()} • Kills: ${req.totalKills || 0}</span>
          </div>
        </div>
        <div class="friend-actions-group">
          <button class="btn-action-sm btn-accept-req" data-username="${req.from}" style="background: rgba(0,255,136,0.2); border-color:#00ff88;">✅ Đồng Ý</button>
          <button class="btn-action-sm danger btn-decline-req" data-username="${req.from}">✕ Từ Chối</button>
        </div>
      `;
      this.requestsListContainer.appendChild(card);
    });

    this.requestsListContainer
      .querySelectorAll(".btn-accept-req")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this.respondFriendRequest(btn.dataset.username, true),
        );
      });
    this.requestsListContainer
      .querySelectorAll(".btn-decline-req")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this.respondFriendRequest(btn.dataset.username, false),
        );
      });
  }

  async searchFriends(query) {
    if (!this.searchResultsContainer) return;
    const cleanQ = (query || "").trim();

    this.searchResultsContainer.innerHTML =
      '<div style="text-align:center; padding: 20px; color:#94a3b8;">Đang tìm kiếm gợi ý...</div>';

    try {
      const url = `/api/friends/search?q=${encodeURIComponent(cleanQ)}`;
      const res = await fetch(url, {
        headers: this.authToken
          ? { Authorization: `Bearer ${this.authToken}` }
          : {},
      });
      const data = await res.json();

      if (!data.success || !data.results || data.results.length === 0) {
        this.searchResultsContainer.innerHTML = `
          <div class="empty-state-box">
            <div class="empty-state-icon">🔍</div>
            <p>${cleanQ ? `Không tìm thấy dũng sĩ nào khớp với "${cleanQ}".` : "Chưa có dũng sĩ nào khác đăng ký."}</p>
          </div>
        `;
        return;
      }

      this.searchResultsContainer.innerHTML = "";
      data.results.forEach((u) => {
        const card = document.createElement("div");
        card.className = "friend-card";

        let actionBtn = `<button class="btn-action-sm btn-add-user" data-username="${u.username}">➕ Kết Bạn</button>`;
        if (u.relationship === "friend") {
          actionBtn = `<span style="font-size:12px; color:#00ff88; font-weight:700;">✅ Bạn Bè</span>`;
        } else if (u.relationship === "pending_sent") {
          actionBtn = `<span style="font-size:12px; color:#ffaa00; font-weight:700;">⏳ Đã Gửi</span>`;
        } else if (u.relationship === "pending_received") {
          actionBtn = `<button class="btn-action-sm btn-accept-req" data-username="${u.username}" style="background:#00ff88; color:#000;">Chấp Nhận</button>`;
        }

        card.innerHTML = `
          <div class="friend-card-left">
            <div class="friend-avatar-wrap" style="background: radial-gradient(circle, ${u.skin || "#00f0ff"}, #0a1120);">
              <span>🐍</span>
            </div>
            <div class="friend-info">
              <div class="friend-name-row">
                <span class="friend-name">${u.username}</span>
                <span class="friend-tier-pill">${u.tier || "🥉 Đồng"}</span>
              </div>
              <span class="friend-status-desc">Kỷ lục: ${(u.highScore || 0).toLocaleString()} • Kills: ${u.totalKills || 0}</span>
            </div>
          </div>
          <div class="friend-actions-group">
            ${actionBtn}
            <button class="btn-action-sm btn-f-profile" data-username="${u.username}">ℹ️</button>
          </div>
        `;

        this.searchResultsContainer.appendChild(card);
      });

      this.searchResultsContainer
        .querySelectorAll(".btn-add-user")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            this.sendFriendRequest(btn.dataset.username);
            btn.textContent = "⏳ Đã Gửi";
            btn.disabled = true;
          });
        });

      this.searchResultsContainer
        .querySelectorAll(".btn-accept-req")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            this.respondFriendRequest(btn.dataset.username, true);
          });
        });

      this.searchResultsContainer
        .querySelectorAll(".btn-f-profile")
        .forEach((btn) => {
          btn.addEventListener("click", () =>
            this.showUserProfile(btn.dataset.username),
          );
        });
    } catch (e) {
      console.warn("Search error:", e);
      this.searchResultsContainer.innerHTML =
        '<div style="color:#ff3366; text-align:center;">Lỗi khi tìm kiếm dũng sĩ!</div>';
    }
  }

  sendFriendRequest(targetUsername) {
    if (!this.currentUser) {
      this.showToast("⚠️ Vui lòng đăng nhập tài khoản để kết bạn!");
      this.openAuthModal("login");
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "FRIEND_REQUEST_SEND",
          toUsername: targetUsername,
        }),
      );
    } else {
      fetch("/api/friends/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ targetUsername }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            this.showToast(`📤 ${data.message || "Đã gửi lời mời kết bạn!"}`);
          } else {
            this.showToast(`⚠️ ${data.error || "Không thể gửi lời mời!"}`);
          }
        });
    }
  }

  respondFriendRequest(fromUsername, accept = true) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "FRIEND_REQUEST_RESPOND",
          fromUsername,
          accept,
        }),
      );
    } else {
      fetch("/api/friends/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ fromUsername, accept }),
      });
    }

    this.friendRequests = this.friendRequests.filter(
      (r) => r.from.toLowerCase() !== fromUsername.toLowerCase(),
    );
    this.renderFriendRequests();
    this.updateFriendsBadge();

    if (accept) {
      this.showToast(`🎉 Đã chấp nhận kết bạn với ${fromUsername}!`);
      this.loadFriendsData();
    } else {
      this.showToast(`Đã từ chối lời mời từ ${fromUsername}.`);
    }
  }

  removeFriend(friendUsername) {
    if (!confirm(`Bạn có chắc muốn hủy kết bạn với "${friendUsername}"?`))
      return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "FRIEND_REMOVE",
          friendUsername,
        }),
      );
    } else {
      fetch("/api/friends/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ friendUsername }),
      });
    }

    this.friends = this.friends.filter(
      (f) => f.username.toLowerCase() !== friendUsername.toLowerCase(),
    );
    this.renderFriendsList();
    this.updateFriendsBadge();
    this.showToast(`Đã xóa "${friendUsername}" khỏi danh sách bạn bè.`);
  }

  inviteFriendToRoom(username) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "INVITE_FRIEND",
          toUsername: username,
          roomCode: this.roomCode,
          mode: this.selectedGameMode,
        }),
      );
      this.showToast(
        `⚔️ Đang gửi lời mời phòng #${this.roomCode} tới ${username}...`,
      );
    } else {
      this.showToast(`⚠️ Chưa kết nối máy chủ!`);
    }
  }

  pokeFriend(username) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "POKE_FRIEND",
          toUsername: username,
        }),
      );
      this.showToast(`👋 Đang vẫy tay chào ${username}...`);
    }
  }

  commendPlayer(targetName) {
    this.likedPlayers.add(targetName);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "COMMEND_PLAYER",
          targetName,
        }),
      );
      this.showToast(`❤️ Đang gửi lời khen tới ${targetName}...`);
    }
  }

  handleRoomInvite(data) {
    this.pendingRoomInvite = data;
    if (this.invitePromptBox) {
      this.invitePromptSender.textContent = data.from;
      this.invitePromptRoom.textContent = `#${data.roomCode || "ARENA-5V5"}`;
      this.invitePromptBox.classList.remove("hidden");

      setTimeout(() => {
        if (this.invitePromptBox && this.pendingRoomInvite === data) {
          this.invitePromptBox.classList.add("hidden");
          this.pendingRoomInvite = null;
        }
      }, 15000);
    }
  }

  acceptPendingInvite() {
    if (!this.pendingRoomInvite) {
      if (this.invitePromptBox) this.invitePromptBox.classList.add("hidden");
      return;
    }

    const room = this.pendingRoomInvite.roomCode || "ARENA-5V5";
    this.roomCode = room;
    this.setGameMode(this.pendingRoomInvite.mode || "ranked");
    if (this.lobbyRoomCode) this.lobbyRoomCode.textContent = `#${room}`;

    if (this.invitePromptBox) this.invitePromptBox.classList.add("hidden");
    this.closeFriendsModal();
    this.showToast(`🚀 Đang tham gia phòng #${room}...`);
    this.pendingRoomInvite = null;
    if (this.selectedGameMode === "solo5v5") {
      this.joinSoloRoom(room);
      return;
    }
    this.joinGame();
  }

  // ================= CHAT SYSTEM =================

  renderLobbyChatHistory(messages) {
    if (!this.lobbyChatMessagesEl || !messages) return;
    this.lobbyChatMessagesEl.innerHTML = "";
    messages.forEach((m) => this.appendLobbyChatMessage(m));
  }

  appendLobbyChatMessage(msg) {
    if (!this.lobbyChatMessagesEl || !msg) return;

    const row = document.createElement("div");
    const isSelf =
      this.currentUser &&
      this.currentUser.username.toLowerCase() === msg.sender.toLowerCase();
    row.className = `chat-msg-row ${isSelf ? "self" : ""}`;

    const date = new Date(msg.time || Date.now());
    const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    const header = document.createElement("div");
    header.className = "chat-msg-header";
    const sender = document.createElement("span");
    sender.className = "chat-sender-name";
    sender.textContent = msg.sender || "Người chơi";
    if (/^#[\da-f]{6}$/i.test(msg.senderSkin || "")) {
      sender.style.color = msg.senderSkin;
    }
    const tier = document.createElement("span");
    tier.className = "chat-sender-tier";
    tier.textContent = msg.senderTier || "Dũng Sĩ";
    const time = document.createElement("span");
    time.className = "chat-msg-time";
    time.textContent = timeStr;
    header.append(sender, tier, time);

    const bubble = document.createElement("div");
    bubble.className = "chat-msg-bubble";
    bubble.textContent = msg.text || "";
    row.append(header, bubble);

    this.lobbyChatMessagesEl.appendChild(row);
    this.lobbyChatMessagesEl.scrollTop = this.lobbyChatMessagesEl.scrollHeight;
  }

  sendLobbyChat(text) {
    const cleanText = text.trim();
    if (!cleanText) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "SEND_CHAT_MESSAGE",
          typeChat: "lobby",
          text: cleanText,
        }),
      );
      if (this.inputLobbyChat) this.inputLobbyChat.value = "";
    } else {
      this.showToast("⚠️ Chưa kết nối máy chủ!");
    }
  }

  async openPrivateChat(username) {
    if (!this.currentUser) {
      this.showToast("⚠️ Vui lòng đăng nhập để nhắn tin riêng với bạn bè!");
      this.openAuthModal("login");
      return;
    }

    this.activePrivateChatUser = username;
    const friend = this.friends.find(
      (f) => f.username.toLowerCase() === username.toLowerCase(),
    );

    if (this.privateChatDrawer) {
      this.privateChatDrawer.classList.remove("hidden");
      if (this.privateChatName) this.privateChatName.textContent = username;
      if (this.privateChatAvatar && friend) {
        this.privateChatAvatar.style.background = friend.skin || "#00f0ff";
      }
      this.updatePrivateChatStatusText(friend ? friend.status : "offline");

      if (this.privateChatMessagesEl) this.privateChatMessagesEl.innerHTML = "";
      try {
        const res = await fetch(
          `/api/chat/private?with=${encodeURIComponent(username)}`,
          {
            headers: { Authorization: `Bearer ${this.authToken}` },
          },
        );
        const data = await res.json();
        if (data.success && data.messages) {
          data.messages.forEach((m) => this.appendPrivateChatMessage(m));
        }
      } catch (e) {
        console.warn("Load private chat error:", e);
      }
    }
  }

  closePrivateChat() {
    this.activePrivateChatUser = null;
    if (this.privateChatDrawer) {
      this.privateChatDrawer.classList.add("hidden");
    }
  }

  updatePrivateChatStatusText(status) {
    if (!this.privateChatStatus) return;
    if (status === "online") {
      this.privateChatStatus.textContent = "🟢 Ở Sảnh";
      this.privateChatStatus.style.color = "#00ff88";
    } else if (status === "in_game") {
      this.privateChatStatus.textContent = "⚔️ Trong Trận";
      this.privateChatStatus.style.color = "#ffaa00";
    } else {
      this.privateChatStatus.textContent = "⚪ Ngoại tuyến";
      this.privateChatStatus.style.color = "#94a3b8";
    }
  }

  handlePrivateChatMessage(msg) {
    const isSelf =
      this.currentUser &&
      this.currentUser.username.toLowerCase() === msg.sender.toLowerCase();
    const otherUser = isSelf ? msg.to : msg.sender;

    if (
      this.activePrivateChatUser &&
      this.activePrivateChatUser.toLowerCase() === otherUser.toLowerCase()
    ) {
      this.appendPrivateChatMessage(msg);
    } else if (!isSelf) {
      window.soundEngine.playNotification();
      this.showToast(`💬 [${msg.sender}]: ${msg.text}`);
    }
  }

  appendPrivateChatMessage(msg) {
    if (!this.privateChatMessagesEl) return;

    const row = document.createElement("div");
    const isSelf =
      this.currentUser &&
      this.currentUser.username.toLowerCase() === msg.sender.toLowerCase();
    row.className = `chat-msg-row ${isSelf ? "self" : ""}`;

    const date = new Date(msg.time || Date.now());
    const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    const header = document.createElement("div");
    header.className = "chat-msg-header";
    const sender = document.createElement("span");
    sender.className = "chat-sender-name";
    sender.textContent = msg.sender || "Người chơi";
    const time = document.createElement("span");
    time.className = "chat-msg-time";
    time.textContent = timeStr;
    header.append(sender, time);

    const bubble = document.createElement("div");
    bubble.className = "chat-msg-bubble";
    bubble.textContent = msg.text || "";
    row.append(header, bubble);

    this.privateChatMessagesEl.appendChild(row);
    this.privateChatMessagesEl.scrollTop =
      this.privateChatMessagesEl.scrollHeight;
  }

  sendPrivateChat(text) {
    const cleanText = text.trim();
    if (!cleanText || !this.activePrivateChatUser) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "SEND_CHAT_MESSAGE",
          typeChat: "private",
          to: this.activePrivateChatUser,
          text: cleanText,
        }),
      );
      if (this.inputPrivateChat) this.inputPrivateChat.value = "";
    } else {
      this.showToast("⚠️ Chưa kết nối máy chủ!");
    }
  }

  // ================= USER PROFILE VIEW =================

  async showUserProfile(username) {
    if (!this.modalProfileCard) return;

    try {
      const res = await fetch(
        `/api/user/profile/${encodeURIComponent(username)}`,
      );
      const data = await res.json();

      if (!data.success || !data.profile) {
        this.showToast("Không tìm thấy thông tin dũng sĩ!");
        return;
      }

      const p = data.profile;
      this.profileCardName.textContent = p.username;
      this.profileCardTier.textContent = p.tier || "🥉 Đồng";
      this.profileCardScore.textContent = (p.highScore || 0).toLocaleString();
      this.profileCardKills.textContent = (p.totalKills || 0).toLocaleString();
      this.profileCardMatches.textContent = (
        p.matchesPlayed || 0
      ).toLocaleString();
      this.profileCardFriends.textContent = p.friendCount || 0;

      if (this.profileCardAvatar) {
        this.profileCardAvatar.style.background = p.skin || "#00f0ff";
      }

      let stText = "⚪ Ngoại tuyến";
      let stColor = "#94a3b8";
      if (p.status === "online") {
        stText = "🟢 Ở Sảnh";
        stColor = "#00ff88";
      } else if (p.status === "in_game") {
        stText = "⚔️ Trong Trận";
        stColor = "#ffaa00";
      }

      if (this.profileCardStatusBadge) {
        this.profileCardStatusBadge.textContent = stText;
        this.profileCardStatusBadge.style.color = stColor;
      }

      this.profileCardActions.innerHTML = "";
      const isFriend = this.friends.some(
        (f) => f.username.toLowerCase() === p.username.toLowerCase(),
      );
      const isSelf =
        this.currentUser &&
        this.currentUser.username.toLowerCase() === p.username.toLowerCase();

      if (!isSelf) {
        if (!isFriend) {
          const btnAdd = document.createElement("button");
          btnAdd.className = "btn-respawn";
          btnAdd.style.flex = "1";
          btnAdd.textContent = "➕ Thêm Bạn Bè";
          btnAdd.addEventListener("click", () => {
            this.sendFriendRequest(p.username);
            btnAdd.textContent = "⏳ Đã Gửi Lời Mời";
            btnAdd.disabled = true;
          });
          this.profileCardActions.appendChild(btnAdd);
        } else {
          const btnChat = document.createElement("button");
          btnChat.className = "btn-respawn";
          btnChat.style.flex = "1";
          btnChat.textContent = "💬 Nhắn Tin";
          btnChat.addEventListener("click", () => {
            this.modalProfileCard.classList.add("hidden");
            this.openFriendsModal();
            this.openPrivateChat(p.username);
          });
          this.profileCardActions.appendChild(btnChat);
        }

        const btnPoke = document.createElement("button");
        btnPoke.className = "btn-modal-lobby";
        btnPoke.textContent = "👋 Vẫy Tay";
        btnPoke.addEventListener("click", () => {
          this.pokeFriend(p.username);
        });
        this.profileCardActions.appendChild(btnPoke);
      }

      this.modalProfileCard.classList.remove("hidden");
    } catch (e) {
      console.warn("Profile view error:", e);
    }
  }

  // ================= AUTHENTICATION MODAL =================

  openAuthModal(mode = "login") {
    this.authMode = mode;
    if (this.authInputPassword) {
      this.authInputPassword.autocomplete = mode === "register" ? "new-password" : "current-password";
      this.authInputPassword.placeholder = mode === "register"
        ? "Tạo mật khẩu từ 12 đến 128 ký tự..."
        : "Nhập mật khẩu (12 đến 128 ký tự)...";
    }
    this.tabLogin.classList.toggle("active", mode === "login");
    this.tabRegister.classList.toggle("active", mode === "register");
    this.btnSubmitAuth.textContent =
      mode === "register" ? "TẠO TÀI KHOẢN NGAY" : "ĐĂNG NHẬP NGAY";
    this.authErrorMsg.classList.add("hidden");
    this.modalAuth.classList.remove("hidden");
  }

  closeAuthModal() {
    if (!this.currentUser) return;
    this.modalAuth.classList.add("hidden");
    this.authErrorMsg.classList.add("hidden");
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const username = this.authInputUsername.value.trim();
    const password = this.authInputPassword.value;

    this.authErrorMsg.classList.add("hidden");
    const endpoint =
      this.authMode === "register" ? "/api/auth/register" : "/api/auth/login";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, skin: this.selectedColor }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.authErrorMsg.textContent =
          data.error || "Có lỗi xảy ra, vui lòng thử lại!";
        this.authErrorMsg.classList.remove("hidden");
        return;
      }

      this.authToken = data.token;
      localStorage.setItem("snake_auth_token", data.token);
      this.currentUser = data.user;
      this.applyLoggedInUI(data.user);
      this.closeAuthModal();

      const welcomeMsg =
        this.authMode === "register"
          ? `🎉 Tạo tài khoản thành công! Chào mừng dũng sĩ ${data.user.username}!`
          : `👋 Chào mừng trở lại, ${data.user.username}! Toàn bộ dữ liệu bạn bè & Rank đã sẵn sàng!`;
      this.showToast(welcomeMsg);
      this.connectWebSocket();
    } catch (err) {
      console.error("Auth error:", err);
      this.authErrorMsg.textContent = "Không thể kết nối đến máy chủ!";
      this.authErrorMsg.classList.remove("hidden");
    }
  }

  handleLogout() {
    this.authToken = null;
    this.currentUser = null;
    localStorage.removeItem("snake_auth_token");
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.applyLoggedOutUI();
    this.showToast("🚪 Đã đăng xuất khỏi tài khoản!");
  }

  async fetchGlobalLeaderboard() {
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        if (data.leaderboard) {
          this.renderGlobalLeaderboard(data.leaderboard);
        }
      }
    } catch (e) {
      console.warn("Failed to load global leaderboard:", e);
    }
  }

  renderGlobalLeaderboard(list) {
    if (!this.globalRankTbody) return;
    if (!list || list.length === 0) {
      this.globalRankTbody.innerHTML =
        '<tr><td colspan="5" class="table-loading">Chưa có người chơi nào trên bảng xếp hạng.</td></tr>';
      return;
    }

    this.globalRankTbody.innerHTML = "";
    list.forEach((p) => {
      const tr = document.createElement("tr");

      let rankDisplay = `#${p.rank}`;
      let medalClass = "";
      if (p.rank === 1) {
        rankDisplay = "👑 1";
        medalClass = "gold";
      } else if (p.rank === 2) {
        rankDisplay = "🥈 2";
        medalClass = "silver";
      } else if (p.rank === 3) {
        rankDisplay = "🥉 3";
        medalClass = "bronze";
      }

      let tierClass = "bronze";
      if (p.tier.includes("Thách Đấu")) tierClass = "challenger";
      else if (p.tier.includes("Kim Cương")) tierClass = "diamond";
      else if (p.tier.includes("Vàng")) tierClass = "gold";
      else if (p.tier.includes("Bạc")) tierClass = "silver";

      tr.innerHTML = `
        <td><span class="rank-medal ${medalClass}">${rankDisplay}</span></td>
        <td><span class="rank-player-name">${p.name}</span></td>
        <td><span class="tier-tag ${tierClass}">${p.tier}</span></td>
        <td style="text-align: right; font-weight: 800; color: #00f0ff;">${p.highScore.toLocaleString()}</td>
        <td style="text-align: right; font-weight: 700; color: #ff3366;">${p.kills}</td>
      `;
      this.globalRankTbody.appendChild(tr);
    });
  }

  // ================= EVENT LISTENERS =================

  bindEvents() {
    this.skinOptions.forEach((opt) => {
      opt.addEventListener("click", () => {
        this.skinOptions.forEach((o) => o.classList.remove("active"));
        opt.classList.add("active");
        this.selectedColor = opt.dataset.color;
        const selectedSkinId = opt.dataset.skinId || "starter-cyan";
        this.playerProgress.equippedSkin = selectedSkinId;
        this.savePlayerProgress();
        this.renderSnakeStats();
        this.updateAvatarPreview();
        window.soundEngine.playEat();
      });
    });

    if (this.btnUpgradeSnake) {
      this.btnUpgradeSnake.addEventListener("click", () => this.upgradeSnake());
    }

    if (this.btnCopyInvite) {
      this.btnCopyInvite.addEventListener("click", () => {
        const link = `${window.location.origin}${window.location.pathname}?room=${this.roomCode}&mode=${this.selectedGameMode}`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(link).then(() => {
            this.showToast(
              "📋 Đã sao chép link mời phòng! Gửi cho bạn bè để cùng chơi!",
            );
          });
        } else {
          this.showToast(`Link phòng: ${link}`);
        }
      });
    }

    if (this.btnInviteOnlineFriends) {
      this.btnInviteOnlineFriends.addEventListener("click", () => {
        this.openFriendsModal();
        this.switchFriendsTab("friends");
        const online = this.friends.filter(
          (f) => f.status === "online" || f.status === "in_game",
        );
        if (online.length > 0) {
          this.showToast(
            `⚔️ Bấm nút [⚔️ Mời] cạnh bạn bè đang online để gửi lời mời tham chiến!`,
          );
        } else {
          this.showToast(
            `💡 Chưa có bạn bè nào trực tuyến! Hãy sao chép link phòng gửi cho bạn bè hoặc kết bạn thêm!`,
          );
        }
      });
    }

    document.querySelectorAll(".mode-select-card").forEach((button) => {
      button.addEventListener("click", () =>
        this.setGameMode(button.dataset.mode),
      );
    });

    this.mapOptions.forEach((option) => {
      option.addEventListener("click", () => {
        this.mapOptions.forEach((item) => item.classList.remove("active"));
        option.classList.add("active");
        this.selectedMapId = option.dataset.mapId || "neon-grid";
        this.showToast(`🗺️ Bản đồ đã chọn: ${this.selectedMapId.replace("-", " ")}`);
      });
    });

    if (this.soloRuleOptions) {
      this.soloRuleOptions.forEach((option) => {
        option.addEventListener("click", () => {
          this.soloRuleOptions.forEach((item) => item.classList.remove("active"));
          option.classList.add("active");
          this.selectedSoloRule = option.dataset.rule || "classic";
          this.showToast(`⚙️ Chế độ phòng riêng: ${this.selectedSoloRule}`);
        });
      });
    }

    if (this.btnSoloRoomJoin) {
      this.btnSoloRoomJoin.addEventListener("click", () =>
        this.joinSoloRoom(this.inputSoloRoomCode?.value),
      );
    }
    if (this.inputSoloRoomCode) {
      this.inputSoloRoomCode.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.joinSoloRoom(this.inputSoloRoomCode.value);
        }
      });
    }
    if (this.btnSoloRoomLeave)
      this.btnSoloRoomLeave.addEventListener("click", () =>
        this.leaveSoloRoom(),
      );
    if (this.btnSoloTeamRed)
      this.btnSoloTeamRed.addEventListener("click", () =>
        this.sendSoloRoomCommand("SOLO_ROOM_CHANGE_TEAM", { teamId: "red" }),
      );
    if (this.btnSoloTeamBlue)
      this.btnSoloTeamBlue.addEventListener("click", () =>
        this.sendSoloRoomCommand("SOLO_ROOM_CHANGE_TEAM", { teamId: "blue" }),
      );
    if (this.btnSoloRoomCopy)
      this.btnSoloRoomCopy.addEventListener("click", () =>
        this.copySoloRoomInvite(),
      );
    if (this.btnSoloRoomInvite)
      this.btnSoloRoomInvite.addEventListener("click", () => {
        this.openFriendsModal();
        this.switchFriendsTab("friends");
      });
    if (this.btnSoloRoomStart)
      this.btnSoloRoomStart.addEventListener("click", () =>
        this.startSoloRoom(),
      );

    if (this.btnRefreshRank) {
      this.btnRefreshRank.addEventListener("click", () => {
        this.fetchGlobalLeaderboard();
        this.showToast("🔄 Đã làm mới bảng xếp hạng!");
      });
    }

    this.btnJoin.addEventListener("click", () => this.joinGame());
    this.inputName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.joinGame();
    });

    this.btnRespawn.addEventListener("click", () => {
      this.modalDeath.classList.add("hidden");
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "RESPAWN" }));
      }
    });

    const returnLobby = () => this.returnToLobby();
    if (this.btnHudLobby)
      this.btnHudLobby.addEventListener("click", returnLobby);
    if (this.btnDeathLobby)
      this.btnDeathLobby.addEventListener("click", returnLobby);
    if (this.btnMatchoverLobby)
      this.btnMatchoverLobby.addEventListener("click", returnLobby);

    if (this.btnMatchoverReady) {
      this.btnMatchoverReady.addEventListener("click", () => {
        this.modalMatchOver.classList.add("hidden");
        this.stopConfetti();
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "RESPAWN" }));
        }
      });
    }

    if (this.btnMatchoverShare) {
      this.btnMatchoverShare.addEventListener("click", () =>
        this.shareMatchBrag(),
      );
    }

    const toggleSound = () => {
      const enabled = window.soundEngine.toggle();
      const icon = enabled ? "🔊" : "🔇";
      if (this.btnMute) this.btnMute.textContent = icon;
      if (this.btnLobbySound) this.btnLobbySound.textContent = icon;
    };
    if (this.btnMute) this.btnMute.addEventListener("click", toggleSound);
    if (this.btnLobbySound)
      this.btnLobbySound.addEventListener("click", toggleSound);

    if (this.leaderboardToggle && this.leaderboardPanel) {
      this.leaderboardToggle.addEventListener("click", () => {
        this.leaderboardPanel.classList.toggle("collapsed");
      });
    }

    if (this.btnSkillNitro)
      this.btnSkillNitro.addEventListener("click", () =>
        this.usePowerup("nitro"),
      );
    if (this.btnSkillVision)
      this.btnSkillVision.addEventListener("click", () =>
        this.usePowerup("vision"),
      );
    if (this.btnSkillMagnet)
      this.btnSkillMagnet.addEventListener("click", () =>
        this.usePowerup("magnet"),
      );

    this.emoteLoadout?.addEventListener("change", (event) => {
      const select = event.target.closest("select[data-slot]");
      if (select) this.setEmoteLoadout(Number(select.dataset.slot), select.value);
    });
    this.emoteHotbar?.addEventListener("click", (event) => {
      const button = event.target.closest(".emote-hotbar-button");
      if (button && !button.disabled) this.useEmote(button.dataset.emoteId);
    });
    window.addEventListener("keydown", (event) => {
      if (event.repeat || !this.localPlayerId || !/^[4-7]$/.test(event.key)) return;
      if (event.target.closest?.("input, textarea, select, [contenteditable='true']")) return;
      this.useEmote(this.playerProgress.equippedEmotes[Number(event.key) - 4]);
    });

    if (this.btnTouchBoost) {
      const startBoost = (e) => {
        if (e.cancelable) e.preventDefault();
        this.btnTouchBoost.classList.add("active");
        this.inputManager.setTouchBoost(true);
      };
      const endBoost = (e) => {
        if (e.cancelable) e.preventDefault();
        this.btnTouchBoost.classList.remove("active");
        this.inputManager.setTouchBoost(false);
      };
      this.btnTouchBoost.addEventListener("touchstart", startBoost, {
        passive: false,
      });
      this.btnTouchBoost.addEventListener("touchend", endBoost, {
        passive: false,
      });
      this.btnTouchBoost.addEventListener("touchcancel", endBoost, {
        passive: false,
      });
      this.btnTouchBoost.addEventListener("mousedown", startBoost);
      this.btnTouchBoost.addEventListener("mouseup", endBoost);
      this.btnTouchBoost.addEventListener("mouseleave", endBoost);
    }

    // Auth events
    if (this.btnOpenShop) {
      this.btnOpenShop.addEventListener("click", () => this.openShopModal());
    }
    if (this.btnEmoteShop) {
      this.btnEmoteShop.addEventListener("click", () => {
        this.setShopCategory("emotes");
        this.openShopModal();
      });
    }
    if (this.btnCloseShop) {
      this.btnCloseShop.addEventListener("click", () => this.closeShopModal());
    }
    this.modalShop?.querySelectorAll(".shop-category-button").forEach((button) => {
      button.addEventListener("click", () => this.setShopCategory(button.dataset.category));
    });
    if (this.btnBattlePassPremium) {
      this.btnBattlePassPremium.addEventListener("click", () => {
        this.playerProgress.premiumPass = !this.playerProgress.premiumPass;
        this.savePlayerProgress();
        this.renderPlayerProgress();
        this.showToast(
          this.playerProgress.premiumPass
            ? "✅ Premium Pass đã kích hoạt."
            : "ℹ️ Premium Pass đã tắt.",
        );
      });
    }

    if (this.btnOpenAuth)
      this.btnOpenAuth.addEventListener("click", () =>
        this.openAuthModal("login"),
      );
    if (this.linkCreateAcc)
      this.linkCreateAcc.addEventListener("click", () =>
        this.openAuthModal("register"),
      );
    if (this.btnCloseAuth)
      this.btnCloseAuth.addEventListener("click", () => this.closeAuthModal());
    if (this.tabLogin)
      this.tabLogin.addEventListener("click", () =>
        this.openAuthModal("login"),
      );
    if (this.tabRegister)
      this.tabRegister.addEventListener("click", () =>
        this.openAuthModal("register"),
      );
    if (this.authForm)
      this.authForm.addEventListener("submit", (e) => this.handleAuthSubmit(e));
    if (this.btnLogout)
      this.btnLogout.addEventListener("click", () => this.handleLogout());

    // Friends Modal Events
    if (this.btnLobbyPlayView)
      this.btnLobbyPlayView.addEventListener("click", () =>
        this.closeFriendsModal(),
      );
    if (this.btnLobbyChatView)
      this.btnLobbyChatView.addEventListener("click", () =>
        this.openFriendsModal(),
      );
    if (this.btnOpenFriends)
      this.btnOpenFriends.addEventListener("click", () =>
        this.openFriendsModal(),
      );
    if (this.btnCloseFriends)
      this.btnCloseFriends.addEventListener("click", () =>
        this.closeFriendsModal(),
      );

    if (this.tabBtnFriends)
      this.tabBtnFriends.addEventListener("click", () =>
        this.switchFriendsTab("friends"),
      );
    if (this.tabBtnRequests)
      this.tabBtnRequests.addEventListener("click", () =>
        this.switchFriendsTab("requests"),
      );
    if (this.tabBtnSearch)
      this.tabBtnSearch.addEventListener("click", () =>
        this.switchFriendsTab("search"),
      );
    if (this.tabBtnLobbychat)
      this.tabBtnLobbychat.addEventListener("click", () =>
        this.switchFriendsTab("lobbychat"),
      );

    // Search Friends
    if (this.btnSearchFriendSubmit) {
      this.btnSearchFriendSubmit.addEventListener("click", () => {
        this.searchFriends(this.inputSearchFriend.value);
      });
    }
    if (this.inputSearchFriend) {
      this.inputSearchFriend.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.searchFriends(this.inputSearchFriend.value);
      });
    }

    // Lobby Chat Submit
    if (this.lobbyChatForm) {
      this.lobbyChatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.sendLobbyChat(this.inputLobbyChat.value);
      });
    }

    // Lobby Chat Quick Emojis
    if (this.lobbyQuickEmojis) {
      this.lobbyQuickEmojis.querySelectorAll(".emoji-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          if (this.inputLobbyChat) {
            this.inputLobbyChat.value += chip.dataset.emoji;
            this.inputLobbyChat.focus();
          }
        });
      });
    }

    // Private Chat Drawer
    if (this.btnBackFromChat)
      this.btnBackFromChat.addEventListener("click", () =>
        this.closePrivateChat(),
      );
    if (this.btnClosePrivateChat)
      this.btnClosePrivateChat.addEventListener("click", () =>
        this.closePrivateChat(),
      );

    if (this.privateChatForm) {
      this.privateChatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.sendPrivateChat(this.inputPrivateChat.value);
      });
    }

    if (this.privateQuickEmojis) {
      this.privateQuickEmojis
        .querySelectorAll(".emoji-chip")
        .forEach((chip) => {
          chip.addEventListener("click", () => {
            if (this.inputPrivateChat) {
              this.inputPrivateChat.value += chip.dataset.emoji;
              this.inputPrivateChat.focus();
            }
          });
        });
    }

    // Profile Card Close
    if (this.btnCloseProfile) {
      this.btnCloseProfile.addEventListener("click", () => {
        this.modalProfileCard.classList.add("hidden");
      });
    }

    // Invite Prompt Actions
    if (this.btnInviteAccept) {
      this.btnInviteAccept.addEventListener("click", () =>
        this.acceptPendingInvite(),
      );
    }
    if (this.btnInviteDecline) {
      this.btnInviteDecline.addEventListener("click", () => {
        if (this.invitePromptBox) this.invitePromptBox.classList.add("hidden");
        this.pendingRoomInvite = null;
      });
    }
  }

  // ================= MAIN LOOP =================

  startGameLoop() {
    let lastTime = performance.now();

    const loop = (time) => {
      const dt = Math.min(0.08, (time - lastTime) / 1000);
      lastTime = time;

      this.sendInputIfChanged();

      this.renderer.render(
        this.foods,
        this.localPlayerId,
        this.arenaRadius,
        dt,
        this.currentInput,
        this.powerups,
      );

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new GameClient();
});
