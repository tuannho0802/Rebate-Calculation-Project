# Auth Flow & Authorization

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

```typescript
interface JwtPayload {
  sub: string;      // IB ID (UUID)
  email: string;
  level: number;    // 0=MIB, 1, 2, 3, 4, 5
  role: "IB" | "MIB" | "ADMIN";
  iat: number;
  exp: number;
}
```

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
// Kiểm tra ibId có nằm trong subtree của currentUser không
async function isInSubtree(currentUserId: string, targetIbId: string): Promise<boolean> {
  // Dùng recursive CTE để check
  const result = await prisma.$queryRaw`
    WITH RECURSIVE subtree AS (
      SELECT id FROM ib_nodes WHERE id = ${currentUserId}
      UNION ALL
      SELECT n.id FROM ib_nodes n
      INNER JOIN subtree s ON n.parent_id = s.id
    )
    SELECT EXISTS(SELECT 1 FROM subtree WHERE id = ${targetIbId}) as found
  `;
  return result[0].found;
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
