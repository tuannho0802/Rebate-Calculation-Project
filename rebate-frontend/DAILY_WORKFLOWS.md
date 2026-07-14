---
## [2026-07-14] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Composer
- Yêu cầu từ: Đổi tên Bulk Operation → Rebate Management; dùng bulk API thay vòng lặp PUT;
  role-based nav (ADMIN vs IB)

### Đã Triển Khai
- `src/lib/api/rebate.ts`: thêm `bulkUpdateConfig()` gọi `PUT /rebate/config/bulk`
- `src/types/index.ts`: thêm `BulkUpdateResult`, `BulkUpdateResponse`
- `src/lib/nav-config.ts`: config nav tập trung + `filterNavItemsByRole`, `isAdminOnlyRoute`
- `src/app/[locale]/(dashboard)/dashboard/rebate-management/page.tsx`: đổi tên component
  `RebateManagementPage`, gọi bulk API 1 lần, bỏ validate chặn submit `rebatePips > maxPips`
- `messages/vi.json`, `messages/en.json`: keys `Layout.*` nav mới + namespace `RebateManagement`

### Đã Sửa Lỗi
- `rebate-management/page.tsx`: logic bulk N-request `Promise.allSettled` + validate FE trùng BE
  → thay bằng 1 lệnh `bulkUpdateConfig`, lỗi `REBATE_EXCEEDS_MAX` từ BE

### Đã Cập Nhật
- `src/app/[locale]/(dashboard)/layout.tsx`: dùng `nav-config.ts`, route-guard ADMIN-only +
  toast `AUTH_FORBIDDEN` khi IB gõ thẳng URL admin

### Ghi Chú
- `isExceeding` vẫn tô đỏ ô input (cảnh báo UX), không chặn submit
- Trang Rebate Management vẫn load N× `GET /rebate/config/:ibId` — chỉ phần save chuyển sang bulk
- Menu Admin/Trash/Rebate Management ẩn với IB qua `roles: ['ADMIN']` trong nav-config

### Trạng Thái
- [ ] Tất cả nội dung triển khai biên dịch không có lỗi
- [ ] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [ ] Các type vẫn khớp với 02_DATA_MODELS.md
---
