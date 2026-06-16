# LOCAL SETUP — Migration & Seed Data Guide

> File này nằm ngang cấp với tất cả `.md` khác, ngoài `rebate-backend/` và `rebate-frontend/`.
> Chứa toàn bộ lệnh SQL thực tế đã chạy thành công để setup local PostgreSQL.

---

## Yêu cầu

- **DBngin** (Windows/macOS) — chạy PostgreSQL local
- **TablePlus** — GUI để execute SQL
- **Node.js** >= 18
- **PostgreSQL** 17.x (qua DBngin)

---

## BƯỚC 1 — Tạo PostgreSQL Server trong DBngin

Mở DBngin → nhấn `+` → chọn **PostgreSQL**:

```
Version : 17.0 - x64
Name    : rebate-pg
Port    : 5432
```

Bấm **Create** → **Start**.

---

## BƯỚC 2 — Connect TablePlus vào PostgreSQL

Mở TablePlus → **Create new connection** → PostgreSQL:

```
Host     : 127.0.0.1
Port     : 5432
User     : postgres
Password : (để trống)
Database : postgres
SSL mode : PREFERRED
```

Bấm **Test** → thấy xanh → bấm **Connect**.

---

## BƯỚC 3 — Tạo User & Database (chạy TỪNG LỆNH MỘT)

> ⚠️ Mở Query tab (Ctrl+T), chạy **từng lệnh** một, chờ thấy `Query 1: OK` mới chạy lệnh tiếp.

**Lệnh 1 — Tạo user:**
```sql
CREATE USER rebate_user WITH PASSWORD 'rebate_pass_123';
```

**Lệnh 2 — Tạo database:**
```sql
CREATE DATABASE rebate_db OWNER rebate_user;
```

**Lệnh 3 — Grant privileges trên database:**
```sql
GRANT ALL PRIVILEGES ON DATABASE rebate_db TO rebate_user;
```

**Lệnh 4 — Grant privileges trên schema public:**
```sql
GRANT ALL PRIVILEGES ON SCHEMA public TO rebate_user;
```

**Lệnh 5 — Cấp quyền tạo DB (cần cho Prisma shadow database):**
```sql
ALTER USER rebate_user CREATEDB;
```

> Lệnh 5 bắt buộc phải có — nếu thiếu Prisma sẽ báo lỗi `P3014: permission denied to create database`.

---

## BƯỚC 4 — Cấu hình `.env` trong rebate-backend

```env
DATABASE_URL="postgresql://rebate_user:rebate_pass_123@localhost:5432/rebate_db"
JWT_ACCESS_SECRET=<random 64 char>
JWT_REFRESH_SECRET=<random 64 char>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
FRONTEND_URL=http://localhost:3000
PORT=3001
NODE_ENV=development
```

Tạo JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## BƯỚC 5 — Prisma Migrate

```bash
cd rebate-backend
npx prisma migrate dev --name "First Setup"
```

Output thành công:
```
Applying migration `20260616065558_first_setup`
Your database is now in sync with your schema.
✔ Generated Prisma Client
```

---

## BƯỚC 6 — Seed Data Mẫu

```bash
npm run seed
```

Seed sẽ tạo:
- 1 MIB account: `mib@test.com`
- 2 Lv1 IB: `lv1-a@test.com`, `lv1-b@test.com`
- 3 Lv2 IB dưới `lv1-a`
- 2 Lv3 IB
- Rebate config cho mỗi IB (FOREX + GOLD tối thiểu)
- 10 rebate transactions trải đều 3 tháng gần nhất

**Test accounts (password đều là `Test@1234`):**
```
mib@test.com      ← MIB, thấy toàn bộ cây
lv1-a@test.com    ← Lv1, thấy Lv2 của mình
lv2-a@test.com    ← Lv2, thấy Lv3 của mình
```

---

## BƯỚC 7 — Verify trong TablePlus

Sau khi seed, connect lại vào `rebate_db` trong TablePlus và kiểm tra:

```sql
SELECT COUNT(*) FROM ib_nodes;           -- phải > 0
SELECT COUNT(*) FROM rebate_configs;     -- phải > 0
SELECT COUNT(*) FROM rebate_transactions;-- phải > 0
```

---

## Reset Database (khi cần làm lại từ đầu)

```bash
cd rebate-backend
npx prisma migrate reset --force
npm run seed
```

> `migrate reset` sẽ xóa toàn bộ data và chạy lại migration + seed tự động nếu có config trong `package.json`.

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `P1010: User denied access` | Chưa grant đủ quyền | Chạy lại lệnh 3, 4, 5 |
| `P3014: permission denied to create database` | Thiếu CREATEDB | Chạy lệnh 5 |
| `P1001: Can't reach database` | DBngin chưa start | Mở DBngin, bấm Start |
| `database does not exist` | Chưa tạo DB | Chạy lại từ lệnh 2 |