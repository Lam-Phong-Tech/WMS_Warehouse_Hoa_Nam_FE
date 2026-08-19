# WWHN-309 — Biên nhận contract backend phía FE

| Trường | Giá trị |
| --- | --- |
| Task nguồn | WWHN-309 — [BE] Hoàn thiện tài liệu kiến trúc/API/vận hành |
| Task FE liên quan | WWHN-311 — [FE1] Hoàn thiện tài liệu build/component FE |
| Repo FE | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`, nhánh `m1` |
| Repo BE | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE`, nhánh `m1` |
| Cập nhật | 2026-08-19 |
| BE candidate SHA đã pin | `8326d505e5c7c2b690a02ae3a41c5c91119d5ed7` (nguồn: `docs/api-evidence/BE_CONTRACT_PIN.json`) |

Tài liệu này ghi lại **phía FE đã nhận gì từ backend handover và đã kiểm chứng bằng cách nào**. FE **không** ký thay DEV cho WWHN-309; đây là biên nhận của bên tiêu thụ contract.

---

## 1. Vấn đề trước đây

`swagger-api.json` nằm trong `.gitignore` của repo FE, nên mặc định không có trong máy. Khi thiếu file đó, `scripts/check-api-mapping.mjs` tự hạ cấp:

```text
[api-mapping] WARNING: swagger-api.json is unavailable: validating FE constants/registers
              only; this is not BE OpenAPI sign-off.
```

Nghĩa là phần đối chiếu FE ↔ BE **không thực sự chạy**, và cũng không có cách chuẩn nào để lấy đúng spec ở đúng commit. WWHN-311 đã ghi nhận điểm này: "Formal lock endpoint/payload/error/sample/permission cho backend handover vẫn thuộc WWHN-309/BA".

## 2. BE đã publish gì (WWHN-309)

| Artifact | Đường dẫn trong repo BE |
| --- | --- |
| OpenAPI 3.0 (được commit) | `storage/api-docs/api-docs.json` và `.yaml` |
| Contract bàn giao cho FE/QA | `docs/api-contract/HN-BE-API-001_API_CONTRACT_HANDOVER.md` |
| Catalog error code (sinh tự động) | `docs/api-contract/HN-BE-API-002_ERROR_CODE_CATALOG.md` |
| Ma trận endpoint × permission | `docs/api-contract/HN-BE-API-003_ENDPOINT_PERMISSION_MATRIX.md` |
| Số liệu contract chính thức (sinh tự động) | `docs/api-contract/HN-BE-API-004_CONTRACT_METRICS.md` |
| Kiến trúc as-built | `docs/architecture/HN-BE-ARCH-001_BACKEND_ARCHITECTURE.md` |
| Runbook vận hành | `docs/ops/HN-BE-OPS-001_OPERATIONS_RUNBOOK.md` |

Vì OpenAPI được **commit vào repo BE**, FE lấy được contract theo **exact SHA** thay vì "bản mới nhất trên máy ai đó".

## 3. Cách FE lấy và kiểm chứng

```bash
npm run contract:sync -- <BE_SHA>     # tải OpenAPI của BE tại đúng commit
npm run check:api-mapping             # đối chiếu endpoint/permission FE ↔ BE
```

Chạy offline khi có repo BE cục bộ:

```bash
npm run contract:sync -- --from ../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE
```

Script cảnh báo khi dùng `m1` thay vì exact SHA, và khi spec tải về không có `ApiErrorEnvelope` (dấu hiệu bản BE cũ trước WWHN-309).

## 4. Kết quả kiểm chứng

Đối chiếu `docs/api-evidence/M1_API_MAPPING.md`, `M2_DEPENDENCY_LIST.md`, `M3_DEPENDENCY_LIST.md` với OpenAPI thật của BE:

```text
[api-mapping] docs/api-evidence/M1_API_MAPPING.md: 31 endpoint rows
[api-mapping] docs/api-evidence/M2_DEPENDENCY_LIST.md: 10 endpoint rows
[api-mapping] docs/api-evidence/M3_DEPENDENCY_LIST.md: 15 endpoint rows
[api-mapping] PASS: 56 documented rows checked (4 explicitly fail-closed);
              current MVP paths and permissions are internally consistent.
```

Cảnh báo còn lại (không phải lỗi): `GET /safe-stock-alerts`, `/safe-stock-alerts/history`, `/safe-stock-configs` được đánh dấu fail-closed/pending trong M2 — đúng như thiết kế, FE không gọi các endpoint này.

Bất biến MVP được script kiểm cùng lúc và đều đạt: không có endpoint/permission stocktake, `SCAN_BATCHES_CLASSIFY` vẫn là `/scan/classify`, đủ bộ permission bắt buộc.

## 5. Điểm FE cần lưu ý theo contract mới

1. **Envelope đọc được từ spec.** Mọi response đều `$ref` tới `ApiSuccessEnvelope` hoặc `ApiErrorEnvelope`; FE sinh type từ spec được, không cần đọc ngược code BE.
2. **`error_code` và `error.code` luôn bằng nhau.** Bắt lỗi theo `error_code`, không bắt theo `message`.
3. **`Idempotency-Key`** — số operation khai và số bắt buộc đọc ở `HN-BE-API-004`. Thiếu ở endpoint bắt buộc → **428**. Cùng key + cùng payload = replay an toàn; cùng key + payload khác → **409**. FE nên sinh key theo hành động nghiệp vụ để retry mạng không tạo bản ghi trùng.
4. **`If-Match`** — số operation khai đọc ở `HN-BE-API-004`. Sai version → **412 `STALE_VERSION`**: tải lại bản ghi, lấy `version` mới, gửi lại. Không retry mù.
5. **`meta.request_id`** có ở mọi response — luôn kèm khi báo lỗi cho BE.
6. **Route guard của FE là UX guard.** Biên phân quyền thật nằm ở BE; ẩn nút không phải biện pháp bảo mật.

## 6. Ranh giới

- FE xác nhận **đã nhận đủ contract để tích hợp và kiểm chứng được**.
- FE **không** ký thay BE1 cho Backend handover, không ký thay QA/DevOps/BAS, không tự đóng WWHN-83.
- Khi pin evidence sign-off, phải ghi **cả hai** exact SHA (FE và BE) đã dùng để chạy `check:api-mapping`.

## 7. Chống lệch revision (WWHN-309 / DEV309-P1-02)

Vòng review trước bắt lỗi: *"exact same-revision artifacts chưa pin"* — FE và QA có thể đang
đọc hai bản OpenAPI khác nhau mà cả hai đều báo PASS.

Đã đóng bằng `docs/api-evidence/BE_CONTRACT_PIN.json`:

1. Pin khai **BE SHA + SHA-256 của spec**, không chỉ khai "lấy từ m1".
2. `npm run contract:sync` so hash sau khi tải; lệch là **exit 1** kèm hướng dẫn lấy đúng
   revision. Đổi contract có chủ đích thì bắt buộc `--repin` và bắt buộc truyền exact SHA
   40 ký tự (không nhận branch).
3. `npm run check:api-mapping` **từ chối** kết luận sign-off nếu `swagger-api.json` không
   khớp pin — trước đây thiếu file thì nó tự hạ cấp và vẫn in PASS.

Kiểm chứng đã chạy: sửa một byte trong `swagger-api.json` ⇒ `check:api-mapping` FAIL đúng
chỗ (`swagger-api.json không khớp BE_CONTRACT_PIN.json`), khôi phục ⇒ PASS 56 dòng.
