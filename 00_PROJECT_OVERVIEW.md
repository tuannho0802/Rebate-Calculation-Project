# IB Rebate System — Project Overview

> Tài liệu tổng quan dự án. Đọc trước khi đọc bất kỳ tài liệu nào khác.

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
| `04_BACKEND_GUIDE.md` | Setup NestJS, Prisma, Neon, cấu trúc module | BE |
| `05_FRONTEND_GUIDE.md` | Setup NextJS, API client, state management | FE |
| `06_ERROR_CODES.md` | Bảng mã lỗi chuẩn dùng chung | FE + BE |
| `07_ENVIRONMENTS.md` | Biến môi trường, URL, deploy checklist | FE + BE |

---

## Tech Stack

```
Frontend  : Next.js 14 (App Router) + TypeScript + TailwindCSS
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
MIB (Master IB)
 └── Lv1 IB  ← thấy tất cả Lv2 của mình
      └── Lv2 IB  ← thấy tất cả Lv3 của mình, KHÔNG thấy Lv2 anh em
           └── Lv3 IB  ← chỉ thấy Lv4 của mình
                └── ... (tối đa Lv5 + Sub5)
```

**Quy tắc visibility:** Mỗi node chỉ thấy subtree của chính mình, không thấy ngang cấp (sibling) và không thấy ngược lên parent.

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
