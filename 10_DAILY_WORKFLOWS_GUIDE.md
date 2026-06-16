# Hướng Dẫn Daily Workflows — Hệ Thống Log Chỉ Được Thêm

## Mục Đích

Hai file theo dõi toàn bộ hoạt động hàng ngày của dự án, mỗi service một file:
- `rebate-backend/DAILY_WORKFLOWS.md`
- `rebate-frontend/DAILY_WORKFLOWS.md`

Đây là lịch sử sống của dự án. Các file này **chỉ được thêm vào** — không được xóa hay chỉnh sửa bất kỳ dòng nào sau khi đã ghi. Agent phải thêm entry mới ở **cuối file** mà thôi.

---

## Quy Tắc (Bắt Buộc Với Mọi Agent)

| Quy tắc | Chi tiết |
|---------|----------|
| **Chỉ được thêm** | Không bao giờ xóa, sửa, hay đảo thứ tự entry cũ |
| **Một session = một entry** | Mỗi phiên làm việc của agent tạo đúng một entry có ngày |
| **Cả hai file** | Nếu công việc động đến cả BE và FE, thêm vào cả hai file riêng biệt |
| **Trạng thái trung thực** | Dùng XONG / MỘT PHẦN / THẤT BẠI — không đánh dấu XONG nếu test còn lỗi |
| **Không entry trống** | Nếu không có gì thay đổi, không thêm entry |

---

## Định Dạng Entry

Mọi entry phải theo đúng định dạng này. Không được thay đổi.

```
---
## [YYYY-MM-DD] — Phần: BACKEND hoặc FRONTEND

### Phiên Làm Việc
- Agent: [tên model, ví dụ: Gemini 3.1 Pro]
- Yêu cầu từ: [mô tả ngắn gọn yêu cầu của người dùng]

### Đã Triển Khai
- [module/file]: [những gì đã thêm hoặc tạo mới]
- [module/file]: [những gì đã thêm hoặc tạo mới]

### Đã Sửa Lỗi
- [module/file]: [mô tả lỗi] → [cách sửa]

### Đã Cập Nhật
- [module/file]: [thay đổi gì và tại sao]

### Ghi Chú
- [thông tin quan trọng cho agent tiếp theo cần biết]
- [giới hạn đã biết, edge case, TODO còn để lại có chủ ý]

### Trạng Thái
- [ ] Tất cả nội dung triển khai biên dịch không có lỗi
- [ ] Không có chức năng cũ nào bị hỏng
- [ ] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [ ] Các type vẫn khớp với 02_DATA_MODELS.md
---
```

---

## Ký Hiệu Trạng Thái

Dùng đúng các ký hiệu này trong checkbox Trạng Thái:

| Ký hiệu | Ý nghĩa |
|---------|---------|
| `[x]` | Đã xác nhận qua |
| `[ ]` | Chưa kiểm tra / bỏ qua |
| `[!]` | Thất bại hoặc có vấn đề đã biết |

---

## Ví Dụ Entry — Backend

```
---
## [2026-06-16] — Phần: BACKEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro
- Yêu cầu từ: Triển khai subtree guard với recursive CTE

### Đã Triển Khai
- src/common/guards/subtree.guard.ts: dùng WITH RECURSIVE CTE để kiểm tra toàn bộ chuỗi tổ tiên, không chỉ parent trực tiếp
- src/modules/ib/ib.controller.ts: áp dụng SubtreeGuard cho GET /ib/:id và PATCH /ib/:id

### Đã Sửa Lỗi
- src/modules/auth/auth.service.ts: refresh token chưa được hash trước khi lưu → đã dùng bcrypt.hash()

### Đã Cập Nhật
- prisma/schema.prisma: thêm index trên ib_nodes.parent_id để tăng hiệu năng truy vấn đệ quy

### Ghi Chú
- SubtreeGuard hiện chỉ kiểm tra quyền đọc; guard cho quyền ghi là TODO riêng
- Seed data đã có transactions trải đều 3 tháng theo yêu cầu của 08_LOCAL_MIGRATION_SEED.md

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---
```

---

## Ví Dụ Entry — Frontend

```
---
## [2026-06-16] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro
- Yêu cầu từ: Xây dựng trang xem cây IB

### Đã Triển Khai
- src/app/(dashboard)/tree/page.tsx: component cây đệ quy, hiển thị tối đa 5 cấp
- src/lib/api/ib.ts: hàm getTree() gọi GET /api/ib/tree

### Đã Sửa Lỗi
- src/lib/api/client.ts: refresh queue không drain đúng khi có nhiều 401 đồng thời → sửa bằng isRefreshing flag pattern

### Đã Cập Nhật
- src/store/auth.store.ts: thêm clearAuth() để xử lý logout và redirect trong một action

### Ghi Chú
- Giao diện cây hiện chỉ xem, chưa chỉnh sửa rebate config từ tree view
- Layout mobile cho trang tree chưa được triển khai

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---
```

---

## Template Khởi Tạo File

Khi tạo DAILY_WORKFLOWS.md lần đầu tiên trong mỗi folder, dùng header này:

```
# Nhật Ký Daily Workflows — [BACKEND hoặc FRONTEND]

> Chỉ được thêm vào. Không được sửa hay xóa bất kỳ entry nào.
> Định dạng được quy định trong docs/10_DAILY_WORKFLOWS_GUIDE.md.
> Một entry cho mỗi phiên làm việc của agent. Thêm entry mới xuống cuối.

---
```

Sau đó thêm entry ngày đầu tiên bên dưới.

---

## Danh Sách Kiểm Tra Trước Khi Agent Thêm Entry

Trước khi ghi vào DAILY_WORKFLOWS.md, agent phải trả lời có với tất cả:

1. Tôi đã đọc `docs/10_DAILY_WORKFLOWS_GUIDE.md` trước khi ghi chưa?
2. Tôi có đang thêm vào cuối file, không phải thay thế nội dung không?
3. Entry của tôi có đủ tất cả các mục: Phiên Làm Việc, Đã Triển Khai, Đã Sửa Lỗi, Đã Cập Nhật, Ghi Chú, Trạng Thái không?
4. Các checkbox Trạng Thái có chính xác và trung thực không?
5. Nếu tôi động đến cả BE và FE, tôi có viết entry riêng trong cả hai file không?

Nếu bất kỳ câu nào là không — dừng lại, sửa, rồi mới thêm.