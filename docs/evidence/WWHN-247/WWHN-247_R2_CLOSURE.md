# WWHN-247 — Đóng register vòng R2 (review 89/100, "Đạt yêu cầu")

| Trường | Giá trị |
|---|---|
| Ngày | 19/08/2026 |
| Review input | 89/100 — Đạt yêu cầu; register FE247-P1-01..04, FE247-P2-01..02 |
| Nhánh | `m1` — canonical duy nhất (xem §FE247-P2-01) |
| Hồ sơ vòng trước (77/100) | `WWHN-247_CLOSURE_REGISTER.json` — giữ nguyên làm historical trace |

## Candidate R2 (đóng FE247-P1-04)

Bất biến pin của candidate cũ `59c4b16` **đã vỡ đúng như thiết kế**:
`git diff --stat 59c4b16..HEAD -- src/modules/warranty src/test/wwhn-247-warranty-closure.test.ts`
ra 2 file — (1) `types/index.ts` bị `c9f52df` (WWHN-244 P1-07) xoá 2 field chết
`consent_contact`/`consent_photo`; (2) closure test bị `ce17940` (WWHN-252) sửa escape
chuỗi trong tên describe. Cả hai lành tính nhưng theo đúng luật pin, **toàn bộ QA đã chạy lại**
trên candidate mới:

| Đối tượng | SHA (40 ký tự) |
|---|---|
| FE candidate warranty-scope (commit cuối chạm phạm vi) | `c9f52df44638558cc3c2e08807e05a9d05f689c8` |
| FE HEAD lúc chạy toàn bộ QA R2 | `ebdb061098bea9426c2949e5c50b53ba8a09289f` |
| Bất biến dải FE (phải rỗng — đã kiểm 19/08) | `git diff --stat c9f52df..ebdb061 -- src/modules/warranty src/test/wwhn-247-warranty-closure.test.ts scripts/verify-wwhn-247-closure.mjs src/test/warranty-v17-fail-closed.test.ts` = rỗng |
| BE HEAD lúc chạy | `4a6965b5d432947c497a2c3370a62a17907251a3` |
| BE commit cuối chạm artifact warranty | `0142b49ed11ac410136ca96993b3fb6ca2ac2971` (WWHN-234 — refactor import ParityTest + đồng bộ bản sao unrouted; ma trận không đổi, chứng minh bằng ParityTest PASS bên dưới) |
| Candidate hành vi gốc của WWHN-247 (không đổi) | FE `59c4b16883d64081c8cf150e0df74f90b1d5a8fc` · BE `08abf3f95f9e83be3bc9efe1258fd5f3ea5baa9e` |

**Build/test log tại candidate R2 (19/08/2026, toàn bộ local — không đụng GitHub Actions):**

```
npm run build                       → PASS (vite build 16.86s + build-manifest)
npx vitest run <warranty scope>     → 8 files / 59 tests PASS
npx vitest run   (full)             → 93 files: 92 pass, 1 fail — 757/758 tests
npm run verify:wwhn-247             → PASS (HN-WAR-001 = VERIFIED)
npx playwright test (QA2 + DEV spec)→ 16/16 PASS (chi tiết: ../WWHN-248/QA2_TEST_REPORT.md)
BE phpunit (9 file warranty, sqlite)→ 46 tests / 44 pass / 2 skipped (driver-guard đúng thiết kế) / 501 assertions
```

**Quy trách nhiệm 1 fail của full vitest (không thuộc WWHN-247):**
`src/test/wwhn-233-count-deferral-gate.test.ts` — "FE pin drifted from the working tree".
Nguyên nhân: commit `2b94a79` (WWHN-258) sửa chính file test này SAU khi pin nội dung
WWHN-233 phát hành tại `2d87fb5` (pointer `3f3a6c9`) → fingerprint lệch. Kiểm chứng:
`git log --oneline 2d87fb5..HEAD -- src/test/wwhn-233-count-deferral-gate.test.ts` → thấy
đúng `2b94a79`. File KHÔNG nằm trong phạm vi warranty; xử lý đúng là chủ WWHN-233 review
diff rồi re-emit pin (`npm run wwhn-233:verify -- --emit`) — phiên này **không** tự flip
pin của task khác.

## Đóng từng hạng mục register

| ID | Sev | Disposition | Bằng chứng |
|---|---|---|---|
| FE247-P1-01 | P1 | **ĐÓNG** — QA2 (WWHN-248) chạy độc lập UI/RBAC/state/responsive trên exact candidate R2, verdict **ACCEPTED** | `docs/evidence/WWHN-248/QA2_TEST_REPORT.md` (spec độc lập `e2e/wwhn-248-warranty-qa2.spec.ts`, 12 test + đối chứng 4 test DEV, exact SHA ghi trong report) |
| FE247-P1-02 | P1 | **ĐÓNG** — đủ 10 hạng mục: loading/empty/error/success, TEMP_ONLY, transition guards (kể cả 409 + terminal khoá), 403, PII masked fail-closed + full-view, responsive 360/768/1440 | Ma trận §3 của QA2 report + 12 screenshot `docs/evidence/WWHN-248/screenshots/` |
| FE247-P1-03 | P1 | **ĐÓNG bằng disposition + hoàn tất mảnh còn thiếu** — xem mục "Disposition WWHN-244" bên dưới | `HoaNam_BE/.../docs/evidence/WWHN-244/CLOSURE_REGISTER.md` (bổ sung 19/08) |
| FE247-P1-04 | P1 | **ĐÓNG** — candidate ≠ 59c4b16 nên đã pin lại + rerun toàn bộ (bảng trên) | Bảng Candidate R2 + build/test log ở trên |
| FE247-P2-01 | P2 | **ĐÓNG** — nguồn canonical là `m1`; **không tồn tại** nhánh `m1ee`/`m1ee/m1` (đã rà toàn repo: mọi chuỗi `m1ee` còn lại đều là câu phủ định trong hồ sơ các ticket trước — WWHN-217/242/258/274/296). Mọi prompt/evidence từ nay trỏ `m1` + exact SHA | Tuyên bố này + header QA2 report + §8 task doc `docs/Task_docs_Jira/WWHN-247.md` |
| FE247-P2-02 | P2 | **CHUẨN BỊ XONG phía repo — chờ thao tác Jira của BA Main** — `STATUS_MATRIX.md` đã stamp phiên bản v1.1 (nội dung bảng §2/§3 KHÔNG đổi so với bản BA đã đọc; chỉ cập nhật SHA chứng thực §5). Comment sign-off soạn sẵn để BA Main dán vào Jira, tham chiếu đích danh "STATUS_MATRIX.md v1.1"; sign-off nằm TRÊN JIRA (governance record), không phải draft text trong repo | `STATUS_MATRIX.md` v1.1 §5 + comment Jira của BA Main |

## Disposition WWHN-244 cho FE247-P1-03 (formal)

Đối chiếu `docs/evidence/WWHN-244/CLOSURE_REGISTER.md` (repo BE, vòng 2 — 19/08/2026):

1. **Các gate kỹ thuật QA/CI/data của WWHN-244 đã có bằng chứng chạy thật đầy đủ**:
   BE candidate P1-06 = `6dfae4c` với proof PostgreSQL 16.14 migrate-from-scratch trên DB
   cô lập (constraint `uk_warranty_case_one_active_item` chặn thật case active thứ 2);
   phpunit BE 20 test warranty PASS; OpenAPI hash tái lập deterministic; mảnh cuối cùng
   còn treo (FE vitest — lúc đó node_modules đang bị phiên khác cài dở) **đã chạy bù
   19/08: 8 files / 59 tests PASS** (ghi bổ sung vào chính register WWHN-244).
2. **Các hạng mục còn mở của WWHN-244 đều thuần quy trình, không phải kỹ thuật**:
   DEV244-P1-02 (BA/Tech Lead comment sign-off) và DEV244-P2-01 (PM sửa Jira metadata).
   Chúng **không chặn** FE247 vì: (a) nội dung kỹ thuật mà hai sign-off đó xác nhận
   (ma trận trạng thái + guard DEC-WAR-STATE-001) đã được khoá bằng gate tự động chạy
   PASS ở cả hai repo trong vòng R2 này (`Wwhn247WarrantyStateMachineParityTest`,
   `Wwhn244WarrantyStateMatrixTest`, `verify:wwhn-247`); (b) dependency HN-WAR-001 của
   WWHN-247 được verify bằng máy (đọc chéo mã nguồn BE), không dựa vào lời hứa của
   WWHN-244.
3. **Kết luận**: WWHN-244 outcome = các residual không block FE247. Comment sign-off các
   vai trò cho WWHN-244 đã soạn (BA/Tech Lead dán Jira) — đó là governance record, đúng
   chỗ của nó.

## Ranh giới sự thật của vòng R2

- E2e QA2 chạy với API mock; hợp đồng thật neo bằng verifier đọc chéo BE + phpunit BE.
  Live-runtime E2E (BE + DB thật) vẫn là hạng mục môi trường, ngoài phạm vi register này.
- 2 test BE skipped là driver-guard (`WARRANTY_REQUIRE_DB_DRIVER`) — chỉ chạy khi env
  ép driver, đúng thiết kế chống "PostgreSQL job chạy nhầm sqlite" (WWHN-244).
- Sign-off FE247-P2-02 chỉ hoàn tất khi BA Main thực sự dán comment lên Jira; repo không
  tự nhận thay.
- Phiên này không chạm `.github/workflows/*`, không trigger CI (budget Actions 3000/3000
  đã cạn) — mọi bằng chứng đều chạy local và tái lập được bằng các lệnh ghi trong hồ sơ.
