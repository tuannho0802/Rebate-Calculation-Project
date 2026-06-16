# API Contract

> **Nguồn sự thật duy nhất cho toàn bộ API.**
> Mọi thay đổi phải cập nhật file này trước khi code.

---

## Conventions

### Base URL
```
Development : http://localhost:3001/api
Production  : https://your-backend.vercel.app/api
```

### Request Headers (mọi request cần auth)
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Response Envelope — LUÔN theo format này

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {               
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```
> `meta` chỉ có khi response là danh sách phân trang.

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "IB_NOT_FOUND",
    "message": "IB không tồn tại",
    "details": {}
  }
}
```

### HTTP Status Codes
| Code | Dùng khi |
|---|---|
| 200 | GET/PUT thành công |
| 201 | POST tạo mới thành công |
| 400 | Request data không hợp lệ |
| 401 | Chưa đăng nhập / token hết hạn |
| 403 | Không có quyền truy cập resource này |
| 404 | Resource không tồn tại |
| 422 | Validation error (field cụ thể) |
| 500 | Lỗi server |

---

## Auth Endpoints

### POST /auth/login
Đăng nhập, nhận JWT.

**Request:**
```json
{
  "email": "ib@example.com",
  "password": "string"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "uuid",
      "email": "ib@example.com",
      "level": 1,
      "role": "IB"
    }
  }
}
```

---

### POST /auth/refresh
Lấy access token mới bằng refresh token.

**Request:**
```json
{ "refreshToken": "eyJ..." }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

---

### POST /auth/logout
**Request:** không có body.
**Response 200:** `{ "success": true, "data": null }`

---

## IB Tree Endpoints

### GET /ib/me
Lấy thông tin IB hiện tại đang đăng nhập.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "ib@example.com",
    "level": 2,
    "parentId": "uuid",
    "totalChildren": 5,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### GET /ib/tree
Lấy toàn bộ subtree của IB đang đăng nhập (chỉ thấy cấp dưới mình).

**Query params:**
```
?depth=1        // Chỉ lấy cấp con trực tiếp (default)
?depth=all      // Lấy toàn bộ subtree
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "ib@example.com",
    "level": 1,
    "children": [
      {
        "id": "uuid",
        "email": "child-ib@example.com",
        "level": 2,
        "children": []
      }
    ]
  }
}
```

---

### GET /ib/:id
Lấy thông tin một IB cụ thể (chỉ được xem nếu là cấp dưới của mình).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "string",
    "level": 3,
    "parentId": "uuid",
    "rebateConfig": { ... },
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### POST /ib
Tạo IB mới ở cấp dưới của IB hiện tại.

**Request:**
```json
{
  "email": "new-ib@example.com",
  "password": "string"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "new-ib@example.com",
    "level": 2,
    "parentId": "uuid"
  }
}
```

---

## Rebate Config Endpoints

### GET /rebate/config/:ibId
Lấy cấu hình rebate của một IB.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "ibId": "uuid",
    "assets": [
      {
        "assetType": "FOREX",
        "rebatePips": 2,
        "markupPips": 8,
        "markupPercent": 100,
        "maxPips": 12
      },
      {
        "assetType": "GOLD",
        "rebatePips": 2,
        "markupPips": 18,
        "markupPercent": 100,
        "maxPips": 20
      }
    ],
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### PUT /rebate/config/:ibId
Cập nhật cấu hình rebate (chỉ IB cấp trên mới được update cho cấp dưới).

**Request:**
```json
{
  "assets": [
    {
      "assetType": "FOREX",
      "rebatePips": 2,
      "markupPips": 8,
      "markupPercent": 100
    }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { /* rebate config object như GET */ }
}
```

---

### GET /rebate/calculate
Tính toán rebate theo volume giao dịch.

**Query params:**
```
?ibId=uuid
?assetType=FOREX
?lots=10
?period=2024-01      // optional, YYYY-MM
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "ibId": "uuid",
    "assetType": "FOREX",
    "lots": 10,
    "rebatePips": 2,
    "totalRebate": 20,
    "currency": "USD",
    "breakdown": {
      "self": 2,
      "distributed": [
        { "ibId": "uuid-child", "level": 2, "amount": 8 }
      ]
    }
  }
}
```

---

## Report Endpoints

### GET /report/summary
Tổng quan rebate của IB hiện tại và subtree.

**Query params:**
```
?period=2024-01       // YYYY-MM (default: tháng hiện tại)
?ibId=uuid            // optional — filter cho IB cụ thể trong subtree
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": "2024-01",
    "totalRebate": 1250.50,
    "currency": "USD",
    "byAsset": [
      { "assetType": "FOREX", "totalRebate": 500.00, "lots": 250 },
      { "assetType": "GOLD",  "totalRebate": 750.50, "lots": 37.5 }
    ],
    "byIB": [
      {
        "ibId": "uuid",
        "email": "child@example.com",
        "level": 2,
        "totalRebate": 400.00
      }
    ]
  }
}
```

---

### GET /report/transactions
Lịch sử giao dịch có rebate.

**Query params:**
```
?page=1
?limit=20
?period=2024-01
?ibId=uuid
?assetType=FOREX
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "ibId": "uuid",
      "assetType": "FOREX",
      "lots": 1.5,
      "rebateAmount": 3.00,
      "tradedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

## Asset Types (enum chuẩn)

FE và BE đều phải dùng đúng các giá trị này:

```typescript
enum AssetType {
  D_FOREX       = "D_FOREX",
  FOREX         = "FOREX",
  GOLD          = "GOLD",
  SILVER_5000   = "SILVER_5000",
  SILVER_1000   = "SILVER_1000",
  OIL           = "OIL",
  NATURE_GAS    = "NATURE_GAS",
  COMMODITIES   = "COMMODITIES",
  HKG50         = "HKG50",
  A50           = "A50",
  JPN225        = "JPN225",
  US_INDEX      = "US_INDEX",
  SHARES        = "SHARES",
  ETHEREUM      = "ETHEREUM",
  PRECIOUS_METAL = "PRECIOUS_METAL",
  BITCOIN       = "BITCOIN",
  CRYPTO        = "CRYPTO",
  GAUCNH        = "GAUCNH"
}
```
