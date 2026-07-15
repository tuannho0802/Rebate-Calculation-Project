# Nhật Ký Agent — Hệ Thống Log Chỉ Được Thêm

## Mục Đích

Hai file theo dõi toàn bộ hoạt động hàng ngày của dự án, mỗi service một file:
- `rebate-backend/DAILY_LOGS.md`
- `rebate-frontend/DAILY_LOGS.md`

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

```
---
## [YYYY-MM-DD] — Phần: BACKEND hoặc FRONTEND

### Phiên Làm Việc
- Agent: [tên model]
- Yêu cầu từ: [mô tả ngắn gọn yêu cầu của người dùng]

### Đã Triển Khai
- [module/file]: [những gì đã thêm hoặc tạo mới]

### Đã Sửa Lỗi
- [module/file]: [mô tả lỗi] → [cách sửa]

### Đã Cập Nhật
- [module/file]: [thay đổi gì và tại sao]

### Ghi Chú
- [thông tin quan trọng cho agent tiếp theo cần biết]

### Trạng Thái
- [ ] Tất cả nội dung triển khai biên dịch không có lỗi
- [ ] Không có chức năng cũ nào bị hỏng
- [ ] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [ ] Các type vẫn khớp với 02_DATA_MODELS.md
---
```

## Ký Hiệu Trạng Thái

| Ký hiệu | Ý nghĩa |
|---------|---------|
| `[x]` | Đã xác nhận qua |
| `[ ]` | Chưa kiểm tra / bỏ qua |
| `[!]` | Thất bại hoặc có vấn đề đã biết |

---

## Danh Sách Kiểm Tra Trước Khi Agent Thêm Entry

1. Tôi có đang thêm vào cuối file, không phải thay thế nội dung không?
2. Entry của tôi có đủ tất cả các mục không?
3. Các checkbox Trạng Thái có chính xác và trung thực không?
4. Nếu tôi động đến cả BE và FE, tôi có viết entry riêng trong cả hai file không?
