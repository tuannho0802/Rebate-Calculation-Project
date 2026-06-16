// Enums
export enum AssetType {
  D_FOREX        = 'D_FOREX',
  FOREX          = 'FOREX',
  GOLD           = 'GOLD',
  SILVER_5000    = 'SILVER_5000',
  SILVER_1000    = 'SILVER_1000',
  OIL            = 'OIL',
  NATURE_GAS     = 'NATURE_GAS',
  COMMODITIES    = 'COMMODITIES',
  HKG50          = 'HKG50',
  A50            = 'A50',
  JPN225         = 'JPN225',
  US_INDEX       = 'US_INDEX',
  SHARES         = 'SHARES',
  ETHEREUM       = 'ETHEREUM',
  PRECIOUS_METAL = 'PRECIOUS_METAL',
  BITCOIN        = 'BITCOIN',
  CRYPTO         = 'CRYPTO',
  GAUCNH         = 'GAUCNH',
}

// API Response Envelope
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

// User / Auth
export interface AuthUser {
  id: string;
  email: string;
  level: number;
  role: 'IB' | 'MIB' | 'ADMIN';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// IB Node
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

// Rebate Config
export interface RebateAssetConfig {
  assetType: AssetType;
  rebatePips: number;
  markupPips: number;
  markupPercent: number; // 80 hoặc 100
  maxPips: number;
}

export interface RebateConfig {
  ibId: string;
  assets: RebateAssetConfig[];
  updatedAt: string;
}

// Rebate Calculation
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

// Report
export interface ReportSummary {
  period: string; // "YYYY-MM"
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

// Max Pips Reference
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
