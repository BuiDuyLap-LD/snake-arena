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

### Deploy bằng Render Blueprint

1. Đẩy repository có file `render.yaml` lên GitHub.
2. Đăng nhập account Render mới, chọn **New > Blueprint**, rồi kết nối repository và branch cần deploy.
3. Render tạo Web Service miễn phí tại Singapore. Sau khi deploy, mở URL service và kiểm tra `/api/status`.

Free Web Service có thể spin down sau 15 phút không có traffic và cần khoảng một phút để khởi động lại. Filesystem miễn phí là tạm thời, nên dữ liệu tài khoản và bảng xếp hạng trong `server/data` có thể mất khi service restart, spin down hoặc deploy lại. Băng thông vẫn tính theo quota của workspace mới; theo dõi mục **Billing > Monthly Included Usage**, vì nếu chạm quota Render có thể suspend các service miễn phí đến kỳ tiếp theo.

### Lưu tài khoản và bảng xếp hạng bằng Supabase

1. Tạo project Supabase Free, mở **SQL Editor**, rồi chạy nội dung [`supabase/schema.sql`](supabase/schema.sql).
2. Trong Render, mở service → **Environment**, thêm `SUPABASE_URL` (Project URL) và `SUPABASE_SERVICE_ROLE_KEY` (secret key phía server). Không đưa key này vào `public/` hoặc commit lên GitHub.
3. Mặc định, lần khởi động đầu với database trống sẽ tạo tài liệu người dùng rỗng và leaderboard mẫu. Nếu đã rà soát dữ liệu local và muốn nhập `server/data/*.json`, đặt `SUPABASE_IMPORT_LOCAL_JSON=true` trước lần khởi động đầu. Quá trình này xóa token phiên đã lưu, nên người chơi cần đăng nhập lại. Sau khi hai tài liệu được tạo, có thể gỡ biến import.

Server chỉ lưu snapshots của tài khoản và leaderboard vào bảng `game_documents`; game loop, bot, presence và trạng thái trận vẫn ở RAM. Supabase là nguồn dữ liệu chính khi đã cấu hình. Gói Free có giới hạn dung lượng/egress và có thể pause project sau một thời gian không hoạt động; xem [bảng giá Supabase](https://supabase.com/pricing).

**Bảo mật dữ liệu cũ:** `server/data/users.json` đang được Git theo dõi và đã có bản ghi trong lịch sử repository public. Cờ import chỉ xóa token phiên; nó không xóa password hash khỏi Git history. Hãy xem xét reset mật khẩu người chơi và dọn dữ liệu nhạy cảm khỏi repository trước khi coi các tài khoản cũ là an toàn.

### Chia sẻ game miễn phí qua Cloudflare Quick Tunnel

Quick Tunnel tạo một URL HTTPS công khai và hỗ trợ WebSocket. Đây là cách miễn phí để bạn bè chơi thử mà không cần deploy lên Render; client tự chuyển kết nối game sang `wss://` khi mở bằng HTTPS.

1. Cài `cloudflared` cho Windows từ [trang tải chính thức](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/).
2. Mở terminal thứ nhất trong thư mục dự án và chạy `npm install`, sau đó `npm start`.
3. Mở terminal thứ hai và chạy `cloudflared tunnel --url http://localhost:3000`.
4. Mở URL `https://...trycloudflare.com` mà terminal thứ hai in ra và gửi URL đó cho người chơi.

Giữ cả hai terminal chạy và không để máy tính ngủ. Đây là tunnel thử nghiệm, không có cam kết uptime; URL ngẫu nhiên sẽ đổi khi tạo tunnel mới. Dữ liệu tài khoản và bảng xếp hạng vẫn nằm ở `server/data` trên máy này. Phương án này miễn phí nhưng máy của bạn chính là máy chủ, nên không phù hợp để chạy 24/7. Tạo service Render khác trong cùng workspace cũng không làm mới hạn mức băng thông của workspace.

### Deploy trên host có Docker

Ứng dụng cần một tiến trình Node.js liên tục và hỗ trợ WebSocket; không deploy dưới dạng static site hoặc serverless function. `Dockerfile` ở thư mục gốc dùng được trên Railway hoặc VPS có Docker. Tạo persistent volume và mount tại `/app/server/data` để giữ tài khoản/bảng xếp hạng qua các lần deploy. Các host cloud có thể tính phí hoặc giới hạn mức dùng miễn phí.

---

## 🎮 Hướng Dẫn Điều Khiển

| Thao Tác               | Phím / Chuột                             | Cảm Ứng (Điện Thoại)         |
| ---------------------- | ---------------------------------------- | ---------------------------- |
| **Điều hướng**         | Di chuột theo hướng muốn di chuyển       | Chạm/kéo trên màn hình       |
| **Tăng tốc (Boost)**   | Giữ `Space` hoặc `Chuột Trái`            | Giữ nút `⚡ TỐC` ở góc phải  |
| **Bật/Tắt âm thanh**   | Nút `🔊` ở góc dưới bên phải             | Nút `🔊` ở góc dưới bên phải |
| **Hồi sinh (Respawn)** | Nhấn nút "Hồi Sinh & Tiếp Tục Chiến Đấu" | Nhấn nút hồi sinh            |

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
