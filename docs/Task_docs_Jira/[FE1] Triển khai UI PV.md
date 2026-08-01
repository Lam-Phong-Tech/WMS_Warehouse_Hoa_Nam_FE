# WWHN-252 - [FE1] Triển khai UI PV

## 1. Thông tin Jira và traceability

| Trường | Giá trị |
| --- | --- |
| Jira task | WWHN-252 |
| Link nguồn | https://tan0110.atlassian.net/browse/WWHN-252 |
| Tiêu đề | [FE1] Triển khai UI PV |
| Issue type | Subtask |
| Trạng thái khi đọc | To Do |
| Priority | Medium |
| Assignee | Quang Nguyễn Thanh |
| Reporter | Wuangg |
| Created | 2026-07-19 21:28:24 +0700 |
| Updated trên Jira | 2026-07-28 15:17:42 +0700 |
| Task cha | WWHN-66 - [FE][APP PV] Responsive Hàng chờ, Tra cứu và detail UI |
| Dependency | HN-PV-001 |
| Parent Temp Key | HN-FE-008 |
| Epic Temp Key | HN-EPIC-09 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Output đầu ra | PV FE |
| Ngày cập nhật tài liệu | 2026-08-01 ICT |

Tài liệu này là artifact phân rã và bàn giao cho WWHN-252. Description Jira ghi mục tiêu ngắn là "Triển khai UI PV", nhưng input và Acceptance Criteria yêu cầu FE1 không chỉ dựng màn hình: phải bám baseline nghiệp vụ, contract API/UI, RBAC, responsive, UI states, evidence và disposition cho mọi mismatch.

## 2. Diễn giải sâu mục tiêu

Mục tiêu "Triển khai UI PV" cần được hiểu là triển khai bề mặt frontend cho App PV theo baseline Web App responsive read-only. PV ở đây là kênh xem/tra cứu sản phẩm đã publish, không phải module bán hàng và không phải nơi tạo nghiệp vụ kho.

| Lớp mục tiêu | FE1 phải đạt | Không được làm |
| --- | --- | --- |
| List sản phẩm PV | Hiển thị danh sách sản phẩm active và `published_to_app = true`, có ảnh, tên, SKU/model, category/tag/ngành nghề, `available_qty`, trạng thái Còn hàng/Hết hàng. | Không hiển thị sản phẩm inactive/chưa publish, không hard-code sản phẩm mẫu làm bằng chứng production. |
| Search/filter/sort | Có tìm kiếm nhanh theo tên, SKU, model, category, từ khóa có dấu/không dấu nếu contract hỗ trợ; filter ngành nghề, nhóm máy, dòng pin, tình trạng hàng; sort theo mới nhất/phổ biến/còn hàng nếu có field. | Không lọc client-side để thay rule visibility hoặc data scope đã thuộc BE contract. |
| Detail sản phẩm | Hiển thị ảnh, mô tả, thông số kỹ thuật, bảo hành, phụ kiện tương thích, ngành nghề phù hợp, sản phẩm liên quan, `available_qty`, `last_inventory_sync_at`/`data_as_of` nếu có. | Không lộ serial, item code, carton, box, tray, movement, phiếu nhập/xuất, giá vốn, chi phí bảo hành hoặc tồn đại lý. |
| Read-only stock | Hiển thị `available_qty` kho tổng và trạng thái: `available_qty > 0` là Còn hàng, `available_qty = 0` là Hết hàng. | Không có cart/order/reservation/payment, không giữ hàng, không trừ tồn, không tạo Inventory_Movement hoặc agency stock. |
| Freshness/degraded | Nếu PV dùng cache/read model, hiển thị hoặc log thời điểm đồng bộ tồn cuối; stale > 5 phút phải có cảnh báo dữ liệu có thể chậm nếu contract cung cấp timestamp. | Không khẳng định realtime khi chỉ có cache; không suy đoán số lượng khi chưa từng sync. |
| UI states/RBAC/API error | Loading, empty, error, success/degraded, disabled và retry rõ; 403/no permission không làm lộ dữ liệu; 422/409/412/428 hiển thị theo shared pattern. | Không nuốt lỗi thành empty; không tự suy diễn permission hoặc error code. |
| Evidence | Có ảnh desktop/tablet/mobile, role/permission matrix, API request/response hoặc mock contract có nguồn, lint/build/test log và blocker disposition. | Không sign-off nếu còn P0/P1 blocker FE1 chưa owner/ETA. |

## 3. Input đầu vào từ Jira và cách sử dụng

| Input từ Jira | Ý nghĩa | Cách FE1 sử dụng |
| --- | --- | --- |
| Task cha WWHN-66 | Nguồn scope trực tiếp cho "[FE][APP PV] Responsive Hàng chờ, Tra cứu và detail UI". | Trace mọi màn PV list/search/detail/responsive về WWHN-66/HN-FE-008; nếu task cha có queue/hàng chờ cụ thể thì không tự bỏ. |
| Dependency HN-PV-001 | Baseline nghiệp vụ/API/UI cho App PV. | Dùng làm nguồn khóa endpoint, payload, field, enum, cache freshness, permission; thiếu contract thì ghi blocker cho BA/BE. |
| Baseline nghiệp vụ | App PV read-only, active/published only, available_qty kho tổng, không stock effect. | Không tự mở rộng sang bán hàng, đặt hàng, giữ hàng, thanh toán, tồn đại lý hoặc native app/offline. |
| API/UI specification | Endpoint list/detail/search/filter/recommendation/admin publish, validation, error code, permission. | Đối chiếu service/type/RBAC trước khi code; mismatch phải phản hồi ngay, không sửa contract âm thầm. |
| Dữ liệu mẫu và evidence | Dùng để chứng minh list/detail/search/filter, empty/error/degraded và responsive. | Ghi rõ nguồn dữ liệu mẫu; không dùng mock local như bằng chứng đã tích hợp nếu BE chưa sẵn sàng. |

## 4. Vai trò và phối hợp

| Bên | Trách nhiệm | Điểm phối hợp bắt buộc |
| --- | --- | --- |
| FE1 - Quang Nguyễn Thanh | Chủ trì UI PV, wiring service/type, responsive, UI states, RBAC UX, evidence và tài liệu bàn giao. | Chỉ triển khai phần frontend; không tự chốt nghiệp vụ publish, cache, field hoặc visibility. |
| BA/BAS | Cung cấp rule nghiệp vụ, UI/UX, field specification, Acceptance Criteria và điểm chưa chốt. | Chốt danh sách field hiển thị, wording trạng thái tồn, rule ngành nghề/tag/recommendation và degraded copy. |
| BE1/BE2 | Cung cấp endpoint, payload, validation, error code, permission và dữ liệu mẫu. | Khóa response shape cho list/detail/search/filter, `available_qty`, `last_inventory_sync_at`, 403/422/409/412/428. |
| DevOps | Cung cấp build/environment nếu PV phụ thuộc runtime, CDN/image/cache hoặc env. | Xác nhận base URL, public route, image asset/CDN, cache TTL, CORS/cookie nếu có. |
| BA/QA | Nghiệm thu theo AC, responsive, RBAC, UI states và evidence. | Kiểm đúng role, viewport, dữ liệu published/unpublished, in-stock/out-of-stock và stale cache. |

## 5. Baseline nghiệp vụ PV đã đọc

| Nguồn | Baseline rút ra | Tác động FE |
| --- | --- | --- |
| BA Master - BASE-11 | App PV là Web App responsive read-only; chỉ active/published; hiển thị `available_qty` kho tổng; không cart/order/reservation/payment/stock effect. | UI không được có CTA tạo đơn/giữ hàng/thanh toán; mọi stock display là read-only. |
| BA Master - PV-VIS-001..006 | Chỉ hiện sản phẩm active + published; chỉ hiện tồn tổng theo SKU; không lộ dữ liệu vận hành; nếu có cache cần `last_inventory_sync_at`. | List/search/filter/deep link phải ẩn unpublished/inactive; detail không lộ serial/container/movement. |
| BA Master - F-PV-1.1..1.11 | List, detail, search, filter, available_qty, recommendation, industry groups, related/accessories là Must; order/hold/payment là Won't. | Scope UI gồm list/detail/search/filter/recommendation/related; loại bỏ chức năng transactional. |
| BA Master - BP-WMS-11 | Đầu vào là PV Product Profile, published flag, ngành nghề/tag, Inventory_Balance available_qty; đầu ra là list/detail/recommendation + freshness. | FE cần type rõ cho profile/tag/industry/balance/freshness và degraded state. |
| BA Master - SCR-PV-01/02/ADM-01 | PV list/detail/admin cần skeleton, empty, inline error + request_id, success/degraded, responsive 360/768/1280+. | Evidence phải capture ít nhất 390x844, 768x1024, 1366/1440 desktop. |
| Wireframe P0 | Ghi rõ wireframe P0 hiện loại toàn bộ màn App PV và quản trị publish; chỉ có vài điểm tham chiếu ở Master SKU/Physical Code. | Không dùng wireframe P0 như screen spec PV cuối; cần WWHN-66/HN-PV-001 hoặc BA xác nhận wireframe PV riêng. |

## 6. Đối chiếu repo hiện tại

| Surface | File/nguồn | Đã có | Khoảng trống với WWHN-252 |
| --- | --- | --- | --- |
| Route/module PV public | `src/shared/constants/routes.ts`, `src/app/router/access.ts`, `src/app/layouts/menu.tsx` | Chưa thấy route/module riêng cho App PV public list/detail trong app shell hiện tại. | Cần xác nhận PV nằm trong repo này hay một public app/route riêng; nếu trong repo này cần thêm route không lẫn với WMS protected shell. |
| Master SKU publish metadata | `src/modules/master-data/pages/MasterPage.tsx`, docs HN-FE-002 | Có baseline Master Data nhắc `published_to_app`, available tổng và không lộ serial/carton/movement. | Admin publish profile PV chưa được xác nhận đủ contract; Master Data từng đánh dấu Physical Code ngoài phạm vi khi thiếu OpenAPI. |
| Scan/Physical Codes | `src/modules/scan/pages/PhysicalCodesPage.tsx`, `scanService.ts`, `types/index.ts` | Có state machine scan classify, route permission `inventory.trace`/`scan.classify`, endpoint `POST /scan-batches/classify`. | Đây là bề mặt WM/scan, không thay thế App PV list/detail sản phẩm. Còn mojibake label trong code output cần sửa trước evidence nếu ảnh hưởng UI. |
| Endpoint PV | `src/shared/api/endpoints.ts`, `swagger-api.json` | Chưa thấy constant rõ tên `PV_*` cho product profile/list/detail/recommendation/freshness trong frontend. | P1 contract blocker: cần BE cung cấp canonical endpoints và response. |
| UI states shared | `src/shared/components/data-display`, `src/shared/components/feedback` | Có `LoadingState`, `EmptyState`, `ErrorState`, `ApiErrorAlert`, `NoPermissionState`, table/form pattern. | PV UI phải tái sử dụng shared pattern thay vì tự làm state rời rạc. |
| Permission | `src/app/router/access.ts`, `src/shared/components/permission` | Có pattern route/action guard. | Cần permission catalog PV: public read, `pv.publish`, admin/profile edit nếu scope quản trị thuộc WWHN-66. |

Kết luận đối chiếu: repo đã có nền tảng WMS, shared UI state, RBAC và scan/physical-code readiness, nhưng chưa đủ bằng chứng đã có App PV list/detail/search/filter đúng nghĩa. WWHN-252 vì vậy cần được coi là **implementation task có dependency contract HN-PV-001**, không chỉ là cập nhật tài liệu.

## 7. Yêu cầu chi tiết UI PV

### 7.1 PV List

PV List là màn đầu tiên người xem thấy, cần ưu tiên thao tác tra cứu nhanh và quyết định mở chi tiết. Mỗi card/row tối thiểu cần có ảnh đại diện, tên sản phẩm, SKU/model, category/ngành nghề/tag, `available_qty`, trạng thái Còn hàng/Hết hàng, và timestamp dữ liệu nếu contract trả `last_inventory_sync_at` hoặc `data_as_of`.

Expected states:

| State | Expected UI |
| --- | --- |
| Loading | Skeleton/card placeholder, không nhảy layout, search/filter disabled hoặc giữ input nhưng không gửi trùng request. |
| Empty | Giải thích theo filter hiện tại, có action clear filter; empty vì không có match khác với lỗi API. |
| Error | Alert inline có retry, giữ filter hiện tại, hiển thị request_id nếu API trả. |
| Degraded/stale | Banner "Dữ liệu tồn có thể chậm" kèm thời điểm sync nếu tuổi dữ liệu > 5 phút. |
| No permission/hidden product | Không lộ unpublished/inactive qua list/search/filter. |

### 7.2 Search, filter và recommendation

Search cần hỗ trợ tên, SKU, model, category và từ khóa tiếng Việt có dấu/không dấu nếu HN-PV-001 xác nhận. Filter theo baseline gồm ngành nghề, nhóm máy/category, loại/dòng pin, có dây/không dây, phụ kiện tương thích, còn hàng/hết hàng và khoảng `available_qty` nếu API hỗ trợ.

Recommendation MVP dùng rule cấu hình, không dùng AI. UI chỉ hiển thị recommendation khi BE trả danh sách hoặc rule đã duyệt; nếu chưa có contract, đặt blocker thay vì hard-code danh sách ưu tiên.

### 7.3 PV Detail

Detail cần trả lời đủ câu hỏi: sản phẩm là gì, dùng cho ngành nghề nào, thông số nào đáng chú ý, còn bao nhiêu hàng khả dụng ở kho tổng, phụ kiện/sản phẩm liên quan là gì, dữ liệu tồn cập nhật lúc nào. Không hiển thị serial/item/container/movement hoặc giá vốn.

Field tối thiểu:

| Nhóm | Field |
| --- | --- |
| Identity | SKU, model, name, brand, category, alias nếu có. |
| Media/content | Image gallery, mô tả, specification, warranty info. |
| PV metadata | Published status chỉ cho admin scope nếu có, featured/sort_order nếu thuộc quản trị. |
| Stock read-only | `available_qty`, stock status, `last_inventory_sync_at`/`data_as_of`. |
| Discovery | Industry tags, filter tags, accessories/related products, recommendation reason nếu có. |

### 7.4 Hàng chờ / admin publish nếu thuộc WWHN-66

Jira parent nhắc "Responsive Hàng chờ, Tra cứu và detail UI". Vì Description WWHN-252 không nêu chi tiết hàng chờ, FE1 cần xác nhận từ WWHN-66/HN-PV-001. Nếu "hàng chờ" là queue quản trị publish PV, expected UI phải có:

| Surface | Expected |
| --- | --- |
| Queue list | Danh sách profile/SKU cần hoàn thiện ảnh/spec/tag/industry/publish, trạng thái Draft/Published/Unpublish/Warn. |
| Validation | Thiếu ảnh/spec/tag/industry phải hiển thị warning theo field, không cho publish nếu baseline yêu cầu. |
| Action | Publish/unpublish chỉ cho Admin/QL kho hoặc permission `pv.publish`; action irreversible/deactivate cần confirm và reason nếu contract yêu cầu. |
| Traceability | Log người publish, thời điểm publish, version/If-Match nếu BE áp dụng optimistic locking. |

Nếu WWHN-66 chỉ yêu cầu hàng chờ xem/tra cứu cho người dùng PV, cần BA/BE cập nhật tên surface và API tương ứng.

### 7.5 Responsive

PV là Web App responsive, không phải native/offline trong MVP. Breakpoint evidence tối thiểu:

| Viewport | Kỳ vọng |
| --- | --- |
| 390x844 mobile | Search/filter dùng drawer/sheet hoặc wrap gọn; card không tràn; detail media/spec/stock dễ đọc; không có horizontal scroll mất action chính. |
| 768x1024 tablet | Grid 2 cột hoặc layout list ổn định; filter không che card; detail giữ hierarchy thông tin. |
| 1366/1440 desktop | Search/filter/sidebar hoặc toolbar đầy đủ; list/detail không quá thưa; trạng thái tồn/freshness rõ. |

## 8. API, payload, error và RBAC cần khóa

| Nhóm contract | Cần BE/BA xác nhận | Gợi ý FE type |
| --- | --- | --- |
| Product list | Endpoint, pagination, search keyword, filters, sort, returned fields, image URL policy. | `PvProductListItem`, `PvProductListParams`, `PvPagedResponse`. |
| Product detail | Endpoint theo slug/id/SKU, profile/spec/accessories/related, unpublished deep link behavior. | `PvProductDetail`, `PvAccessory`, `PvRelatedProduct`. |
| Availability | Source `Inventory_Balance.available_qty`, `data_as_of`, `last_inventory_sync_at`, stale threshold, zero stock wording. | `PvAvailability { available_qty, stock_status, last_inventory_sync_at, data_as_of }`. |
| Industries/tags | Endpoint hoặc embedded list, enum/code/name/status, sort order. | `PvIndustry`, `PvFilterTag`. |
| Recommendation | Rule source, params, response order, empty behavior. | `PvRecommendationRuleResult`. |
| Admin publish | Endpoint toggle/profile update, validation, version/If-Match, permission. | `PvProfileUpdateRequest`, `PvPublishRequest`. |
| Error | 403, 404 unpublished, 422 invalid filter/profile, 409 duplicate/conflict, 412 stale version, 428 missing precondition, 500/network. | Reuse `ApiErrorAlert` and field error mapping. |
| RBAC | Public read or authenticated read, `pv.publish`, `pv.profile.manage`, `inventory.trace` không thay thế PV read permission. | Route/action guard via existing permission helpers. |

Open blocker hiện tại: chưa thấy frontend endpoint constant `PV_*` rõ trong `src/shared/api/endpoints.ts`; `swagger-api.json` cần được BE/BA chỉ ra phần PV canonical hoặc bổ sung OpenAPI nếu thiếu.

## 9. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Đánh giá FE1 | Evidence/cần bổ sung |
| --- | --- | --- |
| Output "PV FE" được rà soát/xác minh, gắn evidence vào HN-FE-008 và không còn blocker FE1. | Tài liệu này phân rã scope và gap. Chưa thấy code route/module App PV list/detail đầy đủ trong repo. | Cần gắn tài liệu, screenshot, log API, lint/build/test vào HN-FE-008/WWHN-252. |
| UI đáp ứng quy tắc nghiệp vụ, field specification và responsive; xử lý loading, empty, error, success, disabled, confirm khi phù hợp. | Nền shared UI state có sẵn; PV UI riêng chưa xác minh. | Cần implement/capture list/detail/search/filter/queue/admin publish nếu thuộc scope. |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu hoặc quy tắc trái contract. | Pattern RBAC có sẵn; permission PV chưa khóa. | Cần role evidence: public/authorized viewer, no permission admin publish, Admin/QL kho publish. |
| Tích hợp đúng endpoint/payload đã duyệt; lint, build và test phù hợp pass. | Chưa xác nhận endpoint/payload HN-PV-001 trong frontend. | Cần contract BE và targeted unit/page/service tests sau khi wire API. |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Có blocker table bên dưới với owner/disposition. | Cần BA/BE/QA close hoặc cập nhật ETA cho các P1. |

## 10. Blocker, rủi ro và disposition

| ID | Mức | Nội dung | Owner | Disposition cần có |
| --- | --- | --- | --- | --- |
| WWHN-252-BE-01 | P1 | Chưa khóa canonical endpoint/response cho PV list/detail/search/filter/recommendation/freshness trong frontend. | BE1/BE2 + BA/BAS | Cung cấp OpenAPI/sample hoặc xác nhận section hiện có trong `swagger-api.json`; FE tạo service/type theo contract. |
| WWHN-252-BA-01 | P1 | Parent WWHN-66 nhắc "Hàng chờ" nhưng WWHN-252 không mô tả chi tiết surface hàng chờ. | BA/BAS + PO | Chốt hàng chờ là queue publish/admin hay queue tra cứu người dùng; cung cấp wireframe/AC cụ thể. |
| WWHN-252-FE-01 | P1 | Chưa thấy module/route App PV public list/detail trong repo hiện tại; chỉ có WMS protected shell và scan/physical-code module. | FE1 | Tạo route/module PV đúng app target sau khi contract được khóa; không gộp nhầm với Scan. |
| WWHN-252-FE-02 | P1 | UI labels trong scan/PV-adjacent code có mojibake ở `PhysicalCodesPage.tsx`; có thể ảnh hưởng evidence nếu module liên quan được nghiệm thu. | FE1 | Sửa encoding/label tiếng Việt trước khi chụp evidence hoặc xác nhận không thuộc scope PV. |
| WWHN-252-RBAC-01 | P1 | Permission catalog PV chưa rõ: public read, authenticated viewer, `pv.publish`, profile manage, admin queue. | BE2/RBAC owner + BA | Chốt permission code và expected 403/no permission behavior. |
| WWHN-252-DEVOPS-01 | P2 | PV nếu là public web app có thể cần env/base URL/CDN/image/cache config khác WMS protected app. | DevOps + FE1 | Cung cấp env/runtime, image storage rule, cache TTL và deploy target. |
| WWHN-252-QA-01 | P1 | Chưa có evidence responsive/RBAC/API states gắn WWHN-252/HN-FE-008. | QA + FE1 | Capture desktop/tablet/mobile, published/unpublished, in-stock/out-of-stock, stale/error/empty states. |

## 11. Checklist triển khai FE1

| Nhóm | Checklist |
| --- | --- |
| Contract | Khóa HN-PV-001: endpoints, params, response fields, error codes, permission, cache freshness, image URL policy. |
| Routing | Xác định PV là public route trong cùng app hay app/module riêng; không ép vào WMS protected layout nếu user PV không đăng nhập. |
| Types/service | Tạo `pvService`, type list/detail/filter/recommendation/availability/admin publish theo contract. |
| List UI | Product card/table, search, filter, sort, pagination/infinite load, available_qty/status, stale indicator. |
| Detail UI | Image gallery, spec, warranty, accessories, related/recommendation, stock read-only, freshness/degraded. |
| Queue/admin | Nếu thuộc scope: queue incomplete/pending publish, validation field, publish/unpublish action, confirm/reason/version. |
| UI states | Loading, empty, error + request_id, retry, disabled invalid filter, success/degraded, no permission. |
| RBAC | Public/published read, admin publish/profile manage, no-permission state, backend 403 display. |
| Privacy/security | Không lộ serial/item/container/movement/giá vốn/tồn đại lý; không có cart/order/hold/payment. |
| Responsive | Evidence 390x844, 768x1024, 1366/1440; filter/card/detail không tràn layout. |
| Test/build | Targeted tests cho service mapper, page states, permission gates; `npm.cmd run lint`, `npm.cmd run test -- --run`, `npm.cmd run build`. |
| Evidence | Screenshot states, request/response sample, role/account, viewport, command log, blocker owner/ETA. |
| Traceability | Ghi rõ WWHN-252, WWHN-66, HN-PV-001, HN-FE-008, HN-EPIC-09 trong PR/evidence. |

## 12. Definition of Done đánh giá

| DoD từ Jira | Điều kiện đóng | Trạng thái hiện tại |
| --- | --- | --- |
| Code, review, lint/build/test, evidence UI và traceability hoàn tất. | Có code PV list/detail/search/filter/queue nếu scope, review/PR, command pass, screenshot/log. | Chưa đủ để sign-off; tài liệu phân rã đã hoàn tất, implementation cần contract HN-PV-001. |
| Contract mismatch đã được xử lý hoặc có disposition; tài liệu component/build được cập nhật khi cần. | Mọi thiếu endpoint/field/permission/freshness có owner BA/BE/DevOps và ETA. | Có blocker disposition trong mục 10; cần confirm từ BA/BE. |
| BA/QA có thể kiểm tra theo Acceptance Criteria; không còn blocker chưa có owner và ETA. | Checklist BA/QA rõ, evidence gắn HN-FE-008/WWHN-252. | Chưa có evidence UI mới; cần capture sau implementation. |

## 13. Output bàn giao

Output Jira yêu cầu: **PV FE**.

Output trong repo:

- `docs/Task_docs_Jira/[FE1] Triển khai UI PV.md`

Output cần gắn vào HN-FE-008/WWHN-252 khi đóng task:

- Tài liệu này.
- Contract HN-PV-001 hoặc link OpenAPI/sample payload đã duyệt.
- Screenshot/video PV list, search/filter, detail, empty/error/degraded, responsive.
- Evidence RBAC/public visibility: published vs unpublished/inactive, viewer vs admin publish.
- Log lint/test/build và test targeted.
- Blocker còn lại nếu có, mỗi blocker có owner và ETA.

## 14. Kết luận FE1

WWHN-252 đã được phân rã từ một mô tả Jira rất ngắn thành checklist triển khai sâu cho App PV: rõ mục tiêu, input, baseline nghiệp vụ, phối hợp BA/BE/QA/DevOps, mapping Acceptance Criteria, DoD, rủi ro và blocker owner.

Trạng thái đề xuất: **Ready for contract lock and implementation, not ready for production sign-off yet**. FE1 có thể bắt đầu dựng PV UI ngay sau khi HN-PV-001 khóa endpoint/field/permission hoặc có mock contract chính thức; nếu contract còn thiếu, cần comment blocker WWHN-252-BE-01/WWHN-252-BA-01 lên Jira để bảo toàn traceability.
