# WWHN-382 (FE) — Đóng register R4 phía frontend cho dashboard aggregate

Đối tượng: màn Dashboard tiêu thụ `GET /api/v1/reports/dashboard-quick`.
Liên quan: WWHN-88 (parent), WWHN-327 (FE gốc), WWHN-328 (BE), WWHN-329 (QA2).
Nhánh: `m1`.

Hồ sơ đóng chính nằm ở repo BE: `docs/evidence/WWHN-382/R4_CLOSURE.md`.
Phần FE ở đây chỉ giải quyết mục **DEV328-P1-05R4** (dependency index) và giữ cho FE không
lặng lẽ trôi khỏi hợp đồng đã ký.

## Vấn đề mục P1-05R4 chỉ ra

`WWHN-327/328 issuelinks=[]` — quan hệ FE ↔ BE chỉ tồn tại trong lời văn của comment. Hệ quả
thực tế, không phải hình thức: không ai trả lời được câu "FE đang đứng trên bản BE nào" nếu
người viết comment nghỉ phép. Và vì `m1` là nhánh chung của nhiều phiên làm việc song song, câu
trả lời "nhánh m1" không có giá trị.

## Cách đóng

**Evidence index hai chiều** để dependency không phụ thuộc vào việc ai đó nhớ bấm nút link trên Jira:

| Chiều | Tệp | Nội dung |
|---|---|---|
| FE → BE | [`docs/evidence/WWHN-382/FE_CONSUMER_PIN.json`](../evidence/WWHN-382/FE_CONSUMER_PIN.json) | BE SHA đủ 40 ký tự, fingerprint operation, field set FE tiêu thụ, output WWHN-327 đã hợp nhất |
| BE → FE | `HoaNam_BE/.../docs/evidence/WWHN-382/CANDIDATE_PIN.json` | `candidate.frontend` = repo + branch + FE SHA |

**Cổng máy** giữ cho pin không thành văn bản chết:

```bash
node scripts/verify-wwhn-382-fe-consumer.mjs
```

Cổng đỏ khi: pin ghi SHA rút gọn hoặc ghi tên nhánh; `DashboardKPI` khai thừa/thiếu field so với
hợp đồng; ngoại lệ warranty GLOBAL bị gỡ hoặc hiện vô điều kiện; đếm cảnh báo bằng
`reconciliation_warnings.length` (mảng đã bị BE cắt trần 50 dòng); `dashboardService` gọi thêm
endpoint báo cáo ngoài `dashboard-quick`.

## Quan hệ với WWHN-327

WWHN-327 đã đóng phần hiển thị: nhãn phạm vi dữ liệu, khối ghi chú ngoại lệ warranty GLOBAL,
đếm bằng `reconciliation_warning_count`, gate closure riêng và 9 e2e trên 3 viewport. Vòng này
**không sửa lại** phần đó — output `99dff42fb4272ed8930e8fb9bf4da6368f4cfd96` được ghi nhận là
nguồn đầu vào đã hợp nhất và pin lại để truy vết.

Thay đổi duy nhất chạm hồ sơ 327: `WWHN-327_CLOSURE_REGISTER.json` → `kpiMatrixVersion` nâng từ
`v1.1` lên `v1.2` cho khớp matrix hiện hành.

## Chạy đủ bộ phía FE

```bash
npm ci && npm run typecheck && npx vitest run src/modules/dashboard && node scripts/verify-wwhn-327-closure.mjs && node scripts/verify-wwhn-382-fe-consumer.mjs
```
