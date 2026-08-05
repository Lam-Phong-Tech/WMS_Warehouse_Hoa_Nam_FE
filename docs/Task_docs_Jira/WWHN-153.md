# WWHN-153 — Khóa contract, runtime evidence và final sign-off FE

## 1. Trạng thái bàn giao

| Trường | Giá trị |
| --- | --- |
| Repository | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` |
| Nhánh | `m1` — không tạo nhánh phụ |
| Đánh giá đầu vào | **PASS có điều kiện — 80/100**, ngày 2026-08-05 |
| Phạm vi | `FE-P0-01..02`, `FE-P1-01..04`, `FE-P2-01` |
| FE-owned remediation | **Hoàn tất 100% về code, policy, CI, runner và tài liệu** |
| Final cross-role | **Fail-closed / chưa được phép final** đến khi BE1/BE2/QA1/QA2/BA cung cấp evidence độc lập hợp lệ |
| Nguồn SHA chính xác | GitHub Actions `SOURCE_SHA` và artifact `wwhn-153-signoff-integrity-<SHA>`; không hard-code SHA tự tham chiếu trong chính commit |

> FE không tự ký thay BE/QA/BA. Mục tiêu của remediation là loại bỏ khả năng mở final bằng comment, ảnh, boolean thủ công hoặc artifact sai hash.

## 2. Nguyên nhân gốc và cách đóng

1. **Contract source chưa có chuỗi tin cậy**: trước đây verifier chỉ giữ `version/hash = null`, nhưng chưa có cấu trúc ingest + kiểm tra release thật. Nay có manifest versioned, kiểm BE1/BE2 là hai account khác nhau, QA1 độc lập, và hash review phải trùng artifact phát hành.
2. **Final sign-off là constant tĩnh**: constant `false` có tác dụng chặn nhưng không chứng minh điều kiện mở. Nay final được tính từ evidence; không chấp nhận field `finalAllowed` do người dùng điền.
3. **QA runtime evidence thiếu tính tái lập**: bổ sung direct HTTP runner ghi từng request/response đã sanitize, exact SHA/build/env, `SHA256SUMS` và artifact digest.
4. **Permission mapping thiếu approval chain**: bổ sung backend catalog, runtime `/permissions` snapshot, BE/RBAC + BA + FE approval, endpoint → permission → role matrix và binding với đúng QA2 build.
5. **Jira closure khó đọc**: closure matrix bên dưới là text; sau commit FE đăng cùng nội dung rút gọn lên Jira kèm exact SHA/run/artifact/digest.

## 3. Closure matrix hiện tại

| ID | Sev | Required fix | Remediation trong FE | Điều kiện độc lập còn phải thực thi | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `FE-P0-01` | P0 | OpenAPI/schema chính thức có version, SHA256, changelog, independent reviewer | `WWHN-153_SIGNOFF_MANIFEST.json`; verifier kiểm BE1/BE2 publisher separation, QA1 independence, exact hash và optional local digest | BE1 + BE2 phát hành WWHN-31; QA1 review đúng hash tại WWHN-152 | **FE control complete; external pending** |
| `FE-P0-02` | P0 | Chỉ mở final khi WWHN-31/180/182/183 pass độc lập | `evaluateWwhn153FinalSignoff`; `wwhn-153:final` chỉ pass khi toàn bộ chain hợp lệ, BA=`GO`, P0=P1=0 | WWHN-31, WWHN-180, WWHN-182, WWHN-183 chuyển PASS bằng evidence thật | **Fail-closed enforced** |
| `FE-P1-01` | P1 | WWHN-151/152 chạy trên exact hash | Hash chain bắt WWHN-151 artifact hash xuất hiện trong QA1 `reviewedArtifacts`; kiểm constraints/error/testability đều PASS | BE2 attach schema/API module; QA1 thực thi review | **FE control complete; external pending** |
| `FE-P1-02` | P1 | QA2 direct 403, idempotency, stale/conflict, req/resp thật | `run-wwhn-153-runtime-evidence.mjs`; workflow dispatch QA2; reject local/CI/mock/test; redact secret; hash từng record | QA2 chạy trên DEV/UAT và attach artifact vào WWHN-182 | **Runner complete; execution pending** |
| `FE-P1-03` | P1 | BA G1 minutes có decision, exact SHA/digest, open P0/P1 | Manifest + verifier yêu cầu `GO`, SHA/digest khớp WWHN-182, `openP0=0`, `openP1=0`; Conditional Go không mở final | BA ghi minutes WWHN-183 sau independent review | **Schema complete; BA pending** |
| `FE-P1-04` | P1 | Permission catalog được BE/BA duyệt | `WWHN-153_PERMISSION_APPROVAL.json`; kiểm `/permissions`, backend catalog, approver separation, exact build binding, sensitive action matrix | BE/RBAC + BA điền và duyệt catalog/matrix; QA2 attach snapshot | **FE reconciliation complete; approval pending** |
| `FE-P2-01` | P2 | Jira closure matrix dạng text | Tài liệu này + report JSON/Markdown + comment post-commit có exact SHA/run/artifact/digest | FE đăng comment sau commit và bổ sung run/digest sau CI | **Complete** |

## 4. Chuỗi khóa final

Final chỉ được phép khi đồng thời:

- WWHN-31 `PASS`: source commit SHA hợp lệ; version; OpenAPI/schema path + SHA256; changelog path + SHA256; BE1 và BE2 là hai account khác nhau.
- WWHN-152 `PASS`: QA1 không trùng publisher; review đúng hash WWHN-31 và WWHN-151; constraints, error contract, testability đều pass.
- WWHN-151 `PASS`: BE2 phát hành module schema/API có version, source SHA và artifact SHA256.
- WWHN-180 `PASS`: independent confirmer không trùng publisher và xác nhận đúng official contract hash.
- WWHN-182 `PASS`: QA2, exact FE SHA/build/env, artifact digest, direct non-synthetic API evidence đủ bốn scenario.
- Permission approval `PASS`: BE/RBAC và BA là hai account khác nhau; runtime snapshot trùng source SHA/build/env của WWHN-182; không thiếu canonical code; từng critical endpoint có approved role mapping.
- WWHN-183 `PASS`: BA decision là `GO`, SHA/digest trùng WWHN-182, open P0/P1 bằng 0.

`CONDITIONAL_GO`, hash mismatch, self-review, synthetic evidence, environment local/CI/mock/test hoặc permission matrix thiếu role đều giữ final ở trạng thái blocked.

## 5. Runtime/API evidence contract cho QA2

### Scenarios bắt buộc

| ID | Assertion |
| --- | --- |
| `PERMISSION_DENY_403` | Direct request bằng denied token trả 403. |
| `IDEMPOTENCY_REPLAY` | Hai request cùng key/payload đều 2xx, cùng business result, không tạo side effect thứ hai. |
| `IDEMPOTENCY_CONFLICT` | Cùng key nhưng payload khác trả 409. |
| `STALE_WRITE` | `If-Match` cũ trả 409 hoặc 412. |
| `PERMISSION_CATALOG` | GET `/permissions` 2xx và snapshot được hash. |

### Lệnh

```bash
npm run wwhn-153:runtime -- --contract-only
npm run wwhn-153:runtime
```

Chi tiết cấu hình: `docs/evidence/wwhn-153/RUNTIME_API_EVIDENCE_RUNBOOK.md`.

## 6. Permission approval matrix

Nguồn: `docs/evidence/wwhn-153/WWHN-153_PERMISSION_APPROVAL.json`.

| Endpoint/action | Permission bắt buộc |
| --- | --- |
| `POST /scan/classify` | `inventory.trace` hoặc `scan.classify` |
| `POST /inbound-documents/:id/post-receipt` | `inbound.post` |
| `POST /outbound-documents/:id/post-issue` | `outbound.post` |
| `POST /stocktake/sessions/:sessionId/apply-adjustment` | `stocktake.adjust` |
| `GET /reports/inventory-xnt/export-excel` | `report.export` |
| `POST /warranty/cases` với `TEMP_ONLY` | `warranty.temp_only` |

Role chỉ là mapping được duyệt; FE và backend vẫn authorize bằng permission code. `stocktake.manage` không bao giờ thay thế `stocktake.adjust`.

## 7. Commands và CI

```bash
npm run wwhn-153:verify       # kiểm integrity; pass khi pending được khai báo trung thực
npm run wms-contract:verify   # kiểm toàn bộ FE contract/service/CI guards
npm run wwhn-153:final        # fail cho tới khi tất cả independent gate PASS
npm run test                  # gồm regression derived sign-off policy
npm run typecheck
npm run build
```

Workflow `.github/workflows/wwhn-153-signoff.yml`:

- Push `m1`: chạy integrity, runtime contract-only và unit regression; upload artifact immutable.
- Manual `require_final=true`: enforce final GO.
- Manual `run_live_runtime=true`: chạy direct API bằng GitHub Environment secrets/variables và upload QA2 evidence.

## 8. Artifact và traceability

| Artifact | Mục đích |
| --- | --- |
| `WWHN-153_SIGNOFF_MANIFEST.json` | Source-of-truth cho chain WWHN-31/151/152/180/182/183 |
| `WWHN-153_PERMISSION_APPROVAL.json` | Catalog + runtime snapshot + endpoint/permission/role approval |
| `wwhn-153-signoff-report.json/.md` | Kết quả derived gate, blockers, open P0/P1 |
| `contract-evidence.json` | Contract/service/CI verification tổng hợp |
| `WWHN-153_RUNTIME_API_SUMMARY.json` | QA2 live direct API summary |
| `SHA256SUMS` + `WWHN-153_RUNTIME_ARTIFACT_DIGEST.txt` | Integrity của toàn bộ request/response evidence |

## 9. Mẫu Jira closure comment sau commit

```text
WWHN-153 — FE closure matrix (text)
Branch: m1
Commit: <exact 40-hex SHA>
CI run: <run URL / run id>
Artifact: wwhn-153-signoff-integrity-<SHA>
Artifact digest: <SHA256 từ GitHub artifact hoặc QA2 package>
FE controls: FE-P0-01..02, FE-P1-01..04, FE-P2-01 complete
Final allowed: NO — fail-closed
Open external gates: WWHN-31, WWHN-151, WWHN-152, WWHN-180, WWHN-182, WWHN-183
Next owners: BE1/BE2 publish; QA1 exact-hash review; QA2 live direct API; BE/RBAC+BA permission approval; BA G1 minutes.
```

## 10. Definition of Done

### FE scope — hoàn tất

- [x] Fail-closed là derived policy, không phải boolean tin cậy.
- [x] Contract/schema exact-hash chain và independent-review controls.
- [x] QA2 direct API runner đủ 403/idempotency/conflict/stale + request/response hash.
- [x] Permission approval artifact và endpoint→permission→role matrix.
- [x] CI integrity/final/live-runtime modes.
- [x] Regression tests chống hash mismatch, self-review, thiếu scenario, Conditional Go và build mismatch.
- [x] Jira closure matrix dạng text.

### Cross-role final — chưa được tự đánh dấu

- [ ] WWHN-31 official release.
- [ ] WWHN-151 BE2 module schema/API artifact.
- [ ] WWHN-152 QA1 exact-hash review.
- [ ] WWHN-180 independent confirmation.
- [ ] WWHN-182 QA2 live evidence.
- [ ] Permission catalog approvals.
- [ ] WWHN-183 BA `GO`, exact SHA/digest, P0=P1=0.

## 11. Compatibility trace cho gate hiện hữu

Bảng này giữ traceability với assessment 72/100 trước đó để verifier legacy và assessment 80/100 hiện tại cùng kiểm được một chuỗi remediation, không tạo hai nguồn sự thật độc lập.

| Legacy gate | Finding hiện tại | Disposition |
| --- | --- | --- |
| `BA-FE-P0-01` | `FE-P0-01` | Official contract exact-hash + independent QA1 review |
| `BA-FE-P0-02` | `FE-P0-02` | Derived final sign-off fail-closed |
| `BA-FE-P1-01` | `FE-P1-01` | WWHN-151 versioned module schema/API |
| `BA-FE-P1-02` | `FE-P1-01` | WWHN-152 exact-hash QA1 review |
| `BA-FE-P1-03` | `FE-P1-02` + `FE-P1-03` | QA2 runtime evidence + BA G1 minutes |
| `BA-FE-P1-04` | `FE-P1-04` | Runtime permission reconciliation + formal approval |
| `BA-FE-P1-05` | `FE-P0-01` + `FE-P1-01` | Endpoint/payload/error/permission/sample response locked by official artifacts |
| `BA-FE-P2-01` | `FE-P2-01` | Text closure matrix |
| `BA-FE-P2-02` | `FE-P1-02` + `FE-P2-01` | Exact SHA/build/env/run/artifact/digest trace |
