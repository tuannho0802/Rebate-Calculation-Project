# Environments & Deployment

---

## Môi trường

| Env | FE URL | BE URL | DB |
|---|---|---|---|
| Local | `http://localhost:3000` | `http://localhost:3001` | Neon dev branch |
| Production | `https://ib-rebate.vercel.app` | `https://ib-rebate-api.vercel.app` | Neon main branch |

---

## Biến môi trường

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Backend (`.env`)

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

JWT_ACCESS_SECRET=<random 64 char string>
JWT_REFRESH_SECRET=<random 64 char string>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

FRONTEND_URL=http://localhost:3000
PORT=3001
NODE_ENV=development
```

> Tạo secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

### Vercel Environment Variables (Production)

**Frontend project:**
```
NEXT_PUBLIC_API_URL = https://ib-rebate-api.vercel.app/api
```

**Backend project:**
```
DATABASE_URL        = <Neon production connection string>
JWT_ACCESS_SECRET   = <secret>
JWT_REFRESH_SECRET  = <secret>
JWT_ACCESS_EXPIRES  = 15m
JWT_REFRESH_EXPIRES = 7d
FRONTEND_URL        = https://ib-rebate.vercel.app
NODE_ENV            = production
```

---

## Setup Neon (Database)

1. Tạo account tại [neon.tech](https://neon.tech)
2. Tạo project mới → chọn region gần nhất (Singapore cho VN)
3. Tạo 2 branch:
   - `main` → production
   - `dev` → development
4. Copy connection string cho từng branch vào `.env` tương ứng

**Kết nối với Vercel:**
- Vercel Dashboard → Storage → Connect Database → Chọn Neon
- Tự động inject `DATABASE_URL` vào production env

---

## Git Workflow

```
main          ← production (auto-deploy Vercel)
  └── dev     ← staging / integration
        ├── feat/be-auth
        ├── feat/be-ib-tree
        ├── feat/fe-dashboard
        └── feat/fe-ib-config
```

**Quy tắc:**
- Branch đặt tên: `feat/<be|fe>-<tên-feature>`
- Trước khi merge vào `dev`: review API response có đúng contract không
- Không merge thẳng vào `main` khi chưa test trên `dev`

---

## Deploy Checklist

### Backend (trước)
- [ ] Migrate database production: `npx prisma migrate deploy`
- [ ] Prisma generate: `npx prisma generate`
- [ ] Tất cả env vars đã set trên Vercel
- [ ] Test endpoint `/api/auth/login` hoạt động
- [ ] CORS origin đã trỏ đúng FE production URL

### Frontend (sau)
- [ ] `NEXT_PUBLIC_API_URL` trỏ đúng BE production URL
- [ ] Build không có error: `npm run build`
- [ ] Login flow hoạt động với BE production
- [ ] Auto-refresh token hoạt động
- [ ] Test trên mobile (responsive)

---

## Local Development

```bash
# Terminal 1 — Backend
cd ib-rebate-backend
npm run start:dev        # Port 3001

# Terminal 2 — Frontend
cd ib-rebate-frontend
npm run dev              # Port 3000
```

---

## `.gitignore` cần có

**Backend:**
```
.env
node_modules/
dist/
```

**Frontend:**
```
.env.local
.env.production
node_modules/
.next/
```
