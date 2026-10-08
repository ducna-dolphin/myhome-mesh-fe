# Frontend audit – miniapp-wifi-mesh

Bối cảnh: MiniApp Mesh/WiFi/ONT nhúng trong super app MyHome (Flutter WebView / SmartScreen launcher). Docs nguồn: `~/Downloads/File nhận từ VNPT-…/`. Tham chiếu spec: `plans/reports/researcher-260925-1037-vnpt-folder-overview.md` bên folder VNPT.

## TL;DR

Codebase ở dạng **skeleton chạy được, kiến trúc hợp lý cho scale nhỏ**, nhưng **chưa sẵn sàng cho continuous dev** ở tiêu chuẩn frontend nội bộ. Blocker chính: **không có SDK super app thật** (chỉ bridge tự viết `window.flutter_inappwebview`), sai naming convention, thiếu docs/lint/CI, i18n hardcode, 1 test duy nhất, network context lấy từ `.env` thay vì session.

Tình trạng: **KHÔNG ổn để scale ngay**, cần 1 phase "hardening" trước khi mở song song nhiều feature.

## 1. Kiến trúc & scale

Điểm tốt:

- Tách lớp `app / entities / features / shared / mocks` theo Feature-Sliced-Design lite. Đúng hướng để scale.
- `shared/api/meshApi.ts` là seam duy nhất giữa mock và remote → dễ đổi backend.
- `shared/bridge/superAppBridge.ts` cô lập giao tiếp với WebView.
- Zod validate env (`shared/config/env.ts`).
- TanStack Query cho server state, hash router hợp cho WebView.
- Tất cả file < 200 dòng theo rule.

Vấn đề scale:

- **Feature slice quá phẳng**. Mỗi feature hiện chỉ 1 file `*.Page.tsx`. Khi thêm form/edit/detail/hooks → sẽ phình. Đề xuất chuẩn:
  ```
  features/wifi/
    ui/WifiPage.tsx
    ui/WifiBandRow.tsx
    model/useWifiConfig.ts
    api/wifi-api.ts        # optional, hoặc dùng shared/api
    lib/format-security.ts
    index.ts
  ```
- **Không có shared/lib/hooks**. Pattern `queryKey: ['network', env.VITE_DEFAULT_NETWORK_ID, ...]` lặp trong 6 page → nên có `useNetworkQuery(key, fn)` hoặc query-key factory.
- **`env.VITE_DEFAULT_NETWORK_ID` hardcode household** trong mọi page. Trên super app, network active phải từ session/bridge (household đang chọn của user). Cần `useActiveNetworkId()` bơm qua context.
- **Chưa có type-safe route**. Path viết tay 6 chỗ (`/clients/${id}`). Đề xuất `paths.ts` hoặc dùng `href` helper.
- **Bottom nav lệch với router** (3 tab hiện, 7 route). Không tới được Mesh/Health/Diagnostics ngoài tile ở Overview → điều hướng ngược không tự nhiên. Chốt lại IA.

## 2. Super App SDK — **blocker**

Rule VNPT (research doc, mục 3): "**Chuẩn package MiniApp (manifest, JS Bridge API, lifecycle) chưa chốt**. Flutter hay RN chưa chốt". Do đó hiện tại `superAppBridge.ts` **là placeholder** — gọi trực tiếp `window.flutter_inappwebview.callHandler` với 3 handler tự đặt (`miniapp.getSession`, `miniapp.close`, `miniapp.openNativeRoute`) mà super app **chưa cam kết**.

Rủi ro:

- Khi super app phát hành SDK/JS Bridge chính thức → phải viết lại toàn bộ auth/session/close/deep-link/telemetry.
- Không có token-exchange, không có scope theo "active household", không có analytics event, không có push handler, không có safe-area info, không có back-gesture contract.

Đề xuất trước khi code tiếp:

1. Hỏi VNPT: manifest MiniApp, JS Bridge spec, token exchange (partner API accessor), lifecycle event (`onShow`/`onHide`/`onBack`).
2. Wrap bridge hiện tại thành interface `SuperAppClient` với adapter `flutter-inappwebview` (dev) và `vnpt-superapp-sdk` (prod). Feature không được import bridge thô.
3. Thêm `SessionProvider` React context → cache access token + household id + locale + theme, tự refresh khi bridge notify.

## 3. Chuẩn frontend – rule check

Đối chiếu `~/.claude/rules/development-rules.md` và cấu trúc docs:

| Rule                                                                     | Trạng thái                                                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| File naming kebab-case JS/TS                                             | ❌ Toàn bộ file dùng PascalCase (`AppShell.tsx`, `OverviewPage.tsx`, `Card.tsx`, `StatusPill.tsx`, `ErrorBoundary.tsx`). Rule dự án là kebab-case. |
| File < 200 dòng                                                          | ✅                                                                                                                                                 |
| `./docs` structure (dev-roadmap, changelog, system-arch, code-standards) | ❌ Thiếu hoàn toàn thư mục `docs/`.                                                                                                                |
| `./plans` structure                                                      | ❌ Chưa có (mới tạo trong lần audit này).                                                                                                          |
| Lint trước commit                                                        | ❌ Không có ESLint / Prettier / `lint` script trong `package.json`.                                                                                |
| Test trước push                                                          | ⚠️ Có 1 test duy nhất (`tests/overview.test.tsx`), chưa cover mutation/error/routing.                                                              |
| Try-catch & security                                                     | ⚠️ `shared/api/client.ts` chỉ ném `Error(status text)`; không phân biệt 401/403/408/409 (ONE Link dùng 408=timeout, 409=offline theo doc).         |
| Không hardcode secret                                                    | ✅                                                                                                                                                 |
| Compile check sau khi sửa                                                | ⚠️ Không có script `lint`; `typecheck`/`test` chưa được chạy trong repo (chưa `npm install`).                                                      |

## 4. Chất lượng code cụ thể

**Correctness / an toàn:**

- `client.ts` gọi `superAppBridge.getSession()` mỗi request → mỗi lần round-trip qua Flutter. Cần cache session trong context, chỉ refresh khi hết hạn.
- `client.ts` không handle 401 refresh; không timeout; không AbortController; không retry theo TanStack (đặt `retry:1` global nhưng không phân biệt lỗi network vs 4xx).
- `meshApi.ts` không validate response bằng Zod → nếu backend đổi shape, UI vỡ silent hoặc render sai.
- `WifiPage` mutation ghép SSID cho **cả 2 band** cùng lúc với 1 input → sai UX; theo wireframe VNPT là đổi từng band.
- `updateWifi` `PATCH` gửi full config chứ không diff → dễ đè trường server đang cập nhật.
- `ClientDetailPage` không cover status `offline`, không có action (chặn/mở internet) — nhưng đây là gap M2 backend (ONE Link không có ACL) → phải chú thích trong code.
- Test `overview.test.tsx` không set `VITE_API_MODE`; mặc định `mock` nên may là pass. Không có `test.setup.ts`, không có `vitest.config` (dựa vào default Vite → thiếu `test.environment='jsdom'` khai báo tường minh).

**DRY / KISS:**

- 6 useQuery lặp pattern `queryKey: ['network', env.VITE_DEFAULT_NETWORK_ID, X]`. Tạo `networkKeys.overview()`, `networkKeys.wifi()`… factory.
- `StatusPill` label hardcode string tiếng Việt cùng chỗ với enum → khi thêm i18n phải sửa 2 nơi.

**Design system:**

- CSS tokens ở `global.css` là đúng hướng. Nhưng đang là single stylesheet 152 dòng có xu hướng phình. Chưa có dark mode / theme injection từ super app. Cần tách token file riêng (`tokens.css`) và component styles (`components.css`), hoặc chuyển sang CSS Modules / vanilla-extract khi feature tăng.
- `--radius`, colors, spacing dùng inline nhiều nơi ("18px", "14px") không dùng token → thiếu tính hệ thống.

**i18n:**

- Toàn bộ string tiếng Việt hardcode trong JSX/component. Miniapp phải theo `locale` từ super app (bridge trả `locale: 'vi-VN'` nhưng không được dùng). Cần `react-i18next` hoặc bundle string map ngay từ giờ để không phải refactor sau.

**Accessibility:**

- `icon-button` dùng ký tự "×" và "‹" thay icon → ổn với aria-label. Nhưng `action-tile__icon` để "Wi"/"M"/"D"/"H" chỉ là chữ → không có ý nghĩa, cần icon component thật.
- Bottom nav không có `aria-current` (react-router NavLink tự set `.active`, nhưng nên khai báo tường minh).

## 5. Setup / DX

- Không có `.editorconfig`, không có Husky/lint-staged, không có Github Actions.
- `vite.config.ts` không cấu hình alias `@` → import path dài dòng (`../../shared/…`). Nên thêm `resolve.alias`.
- `tsconfig` `strict: true` OK, nhưng thiếu `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` — nên bật để giảm bug runtime khi scale.
- `README` đã liệt kê API contract, nhưng không nói nơi lưu Docs (roadmap, changelog).

## 6. Rủi ro chưa xử lý so với spec VNPT

- Nhiều tính năng M1/M2 **không có API ONE Link** (đổi tên modem, chặn client, thống kê 7 ngày, uptime, lịch reboot/WiFi). MiniApp hiện chưa có chỗ đánh dấu "cần BE MyHome cung cấp" → dev dễ đâm vào tường sau. Nên khai báo capability flag ở API layer.
- ONT vs Mesh có schema khác nhau (adapter theo `modelName`) → `entities/network/types.ts` chưa phản ánh, ví dụ `MeshTopology` không có `optical`/`wanConfig`.
- Không có screen mua thêm Mesh (M2 – luồng OneBSS `tao_donhang_simso_v5`).
- Speed test hiện là mock đồng bộ; ONE Link `speedTest` có thể mất giây → cần polling/async.

## 7. Việc nên làm trước khi mở song song feature (đề xuất phase-0 hardening)

Ưu tiên P0 (chặn scale):

1. Chờ VNPT confirm JS Bridge / manifest → viết `SuperAppClient` interface + adapter, cung cấp qua `SessionProvider`.
2. Đổi toàn bộ filename sang **kebab-case** (rule dự án).
3. Chuyển network id sang session (`useActiveNetworkId`), bỏ `VITE_DEFAULT_NETWORK_ID` khỏi feature.
4. Zod validate response ở `meshApi` (schema per resource).
5. Query-key factory + `useNetworkQuery` hook.
6. Ném lỗi có type (`ApiError` với `code: 408|409|401|…`), map theo ONE Link.
7. Tạo `docs/` (system-architecture, code-standards, development-roadmap, project-changelog).
8. Thêm ESLint + Prettier + Husky + `lint`, `format`, `test:watch` scripts.
9. i18n scaffold (`src/shared/i18n/vi.json`), rút hardcoded strings.

Ưu tiên P1:

10. Alias `@/` trong `tsconfig` và `vite.config`.
11. Design tokens tách file, chuẩn bị dark mode.
12. Điều chỉnh IA: bottom nav 4-5 mục hoặc bỏ và dùng full-screen back stack.
13. Test coverage tối thiểu 60% (mock bridge, mutation, error state).
14. Github Actions: typecheck + test + build.

## 8. Câu hỏi mở

- Super app dùng SDK nào? (Có kênh chính thức để lấy manifest/JS Bridge spec chưa?)
- Household id / active network id lấy từ đâu — session hay `openNativeRoute` params?
- Locale/theme của super app có push xuống miniapp qua bridge không?
- WebView có cho `history` routing không, hay bắt buộc hash?
- Có kênh telemetry chuẩn (Amplitude/GA/nội bộ) super app expose không?
- MiniApp bundle chuẩn: `.vma` cho SmartScreen, còn cho MyHome mobile là gì?
