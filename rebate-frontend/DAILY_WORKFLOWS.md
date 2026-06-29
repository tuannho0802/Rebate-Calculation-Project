# Nhật Ký Daily Workflows — FRONTEND

> Chỉ được thêm vào. Không được sửa hay xóa bất kỳ entry nào.
> Định dạng được quy định trong docs/10_DAILY_WORKFLOWS_GUIDE.md.
> Một entry cho mỗi phiên làm việc của agent. Thêm entry mới xuống cuối.

---

## [2026-06-18] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High)
- Yêu cầu từ: Khởi tạo shared types và error messages cho dự án frontend.

### Đã Triển Khai
- src/types/index.ts: Tạo file chứa toàn bộ Enums, Interfaces cho AuthUser, IbNode, RebateConfig, ReportSummary, API Envelope và các hằng số MAX_PIPS dựa trên 02_DATA_MODELS.md.
- src/lib/error-messages.ts: Tạo file ánh xạ mã lỗi thành thông báo tiếng Việt hiển thị UI dựa trên 06_ERROR_CODES.md.

### Đã Sửa Lỗi
- Không có trong phiên này

### Đã Cập Nhật
- Không có trong phiên này

### Ghi Chú
- Đã tạo các thư mục src/types và src/lib nếu chưa tồn tại.
- File types tuân thủ chính xác thiết kế schema gốc. Sẵn sàng cho việc map API từ Backend.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## [2026-06-18] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High)
- Yêu cầu từ: Viết Axios Client + Cơ chế Auto-Refresh Token gối đầu.

### Đã Triển Khai
- src/lib/api/client.ts: Khởi tạo Axios client với 2 interceptors. Request interceptor tự động lấy token từ localStorage đính kèm vào header. Response interceptor tự động bắt lỗi 401, dùng cờ isRefreshing và queue (failedQueue) để tạm dừng các request khác, gọi /auth/refresh lấy token mới, sau đó retry toàn bộ request bị kẹt. Nếu refresh fail, tự động xóa localStorage và redirect về /login.

### Đã Sửa Lỗi
- src/lib/api/client.ts: Thêm interface CustomAxiosRequestConfig kế thừa InternalAxiosRequestConfig để bổ sung thuộc tính _retry, tránh lỗi TypeScript không nhận diện được cờ _retry.

### Đã Cập Nhật
- Không có trong phiên này

### Ghi Chú
- Cơ chế Queue (failedQueue) rất quan trọng để tránh gọi API refresh token liên tục khi nhiều request lỗi 401 cùng lúc.
- Đã cấu hình process.env.NEXT_PUBLIC_API_URL làm BASE_URL.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## [2026-06-18] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High)
- Yêu cầu từ: Tạo Zustand Auth Store + React Query Providers để quản lý Global State và Cache Data.

### Đã Triển Khai
- src/store/auth.store.ts: Khởi tạo global state auth dùng Zustand. Đã định nghĩa chặt chẽ type AuthUser dựa trên src/types/index.ts. Có state isLoading để handle loading lúc refresh, hàm logout đã clear localStorage an toàn.
- src/components/Providers.tsx: Khởi tạo component bọc App Router ('use client') cung cấp QueryClientProvider từ @tanstack/react-query, config staleTime mặc định và chống refetchOnWindowFocus vô ích.

### Đã Sửa Lỗi
- Không có trong phiên này

### Đã Cập Nhật
- Không có trong phiên này

### Ghi Chú
- Next.js 14 App Router cần dùng component bọc 'use client' cho React Query Provider, việc này đã xử lý.
- Cần wrap component Providers này vào trong file layout.tsx gốc ở các lệnh tiếp theo.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## [2026-06-18] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High)
- Yêu cầu từ: Lệnh 4: Tạo Mock Data Khớp Khít 100% Schema

### Đã Triển Khai
- src/lib/api/mocks.ts: Đã tạo file chứa toàn bộ dữ liệu giả lập bao gồm:
  + MOCK_TREE: Dữ liệu cây IB phân tầng từ MIB xuống Lv1 -> Lv2 -> Lv3.
  + MOCK_REBATE_CONFIG: Dữ liệu test hoa hồng cho các AssetType (FOREX, GOLD, OIL) kèm ràng buộc maxPips.
  + MOCK_REPORT & MOCK_TRANSACTIONS: Data summary tổng thể về lợi nhuận hoa hồng và danh sách transaction mẫu hỗ trợ render giao diện.

### Đã Sửa Lỗi
- Không có trong phiên này

### Đã Cập Nhật
- Không có trong phiên này

### Ghi Chú
- Data mock tuân thủ gắt gao 100% Type từ src/types/index.ts để đảm bảo khi BE hoàn thiện, FE chỉ cần swap từ object Mock sang hàm call axios mà không bị vỡ giao diện hay lỗi field null.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## [2026-06-18] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High)
- Yêu cầu từ: Lệnh 5: Viết các hàm API layer trả về Mock Data trước

### Đã Triển Khai
- src/lib/api/auth.ts: Khởi tạo các hàm xử lý xác thực (login, refresh, logout) trả về AuthTokens giả lập, bọc chuẩn Promise.resolve().
- src/lib/api/ib.ts: Khởi tạo các hàm quản lý Node IB (getMe, getTree, getById, create) liên kết trực tiếp với MOCK_TREE.
- src/lib/api/rebate.ts: Khởi tạo các hàm quản lý hoa hồng (getConfig, updateConfig, calculate) trả về dữ liệu MOCK_REBATE_CONFIG.
- src/lib/api/report.ts: Khởi tạo hàm lấy báo cáo tổng quan (getSummary) và danh sách giao dịch (getTransactions) hỗ trợ phân trang meta, liên kết với MOCK_REPORT & MOCK_TRANSACTIONS.

### Đã Sửa Lỗi
- Không có trong phiên này

### Đã Cập Nhật
- Không có trong phiên này

### Ghi Chú
- Toàn bộ các API layer đang được bọc trong Promise.resolve() và trả về object bao bọc bởi Response Envelope { success: true, data: ... }. Việc này đảm bảo logic bắt dữ liệu ở UI sẽ không thay đổi bất cứ một chữ nào khi Backend hoàn thiện và thay bằng axios client.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## [2026-06-18] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High)
- Yêu cầu từ: Lệnh 6: Giao diện trang Login chỉn chu + Validation

### Đã Triển Khai
- src/app/(auth)/login/page.tsx: 
  + Code UI đăng nhập theo tông Dark Mode, kết hợp Radial Gradient và Glassmorphism (Backdrop-blur) tạo cảm giác cực kỳ B2B, sang và chuyên nghiệp.
  + Đã tích hợp Zod + React Hook Form validate chuẩn Form: Bắt buộc email đúng định dạng và password >= 6 ký tự.
  + Hàm onSubmit gọi authApi.login, lưu token vào localStorage, cập nhật user vào Zustand store và router.push('/dashboard') y như chuẩn đề ra.
  + Nếu đăng nhập lỗi, hệ thống tự động bóc mã lỗi và ánh xạ hiển thị ra tiếng Việt thông qua getErrorMessage từ src/lib/error-messages.ts.

### Đã Sửa Lỗi
- Không có trong phiên này

### Đã Cập Nhật
- Cài đặt thêm thư viện 'lucide-react' để render các icon chuyên nghiệp (Mail, Lock, ArrowRight, Spinner loading).

### Ghi Chú
- UI đang dùng CSS Variables cơ bản của TailwindCSS. Trang đăng nhập đã fully functional, chỉ chờ BE ráp vào là chạy tít mù.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## [2026-06-18] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High)
- Yêu cầu từ: Lệnh 7: Tạo Layout Dashboard chung + Auth Guard khóa cửa

### Đã Triển Khai
- src/app/(dashboard)/layout.tsx:
  + Dựng khung Layout cực nét với Sidebar cố định bên trái (Logo, Menu Bar, Thông tin user level/role) và Header Top Navbar (Title page, Avatar User, nút Logout).
  + Tone màu chuẩn nhận diện: Tông Xanh biển chủ đạo (#0066ff đến #0073e6) kết hợp dải màu xám sáng (#f8fafc) làm nền. Các điểm nhấn như Icon Menu, Avatar, Badges đều được đổ gradient sang xịn.
  + Responsive 100%: Tự động thu gọn Sidebar sang chế độ Drawer (Hamburger menu) khi xem trên điện thoại di động/tablet.
  + Tích hợp Auth Guard mạnh mẽ bằng useEffect: Check `ib_access_token` từ `localStorage`. Đẩy ra /login ngay nếu là kẻ lạ, ngược lại cho phép vào. Quá trình check token có màn hình Loading Spinner xoay mượt mà.

### Đã Sửa Lỗi
- Không có trong phiên này

### Đã Cập Nhật
- Không có trong phiên này

### Ghi Chú
- Khung layout này đã sẵn sàng chứa các Component con (Tổng quan, Mạng lưới IB, Báo cáo) qua prop `children`. Tính tương tác mượt mà do gắn các transition CSS cho nút bấm và hover effect.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## [2026-06-18] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High)
- Yêu cầu từ: Lệnh 8: Vẽ Cây Phân Cấp IB Đa Tầng Đệ Quy (Trang Tree)

### Đã Triển Khai
- src/components/ib-tree/TreeNode.tsx: 
  + Component lõi render theo cấu trúc đệ quy (recursive). 
  + Vẽ các đường line thụt lề chuẩn phân cấp cha-con bằng TailwindCSS.
  + Logic Collapse/Expand (thu gọn/mở rộng) khi click vào icon Chevron. Các node không có children sẽ tự động ẩn icon mở rộng.
- src/components/ib-tree/IbTreeView.tsx: 
  + Component View bọc ngoài gọi API lấy data thông qua react-query hook (useQuery).
  + Tích hợp trạng thái hiển thị Loading Spinner và màn hình báo lỗi khi gọi API xịt.
- src/app/(dashboard)/tree/page.tsx:
  + Dựng Layout trang chứa Title trang và nhúng component IbTreeView.
  + Khai báo next/metadata chuẩn.

### Đã Sửa Lỗi
- Không có trong phiên này

### Đã Cập Nhật
- src/app/(dashboard)/layout.tsx: Đổi đường dẫn menu "Mạng lưới IB" từ `/dashboard/network` về chuẩn `/dashboard/tree` để mapping đúng với trang vừa tạo.

### Ghi Chú
- Cây phân cấp hiện đang ăn thẳng dữ liệu từ MOCK_TREE qua `ibApi.getTree('all')`. Giao diện phân bổ cha con thụt lề bằng `border-l` và `border-b` rất rõ ràng.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## [2026-06-18] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High)
- Yêu cầu từ: Lệnh 9: Bảng Cấu Hình Hoa Hồng + Validate Max Pips (Trang Rebate Config)

### Đã Triển Khai
- src/components/rebate/RebateConfigTable.tsx: 
  + Vẽ bảng Cấu hình Hoa Hồng với các input field cho phép edit trực tiếp Rebate Pips, Markup Pips và Markup Percent.
  + Gắn cơ chế Validation bảo vệ túi tiền cực mạnh: `(rebatePips + markupPips) <= MAX_PIPS[AssetType]`. Nếu nhập sai, ô input lập tức đỏ lòm, hiện warning và Nút Lưu (Save) bị khóa vĩnh viễn cho đến khi sửa đúng.
  + Sử dụng `useMutation` từ React Query để gọi API PUT `/rebate/config/:ibId`. Xử lý các UX như nút Save xoay Loading khi pending và hiện biểu tượng Tick Xanh 3s khi lưu thành công.
- src/app/(dashboard)/rebate/page.tsx:
  + Dựng trang Layout chứa Component bảng cấu hình.
  
### Đã Sửa Lỗi
- Không có trong phiên này

### Đã Cập Nhật
- src/app/(dashboard)/layout.tsx: Cập nhật đường dẫn Menu "Cấu hình" sang chuẩn `/dashboard/rebate`.

### Ghi Chú
- Cơ chế Validate rất mượt do lấy limit trực tiếp từ Hằng số `MAX_PIPS` của hệ thống (trong file `src/types/index.ts`). Data load lên từ `MOCK_REBATE_CONFIG`.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## [2026-06-18] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High)
- Yêu cầu từ: Lệnh 10: Trang Báo Cáo Tổng Hợp & Lịch Sử Giao Dịch Phân Trang

### Đã Triển Khai
- src/app/(dashboard)/report/page.tsx: 
  + Code hoàn chỉnh trang Báo cáo Rebate sử dụng `@tanstack/react-query` để gọi API.
  + Giao diện chia 2 phần: (1) Phần trên hiển thị Card tổng hoa hồng (USD) và Breakdown thống kê theo từng loại tài sản (By Asset) đi kèm bộ lọc theo Tháng (YYYY-MM). (2) Phần dưới là Bảng Lịch sử giao dịch chi tiết.
  + Tích hợp mượt mà cụm nút chuyển trang (Next/Previous) dựa trên dữ liệu `meta` (page, limit, total) trả về chuẩn API Contract.
- src/app/(dashboard)/layout.tsx:
  + Cập nhật đường dẫn Menu "Báo cáo" trỏ chính xác về `/dashboard/report`.

### Đã Sửa Lỗi
- Dọn dẹp folder `src/app/(dashboard)/reports` sai quy tắc và quy chuẩn lại đúng path `/report`.

### Đã Cập Nhật
- Cấu hình state mặc định của bộ lọc Tháng tự động lấy thời gian hiện tại (`YYYY-MM`).

### Ghi Chú
- UI được đồng bộ với Tone Màu Nhận Diện từ Lệnh 7 (Nền trắng/xám sáng, điểm nhấn xanh Blue #0066ff), các biểu tượng từ `lucide-react` và hiệu ứng Tailwind.
- Không thay đổi bất kỳ cấu trúc dữ liệu nào trong TypeScript models, bám sát hoàn toàn thiết kế của Backend.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---
