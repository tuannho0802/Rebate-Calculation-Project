# Nhật Ký Daily Workflows — FRONTEND

> Chỉ được thêm vào. Không được sửa hay xóa bất kỳ entry nào.
> Định dạng được quy định trong docs/10_DAILY_WORKFLOWS_GUIDE.md.
> Một entry cho mỗi phiên làm việc của agent. Thêm entry mới xuống cuối.

---
## [2026-06-16] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Khởi tạo ban đầu
- Yêu cầu từ: Thiết lập base project — Next.js 14 + Zustand + Axios

### Đã Triển Khai
- src/types/index.ts: interface IBNode, RebateConfig, RebateTransaction, enum AssetType, bảng MAX_PIPS, kiểu ApiEnvelope
- src/lib/api/client.ts: Axios instance với JWT injection, hàng đợi auto-refresh khi 401, redirect khi refresh thất bại
- src/lib/api/auth.ts: login(), refresh(), logout()
- src/lib/api/ib.ts: getMe(), getTree(), getIB(), createSubIB()
- src/lib/api/rebate.ts: getConfig(), updateConfig(), calculate()
- src/lib/api/report.ts: getSummary(), getTransactions()
- src/lib/error-messages.ts: mapErrorCode() — chuyển error code từ BE sang thông báo tiếng Việt cho UI
- src/store/auth.store.ts: Zustand store — accessToken, refreshToken, user, setTokens(), clearAuth()
- src/app/(auth)/login/page.tsx: form đăng nhập, chuyển hướng đến /dashboard khi thành công
- src/app/(dashboard)/layout.tsx: sidebar điều hướng, kiểm tra xác thực
- src/app/(dashboard)/page.tsx: trang dashboard chính
- src/app/(dashboard)/tree/page.tsx: trang xem cây IB
- src/app/(dashboard)/report/page.tsx: tổng hợp rebate và danh sách giao dịch

### Đã Sửa Lỗi
- Không có (khởi tạo ban đầu)

### Đã Cập Nhật
- Không có (khởi tạo ban đầu)

### Ghi Chú
- NEXT_PUBLIC_API_URL phải được đặt trong .env.local trỏ đến http://localhost:3001
- Auth store chưa persist sang localStorage — refresh trang cần đăng nhập lại (việc tương lai)
- Layout mobile chưa được triển khai trong base setup này

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---