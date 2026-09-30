# 🐍 Multiplayer Snake Arena 2D (Đấu Trường Rắn Săn Mồi Trực Tuyến)

Dự án game **Rắn Săn Mồi Nhiều Người Chơi 2D (Multiplayer Snake Arena)** thời gian thực với đồ họa Cyber Neon hiện đại, mô hình Server-Authoritative, hỗ trợ 2–4+ người chơi cùng phòng và hệ thống Bot AI thông minh.

---

## 🌟 Tính Năng Nổi Bật

1. **Kiến Trúc Server-Authoritative (Node.js + WebSockets)**:
   - Server tính toán toàn bộ logic vật lý (50 Hz), broadcast ở 25 Hz: vị trí, góc xoay, tăng tốc (boost), ăn mồi, va chạm và điểm số.
   - Body rắn gửi mẫu cách một segment và được client nội suy lại; gói điều hướng giới hạn 25 Hz. Lệnh WebSocket và JSON đầu vào giới hạn 16 KiB để giảm lưu lượng và chặn payload bất thường.
   - Chống gian lận (anti-cheat), đồng bộ thời gian thực mượt mà cho 2-4+ người chơi qua mạng LAN hoặc Internet.

2. **Cơ Chế Gameplay Sinh Tồn Gay Cấn**:
   - **Di chuyển & Đổi hướng mượt mà**: Điều khiển theo chuột hoặc cảm ứng trên điện thoại.
   - **Tăng tốc (Boost/Sprint)**: Nhấn giữ `Space` hoặc `Chuột Trái` để chạy 330 đơn vị/giây (tốc độ cơ bản 190), đổi lại có thể mất chiều dài để nhả hạt năng lượng.
   - **Cơ chế chiến đấu (Combat)**: Đầu rắn đâm vào thân rắn đối thủ sẽ lập tức phát nổ thành chùm mồi năng lượng lớn! Kẻ hạ gục nhận điểm thưởng và hiển thị trên Kill Feed.
   - **Vòng rào năng lượng (Arena Boundary)**: Bản đồ hình tròn với tường năng lượng phát sáng — chạm vào sẽ bị tiêu diệt ngay.

3. **Thức Ăn Đa Dạng (Food Orbs)**:
   - Khoảng 456–596 viên ngọc năng lượng phát sáng tùy bản đồ; mật độ được cân bằng theo diện tích sân.
   - Thức ăn đặc biệt khi rắn chết tạo thành các điểm nóng (hotspots) thu hút người chơi tranh cướp.

4. **Bot AI Tự Động**:
   - Duy trì tối đa 6 chiến binh tổng cộng (người chơi và bot) trong phòng thường; phòng Solo 5v5 không có bot.
   - Bot biết né tường, né thân các con rắn khác và săn mồi thông minh.

5. **Bảng Xếp Hạng & Vòng Đấu (Match Rounds)**:
   - Bảng xếp hạng Top 10 thời gian thực trên màn hình với biểu tượng vương miện 👑 cho người dẫn đầu.
   - Bộ đếm thời gian trận đấu mặc định 10 phút; phòng riêng có preset 7, 10 hoặc 15 phút.
   - Màn hình tổng kết (Podium Vàng, Bạc, Đồng) và tự động bắt đầu vòng đấu mới sau thời gian nghỉ.

6. **Âm Thanh Tự Nhiên (Procedural Web Audio API)**:
   - Âm thanh ăn mồi, tăng tốc, nổ tung, diệt địch và kết thúc trận mà không cần tải bất kỳ file mp3 bên ngoài nào.

7. **Cân bằng v1.0**:
   - Mật độ thức ăn giữa bốn map được chuẩn hóa; Sunfire Arena có sân nhỏ hơn nên nhịp chạm trán dày hơn, Ash Maze có nhiều không gian chạy hơn.
   - Nitro kéo dài 3 giây ở 1.9x tốc độ cơ bản, không tiêu hao chiều dài; boost thường nhanh 330 đơn vị/giây nhưng có thể tiêu hao chiều dài.

8. **Biểu Cảm Trong Trận**:
   - Nhận biểu cảm khi lên cấp, mua thêm trong Shop, chọn tối đa 4 ô ở sảnh và dùng bằng phím `4`–`7` hoặc nút cảm ứng.
   - Biểu cảm được broadcast theo sự kiện riêng trong phòng, hiện ngắn phía trên rắn; không được lặp trong snapshot gameplay.

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

1. Tạo Supabase project và chạy [`supabase/schema.sql`](supabase/schema.sql) trước khi deploy.
2. Đẩy repository có file `render.yaml` lên GitHub.
3. Trong Render, chọn **New > Blueprint**, kết nối repository/branch, rồi nhập `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` khi được yêu cầu. Không đưa service-role key vào Git hoặc frontend.
4. Sau khi deploy, kiểm tra `/api/status`; trường `storage` phải là `supabase` trước khi mở service cho người chơi.

Free Web Service có thể spin down sau 15 phút không có traffic và cần khoảng một phút để khởi động lại. Filesystem miễn phí là tạm thời, nên dữ liệu tài khoản và bảng xếp hạng trong `server/data` có thể mất khi service restart, spin down hoặc deploy lại. Băng thông vẫn tính theo quota của workspace mới; theo dõi mục **Billing > Monthly Included Usage**, vì nếu chạm quota Render có thể suspend các service miễn phí đến kỳ tiếp theo.

### Lưu tài khoản và bảng xếp hạng bằng Supabase

1. Tạo project Supabase Free, mở **SQL Editor**, rồi chạy nội dung [`supabase/schema.sql`](supabase/schema.sql).
2. Blueprint khai báo hai biến môi trường dưới dạng secret không đồng bộ vào Git. Nếu cấu hình service thủ công, thêm `SUPABASE_URL` (Project URL) và `SUPABASE_SERVICE_ROLE_KEY` (secret key phía server).
3. Mặc định, lần khởi động đầu với database trống sẽ tạo tài liệu người dùng rỗng và leaderboard mẫu. Không import `server/data/users.json` cũ; tài khoản dùng hash yếu đời trước sẽ bị xóa khi chạy production. `SUPABASE_IMPORT_LOCAL_JSON` không còn phù hợp cho dữ liệu credential cũ.

Server chỉ lưu snapshots của tài khoản và leaderboard vào bảng `game_documents`; game loop, bot, presence và trạng thái trận vẫn ở RAM. Supabase là nguồn dữ liệu chính khi đã cấu hình. Gói Free có giới hạn dung lượng/egress và có thể pause project sau một thời gian không hoạt động; xem [bảng giá Supabase](https://supabase.com/pricing).

**Bảo mật dữ liệu cũ:** `server/data/users.json` từng được Git theo dõi và đã xuất hiện trong lịch sử repository public. Runtime JSON hiện được ignore, nhưng các commit cũ vẫn chứa password hash và session token. Hãy coi thông tin đăng nhập cũ là đã lộ, vô hiệu hóa session, reset tài khoản và dọn toàn bộ lịch sử Git trước khi chia sẻ repository/deploy.

**Xác thực production:** mật khẩu mới yêu cầu 12–128 ký tự và lưu bằng scrypt với salt riêng. Hash cũ không được migrate; production chủ động reset account database nếu còn credential legacy, người chơi phải đăng ký lại. Session token chỉ lưu trong RAM và không được ghi vào JSON/Supabase. Shop, tiền tệ, Battle Pass và cấp rắn hiện lưu trong `localStorage` trên từng trình duyệt, không phải dữ liệu tài khoản đồng bộ/server-authoritative; không coi các chỉ số này là lợi thế gameplay hoặc giá trị mua bán trong ranked.

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
| **Biểu cảm nhanh**    | Phím `4`–`7` (đổi ô ở sảnh)              | Chạm một trong 4 nút biểu cảm |
| **Hồi sinh (Respawn)** | Nhấn nút "Hồi Sinh & Tiếp Tục Chiến Đấu" | Nhấn nút hồi sinh            |

---

## 📁 Cấu Trúc Dự Án

```
MoBa5v5/
├── package.json          # Thiết lập dự án & dependencies (express, ws)
├── server/
│   ├── server.js         # HTTP Server & WebSocket Server
│   ├── GameRoom.js       # Game Loop (50Hz), va chạm, vòng đấu & broadcast
│   ├── Snake.js          # Lớp Snake (vật lý, tăng trưởng, AI Bot)
│   └── FoodManager.js    # Quản lý mồi thường & mồi rơi từ rắn chết
│   ├── PowerupManager.js # Quản lý vật phẩm hỗ trợ trong trận
│   ├── SoloRoomManager.js# Phòng chờ Solo 5v5
│   ├── AccountManager.js # Tài khoản, xác thực & thống kê
│   ├── SocialManager.js  # Presence, bạn bè và chat
│   ├── LeaderboardManager.js
│   └── SupabaseStorage.js# Lưu trữ bền vững tùy chọn
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
