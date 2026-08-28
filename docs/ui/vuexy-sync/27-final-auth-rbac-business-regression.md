# 27 — Final Auth/RBAC/Business Regression (Part 5)

## 1. Lượt regression toàn hệ thống tại checkpoint Part 5

| Lệnh | Kết quả |
|---|---|
| `yarn install --frozen-lockfile` | PASS (lockfile nhất quán sau cleanup deps) |
| `yarn format:check` | PASS |
| `yarn lint` | 0 error (warnings có sẵn, không loại mới) |
| `yarn typecheck` | PASS |
| `yarn test` | **138 files / 999 tests PASS** (+ui-state-canonical mới; −4 test theo entry manifest/adapter đã xoá) |
| `yarn test:coverage` | PASS — Statements 44.46%, Branches 43.46%, Functions 36.58% (mức nền có sẵn, không threshold-gate trong repo) |
| `yarn build` + `yarn health:check` | PASS |
| `yarn check:api-mapping` | PASS — 56 documented rows (4 fail-closed đúng chủ đích) |
| `yarn ui:guards` (4 guard + 4 self-test) | PASS |
| `yarn test:e2e` toàn bộ project (`--retries=1 --workers=4`, MỘT lượt 30.9m) | **266 passed · 2 flaky (sweep 390/1920 — pass khi retry trong cùng run, IO cục bộ) · 9 skipped (6 live-BE + 1 real-env + 2 device-gating tường minh) · 0 failed** |

## 2. Auth/session/refresh/logout

Không sửa dòng nào trong `src/shared/api/**`, auth service/store/interceptor ở Part 5. Bằng chứng hành vi: wwhn-165 (limited nav + session), wwhn-325 ×2 (offline guard qua UI login thật), E2E auth mock contract (refresh/me) chạy trong mọi spec — PASS lượt chốt.

## 3. RBAC / direct URL / API 403

- Route-guard: 403 direct-URL fail-closed ở mọi module QA2 (178/217/242/248/292/flow04); SEC-RBAC-01 đóng từ Part 4a (wwhn-212:301 chuyển từ FAIL-baseline sang PASS và giữ PASS).
- Action-gating theo quyền + hook `data-ui-state=disabled` (ActionButton — test canonical mới siết đúng ngữ nghĩa "khóa vì quyền").
- API 403/409/412/422/428: ma trận wwhn-242 ×5 + 258 + 327 + 211/212 — PASS.
- PII §13.8: mask bảng/modal/export + reason-gate (248/258) — PASS.

## 4. Business flows

Inbound/outbound/inventory/warranty/reversal/report/scan: pin-suites (flow06 packing-label, wwhn-195 scan-mode, wwhn-240 net-effect, wwhn-242 evidence-gate/append-only, wwhn-258 export idempotency) + QA2 evidence specs — PASS lượt chốt. Part 5 KHÔNG chạm service/mutation nào (diff chỉ gồm PvAdminPage UI-layer, guard scripts, tests, docs, CI, deps).

## 5. PWA/offline

wwhn-325-pwa-offline + business-offline PASS; `pwa-status.css` token-hoá từ Part 4 không đổi hành vi.

## 6. Kết luận

Auth/session/RBAC/API/business/PWA **không regression** tại checkpoint cuối; mọi khác biệt hành vi user-visible là có chủ đích và đã ghi hồ sơ (doc 22 §4). Bộ chống tái phát: doc 29.
