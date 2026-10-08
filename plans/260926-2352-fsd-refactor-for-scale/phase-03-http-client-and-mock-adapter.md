# Phase 03 — Seam http-client, ApiError, mock adapter

## Context Links

- [plan.md](./plan.md) · [audit §4](../reports/reviewer-260926-2319-frontend-audit.md)
- Mã lỗi ONE Link: 408 = timeout, 409 = thiết bị offline (research doc VNPT §4)
- Code hiện tại: `src/shared/api/client.ts`, `src/shared/api/meshApi.ts`

## Overview

- Priority: P0 · Status: Done · Effort: 4h
- HTTP client có lỗi typed, timeout, refresh token 1 lần khi 401, validate response bằng Zod. Tách nhánh mock ra khỏi từng hàm API.

## Key Insights

- `meshApi.ts` lặp `if (env.VITE_API_MODE === 'mock')` 8 lần → gom vào 1 helper.
- Response không validate → backend đổi shape là UI vỡ im lặng.
- `retry: 1` global retry cả lỗi 4xx → vô nghĩa với 401/404/409.

## Requirements

- Mọi lỗi API ném `ApiError` có `kind` để UI hiển thị message phù hợp.
- Timeout mặc định 15s (AbortController), cho phép override (speed test cần lâu hơn).
- 401 → `refreshSession()` rồi thử lại **đúng 1 lần**.
- Response parse qua schema Zod được truyền vào.
- Retry của TanStack chỉ áp dụng cho `network`/`timeout`/5xx.

## Architecture

```
src/shared/api/
├── api-error.ts          # class ApiError + mapStatusToKind
├── http-client.ts        # request<T>(path, { schema, method, body, timeoutMs })
├── with-mock.ts          # chọn mock hay remote theo env
├── should-retry-query.ts # dùng trong QueryClient defaultOptions
└── index.ts
```

```ts
export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'timeout'
  | 'device-offline'
  | 'validation'
  | 'server'
  | 'network';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number | null,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}
// 401→unauthorized, 403→forbidden, 404→not-found, 408→timeout, 409→device-offline, >=500→server
```

```ts
interface RequestOptions<T> {
  schema: z.ZodType<T>;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  skipAuth?: boolean;
}
export async function request<T>(path: string, opts: RequestOptions<T>): Promise<T>;
```

Luồng: lấy token từ `getSession()` → fetch có signal → 401 và chưa retry → `refreshSession()` → gọi lại → `!ok` → `ApiError` → `schema.safeParse(json)` fail → `ApiError('validation')`. 204 → trả `undefined` nếu schema cho phép.

```ts
// with-mock.ts
export function withMock<A extends unknown[], T>(
  mock: (...a: A) => T | Promise<T>,
  remote: (...a: A) => Promise<T>,
) {
  return (...args: A): Promise<T> =>
    env.VITE_API_MODE === 'mock' ? delay().then(() => structuredClone(mock(...args))) : remote(...args);
}
```

Mock data **không** nằm ở shared (shared không được biết domain) → phase 4 chuyển mock vào `entities/*/api/*-mock.ts`.

## Related Code Files

- Create: `src/shared/api/api-error.ts`, `http-client.ts`, `with-mock.ts`, `should-retry-query.ts`, `index.ts`
- Modify: `src/shared/api/meshApi.ts` (dùng `request` + `withMock` tạm thời, xoá ở phase 4), `src/app/providers.tsx` (`retry: shouldRetryQuery`), `src/shared/ui/ScreenState.tsx` (`ErrorState` nhận `error?: unknown` → map `kind` sang message)
- Delete: `src/shared/api/client.ts`

## Implementation Steps

1. `api-error.ts` + unit test map status.
2. `http-client.ts` với timeout/401-retry/Zod; test bằng `vi.stubGlobal('fetch', ...)`: ok, 401→refresh→ok, 401→refresh→401 (ném, không lặp), 409, timeout, JSON sai schema.
3. `with-mock.ts`.
4. `should-retry-query.ts`: `(count, err) => count < 2 && (!(err instanceof ApiError) || ['network','timeout','server'].includes(err.kind))`.
5. Cập nhật `meshApi.ts` dùng helper mới (schema tạm `z.custom<T>()` — phase 4 thay schema thật).
6. `ErrorState`: message theo `kind` (`device-offline` → "Thiết bị đang mất kết nối", `timeout` → "Thiết bị phản hồi chậm, thử lại sau"…). Giữ message mặc định cũ cho lỗi khác.
7. lint/typecheck/test/build xanh.

## Todo List

- [x] ApiError + mapping
- [x] http-client (timeout, 401 refresh 1 lần, Zod)
- [x] withMock
- [x] shouldRetryQuery vào QueryClient
- [x] ErrorState map theo kind
- [x] xoá client.ts
- [x] unit test http-client đủ 6 case

## Success Criteria

- Không còn `env.VITE_API_MODE` ngoài `with-mock.ts` và `env.ts`.
- 6 case test http-client pass.

## Risk Assessment

- ONE Link dùng GET có JSON body — nhưng miniapp gọi BE MyHome/Go, không gọi ONE Link trực tiếp → không ảnh hưởng. Ghi rõ trong docs.
- Refresh loop vô hạn → khoá bằng cờ `retried` trong 1 lần request.

## Security Considerations

- Không đưa token vào URL/log. Không gửi `Authorization` khi `skipAuth`.
- `ApiError.message` không chứa body response thô (có thể lộ thông tin nội bộ); body giữ ở `cause` cho debug.

## Next Steps

- Phase 04 viết schema thật và chuyển API về từng entity.
