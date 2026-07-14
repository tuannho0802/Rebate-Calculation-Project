# Data Models & Shared Types

> Types này dùng chung cho cả FE và BE.
> FE copy vào `src/types/`, BE dùng làm Prisma schema reference.

## Changelog
- **2026-07-14 (cập nhật lần 2 — đối chiếu trực tiếp `schema.prisma` thật)**:
  - Doc trước đây bị THIẾU rất nhiều so với schema thật. Đã bổ sung đầy đủ:
    `name`, `accountType`, `isActive`, `phone`, `country`, `bankAccount`, `paymentInfo`,
    `referralCode`, `notes`, `profileUpdatedAt` vào `IbNode`.
  - Thêm enum `RebateType` (5 giá trị) — trước đây hoàn toàn không có trong docs.
  - Thêm field `rebateType` vào `RebateConfig`, đổi unique constraint thành
    `(ibId, assetType, rebateType)`.
  - Thêm các model trước đây bị thiếu hoàn toàn khỏi docs: `Wallet`, `Payout` (+ enum
    `PayoutStatus`), `Notification` (+ enum `NotificationType`), `AuditLog`,
    `RebateConfigHistory`, `AccountTypeTemplate`, `MarkupLinkTemplate`.
  - `RebateTransaction` bổ sung `rebateType`, `note`, `createdById` (+ quan hệ
    `TransactionCreator` — khác `ibId` là chủ sở hữu giao dịch).

---

## Database Schema (Prisma) — ĐÚNG 100% với `schema.prisma` thật

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  IB
}

model IbNode {
  id          String   @id @default(uuid())
  email       String   @unique
  name        String   @default("")
  password    String   // bcrypt hash
  role        Role     @default(IB)
  isRootAdmin Boolean  @default(false)
  isActive    Boolean  @default(true)
  level       Int      // 0=MIB, 1, 2, 3, 4, 5
  parentId    String?
  parent      IbNode?  @relation("IbTree", fields: [parentId], references: [id])
  children    IbNode[] @relation("IbTree")
  accountType String   @default("Markup 0%")

  rebateConfig         RebateConfig[]
  transactions         RebateTransaction[]   @relation("TransactionOwner")
  createdTransactions  RebateTransaction[]   @relation("TransactionCreator")
  auditLogs            AuditLog[]            @relation("AuditActor")
  refreshTokens        RefreshToken[]
  accountTypeTemplates AccountTypeTemplate[]
  markupLinkTemplates  MarkupLinkTemplate[]

  phone            String?
  country          String?
  bankAccount      String?
  paymentInfo      String?
  referralCode     String?   @unique
  notes            String?
  profileUpdatedAt DateTime?

  wallet           Wallet?
  payouts          Payout[]
  processedPayouts Payout[] @relation("PayoutProcessor")

  receivedNotifications Notification[]        @relation("NotificationRecipient")
  sentNotifications     Notification[]        @relation("NotificationSender")
  rebateConfigChanges   RebateConfigHistory[]  @relation("RebateConfigHistoryActor")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
  @@map("ib_nodes")
}

enum RebateType {
  STP_REBATE
  CENT_REBATE
  COMMISSION_PERCENT
  STP_ADDED_POINTS
  ECN_COPY_REBATE
}

model RebateConfig {
  id            String     @id @default(uuid())
  ibId          String
  ib            IbNode     @relation(fields: [ibId], references: [id])
  assetType     AssetType
  rebateType    RebateType @default(STP_REBATE)
  rebatePips    Decimal    @db.Decimal(10, 4)
  markupPips    Decimal    @default(0) @db.Decimal(10, 4)
  markupPercent Decimal    @default(100) @db.Decimal(5, 2)  // 100% hoặc 80%
  maxPips       Decimal    @db.Decimal(10, 4)                // giới hạn từ cấp trên

  history RebateConfigHistory[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([ibId, assetType, rebateType])
  @@map("rebate_configs")
}

model RebateTransaction {
  id           String     @id @default(uuid())
  ibId         String                              // chủ sở hữu (owner) giao dịch
  ib           IbNode     @relation("TransactionOwner", fields: [ibId], references: [id])
  assetType    AssetType
  rebateType   RebateType @default(STP_REBATE)
  lots         Decimal    @db.Decimal(10, 4)
  rebateAmount Decimal    @db.Decimal(10, 4)
  currency     String     @default("USD")
  tradedAt     DateTime
  note         String?
  createdById  String                              // người tạo giao dịch (có thể khác owner)
  createdBy    IbNode     @relation("TransactionCreator", fields: [createdById], references: [id])

  createdAt DateTime @default(now())

  @@index([ibId, tradedAt])
  @@index([assetType, tradedAt])
  @@index([createdById])
  @@map("rebate_transactions")
}

model AuditLog {
  id         String   @id @default(uuid())
  actorId    String
  actor      IbNode   @relation("AuditActor", fields: [actorId], references: [id])
  action     String   // 'IB_CREATE', 'IB_UPDATE', 'TRANSACTION_CREATE', v.v.
  targetType String   // 'IB', 'REBATE_CONFIG', 'TRANSACTION'
  targetId   String
  before     Json?
  after      Json?
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@index([actorId])
  @@index([targetId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  ibId      String
  ib        IbNode   @relation(fields: [ibId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@map("refresh_tokens")
}

model AccountTypeTemplate {
  id        String   @id @default(uuid())
  ownerId   String
  owner     IbNode   @relation(fields: [ownerId], references: [id])
  name      String
  rows      Json     // AccountTypeRowDto[] — xem 01_API_CONTRACT.md
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
  @@map("account_type_templates")
}

model MarkupLinkTemplate {
  id        String   @id @default(uuid())
  ownerId   String
  owner     IbNode   @relation(fields: [ownerId], references: [id])
  name      String
  share     Decimal  @db.Decimal(10, 4)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
  @@map("markup_link_templates")
}

enum PayoutStatus {
  PENDING
  APPROVED
  REJECTED
  PAID
}

model Wallet {
  id          String   @id @default(uuid())
  ibId        String   @unique
  balance     Decimal  @default(0) @db.Decimal(18, 8)
  totalEarned Decimal  @default(0) @db.Decimal(18, 8)
  totalPaid   Decimal  @default(0) @db.Decimal(18, 8)
  currency    String   @default("USD")
  updatedAt   DateTime @updatedAt

  ib      IbNode   @relation(fields: [ibId], references: [id])
  payouts Payout[]

  @@map("wallets")
}

model Payout {
  id             String       @id @default(uuid())
  ibId           String
  walletId       String
  amount         Decimal      @db.Decimal(18, 8)
  status         PayoutStatus @default(PENDING)
  paymentMethod  String?
  note           String?
  rejectedReason String?
  requestedAt    DateTime     @default(now())
  processedAt    DateTime?
  processedBy    String?

  ib        IbNode  @relation(fields: [ibId], references: [id])
  wallet    Wallet  @relation(fields: [walletId], references: [id])
  processor IbNode? @relation("PayoutProcessor", fields: [processedBy], references: [id])

  @@index([ibId])
  @@index([walletId])
  @@map("payouts")
}

enum NotificationType {
  SYSTEM
  IB_JOINED
  TRANSACTION_ADDED
  REBATE_UPDATED
  IB_DEACTIVATED
  IB_RESTORED
  MANUAL
}

model Notification {
  id          String           @id @default(uuid())
  recipientId String
  recipient   IbNode           @relation("NotificationRecipient", fields: [recipientId], references: [id])
  senderId    String?
  sender      IbNode?          @relation("NotificationSender", fields: [senderId], references: [id])
  type        NotificationType
  title       String
  body        String
  isRead      Boolean          @default(false)
  readAt      DateTime?
  metadata    Json?
  createdAt   DateTime         @default(now())

  @@index([recipientId, isRead])
  @@index([recipientId, createdAt])
  @@map("notifications")
}

model RebateConfigHistory {
  id             String       @id @default(uuid())
  rebateConfigId String
  rebateConfig   RebateConfig @relation(fields: [rebateConfigId], references: [id])
  changedById    String
  changedBy      IbNode       @relation("RebateConfigHistoryActor", fields: [changedById], references: [id])
  before         Json
  after          Json
  createdAt      DateTime     @default(now())

  @@index([rebateConfigId])
  @@index([changedById])
  @@map("rebate_config_history")
}

enum AssetType {
  D_FOREX
  FOREX
  GOLD
  SILVER_5000
  SILVER_1000
  OIL
  NATURE_GAS
  COMMODITIES
  HKG50
  A50
  JPN225
  US_INDEX
  SHARES
  ETHEREUM
  PRECIOUS_METAL
  BITCOIN
  CRYPTO
  GAUCNH
}
```

---

## TypeScript Types (dùng cho FE)

Lưu vào `src/types/index.ts` ở FE:

```typescript
// ─── Enums ───────────────────────────────────────────────────────

export enum AssetType {
  D_FOREX        = "D_FOREX",
  FOREX          = "FOREX",
  GOLD           = "GOLD",
  SILVER_5000    = "SILVER_5000",
  SILVER_1000    = "SILVER_1000",
  OIL            = "OIL",
  NATURE_GAS     = "NATURE_GAS",
  COMMODITIES    = "COMMODITIES",
  HKG50          = "HKG50",
  A50            = "A50",
  JPN225         = "JPN225",
  US_INDEX       = "US_INDEX",
  SHARES         = "SHARES",
  ETHEREUM       = "ETHEREUM",
  PRECIOUS_METAL = "PRECIOUS_METAL",
  BITCOIN        = "BITCOIN",
  CRYPTO         = "CRYPTO",
  GAUCNH         = "GAUCNH",
}

export enum RebateType {
  STP_REBATE          = "STP_REBATE",
  CENT_REBATE         = "CENT_REBATE",
  COMMISSION_PERCENT  = "COMMISSION_PERCENT",
  STP_ADDED_POINTS    = "STP_ADDED_POINTS",
  ECN_COPY_REBATE     = "ECN_COPY_REBATE",
}

export enum PayoutStatus {
  PENDING  = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PAID     = "PAID",
}

export enum NotificationType {
  SYSTEM             = "SYSTEM",
  IB_JOINED          = "IB_JOINED",
  TRANSACTION_ADDED  = "TRANSACTION_ADDED",
  REBATE_UPDATED     = "REBATE_UPDATED",
  IB_DEACTIVATED     = "IB_DEACTIVATED",
  IB_RESTORED        = "IB_RESTORED",
  MANUAL             = "MANUAL",
}

// ─── API Response Envelope ────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

// ─── User / Auth ──────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  level: number;
  role: "IB" | "ADMIN";
  isRootAdmin: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// ─── IB Node — ĐẦY ĐỦ theo schema thật ────────────────────────────

export interface IbNode {
  id: string;
  email: string;
  name: string;
  level: number;
  role: "IB" | "ADMIN";
  isRootAdmin: boolean;
  isActive: boolean;
  parentId: string | null;
  accountType: string;
  phone?: string | null;
  country?: string | null;
  bankAccount?: string | null;
  paymentInfo?: string | null;
  referralCode?: string | null;
  notes?: string | null;
  profileUpdatedAt?: string | null;
  totalChildren?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface IbTreeNode extends IbNode {
  children: IbTreeNode[];
}

// ─── Rebate Config ────────────────────────────────────────────────

export interface RebateAssetConfig {
  assetType: AssetType;
  rebateType: RebateType;      // optional khi PUT (default STP_REBATE), luôn có khi GET
  rebatePips: number;
  markupPips: number;
  markupPercent: number;       // 80 hoặc 100
  maxPips: number;
  updatedAt?: string;          // BE trả per-asset, docs cũ không có field này
}

export interface RebateConfig {
  ibId: string;
  assets: RebateAssetConfig[];
  updatedAt: string;
}

// ─── Rebate Templates (Account Type / Markup Link) ────────────────
// Endpoint: GET/PUT /api/rebate/ib/:ibId/templates

export interface AccountTypeTemplateRow {
  assetType: string;    // string tự do theo DTO thật, không strict AssetType enum
  maxCeiling: string;   // string theo DTO thật (không phải number)
  calcUnit: string;
}

export interface AccountTypeTemplate {
  id: string;
  name: string;
  rows: AccountTypeTemplateRow[];
}

export interface MarkupLinkTemplate {
  id: string;
  name: string;
  share: number;
}

export interface RebateTemplates {
  accountTypeTemplates: AccountTypeTemplate[];
  markupLinkTemplates: MarkupLinkTemplate[];
}

// Khi PUT: id bị strip bởi whitelist, chỉ gửi { name, rows } / { name, share }
export interface SaveRebateTemplatesPayload {
  accountTypeTemplates: Array<{ name: string; rows: AccountTypeTemplateRow[] }>;
  markupLinkTemplates: Array<{ name: string; share: number }>;
}

// ─── Rebate Calculation ───────────────────────────────────────────

export interface RebateCalculation {
  ibId: string;
  assetType: AssetType;
  lots: number;
  rebatePips: number;
  totalRebate: number;
  currency: string;
  breakdown: {
    self: number;
    distributed: Array<{
      ibId: string;
      level: number;
      amount: number;
    }>;
  };
}

// ─── Report ───────────────────────────────────────────────────────

export interface ReportSummary {
  period: string;             // "YYYY-MM"
  totalRebate: number;
  currency: string;
  byAsset: Array<{
    assetType: AssetType;
    totalRebate: number;
    lots: number;
  }>;
  byIB: Array<{
    ibId: string;
    email: string;
    level: number;
    totalRebate: number;
  }>;
}

export interface RebateTransaction {
  id: string;
  ibId: string;
  assetType: AssetType;
  rebateType: RebateType;
  lots: number;
  rebateAmount: number;
  currency: string;
  tradedAt: string;
  note?: string | null;
  createdById: string;
}

// ─── Wallet / Payout ───────────────────────────────────────────────

export interface Wallet {
  id: string;
  ibId: string;
  balance: number;
  totalEarned: number;
  totalPaid: number;
  currency: string;
  updatedAt: string;
}

export interface Payout {
  id: string;
  ibId: string;
  walletId: string;
  amount: number;
  status: PayoutStatus;
  paymentMethod?: string | null;
  note?: string | null;
  rejectedReason?: string | null;
  requestedAt: string;
  processedAt?: string | null;
  processedBy?: string | null;
}

// ─── Notification ───────────────────────────────────────────────────

export interface Notification {
  id: string;
  recipientId: string;
  senderId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
```

---

## Max Pips Reference (từ file Excel)

Dùng để validate ở cả FE và BE:

```typescript
export const MAX_PIPS: Record<AssetType, number> = {
  [AssetType.D_FOREX]:        12,
  [AssetType.FOREX]:          12,
  [AssetType.GOLD]:           20,
  [AssetType.SILVER_5000]:    80,
  [AssetType.SILVER_1000]:    20,
  [AssetType.OIL]:            20,
  [AssetType.NATURE_GAS]:     35,
  [AssetType.COMMODITIES]:     3,
  [AssetType.HKG50]:          20,
  [AssetType.A50]:            40,
  [AssetType.JPN225]:         50,
  [AssetType.US_INDEX]:      2.3,
  [AssetType.SHARES]:        1.5,
  [AssetType.ETHEREUM]:        3,
  [AssetType.PRECIOUS_METAL]: 20,
  [AssetType.BITCOIN]:         3,
  [AssetType.CRYPTO]:        1.5,
  [AssetType.GAUCNH]:          7,
};
```

## Ghi chú quan trọng về `AccountTypeTemplate.rows`

Field `rows: Json` trên model không strict-type ở tầng DB — shape thật được validate ở tầng
DTO (`AccountTypeRowDto`, BE). FE **phải** dùng đúng shape `{ assetType, maxCeiling, calcUnit }`
(tất cả đều là `string`, kể cả `maxCeiling` — KHÔNG parse thành number khi gửi request) theo
đúng những gì `01_API_CONTRACT.md` mô tả, tự ý đổi type sẽ bị `whitelist: true` strip hoặc
validation reject ở BE.