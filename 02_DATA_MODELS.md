# Data Models & Shared Types

> Types này dùng chung cho cả FE và BE.
> FE copy vào `src/types/`, BE dùng làm Prisma schema reference.

---

## Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── IB Node (cây phân cấp) ─────────────────────────────────────

model IbNode {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   // bcrypt hash
  level     Int      // 0=MIB, 1, 2, 3, 4, 5
  parentId  String?
  parent    IbNode?  @relation("IbTree", fields: [parentId], references: [id])
  children  IbNode[] @relation("IbTree")

  rebateConfig    RebateConfig[]
  transactions    RebateTransaction[]
  refreshTokens   RefreshToken[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
  @@map("ib_nodes")
}

// ─── Rebate Configuration ────────────────────────────────────────

model RebateConfig {
  id             String    @id @default(uuid())
  ibId           String
  ib             IbNode    @relation(fields: [ibId], references: [id])
  assetType      AssetType
  rebatePips     Decimal   @db.Decimal(10, 4)
  markupPips     Decimal   @db.Decimal(10, 4) @default(0)
  markupPercent  Decimal   @db.Decimal(5, 2)  @default(100)  // 100% hoặc 80%
  maxPips        Decimal   @db.Decimal(10, 4) // giới hạn từ cấp trên

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([ibId, assetType])
  @@map("rebate_configs")
}

// ─── Rebate Transaction (lịch sử) ───────────────────────────────

model RebateTransaction {
  id           String    @id @default(uuid())
  ibId         String
  ib           IbNode    @relation(fields: [ibId], references: [id])
  assetType    AssetType
  lots         Decimal   @db.Decimal(10, 4)
  rebateAmount Decimal   @db.Decimal(10, 4)
  currency     String    @default("USD")
  tradedAt     DateTime

  createdAt DateTime @default(now())

  @@index([ibId, tradedAt])
  @@index([assetType, tradedAt])
  @@map("rebate_transactions")
}

// ─── Refresh Token ───────────────────────────────────────────────

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  ibId      String
  ib        IbNode   @relation(fields: [ibId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@map("refresh_tokens")
}

// ─── Enums ───────────────────────────────────────────────────────

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
  role: "IB" | "MIB" | "ADMIN";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// ─── IB Node ─────────────────────────────────────────────────────

export interface IbNode {
  id: string;
  email: string;
  level: number;
  parentId: string | null;
  totalChildren?: number;
  createdAt: string;
}

export interface IbTreeNode extends IbNode {
  children: IbTreeNode[];
}

// ─── Rebate Config ────────────────────────────────────────────────

export interface RebateAssetConfig {
  assetType: AssetType;
  rebatePips: number;
  markupPips: number;
  markupPercent: number;  // 80 hoặc 100
  maxPips: number;
}

export interface RebateConfig {
  ibId: string;
  assets: RebateAssetConfig[];
  updatedAt: string;
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
  lots: number;
  rebateAmount: number;
  currency: string;
  tradedAt: string;
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
