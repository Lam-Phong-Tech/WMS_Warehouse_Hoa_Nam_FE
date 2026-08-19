# WWHN-325 — Local exact-SHA gate manifest (đóng FE325-P1-11/P1-12)

Ngày chạy: 2026-08-19 (UTC). Người chạy: FE1 (máy dev cục bộ, không dùng GitHub Actions).

## Pin nguồn (FE325-P2-03 / P2-04)

- Repo: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`, branch canonical: `m1`.
- **Final reviewed candidate (frozen, QA2 đã test): `5cc27970d36edd2063fd3ce4181d2108dd0077d0`** — chứa implementation + Chromium/PWA evidence gate.
- Implementation ancestor: `651d037569ac8beb1f2440475f96ec66982f826c` (KHÔNG phải final reviewed build).
- **Evidence-extension candidate (test-only, đóng FE325-P1-12): `3cc524f82f860218d199756aebedf07025fef1f3`** — commit-cuối-chạm-artifact của bề mặt PWA; chỉ thêm test/evidence, không đổi production code.
- Gate SHA (nơi chạy bộ gate dưới đây): `a43967e42b087a17ef6d23c205048431a212774d`.
- BE pairing: `0a7bd392f4510f3ad5d5be7394173695463f2b6e` (`Cache-Control: no-store, private` cho `/api/*`).

## Bất biến dải commit (chống pin rot)

- `5cc27970..3cc524f` (145 commit): bề mặt production PWA (`public/service-worker.js`, `public/manifest.webmanifest`, icons, `src/shared/pwa/offline-policy.ts`, `register-pwa.ts`, `pwa-status.css`, `src/shared/api/http.ts`, `index.html`) **0 diff**, trừ:
  - `src/shared/pwa/PwaStatus.tsx`: chỉ tách dòng JSX (text render không đổi — được khoá lại bằng `PwaStatus.test.tsx` tại 3cc524f);
  - `src/shared/api/axios.ts`: (1) reformat khối guard offline (logic y nguyên), (2) bổ sung additive xử lý 429 rate-limit ở RESPONSE path thuộc WWHN-289 (đã review trong register WWHN-289) — không chạm request-interceptor guard của WWHN-325.
- `3cc524f..a43967e` (2 commit): chỉ chạm `docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json` (WWHN-311 refresh digest LF) và `scripts/run-wwhn-296-evidence.mjs` (WWHN-296) — **0 diff** trên bề mặt PWA và spec e2e WWHN-325.
- BE `0a7bd392..HEAD`: `NoStoreApiResponses` chỉ refactor hằng số `CACHE_CONTROL = 'no-store, private'` (WWHN-295) — chính sách không đổi.

## Fingerprint mức đối tượng tại candidate 3cc524f (git blob SHA)

```
4796de1184a87f4c04bd419d05d74f54a6d6992e  public/service-worker.js
608c847a37cc3105afeda6bd4a9303fc671727de  public/manifest.webmanifest
3f4835d770f0c89341676a694530441025b78286  src/shared/pwa/offline-policy.ts
89b6976e0d00833d6abf4a718ae713f46db79b23  src/shared/pwa/register-pwa.ts
b19248c166db0f7001e678c58b5fdcf7aa856ae7  src/shared/pwa/PwaStatus.tsx
a200b062010a1c3f609058a6430acf68bb6e4810  src/shared/api/axios.ts
b9c0cb5dc45fe555a3b21067dbfa667a02b05899  e2e/wwhn-325-pwa-offline.spec.ts
5b8f5947d51fffa482ed02ce5d88510981d2ea9d  src/shared/pwa/wwhn-325-offline-flows.test.ts
61eaf4d79f4c17a4f7433a8d274800f48e0ea6af  src/shared/pwa/PwaStatus.test.tsx
```

Kiểm chứng lại: `git rev-parse 3cc524f:<path>` phải ra đúng giá trị trên.

## Môi trường & identity

- Windows 11 (10.0.22631), Node v22.17.1, npm 10.9.2, Playwright 1.62.1 (Chromium, device Desktop Chrome).
- Chạy trong **git worktree sạch** tại gate SHA (`git status --porcelain` rỗng ngoài input materialized) — tree chính đang có phiên song song nên không dùng làm identity.
- Input materialized (gitignored, không phải source): `.env` (runtime config) và `swagger-api.json` (contract artifact sync từ BE checkout pin theo thủ tục WWHN-296 `contract:sync`).
- `node_modules` dùng junction từ checkout canonical (không ảnh hưởng identity nguồn).

## Kết quả gate (raw log trong `logs/`, mỗi log tự ghi gate_sha + exit_code)

| Gate | Lệnh | Kết quả |
|---|---|---|
| Format | `npm run format:check` | exit 0 — `logs/format-check.log` |
| Lint | `npm run lint` | exit 0 (0 error) — `logs/lint.log` |
| Typecheck | `npm run typecheck` (`tsc -b`) | exit 0 — `logs/typecheck.log` |
| Unit/integration | `npm run test` (vitest) | exit 0 — **96 file / 769 test PASS** — `logs/unit-vitest.log` |
| Production build | `npm run build` | exit 0 — `logs/build.log` |
| PWA runtime e2e | `playwright test e2e/wwhn-325-pwa-offline.spec.ts --project=chromium --trace on` | exit 0 — **4/4 PASS** — `logs/e2e-pwa-offline.log`, trace đầy đủ trong `traces/` |

Ghi chú trung thực về các lượt chạy trước khi xanh (không giấu):
1. Lượt worktree đầu (tại 3cc524f) unit 767/769: 2 fail đều là lỗi môi trường clean-checkout kế thừa, không thuộc WWHN-325 — (a) digest wireframe trong governance register tính từ bản CRLF cũ (đã fix bởi WWHN-311 tại `5a3221a`), (b) `swagger-api.json` gitignored không tồn tại trong checkout sạch (đã fix quy trình bởi WWHN-296 tại `a43967e`). Gate được chạy lại tại `a43967e` → 769/769.
2. Lượt e2e đầu fail test offline-banner vì worktree thiếu `.env` (app không boot UI) — không phải lỗi code; sau khi materialize `.env` → 4/4 PASS.

## Disposition CI (FE325-P1-11)

- **DEC-325-CI-LOCAL-01**: GitHub Actions của org đã dùng hết quota 3.000/3.000 phút chu kỳ hiện tại; theo chỉ đạo vận hành, KHÔNG dispatch thêm bất kỳ workflow nào (kể cả `exact-sha-evidence.yml`). Gate độc lập được thay bằng **local exact-SHA gate có identity** (worktree sạch + gate_sha ghi trong từng raw log + fingerprint mức đối tượng ở trên) — cùng tập lệnh với workflow CI (format/lint/typecheck/unit/build + Chromium PWA e2e), theo tiền lệ WWHN-292 (identity local thay CI).
- Placeholder `[CI RUN/ARTIFACT THỰC TẾ]` trong comment DevOps 15586 được disposition bằng evidence pack này (retrievable trong repo) thay vì run URL. Khi quota CI mở lại, có thể dispatch `exact-sha-evidence.yml` với `source_sha=3cc524f82f860218d199756aebedf07025fef1f3` để bổ sung artifact CI mà không thay đổi kết luận.

## Mapping FE325-P1-12 → bằng chứng

Xem bảng "Automated evidence mapping" trong `docs/evidence/WWHN-325_PWA_CACHE_POLICY.md` (cùng candidate). Tóm tắt: receipt/issue/reversal chặn ở flow thật + adjustment disposition WWHN-236 DEFERRED (unit `wwhn-325-offline-flows.test.ts`); no-network/no-queue/no-replay + SW update flow runtime (e2e, trace kèm theo); nửa UI update flow (`PwaStatus.test.tsx`).

## SHA256SUMS

`SHA256SUMS` trong thư mục này liệt kê digest của toàn bộ log/trace; refresh bằng lệnh ghi ở đầu file đó trước khi commit thay đổi evidence.
