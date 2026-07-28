# IB Rebate System — Project Overview

> Tài liệu tổng quan dự án. Đọc trước khi đọc bất kỳ tài liệu nào khác.

## Changelog
- **2026-07-28 (rà soát qua repo clone thật)**:
  - **Sửa** Tech Stack: Frontend thật là **Next.js 16.2.9** (`package.json`), không phải 14 như
    ghi trước đây.
  - **Sửa** bảng "Danh sách tài liệu": thiếu `08_LOCAL_MIGRATION_SEED.md`, `09_CODE_STANDARDS.md`,
    `10_DAILY_LOG_AGENT.md`, `12_PROJECT_STRUCTURE_ANALYSIS.md` — cả 4 file này đã tồn tại
    trong repo nhưng chưa từng được liệt kê ở đây.
  - **Làm rõ** mục "Phân quyền tổng quan": sơ đồ cũ mô tả quy tắc như nhau cho mọi cấp ("mỗi
    node chỉ thấy cấp dưới trực tiếp"), nhưng code thật (`subtree.util.ts`, `resolveScopedIbIds()`
    dùng trong `dashboard.service.ts`) có 1 **ngoại lệ**: **MIB (level 0) được xem đệ quy TOÀN
    BỘ nhánh của chính mình** ("View-All": mọi Lv2, Lv3, Lv4... cháu/chắt), khác hẳn IB thường
    (Lv1+) chỉ thấy đúng con trực tiếp ("Parent-Strict", không đệ quy xuống cháu). Đã bổ sung
    ghi chú này vào sơ đồ bên dưới.

---

## Mục tiêu dự án

Xây dựng web platform để tính toán và phân phối Rebate từ IB (Introducing Broker) theo cấu trúc cây phân cấp nhiều lớp (MIB → Lv1 → Lv2 → Lv3...).

---

## Danh sách tài liệu

| File | Nội dung | Đọc bởi |
|---|---|---|
| `00_PROJECT_OVERVIEW.md` | File này | Tất cả |
| `01_API_CONTRACT.md` | Toàn bộ API endpoints, request/response schema | FE + BE |
| `02_DATA_MODELS.md` | Database schema + TypeScript types dùng chung | FE + BE |
| `03_AUTH_FLOW.md` | Luồng xác thực, JWT, phân quyền theo level | FE + BE |
| `04_BACKEND_GUIDE.md` | Setup NestJS, Prisma, Neon, cấu trúc module, logic rebate/cascade | BE |
| `05_FRONTEND_GUIDE.md` | Setup NextJS, API client, state management | FE |
| `06_ERROR_CODES.md` | Bảng mã lỗi chuẩn dùng chung | FE + BE |
| `07_ENVIRONMENTS.md` | Biến môi trường, URL, deploy checklist | FE + BE |
| `08_LOCAL_MIGRATION_SEED.md` | Hướng dẫn chạy migration + seed data trên máy local | BE |
| `09_CODE_STANDARDS.md` | Quy ước đặt tên, style code, Technical Debt Backlog | FE + BE |
| `10_DAILY_LOG_AGENT.md` | Hướng dẫn AI agent ghi `DAILY_LOGS.md` mỗi phiên làm việc | Tất cả (agent) |
| `12_PROJECT_STRUCTURE_ANALYSIS.md` | Phân tích cấu trúc toàn dự án, rủi ro, dependency map | Tất cả |

---

## Tech Stack

```
Frontend  : Next.js 16 (App Router) + TypeScript + TailwindCSS + next-intl
Backend   : NestJS + TypeScript + Prisma ORM
Database  : PostgreSQL (Neon free tier)
Auth      : JWT (Access Token 15m + Refresh Token 7d)
Deploy FE : Vercel
Deploy BE : Vercel (Serverless adapter)
DB Host   : Neon (tích hợp thẳng Vercel)
```

---

## Quy tắc cộng tác (FE ↔ BE)

1. **API Contract (`01_API_CONTRACT.md`) là nguồn sự thật duy nhất.** Khi cần thêm/sửa API, cả hai bên phải đồng ý và cập nhật file này trước khi code.
2. **Types dùng chung** được định nghĩa trong `02_DATA_MODELS.md`. FE và BE đều phải dùng đúng tên field này — không tự đặt tên khác.
3. **Error response** luôn theo format chuẩn trong `06_ERROR_CODES.md`. BE không được trả về error format tự phát minh.
4. **Mọi thay đổi breaking** (đổi tên field, xóa endpoint, thay đổi response shape) phải thông báo và cập nhật Contract trước khi merge.
5. **FE dùng mock data** trong giai đoạn đầu, theo đúng schema trong `02_DATA_MODELS.md` — đảm bảo khi BE xong chỉ cần bỏ mock là chạy.

---

## Phân quyền tổng quan

```
MIB (Master IB)                      ← "View-All": xem ĐỆ QUY toàn bộ nhánh của chính mình
 └── Lv1 IB  ← thấy tất cả Lv2 của mình         ("Parent-Strict": chỉ con trực tiếp,
      └── Lv2 IB  ← thấy tất cả Lv3 của mình,      KHÔNG đệ quy xuống cháu/chắt)
           └── Lv3 IB  ← chỉ thấy Lv4 của mình
                └── ... (tối đa Lv5 + Sub5)
```

**Quy tắc visibility:**
- **MIB (level 0)** là ngoại lệ duy nhất: được xem **đệ quy toàn bộ nhánh** của chính mình (mọi
  Lv2, Lv3... cháu/chắt), không chỉ con trực tiếp — dùng cho các hành động XEM như Dashboard,
  lịch sử cấu hình rebate, hiệu suất IB... (xem `resolveScopedIbIds()` trong
  `dashboard.service.ts`, `getDescendantIds()`/`isDescendantOf()` trong `subtree.util.ts`).
- **Lv1 trở xuống**: mỗi node chỉ thấy đúng **con trực tiếp** của mình ("Parent-Strict"), không
  đệ quy xuống cháu/chắt, không thấy ngang cấp (sibling), không thấy ngược lên parent.
- Với hành động **SỬA** (không phải xem) — ví dụ `PUT /rebate/config/:ibId` — quy tắc luôn là
  **chỉ được sửa con trực tiếp**, kể cả với MIB (View-All chỉ áp dụng cho đường XEM).

---

## Glossary

| Thuật ngữ | Ý nghĩa |
|---|---|
| MIB | Master IB — cấp cao nhất, được Broker cấp rebate gốc |
| IB | Introducing Broker |
| Rebate | Hoa hồng tính theo pip/USD per lot giao dịch |
| Markup | Phần spread thêm vào — có thể chia một phần xuống cấp dưới |
| Pip | Đơn vị tính rebate cho Forex/Commodities |
| Node | Một IB trong cây phân cấp |
| Subtree | Toàn bộ IB cấp dưới của một node |