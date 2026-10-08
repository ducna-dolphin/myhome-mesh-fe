# Phase 01 — Tooling & lint foundation

## Context Links

- [plan.md](./plan.md) · [audit §3, §5](../reports/reviewer-260926-2319-frontend-audit.md)

## Overview

- Priority: P0 · Status: Done · Effort: 4h
- Dựng tooling để các phase sau được kiểm tra tự động. Chưa đụng code nghiệp vụ.

## Key Insights

- Repo chưa `npm install` lần nào → chưa có `package-lock.json`. CI (phase 7) cần lockfile.
- Không có `vitest.config`; test đang dựa vào default → khai báo `jsdom` tường minh.
- Rule boundaries + kebab-case sẽ **fail trên cấu trúc cũ** → cài và cấu hình ở phase này nhưng để `off`/`warn`, bật `error` ở cuối phase 5.

## Requirements

- `npm run lint`, `npm run format`, `npm run typecheck`, `npm test`, `npm run build` đều chạy được và xanh.
- Import dạng `@/shared/...` hoạt động ở Vite, TS, Vitest.
- Pre-commit chạy lint + prettier trên file staged.

## Architecture

Dev deps thêm:

```
eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
eslint-plugin-boundaries eslint-plugin-check-file eslint-config-prettier
prettier husky lint-staged @vitest/coverage-v8
```

`eslint.config.js` (flat config) — các khối:

1. `@eslint/js` recommended + `typescript-eslint` recommended + react-hooks + react-refresh.
2. `boundaries/elements` khai báo layer theo pattern `src/{app,pages,features,entities,shared}/*`; rule `boundaries/element-types` cho phép:
   - app → pages, features, entities, shared
   - pages → features, entities, shared
   - features → entities, shared
   - entities → shared
   - shared → shared
     Mức: `warn` (phase 5 đổi `error`).
3. `no-restricted-imports`: cấm deep import `@/{pages,features,entities}/*/*` (chỉ qua `index.ts`). Mức `warn`.
4. `check-file/filename-naming-convention` `**/*.{ts,tsx}` → `KEBAB_CASE`; `check-file/folder-naming-convention` `src/**/` → `KEBAB_CASE`. Mức `warn`.
5. `no-restricted-properties`: cấm `window.flutter_inappwebview` ngoài `src/shared/super-app/adapters/**`. Mức `error` ngay (chỉ file bridge cũ vi phạm → thêm override tạm cho `src/shared/bridge/**`, xoá ở phase 2).
6. `eslint-config-prettier` cuối cùng.

`tsconfig.app.json` thêm:

```json
"baseUrl": ".", "paths": { "@/*": ["src/*"] },
"noUncheckedIndexedAccess": true, "noImplicitOverride": true, "noFallthroughCasesInSwitch": true
```

Bỏ `vitest/globals` khỏi `types` nếu không dùng globals (test hiện import từ `vitest`).

`vite.config.ts`: `resolve.alias: { '@': path.resolve(__dirname, 'src') }` + khối `test`:

```ts
test: { environment: 'jsdom', setupFiles: ['./src/shared/test/setup-tests.ts'], css: false,
        coverage: { provider: 'v8', include: ['src/**'], exclude: ['src/**/*.test.*', 'src/main.tsx'] } }
```

(dùng `defineConfig` từ `vitest/config`).

## Related Code Files

- Modify: `package.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `.gitignore` (thêm `coverage/`)
- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.husky/pre-commit`, `src/shared/test/setup-tests.ts`, `package-lock.json` (sinh ra)
- Delete: không

## Implementation Steps

1. `npm install` (sinh lockfile), kiểm tra `npm test` + `npm run build` xanh trên code hiện tại → baseline.
2. Cài dev deps ở trên.
3. Viết `eslint.config.js`, `.prettierrc.json` (`singleQuote`, `printWidth: 110`, `trailingComma: all` — khớp style hiện có).
4. Thêm scripts: `lint`, `lint:fix`, `format`, `format:check`, `test:watch`, `test:coverage`, `prepare: husky`.
5. `lint-staged` trong `package.json`: `*.{ts,tsx}` → `eslint --fix`, `prettier --write`; `*.{css,json,md}` → `prettier --write`.
6. Alias `@` ở tsconfig + vite. `setup-tests.ts` import `@testing-library/jest-dom/vitest`, bỏ import đó trong `tests/overview.test.tsx`.
7. Bật strict flags mới, sửa lỗi TS phát sinh (dự kiến ít: truy cập mảng `bands[0]` đã có `?.`).
8. Chạy `npm run format` một lần cho toàn repo (commit riêng trong phase này để diff các phase sau sạch).
9. Chạy lint/typecheck/test/build → xanh (cho phép warning boundaries/kebab).

## Todo List

- [x] npm install + baseline xanh
- [x] eslint.config.js + prettier + editorconfig
- [x] scripts + husky + lint-staged
- [x] alias `@` + vitest config + setup-tests
- [x] strict TS flags
- [x] format toàn repo
- [x] lint/typecheck/test/build xanh

## Success Criteria

- 5 lệnh ở Requirements xanh. `git commit` kích hoạt lint-staged.
- `npm run lint` liệt kê warning boundaries/kebab-case ở code cũ (đó là danh sách việc của phase 5).

## Risk Assessment

- Version plugin không tương thích ESLint 9 flat config → pin version, kiểm tra `eslint-plugin-boundaries` ≥ 5.
- Prettier format toàn repo làm diff lớn → tách commit `style: apply prettier`.

## Security Considerations

- Không thêm secret. `.env` đã ignore; kiểm tra `.gitignore` còn `.env`.

## Next Steps

- Phase 02 dùng alias `@` và rule cấm `flutter_inappwebview`.
