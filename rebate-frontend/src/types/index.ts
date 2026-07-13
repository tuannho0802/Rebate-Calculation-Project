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
  unreadCount?: number;
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
  name?: string;
  level: number;
  parentId: string | null;
  parent?: {
    email: string;
    name?: string | null;
  } | null;
  parentEmail?: string;
  parentName?: string | null;
  accountType?: string;
  isActive: boolean;
  totalChildren?: number;
  createdAt: string;
}

export interface IbTreeNode extends IbNode {
  children: IbTreeNode[];
}

// ─── Rebate Config ────────────────────────────────────────────────

export interface RebateAssetConfig {
  assetType: AssetType;
  rebateType: string;
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
  ibName?: string;
  assetType: AssetType;
  lots: number;
  rebateAmount: number;
  currency: string;
  tradedAt: string;
}

export enum NotificationType {
  SYSTEM = "SYSTEM",
  IB_JOINED = "IB_JOINED",
  TRANSACTION_ADDED = "TRANSACTION_ADDED",
  REBATE_UPDATED = "REBATE_UPDATED",
  IB_DEACTIVATED = "IB_DEACTIVATED",
  IB_RESTORED = "IB_RESTORED",
  MANUAL = "MANUAL",
}

export enum PayoutStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PAID = "PAID",
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

export interface Notification {
  id: string;
  recipientId: string;
  senderId?: string | null;
  sender?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────

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

// ─── Ib Performance ───────────────────────────────────────────────

export interface IbPerformanceResponse {
  ib: {
    id: string;
    email: string;
    level: number;
  };
  period: {
    month: string;
  };
  overall: {
    totalLots: number;
    transactionCount: number;
  };
  byAssetType: Array<{
    assetType: AssetType;
    lots: number;
    count: number;
    rebateUsd: number;
  }>;
}

// ─── Change Password ───────────────────────────────────────────────

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}
