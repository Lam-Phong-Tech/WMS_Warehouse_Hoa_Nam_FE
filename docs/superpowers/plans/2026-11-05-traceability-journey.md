# Traceability journey implementation plan

> Use subagent-driven-development for backend and focused UI tasks, followed by independent review.

Goal: Implement the nine Desktop/Tablet reference scenarios approved in chat, retain approved unframed 48px filters and removed header clutter, and push reviewed changes to dev in both repositories.

Architecture: Add a scoped goods-trace read model alongside the existing movement ledger. Build a report UI using its authorized events and entity snapshots. Export the exact filtered read result with user-selected content; never infer live stock from historical movements.

Spec: All 18 PNGs in Hoa_Nam_UIUX_V2/baocao_truyvethanghoa and the accepted gap report in this chat.

Constraints: Reuse existing permissions, warehouse scopes and UI tokens. Do not write inventory. Do not fabricate completeness/stock numbers. Separate recognized-empty, unknown code, partial data and API failures. Preserve unrelated dirty files. Latest origin/dev is the integration base.

- [x] Backend: scoped /reports/goods-trace endpoint, real stock/nonstock events, resolution/entity snapshots, BOX/TRAY relations and source details; regression tests.
- [x] Frontend: overview, serial and BOX/TRAY profiles, event detail/source navigation, export dialog, empty/partial/error states; behavior tests.
- [x] Verify: typecheck, build, focused FE and BE tests, responsive browser QA, independent code review.
- [ ] Integrate only chat-owned report files; fetch/reconcile and push HEAD:dev without force in both repositories; verify remote SHAs.

Review focus: scope isolation; no double-count of movement/nonstock events; no fake current state/completeness; exact export filters; old approved UI changes preserved.
