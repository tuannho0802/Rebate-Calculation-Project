# 12 — PHÂN TÍCH CẤU TRÚC TOÀN DỰ ÁN (Project Structure Analysis)

> **Stack:** NestJS (Backend) · NextJS 15 App Router (Frontend) · Prisma ORM · PostgreSQL  
> **Môi trường deploy:** Vercel (cả 2 đầu)  
> **Ngôn ngữ UI:** i18n — `vi` / `en` (next-intl)  
> **Thời điểm phân tích:** 2026-07-14 (cập nhật)

## Changelog
- **2026-07-14**:
  - Thêm module `admin`, `trash` vào FILE TREE và DEPENDENCY MAP.
  - Cập nhật guards mới: `roles.guard.ts`, `self-finance.guard.ts`, `protect-root-admin.guard.ts`.
  - Cập nhật danh sách migration (thêm `add_admin_role`, `add_root_admin_flag`).
  - Đánh giá lại R1 (getTree) đã được xử lý 1 cấp; G3 cập nhật (không còn dùng CTE).

---

## FILE TREE

```text
Rebate project/                          ← Root workspace
├── 00_PROJECT_OVERVIEW.md
├── 01_API_CONTRACT.md
├── 02_DATA_MODELS.md
├── 03_AUTH_FLOW.md
├── 04_BACKEND_GUIDE.md
├── 05_FRONTEND_GUIDE.md
├── 06_ERROR_CODES.md
├── 07_ENVIRONMENTS.md
├── 08_LOCAL_MIGRATION_SEED.md
├── 09_CODE_STANDARDS.md
├── 10_DAILY_WORKFLOWS_GUIDE.md
├── 11_DAILY_LOG_AGENT.MD
├── 12_PROJECT_STRUCTURE_ANALYSIS.md    ← File này
│
├── rebate-backend/                      ★ NestJS Backend
│   ├── prisma/                          ★ Prisma ORM
│   │   ├── schema.prisma               ← Định nghĩa toàn bộ models & relations
│   │   ├── seed.ts                     ← Script seed dữ liệu mẫu
│   │   └── migrations/                 ★ Migration history
│   │       ├── 20260616065558_first_setup/
│   │       ├── 20260618030832_upgrade_schema/
│   │       ├── 20260619062146_add_transaction_fields_audit_log/
│   │       ├── 20260619074740_sprint2_models/
│   │       ├── 20260622043415_init/
│   │       ├── 20260629084935_add_wallet_payout/
│   │       ├── 20260709065943_add_ibnode_profile_fields/
│   │       ├── 20260711120000_sync_db_with_schema/
│   │       ├── 20260713053403_sync_account_types_and_templates/
│   │       ├── 20260714022745_add_admin_role/
│   │       └── 20260714031045_add_root_admin_flag/   ← Migration mới nhất
│   ├── src/
│   │   ├── main.ts                     ← Bootstrap: Swagger, CORS, ValidationPipe, global prefix /api
│   │   ├── app.module.ts               ← Root module import toàn bộ sub-modules
│   │   ├── app.controller.ts           ← Landing page endpoint
│   │   ├── prisma/                     ← PrismaModule & PrismaService singleton
│   │   ├── common/                     ★ Shared utilities
│   │   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts   ← Validate JWT Bearer token
│   │   │   ├── subtree.guard.ts    ← Kiểm tra 1 cấp trực tiếp (không còn CTE đệ quy)
│   │   │   ├── lv0.guard.ts        ← Cho phép nếu level=0 HOẾĶC role=ADMIN
│   │   │   ├── roles.guard.ts              ← Phân quyền ADMIN/IB theo @Roles() decorator
│   │   │   ├── self-finance.guard.ts       ← Chặn Admin tạo payout cho chính mình
│   │   │   └── protect-root-admin.guard.ts ← Chặn xóa/vô hiệu hóa Root Admin
│   │   │   ├── decorators/
│   │   │   │   └── current-user.decorator.ts  ← @CurrentUser() — lấy payload từ JWT
│   │   │   ├── interceptors/
│   │   │   │   └── response.interceptor.ts    ← Wrap tất cả response: {success, data, meta}
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts   ← Format lỗi chuẩn: {success:false, error:{code,message}}
│   │   │   └── utils/
│   │   │       └── subtree.util.ts     ← getSubtreeIds() — CTE đệ quy lấy toàn bộ IB con
│   │   └── modules/                    ★ Business Modules
│   │       ├── auth/                   ← Xác thực JWT
│   │       ├── ib/                     ← Quản lý cây IB
│   │       ├── rebate/                 ← Cấu hình & tính toán rebate ★★★
│   │       ├── transaction/            ← Ghi nhận giao dịch rebate
│   │       ├── wallet/                 ← Ví điện tử IB
│   │       ├── payout/                 ← Yêu cầu & duyệt rút tiền
│   │       ├── report/                 ← Báo cáo & thống kê
│   │       ├── dashboard/              ← Tổng quan dashboard
│   │       ├── notification/           ← Thông báo realtime
│   │       ├── audit/                  ← Nhật ký thao tác
│   │       ├── export/                 ← Xuất Excel
│   │       ├── admin/                  ← Quản lý User Admin (POST/GET/PATCH/DELETE)
│   │       ├── trash/                  ← Thùng rác: restore/hard-delete tài khoản
│   │       └── docs/                   ← Swagger docs endpoint
│   ├── public/                         ← Static assets (Swagger CSS/JS)
│   ├── vercel.json                     ← Deploy config Vercel
│   └── package.json
│
└── rebate-frontend/                     ★ NextJS 15 Frontend
    ├── src/
    │   ├── middleware.ts               ← next-intl i18n routing (vi/en)
    │   ├── app/
    │   │   └── [locale]/              ← i18n locale prefix
    │   │       ├── layout.tsx          ← Root layout
    │   │       ├── page.tsx            ← Root redirect → /dashboard
    │   │       ├── globals.css
    │   │       ├── (auth)/            ← Route group Auth (không có sidebar)
    │   │       │   └── login/page.tsx
    │   │       └── (dashboard)/       ★ Route group Dashboard (có sidebar)
    │   │           ├── layout.tsx     ← Sidebar nav + auth check + JWT decode
    │   │           └── dashboard/     ★ Các trang chức năng
    │   │               ├── page.tsx               ← Trang chủ Dashboard
    │   │               ├── ib-management/page.tsx ← Quản lý IB
    │   │               ├── tree/page.tsx          ← Cây IB trực quan
    │   │               │   └── edit/[id]/page.tsx ← Chỉnh sửa IB
    │   │               ├── rebate/page.tsx        ← Cấu hình rebate ★★★
    │   │               ├── transaction/page.tsx   ← Lịch sử giao dịch
    │   │               ├── payout/page.tsx        ← Quản lý rút tiền
    │   │               ├── report/page.tsx        ← Báo cáo
    │   │               ├── notification/page.tsx  ← Thông báo
    │   │               └── export/page.tsx        ← Xuất Excel
    │   ├── components/
    │   │   ├── LanguageSwitcher.tsx   ← Chuyển ngôn ngữ vi/en
    │   │   ├── Providers.tsx          ← QueryClientProvider, AuthProvider
    │   │   ├── account/               ← Account components
    │   │   ├── ib-tree/               ← IB Tree visualization components
    │   │   └── rebate/               ← Rebate config UI components
    │   ├── lib/
    │   │   ├── error-messages.ts
    │   │   └── api/                   ★ API service layer
    │   │       ├── client.ts          ← Axios instance + JWT interceptor + auto-refresh
    │   │       ├── auth.ts            ← login / refresh / logout calls
    │   │       ├── ib.ts              ← IB CRUD, tree, search, performance
    │   │       ├── rebate.ts          ← getConfig / updateConfig / calculate
    │   │       ├── rebateTemplates.ts ← Templates (AccountType, MarkupLink)
    │   │       ├── transaction.ts     ← create / batch / list transactions
    │   │       ├── payout.ts          ← request / approve / reject payout
    │   │       ├── report.ts          ← summary / transactions report
    │   │       ├── notification.ts    ← list / markRead notifications
    │   │       └── export.ts          ← download Excel files
    │   ├── store/
    │   │   └── auth.store.ts          ← Zustand: user state (id, email, level, role)
    │   ├── types/                     ← TypeScript types/interfaces
    │   └── i18n/                      ← next-intl config & routing
    └── messages/                      ← Translation files (vi.json, en.json)
```

---

## BACKEND MODULES

| Module | Chức năng nghiệp vụ | Endpoints chính | Bảng DB liên quan |
|--------|--------------------|-----------------|--------------------|
| **auth** | Xác thực người dùng, phát hành JWT | `POST /api/auth/login`<br>`POST /api/auth/refresh`<br>`POST /api/auth/logout`<br>`POST /api/auth/change-password` | `ib_nodes`, `refresh_tokens` |
| **ib** | Quản lý cây phân cấp IB (CRUD + tree) | `GET /api/ib/me`<br>`GET /api/ib/tree`<br>`GET /api/ib/search`<br>`GET /api/ib/leaderboard`<br>`GET /api/ib/:id`<br>`POST /api/ib`<br>`PUT /api/ib/:id`<br>`DELETE /api/ib/:id`<br>`PATCH /api/ib/:id/restore`<br>`GET /api/ib/:id/children`<br>`GET /api/ib/:id/performance`<br>`PATCH /api/ib/:id/reset-password`<br>`GET /api/ib/:id/profile`<br>`PATCH /api/ib/:id/profile` | `ib_nodes`, `rebate_configs`, `rebate_transactions`, `audit_logs`, `notifications` |
| **rebate** | Cấu hình rebate theo asset, tính toán phân phối cascade | `GET /api/rebate/config/:ibId`<br>`PUT /api/rebate/config/:ibId`<br>`GET /api/rebate/config/:ibId/history`<br>`GET /api/rebate/templates/:ibId`<br>`PUT /api/rebate/templates/:ibId`<br>`GET /api/rebate/calculate` | `rebate_configs`, `rebate_config_history`, `account_type_templates`, `markup_link_templates` |
| **transaction** | Ghi nhận giao dịch rebate (single & batch) | `POST /api/transactions`<br>`POST /api/transactions/batch`<br>`GET /api/transactions/:id`<br>`DELETE /api/transactions/:id` | `rebate_transactions`, `wallets`, `audit_logs`, `notifications` |
| **wallet** | Quản lý số dư ví của IB | `GET /api/wallet/:ibId` | `wallets` |
| **payout** | Yêu cầu và duyệt rút tiền | `POST /api/payouts`<br>`GET /api/payouts`<br>`GET /api/payouts/pending`<br>`PATCH /api/payouts/:id/approve`<br>`PATCH /api/payouts/:id/reject` | `payouts`, `wallets`, `audit_logs`, `notifications` |
| **report** | Báo cáo tổng hợp rebate và giao dịch | `GET /api/report/summary`<br>`GET /api/report/transactions` | `rebate_transactions`, `ib_nodes` |
| **dashboard** | Tổng quan KPI, rebate, hiệu suất IB | `GET /api/dashboard/summary`<br>`GET /api/dashboard/overview`<br>`GET /api/dashboard/rebate-summary`<br>`GET /api/dashboard/ib-performance` | `ib_nodes`, `rebate_transactions`, `wallets` |
| **notification** | Thông báo hệ thống và thủ công | `GET /api/notifications`<br>`PATCH /api/notifications/:id/read`<br>`PATCH /api/notifications/read-all`<br>`POST /api/notifications` | `notifications` |
| **audit** | Nhật ký mọi thao tác quan trọng | `GET /api/audit` | `audit_logs` |
| **export** | Xuất dữ liệu ra file Excel | `GET /api/export/rebate-config`<br>`GET /api/export/transactions` | `rebate_configs`, `rebate_transactions`, `ib_nodes` |
| **admin** | Quản trị viên hệ thống | `POST /api/admin/user` | `ib_nodes` |
| **trash** | Quản lý tài khoản đã xóa | `GET /api/trash` | `ib_nodes` |
| **docs** | Redirect đến Swagger UI | `GET /api/docs` | — |

### Guards & Middleware

| Guard / Middleware | Áp dụng trên | Mô tả |
|-------------------|-------------|-------|
| `JwtAuthGuard` | Hầu hết mọi endpoint | Validate Bearer JWT, gắn `user` vào `request` |
| `SubtreeGuard` | Endpoints liên quan đến `:id`/`:ibId` | Kiểm tra 1 cấp trực tiếp |
| `Lv0Guard` | `PATCH /ib/:id/reset-password` | Cho phép nếu level=0 hoặc role=ADMIN |
| `RolesGuard` | Admin/Sensitive routes | Phân quyền ADMIN/IB theo @Roles() |
| `SelfFinanceGuard` | `POST /payouts` | Chặn Admin tạo payout cho chính mình |
| `ProtectRootAdminGuard` | `DELETE` / `PATCH` | Chặn xóa/vô hiệu hóa Root Admin |
| `ResponseInterceptor` | Global | Wrap mọi response thành `{success, data, meta}` |
| `HttpExceptionFilter` | Global | Format lỗi thành `{success:false, error:{code, message}}` |
| `ValidationPipe` | Global | `whitelist: true`, `transform: true`, lỗi flatten thành mảng `fields` |

---

## DATABASE SCHEMA TÓM TẮT

### Models & Fields Chính

| Model | Fields chính | Quan hệ |
|-------|-------------|---------|
| **IbNode** (`ib_nodes`) | `id` UUID PK, `email` unique, `name`, `password` bcrypt, `isActive`, `level` (0=MIB), `role` (ADMIN/IB), `isRootAdmin`, `parentId`, `accountType`, `phone`, `country`, `bankAccount`, `paymentInfo`, `referralCode` unique, `notes` | Self-ref 1-n: parent→children (IbTree); 1-n: RebateConfig, RebateTransaction (owner & creator), AuditLog, RefreshToken, AccountTypeTemplate, MarkupLinkTemplate, Wallet, Payout, Notification |
| **RebateConfig** (`rebate_configs`) | `ibId` FK, `assetType` enum18, `rebateType` enum5, `rebatePips` D(10,4), `markupPips` D(10,4), `markupPercent` D(5,2), `maxPips` D(10,4) | n-1: IbNode; 1-n: RebateConfigHistory. Unique: `(ibId, assetType, rebateType)` |
| **RebateTransaction** (`rebate_transactions`) | `ibId` owner FK, `assetType`, `rebateType`, `lots` D(10,4), `rebateAmount` D(10,4), `currency`, `tradedAt`, `note`, `createdById` creator FK | n-1: IbNode (owner); n-1: IbNode (creator). Index: (ibId,tradedAt), (assetType,tradedAt) |
| **Wallet** (`wallets`) | `ibId` unique FK, `balance` D(18,8), `totalEarned` D(18,8), `totalPaid` D(18,8), `currency` | 1-1: IbNode; 1-n: Payout |
| **Payout** (`payouts`) | `ibId`, `walletId`, `amount` D(18,8), `status` enum4, `paymentMethod`, `note`, `rejectedReason`, `requestedAt`, `processedAt`, `processedBy` | n-1: IbNode; n-1: Wallet; n-1 optional: IbNode (processor) |
| **Notification** (`notifications`) | `recipientId`, `senderId?`, `type` enum7, `title`, `body`, `isRead`, `readAt`, `metadata` Json | n-1: IbNode (recipient); n-1?: IbNode (sender) |
| **AuditLog** (`audit_logs`) | `actorId`, `action` string, `targetType`, `targetId`, `before` Json?, `after` Json?, `ipAddress` | n-1: IbNode (actor). Index: actorId, targetId, action, createdAt |
| **RebateConfigHistory** (`rebate_config_history`) | `rebateConfigId`, `changedById`, `before` Json, `after` Json | n-1: RebateConfig; n-1: IbNode |
| **AccountTypeTemplate** (`account_type_templates`) | `ownerId`, `name`, `rows` Json | n-1: IbNode |
| **MarkupLinkTemplate** (`markup_link_templates`) | `ownerId`, `name`, `share` D(10,4) | n-1: IbNode |
| **RefreshToken** (`refresh_tokens`) | `token` unique, `ibId`, `expiresAt` | n-1: IbNode |

### Enums

| Enum | Values |
|------|--------|
| **AssetType** | D_FOREX, FOREX, GOLD, SILVER_5000, SILVER_1000, OIL, NATURE_GAS, COMMODITIES, HKG50, A50, JPN225, US_INDEX, SHARES, ETHEREUM, PRECIOUS_METAL, BITCOIN, CRYPTO, GAUCNH (18 loại) |
| **RebateType** | STP_REBATE, CENT_REBATE, COMMISSION_PERCENT, STP_ADDED_POINTS, ECN_COPY_REBATE |
| **PayoutStatus** | PENDING, APPROVED, REJECTED, PAID |
| **NotificationType** | SYSTEM, IB_JOINED, TRANSACTION_ADDED, REBATE_UPDATED, IB_DEACTIVATED, IB_RESTORED, MANUAL |

### MAX_PIPS Hardcoded (rebate.service.ts)

| Asset | Max Pips |
|-------|----------|
| D_FOREX / FOREX | 12 |
| GOLD / SILVER_1000 / OIL / PRECIOUS_METAL / HKG50 | 20 |
| SILVER_5000 | 80 |
| NATURE_GAS | 35 |
| A50 | 40 |
| JPN225 | 50 |
| US_INDEX | 2.3 |
| SHARES / CRYPTO | 1.5 |
| ETHEREUM / BITCOIN / COMMODITIES | 3 |
| GAUCNH | 7 |

### Lịch Sử Migrations (mới → cũ)

| Migration | Thay đổi chính |
|-----------|---------------|
| `20260714_add_root_admin_flag` | Thêm role Admin và flag Root Admin |
| `20260714_add_admin_role` | Thêm quyền quản trị |
| `20260713_extend_rebate_models` | Mở rộng models liên quan đến rebate |
| `20260711_sync_db_with_schema` | Đồng bộ DB với schema hiện tại |
| `20260709_add_ibnode_profile_fields` | Thêm phone, country, bankAccount, paymentInfo, referralCode, notes vào IbNode |
| `20260629_add_wallet_payout` | Tạo Wallet và Payout models |
| `20260622_init` | Init lại từ đầu |
| `20260619_sprint2_models` | Thêm Notification, RebateConfigHistory, AccountTypeTemplate, MarkupLinkTemplate |
| `20260619_add_transaction_fields_audit_log` | Thêm fields vào Transaction và AuditLog |
| `20260618_upgrade_schema` | Nâng cấp schema tổng thể |
| `20260616_first_setup` | Setup ban đầu |

---

## FRONTEND PAGES / COMPONENTS

### Routing Structure (App Router + next-intl)

| Route | Chức năng | API gọi tới | State/Data Fetching |
|-------|-----------|------------|---------------------|
| `/{locale}/login` | Form đăng nhập | `POST /api/auth/login` | Local state + Zustand |
| `/{locale}/dashboard` | Tổng quan cá nhân: profile, rebate config, calculator | `GET /ib/me`<br>`GET /rebate/config/:id`<br>`GET /rebate/calculate` | useEffect + useState |
| `/{locale}/dashboard/ib-management` | Quản lý danh sách IB (tìm kiếm, tạo, xóa, khôi phục) | `GET /ib/search`<br>`GET /ib/:id/children`<br>`POST /ib`<br>`DELETE /ib/:id`<br>`PATCH /ib/:id/restore` | useEffect + useState |
| `/{locale}/dashboard/tree` | Cây IB dạng visual phân cấp | `GET /ib/tree?depth=all` | useEffect + useState |
| `/{locale}/dashboard/tree/edit/[id]` | Chỉnh sửa IB + rebate config | `GET /ib/:id`<br>`PUT /ib/:id`<br>`GET /rebate/config/:id`<br>`PUT /rebate/config/:id`<br>`GET /rebate/templates/:id`<br>`PUT /rebate/templates/:id` | useEffect + useState |
| `/{locale}/dashboard/rebate` | Xem/cập nhật cấu hình rebate của mình | `GET /rebate/config/:id`<br>`PUT /rebate/config/:id` | useEffect + useState |
| `/{locale}/dashboard/transaction` | Lịch sử + tạo giao dịch (single & batch) | `GET /report/transactions`<br>`POST /transactions`<br>`POST /transactions/batch`<br>`DELETE /transactions/:id` | useEffect + useState + React Query |
| `/{locale}/dashboard/payout` | Yêu cầu rút tiền + danh sách + duyệt/từ chối | `POST /payouts`<br>`GET /payouts`<br>`GET /payouts/pending`<br>`PATCH /payouts/:id/approve`<br>`PATCH /payouts/:id/reject` | useEffect + useState |
| `/{locale}/dashboard/report` | Báo cáo tổng hợp rebate theo kỳ | `GET /report/summary`<br>`GET /report/transactions` | useEffect + useState |
| `/{locale}/dashboard/notification` | Danh sách thông báo + đánh dấu đã đọc | `GET /notifications`<br>`PATCH /notifications/:id/read`<br>`PATCH /notifications/read-all` | useEffect + useState |
| `/{locale}/dashboard/export` | Xuất Excel rebate config và transactions | `GET /export/rebate-config`<br>`GET /export/transactions` | Direct download (Blob) |
| `/{locale}/account` | Thông tin tài khoản cá nhân, chỉnh sửa profile | `GET /ib/me`<br>`PATCH /ib/:id/profile` | useEffect + useState |

---

## ĐIỂM CẦN LƯU Ý / RỦI RO

### 🔴 RỦI RO CAO

| # | Vị trí | Vấn đề | Khuyến nghị |
|---|--------|--------|-------------|
| R1 | `ib.service.ts: getTree()` | Tối ưu hóa truy vấn cây IB tránh load toàn bộ DB. | ✅ **ĐÃ GIẢM RR:** Chuyển sang truy vấn theo phạm vi quản lý. |
| R2 | `wallet.service.ts: credit()` | Race condition khi cập nhật ví. | Dùng SELECT FOR UPDATE. |
| R3 | `payout.service.ts: approvePayout()` | Race condition trong giao dịch rút tiền. | SELECT FOR UPDATE trong cùng transaction. |
| R4 | `payout.service.ts: requestPayout()` | Thông báo tới MIB. | Filter theo phạm vi quyền hạn. |
| R5 | `rebate.service.ts: updateConfig()` | Cập nhật cấu hình cascade. | Đệ quy update subtree. |

### 🟢 NHẬN XÉT TỐT / ĐÃ XỬ LÝ ĐÚNG

| # | Vị trí | Điểm tốt |
|---|--------|---------|
| G3 | `common/guards/subtree.guard.ts` | ✅ Đã cập nhật 2026-07-14: Kiểm tra 1 cấp trực tiếp thay vì dùng CTE đệ quy. |
| G9 | `common/guards/protect-root-admin.guard.ts` | ✅ Đã cập nhật 2026-07-14: Bảo vệ Root Admin khỏi thao tác nguy hiểm. |

---

## DEPENDENCY MAP GIỮA CÁC MODULES

```
PrismaModule (global)
    ↑ inject vào tất cả modules

AuditModule (cung cấp AuditService)
    ← dùng bởi: IbModule, RebateModule, TransactionModule, PayoutModule

NotificationModule (cung cấp NotificationService)
    ← dùng bởi: IbModule, TransactionModule, WalletModule, PayoutModule, TrashModule

WalletModule (cung cấp WalletService)
    ← dùng bới: TransactionModule, PayoutModule

TransactionModule → import: AuditModule, NotificationModule, WalletModule
PayoutModule     → import: WalletModule, AuditModule, NotificationModule
RebateModule     → import: AuditModule, NotificationModule
IbModule         → import: AuditModule, NotificationModule
AdminModule      → import: (chỉ PrismaService, không có dep đặc biệt)
TrashModule      → import: AuditModule, NotificationModule

DashboardModule, ReportModule, ExportModule → chỉ dùng PrismaService trực tiếp
```

---

*File này được tạo tự động bởi AI agent phân tích codebase ngày 2026-07-13.*
*Cập nhật lần cuối: 2026-07-14 (Admin module, Trash module, SubtreeGuard 1-cấp, encoding UTF8).*
