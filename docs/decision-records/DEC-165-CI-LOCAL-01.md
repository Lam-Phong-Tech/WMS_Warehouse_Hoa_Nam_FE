# DEC-165-CI-LOCAL-01 — Local exact-SHA gate thay CI cho WWHN-165

Ngày: 2026-08-20. Phạm vi: FE closure gate cho WWHN-165/166/167 (register review
comment Jira 14741, mục P1 "CI/artifact final chưa quan sát độc lập").

## Quyết định

GitHub Actions của tổ chức đã dùng hết quota 3000/3000 phút. Theo chỉ đạo rõ
ràng của PM: **tuyệt đối không được chạm vào bất cứ thứ gì kích hoạt CI** (kể
cả push commit không mang `[skip ci]`, sửa workflow, hay trigger re-run) để
tránh phát sinh phí. Toàn bộ bằng chứng đóng gate cho WWHN-165 vì vậy được
sinh **cục bộ**, trong git worktree sạch, tại SHA khai báo tường minh, thay
thế cho một CI run mới.

Tiền lệ: `DEC-325-CI-LOCAL-01` (xem `docs/evidence/wwhn-325/WWHN-325_LOCAL_GATE_MANIFEST.md`).

## Nội dung thay thế

- CI run #107 (SHA `57638b1f...`) trong `WWHN-165_CLOSURE_REGISTER.json` vẫn
  được giữ làm baseline lịch sử — **không xoá, không ghi đè** — vì register
  gốc coi đây là remediation baseline đã verify độc lập trước đó.
- Bằng chứng MỚI cho code fix `78738f9`/`6e4c397` (giữ attempted URL khi 401
  giữa phiên, fail-closed route chưa khai báo, guard no-stack-trace) nằm tại
  `docs/evidence/wwhn-165/WWHN-165_LOCAL_GATE_MANIFEST.md`, chạy đầy đủ:
  format/lint/typecheck/unit(777)/build/verify + e2e (WWHN-165, WWHN-292,
  WWHN-274 browser matrix, Edge thật).
- Mọi commit liên quan mang hậu tố `[skip ci]` trong subject.

## Ràng buộc

- Không tái sử dụng gate này cho commit sau — mỗi thay đổi mới trên bề mặt
  auth/session/RBAC phải chạy lại toàn bộ bộ gate tại SHA mới.
- Đây KHÔNG phải sign-off độc lập của QA1/QA2/BE/BAS/BA — chỉ chứng minh
  FE-owned code change không phá vỡ regression đã có. `finalAcceptanceStatus`
  trong register vẫn PHẢI giữ `PENDING_INDEPENDENT_EVIDENCE` cho tới khi các
  vai trò độc lập ký thật trên Jira.
