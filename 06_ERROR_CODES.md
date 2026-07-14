# Error Codes Reference

> Danh sách toàn bộ mã lỗi trả về từ API.
> Frontend dựa vào mã code này để map ra câu thông báo tiếng Việt tương ứng.

## Changelog
- **2026-07-14**:
  - Thêm lỗi bảo vệ Root Admin (`ROOT_ADMIN_PROTECTED`).
  - Thêm lỗi ràng buộc khi xóa cứng (`HAS_RELATIONS`).
  - Thêm lỗi trùng email (`EMAIL_ALREADY_EXISTS`).

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

| Code | HTTP | Mô tả | FE hiển thị |
|---|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | Sai email hoặc password | "Email hoặc mật khẩu không đúng" |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token hết hạn | *(FE tự refresh, không cần show)* |
| `AUTH_TOKEN_INVALID` | 401 | Token sai format / bị giả mạo | "Phiên đăng nhập không hợp lệ" |
| `AUTH_REFRESH_EXPIRED` | 401 | Refresh token hết hạn | "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại" |
| `AUTH_FORBIDDEN` | 403 | Không có quyền truy cập resource | "Bạn không có quyền thực hiện thao tác này" |

### IB Errors

| Code | HTTP | Mô tả | FE hiển thị |
|---|---|---|---|
| `IB_INACTIVE` | 403 | Tài khoản IB đã bị vô hiệu hóa, không thể đăng nhập | "Tài khoản IB đã bị vô hiệu hóa" |
| `ROOT_ADMIN_PROTECTED` | 403 | Không thể xóa, vô hiệu hóa, hoặc sửa Root Admin | "Không thể thực hiện thao tác trên Root Admin" |
| `HAS_RELATIONS` | 400 | Không thể xóa vĩnh viễn do dữ liệu còn liên kết ở bảng khác (ví, giao dịch...) | "Dữ liệu đang được sử dụng, không thể xóa" |
| `EMAIL_ALREADY_EXISTS` | 409 | Email đã tồn tại trong hệ thống | "Email đã tồn tại" |
| `IB_NOT_FOUND` | 404 | IB không tồn tại | "Không tìm thấy IB" |
| `IB_EMAIL_TAKEN` | 422 | Email đã được dùng | "Email này đã được sử dụng" |
| `IB_NOT_IN_SUBTREE` | 403 | IB không thuộc subtree của bạn | "Bạn không có quyền xem thông tin IB này" |
| `IB_MAX_LEVEL_REACHED` | 422 | Đã đạt cấp tối đa (Lv5/Sub5) | "Không thể tạo thêm cấp dưới" |

### Rebate Errors

| Code | HTTP | Mô tả | FE hiển thị |
|---|---|---|---|
| `REBATE_EXCEEDS_MAX` | 422 | Rebate + markup vượt quá maxPips | "Tổng rebate vượt quá giới hạn cho phép ({maxPips} pips)" |
| `REBATE_CONFIG_NOT_FOUND` | 404 | Chưa có cấu hình rebate cho IB này | "Chưa có cấu hình rebate" |
| `REBATE_ASSET_INVALID` | 400 | Asset type không hợp lệ | "Loại tài sản không hợp lệ" |

### Validation Errors

| Code | HTTP | Mô tả |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Request body không pass validation |

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

### Server Errors

| Code | HTTP | Mô tả | FE hiển thị |
|---|---|---|---|
| `INTERNAL_ERROR` | 500 | Lỗi server không xác định | "Đã có lỗi xảy ra, vui lòng thử lại" |
| `DATABASE_ERROR` | 500 | Lỗi database | "Đã có lỗi xảy ra, vui lòng thử lại" |

---

## FE: Map error code ra message

```typescript
// src/lib/error-messages.ts

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng",
  AUTH_TOKEN_INVALID:        "Phiên đăng nhập không hợp lệ",
  AUTH_REFRESH_EXPIRED:      "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
  AUTH_FORBIDDEN:            "Bạn không có quyền thực hiện thao tác này",

  IB_NOT_FOUND:              "Không tìm thấy IB",
  IB_EMAIL_TAKEN:            "Email này đã được sử dụng",
  IB_NOT_IN_SUBTREE:         "Bạn không có quyền xem thông tin IB này",
  IB_MAX_LEVEL_REACHED:      "Không thể tạo thêm cấp dưới",

  REBATE_EXCEEDS_MAX:        "Tổng rebate vượt quá giới hạn cho phép",
  REBATE_CONFIG_NOT_FOUND:   "Chưa có cấu hình rebate",
  REBATE_ASSET_INVALID:      "Loại tài sản không hợp lệ",

  VALIDATION_ERROR:          "Dữ liệu không hợp lệ, vui lòng kiểm tra lại",
  INTERNAL_ERROR:            "Đã có lỗi xảy ra, vui lòng thử lại",
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
