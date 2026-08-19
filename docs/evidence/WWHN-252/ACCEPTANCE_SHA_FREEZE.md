# WWHN-252 — Freeze SHA nghiệm thu (FE252-P1-09 · FE252-P2-01)

> Tài liệu này là **nguồn duy nhất** cho SHA nghiệm thu hiện hành của WWHN-252.
> Mọi tham chiếu nhánh dùng **canonical `m1`** kèm exact SHA — không dùng bí danh
> (`m1ee` hay bất kỳ URL nhánh cũ nào) theo yêu cầu FE252-P2-01.

## 1. Candidate nghiệm thu hiện hành (frozen)

| Trường | Giá trị |
|---|---|
| Nhánh canonical | `m1` (cả hai repo) |
| **FE acceptance SHA** | `ebdb061098bea9426c2949e5c50b53ba8a09289f` |
| **BE pair SHA** | `4a6965b` (HEAD BE tại thời điểm freeze; PV contract xanh — xem §3) |
| Ngày freeze | 2026-08-19 |
| Supersedes | Cặp nghiệm thu vòng 2: FE `ce17940` / BE `fb911c6` — **historical**, giữ nguyên evidence cũ để trace, không dùng để nghiệm thu nữa |

Lý do freeze mới (đúng phát hiện FE252-P1-09 của review): nhánh `m1` đã đi tiếp
nhiều commit sau `ce17940`, nên bằng chứng QA2 cũ không còn gắn với bản build
hiện hành. Toàn bộ bằng chứng dưới đây được **thực thi lại tại chính
`ebdb061…`**, không suy diễn từ vòng trước.

## 2. QA2 thực thi tại đúng SHA freeze (FE252-P1-05R2)

- Phương pháp: `git worktree add --detach` tại `ebdb061…` (working tree tách
  biệt, không dính WIP của phiên khác), dev server **khởi động mới** từ worktree
  trên port riêng (không `reuseExistingServer`), Playwright chạy với
  `SOURCE_SHA=ebdb061098bea9426c2949e5c50b53ba8a09289f`.
- Kết quả: **28/28 test PASS = 32/32 ô** ma trận 4 khung nhìn (390×844,
  768×1024, 1366×768, 1440×900) × 8 trạng thái (public ẩn danh / RBAC từ chối /
  RBAC cho phép / 500+request_id / offline / 404 / 429 / freshness
  NFR-SRS-016), mỗi ô kèm kiểm "không tràn ngang".
- Báo cáo fail-closed: `docs/evidence/WWHN-253/QA2_PV_RESPONSIVE_REPORT.md`
  (trường `Exact review SHA` = SHA freeze này).
- Raw run log: `docs/evidence/WWHN-253/WWHN-253_E2E_RUN_ebdb061.log`.
- Ảnh + JSON metadata từng ô (64 tệp) sinh tại
  `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/` của lần chạy
  (artifact ngoài git, tái sinh được bằng lệnh trong báo cáo).

## 3. Cổng kèm theo tại SHA freeze

- FE full gate (lint / typecheck / vitest / build) chạy trong cùng worktree:
  `docs/evidence/WWHN-252/WWHN-252_FE_FULL_GATE_ebdb061.log` — lint 0 lỗi,
  typecheck 0 lỗi, build OK, vitest **755/758 pass**; 3 fail đều ngoài phạm vi
  WWHN-252 (2× governance pin của WWHN-233 — 1 cái pre-existing ngay tại HEAD ở
  main tree, 1 cái chỉ đỏ ở checkout mới do EOL; 1× WWHN-260 thiếu artifact sinh
  `swagger-api.json`, đặt artifact vào là 4/4 PASS) — root cause ghi ở phần
  ANNOTATION cuối log.
- BE PV contract tại BE HEAD `4a6965b`:
  `php vendor/bin/phpunit tests/Feature/Wwhn252PvContractTest.php
  tests/Feature/Wwhn249PvSurfaceGovernanceTest.php` →
  `{"result":"passed","tests":30,"passed":30,"assertions":184}` (sqlite, chạy
  theo danh sách file — không dùng `--filter` để tránh clobber evidence ticket
  khác).

## 4. Quy ước trace

- Evidence pack (commit chứa tài liệu này) đứng **ngoài** SHA freeze — SHA
  freeze là commit cuối cùng chạm source được nghiệm thu; commit evidence chỉ
  ghi nhận kết quả, không đổi hành vi.
- Các tệp `*_ce17940*` trong hai thư mục evidence là bằng chứng lịch sử của
  vòng 2, đã được thay thế bởi bộ `*_ebdb061*` cho nghiệm thu hiện hành.
