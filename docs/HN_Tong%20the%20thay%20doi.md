Hoa Nam WMS - QR/SKU Change Pack

**ĐẶC TẢ THAY ĐỔI BARCODE/QR PRODUCT**

**Tất cả điểm mới so với BRD / SRS-FRD / BPD / OpenAPI hiện tại**

**Hoa Nam WMS**

Ngày lập: 20/08/2026

*Loại tài liệu: Change Pack / Implementation Delta - không thay thế baseline hiện tại*

| **YÊU CẦU MỚI:** Barcode/QR của PRODUCT ITEM chứa đồng thời SKU và định danh item duy nhất (serial/item unique). Hệ thống phải parse SKU từ mã quét thay vì coi toàn bộ dữ liệu camera trả về chỉ là một code_value đơn. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 1. Mục đích và phạm vi

Tài liệu này gom toàn bộ phần thay đổi do yêu cầu mới về Barcode/QR PRODUCT để tránh phải sửa ngay toàn bộ BRD, SRS-FRD, BPD và OpenAPI. Đây là tài liệu delta: nội dung không nêu trong tài liệu này tiếp tục theo baseline hiện tại.

- Chỉ áp dụng trực tiếp cho PRODUCT ITEM có Barcode/QR. CARTON/BOX/TRAY và COMPONENT giữ logic hiện tại trừ khi sau này có yêu cầu riêng.

- Không thay đổi nguyên tắc Full Post, idempotency, transaction, ledger, Packing Label, RFID optional, 01 kho tổng, App PV read-only và TEMP_ONLY warranty.

- Thay đổi trọng tâm: cách giải mã định danh khi scan, cách match SKU, cách đăng ký item lúc nhập, cách resolve item ở xuất/trace/bảo hành và contract API/FE liên quan.

# 2. Nguồn baseline hiện tại dùng để so sánh

| **Nguồn hiện tại**    | **Nội dung liên quan đang có**                                                 | **Điểm baseline quan trọng**                                                                                      |
|-----------------------|--------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| BRD Hoa Nam v3.20     | §4 SKU & Physical_Code; §5 Data Model; §7 luồng; §8 business rules             | Physical_Code.code_value là định danh scan; QR/Barcode là carrier; scan dùng cho inbound/outbound/trace/warranty. |
| SRS/FRD Hoa Nam v1.12 | REQ-SRS-003/005/006/007/010/011/016/030; Data Dictionary; Annex C              | Camera decode code_value; DocumentScanRequest.codes:string\[\]; scan endpoint match code vào line.                |
| BPD Hoa Nam v1.12     | BP-WMS-02, BP-WMS-05, BP-WMS-07, BP-WMS-08                                     | Inbound scan Barcode/QR; outbound scan Item và match SKU; warranty IDENTIFIED dùng item_code.                     |
| HN_OpenAPI_v1.7       | /scan-batches/classify; inbound/outbound scans; inventory trace; warranty case | codes maxLength 150; response chủ yếu trả code_value/result/item_id; chưa có parsed sku_code/item_unique.         |

# 3. Baseline hiện tại vs yêu cầu mới

| **Hạng mục**               | **Hiện tại**                                                                        | **Mới**                                                                                                 | **Mức ảnh hưởng** |
|----------------------------|-------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|-------------------|
| Ý nghĩa Barcode/QR PRODUCT | Carrier encode/đưa về một code_value duy nhất.                                      | Payload có ít nhất sku_code + item_unique; raw payload phải được parse.                                 | P0                |
| Nhận biết SKU khi scan     | Hệ thống resolve code_value -\> Item -\> sku_id hoặc match với SKU đã có trên line. | Hệ thống lấy sku_code trực tiếp từ payload, resolve SKU trước rồi match line.                           | P0                |
| Nhận biết item cụ thể      | Từ Physical_Code/code_value đã tồn tại hoặc mã scan hợp lệ.                         | Từ item_unique trong payload; inbound có thể là item chưa tồn tại trong DB trước khi nhận.              | P0                |
| Inbound                    | Phiếu có SKU/expected_qty; scan mã; full-match rồi Post Receipt.                    | Không cần người dùng chọn SKU cho từng lần scan; parse SKU tự động. SKU master vẫn phải tồn tại.        | P0                |
| Outbound                   | Scan Item code đã tồn tại, kiểm tra cùng SKU/IN_STOCK.                              | Parse SKU + item_unique, resolve item đã tồn tại, đối chiếu embedded SKU với Item/SKU và outbound line. | P0                |
| Trace                      | GET trace theo code_value.                                                          | Scan raw payload -\> normalize/resolve -\> trace item theo normalized identity.                         | P1                |
| Warranty IDENTIFIED        | Scan/nhập item_code.                                                                | Scan raw QR -\> parse/resolve -\> tự điền item/SKU; TEMP_ONLY giữ nguyên khi không resolve được.        | P0                |
| Physical_Code              | code_value unique, carrier_type, hardware_uid.                                      | Giữ normalized identity; không nhét raw payload vào code_value; dùng encoded_payload_version.           | P1                |
| Scan audit                 | raw_payload optional.                                                               | raw_payload bắt buộc cho composite QR; nên lưu parsed sku/item + parse status.                          | P1                |
| Inventory ledger           | Movement/Balance theo Post.                                                         | Không đổi.                                                                                              | Không đổi         |
| RFID                       | Optional mapping về Item/Physical_Code.                                             | Không đổi; QR composite chỉ giúp resolve đúng Item.                                                     | Nhỏ               |
| Packing Label              | Sau full match -\> Preview/Ready/Print -\> dán -\> Post.                            | Không đổi state/stock effect; dữ liệu item có thể hiển thị normalized item_unique.                      | Nhỏ               |

# 4. Định nghĩa payload mới

Yêu cầu nghiệp vụ mới chỉ chốt rằng PRODUCT Barcode/QR chứa SKU và định danh item duy nhất. Tài liệu nguồn hiện tại chưa quy định delimiter/encoding chính xác. Vì vậy DEV phải tách parser khỏi UI và khỏi business service để có thể thay format mà không sửa luồng.

| **Field logic** | **Bắt buộc**  | **Ý nghĩa**                                                | **Mapping đích**                                   |
|-----------------|---------------|------------------------------------------------------------|----------------------------------------------------|
| payload_version | Có với mã mới | Version cấu trúc QR/Barcode.                               | Physical_Code.encoded_payload_version / Scan_Event |
| sku_code        | Có            | SKU của loại sản phẩm.                                     | Resolve SKU.sku_code -\> sku_id                    |
| item_unique     | Có            | Định danh máy/item cụ thể, duy nhất theo policy được chốt. | Physical_Code.code_value (normalized identity)     |
| serial_number   | Tùy nguồn     | Serial NSX nếu có và nếu khác item_unique.                 | Item_Instance.serial_number                        |

Reference format để DEV/test dùng trong lúc chưa có format nhà cung cấp:

```text
HN1|SKU=<sku_code>|ITEM=<item_unique>
Ví dụ: HN1|SKU=DCH-DRILL-DJZ10A-20V-V1|ITEM=SN000012345
```

Reference format trên là đề xuất kỹ thuật của change pack, không phải nội dung đã có trong BRD/SRS hiện tại. Khi có mẫu QR thực tế, chỉ thay adapter/parser; contract logic sku_code + item_unique không đổi.

# 5. Luồng scan chuẩn mới dùng chung

```text
Camera / scanner / manual input
 |
 v
 raw_payload
 |
 v
 ProductQrPayloadParser
 |---- invalid/version ---> REJECT
 v
 {payload_version, sku_code, item_unique, serial?}
 |
 v
 Resolve SKU by sku_code
 |---- not found/inactive -> REJECT
 v
 Context Resolver
 INBOUND -> match line; item may be new
 OUTBOUND -> item must already exist + IN_STOCK
 WARRANTY -> item must already exist + eligible
 TRACE -> item/physical code must exist
 |
 v
 Persist Scan_Event + return normalized result
```

- FE không tự split SKU/serial thành business truth. FE chỉ đọc QR và gửi raw payload; backend là nơi parse/validate authoritative.

- Manual input đi qua cùng parser/validation. Không tạo đường logic riêng cho camera và nhập tay.

- Legacy plain code_value có thể được support tạm thời qua LEGACY parser để không làm hỏng item đã phát hành trước change.

# 6. Delta chi tiết theo từng luồng

## 6.1. Nhập kho PRODUCT - thay đổi lớn nhất

Luồng hiện tại vẫn giữ DRAFT -\> SCANNING -\> POSTED, exact quantity và full Post. Điểm mới là mỗi lần scan tự xác định SKU từ QR và có thể chấp nhận một item chưa được đăng ký trước trong WMS.

1.  NV kho mở inbound DRAFT. Phiếu vẫn có thể có expected SKU/qty như baseline hiện tại.

2.  Camera đọc raw QR PRODUCT. FE gửi nguyên raw payload vào endpoint scan.

3.  Backend parse payload -\> sku_code + item_unique; resolve SKU active.

4.  Backend tự match sku_code vào inbound line; người dùng không chọn SKU cho từng item scan.

5.  Nếu sku_code không có line hoặc vượt expected_qty -\> reject WRONG_SKU/EXCESS; không đổi tồn.

6.  Nếu item_unique đã tồn tại ở Item_Instance/Physical_Code và không phải record hợp lệ của chính transaction -\> reject duplicate/already-registered.

7.  Nếu item_unique chưa tồn tại -\> ghi scan progress như new item candidate. Khuyến nghị tạo Physical_Code + Item_Instance atomically ở Post Receipt, tránh orphan khi phiếu bị Cancel.

8.  Khi mọi line đủ số lượng, Post Receipt atomically tạo item/physical code còn thiếu, tạo RECEIPT_POSTED, tăng Balance và chuyển item -\> IN_STOCK.

9.  Cancel trước Post xóa/void scan progress; không tạo movement, không tăng tồn. Nếu triển khai provisional item sớm thì phải cleanup/deactivate record chưa từng Post.

Ngoài phạm vi của change này: tự động tạo SKU master từ QR. SKU master phải được tạo trước; QR chỉ giúp tự nhận diện SKU trong quá trình scan.

## 6.2. Xuất kho PRODUCT

10. FE gửi raw payload từ QR.

11. Backend parse sku_code + item_unique, resolve Physical_Code/Item_Instance đã tồn tại.

12. Validate embedded sku_code = Item_Instance.sku_id = outbound line SKU. Nếu lệch -\> WRONG_SKU.

13. Validate Item đang IN_STOCK, chưa scan trùng, chưa ISSUED/IN_WARRANTY/LOST; giữ các rule EXCESS/ALREADY_ISSUED hiện tại.

14. Full match -\> Packing Label DRAFT -\> Preview/Ready/Print -\> dán -\> Post Issue; toàn bộ phần này không thay đổi.

## 6.3. Tra cứu/trace

15. Khi người dùng quét QR, raw payload phải được backend parse trước.

16. Lấy normalized code_value/item_unique và sku_code; resolve item.

17. Sau resolve mới chạy trace hiện tại theo item/container/movement chain.

18. Không cho FE tự ghép URL trace từ raw payload composite nếu format chứa ký tự đặc biệt; nên resolve bằng scan service rồi gọi trace theo normalized code_value.

## 6.4. Bảo hành IDENTIFIED

19. WAR-02 quét raw QR thay vì chỉ nhận một item_code đơn.

20. Backend parse + resolve item; response trả SKU/item để FE tự điền thông tin sản phẩm.

21. Sau khi resolve, giữ nguyên validation warranty hiện tại: item state hợp lệ, không active case xung đột, case RECEIVED không tạo Inventory_Movement.

22. Nếu QR hỏng, không parse, item không tồn tại hoặc không thể định danh chắc chắn: cho phép chuyển sang TEMP_ONLY theo rule hiện tại; không suy đoán link item.

## 6.5. RFID / Packing Label / Component / App PV

| **Phần**                  | **Thay đổi**                                                                                                       |
|---------------------------|--------------------------------------------------------------------------------------------------------------------|
| RFID mapping              | Không đổi nguyên tắc. RFID/hardware_uid vẫn map vào Item/Physical_Code đã resolve; stock-neutral; không Post gate. |
| Packing Label             | Không đổi state machine và mốc trừ tồn. Có thể dùng sku_code + item_unique đã normalize khi hiển thị danh sách mã. |
| Component serial/box      | Không thuộc yêu cầu PRODUCT QR mới. Giữ scan component hiện tại.                                                   |
| Carton/Box/Tray           | Không đổi payload bắt buộc. Vẫn dùng code_value/carrier hiện tại.                                                  |
| App PV                    | Không đổi; vẫn chỉ đọc available_qty theo SKU và không lộ item/serial.                                             |
| Reversal/Movement/Balance | Không đổi business rule hoặc schema lõi.                                                                           |

# 7. Ảnh hưởng Database

Không cần redesign các bảng tồn kho. Mô hình SKU -\> Item_Instance -\> Physical_Code hiện tại đã đủ nền tảng. Thay đổi DB chủ yếu nằm ở audit/scan payload và constraint/length nếu cần.

| **Entity/Field**                       | **Hiện tại**                                  | **Đề xuất mới**                                                                                    | **Bắt buộc?**    |
|----------------------------------------|-----------------------------------------------|----------------------------------------------------------------------------------------------------|------------------|
| SKU.sku_code                           | Unique, master loại hàng.                     | Giữ nguyên; dùng làm key resolve từ payload.                                                       | Có               |
| Item_Instance.sku_id                   | FK SKU.                                       | Giữ nguyên. Không duplicate sku_id vào Physical_Code chỉ vì QR có SKU.                             | Có               |
| Item_Instance.serial_number            | Nullable; current DD ghi UNIQUE.              | Nếu serial có trong payload thì lưu. Nếu item_unique khác serial thì serial vẫn chỉ là thuộc tính. | Có nếu có serial |
| Physical_Code.code_value               | Unique; source scan chuẩn hóa.                | Lưu normalized item_unique hoặc normalized composite identity, không lưu toàn raw QR.              | Có               |
| Physical_Code.encoded_payload_version  | Đã được tài liệu hiện tại dự trù là optional. | Đặt version cho QR composite mới, ví dụ 1.                                                         | Nên có           |
| Scan_Event.raw_payload                 | Hiện tại mô tả optional.                      | Đặt bắt buộc với QR composite để audit/debug/parser replay. Nên tăng length \>= 512.               | Nên có           |
| Scan_Event.parsed_sku_code             | Chưa có baseline rõ.                          | Thêm để audit/QA và tránh phải parse lại lịch sử.                                                  | Khuyến nghị      |
| Scan_Event.parsed_item_unique          | Chưa có baseline rõ.                          | Thêm normalized item identity từ payload.                                                          | Khuyến nghị      |
| Scan_Event.payload_version             | Chưa có baseline rõ.                          | Thêm version parser đã dùng.                                                                       | Khuyến nghị      |
| Scan_Event.parse_status                | Chưa có baseline rõ.                          | VALID / INVALID_FORMAT / UNSUPPORTED_VERSION / SKU_NOT_FOUND.                                      | Khuyến nghị      |
| Inventory_Balance / Inventory_Movement | Authoritative stock projection/ledger.        | Không đổi.                                                                                         | Không đổi        |

Constraint cần chốt trước migration: nếu item_unique/serial chỉ unique trong phạm vi một SKU thay vì unique toàn hệ thống, phải đổi uniqueness sang (sku_id, item_unique/serial) hoặc tạo normalized composite identity. Yêu cầu người dùng hiện nói “serial/item unique” nên change pack mặc định hướng tới định danh item duy nhất; DEV không được tự thay constraint mà không xác nhận mẫu dữ liệu thật.

# 8. Ảnh hưởng API / OpenAPI

| **Operation / Schema**                   | **Hiện tại**                                        | **Cần đổi**                                                                                                                         |
|------------------------------------------|-----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| ScanBatchRequest.codes                   | string\[\] max 150; hiểu như code.                  | Giữ field để tương thích nhưng đổi semantics thành raw scan payload; tăng maxLength phù hợp (khuyến nghị 512).                      |
| ScanResult                               | code_value, system_code_type, result, target_id.    | Bổ sung payload_version, sku_code, item_unique, normalized_code_value, resolution_status.                                           |
| DocumentScanRequest.codes                | raw Barcode/QR nhưng contract chưa mô tả composite. | Gửi raw payload; backend parse authoritative.                                                                                       |
| DocumentScanMatch                        | code_value, line_id, item_id, result.               | Bổ sung sku_code, item_unique, normalized_code_value, payload_version, resolution_status; item_id có thể null ở inbound trước Post. |
| scanInboundDocument                      | match code vào line.                                | Parse SKU trực tiếp; accept new item candidate; không tạo stock.                                                                    |
| scanOutboundDocument                     | resolve code hiện có.                               | Parse + resolve existing item; cross-check embedded SKU + Item SKU + line SKU.                                                      |
| classifyScanBatch context WARRANTY/TRACE | Có context nhưng response chưa đủ identity fields.  | Dùng làm resolver chung cho warranty/trace; response phải trả parsed identity.                                                      |
| traceInventoryCode                       | path theo code_value.                               | Giữ normalized endpoint; scan UI resolve raw payload trước rồi gọi trace.                                                           |
| WarrantyCase.item_code                   | Create case bằng item_code.                         | Có thể giữ; FE lấy item_code sau resolver. Không bắt buộc sửa WarrantyCase schema nếu dùng classify/resolve trước.                  |

# 9. Error/result mới hoặc cần làm rõ

| **Code/result**              | **Context**             | **Expected effect**                                              |
|------------------------------|-------------------------|------------------------------------------------------------------|
| INVALID_PAYLOAD              | All                     | Không ghi business state; có thể ghi scan audit rejected.        |
| UNSUPPORTED_PAYLOAD_VERSION  | All                     | Reject; không fallback đoán cấu trúc.                            |
| SKU_NOT_FOUND / SKU_INACTIVE | All                     | Reject; không tự tạo SKU.                                        |
| WRONG_SKU                    | Inbound/Outbound        | Không match line; không movement.                                |
| DUPLICATE                    | All                     | Không tăng scanned_qty lần hai.                                  |
| EXCESS                       | Inbound/Outbound        | Không vượt expected/required qty.                                |
| UNKNOWN_CODE                 | Outbound/Warranty/Trace | QR parse được nhưng item_unique chưa được đăng ký/không tồn tại. |
| INVALID_STATE                | Outbound/Warranty       | Item tồn tại nhưng state không hợp lệ.                           |
| ALREADY_ISSUED               | Outbound                | Giữ rule hiện tại.                                               |

# 10. Danh sách phần tài liệu hiện tại sẽ phải sửa nếu hợp nhất sau này

| **Artifact** | **Section/ID**                      | **Nội dung cần cập nhật**                                                     |
|--------------|-------------------------------------|-------------------------------------------------------------------------------|
| BRD          | §4 Nguyên tắc SKU/mã; §5 Data Model | Định nghĩa QR composite, Physical_Code normalized identity, Scan_Event audit. |
| BRD          | §7 Inbound/Outbound/Warranty/Trace  | Thay code_value-only scan bằng raw payload parse + SKU auto-match.            |
| BRD          | §8 Business Rules                   | Thêm QR parse/version/SKU consistency/item registration rules.                |
| BRD          | AC/Test scenarios                   | Thêm invalid payload, wrong embedded SKU, new inbound item, legacy QR.        |
| SRS/FRD      | REQ-SRS-003, 005                    | Carrier/payload và camera decode phải trả structured identity.                |
| SRS/FRD      | REQ-SRS-006/007                     | Inbound scan + Post Receipt register item from accepted composite QR.         |
| SRS/FRD      | REQ-SRS-010/011                     | Outbound scan parse/resolve/cross-check SKU.                                  |
| SRS/FRD      | REQ-SRS-016                         | Warranty IDENTIFIED resolve từ composite QR.                                  |
| SRS/FRD      | REQ-SRS-030                         | Trace scan composite payload.                                                 |
| SRS/FRD      | Data Dictionary                     | Scan_Event parsed fields/length; encoded_payload_version usage; constraints.  |
| SRS/FRD      | Annex C/API matrix                  | Request/response schema và contract tests.                                    |
| BPD          | BP-WMS-02                           | Inbound auto identify SKU; new-item candidate handling.                       |
| BPD          | BP-WMS-05                           | Outbound parser + cross-check SKU; Packing Label flow unchanged.              |
| BPD          | BP-WMS-07                           | Trace resolve raw QR.                                                         |
| BPD          | BP-WMS-08                           | Warranty IDENTIFIED scan composite QR; TEMP_ONLY unchanged.                   |
| OpenAPI      | ScanBatchRequest/Result             | raw payload semantics + parsed identity fields.                               |
| OpenAPI      | DocumentScanRequest/Match           | structured response + length/version.                                         |
| OpenAPI      | scanInbound/scanOutbound            | Description, validation, contract tests.                                      |

# 11. Acceptance Criteria cho change pack

- AC-QR-01: Với PRODUCT QR hợp lệ chứa sku_code + item_unique, backend parse đúng cả hai field và trả normalized identity.

- AC-QR-02: Inbound scan tự match vào line theo embedded sku_code; người dùng không phải chọn SKU cho từng item.

- AC-QR-03: Inbound item chưa tồn tại được chấp nhận như new item candidate nếu SKU hợp lệ và chưa trùng; scan không tăng tồn.

- AC-QR-04: Post Receipt chỉ thành công khi full match; tạo/đăng ký item/Physical_Code cần thiết và tăng tồn đúng một lần.

- AC-QR-05: Outbound scan chỉ nhận item đã tồn tại và IN_STOCK; embedded SKU lệch DB/line bị reject.

- AC-QR-06: Warranty IDENTIFIED quét QR tự resolve item/SKU; không resolve được thì không tự suy đoán link, có thể dùng TEMP_ONLY.

- AC-QR-07: Trace từ camera dùng raw payload -\> resolver -\> normalized code -\> movement chain.

- AC-QR-08: Invalid payload/version/SKU không tạo movement, không đổi Balance và không tăng scanned_qty.

- AC-QR-09: RFID/Packing Label/Reversal/App PV giữ nguyên business effect.

- AC-QR-10: Legacy code path (nếu bật) và QR composite cùng dùng một backend resolver contract, không có parser business ở FE.

# 12. Điểm cần chốt trước khi production

| **ID**    | **Điểm cần chốt**                                              | **Khuyến nghị**                                                                                |
|-----------|----------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| DEC-QR-01 | Format QR thực tế/delimiter/version do nhà cung cấp phát hành. | Parser adapter + payload_version; không hardcode ở FE.                                         |
| DEC-QR-02 | item_unique có unique toàn hệ thống hay chỉ trong SKU.         | Ưu tiên global unique; nếu không, chuẩn hóa composite key và migration constraint.             |
| DEC-QR-03 | Thời điểm tạo Item_Instance: scan hay Post.                    | Khuyến nghị tạo/commit tại Post Receipt; scan lưu candidate để tránh orphan.                   |
| DEC-QR-04 | Thời gian support QR/code legacy.                              | Cho phép transition flag; mã mới bắt buộc composite, mã cũ vẫn resolve đến khi migration xong. |

Change Pack 20/08/2026 - Nội bộ DEV/BA/QA
