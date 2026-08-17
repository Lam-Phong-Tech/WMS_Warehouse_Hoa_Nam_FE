# WWHN-148 — QA2 Runtime Evidence Runbook

Canonical task doc: `docs/Task_docs_Jira/WWHN-148.md` (contract, fail-closed matrix và scope boundary được định nghĩa tại đó; runbook này chỉ mô tả cách sinh evidence runtime).

## Mục tiêu

Runbook này quy định evidence runtime bắt buộc để QA2 đóng `WWHN-149` và cung cấp đầu vào hợp lệ cho `WWHN-182`/`WWHN-183`. Controlled mock, local fixture, screenshot không có build/env/SHA hoặc blob-image comment không được dùng làm final evidence.

## Điều kiện trước khi chạy

QA2 phải ghi rõ:

- FE source SHA chính xác trên `m1`.
- Immutable build ID và deployment URL của named DEV/UAT environment.
- Backend SHA, OpenAPI version và OpenAPI SHA256.
- QA2 account, role, browser/version, device/viewport và thời điểm thực thi.
- Credential do QA quản lý; log/artifact phải redact Authorization, Cookie, token và secret.

Nếu thiếu một trường trên, kết quả là `INVALID_EVIDENCE`, không phải PASS có điều kiện.

## Ma trận thực thi bắt buộc

| ID | Nhóm | Thao tác | Điều kiện PASS | Evidence tối thiểu |
| --- | --- | --- | --- | --- |
| RT-01 | Responsive | Chạy luồng chính ở 1440×900, 1024×768, 390×844 | Không overflow; action/field chính hiển thị đúng | screenshot + trace từng viewport |
| RT-02 | UI states | Kích hoạt loading, empty, error, success, disabled, confirm | State đúng label/rule; không state mâu thuẫn | video/trace + request ID |
| RT-03 | Route RBAC | User thiếu permission truy cập route protected | UI chuyển 403/no-permission; không render dữ liệu protected | screenshot + network trace |
| RT-04 | Action RBAC | User thiếu permission mở trang hợp lệ | Action bị ẩn/disabled đúng baseline; direct API vẫn deny | screenshot + direct API 403 |
| RT-05 | Validation | Gửi payload sai field | HTTP 422; field mapping đúng; submit retry-safe | raw request/response đã redact |
| RT-06 | Conflict | Tạo business conflict | HTTP 409; UI không tạo side effect sai | raw request/response + DB/API evidence |
| RT-07 | Idempotency replay | Gửi cùng key/cùng payload hai lần | Cùng business result; không side effect lần hai | hai request/response + request IDs |
| RT-08 | Idempotency conflict | Gửi cùng key/payload khác | HTTP 409; không business write lần hai | raw request/response |
| RT-09 | Stale write | Gửi `If-Match` cũ | HTTP 409 hoặc 412; UI hướng dẫn refresh/retry | raw request/response |
| RT-10 | Security hygiene | Kiểm tra lỗi 4xx/5xx | Không stack trace, SQL, path nội bộ, token/secret | response body + redaction report |
| RT-11 | Traceability | Đối chiếu request ID | UI/API/audit hoặc backend log truy vết cùng request ID | request ID mapping |

## Cấu trúc artifact

```text
WWHN-148-runtime-<FE_SHA>/
├── build-metadata.json
├── qa2-execution.json
├── contract-metadata.json
├── requests/
├── responses/
├── screenshots/
├── videos/
├── traces/
├── request-id-map.json
├── redaction-report.json
├── result-summary.json
├── SHA256SUMS
└── WWHN-148_RUNTIME_ARTIFACT_DIGEST.txt
```

`result-summary.json` phải có từng scenario với `PASS | FAIL | NOT_RUN`, defect ID hoặc `NONE`, executedAt và reviewer. Final QA2 result chỉ là `PASS` khi không có `FAIL/NOT_RUN` ở scenario bắt buộc.

## Quy tắc SHA256 và truy vết

1. Tạo SHA256 cho từng file sau khi redact.
2. Tạo `SHA256SUMS` theo thứ tự path ổn định.
3. Tạo digest cho toàn package và ghi vào `WWHN-148_RUNTIME_ARTIFACT_DIGEST.txt`.
4. Comment Jira phải nêu filename, FE SHA, BE SHA, build ID, environment, artifact URL, digest, tổng pass/fail/not-run và defect IDs.
5. Không dùng blob URL, ảnh dán trực tiếp hoặc branch URL động làm evidence canonical.

## Kết luận hợp lệ

- `PASS`: tất cả scenario bắt buộc pass, exact identifiers khớp, artifact hash hợp lệ.
- `FAIL`: có ít nhất một scenario fail.
- `INVALID_EVIDENCE`: thiếu named env/build/SHA/hash/identity hoặc artifact không kiểm chứng được.

`CONDITIONAL` không mở final sign-off. BA chỉ được ghi `GO` khi QA2 là `PASS`, WWHN-146/147 approved, WWHN-180/182 pass và open P0/P1 bằng 0.
