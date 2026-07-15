# API Contract

> **Nguồn sự thật duy nhất cho toàn bộ API.**
> Mọi thay đổi phải cập nhật file này trước khi code.

## Changelog
- **2026-07-15 (cascade formula mới — rebate.service.ts)**:
  - Ghi rõ ràng vào docs: `PUT /rebate/config/mib/:mibId/max-override` giờ validate `maxPips <= MAX_PIPS[assetType]` (trần công ty). Trước đây không có giới hạn này. `MAX_OVERRIDE_INVALID` (422) nếu vượt.
  - Ghi rõ: `maxPips` trong response `GET /rebate/config/:ibId` hiện phản ánh công thức cascade mới: `maxPips(con) = max(0, parent.maxPips - parent.rebatePips)`. Con trực tiếp của MIB nhận `maxPips = mibMaxPips - mibRebatePips` (không còn bị giữ nguyên 0 như trước).
  - Xoá ghi chú cũ "markupPips=0 của MIB gây label sai" — đã fix ở FE layer, không liên quan BE API.
- **2026-07-14 (validation authority + chain view API)**:
  - **Thêm mới**: `GET /ib/:id/tree` cho Chain View, chỉ `ADMIN` được phép dùng để xem cây bắt đầu từ một IB bất kỳ.
  - **Sửa** `POST /ib`: request có thêm field optional `accountTypeTemplateId`.
  - Ghi rõ: `ib_nodes.accountType` giờ chỉ là nhãn hiển thị (tên template lúc tạo), **không** được đọc lại để tính `markupMax` hay validate runtime.
- **2026-07-14 (phát hiện qua test scratch PUT /rebate/config/bulk)**:
  - Sửa `GET /ib/tree`: response shape phụ thuộc role, docs cũ chỉ ghi 1 dạng object, thiếu
    trường hợp ADMIN. Nguồn: `ib.service.ts:103-107`.
- **2026-07-14 (cập nhật lần 3 — Rebate Management bulk endpoint)**:
  - **Thêm mới**: `PUT /rebate/config/bulk` — cập nhật cấu hình rebate cho nhiều IB trong một
    request (thay thế vòng lặp FE gọi N lần `PUT /rebate/config/:ibId`). Chỉ dành cho ADMIN.
- **2026-07-14 (cập nhật lần 2 — đối chiếu trực tiếp source code BE, không suy đoán)**:
  - **Thêm mới hoàn toàn**: `GET/PUT /api/rebate/ib/:ibId/templates` (Account Type Template +
    Markup Link Template) — trước đây không có trong docs dù đã tồn tại trên BE.
  - **Sửa** `GET /rebate/config/:ibId`: response mỗi phần tử `assets[]` có thêm `rebateType`
    và `updatedAt` (docs cũ thiếu 2 field này).
  - **Sửa** `PUT /rebate/config/:ibId`: request `assets[]` có thêm field `rebateType` (optional,
    default `"STP_REBATE"` nếu không gửi).
  - **Sửa** response shape thật của toàn bộ Admin/Trash endpoints (docs cũ chỉ ghi
    `success: true` chung chung, không đủ để FE code chính xác).
  - Toàn bộ mã lỗi liên quan xem `06_ERROR_CODES.md` (đã cập nhật đầy đủ ~30 mã).

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
> Danh sách đầy đủ mã lỗi thật: xem `06_ERROR_CODES.md`.

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

**Lưu ý:** Tài khoản bị vô hiệu hóa (`isActive: false`) đăng nhập sẽ nhận
`AUTH_INVALID_CREDENTIALS` (401) — BE không phân biệt riêng với sai mật khẩu.

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
**Lưu ý Role:**
- Admin: Lấy toàn bộ cây hệ thống (bỏ qua filter parentId).
- IB thường: Chỉ lấy cấp dưới trực tiếp (depth=1).

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

**Lưu ý QUAN TRỌNG — shape khác nhau theo role (đã xác nhận qua code thật, không phải suy đoán):**

- **IB thường:** `data` là **1 object** — chính node của IB đang đăng nhập (như ví dụ trên).
- **ADMIN:** `data` là **MẢNG các root MIB node** (`level: 0`) trong toàn hệ thống, mỗi root
  chứa `children` lồng đệ quy xuống hết subtree. KHÔNG phải 1 object đơn như IB thường.

**Response 200 khi caller là ADMIN:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-mib-1",
      "email": "mib@test.com",
      "level": 0,
      "children": [
        { "id": "uuid", "email": "lv1-a@test.com", "level": 1, "children": [ /* ... */ ] }
      ]
    }
  ]
}
```

⚠️ FE nào đang gọi `GET /ib/tree` với ADMIN mà xử lý `data` như 1 object đơn (ví dụ trang
Rebate Management ở `13_PROMPT_REBATE_MANAGEMENT_AND_ROLE_UI.md`) cần kiểm tra lại và xử lý
`Array.isArray(data)` trước khi flatten cây.

---

### GET /ib/:id/tree
Lấy subtree bắt đầu từ 1 IB cụ thể (không nhất thiết là người đang đăng nhập). Dùng cho
"Chain View" — chọn từng cấp một để chỉnh sửa rebate config theo chuỗi.

**Auth:** `JwtAuthGuard` + `@Roles('ADMIN')` — **chỉ ADMIN, vĩnh viễn**.
Lý do nghiệp vụ đã chốt: chỉ Admin được phép nhìn xuyên cấp; MIB/IB thường theo đúng thiết kế
chỉ được xem con trực tiếp của mình. Endpoint này **không** được mở rộng cho role `IB` trừ khi
có quyết định nghiệp vụ mới rõ ràng từ chủ dự án.

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
    "id": "uuid-target",
    "email": "lv1@example.com",
    "level": 1,
    "children": [
      {
        "id": "uuid-child",
        "email": "lv2@example.com",
        "level": 2,
        "children": []
      }
    ]
  }
}
```

**Lưu ý:** shape response giống `GET /ib/tree` cho mode object, nhưng node gốc là `:id` thay vì
người đang đăng nhập.

**Error:**
- `IB_NOT_FOUND` (404) nếu `:id` không tồn tại.
- `FORBIDDEN_ROLES_ONLY` (403) nếu caller không phải `ADMIN`.

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
  "password": "string",
  "accountTypeTemplateId": "uuid (optional) — nếu có, copy rows của template này thành rebate_configs khởi tạo cho IB mới"
}
```

**Lưu ý:**
- `accountTypeTemplateId` dùng để khởi tạo `rebate_configs` cho IB mới từ template đã chọn.
- `ib_nodes.accountType` chỉ còn là nhãn hiển thị lưu tên template lúc tạo, không tham gia
  validate runtime hay tính `markupMax`.

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

**Dùng ở đâu:**
- Là endpoint GET dùng chung để load cả:
  - cấu hình Rebate Management của 1 IB, và
  - bảng "Trần hoa hồng theo MIB" ở FE Admin.
- Không có endpoint GET riêng cho màn "Trần hoa hồng theo MIB"; FE đọc `assets[].maxPips` từ
  chính response của endpoint này.

**Response 200 (ĐÃ SỬA — có `rebateType` và `updatedAt` per-asset, docs cũ thiếu 2 field này):**
```json
{
  "success": true,
  "data": {
    "ibId": "uuid",
    "assets": [
      {
        "assetType": "FOREX",
        "rebateType": "STP_REBATE",
        "rebatePips": 2,
        "markupPips": 8,
        "markupPercent": 100,
        "maxPips": 12,
        "updatedAt": "2024-01-01T00:00:00Z"
      },
      {
        "assetType": "GOLD",
        "rebateType": "STP_REBATE",
        "rebatePips": 2,
        "markupPips": 18,
        "markupPercent": 100,
        "maxPips": 20,
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### PUT /rebate/config/mib/:mibId/max-override
Set trần hoa hồng tuỳ chỉnh cho 1 MIB cụ thể theo từng `assetType` (chỉ ADMIN).

**Phân quyền và ràng buộc:**
- Chỉ role `ADMIN` mới gọi được endpoint này.
- `mibId` phải là node `level = 0`; nếu không sẽ lỗi `NOT_A_MIB`.
- `maxPips` phải `>= 0`; nếu không sẽ lỗi `MAX_OVERRIDE_INVALID`.
- **MỚI 2026-07-15:** `maxPips` phải `<= MAX_PIPS[assetType]` (trần công ty). Ví dụ D_FOREX không thể đặt maxPips > 12. Lỗi `MAX_OVERRIDE_INVALID` (422) nếu vượt.
- `rebateType` là field **bắt buộc** trong từng phần tử `overrides[]`.

**Request:**
```json
{
  "overrides": [
    {
      "assetType": "D_FOREX",
      "rebateType": "STP_REBATE",
      "maxPips": 15
    }
  ]
}
```

**Response 200:**
- Service trả về lại `getConfig(mibId)` sau khi upsert MIB và cascade `maxPips` xuống subtree.
- Vì dùng response envelope chuẩn, shape thật là:

```json
{
  "success": true,
  "data": {
    "ibId": "uuid-mib",
    "assets": [
      {
        "assetType": "D_FOREX",
        "rebateType": "STP_REBATE",
        "rebatePips": 0,
        "markupPips": 0,
        "markupPercent": 100,
        "maxPips": 15,
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**HTTP status / error codes đã xác nhận từ code:**
- `200`: áp dụng override thành công.
- `400`: `NOT_A_MIB` — target không phải MIB `level 0`.
- `403`: caller không phải ADMIN (`FORBIDDEN_ROLES_ONLY` từ `RolesGuard`).
- `422`: `MAX_OVERRIDE_INVALID` — `maxPips < 0`.
- `422`: validation error nếu `overrides` không hợp lệ theo DTO.

---

### PUT /rebate/config/:ibId
Cập nhật cấu hình rebate (chỉ IB cấp trên mới được update cho cấp dưới trực tiếp —
`REBATE_TARGET_NOT_DIRECT_CHILD` nếu không phải cấp dưới trực tiếp).

**Request (ĐÃ SỬA — `rebateType` optional, default `"STP_REBATE"` nếu bỏ trống):**
```json
{
  "notifyScope": "cascade", // optional: "direct" | "cascade" — chỉ có tác dụng khi caller là ADMIN
  "assets": [
    {
      "assetType": "FOREX",
      "rebateType": "STP_REBATE",  // optional, default "STP_REBATE"
      "rebatePips": 2,
      "markupPips": 8,
      "markupPercent": 100
    }
  ]
}
```
> `(ibId, assetType, rebateType)` là unique key để upsert — nếu FE gửi `rebateType` khác với
> config hiện có cho cùng `assetType`, BE sẽ tạo **thêm 1 config mới** thay vì update config cũ.
> FE cần cẩn thận khi cho phép đổi `rebateType` trên UI.

**Response 200:**
```json
{
  "success": true,
  "data": { /* rebate config object như GET */ }
}
```

**Error codes đặc thù:** `REBATE_INVALID` (422), `REBATE_EXCEEDS_MAX` (422), `MARKUP_INVALID`
(422), `MARKUP_EXCEEDS_MAX` (422), `REBATE_TARGET_NOT_DIRECT_CHILD` (403). Xem chi tiết
`06_ERROR_CODES.md`.

---

### PUT /rebate/config/bulk
Cập nhật cấu hình rebate cho **NHIỀU IB** trong một request (thay thế cách làm cũ: FE gọi
vòng lặp N lần `PUT /rebate/config/:ibId`). Dùng cho trang "Rebate Management".

> ⚠️ **QUAN TRỌNG (NestJS route order):** route này PHẢI được khai báo **TRƯỚC** route
> `PUT /rebate/config/:ibId` trong `rebate.controller.ts`, nếu không Nest sẽ hiểu `"bulk"` là
> giá trị của param `:ibId`.

**Auth:** `JwtAuthGuard` + `RolesGuard` + `@Roles('ADMIN')` — endpoint này **CHỈ** dành cho ADMIN.
IB thường gọi nhận `FORBIDDEN_ROLES_ONLY` (403).

**Giới hạn:** tối đa **200** phần tử trong `items[]` mỗi request → nếu vượt hoặc rỗng, trả
`VALIDATION_ERROR` (422).

**Request:**
```json
{
  "notifyScope": "cascade",
  "items": [
    {
      "ibId": "uuid",
      "assets": [
        {
          "assetType": "FOREX",
          "rebateType": "STP_REBATE",
          "rebatePips": 2,
          "markupPips": 8,
          "markupPercent": 100
        }
      ]
    }
  ]
}
```
> `notifyScope` optional: `"direct"` | `"cascade"` — giữ đúng hành vi như `PUT` đơn (caller luôn
> là ADMIN ở endpoint này). `rebateType` trong mỗi asset optional, default `"STP_REBATE"`.

**Hành vi xử lý (bắt buộc):**
- Mỗi phần tử trong `items[]` được xử lý **độc lập** (không phải 1 transaction bao trùm toàn bộ
  request) — semantics **partial success**: một IB lỗi không rollback các IB khác đã lưu thành công.
- Mỗi phần tử tái sử dụng nguyên vẹn logic validate + upsert + ghi `RebateConfigHistory` +
  `AuditLog` + `Notification` đã có trong `rebate.service.ts` cho `updateConfig()` — không viết
  lại logic mới, không nới lỏng validate so với PUT đơn lẻ.
- Không thêm mã lỗi mới — tái sử dụng: `REBATE_INVALID`, `REBATE_EXCEEDS_MAX`, `MARKUP_INVALID`,
  `MARKUP_EXCEEDS_MAX`, `REBATE_TARGET_NOT_DIRECT_CHILD`, `IB_NOT_IN_SUBTREE`, `IB_NOT_FOUND`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "ibId": "uuid",
        "success": true,
        "config": {
          "ibId": "uuid",
          "assets": [
            {
              "assetType": "FOREX",
              "rebateType": "STP_REBATE",
              "rebatePips": 2,
              "markupPips": 8,
              "markupPercent": 100,
              "maxPips": 10,
              "updatedAt": "2024-01-01T00:00:00Z"
            }
          ],
          "updatedAt": "2024-01-01T00:00:00Z"
        }
      },
      {
        "ibId": "uuid-2",
        "success": false,
        "error": {
          "code": "REBATE_EXCEEDS_MAX",
          "message": "Số rebatePips vượt quá giới hạn tối đa (12 pips)",
          "details": {}
        }
      }
    ],
    "successCount": 1,
    "failCount": 1
  }
}
```

**Error đặc thù ở tầng request (không phải per-item):**
- `VALIDATION_ERROR` (422) — `items` rỗng hoặc vượt quá 200 phần tử
- `FORBIDDEN_ROLES_ONLY` (403) — caller không phải ADMIN

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

## Rebate Templates Endpoints (MỚI — trước đây thiếu hoàn toàn khỏi docs)

> Auth: `JwtAuthGuard` + `SubtreeGuard`. Admin bypass toàn bộ; user thường chỉ truy cập chính
> mình (`user.sub === ibId`) hoặc con trực tiếp (`parentId === user.sub`).

### GET /rebate/ib/:ibId/templates
Lấy danh sách Account Type Template + Markup Link Template của một IB.

**Lưu ý hành vi đặc biệt:** `ownerId` thật sự dùng để query được resolve lên **root MIB**
(ancestor gần nhất có `parentId = null`) của `ibId`, KHÔNG phải chính `ibId` truyền vào.
Nghĩa là mọi IB trong cùng 1 nhánh MIB đều nhìn thấy chung 1 bộ template của root MIB đó.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accountTypeTemplates": [
      {
        "id": "uuid",
        "name": "SEA STD",
        "rows": [
          { "assetType": "FOREX", "maxCeiling": "8", "calcUnit": "pips" }
        ]
      }
    ],
    "markupLinkTemplates": [
      { "id": "uuid", "name": "SEA STD", "share": 8 }
    ]
  }
}
```

### PUT /rebate/ib/:ibId/templates
Ghi đè toàn bộ template của IB (theo `ibId` truyền vào trực tiếp — **KHÁC hành vi GET**,
không resolve lên root MIB). Đây là thao tác **replace toàn bộ**: BE xóa hết
`AccountTypeTemplate` + `MarkupLinkTemplate` hiện có của `ownerId = ibId` rồi tạo lại từ payload
(trong 1 transaction).

⚠️ **Lưu ý quan trọng cho FE:** vì GET resolve lên root MIB còn PUT ghi thẳng theo `ibId`
param, nếu FE gọi `PUT /rebate/ib/:childId/templates` (không phải root MIB), dữ liệu sẽ được
lưu với `ownerId = childId` — **KHÔNG cập nhật vào template chung của root MIB** mà GET đang
trả về. Để tránh nhầm lẫn, khuyến nghị: chỉ cho phép sửa template tại trang do root MIB (hoặc
Admin) truy cập, luôn gọi PUT với `ibId` = root MIB.

**Request:**
```json
{
  "accountTypeTemplates": [
    {
      "name": "SEA STD",
      "rows": [
        { "assetType": "FOREX", "maxCeiling": "8", "calcUnit": "pips" }
      ]
    }
  ],
  "markupLinkTemplates": [
    { "name": "SEA STD", "share": 8 }
  ]
}
```
> Không gửi `id` — bị `whitelist: true` strip nếu có. Đây là **replace toàn bộ**, không phải
> merge/patch từng phần tử.

**Response 200:** cùng shape với GET (BE gọi lại `getTemplates()` sau khi lưu).

**Ràng buộc DTO (bắt buộc theo đúng thứ tự field, đều là string):**
| Field | Type | Required |
|---|---|---|
| `accountTypeTemplates[].name` | string | ✅ |
| `accountTypeTemplates[].rows[].assetType` | string | ✅ |
| `accountTypeTemplates[].rows[].maxCeiling` | string | ✅ |
| `accountTypeTemplates[].rows[].calcUnit` | string | ✅ |
| `markupLinkTemplates[].name` | string | ✅ |
| `markupLinkTemplates[].share` | number (≥0) | ✅ |

**Không có:** giới hạn số lượng template, validate tên trùng, error code riêng cho templates
(chỉ dùng `VALIDATION_ERROR`, `IB_NOT_IN_SUBTREE`, `AUTH_TOKEN_INVALID/EXPIRED`).

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
      "rebateType": "STP_REBATE",
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

## Rebate Types (enum — MỚI, trước đây thiếu khỏi docs)

```typescript
enum RebateType {
  STP_REBATE          = "STP_REBATE",
  CENT_REBATE         = "CENT_REBATE",
  COMMISSION_PERCENT  = "COMMISSION_PERCENT",
  STP_ADDED_POINTS    = "STP_ADDED_POINTS",
  ECN_COPY_REBATE     = "ECN_COPY_REBATE"
}
```

---
---

## Dashboard Endpoints

### GET /dashboard/summary
Lấy tổng quan thông số Dashboard của IB hiện tại và toàn bộ subtree.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "ibStats": {
      "totalInSubtree": 150
    },
    "transactionStats": {
      "todayCount": 45,
      "monthLots": 1200.5
    },
    "topIbsThisMonth": [
      {
        "ib": {
          "id": "uuid",
          "email": "top-ib@example.com",
          "level": 2
        },
        "lots": 450.5
      }
    ],
    "generatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error codes đặc thù:** `INVALID_PERIOD` (400) nếu tham số kỳ báo cáo sai định dạng.

---

## Notification Endpoints

### GET /notifications
Lấy danh sách thông báo của IB hiện tại.

**Query params:**
```
?page=1
?limit=20
?isRead=false       // optional — Lọc theo trạng thái đọc
?type=MANUAL        // optional — Lọc theo loại (MANUAL, IB_JOINED, v.v.)
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "recipientId": "uuid",
      "senderId": "uuid",
      "type": "MANUAL",
      "title": "Tiêu đề thông báo",
      "body": "Nội dung thông báo",
      "metadata": {},
      "isRead": false,
      "readAt": null,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "unreadCount": 5
  }
}
```

---

### POST /notifications/send
Gửi thông báo thủ công (chỉ gửi cho IB trong subtree — `RECIPIENT_NOT_IN_SUBTREE` nếu không).

**Request:**
```json
{
  "recipientId": "uuid",
  "title": "Tiêu đề",
  "body": "Nội dung",
  "type": "MANUAL"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "recipientId": "uuid",
    "senderId": "uuid",
    "type": "MANUAL",
    "title": "Tiêu đề",
    "body": "Nội dung",
    "isRead": false,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### PATCH /notifications/read-all
Đánh dấu tất cả thông báo là đã đọc.

**Response 200:**
```json
{
  "success": true,
  "data": { "updated": 5 }
}
```

---

### PATCH /notifications/:id/read
Đánh dấu một thông báo cụ thể là đã đọc. Lỗi `NOTIFICATION_NOT_FOUND` (404) hoặc
`NOTIFICATION_NOT_YOURS` (403) nếu không phải thông báo của mình.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "isRead": true,
    "readAt": "2024-01-15T10:35:00Z"
  }
}
```

---

### DELETE /notifications/:id
Xóa một thông báo.

**Response 200:**
```json
{
  "success": true,
  "data": { "message": "Thông báo đã được xóa" }
}
```

---

## IB Performance Endpoints

### GET /ib/leaderboard
Lấy bảng xếp hạng các IB trong subtree theo volume giao dịch tháng hiện tại.

**Query params:**
```
?limit=10        // optional — Số lượng top IBs (mặc định 10)
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "ib": { "id": "uuid", "email": "top@example.com", "level": 2 },
      "monthLots": 450.5
    }
  ]
}
```

---

### GET /ib/:id/performance
Lấy chi tiết hiệu suất giao dịch của một IB cụ thể (cấp dưới).

**Query params:**
```
?month=2024-01   // optional — YYYY-MM (mặc định: tháng hiện tại)
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "ib": { "id": "uuid", "email": "child@example.com", "level": 2 },
    "period": { "month": "2024-01" },
    "overall": { "totalLots": 125.5, "transactionCount": 42 },
    "byAssetType": [
      { "assetType": "FOREX", "totalLots": 100.0, "transactionCount": 35 }
    ]
  }
}
```

**Error codes đặc thù:** `INVALID_MONTH_FORMAT` (400).

---

## Rebate History Endpoints

### GET /rebate/config/:ibId/history
Lịch sử thay đổi cấu hình rebate của một IB.

**Query params:**
```
?page=1
?limit=20
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "rebateConfigId": "uuid",
      "before": { "rebatePips": 2, "markupPips": 8 },
      "after": { "rebatePips": 3, "markupPips": 7 },
      "createdAt": "2024-01-15T10:30:00Z",
      "changedBy": { "id": "uuid", "email": "mib@example.com", "name": "Admin" },
      "rebateConfig": { "assetType": "FOREX", "rebateType": "STP_REBATE" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5 }
}
```

---

## Admin Endpoints

> **Lưu ý:** Guard thật là `JwtAuthGuard + RolesGuard + @Roles('ADMIN')`. IB thường gọi nhận
> `FORBIDDEN_ROLES_ONLY` (403), không phải generic `AUTH_FORBIDDEN`.

### POST /admin/users
Tạo Admin mới.

**Request:**
```json
{
  "email": "admin2@azrebate.com",
  "name": "Admin 2",
  "password": "Password123!"
}
```
> `password` yêu cầu tối thiểu 6 ký tự (`@MinLength(6)`).

**Response 201 (shape thật, không có password):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin2@azrebate.com",
    "name": "Admin 2",
    "role": "ADMIN",
    "level": 0,
    "parentId": null,
    "isRootAdmin": false,
    "isActive": true,
    "createdAt": "2026-07-14T00:00:00Z",
    "updatedAt": "2026-07-14T00:00:00Z"
  }
}
```
**Error đặc thù:** `EMAIL_ALREADY_EXISTS` (409).

### GET /admin/users
Lấy danh sách Admin **đang active** (không gồm đã bị vô hiệu hóa — những Admin đó nằm trong
`GET /trash`).

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "string",
      "name": "string",
      "isRootAdmin": false,
      "isActive": true,
      "createdAt": "2026-07-14T00:00:00Z"
    }
  ]
}
```

### PATCH /admin/users/:id
Sửa thông tin Admin. **Không** cho phép sửa `role` hoặc `isRootAdmin` qua API này (không có
trong DTO, bị strip nếu gửi lên).

**Request (tất cả field đều optional):**
```json
{
  "email": "new-email@azrebate.com",
  "name": "Tên mới",
  "password": "NewPassword123!"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "new-email@azrebate.com",
    "name": "Tên mới",
    "isRootAdmin": false,
    "isActive": true,
    "updatedAt": "2026-07-14T00:00:00Z"
  }
}
```
**Error đặc thù:** `ADMIN_NOT_FOUND` (404), `ROOT_ADMIN_PROTECTED` (403) nếu sửa Root Admin.

### DELETE /admin/users/:id
Xóa tạm thời (deactivate) một Admin — chuyển vào Trash Can. Không cho phép xóa Root Admin
(`ProtectRootAdminGuard`).

**Response 200 (shape thật):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Đã khóa Admin"
  }
}
```
**Error đặc thù:** `ADMIN_NOT_FOUND` (404), `ROOT_ADMIN_PROTECTED` (403).

---

## Trash Can Endpoints

> **Lưu ý:** Guard thật `JwtAuthGuard + RolesGuard + @Roles('ADMIN')`. `DELETE` có thêm
> `ProtectRootAdminGuard`.

### GET /trash
Lấy danh sách các tài khoản đã bị vô hiệu hóa (`isActive: false`) — gồm **cả Admin và IB**.

**Response 200 (shape thật):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "string",
      "name": "string",
      "role": "IB",
      "isRootAdmin": false,
      "updatedAt": "2026-07-14T00:00:00Z"
    }
  ]
}
```

### PATCH /trash/:id/restore
Khôi phục (restore) một tài khoản đã bị vô hiệu hóa.

**Response 200 (shape thật):**
```json
{
  "success": true,
  "data": { "success": true, "message": "Khôi phục thành công" }
}
```
**Error đặc thù:** `USER_NOT_FOUND` (404), `USER_NOT_IN_TRASH` (400) nếu tài khoản đang active.

### DELETE /trash/:id/permanent
Xóa vĩnh viễn (hard delete) một tài khoản khỏi cơ sở dữ liệu.
**Ràng buộc:** Sẽ bị chặn (lỗi 400 `HAS_RELATIONS`) nếu tài khoản còn dính líu đến dữ liệu quan
trọng như ví, giao dịch, payout, hoặc cấu hình rebate.

**Response 200 (shape thật):**
```json
{
  "success": true,
  "data": { "success": true, "message": "Đã xóa vĩnh viễn tài khoản" }
}
```
**Error đặc thù:** `USER_NOT_FOUND` (404), `HAS_RELATIONS` (400), `ROOT_ADMIN_PROTECTED` (403).
