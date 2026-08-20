**HƯỚNG DẪN DEV TRIỂN KHAI QR CÓ SKU**

**Backend + Frontend implementation guide theo change requirement**

**Hoa Nam WMS**

Ngày lập: 20/08/2026

*Loại tài liệu: Change Pack / Implementation Delta - không thay thế baseline hiện tại*

| **YÊU CẦU MỚI:** Barcode/QR của PRODUCT ITEM chứa đồng thời SKU và định danh item duy nhất (serial/item unique). Hệ thống phải parse SKU từ mã quét thay vì coi toàn bộ dữ liệu camera trả về chỉ là một code_value đơn. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 1. Mục tiêu triển khai

Tài liệu này là implementation guide để Backend và Frontend sửa hệ thống hiện tại theo yêu cầu PRODUCT Barcode/QR chứa SKU + item unique. Mục tiêu là thay đổi tối thiểu nhưng nhất quán: một parser/resolver backend dùng chung cho inbound, outbound, trace và warranty; giữ nguyên stock posting và các flow không liên quan.

# 2. Target architecture

```text
[FE Camera / Scanner / Manual]
| raw payload
v
[Existing scan API / classify API]
|
v
[ProductQrPayloadParser]
| structured identity
v
[ProductIdentityResolver]
| SKU lookup
| Physical_Code / Item lookup
| context validation
v
[Inbound / Outbound / Warranty / Trace service]
|
v
[Scan_Event + existing document state]
|
+--> Post Receipt/Issue (existing stock transaction boundary)
```

- Không parse business payload ở FE.

- Không thêm sku_id vào Physical_Code nếu chỉ để duplicate quan hệ Item_Instance.sku_id.

- Không thay Inventory_Movement/Inventory_Balance logic.

# 3. Backend - service/layer cần thêm hoặc sửa

| **Component**             | **Trách nhiệm**                                                                                          | **Lưu ý**                                               |
|---------------------------|----------------------------------------------------------------------------------------------------------|---------------------------------------------------------|
| ProductQrPayloadParser    | Nhận raw string; detect legacy/composite; parse payload_version, sku_code, item_unique, optional serial. | Pure function; unit test độc lập; không query DB.       |
| ProductIdentityResolver   | Resolve SKU; resolve normalized Physical_Code/Item; áp dụng uniqueness policy.                           | Authoritative backend; dùng chung mọi context.          |
| InboundScanService        | Parse -> SKU match -> duplicate/excess -> persist candidate scan.                                     | Cho phép new item candidate; không stock effect.        |
| InboundPostService        | Ở full Post, tạo/register item/Physical_Code còn thiếu trong cùng transaction rồi post stock.            | Unique constraint + row lock; rollback toàn bộ khi lỗi. |
| OutboundScanService       | Parse -> resolve existing Item -> cross-check SKU -> state validation.                                | Không tạo item mới.                                     |
| ScanClassificationService | Dùng cho WARRANTY/TRACE hoặc generic scanner.                                                            | Response trả parsed identity + resolved target.         |
| WarrantyService           | Nhận normalized item_code/item_id từ resolver; giữ state/active-case rules.                              | Không tự suy đoán từ sku_code nếu item không resolve.   |
| TraceService              | Nhận normalized code_value sau resolve.                                                                  | Không cần thay movement logic.                          |

# 4. Backend - parser contract

Interface gợi ý (tên class chỉ minh họa):

```text
parse(raw_payload) -> {
format: COMPOSITE_V1 | LEGACY_CODE_VALUE,
payload_version: 1 | null,
sku_code: string | null,
item_unique: string,
serial_number: string | null,
normalized_code_value: string
}
```

| **Rule**                   | **Backend behavior**                                                                |
|----------------------------|-------------------------------------------------------------------------------------|
| Composite V1 hợp lệ        | sku_code và item_unique bắt buộc non-empty; trim/normalize theo master-data policy. |
| Version không hỗ trợ       | UNSUPPORTED_PAYLOAD_VERSION; không đoán format.                                     |
| Legacy code                | Chỉ resolve theo feature flag/transition policy; không auto-derive SKU ở FE.        |
| Raw payload quá dài        | 422 INVALID_PAYLOAD; cap request để tránh abuse.                                    |
| SKU không tồn tại/inactive | SKU_NOT_FOUND/SKU_INACTIVE; không tạo SKU tự động.                                  |
| Ký tự đặc biệt             | Parser xử lý ở backend; FE giữ raw string nguyên trạng.                             |

# 5. Backend - thay đổi OpenAPI cụ thể

## 5.1. ScanBatchRequest / DocumentScanRequest

```text
# Giữ field codes để tương thích client hiện tại
codes: [
"HN1|SKU=DCH-DRILL-DJZ10A-20V-V1|ITEM=SN000012345"
]
scan_source: CAMERA
```

- Đổi description: codes là raw scan payload, không còn mặc định là normalized code_value.

- Tăng maxLength item từ 150 lên 512 (hoặc size theo QR thực tế sau khi nhận mẫu).

- additionalProperties=false giữ nguyên.

## 5.2. ScanResult / DocumentScanMatch response

```text
{
"raw_payload": "HN1|SKU=DCH-...|ITEM=SN000012345",
"payload_version": 1,
"sku_code": "DCH-DRILL-DJZ10A-20V-V1",
"item_unique": "SN000012345",
"normalized_code_value": "SN000012345",
"line_id": "...",
"item_id": null,
"resolution_status": "NEW_ITEM_CANDIDATE",
"result": "MATCHED"
}
```

Inbound item_id được phép null trước Post nếu chọn chiến lược register-at-Post. Outbound/Warranty/Trace khi resolve item hiện hữu thì item_id phải có.

## 5.3. Endpoint impact matrix

| **Endpoint**                                       | **Sửa gì**                                                                                      | **Không sửa**                                      |
|----------------------------------------------------|-------------------------------------------------------------------------------------------------|----------------------------------------------------|
| POST /scan-batches/classify                        | Parse composite QR; trả sku/item identity; hỗ trợ context WARRANTY/TRACE.                       | Permission scan.execute.                           |
| POST /inbound-documents/{id}/scans                 | Accept new item candidate; match embedded SKU; response structured.                             | DRAFT/SCANNING; If-Match; no movement.             |
| POST /inbound-documents/{id}/post-receipt          | Register Physical_Code/Item for accepted candidates trong transaction trước/đồng thời movement. | Idempotency-Key, If-Match, full-post, exact qty.   |
| POST /outbound-documents/{id}/scans                | Parse/resolve existing item; cross-check SKU.                                                   | No movement; Packing Label trigger sau full match. |
| POST /outbound-documents/{id}/post-issue           | Không cần sửa payload vì scan progress đã normalized.                                           | Packing label gate, stock transaction.             |
| GET /inventory/trace/{code_value}                  | Giữ endpoint normalized. FE camera gọi classify trước.                                          | Permission inventory.trace.                        |
| POST /warranty-cases                               | Có thể giữ item_code; FE resolve QR trước bằng classify.                                        | State/PII rules.                                   |
| POST /outbound-documents/{id}/items/{item_id}/rfid | Không đổi; item_id lấy từ resolver/scan result.                                                 | RFID stock-neutral.                                |

# 6. Backend - database/migration

| **Change**                            | **DDL/logic đề xuất**                                                                 | **Mức**           |
|---------------------------------------|---------------------------------------------------------------------------------------|-------------------|
| Physical_Code.code_value              | Giữ unique normalized item identity. Không lưu raw QR nếu raw dài/format thay đổi.    | Required          |
| Physical_Code.encoded_payload_version | Nếu physical schema chưa có thì add SMALLINT/INT nullable; new composite QR set = 1.  | Recommended       |
| Scan_Event.raw_payload                | Nếu chưa có thì add VARCHAR/TEXT; khuyến nghị >=512; composite QR scan bắt buộc ghi. | Recommended       |
| Scan_Event.parsed_sku_code            | VARCHAR(100) nullable + index nếu cần audit/search.                                   | Recommended       |
| Scan_Event.parsed_item_unique         | VARCHAR(150) nullable.                                                                | Recommended       |
| Scan_Event.payload_version            | SMALLINT nullable.                                                                    | Recommended       |
| Scan_Event.parse_status               | VARCHAR/ENUM.                                                                         | Recommended       |
| Item_Instance.sku_id                  | Không đổi.                                                                            | No change         |
| Item_Instance.serial_number           | Populate nếu payload có serial; giữ/current constraint cho tới khi có mẫu thật.       | Review constraint |
| Inventory_Movement / Balance          | Không đổi DDL/business logic.                                                         | No change         |

Migration strategy: không rewrite toàn bộ mã cũ ngay. Bật resolver dual-mode: COMPOSITE_V1 cho QR mới và LEGACY_CODE_VALUE cho dữ liệu cũ. Sau khi toàn bộ item cũ được chuyển/đối soát, có thể tắt legacy bằng feature flag.

# 7. Backend - inbound algorithm

```text
for raw in request.codes:
parsed = parser.parse(raw)
sku = skuRepo.findActiveByCode(parsed.sku_code)
if !sku: reject SKU_NOT_FOUND
line = inbound.findLineBySkuId(sku.id)
if !line: reject WRONG_SKU
if line.scanned_qty >= line.expected_qty: reject EXCESS
if scanAlreadyAccepted(document, parsed.item_unique): reject DUPLICATE
if itemExists(parsed.item_unique): reject DUPLICATE/INVALID_STATE
persist Scan_Event(raw, parsed, line_id, result=MATCHED)
increment scanned_qty
# no Balance/Movement write
```

Post Receipt: lock document/lines; revalidate full match; for every accepted new candidate, insert Physical_Code + Item_Instance (NEW -> IN_STOCK) and movement/balance in one DB transaction. Any unique conflict/stock error rolls back all. Idempotency replay must not create a second item or movement.

# 8. Backend - outbound algorithm

```text
parsed = parser.parse(raw)
sku = skuRepo.findActiveByCode(parsed.sku_code)
item = itemRepo.findByNormalizedCode(parsed.item_unique)
if !item: reject UNKNOWN_CODE
if item.sku_id != sku.id: reject WRONG_SKU
line = outbound.findLineBySkuId(sku.id)
if !line: reject WRONG_SKU
if item.status != IN_STOCK: reject INVALID_STATE / ALREADY_ISSUED
if duplicateInDocument(item): reject DUPLICATE
if line.full: reject EXCESS
accept scan; persist Scan_Event; no movement
```

Sau khi full match, giữ nguyên logic tạo/đảm bảo Packing_Label DRAFT. Không chuyển việc parse QR vào Post Issue.

# 9. Backend - warranty và trace

## 9.1. Warranty IDENTIFIED

1.  FE scan -> POST /scan-batches/classify context=WARRANTY.

2.  Backend parse + resolve existing Item; trả item_id, normalized_code_value, sku_code và state.

3.  FE đưa normalized item_code vào createWarrantyCase như contract hiện tại.

4.  Backend WarrantyService revalidate item/state/active case; không tin solely dữ liệu FE.

5.  Không resolve được -> UI cho TEMP_ONLY; không tự link theo SKU/model.

## 9.2. Trace

6.  FE scan -> classify context=TRACE.

7.  Nếu VALID/resolved -> lấy normalized_code_value.

8.  Call GET /inventory/trace/{normalized_code_value}.

9.  Không truyền raw composite QR trực tiếp vào path nếu chưa encode/normalize.

# 10. Frontend - component chung cần sửa

| **FE phần**              | **Cần sửa**                                                                                    |
|--------------------------|------------------------------------------------------------------------------------------------|
| Camera Scanner component | Trả raw decoded string; không split SKU/item trong FE business layer.                          |
| Scan API client          | Gửi raw string trong codes[]; type response thêm sku_code/item_unique/resolution_status.     |
| Scan result row/card     | Hiển thị SKU, item/serial, status MATCHED/REJECTED và lý do cụ thể.                            |
| Manual input             | Cho paste/nhập raw composite QR; đi cùng endpoint/validation với camera.                       |
| Error mapping            | Map INVALID_PAYLOAD, SKU_NOT_FOUND, WRONG_SKU, DUPLICATE, EXCESS, UNKNOWN_CODE, INVALID_STATE. |
| Legacy support           | Không tự detect ở UI; backend trả format/resolution để UI chỉ hiển thị.                        |

# 11. Frontend - màn Inbound

10. Giữ màn phiếu nhập và summary line SKU/expected/scanned.

11. Bỏ/không yêu cầu thao tác chọn SKU cho từng lần scan PRODUCT. Sau scan, highlight line mà backend đã match từ embedded sku_code.

12. Mỗi scan result hiển thị: SKU code/name, item_unique/serial, trạng thái NEW ITEM CANDIDATE hoặc rejected.

13. item_id có thể chưa có trước Post; FE không được giả định item_id luôn non-null trong inbound scan response.

14. Post button chỉ enable khi server response/document cho biết mọi line fully matched; không tự tính authority bằng client-only state.

15. Cancel giữ behavior hiện tại; clear local scan view theo response server.

# 12. Frontend - màn Outbound

16. Scan raw QR; server trả sku/item resolved.

17. Hiển thị embedded/resolved SKU và line được match để người kho thấy ngay sai SKU.

18. Không cho user override một scan WRONG_SKU bằng chọn tay SKU khác. Muốn dùng item thì phải quét đúng QR hoặc sửa dữ liệu master theo process.

19. Giữ full-match -> Packing Label -> Preview/Ready/Print -> label applied -> Post Issue.

20. RFID mapping CTA vẫn theo item_id resolved; missing RFID không chặn Post.

# 13. Frontend - Warranty / Trace

| **Screen**         | **Behavior mới**                                                                                                  |
|--------------------|-------------------------------------------------------------------------------------------------------------------|
| WAR-02 IDENTIFIED  | Scan raw QR -> classify(WARRANTY) -> fill item_code/SKU/model; backend create vẫn revalidate.                   |
| WAR-02 TEMP_ONLY   | Giữ nguyên. Khi resolver không tìm item, UI có CTA rõ “Tạo case không có mã/TEMP_ONLY”; không auto-switch silent. |
| Inventory Trace    | Scan raw QR -> classify(TRACE) -> call trace normalized code; hiển thị SKU + item identity.                     |
| Search/manual code | Cho nhập raw composite hoặc legacy theo backend policy.                                                           |

# 14. API response model FE nên dùng

```text
type ProductScanResult = {
rawPayload: string;
payloadVersion?: number;
format: "COMPOSITE_V1" | "LEGACY_CODE_VALUE";
skuCode?: string;
itemUnique?: string;
normalizedCodeValue?: string;
lineId?: string;
itemId?: string; // nullable inbound before Post
result: "MATCHED" | "UNKNOWN_CODE" | "DUPLICATE" | "WRONG_SKU" | "EXCESS" | "INVALID_STATE" | "ALREADY_ISSUED";
resolutionStatus?: "NEW_ITEM_CANDIDATE" | "EXISTING_ITEM" | "LEGACY_ITEM";
message?: string;
}
```

Tên field thực tế phải theo OpenAPI sau khi BE cập nhật; block trên là shape mục tiêu để FE hiểu nullable/state contract.

# 15. Test cases bắt buộc trước merge

| **ID** | **Scenario**                                        | **Expected**                                                              |
|--------|-----------------------------------------------------|---------------------------------------------------------------------------|
| QR-01  | Inbound composite QR hợp lệ, SKU có line, item mới. | MATCHED; scanned_qty +1; item_id có thể null; stock 0 trước Post.         |
| QR-02  | Inbound 2 QR cùng item_unique.                      | Lần 2 DUPLICATE; qty không tăng.                                          |
| QR-03  | Inbound embedded SKU không có line.                 | WRONG_SKU; no write stock.                                                |
| QR-04  | Inbound qty đã đủ rồi scan thêm.                    | EXCESS.                                                                   |
| QR-05  | Inbound invalid format/version.                     | INVALID_PAYLOAD/UNSUPPORTED; no scanned_qty.                              |
| QR-06  | Inbound Post full match.                            | Create items/physical codes + movement + Balance atomically exactly once. |
| QR-07  | Inbound Post retry same Idempotency-Key.            | Replay; không duplicate item/movement.                                    |
| QR-08  | Inbound Cancel trước Post.                          | No movement/stock; candidate scan không thành stock item.                 |
| QR-09  | Outbound valid QR, item IN_STOCK, same SKU.         | MATCHED; no stock until Post.                                             |
| QR-10  | Outbound payload SKU != Item.sku_id.                | WRONG_SKU.                                                                |
| QR-11  | Outbound item không tồn tại.                        | UNKNOWN_CODE.                                                             |
| QR-12  | Outbound item ISSUED/IN_WARRANTY.                   | ALREADY_ISSUED/INVALID_STATE.                                             |
| QR-13  | Outbound full match.                                | Packing_Label flow unchanged; Post -N once.                               |
| QR-14  | Warranty valid QR of eligible issued item.          | Resolver returns item/SKU; case IDENTIFIED can create.                    |
| QR-15  | Warranty unknown item but parse OK.                 | Không auto-link; TEMP_ONLY option.                                        |
| QR-16  | Trace valid composite QR.                           | Resolve normalized code then return movement chain.                       |
| QR-17  | Legacy code while feature flag ON.                  | Resolve existing item; response format LEGACY_CODE_VALUE.                 |
| QR-18  | Legacy code after flag OFF.                         | Reject với message migration/payload unsupported.                         |
| QR-19  | RFID mapping item resolved from QR.                 | Mapping stock-neutral; no new item/movement.                              |
| QR-20  | Printer/Packing Label error after QR change.        | Behavior y baseline; no stock on print failure.                           |

# 16. Rollout order đề xuất

21. BE-1: Tạo parser + unit test cho composite/legacy/invalid payload.

22. BE-2: Mở rộng scan response contract và Scan_Event audit fields; migration DB trước.

23. BE-3: Sửa inbound scan + register-at-Post + concurrency/idempotency tests.

24. BE-4: Sửa outbound scan + classify WARRANTY/TRACE.

25. BE-5: Regenerate OpenAPI/Postman và contract test.

26. FE-1: Update shared scanner/API types/result UI.

27. FE-2: Inbound auto-match SKU và nullable item_id.

28. FE-3: Outbound scan result + error UX; giữ Packing Label flow.

29. FE-4: Warranty/Trace dùng classify resolver.

30. QA: chạy QR-01..20 + regression full-post/Packing Label/RFID/Reversal/App PV.

# 17. Definition of Done

- Một raw PRODUCT QR composite được xử lý nhất quán ở Inbound, Outbound, Warranty và Trace.

- Không còn FE flow nào phải tự parse SKU từ QR để làm business validation.

- Inbound không yêu cầu chọn SKU cho từng item scan; server tự match line theo embedded sku_code.

- New inbound item không cần pre-seed Item_Instance trước khi hàng thực tế được scan; item được đăng ký theo transaction receipt.

- Outbound/Warranty/Trace không tự tạo item từ QR unknown.

- Inventory stock effect vẫn chỉ xảy ra tại Post Receipt/Post Issue/Component Issue/Reversal/Opening Balance như baseline.

- OpenAPI và FE types đồng bộ; Postman/contract tests cập nhật.

- Legacy transition có feature flag hoặc migration plan rõ ràng.

- Test QR-01..20 PASS và regression Packing Label/RFID/Full Post PASS.
