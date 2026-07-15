# Frontend Development Guide (Next.js 16, App Router)

> Hướng dẫn setup và cấu trúc Frontend (Next.js App Router).

## Changelog
- **2026-07-15**:
  - Cập nhật **Cấu trúc thư mục** theo code thật: route group `[locale]/(dashboard)/dashboard/...`; thêm `rebate-management`, `admin`, `trash`, `account`; `lib/nav-config.ts` (phân quyền nav); `components/rebate/CompactPivotTable.tsx` + `PivotArrowOverlay.tsx`; `lib/api/rebateTemplates.ts`.
  - Thêm mô tả **3 view** (Flat / Pivot / Compact) của trang `rebate-management` và components `CompactPivotTable` / `PivotArrowOverlay`.
  - Xoá ghi chú PENDING cũ: route restore `/api/ib/:id/restore` đã bị gỡ khỏi BE (2026-07-14); FE dùng `trashApi.restore()` (`/api/trash/:id/restore`).
- **2026-07-14**:
  - FE đồng bộ với BE mới (Role Admin, Thùng rác, Rebate Type, Account Type Template).

---

## Setup dự án

```bash
npx create-next-app@latest ib-rebate-frontend \
  --typescript --tailwind --eslint --app --src-dir

cd ib-rebate-frontend

# Dependencies
npm install zustand axios
npm install @tanstack/react-query
npm install react-hook-form zod @hookform/resolvers
```

---

## Cấu trúc thư mục

```
src/
├── app/
│   ├── [locale]/                      ← i18n locale prefix (vi / en)
│   │   ├── layout.tsx                # Root layout (next-intl)
│   │   ├── page.tsx                  # Redirect → /dashboard
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx            # Sidebar + auth check + role-based route guard
│   │       └── dashboard/
│   │           ├── page.tsx                  # Dashboard tổng quan
│   │           ├── account/page.tsx          # Thông tin tài khoản
│   │           ├── admin/page.tsx            # Quản trị Admin (ADMIN only)
│   │           ├── export/page.tsx           # Xuất Excel
│   │           ├── ib-management/page.tsx    # Quản lý IB
│   │           ├── notification/page.tsx     # Thông báo
│   │           ├── payout/page.tsx           # Rút tiền
│   │           ├── rebate/page.tsx           # Cấu hình rebate (cá nhân)
│   │           ├── rebate-management/page.tsx  # Bulk spreadsheet 3 view (ADMIN only)
│   │           ├── report/page.tsx           # Báo cáo
│   │           ├── transaction/page.tsx      # Lịch sử giao dịch
│   │           ├── trash/page.tsx            # Thùng rác (ADMIN only)
│   │           ├── tree/page.tsx             # Cây IB
│   │           └── tree/edit/[id]/page.tsx   # Chỉnh sửa IB + rebate config
├── middleware.ts                  # next-intl i18n routing (vi/en)
├── i18n/                          # request.ts, routing.ts
├── components/
│   ├── LanguageSwitcher.tsx
│   ├── Providers.tsx              # QueryClientProvider (+ AuthProvider)
│   ├── account/                   # ChangePasswordForm, ProjectStatistics
│   ├── ib-tree/                   # TreeNode, IbTreeView, IbManagementTable,
│   │                              #   CreateIbModal, IbDetailsDrawer, NetworkIbTable, ...
│   └── rebate/
│       ├── AccountTypeBuilder.tsx    # Template gói phí / markup (MIB)
│       ├── CompactPivotTable.tsx     # View 3 "Bảng gọn" (cascading dependent select)
│       ├── MibMaxOverrideSection.tsx # UI set trần MIB (PUT max-override)
│       ├── PivotArrowOverlay.tsx     # SVG overlay mũi tên cha-con (Pivot view)
│       └── RebateCalculateWidget.tsx # Widget tính rebate giả lập
├── lib/
│   ├── api/
│   │   ├── client.ts              # Axios + JWT interceptor + auto-refresh
│   │   ├── auth.ts  ib.ts  rebate.ts  rebateTemplates.ts
│   │   ├── report.ts  transaction.ts  payout.ts
│   │   ├── notification.ts  admin.ts  trash.ts  export.ts
│   ├── error-messages.ts          # mapErrorCode() → thông báo tiếng Việt
│   ├── nav-config.ts              # NAV_ITEMS + filterNavItemsByRole + isAdminOnlyRoute
│   └── tree-utils.ts              # normalizeTreeRoots, flattenIbTree
├── store/auth.store.ts            # Zustand: user (id, email, level, role, isRootAdmin)
├── types/index.ts                 # Shared types (02_DATA_MODELS.md + bulk types)
└── __tests__/                     # Vitest (vd getChildMaxLabel.test.ts)
```

> Lưu ý: `rebate-config` (cá nhân) ở `rebate/page.tsx`; bulk edit nhiều IB ở
> `rebate-management/page.tsx` (ADMIN only, 3 view). `RebateConfigTable.tsx` (file cũ) đã bị xoá.

---

## API Client Setup (QUAN TRỌNG)

```typescript
// src/lib/api/client.ts
import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: tự thêm Bearer token ──
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ib_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: tự refresh khi 401 ──
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue request lại, chờ refresh xong
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('ib_refresh_token');

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newAccessToken = data.data.accessToken;

        localStorage.setItem('ib_access_token', newAccessToken);
        localStorage.setItem('ib_refresh_token', data.data.refreshToken);

        // Retry tất cả queued requests
        failedQueue.forEach(({ resolve }) => resolve(newAccessToken));
        failedQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (_error) {
        // Refresh thất bại → logout
        failedQueue.forEach(({ reject }) => reject(_error));
        failedQueue = [];
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(_error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

---

## API Functions

```typescript
// src/lib/api/auth.ts
import { apiClient } from './client';
import type { AuthTokens } from '@/types';

export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokens> => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return data.data;
  },

  refresh: async (refreshToken: string) => {
    const { data } = await apiClient.post('/auth/refresh', { refreshToken });
    return data.data;
  },

  logout: async () => {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('ib_access_token');
    localStorage.removeItem('ib_refresh_token');
  },
};
```

```typescript
// src/lib/api/ib.ts
import { apiClient } from './client';
import type { IbNode, IbTreeNode } from '@/types';

export const ibApi = {
  getMe: async (): Promise<IbNode> => {
    const { data } = await apiClient.get('/ib/me');
    return data.data;
  },

  getTree: async (depth: 'all' | 1 = 1): Promise<IbTreeNode> => {
    const { data } = await apiClient.get(`/ib/tree?depth=${depth}`);
    return data.data;
  },

  getById: async (id: string): Promise<IbNode> => {
    const { data } = await apiClient.get(`/ib/${id}`);
    return data.data;
  },

  create: async (email: string, password: string): Promise<IbNode> => {
    const { data } = await apiClient.post('/ib', { email, password });
    return data.data;
  },
};
```

```typescript
// src/lib/api/rebate.ts
import { ApiResponse, RebateConfig, RebateCalculation, AssetType, BulkUpdateResponse } from '@/types';
import { apiClient } from './client';

export const rebateApi = {
  getConfig:      (ibId) => apiClient.get(`/rebate/config/${ibId}`),
  updateConfig:   (ibId, assets) => apiClient.put(`/rebate/config/${ibId}`, { assets }),
  bulkUpdateConfig: (items, notifyScope?) =>
    apiClient.put('/rebate/config/bulk', { items, notifyScope }),   // ADMIN only
  setMibMaxOverride: (mibId, overrides) =>
    apiClient.put(`/rebate/config/mib/${mibId}/max-override`, { overrides }), // ADMIN only
  getConfigHistory: (ibId, limit = 20) =>
    apiClient.get(`/rebate/config/${ibId}/history?limit=${limit}`),
  calculate:      (ibId, assetType, lots, period?) =>
    apiClient.get('/rebate/calculate', { params: { ibId, assetType, lots, period } }),
};
```

---

## Rebate Management — 3 Views (Admin)

Trang `src/app/[locale]/(dashboard)/dashboard/rebate-management/page.tsx` là bulk spreadsheet
chỉnh sửa rebate của **NHIỀU IB** trong 1 MIB subtree. State `viewMode` nhận 3 giá trị:

| View | Ý nghĩa | Cấu trúc | Đặc điểm |
|------|---------|----------|----------|
| **Flat** (`'flat'`) | Bảng thường | Hàng = IB (thụt lề theo `level`), Cột = Asset Type | Nút "Hiện quan hệ cha-con" **không** hiện. Mỗi MIB là 1 khối bảng riêng. |
| **Pivot** (`'pivot'`) | Google-Sheet | Hàng = Asset Type, Cột = từng Level | Có toggle "Hiện quan hệ cha-con" (GitBranch) bật `PivotArrowOverlay`. |
| **Compact** (`'compact'`) | Bảng gọn | Hàng = Asset Type, Cột = Level (cascading dependent select) | Cột Level N+1 chỉ liệt kê **con trực tiếp** của node chọn ở Level N; auto ẩn khi không có con. |

- **Lưu 1 lần:** `handleSaveAll()` gom tất cả `dirtyIbs` thành 1 request `rebateApi.bulkUpdateConfig(items)`.
- **`CompactPivotTable.tsx`** (MỚI): `buildColumns()` là pure function tính chuỗi cột động;
  state `CompactSelection = Record<rootId, Record<level, ibId>>` được lift-up lên page.
  Dùng chung `configs` / `dirtyIbs` / `handleCellChange` (không fetch riêng).
- **`PivotArrowOverlay.tsx`** (MỚI): SVG overlay vẽ đường thẳng nối input cha-con. Toggle
  bật/tắt (`showArrows`); khi tắt `return null`. Tọa độ tính theo **hệ nội dung** (cộng
  `scrollLeft`/`scrollTop`) → cuộn cùng bảng, **không** scroll listener, không trễ.
  `data-arrow-id="${ibId}__${assetType}"` trên `<input>`; hover key composite `${ibId}__${assetType}`
  → chỉ highlight đúng hàng đang hover (không lan sang hàng khác).
- Component `RebateConfigTable.tsx` (file cũ) đã **xoá** — trang rebate cá nhân (`rebate/page.tsx`)
  và bulk (`rebate-management`) dùng trực tiếp các input inline + `CompactPivotTable`.

---

## Zustand Auth Store

```typescript
// src/store/auth.store.ts
import { create } from 'zustand';
import type { AuthUser } from '@/types';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user, isLoading: false }),

  logout: () => {
    localStorage.removeItem('ib_access_token');
    localStorage.removeItem('ib_refresh_token');
    set({ user: null });
  },
}));
```

---

## Mock Data (dùng trong giai đoạn đầu)

Khi BE chưa xong, dùng mock data theo đúng schema để FE không bị block:

```typescript
// src/lib/api/mocks.ts
import type { IbTreeNode, RebateConfig } from '@/types';
import { AssetType } from '@/types';

export const MOCK_TREE: IbTreeNode = {
  id: "mock-lv1-id",
  email: "lv1@example.com",
  level: 1,
  parentId: null,
  createdAt: "2024-01-01T00:00:00Z",
  children: [
    {
      id: "mock-lv2-a",
      email: "lv2-a@example.com",
      level: 2,
      parentId: "mock-lv1-id",
      createdAt: "2024-01-02T00:00:00Z",
      children: [],
    },
  ],
};

export const MOCK_REBATE_CONFIG: RebateConfig = {
  ibId: "mock-lv1-id",
  assets: [
    { assetType: AssetType.FOREX, rebatePips: 2, markupPips: 8, markupPercent: 100, maxPips: 12 },
    { assetType: AssetType.GOLD,  rebatePips: 2, markupPips: 18, markupPercent: 100, maxPips: 20 },
  ],
  updatedAt: "2024-01-01T00:00:00Z",
};
```

**Khi BE xong, chỉ cần xóa mock và gọi API thật là xong** — vì types đã đồng nhất.

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# .env.production (Vercel Dashboard)
NEXT_PUBLIC_API_URL=https://your-backend.vercel.app/api
```

---

## Checklist trước khi gọi là "done"

- [ ] API client có đầy đủ request interceptor (Bearer token)
- [ ] API client có response interceptor (auto refresh + logout)
- [ ] Auth guard trong `(dashboard)/layout.tsx` — redirect về `/login` nếu không có token
- [ ] Types import từ `src/types/index.ts` — không tự khai báo type inline
- [ ] Tất cả API call đi qua `src/lib/api/` — không gọi axios trực tiếp trong component
- [ ] Error từ API được xử lý và hiển thị đúng (dùng `error.code` để map message)
- [ ] `NEXT_PUBLIC_API_URL` được set đúng ở cả local và Vercel
