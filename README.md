# 🐍 Multiplayer Snake Arena 2D (Đấu Trường Rắn Săn Mồi Trực Tuyến)

Dự án game **Rắn Săn Mồi Nhiều Người Chơi 2D (Multiplayer Snake Arena)** thời gian thực với đồ họa Cyber Neon hiện đại, mô hình Server-Authoritative, hỗ trợ 2–4+ người chơi cùng phòng và hệ thống Bot AI thông minh.

---

## 🌟 Tính Năng Nổi Bật

1. **Kiến Trúc Server-Authoritative (Node.js + WebSockets)**:
   - Server tính toán toàn bộ logic vật lý (45 Hz): vị trí, góc xoay, tăng tốc (boost), ăn mồi, va chạm và điểm số.
   - Chống gian lận (anti-cheat), đồng bộ thời gian thực mượt mà cho 2-4+ người chơi qua mạng LAN hoặc Internet.

2. **Cơ Chế Gameplay Sinh Tồn Gay Cấn**:
   - **Di chuyển & Đổi hướng mượt mà**: Điều khiển theo chuột hoặc cảm ứng trên điện thoại.
   - **Tăng tốc (Boost/Sprint)**: Nhấn giữ `Space` hoặc `Chuột Trái` để tăng 1.8x tốc độ (tiêu hao nhẹ chiều dài để nhả hạt năng lượng).
   - **Cơ chế chiến đấu (Combat)**: Đầu rắn đâm vào thân rắn đối thủ sẽ lập tức phát nổ thành chùm mồi năng lượng lớn! Kẻ hạ gục nhận điểm thưởng và hiển thị trên Kill Feed.
   - **Vòng rào năng lượng (Arena Boundary)**: Bản đồ hình tròn với tường năng lượng phát sáng — chạm vào sẽ bị tiêu diệt ngay.

3. **Thức Ăn Đa Dạng (Food Orbs)**:
   - Hàng trăm viên ngọc năng lượng phát sáng rải rác trên bản đồ.
   - Thức ăn đặc biệt khi rắn chết tạo thành các điểm nóng (hotspots) thu hút người chơi tranh cướp.

4. **Bot AI Tự Động**:
   - Tự động duy trì 6-10 rắn trong phòng để trận đấu luôn sôi động ngay cả khi chơi 1 người hoặc khi đợi bạn bè vào phòng.
   - Bot biết né tường, né thân các con rắn khác và săn mồi thông minh.

5. **Bảng Xếp Hạng & Vòng Đấu (Match Rounds)**:
   - Bảng xếp hạng Top 10 thời gian thực trên màn hình với biểu tượng vương miện 👑 cho người dẫn đầu.
   - Bộ đếm thời gian trận đấu (3 phút/trận).
   - Màn hình tổng kết (Podium Vàng, Bạc, Đồng) và tự động bắt đầu vòng đấu mới sau thời gian nghỉ.

6. **Âm Thanh Tự Nhiên (Procedural Web Audio API)**:
   - Âm thanh ăn mồi, tăng tốc, nổ tung, diệt địch và kết thúc trận mà không cần tải bất kỳ file mp3 bên ngoài nào.

---

## 🚀 Hướng Dẫn Khởi Chạy

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Khởi động Server:
```bash
npm start
```

### 3. Tham gia trò chơi:
- **Trên máy chủ (Localhost)**: Mở trình duyệt và truy cập [http://localhost:3000](http://localhost:3000)
- **Chơi nhiều người trên cùng mạng Wifi/LAN**: Các thiết bị khác (Laptop, Điện thoại) chỉ cần mở trình duyệt và truy cập vào IP của máy chủ hiển thị trên terminal (ví dụ: `http://192.168.x.x:3000`).

---

## 🎮 Hướng Dẫn Điều Khiển

| Thao Tác | Phím / Chuột | Cảm Ứng (Điện Thoại) |
|---|---|---|
| **Điều hướng** | Di chuột theo hướng muốn di chuyển | Chạm/kéo trên màn hình |
| **Tăng tốc (Boost)** | Giữ `Space` hoặc `Chuột Trái` | Giữ nút `⚡ TỐC` ở góc phải |
| **Bật/Tắt âm thanh** | Nút `🔊` ở góc dưới bên phải | Nút `🔊` ở góc dưới bên phải |
| **Hồi sinh (Respawn)**| Nhấn nút "Hồi Sinh & Tiếp Tục Chiến Đấu" | Nhấn nút hồi sinh |

---

## 📁 Cấu Trúc Dự Án

```
MoBa5v5/
├── package.json          # Thiết lập dự án & dependencies (express, ws)
├── server/
│   ├── server.js         # HTTP Server & WebSocket Server
│   ├── GameRoom.js       # Game Loop (45Hz), va chạm, vòng đấu & broadcast
│   ├── Snake.js          # Lớp Snake (vật lý, tăng trưởng, AI Bot)
│   └── FoodManager.js    # Quản lý mồi thường & mồi rơi từ rắn chết
└── public/
    ├── index.html        # Giao diện chính (Lobby, HUD, Modals)
    ├── css/
    │   └── style.css     # Thiết kế Neon Cyberpunk, kính mờ (Glassmorphism)
    └── js/
        ├── main.js       # Đồng bộ WebSocket, xử lý sự kiện client
        ├── renderer.js   # Canvas Renderer (camera follow, snakes, minimap)
        ├── input.js      # Bộ xử lý điều khiển Chuột/Phím/Touch
        └── audio.js      # Web Audio API Engine
```
