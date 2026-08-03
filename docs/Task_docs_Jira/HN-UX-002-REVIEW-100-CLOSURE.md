# HN-UX-002 - Kế hoạch chốt review đạt 100

Cập nhật: 2026-08-03 ICT  
Phạm vi: chốt cho 72/100 hạng mục review bao gồm HN-UX-002, ánh xạ API, QA2, bằng chứng contract BE, bằng chứng runtime, chuẩn hóa service, và cảnh báo Vite/Vitest.

## Kết luận hiện tại

Repo này hiện đã có các guard và bằng chứng do FE sở hữu cho tất cả các hạng mục mà FE1 có thể chốt cục bộ. Việc chấp nhận cuối cùng 100/100 vẫn yêu cầu bằng chứng từ bên ngoài của BA/BAS, QA2, BE1/BE2, và Tech Lead ở những hạng mục mà reviewer đã chỉ định rõ chủ sở hữu đó.

FE không được đánh dấu sign-off sản xuất cuối cùng là pass cho đến khi các artifact bên ngoài đó được đính kèm. Guard code `src/shared/api/wms-contract-signoff.ts` cố ý giữ `finalAllowed: false` cho đến khi các cổng bên ngoài được thỏa mãn.

## Ma trận chốt P1/P2

| Mức | Vấn đề review | Sửa chữa bắt buộc | Chủ sở hữu | Trạng thái repo | Bằng chứng / hành động tiếp theo |
| --- | --- | --- | --- | --- | --- |
| P1 | HN-UX-002-ST01 chưa được chốt thực tế | BAS hoàn tất field/state matrix WWHN-146; BA hoàn tất rule/label/validation WWHN-147 | BAS + BA | Blocker bên ngoài đang mở | `WMS_FINAL_SIGNOFF.blockers` hiện liệt kê WWHN-146 và WWHN-147. Đính kèm matrix/rules đã được duyệt trong Jira trước khi pass cuối cùng. |
| P1 | QA2 chưa review testability | QA2 test UI state/responsive/RBAC/API error/testability và comment pass/fail | QA2 | Blocker bên ngoài đang mở | Được guard bởi `QA2-TESTABILITY-REVIEW`; QA2 phải đính kèm build/env/browser, pass/fail, screenshot/video, và ghi chú defect. |
| P1 | Script ánh xạ API fail do thiếu `docs/api-evidence/M1_API_MAPPING.md` | Cung cấp evidence file hoặc cập nhật script có approval; chạy lại `check:api-mapping` pass | FE1 + BE/BA | FE đã chốt cục bộ; BE/BA vẫn cần approval cho các ngoại lệ contract | File đã tồn tại: `docs/api-evidence/M1_API_MAPPING.md`. Lệnh chạy lại ngày 2026-08-03: `npm.cmd run check:api-mapping -- --no-live` pass với 0 lỗi. Cảnh báo còn lại: độ phủ endpoint là 45 dòng mapping so với 288 swagger routes và runtime permission catalog bị bỏ qua do không có credentials. |
| P1 | Contract/permission/sample data còn conditional | BE1/BE2 xác nhận endpoint, payload, error code, permission catalog, sample 403/409/422/idempotency | BE1/BE2 | Blocker bên ngoài đang mở | Được guard bởi `BE-CONFIRMATION-EVIDENCE`; FE services enforce idempotency/If-Match ở nơi đã triển khai, nhưng BE phải publish samples và permission catalog. |
| P1 | Bằng chứng runtime chưa đủ | Đính kèm screenshot/video desktop/tablet/mobile, kịch bản role, trạng thái lỗi API | FE1 + QA | Blocker bên ngoài đang mở | Scripts đã tồn tại cho role, 403, responsive, và capture API-error. QA/FE phải đính kèm artifacts từ build/env mục tiêu, không chỉ bằng chứng unit cục bộ. |
| P2 | Chuẩn hóa service nhiều biến thể field | Sau khi BE lock contract, giảm fallback normalization và cập nhật type/schema chính thức | FE1 + BE | FE đã guard; chờ BE lock | Được guard bởi `SERVICE-NORMALIZATION`; không xóa fallbacks trước khi có schema chính thức vì code hiện tại bảo vệ chống lại các biến thể response BE đã quan sát được. |
| P2 | Cảnh báo Vite/Vitest chưa xử lý | Tách task kỹ thuật nếu cần nâng config loader | FE1/Tech Lead | FE đã guard; không chặn | Được guard bởi `VITE-VITEST-CONFIG-WARNING`; lint/test/build hiện tại không bị chặn. Chỉ tạo task Tech Lead nếu kế hoạch nâng cấp yêu cầu migration config-loader gốc. |

## Lần chạy xác minh FE

| Lệnh | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm.cmd run check:api-mapping -- --no-live` | Pass | 0 lỗi method/path. Runtime permission catalog bị bỏ qua vì test credentials chưa được cấu hình. |
| `npm.cmd run uat:p0p1:verify` | Pass | Các tài liệu/scripts sẵn sàng P0/P1 bắt buộc đều có mặt và chứa các mẫu traceability mong đợi. |

## Bằng chứng cần đính kèm để đạt điểm tối đa

| Bằng chứng | Chủ sở hữu bắt buộc | Nội dung tối thiểu chấp nhận được |
| --- | --- | --- |
| WWHN-146 field/state matrix | BAS | Danh sách field đã duyệt, state matrix, quy tắc state empty/loading/error/success/disabled/confirm, version/date/approver. |
| WWHN-147 rule/label/validation baseline | BA | Labels đã duyệt, validations, business rules, error copy, version/date/approver. |
| Review testability QA2 | QA2 | Pass/fail rõ ràng cho UI state, responsive desktop/tablet/mobile, RBAC route/action, API 403/409/422, retry/idempotency, và comment testability. |
| Bộ contract BE | BE1/BE2 | OpenAPI/Postman/schema version/hash/changelog, danh sách endpoint, payload request/response, error codes, permission catalog, sample 403/409/422/idempotency replay. |
| Bằng chứng visual runtime | FE1 + QA | Thư mục screenshot/video cho desktop/tablet/mobile, kịch bản role, trạng thái lỗi API, build ID/commit/env/browser. |
| Task nợ kỹ thuật | FE1/Tech Lead | Quyết định về cảnh báo Vite/Vitest config-loader: chấp nhận là không chặn hoặc liên kết task kỹ thuật. |

## Template comment Jira

```text
FE1 cập nhật 2026-08-03:

- Đã thêm guard repo cho tất cả 72/100 hạng mục review trong src/shared/api/wms-contract-signoff.ts và src/test/wms-contract-signoff-guards.test.ts.
- Đã thêm artifact chốt docs/Task_docs_Jira/HN-UX-002-REVIEW-100-CLOSURE.md.
- Đã chạy lại npm.cmd run check:api-mapping -- --no-live: PASS, 0 lỗi method/path.
- Đã chạy lại npm.cmd run uat:p0p1:verify: PASS.

Việc chốt do FE sở hữu đã hoàn tất cho sự hiện diện của evidence file, kiểm tra ánh xạ API, và guard regression. 100/100 cuối cùng vẫn yêu cầu BAS WWHN-146, BA WWHN-147, bằng chứng pass/fail QA2, bộ contract+permission+sample data BE1/BE2, screenshot/video runtime trên build/env mục tiêu, và quyết định của Tech Lead cho cảnh báo Vite/Vitest.