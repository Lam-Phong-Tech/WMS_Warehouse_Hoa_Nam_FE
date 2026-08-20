# WWHN-165 — Evidence Index và Final Gate Ledger

Cập nhật: 2026-08-20  
Nhánh: `m1`  
Nguyên tắc: evidence chỉ hợp lệ khi truy ngược được `environment + build/run + exact SHA + role/scope + viewport (nếu UI) + timestamp`.

## 0. Code fix mới nhất + local exact-SHA gate (2026-08-20)

Đóng các gap P1 từ review comment Jira 14741: giữ attempted URL khi 401 giữa
phiên (QA2-LOGIN-001), fail-closed route chưa khai báo permission, guard
chống hồi quy no-stack-trace, dọn `stocktake.*` khỏi contract expectation
(REQ-SRS-037), bổ sung vocabulary 409/412/428.

- Code SHA: `78738f99874a7e3c674b5b3363708f29246df29f`
- Gate SHA: `6e4c397d81671700a6f526b51c3ddf8d2d888dc2`
- Manifest: `docs/evidence/wwhn-165/WWHN-165_LOCAL_GATE_MANIFEST.md`
- Quyết định CI: `docs/decision-records/DEC-165-CI-LOCAL-01.md` (local gate
  thay CI run mới vì quota Actions hết 3000/3000 phút)
- Đây **không phải** sign-off độc lập của QA1/QA2/BE/BAS/BA — mục 5 dưới đây
  vẫn giữ nguyên trạng thái PENDING cho tới khi từng vai trò tự ký trên Jira.

## 1. FE remediation baseline đã xác minh

| Trường | Giá trị |
| --- | --- |
| Workflow | `CI` |
| Run number / ID | `#107` / `30913628631` |
| Kết luận | `SUCCESS` |
| Exact source SHA | `57638b1f7a0277a3f87d777668936d5f65f5e743` |
| Artifact ID | `8894201626` |
| Artifact name | `wms-fe-closure-evidence-57638b1f7a0277a3f87d777668936d5f65f5e743` |
| Size | `11,426,376 bytes` |
| Digest | `sha256:c87c01b37bc8c84dee5cf3788b4bb69026d756364c860a355bad9bef4ff5bc00` |
| Expiry | `2026-11-02T13:24:06Z` |
| Trạng thái tải | Chưa hết hạn tại thời điểm xác minh |

Run #107 chứng minh bộ remediation FE tại đúng SHA nêu trên đã qua CI và artifact đã được sinh. Run này **không** được dùng làm bằng chứng cho commit mới hơn; mỗi commit ảnh hưởng hồ sơ hoặc code phải có run riêng.

## 2. Disposition blob ảnh Jira

Jira comment `14612` chỉ chứa blob URL tạm, không có filename, environment, build, SHA, role, viewport hoặc timestamp. Trạng thái chính thức:

`SUPERSEDED_NON_EVIDENCE`

Comment này không được dùng trong acceptance. Evidence thay thế là artifact có tên và digest ở mục 1, cộng với screenshot/video/trace bên trong artifact theo filename schema:

`WWHN-165_<scenario>_env-<env>_sha-<sha>_role-<role>_viewport-<width>x<height>_<timestamp>.<ext>`

## 3. Canonical evidence map

| Evidence | Mục đích | Owner | Trạng thái |
| --- | --- | --- | --- |
| `docs/Task_docs_Jira/WWHN-165.md` | Root cause, remediation, DoD và final-gate policy | FE1 | COMPLETE |
| `docs/evidence/wwhn-165/WWHN-165_CLOSURE_REGISTER.json` | Machine-readable closure state | FE1 | COMPLETE |
| `docs/api-evidence/WWHN-165_AUTH_CONTRACT_EXPECTATION.md` | Contract expectation, permission và error boundary | FE1 → BE | PENDING BE APPROVAL |
| `docs/evidence/wwhn-165/WWHN-166_QA1_SECURITY_MATRIX.md` | QA1 direct API/RBAC/audit execution | QA1 | PENDING INDEPENDENT RUN |
| `docs/evidence/wwhn-165/WWHN-167_QA2_UI_MATRIX.md` | QA2 UI/browser/viewport execution | QA2 | PENDING INDEPENDENT RUN |
| `docs/evidence/wwhn-165/WWHN-165_UI_STATE_MATRIX.md` | UI state, validation và trace WWHN-146/147 | BAS + BA | PENDING APPROVAL |

## 4. Same-build reconciliation rule

Lead/QA chỉ ký final khi mọi evidence row dưới đây cùng tham chiếu một bộ khóa:

- FE source SHA và CI run/build ID.
- BE source SHA hoặc release artifact digest.
- Environment name và API base URL đã mask phần nhạy cảm.
- Deployment/build timestamp.
- OpenAPI/Postman version và SHA-256.
- Test execution timestamp, tester và PASS/FAIL.

Không chấp nhận các mô tả `latest`, `m1 hiện tại`, `build mới nhất` hoặc ảnh không có metadata.

## 5. Final gate ledger

| Gate | Jira | Trạng thái Jira xác minh 2026-08-05 | Điều kiện đóng |
| --- | --- | --- | --- |
| FE1 auth/session | WWHN-165 | IN PROGRESS REDF | CI mới PASS, artifact tải được, không còn FE P0/P1 |
| QA1 security/RBAC/audit | WWHN-166 | In Progress | Independent PASS trên exact env/build/SHA |
| QA2 role/navigation | WWHN-167 | To Do | Independent PASS Chrome/Edge và 3 viewport |
| BAS field/state | WWHN-146 | In Progress | Versioned matrix + approval + traceability |
| BA rule/label/validation | WWHN-147 | To Do | Approval và disposition open points |
| Backend authorization/contract | WWHN-35 | In Progress | Direct API/data-scope/audit + contract/hash/catalog/sample |

## 6. Fail-closed decision

`FE-owned closure = COMPLETE` không đồng nghĩa `WWHN-35 final acceptance = DONE`.

Final acceptance phải giữ `PENDING_INDEPENDENT_EVIDENCE` cho tới khi toàn bộ gate ở mục 5 PASS. Đây là cơ chế chống nghiệm thu bề nổi và chống dùng evidence cũ/sai SHA.
