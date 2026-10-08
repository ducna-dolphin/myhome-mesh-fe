# Code Review: diagnostics speed-test (uncommitted, feat/diagnostics-speedtest-wireframe)

## Scope
- Files: run-speed-test (api, index, model x3, ui x4 + css), diagnostics-page, shared/ui page-title x2 + index, app-shell, global.css, vi/network.json, changelog. Tests ignored.
- Typecheck: pass. Lint: pass for reviewed files (2 unused-var errors only in speed-test-panel.test.tsx, owned by tester).

## Overall
Solid. Hook logic is correct under StrictMode and abort. No critical or high issues. The main problems are a11y claims that don't match the code, misleading error attribution, and duplicated title logic.

## Verified OK (no action)
- StrictMode double mount: effect 1 runs startCheck, cleanup aborts controller 1, effect 2 calls reset() and mutate(signal2). TanStack v5 `MutationObserver.mutate` detaches the previous mutation before building the new one, so the AbortError from run 1 never reaches observer state or the UI. `mutate()` swallows rejections, so there is no unhandled rejection. Mutations default to retry 0.
- Unmount mid-flight: abort → rejected mutation with no observer → nothing rendered. Timers are cleared.
- http-client rethrows the caller's AbortError (line 94) and does not map it to a 'timeout' ApiError. Correct.
- Restart race: the retry buttons only render in the success/error phases, so no request is in flight when they are pressed.
- `mutate` and `reset` are stable, so the mount effect does not re-fire.
- i18n: every t() key exists in vi/network.json, the old keys were removed with no remaining references, and there are no orphans.
- FSD: app → shared, page → feature public API, feature → shared. No violations.
- `--icon-muted` #667085 on white is 4.8:1, which passes the 3:1 non-text contrast rule (the old #98a2b3 was 2.5:1).
- Reduced motion: `.diagnostics *, *::after` with !important covers every animation and transition (no ::before is used).

## Medium
1. **Focus ring contrast fails WCAG 1.4.11 / 2.4.13**: global.css:53. rgb(22 119 255 / 35%) on white is about #AECFFF, roughly 1.6:1 against the page. Keyboard users may not see focus. Fix: `outline: 2px solid var(--brand)` (#1677ff is about 4:1), offset 2px.
2. **Changelog claims "screen-reader step announcements" but steps are not announced**: speed-test-panel.tsx:44-59 / speed-test-rows.tsx:21. The per-step sr-only labels sit in the `<ol>`, which is outside the only aria-live region. The live region (.diagnostics-status-copy) announces only the heading change (running → complete/failed). Fix: either make a live region hold the current step (e.g. an sr-only `<p aria-live="polite">{stepAccessibleLabel(active)}</p>`) or change the changelog wording (docs/project-changelog.md:12).
3. **Error blamed on whichever step the fake timer reached**: use-speed-test-check.ts:54-65. Steps are presentational timers, but in the error phase `step === activeStep` shows 'error'. Example: a 401/500 returned at 2.5s shows "Kết nối Internet: Không thể kiểm tra", and an error before 900ms blames "Thiết bị của bạn". Users get wrong diagnostic information. Fix: in the error phase, leave the unreached steps as 'waiting' (drop the 'error' step state) until the backend reports per-step progress. The TODO already notes this.
4. **Title logic duplicated and inconsistent**: diagnostics-page.tsx:7-13 vs speed-test-panel.tsx:61-67. Both pick a title from phase, but success shows "Kết quả kiểm tra" in the header and "Hoàn tất" in the h2. On error, the header, h2 and ErrorState all say failure. This needs `onPhaseChange`, page state and the exported `SpeedTestPhase` type. Simpler (KISS): call `usePageTitle(...)` inside SpeedTestPanel (a feature may import shared), then delete the page state, the callback prop and the type export. Or keep lifting but share one `phase → titleKey` map.

## Low
5. **Stale title can flash for a frame on navigation**: page-title-context.ts:16. Clearing the override in a passive-effect cleanup runs after the new route has committed and painted. React Router v7 navigations run in transitions and back uses popstate, so the next page can paint once with "Kết quả kiểm tra". The same happens in reverse on mount (route title first, then "Đang kiểm tra"). Fix: `useLayoutEffect` in usePageTitle.
6. **Safari/WKWebView drops list semantics when `list-style: none`**: speed-test-panel.css:6-11. The super-app runs in a webview, so `<ol aria-label>` may not be exposed as a list and the label is lost. Fix: `role="list"` on the ol/ul. The aria-hidden separator `<li>`s are fine (they are pruned from the a11y tree), but CSS pseudo-elements between steps would avoid fake list items.
7. **Error announced twice**: the live h2 "Kiểm tra thất bại" plus ErrorState `role="alert"`. Acceptable, but you could skip the h2 change in the error phase or pass `message` to ErrorState.
8. **`--icon-muted` duplicates the `--text-muted` value**: global.css:20. Use `--icon-muted: var(--text-muted);` so they cannot drift, or just use --text-muted (YAGNI).
9. **Sticky hover on touch**: speed-test-panel.css:233 `.diagnostics-retry:hover` stays highlighted after a tap on mobile. Wrap it in `@media (hover: hover)` or drop it (`:active` already exists).
10. **Specificity bump**: `.diagnostics .diagnostics-steps` (css:34) exists only to beat `.diagnostics ol { margin:0 }`. It works but is fragile. Scope the reset as `.diagnostics :where(ol, ul)` (zero specificity) and use a plain `.diagnostics-steps`.
11. **AbortSignal passed as mutation variables**: use-run-speed-test.ts:7. It works, but the signal is stored in `mutation.state.variables` (it shows in devtools and is not serializable). Acceptable; add a short comment.
12. **Mock mode ignores the signal**: withMock's mock does not receive or honor it. This has no effect on behavior because the observer is detached, so it's just a note.

## File size
- All TS/TSX files are under 200 lines (panel 131, hook 76).
- speed-test-panel.css is 270 lines. That's acceptable: it's declarative, single-purpose and colocated, and the 200-line rule targets code files. If you want to split it, the natural cut is steps/progress vs checklist/results.
- Moving the diagnostics CSS out of global.css into the feature is a good change.

## Positive
- The hook cleanly separates the timers, abort and min-duration logic from the UI, and the min-duration no longer delays errors.
- Icons and rows are split into small files, and the reduced-motion handling is consolidated.
- The progressbar is correctly indeterminate (no valuenow) and is removed outside the running phase.

## Recommended actions (priority)
1. Increase focus-ring contrast (#1).
2. Stop assigning errors to steps (#3).
3. Make step announcements real or fix the changelog (#2).
4. Move usePageTitle into the panel, or share one title map (#4); use useLayoutEffect (#5).
5. Optional: role="list" (#6), alias the token (#8), hover media query (#9).

## Unresolved questions
- Is the success-state mismatch (header "Kết quả kiểm tra" vs h2 "Hoàn tất") intended by the wireframe?
- Should an error honor the 3s minimum too, so the steps don't jump straight to failed?
