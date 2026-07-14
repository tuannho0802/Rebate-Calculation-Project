// src/lib/error-messages.ts

export const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  AUTH_INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng",
  AUTH_TOKEN_INVALID:        "Phiên đăng nhập không hợp lệ",
  AUTH_REFRESH_EXPIRED:      "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
  AUTH_FORBIDDEN:            "Bạn không có quyền thực hiện thao tác này",

  // IB & Admin
  IB_INACTIVE:               "Tài khoản IB đã bị vô hiệu hóa",
  ROOT_ADMIN_PROTECTED:      "Không thể thực hiện thao tác trên Root Admin",
  HAS_RELATIONS:             "Dữ liệu đang được sử dụng, không thể xóa",
  EMAIL_ALREADY_EXISTS:      "Email đã tồn tại",
  IB_NOT_FOUND:              "Không tìm thấy IB",
  IB_EMAIL_TAKEN:            "Email này đã được sử dụng",
  IB_NOT_IN_SUBTREE:         "Bạn không có quyền xem thông tin IB này",
  IB_MAX_LEVEL_REACHED:      "Không thể tạo thêm cấp dưới",

  // Rebate
  REBATE_EXCEEDS_MAX:        "Tổng rebate vượt quá giới hạn cho phép",
  REBATE_CONFIG_NOT_FOUND:   "Chưa có cấu hình rebate",
  REBATE_ASSET_INVALID:      "Loại tài sản không hợp lệ",

  // General
  VALIDATION_ERROR:          "Dữ liệu không hợp lệ, vui lòng kiểm tra lại",
  INTERNAL_ERROR:            "Đã có lỗi xảy ra, vui lòng thử lại",
  DATABASE_ERROR:            "Đã có lỗi xảy ra, vui lòng thử lại",
};

export function getErrorMessage(code: string, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? "Đã có lỗi xảy ra";
}
