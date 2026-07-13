# 12 — PHÂN TÍCH CẤU TRÚC TOÀN DỰ ÁN (Project Structure Analysis)

> **Stack:** NestJS (Backend) · NextJS 15 App Router (Frontend) · Prisma ORM · PostgreSQL  
> **Môi trường deploy:** Vercel (cả 2 đầu)  
> **Ngôn ngữ UI:** i18n — `vi` / `en` (next-intl)  
> **Thời điểm phân tích:** 2026-07-13

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
│   │       └── 20260713045017_extend_rebate_models/   ← Migration mới nhất
│   ├── src/
│   │   ├── main.ts                     ← Bootstrap: Swagger, CORS, ValidationPipe, global prefix /api
│   │   ├── app.module.ts               ← Root module import toàn bộ sub-modules
│   │   ├── app.controller.ts           ← Landing page endpoint
│   │   ├── prisma/                     ← PrismaModule & PrismaService singleton
│   │   ├── common/                     ★ Shared utilities
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts   ← Validate JWT Bearer token
│   │   │   │   ├── subtree.guard.ts    ← Kiểm tra IB target có nằm trong subtree (CTE SQL)
│   │   │   │   └── lv0.guard.ts        ← Chỉ cho phép MIB (level=0) đi tiếp
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
| **docs** | Redirect đến Swagger UI | `GET /api/docs` | — |

### Guards & Middleware

| Guard / Middleware | Áp dụng trên | Mô tả |
|-------------------|-------------|-------|
| `JwtAuthGuard` | Hầu hết mọi endpoint | Validate Bearer JWT, gắn `user` vào `request` |
| `SubtreeGuard` | Endpoints liên quan đến `:id`/`:ibId` | CTE đệ quy PostgreSQL kiểm tra target IB có nằm trong subtree của user đang đăng nhập |
| `Lv0Guard` | `PATCH /ib/:id/reset-password` | Chỉ cho phép level=0 (MIB) |
| `ResponseInterceptor` | Global | Wrap mọi response thành `{success, data, meta}` |
| `HttpExceptionFilter` | Global | Format lỗi thành `{success:false, error:{code, message}}` |
| `ValidationPipe` | Global | `whitelist: true`, `transform: true`, lỗi flatten thành mảng `fields` |

---

## DATABASE SCHEMA TÓM TẮT

### Models & Fields Chính

| Model | Fields chính | Quan hệ |
|-------|-------------|---------|
| **IbNode** (`ib_nodes`) | `id` UUID PK, `email` unique, `name`, `password` bcrypt, `isActive`, `level` (0=MIB), `parentId`, `accountType`, `phone`, `country`, `bankAccount`, `paymentInfo`, `referralCode` unique, `notes` | Self-ref 1-n: parent→children (IbTree); 1-n: RebateConfig, RebateTransaction (owner & creator), AuditLog, RefreshToken, AccountTypeTemplate, MarkupLinkTemplate, Wallet, Payout, Notification |
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
| `20260713_extend_rebate_models` | Mở rộng models liên quan đến rebate (mới nhất) |
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

### Shared API Service Layer (`src/lib/api/`)

| File | Chức năng |
|------|-----------|
| `client.ts` | Axios instance: tự gắn Bearer token từ localStorage, auto-refresh khi 401 (retry queue), redirect /login khi fail |
| `auth.ts` | login(), refresh(), logout() |
| `ib.ts` | getMe(), getTree(), getById(), create(), search(), update(), deactivate(), restore(), getChildren(), getPerformance() |
| `rebate.ts` | getConfig(), updateConfig(), calculate() |
| `rebateTemplates.ts` | getTemplates(), saveTemplates() |
| `transaction.ts` | create(), createBatch(), findOne(), remove() |
| `payout.ts` | requestPayout(), listPayouts(), getPendingPayouts(), approvePayout(), rejectPayout() |
| `report.ts` | getSummary(), getTransactions() |
| `notification.ts` | getNotifications(), markRead(), markAllRead() |
| `export.ts` | downloadRebateConfig(), downloadTransactions() |

---

## CÁC LUỒNG NGHIỆP VỤ CHÍNH

### 1. Luồng Tính Rebate Cascade (★★★ Core Business Logic)

```
Frontend (rebate/page.tsx)
  → rebateApi.calculate(ibId, assetType, lots)
  → GET /api/rebate/calculate?ibId=&assetType=&lots=
  → RebateController.calculateCascadeDistribution()
  → RebateService.calculateCascadeDistribution()
      ├── prisma.rebateConfig.findUnique({ ibId, assetType, rebateType })
      │     → lấy rebatePips và markupPips của IB target
      ├── selfAmount = rebatePips × lots
      ├── totalRebate = (rebatePips + markupPips) × lots
      └── $queryRaw CTE đệ quy đi ngược ancestor chain
            → lấy rebatePips của từng cấp trên (parent, grandparent...)
            → distributed = ancestors.map(a => a.rebatePips × lots)
  ← Response: { ibId, lots, rebatePips, totalRebate, breakdown: { self, distributed[] } }
```

> Lưu ý: Hàm tính rebate là READ-ONLY (chỉ preview), không ghi DB.

---

### 2. Luồng Ghi Nhận Giao Dịch + Credit Wallet

```
Frontend (transaction/page.tsx)
  → transactionApi.create({ ibId, assetType, lots, rebateAmount, tradedAt })
  → POST /api/transactions
  → TransactionController.create()
  → TransactionService.create()
      ├── assertInSubtree(currentUserId, dto.ibId)    ← Bảo mật
      └── prisma.$transaction(async tx => {
              ├── rebateTransaction.create(...)         ← Tạo giao dịch
              └── walletService.credit(ibId, amount, tx) ← Cộng wallet (ATOMIC)
          })
      ├── auditService.log(TRANSACTION_CREATE)
      └── notificationService.notify(TRANSACTION_ADDED)
  ← Response: Created RebateTransaction

Batch (tối đa 500):
POST /api/transactions/batch
  → validate tất cả ibId trong subtree
  → createMany() trong 1 transaction
  → group credit by ibId (giảm queries)
```

---

### 3. Luồng Cập Nhật Cấu Hình Rebate

```
Frontend (tree/edit/[id] hoặc rebate/page.tsx)
  → rebateApi.updateConfig(ibId, assets)
  → PUT /api/rebate/config/:ibId
  → RebateController.updateConfig(user, ibId, dto) [SubtreeGuard]
  → RebateService.updateConfig()
      ├── [Lv1+] Kiểm tra targetIb.parentId === currentUserId
      │         (chỉ set rebate cho con TRỰC TIẾP)
      └── prisma.$transaction(async tx => {
              for each asset in dto.assets:
              ├── parentConfig = findUnique(ibId=currentUser)
              ├── Validate: rebatePips >= 0, markupPips >= 0
              │            (nếu ko có parentConfig → check vs MAX_PIPS global)
              ├── tx.rebateConfig.upsert(...)           ← Cập nhật config
              ├── tx.rebateConfigHistory.create(...)    ← Ghi lịch sử
              ├── auditService.log(REBATE_CONFIG_UPDATE)
              └── [Nếu tổng pips thay đổi] → updateMany maxPips cho children
          })
  ← Response: Updated RebateConfig
```

---

### 4. Luồng Rút Tiền (Payout)

```
Frontend (payout/page.tsx)
  → payoutApi.requestPayout(amount, paymentMethod, note)
  → POST /api/payouts
  → PayoutService.requestPayout()
      ├── Validate: amount >= 10
      ├── walletService.getOrCreate(ibId) → kiểm tra balance đủ
      ├── Kiểm tra không có PENDING payout đang tồn tại
      ├── prisma.payout.create({ status: PENDING })
      ├── auditService.log(PAYOUT_REQUESTED)
      └── notifyAllMIBs(level=0)

Duyệt/Từ chối (MIB level=0):
  → PATCH /api/payouts/:id/approve|reject
  → PayoutService.approvePayout():
      └── prisma.$transaction(async tx => {
              ├── wallet.update: balance -= amount, totalPaid += amount
              └── payout.update: status = APPROVED
          })
      └── notify IB về kết quả
```

---

### 5. Luồng Xác Thực & Phân Quyền

```
Frontend (bất kỳ page nào)
  → Layout check localStorage('ib_access_token')
  → Nếu không có → redirect /login
  → Nếu có → decode JWT → { sub, email, level, role } → Zustand store

Mỗi API call:
  → Axios interceptor tự gắn Bearer token
  → 401 → tự gọi POST /auth/refresh (retry queue pattern)
  → Refresh fail → clear localStorage, redirect /login

Backend:
  POST /api/auth/login → bcrypt.compare() → Sign JWT
    ├── accessToken (15m)
    └── refreshToken (7d, lưu DB)

Mọi protected endpoint:
  → JwtAuthGuard (validate JWT)
  → SubtreeGuard (CTE PostgreSQL)
  → Lv0Guard (chỉ MIB)
```

---

## ĐIỂM CẦN LƯU Ý / RỦI RO

### 🔴 RỦI RO CAO

| # | Vị trí | Vấn đề | Khuyến nghị |
|---|--------|--------|-------------|
| R1 | `ib.service.ts: getTree()` | **findMany() không filter** — load TOÀN BỘ ib_nodes vào RAM rồi build tree bằng Map JS. OOM + slow khi DB lớn. | Thay bằng CTE đệ quy PostgreSQL, chỉ load subtree của user |
| R2 | `wallet.service.ts: credit()` | **getOrCreate() tách khỏi update()** — TOCTOU race condition nếu 2 requests song song gọi credit() cho ibId chưa có wallet. | Dùng INSERT ... ON CONFLICT DO UPDATE hoặc SELECT FOR UPDATE |
| R3 | `payout.service.ts: approvePayout()` | **Check balance trước tx, deduct trong tx** — race condition nếu 2 approve cùng lúc. | SELECT FOR UPDATE trong cùng transaction |
| R4 | `payout.service.ts: requestPayout()` | **notifyAllMIBs dùng findMany({ level: 0 })** không giới hạn theo cây — mọi MIB đều nhận thông báo của nhau. | Filter theo subtree hoặc parent chain |
| R5 | `rebate.service.ts: updateConfig()` | **Cascade update maxPips chỉ 1 cấp** (direct children), không đệ quy xuống level 2, 3... | CTE đệ quy update toàn subtree |

### 🟡 RỦI RO TRUNG BÌNH

| # | Vị trí | Vấn đề | Khuyến nghị |
|---|--------|--------|-------------|
| W1 | `rebate.service.ts: updateConfig()` | **Server không validate rebatePips+markupPips <= parentConfig.maxPips** (comment nói FE tự quản lý). FE có thể bị bypass. | Thêm server-side validation budget check |
| W2 | `subtree.guard.ts` | **Mỗi request chạy 1 CTE SQL** — nhiều concurrent requests tốn nhiều query DB. | Cache subtreeIds với Redis/in-memory TTL ngắn |
| W3 | `transaction.service.ts: createBatch()` | **createMany() không trả về IDs** → audit log chỉ log count, không log từng transaction. | Dùng Promise.all(create()) nếu cần individual audit |
| W4 | `wallet.service.ts: credit()` | **totalEarned increment ngay cả khi amount âm** (xóa transaction deduct). totalEarned sẽ giảm không đúng nghĩa. | if (amount > 0) mới increment totalEarned |
| W5 | Frontend `layout.tsx` | **Auth check bằng localStorage + JWT decode phía client** — không verify server-side. Token fake vẫn pass nếu cùng cấu trúc. | Acceptable với auto-refresh pattern đã có, hoặc thêm /auth/verify endpoint |

### 🟢 NHẬN XÉT TỐT / ĐÃ XỬ LÝ ĐÚNG

| # | Vị trí | Điểm tốt |
|---|--------|---------|
| G1 | `transaction.service.ts` | Tạo transaction + credit wallet trong cùng prisma.$transaction() — ATOMIC |
| G2 | `payout.service.ts: approvePayout()` | Deduct balance + update status trong cùng transaction |
| G3 | `common/guards/subtree.guard.ts` | CTE PostgreSQL đệ quy kiểm tra quyền — rất hiệu quả |
| G4 | `rebate.service.ts: updateConfig()` | Ghi RebateConfigHistory snapshot before/after — excellent audit trail |
| G5 | `transaction.service.ts: createBatch()` | Group wallet credits by ibId — tối ưu số DB queries |
| G6 | `lib/api/client.ts` | Auto-refresh với retry queue — xử lý đúng concurrent 401 |
| G7 | `main.ts` | ValidationPipe whitelist:true — ngăn extra fields injection |
| G8 | `rebate.service.ts` | MAX_PIPS per asset làm safety cap khi không có parentConfig — đúng |

---

## DEPENDENCY MAP GIỮA CÁC MODULES

```
PrismaModule (global)
    ↑ inject vào tất cả modules

AuditModule (cung cấp AuditService)
    ← dùng bởi: IbModule, RebateModule, TransactionModule, PayoutModule

NotificationModule (cung cấp NotificationService)
    ← dùng bởi: IbModule, TransactionModule, WalletModule, PayoutModule

WalletModule (cung cấp WalletService)
    ← dùng bởi: TransactionModule, PayoutModule

TransactionModule → import: AuditModule, NotificationModule, WalletModule
PayoutModule     → import: WalletModule, AuditModule, NotificationModule
RebateModule     → import: AuditModule
IbModule         → import: AuditModule, NotificationModule

DashboardModule, ReportModule, ExportModule → chỉ dùng PrismaService trực tiếp
```

---

*File này được tạo tự động bởi AI agent phân tích codebase ngày 2026-07-13.*
*Cập nhật lại khi có thay đổi cấu trúc lớn.*
