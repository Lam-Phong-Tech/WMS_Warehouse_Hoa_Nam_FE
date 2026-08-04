# [FE1] Triển khai UI bảo hành

## 1. Jira source và phạm vi

- Jira: WWHN-247 - `[FE1] Triển khai UI bảo hành`
- Link: https://tan0110.atlassian.net/browse/WWHN-247
- Issue type: Subtask
- Parent: WWHN-64 - `[FE][WARRANTY] UI yêu cầu, rà soát và lịch sử bảo hành`
- Assignee: Quang Nguyễn Thanh
- Role: FE1
- Priority: Medium
- Status khi đọc: To Do
- Labels: Committed, FE1, HoaNam, Wave-3
- Dependency: HN-WAR-001
- Parent Temp Key: HN-FE-007
- Epic Temp Key: HN-EPIC-08
- Assignee Placeholder: HN-FE-01
- Output đầu ra theo Jira: `bảo hành FE`

Task này không phải chỉ dựng một bảng warranty đơn giản. FE1 phải hoàn thiện UI bảo hành theo baseline nghiệp vụ, contract API, RBAC, trạng thái UI, responsive và evidence để BA/QA có thể kiểm thử end-to-end.

## 2. Mục tiêu cần đạt

Triển khai UI bảo hành cho luồng tiếp nhận, rà soát/tracking trạng thái và lịch sử xử lý case bảo hành. UI phải thể hiện đúng rule:

- Bảo hành có mã không làm tăng tồn bán.
- Case TEMP_ONLY không gắn item gốc, không suy đoán máy đã bán.
- Mỗi item chỉ có tối đa một active warranty case tại một thời điểm.
- Khi nhận máy có mã, item chuyển sang trạng thái bảo hành; khi trả khách, item về trạng thái trả khách, không tự cộng lại vào tồn bán.
- PII của khách hàng phải được mask theo quyền; full view/export PII cần quyền riêng và phải có audit/purpose.

## 3. Input đầu vào phải bám

### 3.1. Input từ Jira

- Task cha: WWHN-64 - UI yêu cầu, rà soát và lịch sử bảo hành.
- Dependency nghiệp vụ/API: HN-WAR-001.
- Baseline nghiệp vụ, API/UI specification, dữ liệu mẫu và evidence lấy từ task cha hoặc Source & Traceability.
- FE1 không tự suy diễn rule nghiệp vụ hoặc đổi API contract. Nếu thiếu endpoint, payload, validation, error code, permission hoặc sample data thì phải ghi blocker với owner/ETA.

### 3.2. Baseline BA/UI đã tìm thấy trong repo

- `BA_HOA_NAM/WMS_HoaNam_Wireframe_P0.html`
  - `SCR-WAR-01`, `F-WM-7.1..7.6`.
  - Màn 9A: Danh sách bảo hành, search Case/mã máy/SĐT, filter Định danh/Bệnh/Trạng thái, action Tiếp nhận bảo hành.
  - Màn 9B: Chi tiết case và timeline trạng thái.
  - Màn 9C: Form tiếp nhận bảo hành.
  - Màn 9D: Trường conditional cho TEMP_ONLY.
  - Màn 9E: Privacy control cho PII.
- `BA_HOA_NAM/Tài liệu tổng hợp BA/HN_BA_Master_WMS_PV_v1_0_MD/HN_BA_Master_WMS_PV_v1_0.md`
  - `BASE-04`: Warranty không tự tạo Inventory_Movement.
  - `BASE-10`: Warranty có mã không làm tăng tồn bán; TEMP_ONLY không gắn item gốc; một active case/item; RETURNED_TO_CUSTOMER không tự thành IN_STOCK.
  - Warranty map với `REQ-SRS-016, 028`, `BP-WMS-08..09`.
  - Privacy baseline áp dụng cho case có mã và TEMP_ONLY: consent, full view, masking, search, export, retention, purge/anonymize.
  - `FM-WAR-001`: Phiếu tiếp nhận bảo hành gồm item/temp code, PII/consent, defect, accessories/photo, handoff.

### 3.3. Code hiện tại liên quan

- Route: `src/shared/constants/routes.ts` có `/warranty`.
- Menu/RBAC route gate: `src/app/router/access.ts` dùng `warranty.manage`.
- Endpoint constants:
  - `WARRANTY_CASES`: `/warranty/cases`
  - `WARRANTY_CASE`: `/warranty/cases/:id`
  - `WARRANTY_CASE_EVENTS`: `/warranty/cases/:caseId/events`
  - `WARRANTY_UPDATE_STATUS`: `/warranty/cases/:id/status`
- Service: `src/modules/warranty/services/warrantyService.ts`
  - `fetchWarrantyCases()`
  - `fetchWarrantyCaseEvents()`
  - `createWarrantyCase()`
  - `updateWarrantyCaseStatus()`
  - `fetchWarrantyCase()`
- Types: `src/modules/warranty/types/index.ts`
  - `WarrantyCase`
  - `WarrantyEvent`
  - `CreateWarrantyCaseRequest`
  - `UpdateWarrantyStatusRequest`
  - `WarrantyDefect`
  - `WarrantyErrorCode`
- Page: `src/modules/warranty/pages/WarrantyPage.tsx`
  - Đã có tab danh sách và lịch sử trạng thái.
  - Đã gọi API danh sách/events.
  - Còn thiếu nhiều phần sign-off nêu ở mục gap.

## 4. Luồng UI cần hoàn thiện

### 4.1. Danh sách bảo hành

Mục tiêu: BA/QA nhìn được toàn bộ case đang xử lý, phân biệt case có mã và TEMP_ONLY, thao tác tiếp nhận/cập nhật nhanh.

Yêu cầu UI:

- Search theo case code, item/serial/physical code, SKU/model, SĐT khách trong phạm vi quyền.
- Filter:
  - Định danh: `IDENTIFIED`, `TEMP_ONLY`.
  - Bệnh/lỗi.
  - Trạng thái.
  - Kho/phòng bảo hành hoặc scope nếu BE trả dữ liệu theo data scope.
- Table tối thiểu:
  - Case code.
  - Định danh.
  - Item/temporary item code hoặc mô tả máy.
  - SKU/model.
  - Khách gửi và SĐT đã mask nếu thiếu `warranty.pii.view`.
  - Bệnh/lỗi.
  - Ngày nhận.
  - Trạng thái.
  - Tuổi case.
  - Action: mở chi tiết, cập nhật, in/hiển thị mã temp nếu TEMP_ONLY.
- Empty state phải nói rõ không có case theo bộ lọc hiện tại, không dùng mock data.
- Loading state phải giữ layout ổn định.
- Error state phải hiển thị lỗi API/permission có thể hiểu được và có action thử lại.

### 4.2. Chi tiết case và timeline

Mục tiêu: rà soát lịch sử bảo hành và chứng minh trạng thái xử lý.

Yêu cầu UI:

- Header chi tiết: case code, status, identification type, priority, ngày nhận, ngày dự kiến trả, ngày trả nếu có.
- Thông tin máy:
  - Case có mã: item/serial/physical code, SKU/model, trạng thái item hiện tại.
  - TEMP_ONLY: temporary item code, lý do mất/không có mã, mô tả nhận diện máy, cảnh báo không trace về item gốc.
- Thông tin khách:
  - Tên/SĐT mask mặc định theo quyền.
  - Full PII chỉ hiện khi role có quyền tương ứng và không ghi raw PII vào log UI.
- Timeline event:
  - RECEIVED
  - CHECKING
  - REPAIRING
  - COMPLETED
  - RETURNED
  - CANCELLED
- Mỗi event nên có thời gian, người thao tác, trạng thái cũ/mới, ghi chú/reason.
- Trạng thái terminal phải disable action không hợp lệ.

### 4.3. Form tiếp nhận bảo hành

Mục tiêu: tạo case bảo hành đúng rule, không tạo dữ liệu sai contract.

Field bắt buộc cho mọi case:

- Trạng thái định danh: `IDENTIFIED` hoặc `TEMP_ONLY`.
- Tên khách gửi.
- Số điện thoại.
- Bệnh/lỗi.
- Mô tả lỗi ban đầu hoặc defect description nếu BE yêu cầu.
- Consent/purpose tối thiểu cho contact/photo nếu baseline/API đã có field.

Case `IDENTIFIED`:

- Scan/nhập mã máy/item/serial/physical code.
- FE phải gọi endpoint validate/lookup nếu BE cung cấp; nếu chưa có contract thì ghi blocker, không tự hard-code lookup.
- Nếu item đang có active case hoặc không ở state hợp lệ, UI phải chặn submit và hiển thị reason từ API.

Case `TEMP_ONLY`:

- Không gửi item_code/item_id gốc.
- Required:
  - `missing_code_reason`
  - `manual_product_description`
  - defect/customer fields
- `temporary_item_code` do hệ thống sinh sau khi lưu; FE chỉ hiển thị kết quả trả về.
- UI phải có banner cảnh báo: không liên kết máy đã bán, không dùng để xác nhận lịch sử bán hàng, không sinh stock movement.

### 4.4. Cập nhật trạng thái

Mục tiêu: chuyển trạng thái có kiểm soát, trace được reason/evidence.

Luồng baseline:

| From | Action | To | Stock effect | Ghi chú |
| --- | --- | --- | --- | --- |
| RECEIVED | Begin checking | CHECKING | 0 | CANCELLED cần reason và evidence trả máy nếu đang giữ vật lý. |
| CHECKING | Begin repair | REPAIRING | 0 | Không skip trực tiếp sang RETURNED. |
| REPAIRING | Complete processing | COMPLETED | 0 | COMPLETED chưa phải đã trả máy. |
| COMPLETED | Handoff machine to customer | RETURNED | 0 | RETURNED/CANCELLED terminal. |

Code hiện tại đang có enum lệch một phần (`OPEN`, `PROCESSING`, `WAITING_PARTS`, `READY`, `CLOSED`, `RETURNED_TO_CUSTOMER`). Cần BE/BA xác nhận enum final. Trước khi sign-off, FE phải đồng bộ types, UI tag, filter và transition action theo contract đã duyệt.

### 4.5. Privacy/RBAC

Yêu cầu:

- Route `/warranty` đang gate bằng `warranty.manage`.
- Full PII cần quyền riêng theo baseline: `warranty.pii.view`.
- Export PII cần `warranty.pii.export`, reason/purpose và audit. Nếu feature export chưa thuộc scope FE1 thì tài liệu/evidence phải ghi rõ không implement ở WWHN-247 và trỏ sang ticket/report tương ứng.
- User thiếu quyền PII vẫn xem được case code, status, SKU/model/defect và SĐT/tên đã mask đủ để vận hành.
- Không log raw phone/customer PII trong console, error boundary hoặc tracking.

## 5. API contract cần xác minh

### 5.1. Endpoint hiện FE đang dùng

| Nghiệp vụ | FE endpoint hiện tại | Hàm service |
| --- | --- | --- |
| Danh sách case | `GET /warranty/cases` | `fetchWarrantyCases` |
| Chi tiết case | `GET /warranty/cases/:id` | `fetchWarrantyCase` |
| Lịch sử event | `GET /warranty/cases/:caseId/events` | `fetchWarrantyCaseEvents` |
| Tạo case | `POST /warranty/cases` | `createWarrantyCase` |
| Cập nhật status | `PATCH /warranty/cases/:id/status` | `updateWarrantyCaseStatus` |

Wireframe BA có nhắc `/warranty-cases`, `/status`, `/return`, còn code hiện dùng `/warranty/cases`. Đây là điểm cần xác nhận bằng contract BE locked. Không đổi endpoint theo wireframe nếu OpenAPI/BE đã duyệt path khác.

### 5.2. Payload tối thiểu cần BE xác nhận

Tạo case:

```ts
type CreateWarrantyCaseRequest = {
  identification_type: "IDENTIFIED" | "TEMP_ONLY";
  item_code?: string;
  temporary_item_code?: string; // response-only nếu BE tự sinh
  sku?: string;
  customer_name: string;
  customer_phone: string;
  defect_code: string;
  defect_description: string;
  missing_code_reason?: string;
  manual_product_description?: string;
  notes?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};
```

Cập nhật trạng thái:

```ts
type UpdateWarrantyStatusRequest = {
  status: "RECEIVED" | "CHECKING" | "REPAIRING" | "COMPLETED" | "RETURNED" | "CANCELLED";
  reason?: string;
  idempotency_key?: string;
};
```

Nếu BE trả enum khác, FE phải map theo contract thật và ghi rõ deviation trong PR/evidence. Không để UI hard-code enum giả định.

### 5.3. Error code cần xử lý trên UI

Hiện type có:

- `WMS_WARRANTY_CASE_NOT_FOUND`
- `WMS_WARRANTY_INVALID_STATUS_TRANSITION`
- `WMS_WARRANTY_SKU_NOT_FOUND`
- `WMS_WARRANTY_DUPLICATE_SERIAL`
- `WMS_WARRANTY_TEMP_ONLY_REQUIRED`

Cần bổ sung xử lý UI cho các nhóm lỗi:

- 400 validation: highlight field, giữ dữ liệu đã nhập.
- 401/403: thông báo không có quyền, không lộ PII/data ngoài scope.
- 404/masking: case không tồn tại hoặc ngoài phạm vi.
- 409 duplicate/active case/stale transition: hiển thị reason, reload subset/timeline.
- 422 invalid TEMP_ONLY/required fields: focus vào trường thiếu.
- 5xx/network: retry, không duplicate submit.

## 6. Gap so với Acceptance Criteria

| Hạng mục | Hiện trạng | Cần làm để đạt WWHN-247 |
| --- | --- | --- |
| Danh sách bảo hành | Có table gọi `fetchWarrantyCases`, nhưng nhãn tiếng Việt đang mojibake và filter chưa đủ. | Sửa encoding text, thêm filter định danh/bệnh/status, search có binding API params, empty/error state. |
| Chi tiết case | Chưa có panel chi tiết đầy đủ; chỉ có tab lịch sử events. | Thêm detail view hoặc drawer theo case được chọn, hiển thị machine/customer/defect/rule warning. |
| Form tiếp nhận | Button chưa mở form; service có `createWarrantyCase`. | Tạo modal/drawer form, validate IDENTIFIED/TEMP_ONLY, submit API, success state, disable double submit. |
| TEMP_ONLY | Type/service chưa đủ field `missing_code_reason`, `manual_product_description`, `identification_type`. | Đồng bộ type/payload theo contract BE, thêm conditional UI và warning. |
| Status transition | Service có update status; page chưa có action cập nhật. | Thêm action chuyển trạng thái hợp lệ, reason khi cần, idempotency key nếu contract yêu cầu. |
| Enum status | Code enum lệch baseline BA. | Xác nhận với BE/BA và cập nhật type/tag/filter/transition. |
| Privacy/RBAC | Route gate `warranty.manage`; chưa thấy mask PII theo `warranty.pii.view`. | Implement masking, quyền full PII/export nếu scope có, kiểm tra 403. |
| Loading/empty/error/success/disabled | Loading table có; các state còn lại chưa đủ. | Chuẩn hóa state cho list/detail/form/status update. |
| Responsive | Chưa có evidence. | Kiểm thử desktop/mobile, table scroll/filter wrap/form không overflow. |
| Evidence | Chưa có evidence gắn HN-FE-007. | Lưu ảnh/kết quả test/build/lint và ghi lại trong tài liệu/PR. |

## 7. Checklist triển khai chi tiết cho FE1

### 7.1. Chuẩn hóa text và layout

- Sửa mojibake trong `WarrantyPage.tsx`.
- Layout theo pattern Ant Design hiện có của repo.
- Không dùng mock data.
- Table có horizontal scroll trên mobile nếu nhiều cột.
- Tag status dùng màu nhất quán:
  - RECEIVED: default/neutral.
  - CHECKING: processing.
  - REPAIRING: warning/blue.
  - COMPLETED: success.
  - RETURNED: success/terminal.
  - CANCELLED: error/terminal.
  - TEMP_ONLY identification: warning.

### 7.2. Danh sách/filter/search

- Tạo state filter rõ ràng.
- Gọi `fetchWarrantyCases(cleanParams)` với params đã xác nhận.
- Debounce search nếu pattern repo có helper; nếu không, dùng submit search rõ ràng.
- Khi filter đổi, reset pagination nếu table dùng server pagination.
- Hiển thị selected row để mở detail/history.

### 7.3. Form tiếp nhận

- Dùng modal/drawer để không rời context danh sách.
- Client validation chỉ kiểm tra required/format cơ bản; business validation vẫn thuộc BE.
- IDENTIFIED:
  - Required item/serial/physical code.
  - Không hiển thị TEMP_ONLY fields.
- TEMP_ONLY:
  - Required reason + manual description.
  - Không gửi item_code.
  - Hiển thị mã temp sau API success.
- Submit:
  - Disable button khi đang submit.
  - Success: đóng modal hoặc chuyển sang detail case mới, refresh list.
  - Error: giữ form data, map lỗi field nếu API trả validation.

### 7.4. Detail/history/status update

- Khi chọn case, gọi detail nếu dữ liệu list không đủ.
- History tab gọi events theo selected case.
- Action status chỉ hiện khi case chưa terminal và user có quyền.
- Reason bắt buộc cho CANCELLED và các transition bị BE yêu cầu reason.
- Sau update status: refresh detail, history và list row.

### 7.5. Privacy

- Tạo helper mask phone/name nếu chưa có helper chung.
- Mặc định dùng dữ liệu đã mask từ BE nếu BE trả; FE fallback mask khi có raw data nhưng thiếu quyền.
- Không render raw phone ở column list nếu thiếu `warranty.pii.view`.
- Không đưa raw PII vào notification/error/log.

## 8. Test/evidence cần có

### 8.1. Kiểm thử tự động

Nên có test cho:

- Route permission `/warranty` yêu cầu `warranty.manage`.
- Service gọi đúng endpoint:
  - list
  - events
  - create
  - update status
- Component state:
  - loading
  - empty
  - error
  - create success
  - TEMP_ONLY validation
  - PII masking
  - disabled terminal action

### 8.2. Lệnh verify

Chạy tối thiểu:

```bash
npm run lint
npm run build
npm run test
```

Nếu chưa chạy được, phải ghi rõ lý do, log lỗi chính và owner xử lý.

### 8.3. Evidence cho BA/QA

Cần chụp/ghi lại:

- Desktop danh sách case có filter/search.
- Mobile danh sách không vỡ layout.
- Form IDENTIFIED.
- Form TEMP_ONLY với reason/description.
- Detail timeline.
- Status update success.
- Empty state.
- API error/validation error.
- 403/RBAC hoặc user thiếu quyền.
- PII masking và full-view behavior nếu có quyền.

## 9. Blocker/open point

| Mã | Mức | Nội dung | Owner đề xuất | Disposition |
| --- | --- | --- | --- | --- |
| WAR-FE-OP-001 | P1 | Enum status trong code chưa khớp baseline BA (`OPEN/PROCESSING/...` so với `RECEIVED/CHECKING/REPAIRING/COMPLETED/RETURNED/CANCELLED`). | BE1/BA/BAS + FE1 | Cần contract final trước sign-off. |
| WAR-FE-OP-002 | P1 | Wireframe ghi `/warranty-cases`, code dùng `/warranty/cases`. | BE1 + FE1 | Đối chiếu OpenAPI/BE locked contract, không đổi theo suy đoán. |
| WAR-FE-OP-003 | P1 | Payload TEMP_ONLY hiện type chưa đủ `identification_type`, `missing_code_reason`, `manual_product_description`. | BE1/BA/BAS + FE1 | Cần xác nhận và cập nhật type/form. |
| WAR-FE-OP-004 | P1 | Permission PII `warranty.pii.view/export` chưa thấy trong route-level mapping. | BE/BA + FE1 | FE cần kiểm tra permission catalog và implement masking theo quyền. |
| WAR-FE-OP-005 | P2 | Chưa có evidence responsive/RBAC/UI state. | FE1 | Phải bổ sung sau implement. |

## 10. Definition of Done cho WWHN-247

- UI `/warranty` có danh sách, filter/search, detail/timeline, form tiếp nhận và cập nhật trạng thái ở mức đủ kiểm thử.
- UI xử lý loading, empty, error, success, disabled và confirm/reason khi phù hợp.
- TEMP_ONLY được xử lý đúng: không link item gốc, required reason/description, hiển thị temporary item code từ BE.
- Permission/RBAC và PII masking hoạt động đúng, không hard-code dữ liệu nhạy cảm.
- Endpoint/payload/error mapping bám contract đã duyệt; mọi mismatch có blocker/disposition.
- Lint/build/test phù hợp pass hoặc có log lỗi và owner rõ ràng.
- Evidence responsive/RBAC/UI state được chuẩn bị để gắn HN-FE-007/WWHN-247.
- Không còn P0/P1 blocker thuộc FE1 chưa có disposition.

## 11. Kết luận rà soát hiện tại

Repo đã có khung module bảo hành, route, endpoint constants, service và types, nhưng `WarrantyPage.tsx` hiện mới ở mức skeleton: danh sách + lịch sử events. Chưa đủ Acceptance Criteria của WWHN-247 vì thiếu form tiếp nhận, TEMP_ONLY conditional, detail/timeline đầy đủ, status actions, privacy masking, error/success states và evidence.

Mức sẵn sàng hiện tại: **Chưa đủ sign-off production cho WWHN-247**.

Ưu tiên tiếp theo:

1. Xác nhận contract final cho status enum, endpoint path và payload TEMP_ONLY.
2. Hoàn thiện UI list/detail/form/status update theo `SCR-WAR-01`.
3. Bổ sung RBAC/PII masking và state handling.
4. Chạy lint/build/test và tạo evidence cho BA/QA.
