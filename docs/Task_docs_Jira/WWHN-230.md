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
- `npm run wwhn-230:verify`: **PASS** (1 PENDING là sign-off, đúng thiết kế).
- `npm run check:api-mapping`: **PASS** (56 dòng, 4 fail-closed có chủ đích).
- Full vitest: **575 test**, không có regression do task này.
