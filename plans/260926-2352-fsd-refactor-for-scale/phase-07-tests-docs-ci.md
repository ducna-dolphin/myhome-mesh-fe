# Phase 07 — Tests, docs/, CI

## Context Links

- [plan.md](./plan.md) · Rule: `~/.claude/rules/documentation-management.md`

## Overview

- Priority: P1 · Status: Done · Effort: 5h
- Chốt lưới an toàn: test helper chung, test mỗi page, docs kiến trúc + chuẩn code, pipeline CI.

## Key Insights

- Sau phase 2-4 đã có unit test cho seam; còn thiếu test render page, mutation, error state.
- Chưa có `docs/`. Người vào sau cần biết luật layer, cách thêm màn, cách thay adapter SDK.

## Requirements

- `renderWithProviders()` dùng chung, inject adapter super-app giả được.
- Mỗi page: 1 test success + 1 test error. Feature: test mutation thành công + thất bại.
- Coverage ≥ 70% lines cho `src/shared/**` và `src/entities/**`; ≥ 60% toàn repo. Ngưỡng cấu hình trong vitest.
- CI chạy trên mỗi PR + push `main`: lint, typecheck, test+coverage, build.

## Architecture

```
src/shared/test/
├── setup-tests.ts
├── render-with-providers.tsx   # QueryClient(retry:false) + SessionContext + i18n + MemoryRouter / createMemoryRouter
└── fake-super-app-client.ts    # adapter giả, ghi lại lời gọi close/openNativeRoute/track
docs/
├── system-architecture.md      # layer FSD, 4 seam, provider tree, luồng data (mermaid), chiến lược mock
├── code-standards.md           # đặt tên, luật import, public API, cách thêm page/feature/entity, i18n, checklist review
├── super-app-integration.md    # interface SuperAppClient, cách viết adapter SDK VNPT, câu hỏi mở
├── development-roadmap.md      # phase refactor + M1/M2 + mục ngoài phạm vi của plan này
└── project-changelog.md
.github/workflows/ci.yml
```

`ci.yml`:

```yaml
on: { pull_request: {}, push: { branches: [main] } }
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build
```

Nếu repo dùng GitLab VNPT → chuyển sang `.gitlab-ci.yml` cùng 4 bước (câu hỏi mở trong plan.md).

## Related Code Files

- Create: 3 file test helper, test cho 7 page + 2 feature, 5 file docs, `.github/workflows/ci.yml`
- Modify: `vite.config.ts` (coverage thresholds), `README.md` (rút gọn, trỏ sang docs/), test đã viết ở phase 2-5 chuyển sang dùng `renderWithProviders`

## Implementation Steps

1. `fake-super-app-client.ts` + `render-with-providers.tsx`.
2. Refactor test hiện có dùng helper.
3. Viết test page (success/error — error bằng cách `vi.spyOn(entityApi, 'getX').mockRejectedValue(new ApiError('device-offline', 409, ''))`).
4. Test feature: update-wifi-ssid (thành công → cache cập nhật; thất bại → form giữ nguyên và không đóng), run-speed-test (thành công → hiện kết quả; thất bại → quay về trạng thái idle).
5. Test AppShell: ở `/` bấm nút → `fakeSuperApp.close` được gọi; ở màn con → quay lại.
6. Coverage thresholds; chạy `npm run test:coverage`.
7. Viết docs (≤ 800 dòng mỗi file). `code-standards.md` có mục "Thêm một màn mới trong 5 bước".
8. README: chạy dự án, scripts, link docs.
9. `ci.yml`; push branch, kiểm tra pipeline xanh.

## Todo List

- [x] test helper + fake super-app
- [x] test 7 page
- [x] test 2 feature + AppShell
- [x] coverage thresholds đạt
- [x] docs/ 5 file
- [x] README cập nhật
- [x] CI xanh

## Success Criteria

- `npm run test:coverage` đạt ngưỡng.
- Pipeline CI xanh trên PR.
- Dev mới đọc `docs/code-standards.md` thêm được 1 màn mà lint không báo lỗi.

## Risk Assessment

- Test page phụ thuộc text tiếng Việt → query theo `role` + text từ i18n key khi có thể.
- Coverage ép quá cao làm dev viết test rác → giữ 60/70%, không ép 90%.

## Security Considerations

- CI không cần secret. Không commit `.env`. Bật Dependabot/`npm audit` ở roadmap.

## Next Steps

- Sau plan: sửa bug đổi SSID theo band, chốt IA, adapter SDK VNPT khi có spec, bắt đầu feature M1.

## Validation status

- GitHub Actions workflow is green on PR #3: `npm ci`, format check, lint, typecheck, coverage tests and build all passed.
- Test suite: 13 files / 47 tests passed.
- Overall coverage: 88.77% statements and lines, 82.8% branches, 83.33% functions; all configured 60/70% thresholds passed.
- Production build completed successfully with Vite page chunking intact.
- SessionProvider now has explicit coverage for getSession failure, missing networkId, and locale application.
- The diagnostics page has no independent read-query error state; its mutation failure is covered at the `run-speed-test` feature level to preserve existing product behavior.
- Mutation-error UI remains a roadmap item instead of changing Phase 05 behavior during a test/CI phase.
