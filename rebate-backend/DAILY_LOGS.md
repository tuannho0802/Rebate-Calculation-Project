# Nhật Ký Daily Workflows — BACKEND

> Chỉ được thêm vào. Không được sửa hay xóa bất kỳ entry nào.
> Định dạng được quy định trong docs/10_DAILY_WORKFLOWS_GUIDE.md.
> Một entry cho mỗi phiên làm việc của agent. Thêm entry mới xuống cuối.

---
## [2026-06-16] — Phần: BACKEND

### Phiên Làm Việc
- Agent: Khởi tạo ban đầu
- Yêu cầu từ: Thiết lập base project — NestJS + Prisma + PostgreSQL

### Đã Triển Khai
- prisma/schema.prisma: toàn bộ các model — IBNode, RebateConfig, RebateTransaction, RefreshToken
- prisma/migrations/: migration đầu tiên qua `prisma migrate dev --name first_setup`
- prisma/seed.ts: tài khoản MIB + Lv1/Lv2/Lv3, rebate configs, transactions trải đều 3 tháng
- src/main.ts: bootstrap NestJS, global prefix /api, CORS, global filters và interceptors
- src/common/guards/jwt.guard.ts: JWT guard bảo vệ route
- src/common/guards/subtree.guard.ts: kiểm tra quyền truy cập subtree đệ quy
- src/common/interceptors/response.interceptor.ts: envelope chuẩn { success, data, error, meta }
- src/common/filters/http-exception.filter.ts: map HttpException sang định dạng error code
- src/modules/auth/: đăng nhập, refresh token, đăng xuất, JWT strategy
- src/modules/ib/: thông tin cá nhân, tạo sub-IB, truy vấn cây
- src/modules/rebate/: quản lý config rebate, engine tính toán
- src/modules/report/: tổng hợp và danh sách giao dịch

### Đã Sửa Lỗi
- Không có (khởi tạo ban đầu)

### Đã Cập Nhật
- Không có (khởi tạo ban đầu)

### Ghi Chú
- DATABASE_URL trỏ đến PostgreSQL local qua DBngin trên port 5432
- Seed tạo tài khoản test: mib@test.com, lv1-a@test.com, lv2-a@test.com / mật khẩu Test@1234
- rebate_user cần quyền CREATEDB để Prisma tạo shadow database khi chạy migrate dev

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

---
## [2026-06-16] — Phần: SWAGGER UI REDESIGN

### Phiên Làm Việc
- Agent: UI Improvement Pass
- Yêu cầu từ: Cải thiện UI Landing Page và Swagger UI — KHÔNG thay đổi logic API

### Đã Triển Khai

**Landing Page (GET /)**
- Redesign toàn bộ card layout: Inter font, max-width 480px, responsive mobile
- Header với logo gradient dot + version badge
- Status bar với environment tag (LOCAL/PRODUCTION) + pulsing ● Online dot (CSS animation)
- CTA button gradient #00c896 → #00a878 với hover lift + arrow animation
- Test accounts table: MIB / Lv1 / Lv2 hiển thị rõ ràng với monospace email
- Base URL + Docs URL với nút **Copy** clipboard (→ "✓ Copied" feedback)
- Background #0f1117, card #1a1d2e, border #2d3148

**Swagger Auto-Login Bar (swagger-custom.js)**
- Label đổi thành "🔑 Quick Login:" — nhất quán với landing page
- Input focus glow màu #00c896
- Loading state: disable button + "Logging in..." text
- Success feedback: "✅ Logged in as email@..." (hiện email đã login)
- Error feedback: "❌ Invalid credentials" màu đỏ
- localStorage persistence: lưu email + password, auto-login khi reload
- Enter key trên input field kích hoạt login

**Swagger UI Theme (customCss trong main.ts)**
- Topbar màu #1a1d2e với border-bottom nhất quán với landing page
- Ẩn Smartbear logo/link hoàn toàn
- HTTP method badges màu rõ ràng: GET=xanh dương, POST=xanh lá, PUT=cam, DELETE=đỏ
- Response body có max-height: 320px + overflow scroll
- Authorize button màu #00c896 đồng nhất

**Controller Tags**
- `AuthController`   → `@ApiTags('🔐 Authentication')`
- `IbController`     → `@ApiTags('🌳 IB Management')`
- `RebateController` → `@ApiTags('💰 Rebate')`
- `ReportController` → `@ApiTags('📊 Report')`
- `AppController`    → `@ApiExcludeController()` (ẩn khỏi Swagger)
- `DocsController`   → `@ApiExcludeController()` (ẩn khỏi Swagger)

### Files Modified
- `src/app.controller.ts` (landing page HTML/CSS + swagger-custom.js)
- `src/main.ts` (customCss injection)
- `src/modules/auth/auth.controller.ts` (@ApiTags emoji)
- `src/modules/ib/ib.controller.ts` (@ApiTags emoji)
- `src/modules/rebate/rebate.controller.ts` (@ApiTags emoji)
- `src/modules/report/report.controller.ts` (@ApiTags emoji)
- `src/modules/docs/docs.controller.ts` (@ApiExcludeController + cleanup)

### Ràng Buộc Tuân Thủ
- Không sửa bất kỳ service, guard, interceptor, hay DTO nào
- Không thay đổi API response format
- Không thêm package mới
- DAILY_LOGS.md chỉ được APPEND

### Trạng Thái
- [x] Build: 0 errors (`npx nest build`)
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có API logic nào bị thay đổi
- [x] Không có package mới được thêm
---

---
## [2026-06-16] - Landing Page Full Redesign

### Changes
- Complete redesign theo SaaS API platform style
- Navbar sticky với smooth scroll navigation (Tính năng | API Endpoints | Tài liệu | Đăng nhập)
- Hero section với gradient background (#667eea → #764ba2) và terminal mockup dark box
- Features grid: 6 cards × 2 hàng (JWT, IB Hierarchy, Rebate Engine, Subtree Guard, Reports, NestJS+Prisma)
- API Endpoints preview: 2 cột với method badges màu (GET/POST/PUT/DELETE)
- Login form với redirect to Swagger UI + localStorage token flow ('swagger_token')
- Footer: 4 cột (Logo+tagline, Product, Resources, Company) + social icons SVG
- Contact: hoangtuanft0802@gmail.com hiển thị trong info box và footer
- swagger-custom.js: thêm logic đọc localStorage key 'swagger_token' từ landing page login → auto preauthorize

### Files Modified
- `src/app.controller.ts` (toàn bộ HTML landing page + swagger-custom.js)

### Ràng Buộc Tuân Thủ
- Không thay đổi bất kỳ file nào khác ngoài app.controller.ts
- Không thay đổi logic API, endpoint, business logic, hay Swagger config
- Không thêm package mới
- DAILY_LOGS.md chỉ được APPEND

### Trạng Thái
- [x] Build: 0 errors (`npx nest build`)
- [x] Landing page: Navbar, Hero, Features, Endpoints, Login, Footer — đầy đủ 6 section
- [x] Login flow: POST /api/docs/login → localStorage 'swagger_token' → redirect /api/docs
- [x] swagger-custom.js: đọc 'swagger_token' từ localStorage, auto preauthorize, xóa sau khi dùng
- [x] Responsive: mobile breakpoint 640px, tablet 900px
✅ Complete
---

---
## [2026-06-16] - Login Flow Fix + Animations

### Changes  
- Fixed auto-authorize flow: landing login → localStorage → Swagger preauthorize
- Replaced emoji password toggle with SVG icons
- Added scroll reveal animations (IntersectionObserver)
- Added hero terminal typing effect
- Added navbar scroll blur effect
- Added stats counter animation
- Added button loading/success states
- Fixed Swagger topbar: show logged-in state, added logout button

### Files Modified
- src/app.controller.ts (login JS fix, animations)
- src/swagger-custom.js (localStorage read + preauthorize on load)

### Status
✅ Complete
---

---
## [2026-06-16] - Debug Landing Page Blank Sections

### Problem
- Features grid, API Endpoints, Login form không render
- IntersectionObserver không trigger được

### Root Cause
- Element bị đặt CSS `opacity: 0` cố định từ đầu, và IntersectionObserver thỉnh thoảng không kích hoạt chính xác để thêm class `visible` hoặc xóa bỏ class này nên các section đó biến mất hoàn toàn. Thêm nữa terminal animation code sử dụng IIFE được chạy trước khi DOM load xong làm cho element chưa xuất hiện dẫn tới không thay đổi được UI.

### Fix Applied
- Cập nhật `.animate-on-scroll` thành `opacity: 1` mặc định.
- Chuyển logic đặt `opacity = 0` và khởi tạo `IntersectionObserver` vào sự kiện `DOMContentLoaded` để chắc chắn DOM đã render.
- Bọc terminal typing script và stats counter trong sự kiện `DOMContentLoaded` và bỏ dùng Intersection Observer cho stats (chuyển sang `setTimeout(..., 500)` để đảm bảo counter chạy ổn định).

### Status
✅ Fixed
---

---
## [2026-06-16] - Fix Navbar Overlap + Animation Issues

### Problems Fixed
- Navbar overlap hero: added dynamic padding-top measurement
- Scroll animations: replaced IntersectionObserver with scroll event (more reliable)
- Stats counter: fixed element IDs mismatch, used requestAnimationFrame
- Terminal typing: fixed ID mismatch

### Root Cause
IntersectionObserver không reliable khi elements đã trong viewport lúc load.
Giải pháp: dùng scroll event + getBoundingClientRect() đơn giản hơn.

### Status
✅ Fixed
---

---
## [2026-06-16] - Tách Landing Page ra static files

### Changes
- Tách HTML → src/public/index.html
- Tách CSS → src/public/styles.css  
- Tách JS  → src/public/app.js
- app.controller.ts chỉ còn sendFile()
- nest-cli.json: thêm assets copy config
- main.ts: useStaticAssets() cho thư mục public

### Why
HTML/CSS/JS trong TypeScript string rất khó debug,
dễ bị escape lỗi, không có syntax highlight.

### Status
✅ Complete
---

---
## [2026-06-18] - IB Rebate Backend: Improvement Pass

### Phiên Làm Việc
- Agent: Thực hiện các thay đổi schema & chức năng cho IB/Rebate
- Yêu cầu từ: Task IB Rebate Backend (Improvement Pass)

### Đã Triển Khai
- TASK 1: Thêm field `name` vào `IbNode` (schema, seed, DTO, services, responses).
- TASK 2: Thêm endpoint `PUT /ib/:id` để update profile IB (UpdateIbDto).
- TASK 3: Thêm endpoint `DELETE /ib/:id` (Soft-delete/Deactivate) với trường `isActive`, chặn logic login ở guard.
- TASK 4: Mở rộng `RebateConfig` với enum `RebateType` (schema, unique constraint, DTOs, GET config response, seed).
- TASK 5: Thêm `GET /ib/:id/children` trả về danh sách sub-IB trực tiếp có phân trang.
- TASK 6: Thay thế vòng lặp trong RebateService bằng CTE (`WITH RECURSIVE`) qua `calculateCascadeDistribution` query đệ quy lên cây ancestor.
- TASK 7: Cập nhật `updateConfig` để tuân thủ cascade validation (`B.rebatePips + B.markupPips <= A.markupPips`).
- TASK 8: Thêm `POST /auth/change-password` với `ChangePasswordDto`, verify pass cũ và vô hiệu hoá toàn bộ refresh token hiện có.

### Files Modified
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/modules/ib/dto/create-ib.dto.ts`
- `src/modules/ib/dto/update-ib.dto.ts` (new)
- `src/modules/ib/ib.controller.ts`
- `src/modules/ib/ib.service.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/dto/change-password.dto.ts` (new)
- `src/modules/rebate/dto/update-config.dto.ts`
- `src/modules/rebate/rebate.service.ts`
- `src/modules/rebate/rebate.controller.ts`

### Trạng Thái
- [x] Code đã được triển khai và pass qua `npx nest build`.
- [ ] Database chưa chạy được migration do lỗi connection với Postgres DBngin (`localhost:5432` offline). Cần user bật DB và chạy `npx prisma migrate dev --name upgrade_schema && npx prisma generate`
---

---
## [2026-06-18] - Add @ApiBearerAuth() to All Protected Endpoints

### Phiên Làm Việc
- Agent: Swagger Authorization Fix
- Yêu cầu từ: Thêm @ApiBearerAuth() vào tất cả endpoint còn thiếu

### Kiểm Tra & Phân Tích
- `main.ts`: Đã có `.addBearerAuth()` đúng chuẩn với scheme `'Bearer'` → **không cần thay đổi**
- `rebate.controller.ts`: Class-level `@ApiBearerAuth()` ở dòng 11 nhưng từng method cần gắn riêng để Swagger hiển thị lock icon đúng → **đã thêm**
- `report.controller.ts`: Class-level `@ApiBearerAuth()` ở dòng 10 nhưng từng method thiếu → **đã thêm**
- `ib.controller.ts`: Class-level `@ApiBearerAuth('Bearer')` nhưng từng method `@UseGuards(SubtreeGuard)` thiếu decorator → **đã thêm**
- `auth.controller.ts`: `logout` và `change-password` đã có `@ApiBearerAuth('Bearer')` → **không cần thay đổi**

### Endpoints Đã Thêm @ApiBearerAuth()
**rebate.controller.ts:**
- `GET /rebate/config/:ibId`
- `PUT /rebate/config/:ibId`
- `GET /rebate/calculate`

**report.controller.ts:**
- `GET /report/summary`
- `GET /report/transactions`

**ib.controller.ts:**
- `GET /ib/:id`
- `PUT /ib/:id`
- `DELETE /ib/:id`
- `GET /ib/:id/children`

### Trạng Thái
- [x] Build: `npx nest build` → 0 errors
- [x] Không có logic, guard, service, DTO nào bị thay đổi
- [x] DAILY_LOGS.md đã được append
---