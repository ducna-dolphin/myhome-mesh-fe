# Phase 02 — Seam super-app + session

## Context Links

- [plan.md](./plan.md) · [audit §2](../reports/reviewer-260926-2319-frontend-audit.md)
- Code hiện tại: `src/shared/bridge/superAppBridge.ts`, `src/shared/ui/AppShell.tsx`, `src/shared/api/client.ts`

## Overview

- Priority: P0 · Status: Done · Effort: 4h
- Tạo interface `SuperAppClient` + adapter, cache session, cung cấp `useSession()` / `useActiveNetworkId()`. Đây là chỗ duy nhất phải sửa khi có SDK VNPT.

## Key Insights

- Chuẩn JS Bridge/manifest/lifecycle của MyHome **chưa chốt** → interface phải tối thiểu, chỉ gồm thứ app đang cần + telemetry/lifecycle dạng no-op.
- `client.ts` hiện gọi `getSession()` mỗi request → round-trip qua Flutter. Cần cache promise.
- `VITE_DEFAULT_NETWORK_ID` đang rải trong 7 page. Chuyển thành fallback dev bên trong session.

## Requirements

- Feature/page không biết adapter nào đang chạy.
- Chạy browser thường (không có Flutter) vẫn dùng được → adapter `mock`.
- Session load 1 lần; có `refreshSession()` cho trường hợp 401 (phase 3 dùng).
- Chọn adapter theo môi trường, không cần sửa code.

## Architecture

```
src/shared/super-app/
├── super-app-client.ts        # interface + types
├── adapters/
│   ├── flutter-inappwebview-adapter.ts   # code cũ chuyển vào
│   └── browser-mock-adapter.ts           # dev/test
├── create-super-app-client.ts # chọn adapter
├── super-app-session-cache.ts # getSession() memo + refreshSession()
└── index.ts
src/shared/session/
├── session-context.ts         # React context + useSession, useActiveNetworkId
└── index.ts
src/app/providers/session-provider.tsx
```

Interface:

```ts
export interface SuperAppSession {
  accessToken?: string;
  userId?: string;
  locale: string; // mặc định 'vi-VN'
  networkId?: string; // household/mạng đang active nếu super app cung cấp
}

export interface SuperAppClient {
  readonly kind: 'flutter-inappwebview' | 'browser-mock';
  getSession(): Promise<SuperAppSession>;
  close(): Promise<void>;
  openNativeRoute(route: string, params?: Record<string, unknown>): Promise<void>;
  track(event: string, props?: Record<string, unknown>): void; // no-op tới khi có SDK
}
```

Chọn adapter (`create-super-app-client.ts`):

- `window.flutter_inappwebview?.callHandler` tồn tại → flutter adapter.
- Ngược lại → browser-mock (trả `{ locale: 'vi-VN', networkId: env.VITE_DEFAULT_NETWORK_ID }`, `close()` = `history.back()`).
- Export singleton `superApp`. Test có thể inject adapter khác qua `setSuperAppClient()` (chỉ export trong test helper).

Session cache:

```ts
let pending: Promise<SuperAppSession> | null = null;
export const getSession = () => (pending ??= superApp.getSession());
export const refreshSession = () => {
  pending = null;
  return getSession();
};
```

`SessionProvider` (app layer): gọi `getSession()` qua `useQuery(['super-app','session'], ...)` với `staleTime: Infinity`; loading → `<LoadingState />`; lỗi → `<ErrorState />`. Render context `{ session, networkId }`.

`useActiveNetworkId()`: trả `session.networkId ?? env.VITE_DEFAULT_NETWORK_ID`; throw nếu vẫn rỗng (lỗi lập trình, không phải lỗi user).

Race condition: flutter_inappwebview chỉ inject `callHandler` sau event `flutterInAppWebViewPlatformReady`. Flutter adapter phải `await` event này (timeout 3s) trước lần gọi đầu tiên — code cũ chưa xử lý.

## Related Code Files

- Create: các file trong cây trên
- Modify: `src/app/providers.tsx` (bọc `SessionProvider` trong `QueryClientProvider`), `src/shared/ui/AppShell.tsx` (dùng `superApp.close()`), `src/shared/api/client.ts` (dùng `getSession()` cache), `eslint.config.js` (xoá override tạm cho `shared/bridge`)
- Delete: `src/shared/bridge/superAppBridge.ts`
- Page: đổi `env.VITE_DEFAULT_NETWORK_ID` → `useActiveNetworkId()` (7 file) — sửa tối thiểu, di chuyển ở phase 5.

## Implementation Steps

1. Viết `super-app-client.ts` (types + interface).
2. Chuyển logic cũ vào `flutter-inappwebview-adapter.ts`, thêm chờ `flutterInAppWebViewPlatformReady`.
3. Viết `browser-mock-adapter.ts`.
4. `create-super-app-client.ts` + `super-app-session-cache.ts` + `index.ts` (export `superApp`, `getSession`, `refreshSession`, types).
5. `shared/session/session-context.ts` + `index.ts`.
6. `app/providers/session-provider.tsx`; cập nhật provider tree: `ErrorBoundary > QueryClientProvider > SessionProvider > RouterProvider`.
7. Thay mọi `env.VITE_DEFAULT_NETWORK_ID` trong page bằng `useActiveNetworkId()`.
8. Cập nhật `AppShell` + `client.ts`; xoá `shared/bridge/`.
9. Test: `super-app-session-cache.test.ts` (gọi 2 lần → adapter gọi 1 lần; refresh → gọi lại), `create-super-app-client.test.ts` (có/không có `flutter_inappwebview`).
10. Cập nhật test overview để bọc `SessionProvider` (tạm; phase 7 làm `renderWithProviders`).
11. lint/typecheck/test/build xanh.

## Todo List

- [x] interface + 2 adapter
- [x] session cache + refresh
- [x] shared/session context + hooks
- [x] SessionProvider vào provider tree
- [x] bỏ `VITE_DEFAULT_NETWORK_ID` khỏi page
- [x] xoá shared/bridge, gỡ override eslint
- [x] unit test seam
- [x] build + test xanh

## Success Criteria

- `grep -r flutter_inappwebview src` chỉ ra file trong `shared/super-app/adapters/`.
- `grep -r VITE_DEFAULT_NETWORK_ID src` chỉ ra `shared/config/env.ts` và `browser-mock-adapter.ts`.
- `npm run dev` trên browser chạy như cũ.

## Risk Assessment

- Handler name (`miniapp.getSession`…) có thể khác khi VNPT chốt → chỉ sửa trong flutter adapter.
- Super app không trả `networkId` → fallback env vẫn chạy; ghi vào câu hỏi mở.

## Security Considerations

- Access token chỉ nằm trong memory (cache module), **không** ghi localStorage/sessionStorage.
- Không log token trong `console`.

## Next Steps

- Phase 03 dùng `getSession()` / `refreshSession()` trong http-client.
