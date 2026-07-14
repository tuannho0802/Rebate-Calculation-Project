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

---
## [2026-06-18] - Fix Raw SQL: snake_case + CTE Recursion Direction

### Vấn Đề
`calculateCascadeDistribution` trong `rebate.service.ts` có 2 lỗi trong đoạn `$queryRaw`:
1. JOIN ngược chiều trong CTE: `INNER JOIN ancestor_tree a ON a.parent_id = n.id` → sẽ không bao giờ walk up đúng
2. Enum cast `'STP_REBATE'` thiếu type cast `::\"RebateType\"` → có thể gây lỗi type mismatch ở PostgreSQL strict mode

### Ghi Chú
Column names trong raw SQL đã dùng `parent_id`, `ib_id`, `asset_type`, `rebate_pips`, `rebate_type` đúng snake_case — không cần thay.

### Fix Applied
- Sửa JOIN từ `a.parent_id = n.id` → `n.id = a.parent_id` (walk up tree đúng hướng)
- Thêm `::\"RebateType\"` cast cho `'STP_REBATE'` literal
- Đổi `ORDER BY a.level DESC` → `ORDER BY a.level ASC` (ancestor gần nhất trước)

### File Modified
- `src/modules/rebate/rebate.service.ts`

### Trạng Thái
- [x] Build: `npx nest build` → 0 errors
- [x] Server khởi động thành công tại localhost:3001
---

---
## [2026-06-18] — Phần: BACKEND

### Phiên Làm Việc
- Agent: Claude Sonnet 4.6 (Thinking)
- Yêu cầu từ: Fix Swagger auth, fix raw SQL column names, manual test Groups A→F

### Đã Triển Khai
- Không có tính năng mới

### Đã Sửa Lỗi
- `src/modules/rebate/rebate.controller.ts`: `@ApiBearerAuth()` không tham số không match với `.addBearerAuth({}, 'Bearer')` trong main.ts → thay toàn bộ thành `@ApiBearerAuth('Bearer')` (class-level + 3 method-level)
- `src/modules/report/report.controller.ts`: tương tự → thay `@ApiBearerAuth()` → `@ApiBearerAuth('Bearer')` (class-level + 2 method-level)
- `src/modules/ib/ib.controller.ts`: 4 method-level thiếu `'Bearer'` argument → đã thêm
- `src/modules/rebate/rebate.service.ts` (`calculateCascadeDistribution`): raw SQL dùng `snake_case` column names sai (Prisma chỉ snake_case tên bảng qua `@@map`, không snake_case cột) → xác nhận qua migration SQL và fix toàn bộ:
  - `parent_id` → `"parentId"`
  - `c.ib_id` → `c."ibId"`
  - `c.asset_type` → `c."assetType"`
  - `c.rebate_type` → `c."rebateType"`
  - `c.rebate_pips as "rebatePips"` → `c."rebatePips"` (trực tiếp)
- `src/modules/rebate/rebate.service.ts`: CTE recursive JOIN sai hướng (`a.parent_id = n.id` → walk xuống) → sửa thành `n.id = a."parentId"` (walk lên ancestor)

### Đã Cập Nhật
- `src/modules/rebate/rebate.controller.ts`: thêm `@ApiBearerAuth('Bearer')` vào từng method có `@UseGuards(SubtreeGuard)`
- `src/modules/report/report.controller.ts`: thêm `@ApiBearerAuth('Bearer')` vào từng method có `@UseGuards(SubtreeGuard)`
- `src/modules/ib/ib.controller.ts`: thêm `@ApiBearerAuth('Bearer')` vào 4 method: `GET :id`, `PUT :id`, `DELETE :id`, `GET :id/children`

### Ghi Chú
- Tên cột thực trong DB (xác nhận qua `prisma/migrations/20260616065558_first_setup/migration.sql`): `"parentId"`, `"ibId"`, `"assetType"`, `"rebateType"`, `"rebatePips"`, `"markupPips"` — tất cả đều camelCase có dấu ngoặc kép
- Tên bảng mới là snake_case (`ib_nodes`, `rebate_configs`) vì có `@@map()` trong schema
- Enum cast trong raw SQL phải dùng `::\"EnumName\"` — đã xác nhận đúng

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## 2026-06-19: Sprint 2 Completed
- Added Dashboard summary endpoint.
- Implemented Notification system with auto-triggers for system events.
- Added IB Performance and Leaderboard endpoints.
- Added Rebate Config History with audit trailing.
- Extracted \getSubtreeIds\ CTE into a shared utility function used across multiple services.
- Ran \	est-sprint2.js\ verifying all core functionalities of Sprint 2 including regression tests for Sprint 1.


## 2026-06-29: Fix Rebate Allocation Flow
- Fixed budget calculation in \updateConfig\ to properly consider total parent budget (\ebatePips + markupPips\) and refund previously allocated pips.
- Implemented decrementing of parent's \ebatePips\ and \markupPips\ budgets when assigning to children.
- Added validation to ensure parent budgets don't go negative.
- Set child's \maxPips\ to the total budget received (\ebatePips + markupPips\) rather than just \markupPips\.
- Added cascading updates to propagate \maxPips\ limit correctly to descendants when a child's total budget changes.
- Recorded RebateConfigHistory and AuditLog for changes made to the parent's configuration.

## [2026-06-29] - Sprint 3 Completed: Security & Feature Gaps
- A3: Added direct-child check for `PUT /rebate/config/:ibId` (`currentUserLevel > 0` must be parent), while Lv0 can set for anyone in the subtree.
- A4: Fixed `ReportService` to validate `filterIbId` is within the caller's subtree (Lv0 bypasses).
- B1: Implemented `PATCH /ib/:id/reset-password` endpoint protected by `Lv0Guard` and `SubtreeGuard`.
- C2: Added `rebateType` filter to `GET /report/transactions`.
- C3: Added 6-month `chartData` to `GET /dashboard/summary` for frontend rendering.
- Passed all 42 tests in `test-sprint3.js` including Sprint 1 & 2 regressions.

## [2026-06-29] - Sprint 4 Completed: Wallet & Payout System
- DB Schema: Added `Wallet` and `Payout` models with `PayoutStatus`.
- Wallet Module: Integrated automatic wallet crediting into `TransactionService`.
- Payout Module: Implemented payout request, approval, and rejection flows with Lv0 and Subtree guards.
- Audit & Notifications: Added `PAYOUT_REQUESTED`, `PAYOUT_APPROVED`, `PAYOUT_REJECTED` audit logs and corresponding system notifications.
- Seed Data: Automated calculation of legacy balances and wallet generation for existing IB nodes.
- Testing: Created `test-sprint4.js` to cover full payout flows, regressions, and balance calculations. All tests pass successfully.

---
## [2026-07-09] - Rebate Type as String + Frontend UI Support

### Phiên Làm Việc
- Agent: GitHub Copilot
- Yêu cầu từ: Chuyển `rebateType` sang `String` trong Prisma + cập nhật DTO/service và thêm UI nhập rebateType trên frontend

### Đã Triển Khai
- `prisma/schema.prisma`: `RebateConfig.rebateType` đã được định nghĩa là `String` với default `STP_REBATE`
- `src/modules/rebate/dto/update-config.dto.ts`: `rebateType` không còn bắt buộc enum, nhận giá trị chuỗi và mặc định `STP_REBATE`
- `src/modules/rebate/rebate.service.ts`: cập nhật truy vấn `ibId_assetType_rebateType` và `upsert` để dùng `rebateType` string
- `rebate-frontend/src/app/[locale]/(dashboard)/dashboard/tree/edit/[id]/page.tsx`: thêm ô nhập `Rebate Type` và gửi giá trị người dùng nhập kèm với payload cập nhật

### Kiểm Tra
- `rebate-backend`: `npm run build` thành công sau khi sửa thiếu import `IsEnum` và sinh lại Prisma Client

---

## [2026-07-10] - Fix Rebate/Markup allocation validation (backend)

### Phiên Làm Việc
- Agent: GitHub Copilot
- Yêu cầu từ: Sửa logic giới hạn phân bổ rebate/markup cho sub-IB — đảm bảo dùng ngân sách còn lại của parent và validate delta allocation chính xác.

### Đã Triển Khai
- `src/modules/rebate/rebate.service.ts`: sửa logic `updateConfig` để
  - kiểm tra delta allocation (`deltaRebate`, `deltaMarkup`) so với ngân sách còn lại của parent (`parent.rebatePips`, `parent.markupPips`),
  - dùng phép toán rõ ràng (parentRemaining - delta) thay vì `decrement` với giá trị có thể âm,
  - trả lỗi rõ ràng `REBATE_EXCEEDS_MAX` hoặc `MARKUP_EXCEEDS_MAX` với thông tin delta và giới hạn.
- Ghi `RebateConfigHistory` và `AuditLog` như trước cho các thay đổi parent/child.

### Lý Do
- Tránh trường hợp tính nhầm khi cập nhật lại child (increase/decrease), và cung cấp thông báo lỗi rõ ràng hơn cho frontend.

### Trạng Thái
- [x] Đã chỉnh sửa source, code biên dịch và server khởi động thành công
- [ ] Cần chạy thêm test tích hợp PUT `/api/rebate/config/:ibId` từ UI để xác minh hành vi multi-row

- `rebate-frontend`: build hiện tại gặp lỗi Typescript trong `src/lib/api/client.ts` do typed Axios headers; đã sửa bằng cast `as any` để giữ header Authorization hoạt động với `AxiosRequestHeaders`

### Trạng Thái
- [x] Backend build sạch
- [ ] Frontend build cần xác nhận lại sau khi sửa lỗi header Authorization

---
## [2026-07-10] - Fix Frontend Rebate Edit Page Max Validation

### Phiên Làm Việc
- Agent: GitHub Copilot
- Yêu cầu từ: Cập nhật giao diện chỉnh sửa rebate cho Sub-IB, đảm bảo giá trị `Rebate Max` và `Markup Max` hiển thị đúng theo mẫu account-type, không lấy từ config đã lưu.

### Đã Triển Khai
- `rebate-frontend/src/app/[locale]/(dashboard)/dashboard/tree/edit/[id]/page.tsx`
  - Loại bỏ `savedAssets` khỏi phép tính giới hạn tối đa cho rebate và markup.
  - `getRebateMax()` giờ trả về giá trị `maxCeiling` từ account-type template hoặc fallback mặc định, không trả về rebate đã lưu.
  - `getMarkupMax()` giờ trả về share markup từ account-type templates, không dùng giá trị markup đã lưu.
  - `handleSave()` giờ validate đúng `rebateMax` và `markupMax` mỗi lần lưu.

### Xác Thực
- Kiểm tra TypeScript / lỗi: `rebate-frontend/src/app/[locale]/(dashboard)/dashboard/tree/edit/[id]/page.tsx` → không có lỗi.
- Chạy kịch bản backend `node .\scratch\test-rebate-cascade.js` → `31 passed, 0 failed`.

### Ghi Chú
- Backend cascade allocation và rollback đã hoạt động đúng theo logic cây.
- Lỗi over-budget có thể trả về `REBATE_EXCEEDS_MAX` hoặc `MARKUP_EXCEEDS_MAX` tuỳ vào giới hạn nào bị vượt trước.

---
## [2026-07-13] - Verification & Environment Debugging

### Phi�n L�m Vi?c
- Agent: Antigravity
- Y�u c?u t?: Ki?m tra t�ch h?p Frontend v� l?i k?t n?i Database

### �� C?p Nh?t
- Kh�ng c� thay d?i n�o v? m� ngu?n (Source Code) trong Backend v�o h�m nay.
- Ti?n h�nh g? l?i (debug) s? c? s?p server do k?t c?ng (EADDRINUSE) v� thay d?i DATABASE_URL sang m�i tru?ng Neon DB nhung chua push schema. V?n d? d� du?c kh?c ph?c ho�n to�n b?ng c�ch restart server v� clear cache port.
- X�c nh?n l?i to�n b? Router Explorer v� Prisma Client (v5.22.0) ch?y ?n d?nh ? m�i tru?ng localhost.

### Tr?ng Th�i
- [x] Backend ho�n to�n s?n s�ng cho qu� tr�nh Deploy (V� d?: render, railway, v.v.)


---
## [2026-07-14] - Admin RBAC, Trash Can, Encoding Fix

### Phiên Làm Việc
- Agent: Antigravity
- Yêu cầu từ: Triển khai phân quyền Admin/IB, module Trash Can, bảo vệ Root Admin, sửa lỗi encoding database

### Đã Triển Khai
- **Schema & Migration:**
  - Thêm enum Role (ADMIN, IB) vào prisma/schema.prisma
  - Thêm field 
ole, isRootAdmin vào model IbNode
  - Migration 20260714022745_add_admin_role và 20260714031045_add_root_admin_flag
- **Guards mới (src/common/guards/):**
  - 
oles.guard.ts — phân quyền theo role (ADMIN/IB), dùng @Roles('ADMIN') decorator
  - self-finance.guard.ts — chặn Admin tạo payout cho chính mình
  - protect-root-admin.guard.ts — chặn mọi thao tác phá hủy lên tài khoản isRootAdmin=true
- **Module Admin (src/modules/admin/):**
  - POST /api/admin/users — tạo Admin mới
  - GET /api/admin/users — liệt kê Admin đang active
  - PATCH /api/admin/users/:id — sửa thông tin (không cho sửa role/isRootAdmin)
  - DELETE /api/admin/users/:id — soft-delete (deactivate), chặn Root Admin
- **Module Trash (src/modules/trash/):**
  - GET /api/trash — danh sách tài khoản deactivated
  - PATCH /api/trash/:id/restore — khôi phục tài khoản
  - DELETE /api/trash/:id/permanent — hard delete (chặn nếu còn FK relations)
- **Xóa route cũ:** PATCH /api/ib/:id/restore đã bị gỡ khỏi ib.controller.ts và ib.service.ts
- **Cập nhật IB module:** SubtreeGuard giờ chỉ check 1 cấp trực tiếp (depth=1), không dùng CTE đệ quy
- **RBAC toàn bộ service:** Report, Dashboard, Wallet, Payout, Transaction chỉ scope data theo parentId thay vì getSubtreeIds()
- **Encoding fix:** Xóa và tạo lại DB rebate_db với ENCODING='UTF8' thay vì WIN1252; revert toàn bộ text tiếng Việt bị mất dấu trong notification/transaction/ib/trash service

### Đã Sửa Lỗi
- Lỗi DI không resolve được NotificationService trong RebateModule → thêm NotificationModule vào imports
- Lỗi isolatedModules trong trash.controller.ts → dùng import * as express
- Lỗi encoding WIN1252 làm mất dấu tiếng Việt trong notification body/title → tạo lại DB UTF8
- try-catch rỗng trong notification.service.ts → thêm console.error với đủ context
- Mật khẩu test cũ '123456' trong test-admin-rbac.js → đổi sang 'Test@1234' khớp seed

### Đã Cập Nhật
- prisma/seed.ts — thêm Root Admin admin_test@azrebate.com (isRootAdmin=true), xử lý cleanup FK
- scratch/test-admin-rbac.js — 9 test cases RBAC Admin/IB
- scratch/test-admin-management.js — 14 test cases quản lý Admin + Trash Can
- src/app.module.ts — import AdminModule, TrashModule

### Ghi Chú
- Root Admin admin_test@azrebate.com chỉ dùng cho local/dev. KHÔNG mang lên production.
- FE chưa cập nhật: src/lib/api/ib.ts dòng 52 vẫn gọi /ib/:id/restore (route đã bị gỡ) — PENDING fix FE.

### Trạng Thái
- [x] 9/9 test-admin-rbac.js PASS
- [x] 14/14 test-admin-management.js PASS
- [!] FE còn 1 route restore cũ chưa cập nhật (PENDING)


---
## [2026-07-14] — Phần: BACKEND

### Phiên Làm Việc
- Agent: Composer
- Yêu cầu từ: Đổi tên Bulk Operation → Rebate Management; thêm endpoint bulk thật ở BE;
  role-based nav ở FE (Phần B không đổi BE)

### Đã Triển Khai
- `src/modules/rebate/dto/bulk-update-config.dto.ts`: DTO mới `BulkUpdateRebateConfigDto` +
  `BulkRebateItemDto` với `@ArrayMaxSize(200)`, `@ArrayNotEmpty`, nested validation
- `src/modules/rebate/rebate.controller.ts`: `PUT /rebate/config/bulk` đặt TRƯỚC
  `PUT /rebate/config/:ibId`, guard `RolesGuard` + `@Roles('ADMIN')`
- `src/modules/rebate/rebate.service.ts`: method `bulkUpdateConfig()` — lặp từng item, gọi lại
  `updateConfig()` trong try/catch riêng, trả `results/successCount/failCount`

### Đã Cập Nhật
- `01_API_CONTRACT.md`: Changelog + section `PUT /rebate/config/bulk` (docs trước code)

### Ghi Chú
- Không thêm mã lỗi mới — tái sử dụng mã có sẵn từ `updateConfig()`
- Partial success: mỗi item độc lập, không transaction bao trùm toàn request
- Route order quan trọng: `config/bulk` phải đứng trước `config/:ibId`

### Trạng Thái
- [ ] Tất cả nội dung triển khai biên dịch không có lỗi
- [ ] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [ ] Các type vẫn khớp với 02_DATA_MODELS.md
---
---
## [2026-07-14] — Phần: BACKEND

### Phiên Làm Việc
- Agent: Composer
- Yêu cầu từ: Viết và chạy scratch test `PUT /rebate/config/bulk`
  (`scratch/test-bulk-rebate.js`)

### Đã Triển Khai
- `scratch/test-bulk-rebate.js`: script HTTP thuần (fetch) verify 7 test case bulk endpoint
- `.gitignore`: thêm `scratch/` để không commit script test tay

### Ghi Chú
- Backend đã chạy tại `http://localhost:3001/api`; login `admin_test@azrebate.com` +
  `lv1-a@test.com` OK
- Script **crash** sau TEST setup: `GET /ib/tree?depth=all` với ADMIN trả `data` là **mảng**
  root MIB (`ib.service.ts:103-107`), nhưng `flatten(treeRes.data)` kỳ vọng **một object node**
  → `flat.length = 0` → `targetA` undefined → crash tại dòng log email
- TEST 1–7 **chưa chạy** do crash trước `try` block; DB **không bị sửa** (chưa gọi bulk PUT)
- Cần sửa script: flatten từng phần tử mảng root HOẶC dùng `treeRes.data.flatMap(flat)`
  trước khi chạy lại

### Trạng Thái
- [!] Tất cả nội dung triển khai biên dịch không có lỗi — scratch test: 1 passed, 1 failed,
  script crash (chưa đủ 7 test)
- [ ] Không có chức năng cũ nào bị hỏng
- [ ] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [ ] Các type vẫn khớp với 02_DATA_MODELS.md
---

---
## [2026-07-14] — Phần: BACKEND

### Phiên Làm Việc
- Agent: Composer
- Yêu cầu từ: Mở rộng seed data đầy đủ tất cả bảng (Wallet, Payout, Notification,
  AuditLog, RebateConfigHistory, Templates) + thêm MIB thứ hai

### Đã Triển Khai
- `prisma/seed.ts`: thêm nhánh `mib2@test.com` → `lv1-c@test.com` → `lv2-c2@test.com`
  (email `lv2-c@test.com` đã tồn tại dưới `lv1-a`, không thể trùng)
- Seed Wallet (11 IB, không Admin), Payout (8, đủ 4 status), Notification (12),
  AuditLog (10), RebateConfigHistory (200 — mỗi rebate_config 1 dòng),
  AccountTypeTemplate + MarkupLinkTemplate (2 mỗi loại, 1 per MIB)
- Chạy `npx prisma migrate reset --force` thành công

### Ghi Chú
- Verify COUNT: ib_nodes=12, wallets=11, payouts=8, notifications=12, audit_logs=10,
  rebate_config_history=200, account_type_templates=2, markup_link_templates=2
- Login OK: `mib2@test.com`, `lv1-c@test.com`, `lv2-c2@test.com`, `lv2-c@test.com`
  (cũ), `admin_test@azrebate.com`
- `GET /ib/tree?depth=all` (ADMIN): `data` là mảng **2 phần tử**
  `[mib@test.com, mib2@test.com]`

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng (email/mật khẩu seed cũ giữ nguyên)
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

---
## [2026-07-14] — Phần: BACKEND

### Phiên Làm Việc
- Agent: Composer
- Yêu cầu từ: Admin cấu hình MaxPips tuỳ chỉnh theo MIB + vá 2 bug maxPips; chạy scratch test

### Đã Triển Khai
- `rebate.service.ts`: fix 2.1 `maxPips: limit` trong upsert `update`; fix 2.2 giữ `existing.maxPips`
  khi MIB không có parentConfig; `setMibMaxOverride` + `cascadeMaxOverrideToSubtree`
- `rebate.controller.ts`: `PUT /rebate/config/mib/:mibId/max-override` (ADMIN, trước `:ibId`)
- `dto/mib-max-override.dto.ts`: DTO overrides
- `prisma/seed.ts`: mib2 D_FOREX maxPips=8 minh hoạ
- `scratch/test-mib-max-override.js`: 11 test cases HTTP

### Ghi Chú
- `bulkUpdateConfig` loop gọi `updateConfig` — không cần sửa riêng
- Scratch test: **11 passed, 0 failed** (`node scratch/test-mib-max-override.js`)
- TEST 5 dùng rebatePips=2, markupPips=3 (trong trần 8) — orig seed markupPips=10 vượt trần sau override

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng — scratch test pass
- [ ] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [ ] Các type vẫn khớp với 02_DATA_MODELS.md
---
