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

## [2026-07-06] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Gemini 3.1 Pro (High) & Hoài Nguyên
- Yêu cầu từ: Xây dựng toàn bộ giao diện quản trị hoa hồng, tích hợp hệ thống phân chia đa tầng động cho MIB Cấp 0 và các Sub-IB, sửa lỗi lặp tuần hoàn (Infinite Loop) của cơ chế Interceptor bảo mật.

### Đã Triển Khai
- src/components/rebate/AccountTypeBuilder.tsx: Khởi tạo module cấu hình "Gói phí & Tùy chọn nâng spread (Markup/Added Points)" động dành riêng cho MIB Level 0 để định nghĩa luật chơi thay vì hardcode.
- src/app/[locale]/(dashboard)/dashboard/tree/edit/[id]/page.tsx: Xây dựng hoàn chỉnh trang điều chỉnh hạn mức Rebate/Markup chi tiết của từng đối tác Sub-IB con, bóc tách giao diện dạng danh mục điều kiện chuyên nghiệp.
- src/components/ib-tree/CreateIbModal.tsx: Hoàn thiện Form Modal tạo tài khoản Sub-IB đại lý cấp dưới, tích hợp dropdown chọn phân loại tài khoản chuẩn và validate trường thông tin.
- src/components/rebate/RebateCalculateWidget.tsx: Viết widget hỗ trợ tính toán giả lập dòng tiền Rebate thực tế ngay trên Dashboard.

### Đã Sửa Lỗi
- src/lib/api/client.ts: Khắc phục triệt để lỗi chí mạng gây nghẽn và sập Server (Infinite Loop 401) bằng cách gài thêm chốt chặn kiểm tra: Nếu chính API endpoint '/auth/refresh' bị lỗi 401 thì lập tức xóa bộ nhớ đệm và đẩy ngược người dùng ra trang login, phá vỡ vòng lặp đệ quy.

### Đã Cập Nhật
- src/components/rebate/RebateConfigTable.tsx: Đồng bộ hóa toàn bộ logic Validate Max Pips gối đầu. Sửa đổi thuật toán: Tuyến dưới khi đăng nhập bắt buộc phải tuân theo giới hạn 'row.maxPips' thực tế do cấp trên áp xuống quét từ API, thay vì ưu tiên hằng số MAX_PIPS gán cứng toàn cục của Sàn.
- src/app/[locale]/(dashboard)/dashboard/rebate/page.tsx: Cập nhật layout phân phối mảng bảng biểu cấu hình hoa hồng tổng thể.

### Ghi Chú
- Logic gán dữ liệu hoa hồng của trang Edit Sub-IB cần backend đồng bộ chuẩn mảng phẳng gối đầu (Array DTO) khi nhận payload từ lệnh PUT để khớp hoàn toàn cấu trúc dữ liệu mới.
- Toàn bộ trạng thái templates tạm thời được đồng bộ sang cơ chế tính toán động tương ứng trước khi đẩy payload, sẵn sàng kết nối thật.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---

## [2026-07-09] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: GitHub Copilot
- Yêu cầu từ: Sửa logic trang edit Sub-IB, lấy đúng Markup Max từ cấu hình Link Markup và sửa lỗi runtime `use(params)`.

### Đã Triển Khai
- src/app/[locale]/(dashboard)/dashboard/tree/edit/[id]/page.tsx: sửa `const { id } = use(params)` thành `const { id } = params`.
- src/app/[locale]/(dashboard)/dashboard/tree/edit/[id]/page.tsx: chuyển `Rebate Max` về lấy trực tiếp `row.maxCeiling` từ bảng sản phẩm.
- src/app/[locale]/(dashboard)/dashboard/tree/edit/[id]/page.tsx: sửa `getMarkupMax()` để đọc giá trị `share` từ `localStorage` trong `markupLinkTemplates` theo account type đã chọn, khớp tên link không phân biệt hoa thường và dùng fallback nếu cần.
- src/app/[locale]/(dashboard)/dashboard/tree/edit/[id]/page.tsx: dọn biến không dùng và loại bỏ logic fetch cấu hình rebate không cần thiết.

### Đã Sửa Lỗi
- Sửa lỗi runtime ReferenceError `use is not defined` trên trang edit Sub-IB.
- Sửa lỗi Markup Max hiển thị 0 do không lấy đúng giá trị hoa hồng từ cấu hình Link Markup.

### Đã Cập Nhật
- Cập nhật logic hiển thị và validation `Rebate Max` / `Markup Max` trong trang edit để tách biệt rõ hai nguồn dữ liệu.

### Ghi Chú
- Dữ liệu account type của Sub-IB được đọc từ `localStorage.ibAccountTypes` nếu `subIbAccountType` chưa được tải đúng.
- Nếu không tìm thấy link Markup chính xác, hệ thống fallback sang link đầu tiên để tránh hiển thị 0.

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md


## [2026-07-09] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: GitHub Copilot
- Yêu cầu từ: Sửa backend validate Rebate/Markup riêng biệt theo logic frontend và cập nhật nhật ký.

### Đã Triển Khai
- rebate-backend/src/modules/rebate/rebate.service.ts: Tách backend validation thành kiểm tra riêng cho `rebatePips` và `markupPips`; không còn dùng tổng `rebatePips + markupPips` làm điều kiện chính.
- rebate-backend/src/modules/rebate/dto/update-config.dto.ts: Đã làm `rebateType` thành trường tùy chọn và mặc định về `STP_REBATE` để tránh bị reject khi frontend không gửi giá trị này.
- rebate-frontend/src/app/[locale]/(dashboard)/dashboard/tree/edit/[id]/page.tsx: Thêm `rebateType: 'STP_REBATE'` vào payload PUT khi gọi `rebateApi.updateConfig`.
- rebate-backend: Đã build lại backend để xác thực thay đổi không gây lỗi compile.

### Đã Sửa Lỗi
- rebate-backend/src/modules/rebate/rebate.service.ts: Sửa lỗi validation sai logic tổng budget.
- rebate-backend/src/modules/rebate/dto/update-config.dto.ts: Sửa lỗi 422 do thiếu trường `re­bateType` trong payload.

### Đã Cập Nhật
- rebate-frontend/DAILY_LOGS.md: Ghi nhận chi tiết backend đã sửa và phản hồi 422.

### Ghi Chú
- Backend hiện kiểm tra đúng từng phần rebate và markup theo yêu cầu frontend, đồng thời frontend gửi đủ trường `rebateType` để tránh validation 422.
- Mọi thay đổi backend trong phiên này được ghi thêm vào log, không xóa hay ghi đè nội dung cũ.

### Trạng Thái
- [x] Sửa backend validation đúng theo yêu cầu
- [x] Đã thêm nhật ký cho phiên làm việc hôm nay
---
## [2026-07-13] - Frontend UI/UX Improvements & Security

### Phi�n L�m Vi?c
- Agent: Antigravity
- Y�u c?u t?: C?i thi?n UX ch?n Asset Type, b?o m?t hi?n th? ID giao d?ch, di?u ch?nh lu?ng redirect trang ch?

### �� Tri?n Khai
- src/components/rebate/AccountTypeBuilder.tsx: �?i tru?ng nh?p li?u Asset Type / Symbol t? � text t? do (input) sang danh s�ch ch?n th? xu?ng (select dropdown) ch?a danh m?c chu?n (D_FOREX, FOREX, GOLD, SILVER_5000, SILVER_1000, OIL, NATURE_GAS, COMMODITIES, HKG50, A50, JPN225, US_INDEX, SHARES, ETHEREUM, PRECIOUS_METAL, BITCOIN, CRYPTO, GAUCNH) nh?m tr�nh l?i g� sai t�n s?n ph?m c?a MIB.
- src/app/[locale]/(dashboard)/dashboard/report/page.tsx: C?p nh?t logic ?n gi?u (obfuscate) M� giao d?ch v� M� IB. Ch? hi?n th? 8 k� t? cu?i c�ng c?a chu?i UUID (v� d?: #8237936e) d? tang cu?ng t�nh b?o m?t d? li?u.
- src/app/[locale]/(dashboard)/dashboard/transaction/page.tsx: �p d?ng chung logic ?n gi?u (obfuscate) 8 k� t? cu?i cho c�c ID hi?n th? trong b?ng giao d?ch.
- src/app/[locale]/page.tsx: Thay d?i lu?ng di?u hu?ng (routing) m?c d?nh ? trang ch? (/). Lo?i b? bu?c ki?m tra token trong localStorage, thay v�o d� lu�n lu�n di?u hu?ng (redirect) ngu?i d�ng v? trang �ang nh?p (/login) tru?c, thay v� cho ph�p v�o th?ng trang Dashboard c?a MIB.

### Ghi Ch�
- �� push code l�n kho ch?a github project_Rebate s?n s�ng cho vi?c deploy l�n Vercel.

### Tr?ng Th�i
- [x] Code bi�n d?ch th�nh c�ng, giao di?n ho?t d?ng ?n d?nh
- [x] Kh�ng l�m h?ng ch?c nang cu


---
## [2026-07-14] — Phần: FRONTEND

### Phiên Làm Việc
- Agent: Antigravity
- Yêu cầu từ: Đồng bộ Frontend với Backend mới nhất (Role Admin, Thùng rác, API Contract, Rebate Type)

### Đã Triển Khai
- src/lib/api/admin.ts: Giao tiếp API cho quản trị Admin.
- src/lib/api/trash.ts: Giao tiếp API cho quản lý Thùng rác.
- src/app/[locale]/(dashboard)/dashboard/admin/page.tsx: Trang quản trị Admin.
- src/app/[locale]/(dashboard)/dashboard/trash/page.tsx: Trang Thùng rác.

### Đã Sửa Lỗi
- src/lib/error-messages.ts: Thêm các mã lỗi mới (ROOT_ADMIN_PROTECTED, HAS_RELATIONS, IB_INACTIVE, EMAIL_ALREADY_EXISTS) để bắt exception từ backend.

### Đã Cập Nhật
- src/types/index.ts: Mở rộng type AuthUser, IbNode để chứa role và isRootAdmin. Thêm enum RebateType và dùng trong RebateAssetConfig.
- src/store/auth.store.ts: Lưu trữ role.
- src/app/[locale]/(dashboard)/layout.tsx: Phân quyền menu Sidebar hiển thị Admin/Thùng rác chỉ cho Admin, cộng thêm Route Guard chuyển hướng Admin routes.
- src/components/ib-tree/IbManagementTable.tsx: Chuyển tính năng restore sang trashApi.
- src/app/[locale]/(dashboard)/dashboard/payout/page.tsx: Chuyển điều kiện isAdmin thành role === 'ADMIN'.
- src/components/rebate/RebateConfigTable.tsx: Đổi limit thành role === 'ADMIN', xử lý null ibId, thêm dropdown chọn rebateType.
- src/components/ib-tree/IbTreeView.tsx & TreeNode.tsx: MIB/IB sử dụng lazy load con thông qua getChildren thay vì lấy full depth='all', trong khi Admin giữ depth='all'.

### Ghi Chú
- Đã test xác nhận BE trả về rebateType chuẩn xác (STP_REBATE, CENT_REBATE, COMMISSION_PERCENT...).
- Đã sửa role logic xuyên suốt app để không còn phụ thuộc level === 0 = Admin nữa, mà sử dụng trường role (IB/ADMIN).

### Trạng Thái
- [x] Tất cả nội dung triển khai biên dịch không có lỗi
- [x] Không có chức năng cũ nào bị hỏng
- [x] Hợp đồng API trong 01_API_CONTRACT.md không bị vi phạm
- [x] Các type vẫn khớp với 02_DATA_MODELS.md
---
