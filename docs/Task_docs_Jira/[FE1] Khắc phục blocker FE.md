# WWHN-268 - [FE1] Khắc phục blocker FE

## 1. Thông tin Jira và traceability

| Trường | Giá trị |
| --- | --- |
| Jira task | WWHN-268 |
| Tiêu đề | [FE1] Khắc phục blocker FE |
| Link nguồn | https://tan0110.atlassian.net/browse/WWHN-268 |
| Loại issue | Subtask |
| Trạng thái khi đọc | In Progress |
| Priority | Medium |
| Assignee | Quang Nguyễn Thanh |
| Reporter | Wuangg |
| Created | 2026-07-19 21:28:24 +0700 |
| Updated trên Jira | 2026-08-01 20:17:54 +0700 |
| Task cha | WWHN-70 - [QA][BETA] Regression đầy đủ cho kiểm kê/đảo giao dịch/bảo hành/PV/báo cáo |
| Dependency | HN-QA-005-ST01 |
| Parent Temp Key | HN-QA-005 |
| Epic Temp Key | HN-EPIC-10 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Output đầu ra | FE lỗi đã khắc phục |
| Ngày cập nhật tài liệu | 2026-08-01 ICT |

Tài liệu này là artifact bàn giao cho WWHN-268. Phạm vi bám đúng Description của Jira:
khắc phục các blocker thuộc vai trò FE1 trong đợt QA/BETA regression của WWHN-70, không tự mở
rộng sang thay đổi nghiệp vụ, API contract hoặc dữ liệu nếu chưa có xác nhận từ BA/BAS/BE.

## 2. Mục tiêu được phân rã

Mục tiêu Jira ghi ngắn là **Khắc phục blocker FE**, nhưng với phạm vi QA/BETA regression, cần hiểu
đây không phải việc sửa giao diện bề mặt. FE1 phải đưa toàn bộ blocker thuộc frontend về một trong
hai trạng thái rõ ràng:

- Đã khắc phục, đã có evidence để BA/QA kiểm lại.
- Chưa thể khắc phục vì thiếu input/contract/environment, nhưng đã có disposition gồm owner và ETA.

Các lớp kiểm bắt buộc:

| Lớp kiểm | Câu hỏi cần trả lời | Kết quả cần đạt |
| --- | --- | --- |
| Baseline nghiệp vụ | UI có phản ánh đúng rule kiểm kê, đảo giao dịch, bảo hành, PV và báo cáo theo task cha không? | Không tự suy diễn rule; mọi điểm thiếu hoặc lệch phải trace về BA/BAS hoặc task cha. |
| API contract | Endpoint, payload, validation, error code và permission có đúng nguồn BE1/BE2 đã duyệt không? | FE chỉ tích hợp contract đã duyệt; mismatch được ghi blocker và không âm thầm đổi contract. |
| UI state | Màn hình có loading, empty, error, success, disabled và confirm khi phù hợp không? | Người dùng không bị kẹt trạng thái, không bấm lặp action nguy hiểm, không mất feedback sau mutation. |
| RBAC | Route/action/API 403 có hiển thị đúng và không hard-code permission trái contract không? | Route guard, action guard và API error nhất quán; BE vẫn là authority cho security/data scope. |
| Responsive | Các màn nghiệp vụ chính có dùng được trên desktop/tablet/mobile không? | Không tràn layout, không che action, bảng/form/modal/drawer có breakpoint hoặc scroll hợp lý. |
| Evidence | BA/QA có đủ command log, screenshot/video, account/role, viewport, environment để nghiệm thu không? | Evidence có ngày giờ, route/module, role/account, command và pass/fail rõ. |

## 3. Input đầu vào từ Jira và cách sử dụng

| Input | Ý nghĩa | Cách FE1 sử dụng |
| --- | --- | --- |
| Task cha WWHN-70 | Nguồn regression đầy đủ cho kiểm kê, đảo giao dịch, bảo hành, PV và báo cáo. | Mọi lỗi FE cụ thể phải trace về scenario/evidence trong WWHN-70 hoặc HN-QA-005-ST01. |
| Dependency HN-QA-005-ST01 | Nguồn dữ liệu regression, baseline, account/role hoặc evidence cần cho QA/BETA. | Nếu thiếu dữ liệu mẫu, quyền test, endpoint hoặc expected UI thì ghi blocker, owner và ETA. |
| Baseline nghiệp vụ | Rule, field specification, Acceptance Criteria và điểm đã chốt từ BA/BAS. | Không hard-code rule tồn kho, trạng thái chứng từ, bảo hành hoặc báo cáo ngoài baseline. |
| API/UI specification | Endpoint, payload, validation, error code, permission từ BE1/BE2 và BA. | Đối chiếu service/type/error parser/RBAC trước khi sửa UI; mismatch phản hồi ngay. |
| Dữ liệu mẫu và evidence | Screenshot/video/log trong task cha hoặc Source & Traceability. | Dùng làm before/after evidence; không thay thế bằng nhận định không có bằng chứng. |

## 4. Vai trò và phối hợp

| Bên | Trách nhiệm | Điểm phối hợp bắt buộc |
| --- | --- | --- |
| FE1 - Quang Nguyễn Thanh | Chủ sở hữu sửa blocker frontend, evidence FE, lint/build/test và tài liệu bàn giao. | Chỉ sửa frontend surface, state handling, wiring, RBAC UX và error display thuộc phạm vi FE. |
| BA/BAS | Cung cấp rule nghiệp vụ, UI/UX, field spec, Acceptance Criteria và điểm chưa chốt. | Xác nhận wording, enum/status, required/optional field và expected behavior trước nghiệm thu. |
| BE1/BE2 | Cung cấp endpoint, payload, validation, error code, permission và dữ liệu mẫu. | Xử lý contract mismatch; cung cấp sample payload/error cho scenario không reproduce local được. |
| DevOps | Cung cấp build/environment nếu blocker phụ thuộc runtime. | Xác nhận base URL, deployed build, env, CORS/cookie và health/runtime nếu lỗi chỉ xuất hiện trên UAT. |
| QA | Reproduce, regression, kiểm evidence, xác nhận pass/fail. | Kiểm tra lại bằng đúng account/role, viewport, dữ liệu và route đã ghi trong evidence. |

## 5. Baseline kỹ thuật trong repo

| Nhóm | Nguồn repo | Vai trò trong WWHN-268 |
| --- | --- | --- |
| Router/RBAC | `src/app/router/access.ts`, `src/app/router/RequirePermission.tsx`, `src/app/router/ProtectedRoute.tsx` | Route guard, anonymous redirect, no-permission routing. |
| Permission/action guard | `src/lib/permissions`, `src/shared/components/permission`, `src/modules/auth/components/Can.tsx` | Hide/disable action theo permission code và data scope. |
| Auth/session/API error | `src/shared/api/axios.ts`, `src/shared/api/api-error.ts`, `src/shared/components/feedback/ApiErrorAlert.tsx` | 401 refresh, 403 no-permission, 422 field error, 409 conflict, 500/network. |
| UI state shared | `src/shared/components/data-display`, `src/shared/components/forms`, `src/shared/components/feedback` | Loading, empty, error, success, disabled, confirm, table/form/modal/drawer pattern. |
| WMS modules | `src/modules/inventory`, `src/modules/reversal`, `src/modules/warranty`, `src/modules/reports`, `src/modules/stocktake`, `src/modules/receiving`, `src/modules/shipping`, `src/modules/scan` | Surfaces chính cần regression trong task cha WWHN-70. |
| Evidence/tests | `src/test`, `e2e`, `scripts/check-frontend-health.mjs`, `scripts/check-api-mapping.mjs` | Unit/integration/e2e và health/API mapping evidence. |

## 6. Phạm vi blocker FE theo module

| Module/surface | Blocker FE cần xử lý sâu | Evidence cần có |
| --- | --- | --- |
| Kiểm kê/Stocktake | List session, count lines, apply adjustment, variance display, confirm action nguy hiểm, disabled khi thiếu dữ liệu/idempotency. | Before/after cho list/detail/action; role có quyền và thiếu quyền; 422/409/403 nếu có sample BE. |
| Đảo giao dịch/Reversal | Tạo đảo giao dịch, reference validation, trạng thái pending/success/error, confirm, không tự tính tồn kho trên FE. | Route/form/action evidence; payload/error sample; confirm cancel không tạo side effect. |
| Bảo hành/Warranty | Status/enum, form/table responsive, rule TEMP_ONLY nếu có, error khi status transition không hợp lệ. | Field spec BA, account/role, screenshot desktop/tablet/mobile, API validation evidence. |
| PV/Physical Codes/Scan | Phân loại mã, duplicate/unknown/success/error state, mobile scanning flow, loading khi classify. | Evidence mobile và desktop; `scan.classify` hoặc permission tương ứng; error code từ BE nếu có. |
| Báo cáo/Reports | Filter, export XNT/revenue, empty khi không có dữ liệu, loading export, error khi API/export fail. | Screenshot filter/export; role xem/export; log request hoặc mock evidence nếu QA cung cấp. |
| Inventory | Balance/movement filter, pagination, table responsive, data-scope theo active context. | Role/account theo context; empty filtered state; API 403/no-permission. |
| Receiving/Shipping liên quan regression | Post receipt/post issue action phải không mở sai khi thiếu payload/idempotency; error list/detail không bị nuốt. | Evidence action disabled/confirm/error; endpoint canonical nếu QA đụng luồng nhập/xuất. |
| App shell/shared state | Sidebar/header/content, table/form/modal/drawer responsive, `ApiErrorAlert`, `NoPermissionState`. | Screenshot 1440x900, 768x1024, 390x844 cho màn bị ảnh hưởng. |

## 7. Disposition blocker FE hiện tại

| Mã | Loại | Mô tả | Owner | Điều kiện đóng | Severity |
| --- | --- | --- | --- | --- | --- |
| WWHN-268-FE-01 | FE verification | Lint/test/build/health cần pass sau lượt xử lý blocker để BA/QA có baseline kỹ thuật. | FE1 | `npm.cmd run lint`, `npm.cmd run test -- --run`, `npm.cmd run build`, `npm.cmd run health:check` pass. | P1 |
| WWHN-268-FE-02 | UI/RBAC state | Các blocker thuộc UI state, RBAC route/action và API error phải dùng shared pattern, không hard-code quyền/rule. | FE1 | Với mỗi lỗi cụ thể từ WWHN-70, có file/code surface, evidence before/after và pass QA. | P1/P0 tùy lỗi |
| WWHN-268-BE-01 | Contract dependency | Nếu endpoint/payload/error/permission cho stocktake/reversal/warranty/PV/reports thiếu hoặc lệch, FE không được tự sửa contract. | BE1/BE2 + BA/BAS | Contract được duyệt hoặc có Jira/comment disposition; FE cập nhật service/types sau khi được chốt. | P1 |
| WWHN-268-QA-01 | Evidence dependency | Jira WWHN-268 không liệt kê từng lỗi cụ thể, chỉ tham chiếu task cha WWHN-70 và HN-QA-005-ST01. | QA + BA + FE1 | Danh sách lỗi cụ thể có module, route, account/role, viewport, environment, expected/actual. | P1 cho sign-off |
| WWHN-268-DEVOPS-01 | Runtime dependency | Lỗi chỉ xuất hiện trên UAT/BETA cần build version, env và API base URL để reproduce. | DevOps + QA | Cung cấp deployed build/env hoặc FE có thể reproduce/capture evidence trên môi trường tương ứng. | P1 nếu đang chặn QA |

Kết luận disposition: tại thời điểm cập nhật tài liệu, các gate kỹ thuật FE đã pass. Không ghi nhận
P0/P1 mới thuộc FE mà không có disposition trong artifact này; các điểm còn lại phụ thuộc danh sách
lỗi cụ thể và input từ WWHN-70/HN-QA-005-ST01.

## 8. Quy trình xử lý từng blocker

| Bước | Việc cần làm | Output |
| --- | --- | --- |
| 1. Nhận lỗi | Ghi module, route, account/role, permission, viewport, env, build, expected/actual, screenshot/video/log. | Một dòng tracker lỗi có đủ trace. |
| 2. Phân loại | UI state, responsive, RBAC route, RBAC action, API error, contract mismatch, data issue hoặc runtime issue. | Owner FE/BA/BE/QA/DevOps rõ. |
| 3. Đối chiếu baseline | So với BA spec, API contract, permission catalog, shared component pattern và task cha. | Không tự suy diễn rule; mismatch có comment/disposition. |
| 4. Sửa FE đúng scope | Sửa component/page/service/type/error display/action guard trong phạm vi FE. | File thay đổi và lý do thay đổi rõ. |
| 5. Kiểm thử | Chạy test trọng điểm, lint/build nếu ảnh hưởng shared, route/RBAC hoặc build runtime. | Command log pass/fail. |
| 6. Capture evidence | Chụp cùng scenario trước/sau, đủ role, viewport và state liên quan. | Evidence đủ cho BA/QA verify. |
| 7. Chốt disposition | Fixed hoặc blocked có owner/ETA. | Không còn P0/P1 "trôi" chưa owner. |

## 9. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Evidence / đánh giá | Trạng thái |
| --- | --- | --- |
| Output "FE lỗi đã khắc phục" được rà soát/xác minh, gắn evidence vào HN-QA-005 và không còn blocker thuộc FE1. | File này là artifact rà soát WWHN-268; lint/test/build/health đã pass ngày 2026-08-01. | Pass phần gate FE, cần attach vào HN-QA-005/WWHN-268 và bổ sung evidence từng lỗi từ WWHN-70. |
| UI đáp ứng quy tắc nghiệp vụ, field specification và responsive; xử lý loading, empty, error, success, disabled và confirm khi phù hợp. | Baseline shared UI state đã có; checklist module ở mục 6 nêu rõ điểm cần verify. | Pass nền tảng, cần QA/BA xác nhận trên từng scenario regression. |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu hoặc quy tắc trái contract. | Có `RequirePermission`, action guard, `ApiErrorAlert`, 403/422/409 handling; tài liệu nhấn mạnh không tự đổi contract. | Pass nền tảng; permission catalog cuối cần BE/RBAC sign-off nếu WWHN-70 yêu cầu. |
| Tích hợp đúng endpoint/payload đã duyệt; lint, build và test phù hợp phải pass. | Lint/test/build pass. Endpoint/payload chỉ được coi là pass từng module khi có contract đã duyệt và evidence từ WWHN-70. | Pass gate kỹ thuật; pass contract theo từng lỗi cụ thể. |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Mục 7 có owner/điều kiện đóng; mục 10 có command log. | Pass disposition hiện tại; cần QA gắn danh sách lỗi cụ thể nếu còn phát sinh. |

## 10. Verification log

Thực hiện tại `C:\HoaNamFE\Hoa_Nam_Tools` ngày 2026-08-01 ICT, dùng `npm.cmd` trên Windows.

```text
npm.cmd run lint
Result: PASS - exit code 0

npm.cmd run test -- --run
Result: PASS - 35 test files, 297 tests
Note: Vitest/Vite warning non-blocking về __dirname trong vitest.config.ts với configLoader native tương lai.

npm.cmd run build
Result: PASS - tsc -b và vite build hoàn tất; 3368 modules transformed
Note: Vite warning non-blocking về __dirname trong vite.config.ts với configLoader native tương lai.

npm.cmd run health:check
Result: PASS - Frontend build exposes /health.json and index.html.
```

Build artifacts quan sát:

| Artifact | Trạng thái |
| --- | --- |
| `dist/index.html` | Có sau build. |
| `dist/assets/*` | Có sau build; chunk lớn nhất `vendor-antd` khoảng 1,276.77 kB raw / 387.03 kB gzip. |
| `dist/health.json` | Có và pass health check. |

## 11. Checklist BA/QA nghiệm thu

| Nhóm kiểm | Checklist |
| --- | --- |
| Traceability | Mỗi lỗi có link WWHN-70/HN-QA-005-ST01, module/route, account/role, viewport, env và trạng thái fixed/blocked. |
| UI state | Loading, empty, error, success, disabled, confirm xuất hiện đúng trong workflow bị ảnh hưởng. |
| Responsive | Desktop 1440x900, tablet 768x1024, mobile 390x844 không tràn layout, không che action, bảng/form/modal/drawer thao tác được. |
| RBAC route/action | Anonymous, user thiếu quyền, user đủ quyền, super admin/context được kiểm theo expected. |
| API error | 401/403/422/409/500 có message/state đúng; `PASSWORD_CHANGE_REQUIRED` không bị lẫn với 403 generic. |
| Contract | Endpoint, payload, validation, error code và permission trùng nguồn BE/BA đã duyệt. |
| Regression | Shared component bị sửa được smoke test ở ít nhất một module đại diện ngoài module lỗi chính. |
| Evidence | Có before/after screenshot/video/log, command pass/fail, role/account, viewport, env, build/version. |

## 12. Definition of Done đánh giá

| DoD từ Jira | Điều kiện đóng | Trạng thái hiện tại |
| --- | --- | --- |
| Code, review, lint/build/test, evidence UI và traceability hoàn tất. | Code sửa theo từng blocker, có review/PR hoặc note review, command pass, evidence UI. | Gate lint/test/build/health pass; evidence UI cần bổ sung theo danh sách lỗi cụ thể từ WWHN-70. |
| Contract mismatch đã được xử lý hoặc có disposition; tài liệu component/build được cập nhật khi cần. | Mismatch endpoint/payload/permission/error có owner BA/BE/DevOps và ETA. | Có cơ chế disposition trong mục 7; chưa có mismatch cụ thể mới ngoài dependency đầu vào. |
| BA/QA có thể kiểm tra theo Acceptance Criteria; không còn blocker chưa có owner và ETA. | Checklist BA/QA rõ, blocker table không có dòng thiếu owner. | Đạt về tài liệu và gate FE; cần attach artifact/evidence vào Jira để BA/QA nghiệm thu. |

## 13. Output bàn giao

Output Jira yêu cầu: **FE lỗi đã khắc phục**.

Output trong repo:

- `docs/Task_docs_Jira/[FE1] Khắc phục blocker FE.md`

Output cần gắn vào HN-QA-005/WWHN-268 khi đóng task:

- Tài liệu này.
- Danh sách lỗi regression cụ thể từ WWHN-70/HN-QA-005-ST01, mỗi lỗi có fixed/blocked disposition.
- Evidence before/after cho kiểm kê, đảo giao dịch, bảo hành, PV, báo cáo hoặc module liên quan.
- Log lint/test/build/health ở mục 10.
- Blocker còn lại nếu có, mỗi blocker có owner và ETA.

## 14. Kết luận FE1

WWHN-268 đã được phân rã thành artifact thực thi đầy đủ cho FE blocker: có traceability Jira, input,
vai trò phối hợp, baseline kỹ thuật, ma trận module regression, quy trình xử lý từng blocker,
disposition owner/ETA, Acceptance Criteria mapping, DoD mapping và verification log.

Trạng thái hiện tại: **FE technical gate pass, ready for BA/QA verification with concrete WWHN-70
evidence**. Không còn gate lint/test/build/health thuộc FE đang chặn. Các phần chưa thể chốt hoàn
toàn nằm ở danh sách lỗi cụ thể, dữ liệu regression, contract hoặc environment từ WWHN-70/HN-QA-005-ST01.
