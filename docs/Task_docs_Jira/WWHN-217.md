# WWHN-217 — Khắc phục UI blockers (FE)

| Trường | Giá trị |
|---|---|
| Ticket | WWHN-217 |
| Nhánh làm việc | **`m1`** (canonical) |
| Repo FE | `HoaNam_FE/WMS_Warehouse_Hoa_Nam_FE` |
| Repo BE (phần liên đới) | `HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE` |
| Liên quan | WWHN-53 (yêu cầu register), WWHN-216 (chu kỳ thực thi/retest của QA2) |
| Register đang đóng | FE217-P1-01 … P1-05, FE217-P2-01 … P2-03 |

## 1. Chuẩn hoá nguồn tham chiếu (FE217-P2-01)

Source register cũ ghi lẫn lộn `m1ee` và `m1`. **Nhánh canonical là `m1`** — `m1ee` là sai
chính tả, không phải một nhánh tồn tại. Mọi artifact của WWHN-217 chỉ ghi `m1` kèm exact
SHA; SHA candidate được pin máy đọc được tại
[`docs/evidence/WWHN-217/WWHN-217_PINS.json`](../evidence/WWHN-217/WWHN-217_PINS.json) và
được cổng `npm run wwhn-217:verify` kiểm tra là **commit cuối cùng chạm tập artifact
runtime** (chống pin rot: sửa code mà quên chạy lại gate thì cổng đỏ).

## 2. Chuẩn hoá wording của Output (FE217-P2-02)

- Wording cũ: *"Output UI lỗi lỗi đã khắc phục"* — lặp từ, không đọc được.
- Wording chuẩn hoá: **"UI blockers đã khắc phục"**.
- Đây là thay đổi **diễn đạt**, không thay đổi phạm vi: các blocker đã ghi trước đó vẫn giữ
  nguyên ID, nguyên lịch sử. Bản gốc được lưu lại nguyên văn ở dòng trên để không mất
  historical trace. Người sửa: PM/BA trên Jira metadata; artifact repo không đổi ID nào.

## 3. Ánh xạ temp-key (FE217-P2-03)

| Temp-key | Ticket chính thức | Vai trò |
|---|---|---|
| `HN-QA-004-ST01` | **WWHN-216** | Chu kỳ thực thi/retest của QA2 cho sprint hiện tại — nguồn của FE217-P1-02 và FE217-P1-05 |

Ánh xạ này được nhắc lại trong
[`UI_BLOCKER_DEFECT_REGISTER.json`](../evidence/WWHN-217/UI_BLOCKER_DEFECT_REGISTER.json)
để người đọc register không phải tra chéo Jira.

## 4. Register mục ↔ artifact

| Register item | Yêu cầu | Artifact đóng |
|---|---|---|
| FE217-P1-01 | UI Blocker/Defect Register đủ cột | [`UI_BLOCKER_DEFECT_REGISTER.json`](../evidence/WWHN-217/UI_BLOCKER_DEFECT_REGISTER.json) + [`.md`](../evidence/WWHN-217/UI_BLOCKER_DEFECT_REGISTER.md) |
| FE217-P1-02 | QA2 thực thi/retest Inbound/Outbound/Inventory × desktop/tablet/mobile, RBAC/403, duplicate/retry/back/network | [`e2e/wwhn-217-ui-blocker-retest.spec.ts`](../../e2e/wwhn-217-ui-blocker-retest.spec.ts) — 19 TC, ảnh + video + metadata gắn exact SHA |
| FE217-P1-03 | Pin exact candidate SHA + chạy lint/typecheck/test/build trên candidate đó | [`scripts/run-wwhn-217-exact-sha-evidence.mjs`](../../scripts/run-wwhn-217-exact-sha-evidence.mjs) → `docs/evidence/WWHN-217/<sha>/gate-*.log` + `gate-results.json` |
| FE217-P1-04 | Trace matrix zero-orphan, không mượn evidence WWHN-292/144/211 | [`TRACE_MATRIX.json`](../evidence/WWHN-217/TRACE_MATRIX.json) + cổng `no-borrowed-evidence` trong [`verify-wwhn-217-closure.mjs`](../../scripts/verify-wwhn-217-closure.mjs) |
| FE217-P1-05 | QA2 xác nhận mã lỗi/RBAC API thật trên candidate (≥ 401/403/422/409) | [`runtime-error-contract.json`](../evidence/WWHN-217/runtime-error-contract.json) — sinh từ `tests/Feature/Wwhn217RuntimeErrorContractTest.php` (HTTP + middleware thật) |
| FE217-P2-01 | `m1ee` → `m1` + exact SHA | §1 tài liệu này + `WWHN-217_PINS.json` |
| FE217-P2-02 | Chuẩn hoá wording Output | §2 tài liệu này |
| FE217-P2-03 | Pin `HN-QA-004-ST01` → WWHN-216 | §3 tài liệu này |

## 5. Vì sao gate chạy trong git worktree detached

Nhánh `m1` đang được **nhiều phiên làm việc song song**, nên working tree gần như lúc nào
cũng bẩn vì thay đổi của task khác. Chạy `lint/typecheck/test/build` thẳng trên working tree
sẽ cho ra kết quả của "m1 + rác của người khác", **không phải** của candidate SHA — đúng
loại bằng chứng mà register từ chối. Vì vậy runner mặc định:

1. `git worktree add --detach <tmp> <candidateSha>` — **không tạo nhánh mới**;
2. nối `node_modules` của repo chính sang worktree;
3. chạy chuỗi gate trong worktree;
4. ghi raw log + manifest gắn 40-char SHA về repo chính;
5. dọn worktree.

`--in-place` vẫn dùng được, nhưng khi tree bẩn thì manifest tự hạ `evidenceValidity` xuống
`INVALID_FOR_CLOSURE_DIRTY_TREE` — không bao giờ im lặng nhận kết quả bẩn là bằng chứng đóng
task.

## 6. Chạy lại toàn bộ

```bash
npm run wwhn-217:evidence   # gate lint/typecheck/unit/build/e2e tại exact SHA
npm run wwhn-217:verify     # cổng register + trace matrix + runtime contract
```

Phía backend (sinh lại bằng chứng runtime của FE217-P1-05):

```bash
vendor/bin/phpunit --filter Wwhn217RuntimeErrorContractTest
```

## 7. Ranh giới sự thật

- Suite e2e = hành vi FE trên API mock có kiểm soát. Không chứng minh backend cưỡng chế
  phân quyền.
- `runtime-error-contract.json` = cưỡng chế backend thật (SRS §8.4/WWHN-40: *UI hiding is
  not authorization*).
- Không phải UAT thiết bị thật của QA1, không thay thế ma trận trình duyệt/thiết bị vật lý.
