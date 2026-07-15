# Code Standards & Architecture Rules

> **Bắt buộc đọc trước khi sửa bất kỳ file nào.**
> Áp dụng cho toàn bộ team — mỗi agent phải tuân thủ tuyệt đối.
> Vi phạm các quy tắc sẽ bị reject PR.
> Tập hợp các quy ước code chung cho dự án, rút ra từ quá trình review và fix lỗi.

## Changelog
- **2026-07-15**:
  - Xác nhận lại **4 try-catch vi phạm** (jwt-auth.guard, subtree.guard, auth.service, rebate.controller) **vẫn còn tồn tại** (chưa sửa) — chuyển sang mục Technical Debt A.
  - Thêm mục nợ kỹ thuật mới **B.5**: `ib_nodes.accountType` **không có FK** tới `account_type_templates`/`markup_link_templates` — rủi ro data integrity, CHƯA xử lý (chờ thiết kế lại).
- **2026-07-14**:
  - Thêm quy tắc xử lý lỗi trong `try-catch` (không nuốt lỗi âm thầm).
  - Cập nhật danh sách nợ kỹ thuật (Technical Debt Backlog).

---

## 1. Nguyên tắc tối thượng

1. **Tài liệu là luật** — `01_API_CONTRACT.md` > code. Khi conflict, sửa code theo tài liệu, không sửa tài liệu theo code (trừ khi được team approve).
2. **Không tự phát minh** — Không tự đặt tên field, không tự tạo endpoint, không tự thêm error code ngoài tài liệu.
3. **Một nguồn sự thật** — Types định nghĩa 1 lần trong `02_DATA_MODELS.md`, dùng lại ở mọi nơi.
4. **Không breaking change ngầm** — Mọi thay đổi API phải update `01_API_CONTRACT.md` trước, thông báo team.

---

## 2. Quy tắc đặt tên

### Files & Folders
```
kebab-case     : rebate-config.service.ts, ib-tree.module.ts
PascalCase     : RebateConfig, IbTreeNode (class/interface/type)
camelCase      : rebateConfig, ibTreeNode (variable/function)
UPPER_SNAKE    : MAX_PIPS, JWT_SECRET (constant/enum value)
```

### Backend (NestJS)
```
Module    : *.module.ts
Controller: *.controller.ts
Service   : *.service.ts
Guard     : *.guard.ts
Decorator : *.decorator.ts
Filter    : *.filter.ts
Interceptor: *.interceptor.ts
DTO       : create-*.dto.ts / update-*.dto.ts
```

### Frontend (Next.js)
```
Component  : PascalCase.tsx  (IbTreeNode.tsx)
Page       : page.tsx (luôn là page.tsx theo App Router)
Hook       : use*.ts  (useIbTree.ts)
Store      : *.store.ts
API module : *.ts trong lib/api/
Type file  : index.ts trong types/
```

---

## 3. Backend Architecture Rules

### Module Structure (bắt buộc)
```
modules/<name>/
  ├── <name>.module.ts      ← import/export
  ├── <name>.controller.ts  ← route handler, KHÔNG có business logic
  ├── <name>.service.ts     ← toàn bộ business logic
  └── dto/
      ├── create-<name>.dto.ts
      └── update-<name>.dto.ts
```

### Controller Rules
```typescript
// ✅ ĐÚNG — Controller chỉ nhận/trả, không xử lý logic
@Get('tree')
async getTree(@CurrentUser() user: JwtPayload, @Query('depth') depth: string) {
  return this.ibService.getTree(user.sub, depth);
}

// ❌ SAI — Không viết logic trong controller
@Get('tree')
async getTree(@CurrentUser() user: JwtPayload) {
  const ib = await this.prisma.ibNode.findUnique({ where: { id: user.sub } });
  // ... business logic trong controller
}
```

### Service Rules
```typescript
// ✅ ĐÚNG — Throw HttpException với đúng error code
if (!ib) {
  throw new HttpException(
    { code: 'IB_NOT_FOUND', message: 'IB không tồn tại' },
    HttpStatus.NOT_FOUND
  );
}

// ❌ SAI — Không throw NotFoundException mặc định của NestJS (sẽ sai error format)
if (!ib) throw new NotFoundException('IB not found');
```

### DTO Rules
```typescript
// ✅ ĐÚNG — Luôn có class-validator decorators
export class CreateIbDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

// ❌ SAI — Không dùng interface làm DTO
interface CreateIbDto { email: string; password: string; }
```

### Prisma Rules
```typescript
// ✅ ĐÚNG — Select chỉ field cần thiết, không select password ra ngoài
const ib = await this.prisma.ibNode.findUnique({
  where: { id },
  select: { id: true, email: true, level: true, parentId: true }
});

// ❌ SAI — Không trả về toàn bộ record khi có password
const ib = await this.prisma.ibNode.findUnique({ where: { id } });
return ib; // leak password hash!
```

---

## 4. Xử lý lỗi — Try-Catch Rules (cập nhật 2026-07-14)

### Quy tắc bắt buộc
```typescript
// ✅ ĐÚNG — Luôn log đủ context nếu catch mà không rethrow
} catch (error) {
  console.error('[ServiceName] Operation failed:', {
    context: { param1, param2 },
    error: error.message,
  });
  // Tiếp tục xử lý hoặc trả về fallback
}

// ❌ SAI — Catch rỗng (nuốt lỗi âm thầm, gây khó debug)
} catch {
  // ignore
}

// ❌ SAI — Catch nhưng không log context
} catch (err) {
  console.error(err);
}
```

### Nguyên tắc
- Nếu lỗi là **non-blocking** (vd: gửi notification thất bại không ảnh hưởng action chính), `catch` nhưng **phải** `console.error` đủ `recipientId`, `type`, `error.message`.
- Nếu lỗi là **critical** (vd: DB write fail), **phải** rethrow hoặc throw `HttpException` chuẩn.
- Không dùng `try {}` chỉ để bọc 1 dòng `console.log` rồi `catch { }` rỗng — bỏ hẳn try-catch đó đi là sạch hơn.

### Technical Debt Backlog

#### A. Try-Catch cần dọn dẹp (vi phạm quy tắc §4)
> **Trạng thái 2026-07-15:** CẢ 4 vị trí **vẫn còn tồn tại** (xác nhận qua code thật + backend `DAILY_LOGS.md` entry 2026-07-15), chưa sửa.

1. `src/common/guards/jwt-auth.guard.ts` dòng 13 — catch lỗi của chính `console.warn`
2. `src/common/guards/subtree.guard.ts` dòng 27, 53, 76 — catch bọc quanh logging
3. `src/modules/auth/auth.service.ts` dòng 93 — nuốt lỗi khi logout (deleteMany RT)
4. `src/modules/rebate/rebate.controller.ts` dòng 30, 53 — catch bọc quanh `console.log`

> Pattern tương tự cũng có ở FE: `lib/api/rebate.ts` (try/catch bọc `console.log`). Nên dọn dẹp chung.

#### B. Data Integrity / Thiết kế (rủi ro đã biết, CHƯA xử lý)
5. **`ib_nodes.accountType` KHÔNG có Foreign Key** tới `account_type_templates` hay
   `markup_link_templates` (chỉ là `String @default("Markup 0%")`). Nếu MIB đổi tên template,
   `accountType` của sub-IB không tự cập nhật → dữ liệu lệch. **Cần quyết định thiết kế lại**
   (vd: thêm FK, hoặc bỏ hẳn field này và đọc template từ relation) trước khi xử lý.
   Backlink: `02_DATA_MODELS.md` (model `IbNode`) và `12_PROJECT_STRUCTURE_ANALYSIS.md` (bảng Rủi ro R6).

---

## 5. Frontend Architecture Rules

### Component Rules
```typescript
// ✅ ĐÚNG — Props được type rõ ràng
interface IbTreeNodeProps {
  node: IbTreeNode;
  onSelect?: (id: string) => void;
}

export function IbTreeNodeComponent({ node, onSelect }: IbTreeNodeProps) { ... }

// ❌ SAI — Không dùng any, không bỏ qua typing
export function IbTreeNodeComponent({ node, onSelect }: any) { ... }
```

### API Call Rules
```typescript
// ✅ ĐÚNG — Luôn gọi qua lib/api/, không gọi axios trực tiếp trong component
import { ibApi } from '@/lib/api/ib';
const tree = await ibApi.getTree('all');

// ❌ SAI — Không import axios trong component
import axios from 'axios';
const tree = await axios.get('/api/ib/tree');
```

### Error Handling Rules
```typescript
// ✅ ĐÚNG — Dùng getErrorMessage() từ lib/error-messages.ts
catch (err) {
  const code = err.response?.data?.error?.code;
  toast.error(getErrorMessage(code));
}

// ❌ SAI — Không hardcode message tiếng Anh/Việt trong component
catch (err) {
  toast.error('Có lỗi xảy ra');
}
```

### State Rules
```typescript
// ✅ ĐÚNG — Auth state dùng Zustand store
const { user, setUser } = useAuthStore();

// ❌ SAI — Không dùng useState cho global auth state
const [user, setUser] = useState(null);
```

### Type Rules
```typescript
// ✅ ĐÚNG — Import type từ src/types/index.ts
import type { IbNode, RebateConfig, AssetType } from '@/types';

// ❌ SAI — Không tự khai báo type inline
const data: { id: string; email: string; level: number } = ...
```

---

## 5. API Response Rules (QUAN TRỌNG NHẤT)

Mọi response từ BE **phải** qua `ResponseInterceptor`. Không được return object trực tiếp mà bỏ qua interceptor.

```typescript
// ✅ ĐÚNG — Return data thẳng, interceptor sẽ wrap
return { data: ibTree };           // → { success: true, data: { data: ibTree } } ❌
return ibTree;                     // → { success: true, data: ibTree } ✅

// Với pagination:
return { data: list, meta: { page, limit, total } };
```

FE khi nhận response:
```typescript
// ✅ ĐÚNG — Luôn lấy .data từ envelope
const { data } = await apiClient.get('/ib/tree');
const tree = data.data;  // data.data vì axios wrap thêm 1 lớp

// ❌ SAI
const tree = data;
```

---

## 6. Git Commit Rules

Format: `type(scope): message`

```
feat(be): add rebate calculation endpoint
feat(fe): implement IB tree view component
fix(be): correct subtree guard recursive query
fix(fe): handle token refresh race condition
refactor(be): extract rebate logic to separate service
docs: update API contract for report endpoint
chore: update prisma schema add index
```

Types: `feat` | `fix` | `refactor` | `docs` | `chore` | `test`
Scopes: `be` | `fe` | `db` | `auth` | `ib` | `rebate` | `report`

---

## 7. Forbidden Patterns (KHÔNG BAO GIỜ làm)

```typescript
// ❌ console.log trong production code
console.log('debug:', data);

// ❌ any type
const data: any = ...

// ❌ Hardcode URL
fetch('http://localhost:3001/api/auth/login')

// ❌ Expose secret/token trong log
console.log('token:', accessToken);

// ❌ Mutation trực tiếp state
user.email = 'new@email.com';

// ❌ Bỏ qua error handling
await someApi.call(); // không có try/catch

// ❌ Tự đặt error code ngoài 06_ERROR_CODES.md
throw new HttpException({ code: 'MY_CUSTOM_ERROR' }, 400);

// ❌ Return password trong response
return this.prisma.ibNode.findUnique({ where: { id } }); // có password field
```

---

## 8. File mỗi agent PHẢI đọc theo nhiệm vụ

| Nhiệm vụ | Files bắt buộc đọc |
|---|---|
| Thêm API endpoint mới | `01_API_CONTRACT.md` + `06_ERROR_CODES.md` + `09_CODE_STANDARDS.md` |
| Sửa data model | `02_DATA_MODELS.md` + `01_API_CONTRACT.md` |
| Sửa auth/phân quyền | `03_AUTH_FLOW.md` + `09_CODE_STANDARDS.md` |
| Thêm FE page/component | `05_FRONTEND_GUIDE.md` + `01_API_CONTRACT.md` + `09_CODE_STANDARDS.md` |
| Fix bug | `06_ERROR_CODES.md` + file liên quan + update `DAILY_LOGS.md` |
| Deploy | `07_ENVIRONMENTS.md` |