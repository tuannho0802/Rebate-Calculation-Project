# Error Codes Reference

> Danh sách toàn bộ mã lỗi trả về từ API.
> Frontend dựa vào mã code này để map ra câu thông báo tiếng Việt tương ứng.

## Changelog
- **2026-07-15 (CHẶN CỨNG cascade — `dryRunCascadeSubtree`)**:
  - Bổ sung `CASCADE_WOULD_VIOLATE_DESCENDANT` (422): chặn cứng khi sửa 1 node (qua `updateConfig` hoặc `setMibMaxOverride`) sẽ làm node cấp dưới vượt trần sau cascade. Có `details.violations[]` liệt kê node vi phạm.
  - Bổ sung `BULK_PARTIAL_LEFT_VIOLATION` (audit action, không phải error response): ghi log khi bulk save xong mà vẫn còn node tồn tại trạng thái vượt trần (lỗ hổng bulk atomic). Bulk response thêm field `warnings[]`.
- **2026-07-15 (setMibMaxOverride — đối chiếu `rebate.service.ts` thật)**:
  - Bổ sung 2 mã lỗi mới từ `setMibMaxOverride()`: `NOT_A_MIB` (400) và `MAX_OVERRIDE_INVALID` (422). Cả hai đã có trong code từ 2026-07-14 nhưng chưa ghi vào docs.
- **2026-07-14 (cập nhật lần 2 — đối chiếu trực tiếp source code BE)**:
  - Bổ sung ~30 mã lỗi thực tế có trong code nhưng chưa từng được ghi vào docs (grep toàn bộ
    `rebate-backend/src`, xem bảng nguồn `file:dòng` bên dưới).
  - Gỡ `IB_INACTIVE`: **không tồn tại trong code**. Tài khoản bị vô hiệu hóa khi login thực tế
    trả về `AUTH_INVALID_CREDENTIALS` (xem `auth.service.ts:34-38`), không có code riêng.
  - Gỡ `REBATE_ASSET_INVALID`: **không tồn tại trong code**. `assetType` không hợp lệ được
    chặn bởi `@IsEnum(AssetType)` ở tầng validation → trả `VALIDATION_ERROR` (422), không có
    code riêng.
  - Bổ sung bảng "Fallback từ HttpExceptionFilter" — các code generic khi service không throw
    code cụ thể.

---

## Format lỗi chuẩn

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_HERE",
    "message": "Mô tả lỗi (có thể dùng để debug)",
    "details": {}
  }
}
```

---

## Bảng mã lỗi

### Auth Errors (4xx)

| Code | HTTP | Mô tả | FE hiển thị | Nguồn |
|---|---|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | Sai email/password, **hoặc** tài khoản đã bị vô hiệu hóa (không có code riêng cho case này) | "Email hoặc mật khẩu không đúng" | `auth.service.ts:29,36,44,160,168` |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token hết hạn | *(FE tự refresh, không cần show)* | `jwt-auth.guard.ts:19` |
| `AUTH_TOKEN_INVALID` | 401 | Token sai format / bị giả mạo | "Phiên đăng nhập không hợp lệ" | `auth.service.ts:97`, `jwt-auth.guard.ts:24` |
| `AUTH_REFRESH_EXPIRED` | 401 | Refresh token hết hạn | "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại" | `auth.service.ts:113`, `auth.controller.ts:76` |

> ⚠️ **`IB_INACTIVE` đã bị loại bỏ khỏi docs** — không có trong code. FE không cần xử lý
> riêng code này; case tài khoản bị deactivate login được BE gộp chung vào
> `AUTH_INVALID_CREDENTIALS`.

### Role / Permission Errors

| Code | HTTP | Mô tả | FE hiển thị | Nguồn |
|---|---|---|---|---|
| `FORBIDDEN` | 403 | Không có quyền chung (dùng ở payout) | "Bạn không có quyền thực hiện thao tác này" | `payout.service.ts:187` |
| `FORBIDDEN_LV0_ONLY` | 403 | Endpoint chỉ cho phép level=0 hoặc ADMIN | "Bạn không có quyền thực hiện thao tác này" | `lv0.guard.ts:19` |
| `FORBIDDEN_ROLES_ONLY` | 403 | Endpoint chỉ dành cho role cụ thể (vd Admin/Trash routes) | "Bạn không có quyền thực hiện thao tác này" | `roles.guard.ts:24,32` |
| `ROOT_ADMIN_PROTECTED` | 403 | Không thể xóa, vô hiệu hóa, hoặc sửa Root Admin | "Không thể thực hiện thao tác trên Root Admin" | `protect-root-admin.guard.ts:27` |
| `ADMIN_FINANCE_NOT_ALLOWED` | 403 | Admin không được tạo payout cho chính mình | "Admin không thể thực hiện thao tác tài chính cho chính mình" | `self-finance.guard.ts:12` |

### IB Errors

| Code | HTTP | Mô tả | FE hiển thị | Nguồn |
|---|---|---|---|---|
| `HAS_RELATIONS` | 400 | Không thể xóa vĩnh viễn do dữ liệu còn liên kết ở bảng khác (ví, giao dịch...) | "Dữ liệu đang được sử dụng, không thể xóa" | `trash.service.ts:83-119` |
| `EMAIL_ALREADY_EXISTS` | 409 | Email đã tồn tại (dùng ở Admin module) | "Email đã tồn tại" | `admin.service.ts:17,69` |
| `IB_NOT_FOUND` | 404 | IB không tồn tại | "Không tìm thấy IB" | `ib.service.ts:51,73,138,277,331,415,472,687` |
| `IB_EMAIL_TAKEN` | 422 | Email đã được dùng (dùng ở IB module) | "Email này đã được sử dụng" | `ib.service.ts:181,284` |
| `IB_NOT_IN_SUBTREE` | 403 | IB không thuộc subtree của bạn | "Bạn không có quyền xem thông tin IB này" | `subtree.guard.ts:80`, `ib.service.ts:410,461,562`, `rebate.service.ts:355`, `report.service.ts:23`, `export.service.ts:291`, `wallet.service.ts:61`, `transaction.service.ts:90,225` |
| `IB_MAX_LEVEL_REACHED` | 422 | Đã đạt cấp tối đa (Lv5/Sub5) | "Không thể tạo thêm cấp dưới" | `ib.service.ts:170` |
| `IB_ACTION_NOT_ALLOWED` | 422 | Thao tác không hợp lệ trên IB (context cụ thể tùy vị trí) | "Không thể thực hiện thao tác này" | `ib.service.ts:323,338` |
| `INVALID_JSON` | 403 | Dữ liệu JSON không hợp lệ (field liên quan tới profile) | "Dữ liệu không hợp lệ" | `ib.service.ts:419,422` |
| `INVALID_MONTH_FORMAT` | 400 | Tham số tháng sai định dạng (không phải `YYYY-MM`) | "Định dạng tháng không hợp lệ" | `ib.service.ts:575,582` |
| `SEARCH_QUERY_TOO_SHORT` | 400 | Từ khóa tìm kiếm dưới độ dài tối thiểu (2 ký tự) | "Vui lòng nhập ít nhất 2 ký tự" | `ib.service.ts:520` |

### Admin Module Errors

| Code | HTTP | Mô tả | FE hiển thị | Nguồn |
|---|---|---|---|---|
| `ADMIN_NOT_FOUND` | 404 | Admin không tồn tại | "Không tìm thấy Admin" | `admin.service.ts:58,101` |

### Trash Module Errors

| Code | HTTP | Mô tả | FE hiển thị | Nguồn |
|---|---|---|---|---|
| `USER_NOT_FOUND` | 404 | Tài khoản không tồn tại | "Không tìm thấy tài khoản" | `trash.service.ts:35,76` |
| `USER_NOT_IN_TRASH` | 400 | Tài khoản không nằm trong thùng rác (đang active) | "Tài khoản này không ở trong thùng rác" | `trash.service.ts:42` |

### Rebate Errors

| Code | HTTP | Mô tả | FE hiển thị | Nguồn |
|---|---|---|---|---|
| `REBATE_EXCEEDS_MAX` | 422 | Rebate + markup vượt quá maxPips | "Tổng rebate vượt quá giới hạn cho phép ({maxPips} pips)" | `rebate.service.ts:183` |
| `REBATE_CONFIG_NOT_FOUND` | 404 | Chưa có cấu hình rebate cho IB này | "Chưa có cấu hình rebate" | `rebate.service.ts:284` |
| `REBATE_INVALID` | 422 | Giá trị rebate không hợp lệ (âm, sai định dạng...) | "Giá trị rebate không hợp lệ" | `rebate.service.ts:167` |
| `REBATE_TARGET_NOT_DIRECT_CHILD` | 403 | Chỉ được cấu hình rebate cho IB cấp dưới trực tiếp | "Chỉ có thể cấu hình rebate cho cấp dưới trực tiếp" | `rebate.service.ts:130` |
| `MARKUP_INVALID` | 422 | Giá trị markup không hợp lệ | "Giá trị markup không hợp lệ" | `rebate.service.ts:174` |
| `MARKUP_EXCEEDS_MAX` | 422 | Markup vượt quá giới hạn | "Markup vượt quá giới hạn cho phép" | `rebate.service.ts:189` |
| `CONFIG_NOT_FOUND` | 404 | Không tìm thấy cấu hình (context khác `REBATE_CONFIG_NOT_FOUND`, kiểm tra lại vị trí gọi) | "Không tìm thấy cấu hình" | `rebate.service.ts:366` |
| `NOT_A_MIB` | 400 | `mibId` truyền vào không phải MIB (level ≠ 0) — chỉ MIB được set trần tuỳ chỉnh | "Chỉ MIB (level 0) mới được set trần tuỳ chỉnh" | `rebate.service.ts:365` |
| `MAX_OVERRIDE_INVALID` | 422 | Trần tuỳ chỉnh (`maxPips`) không hợp lệ: `< 0` hoặc `> MAX_PIPS[assetType]` (trần công ty) | "Trần tuỳ chỉnh không hợp lệ (phải ≥ 0 và ≤ trần công ty)" | `rebate.service.ts:373,381` |
| `CASCADE_WOULD_VIOLATE_DESCENDANT` | 422 | Sửa config 1 node sẽ khiến node cấp dưới (descendant) có `rebatePips + markupPips > maxPips` sau cascade → **CHẶN CỨNG**, không cho lưu. Trả `details.violations[]` liệt kê từng node vi phạm (`ibId`, `newMaxPips`, `rebatePips`, `markupPips`) | "Thao tác sẽ khiến node cấp dưới vượt trần cho phép" (message chi tiết liệt kê tên IB + phần đang giữ + trần mới) | `rebate.service.ts` (dryRunCascadeSubtree + updateConfig + setMibMaxOverride) |

> ⚠️ **`REBATE_ASSET_INVALID` đã bị loại bỏ khỏi docs** — không có trong code.
> `assetType` sai được chặn bởi `@IsEnum(AssetType)` → trả `VALIDATION_ERROR` (422).

### Transaction Errors

| Code | HTTP | Mô tả | FE hiển thị | Nguồn |
|---|---|---|---|---|
| `TRANSACTION_NOT_FOUND` | 404 | Giao dịch không tồn tại | "Không tìm thấy giao dịch" | `transaction.service.ts:149,166` |
| `TRANSACTION_DELETE_FORBIDDEN` | 403 | Không có quyền xóa giao dịch này | "Bạn không có quyền xóa giao dịch này" | `transaction.service.ts:182` |

### Payout Errors

| Code | HTTP | Mô tả | FE hiển thị | Nguồn |
|---|---|---|---|---|
| `PAYOUT_BELOW_MINIMUM` | 400 | Số tiền rút dưới mức tối thiểu | "Số tiền rút dưới mức tối thiểu cho phép" | `payout.service.ts:23` |
| `PAYOUT_INSUFFICIENT_BALANCE` | 422 | Số dư ví không đủ | "Số dư không đủ để thực hiện rút tiền" | `payout.service.ts:28,100` |
| `PAYOUT_ALREADY_PENDING` | 422 | Đã có yêu cầu rút tiền đang chờ xử lý | "Bạn đang có yêu cầu rút tiền chờ xử lý" | `payout.service.ts:35` |
| `PAYOUT_NOT_FOUND` | 404 | Yêu cầu rút tiền không tồn tại | "Không tìm thấy yêu cầu rút tiền" | `payout.service.ts:93,142` |
| `PAYOUT_NOT_PENDING` | 422 | Yêu cầu đã được xử lý, không thể duyệt/từ chối lại | "Yêu cầu này đã được xử lý" | `payout.service.ts:95,144` |

### Notification Errors

| Code | HTTP | Mô tả | FE hiển thị | Nguồn |
|---|---|---|---|---|
| `NOTIFICATION_NOT_FOUND` | 404 | Thông báo không tồn tại | "Không tìm thấy thông báo" | `notification.service.ts:81,123` |
| `NOTIFICATION_NOT_YOURS` | 403 | Thông báo không thuộc về bạn | "Bạn không có quyền với thông báo này" | `notification.service.ts:84,126` |
| `RECIPIENT_NOT_IN_SUBTREE` | 403 | Người nhận không thuộc subtree của bạn | "Bạn không thể gửi thông báo cho tài khoản này" | `notification.service.ts:55` |

### Dashboard/Report Errors

| Code | HTTP | Mô tả | FE hiển thị | Nguồn |
|---|---|---|---|---|
| `INVALID_PERIOD` | 400 | Tham số `period` sai định dạng | "Định dạng kỳ báo cáo không hợp lệ" | `dashboard.service.ts:7` |

### Validation Errors

| Code | HTTP | Mô tả |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Request body không pass validation (từ `class-validator`, dùng chung cho toàn bộ project — bao gồm cả trường hợp `assetType` sai enum) |

Khi `VALIDATION_ERROR`, `details` sẽ có thêm:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ",
  "details": {
    "fields": [
      { "field": "email", "message": "Email không đúng định dạng" },
      { "field": "rebatePips", "message": "rebatePips phải là số dương" }
    ]
  }
}
```
Nguồn: `main.ts:53`.

### Fallback từ HttpExceptionFilter (khi service không throw code cụ thể)

| Code | Khi nào | Nguồn |
|---|---|---|
| `INTERNAL_ERROR` | Exception không phải `HttpException`, lỗi không xác định | `http-exception.filter.ts` |
| `DATABASE_ERROR` | Exception không phải HTTP (DB crash, connection lỗi...) | `http-exception.filter.ts` |
| `AUTH_FORBIDDEN` | 403 mà không có code explicit từ service | `http-exception.filter.ts` |
| `RESOURCE_NOT_FOUND` | 404 mà không có code explicit từ service | `http-exception.filter.ts` |
| `VALIDATION_ERROR` | 400/422 mà không có code explicit từ service | `http-exception.filter.ts` |
| `AUTH_TOKEN_INVALID` | 401 mà không có code explicit từ service | `http-exception.filter.ts` |

> Các code fallback này là "lưới an toàn" — FE vẫn nên map sẵn để tránh hiển thị message
> generic không rõ nghĩa khi BE bắn lỗi hệ thống không xác định trước.

---

## FE: Map error code ra message

```typescript
// src/lib/error-messages.ts

const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  AUTH_INVALID_CREDENTIALS:   "Email hoặc mật khẩu không đúng",
  AUTH_TOKEN_INVALID:         "Phiên đăng nhập không hợp lệ",
  AUTH_REFRESH_EXPIRED:       "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",

  // Role / Permission
  FORBIDDEN:                   "Bạn không có quyền thực hiện thao tác này",
  FORBIDDEN_LV0_ONLY:          "Bạn không có quyền thực hiện thao tác này",
  FORBIDDEN_ROLES_ONLY:        "Bạn không có quyền thực hiện thao tác này",
  ROOT_ADMIN_PROTECTED:        "Không thể thực hiện thao tác trên Root Admin",
  ADMIN_FINANCE_NOT_ALLOWED:   "Admin không thể thực hiện thao tác tài chính cho chính mình",
  AUTH_FORBIDDEN:               "Bạn không có quyền thực hiện thao tác này",

  // IB
  HAS_RELATIONS:               "Dữ liệu đang được sử dụng, không thể xóa",
  EMAIL_ALREADY_EXISTS:        "Email đã tồn tại",
  IB_NOT_FOUND:                "Không tìm thấy IB",
  IB_EMAIL_TAKEN:              "Email này đã được sử dụng",
  IB_NOT_IN_SUBTREE:           "Bạn không có quyền xem thông tin IB này",
  IB_MAX_LEVEL_REACHED:        "Không thể tạo thêm cấp dưới",
  IB_ACTION_NOT_ALLOWED:       "Không thể thực hiện thao tác này",
  INVALID_JSON:                "Dữ liệu không hợp lệ",
  INVALID_MONTH_FORMAT:        "Định dạng tháng không hợp lệ",
  SEARCH_QUERY_TOO_SHORT:      "Vui lòng nhập ít nhất 2 ký tự",

  // Admin
  ADMIN_NOT_FOUND:             "Không tìm thấy Admin",

  // Trash
  USER_NOT_FOUND:              "Không tìm thấy tài khoản",
  USER_NOT_IN_TRASH:           "Tài khoản này không ở trong thùng rác",

  // Rebate
  REBATE_EXCEEDS_MAX:          "Tổng rebate vượt quá giới hạn cho phép",
  REBATE_CONFIG_NOT_FOUND:     "Chưa có cấu hình rebate",
  REBATE_INVALID:              "Giá trị rebate không hợp lệ",
  REBATE_TARGET_NOT_DIRECT_CHILD: "Chỉ có thể cấu hình rebate cho cấp dưới trực tiếp",
  MARKUP_INVALID:               "Giá trị markup không hợp lệ",
  MARKUP_EXCEEDS_MAX:           "Markup vượt quá giới hạn cho phép",
  CONFIG_NOT_FOUND:             "Không tìm thấy cấu hình",
  NOT_A_MIB:                    "Chỉ MIB (level 0) mới được set trần tuỳ chỉnh",
  MAX_OVERRIDE_INVALID:         "Trần tuỳ chỉnh không hợp lệ (phải >= 0 và <= trần công ty)",

  // Transaction
  TRANSACTION_NOT_FOUND:        "Không tìm thấy giao dịch",
  TRANSACTION_DELETE_FORBIDDEN: "Bạn không có quyền xóa giao dịch này",

  // Payout
  PAYOUT_BELOW_MINIMUM:         "Số tiền rút dưới mức tối thiểu cho phép",
  PAYOUT_INSUFFICIENT_BALANCE:  "Số dư không đủ để thực hiện rút tiền",
  PAYOUT_ALREADY_PENDING:       "Bạn đang có yêu cầu rút tiền chờ xử lý",
  PAYOUT_NOT_FOUND:             "Không tìm thấy yêu cầu rút tiền",
  PAYOUT_NOT_PENDING:           "Yêu cầu này đã được xử lý",

  // Notification
  NOTIFICATION_NOT_FOUND:       "Không tìm thấy thông báo",
  NOTIFICATION_NOT_YOURS:       "Bạn không có quyền với thông báo này",
  RECIPIENT_NOT_IN_SUBTREE:     "Bạn không thể gửi thông báo cho tài khoản này",

  // Dashboard/Report
  INVALID_PERIOD:               "Định dạng kỳ báo cáo không hợp lệ",

  // Validation / Server
  VALIDATION_ERROR:             "Dữ liệu không hợp lệ, vui lòng kiểm tra lại",
  INTERNAL_ERROR:                "Đã có lỗi xảy ra, vui lòng thử lại",
  DATABASE_ERROR:                "Đã có lỗi xảy ra, vui lòng thử lại",
  RESOURCE_NOT_FOUND:            "Không tìm thấy dữ liệu",
};

export function getErrorMessage(code: string, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? "Đã có lỗi xảy ra";
}

// Dùng:
// try { ... }
// catch (err) {
//   const code = err.response?.data?.error?.code;
//   toast.error(getErrorMessage(code));
// }
```