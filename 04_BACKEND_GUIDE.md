# Backend Development Guide (NestJS + Prisma + Neon)

## Changelog
- **2026-07-28 (rà soát toàn bộ + đối chiếu trực tiếp `rebate.service.ts` hiện tại)**:
  - **Sửa quan trọng**: mục "Rebate Calculation Logic" bên dưới trước đây mô tả hàm
    `cascadeMaxPipsToSubtree()` với công thức `maxPips(con) = max(0, parent.maxPips - parent.rebatePips)`.
    Hàm này **không tồn tại** trong code hiện tại và công thức đó **sai**. Đã viết lại toàn bộ
    mục này theo đúng 4 hàm thật: `resolveEffectiveMaxPips()`, `getConfig()` (đọc + synth cho MIB),
    `updateConfig()` (ghi + validate + cascade tuyến tính `maxPips(con) = rebatePips`),
    `setMibMaxOverride()` + `resetSubtreeAssetsBatch()` (reset subtree về 0, không phải cascade trừ),
    và `smartCascadeCheckAndReset()` (chỉ reset nhánh nào thực sự vi phạm, bảo toàn phần còn lại).
  - Xem `01_API_CONTRACT.md` (mục changelog 2026-07-28) và `06_ERROR_CODES.md` để biết chi tiết
    request/response và mã lỗi tương ứng.
- **2026-07-15**:
  - ⚠️ **ĐÃ SUPERSEDED bởi mục 2026-07-28 ở trên** — công thức `cascadeMaxPipsToSubtree()` mô tả
    dưới đây không còn đúng với code hiện tại. Giữ nguyên văn chỉ để tham khảo lịch sử:
  - Cập nhật mục **Rebate Calculation Logic** — thay thế code mẫu cũ (`calculateDistribution`
    dùng `markupPips` làm cap) bằng công thức cascade **DUY NHẤT** thật trong
    `cascadeMaxPipsToSubtree()`: `maxPips(con) = max(0, parent.maxPips - parent.rebatePips)`.
    Cả `setMibMaxOverride()` và `updateConfig()` đều gọi chung hàm này.
  - Ghi chú: `bulkUpdateConfig()` sort items theo `level ASC` (parent→child) trước khi loop
    để cascade đọc `maxPips`/`rebatePips` mới nhất của parent (fix race condition).
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
│   │   ├── rebate.service.spec.ts
│   │   └── dto/
│   │       ├── update-config.dto.ts
│   │       ├── bulk-update-config.dto.ts
│   │       ├── mib-max-override.dto.ts
│   │       └── save-templates.dto.ts
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

> Toàn bộ logic "trần" (maxPips) và cascade nằm trong `rebate.service.ts`. Không có hàm
> `cascadeMaxPipsToSubtree()` nào cả — đó là tên hàm từ 1 bản thiết kế cũ chưa từng khớp với
> code thật. 5 khối logic thật sự tồn tại, mô tả theo đúng thứ tự luồng dữ liệu bên dưới.

### 1. `resolveEffectiveMaxPips()` — nguồn DUY NHẤT tính "trần" hiệu lực

```typescript
// src/modules/rebate/rebate.service.ts
private resolveEffectiveMaxPips(rawMaxPips: number, isMib: boolean, assetType: AssetType): number {
  return isMib && rawMaxPips <= 0 ? (MAX_PIPS[assetType] || 0) : rawMaxPips;
}
```
Dùng CHUNG cho cả đường đọc (`getConfig`) lẫn đường ghi/validate (`updateConfig`) — bắt buộc,
để tránh bug "2 nơi tính trần khác nhau" (UI hiện 1 giá trị, lúc Lưu lại validate theo giá trị
khác). Quy tắc: **chỉ** fallback về `MAX_PIPS[assetType]` (trần công ty mặc định) khi là **MIB
(level 0)** và `rawMaxPips <= 0` (chưa từng được set/bị reset). Với non-MIB, `maxPips = 0` là
trạng thái **hợp lệ** ("cấp trên chưa cấp pips nào cho asset này") — không được fallback, nếu
không child sẽ tưởng nhầm mình có full budget.

### 2. `getConfig()` — đường đọc, kèm "bootstrap gap" synthesis cho MIB

```typescript
async getConfig(ibId: string) {
  const [configs, ib] = await Promise.all([
    this.prisma.rebateConfig.findMany({ where: { ibId }, orderBy: { updatedAt: 'desc' } }),
    this.prisma.ibNode.findUnique({ where: { id: ibId }, select: { level: true } }),
  ]);
  const isMib = ib?.level === 0;

  const existingAssets = configs.map((c) => ({
    ...c,
    maxPips: this.resolveEffectiveMaxPips(Number(c.maxPips), isMib, c.assetType),
  }));

  if (!isMib) return { ibId, assets: existingAssets, updatedAt: /* ... */ };

  // MIB có thể CHƯA TỪNG có dòng rebateConfig nào (nếu Admin chưa từng override và
  // MIB chưa tự cấu hình chính mình) — vẫn là root hợp lệ của cả nhánh. Để Dashboard
  // không hiện trống trơn, mọi AssetType chưa có dòng thật được synth "ảo" với
  // maxPips = MAX_PIPS[assetType], KHÔNG ghi gì xuống DB, chỉ trả về ở response.
  const syntheticAssets = Object.values(AssetType)
    .filter((at) => !existingAssets.some((a) => a.assetType === at))
    .map((at) => ({ assetType: at, rebatePips: 0, markupPips: 0, markupPercent: 100, maxPips: MAX_PIPS[at] || 0 }));

  return { ibId, assets: [...existingAssets, ...syntheticAssets], updatedAt: /* ... */ };
}
```
Với non-MIB, hành vi giữ nguyên như trước: chỉ trả dòng có thật trong DB, không synth thêm.

### 3. `updateConfig()` — đường ghi + validate + gán `maxPips` mới

Cho mỗi asset trong `updateDto.assets`:

- **Validate trần**: nếu `targetIb` có cha (`hasParent`), `parentRebateMax` = trần hiệu lực của
  cha (qua `resolveEffectiveMaxPips`, cộng thêm `markupPips` nếu cha là MIB) — hoặc `rebatePips`
  hiện tại của cha nếu cha không phải MIB. `rebatePips` gửi lên **không được vượt** giá trị này
  (`REBATE_EXCEEDS_PARENT`). Nếu không có cha (chính targetIb là MIB tự sửa), giới hạn là
  `existing.maxPips` (nếu > 0) hoặc `MAX_PIPS[assetType]` (`REBATE_EXCEEDS_MAX`).
- **Gán `maxPips` mới cho targetIb** — đây là công thức cascade THẬT (tuyến tính, không phải
  công thức trừ):
  ```typescript
  const childMaxPips = targetIb.level === 0
    ? this.resolveEffectiveMaxPips(existing ? Number(existing.maxPips) : 0, true, assetType) // MIB giữ nguyên trần của chính nó
    : rebatePips; // level >= 1: maxPips = ĐÚNG số pips vừa nhận từ cấp trên
  ```
  Nói cách khác, chuỗi cascade là **20 → 15 → 10 → 5 → 0** (mỗi mốc = đúng số pips cấp trên vừa
  chia xuống), **không phải** `parent.maxPips - parent.rebatePips` như tài liệu cũ mô tả.
- **BE không bao giờ tin `maxPips` do FE gửi** — field này bị bỏ qua hoàn toàn, luôn tự tính lại
  theo công thức trên. `markupPips` thì ngược lại, được lưu đúng giá trị FE gửi (tách riêng khỏi
  `markupPercent` — xem fix 27/07/2026 trong code, tránh bug cũ khiến `markupPips` bị ghi đè
  nhầm thành giá trị của `markupPercent`).
- Sau khi ghi xong (transaction), nếu có thay đổi thật (`hasChange`), gọi tiếp
  `smartCascadeCheckAndReset()` (mục 5 bên dưới) cho các asset vừa đổi.

### 4. `setMibMaxOverride()` + `resetSubtreeAssetsBatch()` — Admin đổi trần MIB

```typescript
// Validate: CHỈ chặn maxPips < 0. KHÔNG chặn theo MAX_PIPS[assetType] — MAX_PIPS là trần
// MẶC ĐỊNH, override tồn tại đúng để THAY THẾ trần đó; chặn theo MAX_PIPS sẽ làm override
// vô nghĩa (không bao giờ override được gì).
if (ov.maxPips < 0) throw new UnprocessableEntityException({ code: 'MAX_OVERRIDE_INVALID' });
```
Khi Admin đổi trần MIB cho 1 asset, hàm **không** cascade theo công thức trừ — nó **RESET toàn
bộ subtree về 0** cho đúng asset đó (`rebatePips = markupPips = maxPips = 0`), buộc mọi
IB/Sub-IB trong nhánh phải cấu hình lại từ đầu. Mỗi asset chỉ update/audit/notify nếu giá trị
THẬT SỰ đổi so với trước (dedupe theo `beforeMaxPips === ov.maxPips` → bỏ qua); toàn bộ subtree
chỉ bị quét 1 lần / lượt override (không phải 1 lần / asset) và mỗi người chỉ nhận **đúng 1**
notification tổng hợp liệt kê tất cả asset bị ảnh hưởng.

### 5. `smartCascadeCheckAndReset()` — reset có chọn lọc sau khi IB cấp trên tự sửa config

Khác với mục 4 (Admin đổi trần MIB → reset cứng toàn subtree), khi 1 IB thường tự sửa config
cho con trực tiếp (`updateConfig()`), hệ thống chỉ **reset đúng những nhánh con thực sự vi
phạm**: nếu `rebatePips` mới của cấp trên **nhỏ hơn** mức mà cấp dưới đã từng chia tiếp xuống
nữa, nhánh đó (và đệ quy xuống các cháu/chắt bị ảnh hưởng) bị set về 0 cho đúng asset đó. Nếu
mức mới vẫn `>=` mức đã chia, toàn bộ nhánh con được **bảo toàn nguyên vẹn** — không có gì bị
động vào. Mỗi người dùng bị ảnh hưởng chỉ nhận đúng 1 thông báo tổng hợp.

```
// Tính tiền rebate thực tế (GET /rebate/calculate) — không đổi:
//   self        = rebatePips * lots
//   total       = (rebatePips + markupPips) * lots
//   distributed = tổng rebatePips của các ancestor (CTE walk-up)
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