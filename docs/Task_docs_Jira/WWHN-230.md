# WWHN-230 — [DEV] Kiểm kê (core) · phần FE

| Field | Value |
|---|---|
| Jira | `WWHN-230` · liên đới `WWHN-58`, `WWHN-232` |
| Disposition | `DISP-STK-230` v1.0.0 — **Option B: park / de-scope** |
| Dependency | `HN-INV-001` → `WWHN-48` |
| Branch | `m1` |
| Bản đầy đủ | `../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE/docs/docs_task_jira/WWHN-230.md` |

## Vì sao FE không có gì để làm

`REQ-SRS-037` (`Must`, SRS/FRD v1.12 adopt tại `WWHN-334`) cấm mọi bề mặt Stocktake:
"không expose Stocktake/Variance, menu/API/permission/entity/report hoặc action sửa tồn
trực tiếp". Wireframe MVP ALIGNED v3.20 xác nhận chéo: **0 màn hình, 0 menu entry** kiểm kê.

Nên phần FE của `WWHN-230` không phải "chưa làm" mà là "không được làm". Việc của FE là
**chứng minh bề mặt đó vắng mặt và giữ nó vắng mặt**.

## Artifact FE

| File | Vai trò |
|---|---|
| `docs/api-evidence/WWHN-230_SCOPE_DISPOSITION.json` | Bản FE của disposition. **File riêng**, không chèn vào `STOCKTAKE_GOVERNANCE_STATUS.json` vì các nhánh `WWHN-230/233/236/237` chạy song song và sẽ ghi đè lẫn nhau trên một khoá chung |
| `src/test/wwhn-230-stocktake-scope-guard.test.ts` | Test lock: route/permission/endpoint/module vắng mặt; disposition không tự phong approval; SRS/ERD/wireframe còn nguyên anchor |
| `scripts/verify-wwhn-230-closure.mjs` | Closure gate, pin exact SHA FE + BE, ghi `docs/evidence/WWHN-230/FE_CLOSURE_EVIDENCE.json` + `SHA256SUMS` |
| `docs/Task_docs_Jira/WWHN-230_SIGNOFF_COMMENTS.md` | 5 comment sign-off, mỗi vai trò 1 lần |

## Chạy

```bash
npm run wwhn-230:verify -- --with-tests
```

Sau khi 5 vai trò đã comment và `DISP-STK-230-APPROVAL.json` được điền:

```bash
npm run wwhn-230:verify -- --require-signoff --with-tests
```

## Ranh giới với các nhánh song song

`STOCKTAKE_GOVERNANCE_STATUS.json` chỉ giữ phần *authority* dùng chung (`ruleAuthority`,
`decisionRecordGate` — `REQ-SRS-037`, gate `WWHN-25`). Mỗi nhánh Stocktake giữ file
disposition riêng của mình. Guard của `WWHN-230` đọc cả hai: authority từ file chung,
quyết định phạm vi từ file riêng.

## Kết quả tại phiên này

- `wwhn-230-stocktake-scope-guard`: **4/4 pass**.

## Vòng 2 — review 67/100 (`DEV230-P1-02R`)

`FE_CLOSURE_EVIDENCE.json` cũ bị stale (SHA không khớp HEAD, `workingTreeClean=false`,
`testResult=null`). Đã regenerate trên clean `git worktree` (đối xứng với worktree BE để
`identity.backend` trong file FE cũng đọc đúng trạng thái sạch) — không đụng working tree
chung đang có phiên khác sửa. Commit `52969fb` (candidate `f9f2e65`, 4/4 vitest pass,
`workingTreeClean=true` cả hai phía). Chi tiết đầy đủ + cách chạy lại: xem §6 bản BE
(`../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE/docs/docs_task_jira/WWHN-230.md`).
- `npm run check:api-mapping`: **PASS** (56 dòng, 4 fail-closed có chủ đích).
- Full vitest: **575 test**, không có regression do task này.

## Vòng 3 — soát lại (2026-08-19): nhãn subject commit `52969fb` bị lệch

Subject của commit `52969fb` ghi "candidate 1bb3cba" (cha trực tiếp của commit đó trên `m1` tại
thời điểm soạn message), nhưng **nội dung** `FE_CLOSURE_EVIDENCE.json` mà chính commit đó ghi lại
pin đúng `identity.frontend.commitSha = f9f2e65e687669f033d259a693635546876f05a8` (ancestor xa
hơn) — khớp với bảng "Vòng 2" ở trên, không lệch. Nguyên nhân: worktree cô lập được dựng tại
`f9f2e65...`, nhưng vài commit song song khác chen vào trước khi kết quả được commit lên working
tree chung, nên subject soạn theo HEAD ambient lúc đó (`1bb3cba`) thay vì SHA đã pin trong file.
Không amend commit cũ (nhánh dùng chung). SHA chuẩn luôn là SHA **trong nội dung file**, không
phải SHA trong dòng `git log --oneline`. Chi tiết đối chiếu đầy đủ: §6.1 bản BE
(`../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE/docs/docs_task_jira/WWHN-230.md`).
