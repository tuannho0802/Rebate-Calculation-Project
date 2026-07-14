# Auth Flow & Authorization

## Changelog
- **2026-07-14**:
  - JWT payload: `role` được lấy trực tiếp từ database thay vì suy diễn.
  - Thêm đặc quyền Admin (parentId=null, bỏ qua subtree filter).
  - Cập nhật logic SubtreeGuard: chỉ kiểm tra 1 cấp trực tiếp, không dùng đệ quy CTE.

---

## Tổng quan

Hệ thống dùng **JWT** với 2 token:
- **Access Token**: tồn tại 15 phút, dùng cho mọi API call
- **Refresh Token**: tồn tại 7 ngày, chỉ dùng để lấy Access Token mới

---

## Luồng đăng nhập

```
FE                          BE                        DB
 │                           │                         │
 │── POST /auth/login ───────>│                         │
 │   { email, password }      │── SELECT ib_nodes ─────>│
 │                            │<── IB record ───────────│
 │                            │   bcrypt.compare()      │
 │                            │   sign(accessToken)     │
 │                            │   sign(refreshToken)    │
 │                            │── INSERT refresh_tokens >│
 │<── { accessToken,          │                         │
 │      refreshToken, user } ─│                         │
 │                            │                         │
 │   // Lưu tokens:           │                         │
 │   localStorage: accessToken│                         │
 │   httpOnly cookie: refreshToken (nếu có thể)        │
```

---

## Luồng gọi API thông thường

```
FE                                    BE
 │                                     │
 │── GET /ib/tree                      │
 │   Authorization: Bearer <accessToken>│
 │                                     │── verify JWT
 │                                     │── extract { id, level }
 │                                     │── query subtree WHERE parentId = id
 │<── 200 { data: tree } ──────────────│
```

---

## Luồng refresh token (khi access token hết hạn)

```
FE                                    BE
 │                                     │
 │── GET /any-api ─────────────────────>│
 │<── 401 { code: "TOKEN_EXPIRED" } ───│
 │                                     │
 │── POST /auth/refresh ───────────────>│
 │   { refreshToken }                  │── verify refreshToken
 │                                     │── check DB refresh_tokens
 │                                     │── sign new accessToken
 │                                     │── rotate refreshToken
 │<── 200 { accessToken, refreshToken }│
 │                                     │
 │── GET /any-api (retry) ─────────────>│
```

**FE phải implement interceptor** để tự động retry khi gặp 401. Xem `05_FRONTEND_GUIDE.md`.

---

## JWT Payload Structure

interface JwtPayload {
  sub: string;      // IB ID (UUID)
  email: string;
  level: number;    // 0=MIB, 1, 2, 3, 4, 5
  role: "IB" | "ADMIN";
  iat: number;
  exp: number;
}
```

> **Lưu ý Role:** Trường `role` hiện tại được đọc trực tiếp từ database (model `IbNode`), không còn suy diễn từ `level === 0` nữa. Admin có `role = 'ADMIN'`, các IB khác có `role = 'IB'`.
> **Admin Node:** Admin thực sự không có cấu hình rebate hay ví riêng, và `parentId` = `null`.

---

## Authorization Rules (BE enforcement)

### Quy tắc phân quyền

| Action | Ai được phép |
|---|---|
| Xem thông tin IB | IB đó hoặc ancestor trực tiếp |
| Xem subtree | Chỉ thấy subtree của chính mình |
| Tạo IB mới | Tạo được ở cấp trực tiếp dưới mình |
| Cấu hình rebate | Chỉ cấu hình cho IB cấp dưới trực tiếp |
| Xem report | Chỉ thấy data trong subtree của mình |

### Guard logic (BE)

```typescript
// Kiểm tra ibId có nằm trong nhánh quản lý của currentUser không
async function isInSubtree(currentUserId: string, targetIbId: string, currentUserRole: string): Promise<boolean> {
  // Nếu là ADMIN, luôn cho phép
  if (currentUserRole === 'ADMIN') return true;

  // Nếu tự truy cập chính mình
  if (currentUserId === targetIbId) return true;

  // Với IB thường, chỉ được phép xem 1 cấp con TRỰC TIẾP (depth=1)
  const target = await prisma.ibNode.findUnique({
    where: { id: targetIbId },
    select: { parentId: true }
  });

  return target?.parentId === currentUserId;
}
```

---

## FE Token Storage

```typescript
// Khuyến nghị:
// - accessToken: memory (React state / Zustand) — bảo mật hơn
// - refreshToken: httpOnly cookie (nếu BE support CORS cookie)
//   hoặc localStorage (đơn giản hơn, chấp nhận được cho B2B tool)

// Với Vercel deploy, dùng localStorage là đủ cho use case IB tool này.
const TOKEN_KEY = "ib_access_token";
const REFRESH_KEY = "ib_refresh_token";
```

---

## Mã lỗi Auth

| Code | HTTP | Ý nghĩa |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | Sai email/password |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token hết hạn |
| `AUTH_TOKEN_INVALID` | 401 | Token sai format/bị giả mạo |
| `AUTH_REFRESH_EXPIRED` | 401 | Refresh token hết hạn, cần login lại |
| `AUTH_FORBIDDEN` | 403 | Không có quyền truy cập resource |
