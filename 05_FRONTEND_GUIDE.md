# Frontend Development Guide (Next.js 14)

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
│   ├── layout.tsx
│   ├── page.tsx                  # Redirect → /dashboard
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   └── (dashboard)/
│       ├── layout.tsx            # Auth guard + sidebar
│       ├── dashboard/
│       │   └── page.tsx          # Overview rebate của mình
│       ├── tree/
│       │   └── page.tsx          # Cây IB phân cấp
│       ├── rebate/
│       │   ├── page.tsx          # Config rebate
│       │   └── [ibId]/
│       │       └── page.tsx
│       └── report/
│           └── page.tsx
│
├── components/
│   ├── ui/                       # Primitives (Button, Input, Table...)
│   ├── ib-tree/
│   │   ├── TreeNode.tsx
│   │   └── IbTreeView.tsx
│   ├── rebate/
│   │   ├── RebateConfigTable.tsx
│   │   └── RebateCalculator.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       └── Header.tsx
│
├── lib/
│   ├── api/
│   │   ├── client.ts             # Axios instance + interceptors
│   │   ├── auth.ts               # Auth API calls
│   │   ├── ib.ts                 # IB API calls
│   │   ├── rebate.ts             # Rebate API calls
│   │   └── report.ts             # Report API calls
│   └── utils.ts
│
├── store/
│   └── auth.store.ts             # Zustand auth state
│
├── types/
│   └── index.ts                  # Copy từ 02_DATA_MODELS.md
│
└── hooks/
    ├── useIbTree.ts
    ├── useRebateConfig.ts
    └── useReport.ts
```

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
