# Backend Development Guide (NestJS + Prisma + Neon)

## Changelog
- **2026-07-14**:
  - Thêm module `admin` và `trash`.
  - Cập nhật SubtreeGuard (chỉ check 1 cấp trực tiếp).
  - Thêm các Guard mới: `RolesGuard`, `SelfFinanceGuard`, `ProtectRootAdminGuard`.
  - Bổ sung cảnh báo quan trọng về encoding DB (bắt buộc dùng UTF-8).

---

## Setup dự án

```bash
# Khởi tạo NestJS
npm i -g @nestjs/cli
nest new ib-rebate-backend
cd ib-rebate-backend

# Prisma
npm install prisma @prisma/client
npm install -D prisma
npx prisma init

# Dependencies chính
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install bcrypt class-validator class-transformer
npm install @nestjs/config
npm install -D @types/bcrypt @types/passport-jwt
```

---

## Cấu trúc thư mục

```
src/
├── main.ts                   # Entry point + Vercel adapter
├── app.module.ts
│
├── common/
│   ├── decorators/
│   │   └── current-user.decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts   # Format error response chuẩn
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── subtree.guard.ts           # Kiểm tra IB thuộc subtree (chỉ check 1 cấp)
│   │   ├── roles.guard.ts             # Phân quyền role-based (ADMIN, IB)
│   │   ├── self-finance.guard.ts      # Chặn thao tác tài chính của Admin lên chính mình
│   │   └── protect-root-admin.guard.ts# Chặn thao tác xóa/sửa Root Admin
│   ├── interceptors/
│   │   └── response.interceptor.ts    # Wrap response thành envelope
│   └── pipes/
│       └── validation.pipe.ts
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── refresh.dto.ts
│   │
│   ├── ib/
│   │   ├── ib.module.ts
│   │   ├── ib.controller.ts
│   │   ├── ib.service.ts
│   │   └── dto/
│   │       └── create-ib.dto.ts
│   │
│   ├── rebate/
│   │   ├── rebate.module.ts
│   │   ├── rebate.controller.ts
│   │   ├── rebate.service.ts
│   │   └── dto/
│   │       └── update-config.dto.ts
│   │
│   ├── report/
│   │   ├── report.module.ts
│   │   ├── report.controller.ts
│   │   └── report.service.ts
│   │
│   ├── admin/                         # Quản lý users (CRUD Admin)
│   │   ├── admin.module.ts
│   │   ├── admin.controller.ts
│   │   └── admin.service.ts
│   │
│   └── trash/                         # Thùng rác (Soft delete & Restore)
│       ├── trash.module.ts
│       ├── trash.controller.ts
│       └── trash.service.ts
│
└── prisma/
    ├── prisma.module.ts
    └── prisma.service.ts
```

---

## Kết nối Database (Local & Neon)

> **CẢNH BÁO QUAN TRỌNG VỀ ENCODING TRÊN LOCAL (Windows):**
> Khi chạy PostgreSQL trên Windows, DB mặc định có thể bị tạo bằng `WIN1252`, dẫn đến lỗi font chữ tiếng Việt (Mojibake).
> BẮT BUỘC tạo DB local bằng lệnh psql sau trước khi chạy Prisma migrate:
> ```sql
> CREATE DATABASE rebate_db WITH ENCODING 'UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE=template0;
> ```

1. Tạo project tại [neon.tech](https://neon.tech)
2. Copy `DATABASE_URL` vào `.env`:

```env
# .env
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
JWT_ACCESS_SECRET="your-secret-access-key-min-32-chars"
JWT_REFRESH_SECRET="your-secret-refresh-key-min-32-chars"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"
PORT=3001
```

3. Copy schema từ `02_DATA_MODELS.md` vào `prisma/schema.prisma`

4. Migrate:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## Response Interceptor (QUAN TRỌNG)

Mọi response phải wrap vào envelope chuẩn:

```typescript
// src/common/interceptors/response.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data?.data ?? data,
        ...(data?.meta ? { meta: data.meta } : {}),
      }))
    );
  }
}
```

```typescript
// src/common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    response.status(status).json({
      success: false,
      error: {
        code: exceptionResponse.code || 'INTERNAL_ERROR',
        message: exceptionResponse.message || exception.message,
        details: exceptionResponse.details || {},
      },
    });
  }
}
```

```typescript
// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  
  app.enableCors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:3000'],
    credentials: true,
  });

  await app.listen(process.env.PORT || 3001);
}
bootstrap();
```

---

## Deploy lên Vercel (Serverless)

```bash
npm install @nestjs/platform-express
```

Tạo file `api/index.ts` ở root:

```typescript
// api/index.ts
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';

const server = express();

async function createNestServer(expressInstance: express.Express) {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressInstance));
  app.setGlobalPrefix('api');
  // ... thêm các global stuff như ở main.ts
  await app.init();
}

createNestServer(server);
export default server;
```

`vercel.json`:
```json
{
  "version": 2,
  "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "api/index.ts" }]
}
```

---

## Rebate Calculation Logic

```typescript
// src/modules/rebate/rebate.service.ts

// Logic tính rebate theo cây:
// 1. Lấy config của IB hiện tại cho asset đó
// 2. rebatePips = phần IB này giữ lại
// 3. markupPips = phần đẩy xuống cấp dưới (hoặc giữ nếu không có cấp dưới)
// 4. Tổng = rebatePips + markupPips = maxPips của cấp trên cấp này

calculateDistribution(config: RebateAssetConfig, lots: number) {
  const selfAmount = config.rebatePips * lots;
  const downstreamAmount = config.markupPips * lots;
  
  return {
    self: selfAmount,
    downstream: downstreamAmount,
    total: selfAmount + downstreamAmount,
  };
}
```

---

## Checklist trước khi gọi là "done"

- [ ] Tất cả endpoints trong `01_API_CONTRACT.md` đã implement
- [ ] Response format đúng envelope (success/error)
- [ ] Error codes dùng đúng theo `06_ERROR_CODES.md`
- [ ] JWT guard bảo vệ tất cả routes (trừ /auth/login, /auth/refresh)
- [ ] Subtree guard check quyền truy cập IB
- [ ] Validation DTO cho tất cả request body
- [ ] Không để lộ password hash trong response
- [ ] CORS config đúng origin FE
- [ ] `.env` không commit lên git (kiểm tra `.gitignore`)
