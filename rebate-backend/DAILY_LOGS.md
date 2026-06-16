# Nhật Ký Daily Workflows — BACKEND

> Chỉ được thêm vào. Không được sửa hay xóa bất kỳ entry nào.
> Định dạng được quy định trong docs/10_DAILY_WORKFLOWS_GUIDE.md.
> Một entry cho mỗi phiên làm việc của agent. Thêm entry mới xuống cuối.

---
## [2026-06-16] — Phần: BACKEND

### Phiên Làm Việc
- Agent: Khởi tạo ban đầu
- Yêu cầu từ: Thiết lập base project — NestJS + Prisma + PostgreSQL

### Đã Triển Khai
- prisma/schema.prisma: toàn bộ các model — IBNode, RebateConfig, RebateTransaction, RefreshToken
- prisma/migrations/: migration đầu tiên qua `prisma migrate dev --name first_setup`
- prisma/seed.ts: tài khoản MIB + Lv1/Lv2/Lv3, rebate configs, transactions trải đều 3 tháng
- src/main.ts: bootstrap NestJS, global prefix /api, CORS, global filters và interceptors
- src/common/guards/jwt.guard.ts: JWT guard bảo vệ route
- src/common/guards/subtree.guard.ts: kiểm tra quyền truy cập subtree đệ quy
- src/common/interceptors/response.interceptor.ts: envelope chuẩn { success, data, error, meta }
- src/common/filters/http-exception.filter.ts: map HttpException sang định dạng error code
- src/modules/auth/: đăng nhập, refresh token, đăng xuất, JWT strategy
- src/modules/ib/: thông tin cá nhân, tạo sub-IB, truy vấn cây
- src/modules/rebate/: quản lý config rebate, engine tính toán
- src/modules/report/: tổng hợp và danh sách giao dịch

### Đã Sửa Lỗi
- Không có (khởi tạo ban đầu)

### Đã Cập Nhật
- Không có (khởi tạo ban đầu)

### Ghi Chú
- DATABASE_URL trỏ đến PostgreSQL local qua DBngin trên port 5432
- Seed tạo tài khoản test: mib@test.com, lv1-a@test.com, lv2-a@test.com / mật khẩu Test@1234
- rebate_user cần quyền CREATEDB để Prisma tạo shadow database khi chạy migrate dev

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---