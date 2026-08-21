HOA NAM WMS \| Implementation Delta \| 20/08/2026


**HƯỚNG DẪN DEV TRIỂN KHAI “ĐÃ QUÉT XONG THÙNG”**

**Backend + Frontend \| sửa tối thiểu trên branch m1**

Version 1.0 \| 20/08/2026


Target: bổ sung carton scan context cho PRODUCT Inbound. Không redesign inventory, không thêm state FULL/PARTIAL, không đổi Full Post. Ưu tiên tái sử dụng contract hiện có: inbound scan đã có container_id và inbound_scan_entries đã lưu/đọc container_id.


# 1. Kiến trúc mục tiêu


\[FE scan CARTON\]  
↓ classify/resolve  
{ container_id, carton_code, sku_id }  
↓  
FE activeCarton = container  
↓  
\[FE scan PRODUCT QR\]  
↓  
POST inbound scan  
{ line_id, code_value/raw payload, item_id..., container_id: activeCarton.id }  
↓  
BE validate + persist inbound_scan_entry.container_id  
(stock_effect = NONE)  
↓  
\[ĐÃ QUÉT XONG THÙNG\]  
↓  
POST complete-scan audit (đề xuất mới, stock-neutral)  
↓  
FE activeCarton = null  
↓  
scan carton tiếp theo hoặc Item lẻ  
↓  
Full line match → Post Receipt (logic cũ)



Không dùng container.status để lưu “SCANNING/COMPLETED”. Nếu cần hệ thống lưu bằng chứng đã bấm xong thùng, chỉ ghi audit event; không tạo carton lifecycle mới.


# 2. Hiện trạng code m1 có thể tái sử dụng

| **Layer / file**                            | **Hiện đã có**                                                                                   | **Hành động**                                                               |
|---------------------------------------------|--------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| BE – InboundDocumentController.php          | Contract inbound scan có line_id, qty, code_value, item_id, container_id.                        | Giữ contract; đồng bộ Swagger/OpenAPI nếu artifact đang thiếu container_id. |
| BE – CurrentBaselineStockFlowController.php | Runtime POST /inbound-documents/{id}/scans nhận container_id; scan stock-neutral/idempotent.     | Tái sử dụng; verify persist + validation container.                         |
| BE – CurrentBaselineDocumentController.php  | GET scan entries trả e.container_id.                                                             | Tái sử dụng để FE đếm/hiển thị Item theo carton.                            |
| BE – ScanClassificationService.php          | Resolver CONTAINER thực tế đã tạo container_id/container_code/sku_id trong payload nội bộ.       | Expose đầy đủ container_id/container_code ở API classify response.          |
| FE – scanService.ts + scan/types            | classify biết classification=CONTAINER nhưng normalize/type hiện bỏ container_id/container_code. | Bổ sung 2 field vào type + normalize response.                              |
| FE – inboundService.ts                      | ScanOptions đã có containerId; request đã gửi container_id khi có.                               | Không viết lại scan service; chỉ truyền activeCarton.id cho PRODUCT.        |
| FE – inbound/types/index.ts                 | InboundScanEntry đã có containerId.                                                              | Có thể giữ; thêm type ActiveCarton UI nếu muốn.                             |
| FE – MvpInboundScreens.tsx                  | InboundScanModal chưa có active PRODUCT carton; containerId hiện chủ yếu dùng BOX component.     | Đây là file FE phải sửa chính.                                              |

# 3. Backend – phần phải sửa / verify

## 3.1. Expose container identity từ scan/classify

- Trong ScanController Swagger response và ScanClassifyResponse, bổ sung \`container_id\` và \`container_code\` nullable.

- Trong FE normalizeClassifyResponse phải giữ hai field này. \`classification=CONTAINER\` phải trả \`container_id\` non-null.

- Không thay business identity của ITEM QR; đây chỉ là resolve mã CARTON.


// target classify data (CONTAINER)  
{  
"classification": "CONTAINER",  
"container_id": "\<uuid\>",  
"container_code": "CTN-001",  
"sku_id": "\<sku uuid\>",  
"stock_effect": "NONE"  
}


## 3.2. Inbound item scan với container_id

- Giữ endpoint scan hiện tại. Khi PRODUCT scan có active carton, request bắt buộc mang \`container_id\`.

- BE phải verify container tồn tại/usable, loại CARTON, và primary SKU của carton khớp SKU của inbound line/Item.

- Persist \`container_id\` vào \`inbound_scan_entries\` và mapping Item–Carton theo cơ chế hiện có. Không tăng tồn.

- Idempotency fingerprint phải tiếp tục bao gồm container_id để cùng mã nhưng khác thùng không bị coi là cùng action.

- Item lẻ: request không gửi container_id; BE lưu null.

## 3.3. Endpoint mới nhẹ để ghi nhận “xong thùng”


Đề xuất thêm endpoint audit-only để “hệ thống biết” người dùng đã xác nhận xong thùng nhưng không tạo state mới. Không cần migration DB nếu dùng AuditLogger hiện có.



POST /api/v1/inbound-documents/{id}/cartons/{containerId}/complete-scan  
Permission: inbound.scan  
Guard:  
\- document DRAFT/SCANNING  
\- container là CARTON hợp lệ  
\- carton có ít nhất 1 ACTIVE inbound_scan_entry trong document (hoặc cho phép 0 nếu nghiệp vụ cần)  
Effect:  
\- stock_effect = NONE  
\- movement_created = false  
\- không đổi container.status  
\- ghi AuditLogger action = INBOUND_CARTON_SCAN_COMPLETED  
\- actual_item_qty = SUM/COUNT ACTIVE scan entries của carton trong phiếu  
Response: document_id, container_id, carton_code, actual_item_qty, completed_at


- Không cần \`REOPEN_CARTON\` endpoint. Khi user scan lại cùng carton, FE chỉ set activeCarton lại; audit lần trước vẫn là lịch sử.

- Nếu team quyết định bỏ audit endpoint và chỉ clear FE state thì code ít hơn, nhưng sau F5 server không có evidence “đã bấm xong thùng”. Vì yêu cầu là hệ thống biết mốc này, phương án audit endpoint được ưu tiên.

## 3.4. Không sửa

- \`inventory_balances\`, stock movement/posting semantics.

- Post Receipt transaction/idempotency/If-Match logic.

- Container fullness state. Không thêm \`SCANNING\`, \`FULL\`, \`PARTIAL\`, \`SCAN_COMPLETED\` vào container.status.

- expected_qty auto-adjust. Chỉ Update Inbound hiện tại mới được sửa expected_qty.

# 4. Frontend – phần phải sửa

## 4.1. \`src/modules/scan/types/index.ts\`


export interface ScanClassifyResponse {  
...  
container_id?: string \| null;  
container_code?: string \| null;  
}


## 4.2. \`src/modules/scan/services/scanService.ts\`

- Normalize và trả lại \`container_id\`/\`container_code\` từ backend.

- Khi classification = CONTAINER, validate container_id có giá trị.

- Không tự parse business identity của PRODUCT QR ở FE.

## 4.3. \`src/modules/inbound/pages/MvpInboundScreens.tsx\`

| **Change** | **Behavior** |
|---|---|
| Thêm state | \`activeCarton: { id, code, skuId? } \| null\`. |
| Scan carton | Classify mã. Nếu CONTAINER/CARTON hợp lệ → set activeCarton; hiển thị card “Thùng đang quét”. |
| Scan PRODUCT | Nếu activeCarton != null → gọi scanInboundDocument(..., containerId=activeCarton.id). |
| Nút xong thùng | Hiển thị khi activeCarton != null. Click → call complete-scan audit → set activeCarton=null. |
| Máy lẻ | Chỉ scan như Item lẻ khi activeCarton=null; request không có containerId. |
| Chuyển thùng | Nếu đang active mà user scan CARTON khác, chặn/prompt: “Hãy bấm Đã quét xong thùng hiện tại trước”. |
| Reload | Sau F5 không restore active context ngầm; yêu cầu scan lại carton trước khi scan tiếp Item. |
| Count | Đếm ACTIVE scanEntries theo containerId để hiện “Đã quét N máy”. Nếu có expected_item_qty thì chỉ hiển thị tham khảo. |

~~~
type ActiveCarton = {
id: string;
code: string;
skuId?: string;
};

// Product item scan
await scanInboundDocument(documentId, [rawItemQr], {
lineId,
ifMatch: scanVersion,
containerId: activeCarton?.id, // undefined = máy lẻ
idempotencyKey,
});

// Complete carton
await completeInboundCartonScan(documentId, activeCarton.id);
setActiveCarton(null);
~~~

## 4.4. \`src/modules/inbound/services/inboundService.ts\`

- \`ScanOptions.containerId\` và logic gửi \`container_id\` đã có: giữ nguyên, không duplicate implementation.

- Thêm helper \`completeInboundCartonScan()\` cho endpoint audit mới.

- Nếu cần helper resolve carton, gọi classify service chung; không viết parser mã thùng riêng trong inboundService.

## 4.5. Hook/API endpoint constants

- Thêm endpoint constant cho complete carton audit.

- Thêm mutation hook nếu UI hiện đang chuẩn hóa mọi mutation qua \`use-inbound.ts\`.

- Invalidate/refetch scan entries sau complete hoặc sau scan/unscan để count đúng.

# 5. Validation bắt buộc

| **Rule**                               | **Expected**                                                                    |
|----------------------------------------|---------------------------------------------------------------------------------|
| Carton SKU ≠ inbound line SKU          | Reject; không scan Item vào carton sai SKU.                                     |
| Item duplicate                         | Giữ rule duplicate hiện tại; scanned_qty không tăng lần hai.                    |
| Carton active + scan Item              | Item scan entry phải có đúng container_id.                                      |
| Không có active carton + scan Item     | Hợp lệ như máy lẻ; container_id null.                                           |
| Actual carton count \< hoặc \> dự kiến | Không chặn nút xong thùng; chỉ display variance nếu có dữ liệu dự kiến.         |
| Total actual \> expected_qty line      | Giữ guard hiện tại: phải Update expected_qty tăng trước rồi mới scan phần vượt. |
| Total actual \< expected_qty line      | Post disabled; user giảm expected_qty (nếu đúng thực nhận) hoặc scan tiếp.      |
| Complete carton                        | No balance/movement/posting event; chỉ audit + UI context close.                |

# 6. Contract note – điểm cần đồng bộ


Branch m1 runtime/Swagger inbound scan đã có \`container_id\`, và scan entries đã trả \`container_id\`. Tuy nhiên các artifact OpenAPI/FE classify hiện có thể chưa expose đầy đủ \`container_id/container_code\` của CONTAINER. Khi sửa, regenerate/đồng bộ OpenAPI/Postman/FE types theo runtime; không tạo thêm một đường scan song song.


# 7. Test cases trước merge

| **ID**  | **Scenario**                                | **Expected**                                                                                      |
|---------|---------------------------------------------|---------------------------------------------------------------------------------------------------|
| CTN-T01 | Scan CTN-001                                | classification=CONTAINER; activeCarton=CTN-001; stock 0.                                          |
| CTN-T02 | Scan 5 PRODUCT khi CTN-001 active           | 5 scan entries có container_id=CTN-001; stock 0.                                                  |
| CTN-T03 | Bấm Đã quét xong thùng                      | Audit success; actual_item_qty=5; activeCarton=null; stock 0.                                     |
| CTN-T04 | Sau CTN-001, scan máy lẻ                    | Entry mới container_id=null.                                                                      |
| CTN-T05 | CTN-001 dự kiến 10, thực tế 8               | Cho complete; không auto sửa expected_qty.                                                        |
| CTN-T06 | CTN-001 dự kiến 10, thực tế 12              | Cho complete sau khi line expected_qty đã được điều chỉnh đủ để scan.                             |
| CTN-T07 | Scan CTN-002 khi CTN-001 còn active         | UI chặn/prompt hoàn tất thùng hiện tại.                                                           |
| CTN-T08 | Complete rồi phát hiện sót                  | Scan lại CTN-001 → scan thêm Item → complete lần nữa.                                             |
| CTN-T09 | F5 khi carton active                        | Không tự gán Item sau reload; yêu cầu scan carton lại.                                            |
| CTN-T10 | Full line match sau điều chỉnh expected_qty | Post Receipt +N đúng một lần.                                                                     |
| CTN-T11 | Complete carton retry/network retry         | Không tạo stock; audit có thể idempotent hoặc cho duplicate audit harmless theo contract đã chọn. |
| CTN-T12 | QR PRODUCT SKU+item_unique trong carton     | Backend QR resolver match SKU/Item; container binding vẫn đúng; FE không parse business truth.    |

# 8. Definition of Done

- UI luôn cho người dùng biết rõ thùng nào đang được scan.

- Item trong carton và Item lẻ không bị map nhầm context.

- Có mốc “Đã quét xong thùng” được ghi nhận nhưng không tạo state tồn kho mới.

- Sai lệch số lượng carton không chặn nhận hàng; expected_qty phiếu tiếp tục là target tại Full Post và có thể sửa ở DRAFT/SCANNING.

- Mọi stock effect vẫn chỉ xảy ra ở Post Receipt.

- OpenAPI/FE types/BE runtime thống nhất container_id/container_code.

- Regression Full Post, idempotency, unscan, QR SKU+item_unique và máy lẻ PASS.

# Nguồn/code đã đối chiếu

Nghiệp vụ: BRD v3.20; SRS/FRD v1.12; BPD v1.12; HN-SPEC-INBOUND-001 v1.1; Change Pack QR/SKU 20/08/2026.

BE m1: Modules/Warehouse/app/Http/Controllers/InboundDocumentController.php; CurrentBaselineStockFlowController.php; CurrentBaselineDocumentController.php; ScanController.php; Modules/Warehouse/app/Services/ScanClassificationService.php.

FE m1: src/modules/inbound/pages/MvpInboundScreens.tsx; src/modules/inbound/services/inboundService.ts; src/modules/inbound/types/index.ts; src/modules/scan/services/scanService.ts; src/modules/scan/types/index.ts.


Internal DEV/BA/QA \| Tài liệu ngắn gọn - không thay thế BRD/SRS-FRD/BPD hiện hành
