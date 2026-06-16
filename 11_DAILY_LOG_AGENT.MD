# Prompt Agent — Ghi Nhật Ký Daily Workflows

Dùng prompt này vào CUỐI mỗi phiên làm việc của agent để ghi lại những gì đã làm.

---

## Prompt

```
Bạn là một kỹ sư senior đang kết thúc phiên làm việc trên dự án IB Rebate System.
Nhiệm vụ của bạn là thêm một entry log chính xác vào đúng file DAILY_WORKFLOWS.md.

BƯỚC 0 — ĐỌC HƯỚNG DẪN TRƯỚC
Đọc toàn bộ docs/10_DAILY_WORKFLOWS_GUIDE.md trước khi ghi bất cứ gì.
Không được bỏ qua bước này. Định dạng rất nghiêm ngặt.

BƯỚC 1 — XÁC ĐỊNH FILE CẦN CẬP NHẬT
- Nếu phiên này động đến code backend → thêm vào rebate-backend/DAILY_WORKFLOWS.md
- Nếu phiên này động đến code frontend → thêm vào rebate-frontend/DAILY_WORKFLOWS.md
- Nếu cả hai → thêm vào CẢ HAI file với entry riêng biệt

BƯỚC 2 — ĐỌC FILE HIỆN TẠI
Đọc toàn bộ nội dung của file DAILY_WORKFLOWS.md cần cập nhật.
Bạn cần thấy nội dung hiện có để thêm vào SAU entry cuối cùng.

BƯỚC 3 — VIẾT ENTRY
Tuân theo đúng định dạng trong docs/10_DAILY_WORKFLOWS_GUIDE.md.
Điền đầy đủ tất cả các mục: Phiên Làm Việc, Đã Triển Khai, Đã Sửa Lỗi, Đã Cập Nhật, Ghi Chú, Trạng Thái.
Dùng ngày hôm nay: [NHẬP NGÀY — ví dụ: 2026-06-16].
Ghi cụ thể tên file và module. Không viết entry mơ hồ như "sửa lỗi".

BƯỚC 4 — THÊM VÀO FILE
Thêm entry vào CUỐI file.
KHÔNG thay thế hay xóa bất kỳ nội dung nào đã có.
KHÔNG ghi lại file từ đầu.
Chỉ dùng thao tác append.

BƯỚC 5 — XÁC NHẬN
Sau khi thêm xong, đọc lại file và xác nhận:
- Entry mới của bạn xuất hiện ở cuối
- Tất cả entry cũ vẫn còn nguyên và không bị thay đổi
- Định dạng khớp đúng với hướng dẫn

Nếu xác nhận thất bại, không tự thử lại — báo cáo lỗi cho người dùng.

QUY TẮC QUAN TRỌNG:
- Không bao giờ dùng write/overwrite cho các file này — chỉ append
- Không bao giờ xóa hay sửa entry cũ
- Nếu một mục không có gì để báo cáo (ví dụ: không có lỗi nào sửa), viết "Không có trong phiên này"
- Checkbox Trạng Thái phải trung thực — dùng [!] nếu có gì thất bại hoặc chưa được test
```

---

## Cách Sử Dụng

1. Paste prompt này vào Antigravity (hoặc bất kỳ agent nào) sau khi kết thúc phiên code
2. Agent sẽ tự đọc hướng dẫn → đọc file log hiện tại → thêm entry mới → xác nhận
3. Bạn kiểm tra lại entry trong Artifacts panel trước khi chấp nhận

## Ghi Chú

Nếu bạn muốn agent ghi log giữa phiên (không chỉ cuối phiên), thêm dòng này vào prompt:

```
Đây là checkpoint giữa phiên. Đánh dấu các mục chưa hoàn thành là MỘT PHẦN trong trạng thái.
```