# Phase 06 — i18n scaffold

## Context Links

- [plan.md](./plan.md) · [audit §4 i18n](../reports/reviewer-260926-2319-frontend-audit.md)

## Overview

- Priority: P1 · Status: Done · Effort: 3h
- Rút toàn bộ chuỗi hiển thị ra file resource, locale lấy từ session super app. Hiện chỉ có `vi`.

## Key Insights

- Session đã trả `locale` nhưng chưa dùng.
- Chuỗi nằm ở: 7 page, 2 feature, AppShell, ScreenState, ErrorBoundary, status-presentation, ApiError message map, route `handle.title`.
- Làm bây giờ khi mới ~150 chuỗi rẻ hơn nhiều so với lúc có M2/M3.

## Requirements

- Key có type-check (gõ sai key → lỗi TS).
- Locale theo `session.locale` (`vi-VN` → `vi`), fallback `vi`.
- Không tải resource qua mạng (bundle sẵn, WebView có thể offline).
- Text hiển thị giữ nguyên 100%.

## Architecture

```
src/shared/i18n/
├── i18n-instance.ts          # i18next.init({ resources, lng, fallbackLng: 'vi', interpolation: { escapeValue: false } })
├── locales/vi/common.json    # nav, state, error, status
├── locales/vi/network.json   # overview, wifi, mesh, clients, health, diagnostics
├── i18next-resources.d.ts    # module augmentation CustomTypeOptions → typed keys
└── index.ts                  # export i18n, useTranslation
src/app/providers/i18n-provider.tsx   # đồng bộ i18n.changeLanguage(session.locale)
```

Namespace theo nhóm chức năng (`common`, `network`); thêm `camera`, `security` khi có module mới — mỗi module 1 file, tránh 1 JSON khổng lồ.

Quy ước key: `<màn>.<khối>.<nghĩa>` ví dụ `wifi.form.ssidLabel`, `common.state.loading`. Plural dùng suffix i18next (`clients.count_one`, `clients.count_other`).

Chuỗi ngoài React (ApiError message map, route title) → lưu **key**, dịch tại chỗ render (`t(handle.titleKey)`).

## Related Code Files

- Create: các file trong cây trên
- Modify: 7 page, 2 feature, `app-shell.tsx`, `app-router.tsx` (`handle.titleKey`), `screen-state.tsx`, `error-boundary.tsx` (dùng `i18n.t` vì là class component), `entities/*/lib/*-presentation.ts`, `package.json` (thêm `i18next`, `react-i18next`)

## Implementation Steps

1. Cài `i18next react-i18next`.
2. Tạo instance + file JSON + khai báo type.
3. `I18nProvider` trong `SessionProvider` (cần locale).
4. Rút chuỗi từng file, thay bằng `t('...')`. Làm theo thứ tự: shared/ui → entities presentation → features → pages → app.
5. Thêm ESLint rule nhẹ `react/jsx-no-literals` **không** bật (nhiễu với ký tự `›`, `·`); thay bằng review checklist trong code-standards.
6. Test `setup-tests.ts` import `@/shared/i18n` để test render text tiếng Việt như cũ.
7. lint/typecheck/test/build xanh; so sánh 7 màn thủ công.

## Todo List

- [x] cài deps + instance + typed keys
- [x] I18nProvider theo session.locale
- [x] rút chuỗi shared/ui + entities
- [x] rút chuỗi features + pages
- [x] route titleKey + AppShell
- [x] ErrorBoundary + ApiError message
- [x] test xanh, text không đổi

## Success Criteria

- `grep -rP '[À-ỹ]' src --include=*.tsx --include=*.ts` chỉ còn trong `locales/` và `*-mock.ts`.
- Test cũ (tìm text tiếng Việt) vẫn pass không sửa assertion.

## Risk Assessment

- Bundle tăng ~15KB gzip → chấp nhận; nếu super app giới hạn size chặt thì thay bằng dictionary tự viết (API `t()` giữ nguyên).

## Security Considerations

- `escapeValue: false` an toàn vì React đã escape; cấm dùng `Trans` với HTML từ nguồn ngoài.

## Next Steps

- Phase 07 dùng provider đầy đủ trong `renderWithProviders`.

## Validation status

- GitHub Actions passed format, lint, typecheck, coverage tests and production build on PR #3.
- Test suite: 13 files / 47 tests passed.
- Overall line coverage: 88.77%; configured global/shared/entities thresholds all passed.
- Existing Vietnamese assertions still pass after moving production copy into bundled resources.
- Resources are bundled locally; `vi-VN` / `vi_VN` normalize to `vi`, with Vietnamese fallback for unsupported locales.
- Final visual comparison of the seven screens remains part of reviewer smoke testing, but no product behavior or intended visible copy was changed by this phase.
