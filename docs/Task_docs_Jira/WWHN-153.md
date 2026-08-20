# WWHN-153 — Remediation P0/P1/P2 và final sign-off FE

## 1. Baseline đã xác minh

| Trường | Giá trị |
| --- | --- |
| Repository | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` |
| Branch | `m1`; không tạo branch phụ |
| Pre-remediation HEAD | `e36750ae5a6163f6a8c0bfb6f5a0259c6c306829` |
| SHA cũ | `f6e137d...` và assessment `eade7f...` là superseded, không authoritative |
| Authoritative source sau commit | GitHub Actions derive `GITHUB_SHA`, parent, tree, run URL và artifact name |
| Final state | Fail-closed; không tự ký thay BE1/BE2/QA1/QA2/BA |

Không hard-code SHA của chính commit vào nội dung commit vì tạo vòng tự tham chiếu. File `WWHN-153_FE_SOURCE_PROVENANCE.json` khóa expected parent; workflow chứng minh exact final SHA từ checkout immutable.

## 2. Root cause và sửa triệt để

1. **Evidence từng là dữ liệu tự khai**: trạng thái `PASS` có thể tồn tại nhưng thiếu path/hash/reviewer. Policy v4 chỉ coi PASS hợp lệ khi toàn bộ field, account separation và exact-hash chain hợp lệ; PASS sai cấu trúc trở thành FAIL.
2. **Open risk count bị hard-code**: core cũ trả cố định P0/P1. Nay P0/P1/P2 được derive từ từng finding/gate, không thể lệch assessment.
3. **Runtime side effect chưa được đo**: runner cũ gán `secondSideEffectCreated=false`. Runner v2 đọc effect trước/sau; idempotency bắt after-first=after-replay, denied/stale bắt before=after.
4. **Request/response dùng chung artifact**: runner v2 tách file/hash, bắt request_id, scan secret/JWT và package bằng `SHA256SUMS`.
5. **Permission approval chưa bind runtime package**: catalog response hash, source/build/env/artifact digest/summary/SHA256SUMS phải khớp WWHN-182; ba approver BE/RBAC, BA, FE phải độc lập.
6. **SHA Jira lệch HEAD**: thêm provenance policy và CI parent/tree/run/artifact gate. SHA cũ được ghi rõ superseded.
7. **Dev Guide là ví dụ không đầy đủ**: architecture alignment khóa canonical catalog tại `wms-permissions.ts`. Root cause tái phát 2026-08-20: mapping nhạy cảm ban đầu dùng `stocktake.adjust` — permission này bị **REQ-SRS-037** cấm hoàn toàn khỏi MVP (không entity/API/permission/screen Stocktake). Đã thay bằng 5 action nhạy cảm thật trên runtime m1 (`inbound.post`, `outbound.post`, `report.export`, `warranty.temp_only`, `scan.execute|scan.classify`), lấy nguyên văn từ `HN-BE-API-003_ENDPOINT_PERMISSION_MATRIX.json`; gate `PERMISSION-APPROVAL` fail-closed nếu phát hiện bất kỳ permission nào khớp `/^stocktake\./i`.
8. **Cross-contract verifier dùng ID assessment legacy**: giữ mapping tương thích một-một với finding v4 để CI cũ và gate mới cùng đọc một closure matrix, không nhân đôi trạng thái.

## 3. RISK & ACTION REGISTER sau remediation

| ID | Sev | FE control đã triển khai | Evidence đóng cuối | Trạng thái hiện tại |
| --- | --- | --- | --- | --- |
| FE-P0-01 | P0 | Official release gate: version, backend SHA, artifact/changelog path+SHA256, BE1/BE2 separation, QA1 exact-hash review | WWHN-31 + WWHN-152 PASS thật | External pending |
| FE-P0-02 | P0 | Derived final; không đọc boolean `finalAllowed`; mọi gate phải PASS, P0/P1=0 | Final report `FINAL_GO` | Fail-closed enforced |
| FE-P1-01 | P1 | WWHN-151 module artifact phải được QA1 reviewedArtifacts đối chiếu exact SHA256 và đủ 3 dimension | WWHN-151/152 PASS | External pending |
| FE-P1-02 | P1 | Direct API runner v2, effect proof, request/response hash, request_id, secret hygiene | QA2 package WWHN-182 | Execution pending |
| FE-P1-03 | P1 | BA minutes gate bắt `GO`, source SHA, artifact digest, minutes hash, open P0/P1=0 | WWHN-183 minutes | BA pending |
| FE-P1-04 | P1 | Permission catalog/runtime/package binding + critical endpoint→permission→role approval | BE/RBAC + BA + FE approval | Approval pending |
| FE-P1-05 | P1 | CI source provenance: repo/ref/source/execution/parent/tree/run/artifact | CI integrity artifact của commit này | FE control implemented; CI verification required |
| FE-P2-01 | P2 | Versioned JSON schemas, input SHA256, separate artifacts, secret scan, immutable upload | Integrity report | Complete |
| FE-P2-02 | P2 | Closure matrix ghi pre-head/superseded/CI-authoritative strategy | Tài liệu này + Jira comment | Complete |

### 3.1. Mapping assessment legacy → finding v4

Bảng này là compatibility contract cho `scripts/verify-wms-contract-signoff.mjs`; trạng thái authoritative vẫn được derive từ finding v4, không duy trì hai bộ kết quả độc lập.

| Legacy ID | Finding v4 | Disposition |
| --- | --- | --- |
| BA-FE-P0-01 | FE-P0-01 | Official contract source + QA1 exact-hash review |
| BA-FE-P0-02 | FE-P0-02 | Derived final fail-closed |
| BA-FE-P1-01 | FE-P1-01 | WWHN-151/WWHN-152 schema chain |
| BA-FE-P1-02 | FE-P1-02 | QA2 direct runtime/API package |
| BA-FE-P1-03 | FE-P1-03 | BA G1 minutes |
| BA-FE-P1-04 | FE-P1-04 | Permission catalog approval |
| BA-FE-P1-05 | FE-P1-05 | Authoritative FE source provenance |
| BA-FE-P2-01 | FE-P2-01 | Evidence hygiene |
| BA-FE-P2-02 | FE-P2-02 | HEAD/closure matrix hygiene |

## 4. Gate model v4

Các gate độc lập:

- `FE-SOURCE-PROVENANCE`
- `OFFICIAL-RELEASE`
- `MODULE-SCHEMA`
- `QA1-INDEPENDENT-REVIEW`
- `INDEPENDENT-CONFIRMATION`
- `QA2-DIRECT-RUNTIME`
- `PERMISSION-APPROVAL`
- `BA-G1-MINUTES`

`npm run wwhn-153:verify` kiểm integrity và cho phép evidence external còn PENDING. `npm run wwhn-153:final` phải FAIL cho đến khi toàn bộ gate PASS.

## 5. Files thay đổi

| File | Nội dung |
| --- | --- |
| `scripts/wwhn-153-signoff-core.mjs` | Policy v4, dynamic findings/count, exact-hash, source provenance, runtime effect proof, permission binding |
| `scripts/verify-wwhn-153-signoff.mjs` | Derive git HEAD/parent/tree/run, hash input, JSON/Markdown report |
| `scripts/test-wwhn-153-signoff-core.mjs` | Self-test positive + negative: hash, provenance, side effect, catalog |
| `scripts/run-wwhn-153-runtime-evidence.mjs` | Direct API runner v2 và package hygiene |
| `src/shared/api/wwhn-153-final-signoff.ts` | Runtime-safe fail-closed policy tương ứng |
| `src/test/wwhn-153-final-signoff-policy.test.ts` | Regression cho final chain |
| `WWHN-153_SIGNOFF_MANIFEST.json` | Schema 4.0.0, đủ P0/P1/P2 |
| `WWHN-153_FE_SOURCE_PROVENANCE.json` | HEAD lineage và authoritative CI rules |
| `WWHN-153_PERMISSION_APPROVAL.json` | Schema 3.0.0, runtime/package/catalog binding |
| `RUNTIME_API_EVIDENCE_RUNBOOK.md` | Probe contract và handoff QA2 |
| `WWHN-153_ARCHITECTURE_ALIGNMENT.md` | Alignment với Dev Guide và canonical permission source |
| `.github/workflows/wwhn-153-signoff.yml` | fetch-depth 2, self-test, exact provenance, DEV/UAT choice, immutable build required |
| `package.json` | `wwhn-153:self-test` |

## 6. Commands bắt buộc

```bash
npm run wwhn-153:self-test
npm run wwhn-153:verify
npm run wwhn-153:runtime -- --contract-only
npm run wms-contract:verify
npm run test -- src/test/wwhn-153-final-signoff-policy.test.ts
npm run typecheck
npm run build
```

Manual QA2 live run dùng workflow `WWHN-153 Sign-off Integrity`, chọn DEV/UAT, nhập immutable `build_id`, cấu hình ba probe JSON có `effectProbe`.

## 7. External handoff không được giả PASS

Trạng thái Jira lúc rà soát 2026-08-06:

- WWHN-31: In Progress
- WWHN-151: To Do
- WWHN-152: In Progress
- WWHN-180: Done nhưng evidence vẫn phải khớp exact official hash trong manifest
- WWHN-182: In Progress
- WWHN-183: In Progress

Do đó FE remediation có thể hoàn tất, nhưng final project không thể tuyên bố 100% cho đến khi owner độc lập điền evidence thật và `wwhn-153:final` PASS.

## 8. Evidence để đóng từng owner

- **BE1 + BE2**: OpenAPI/schema official, version, backend SHA, artifact/changelog path+SHA256, publisher accounts độc lập.
- **BE2**: WWHN-151 module schema/API artifact exact hash.
- **QA1**: WWHN-152 reviewedArtifacts chứa cả official và module hash; constraints/error/testability PASS; reviewer không phải publisher.
- **QA2**: chạy live runner trên exact FE source/build/env; attach nguyên artifact gồm summary, request/response, SHA256SUMS, digest.
- **BE/RBAC + BA + FE**: duyệt catalog/runtime hash và endpoint→permission→role mapping.
- **BA**: WWHN-183 `GO`, exact source SHA/artifact digest, minutes hash, open P0/P1=0.

## 9. Jira closure comment format

```text
WWHN-153 — FE remediation commit
Branch: m1
Pre-remediation parent: e36750ae5a6163f6a8c0bfb6f5a0259c6c306829
Authoritative source: <exact commit SHA from GitHub>
Tree: <tree SHA>
CI run: <run URL/id>
Integrity artifact: wwhn-153-signoff-integrity-<SHA>
Integrity result: <PASS/FAIL>; open P0/P1/P2: <derived counts>
Final allowed: NO until WWHN-31/151/152/182/183 and permission approval pass exact-hash validation.
```

## 10. Definition of Done

### FE-owned remediation

- [x] Policy v4 fail-closed và dynamic risk count.
- [x] Exact source provenance, superseded SHA disposition.
- [x] Runtime effect proof, separate artifacts, request_id, secret hygiene.
- [x] Permission catalog/runtime/package binding.
- [x] Self-test và TypeScript regression.
- [x] CI immutable evidence và manual QA2 mode.
- [x] Runbook, architecture alignment và closure matrix.
- [x] Cross-contract legacy ID compatibility và baseline artifact trigger/upload.

### Cross-role final

- [ ] WWHN-31 official release PASS.
- [ ] WWHN-151 module schema PASS.
- [ ] WWHN-152 QA1 exact-hash review PASS.
- [ ] WWHN-182 QA2 live runtime package PASS.
- [ ] Permission approval PASS.
- [ ] WWHN-183 BA `GO`, P0/P1=0.
- [ ] `npm run wwhn-153:final` PASS trên exact authoritative commit/build.
