# Rà soát lại dữ liệu API ngoài báo cáo — 24/09/2026

## Kết luận: còn lỗi cần sửa, chưa đủ điều kiện nghiệm thu toàn bộ

Phạm vi ghi: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`, chỉ nhánh `dev`. Không tạo nhánh mới, không sửa `src/modules/reports/**`, không sửa backend, không tạo/sửa/seed bản ghi kho để kiểm thử.

Mốc FE trước rà soát: `b248ab95108aa0cbc10965a57f679a8910367fd9`.
Mốc BE dùng đối chiếu chỉ đọc: `a7b1203596e810bdf7708058c86778e75b9b14b3`.

## Các sửa chữa đã kiểm tra trong đợt này

| Tệp | Sửa chữa |
| --- | --- |
| `src/shared/api/documentAttachmentService.ts` | Không tự gán `NOT_REQUIRED`, `ACTIVE` hoặc `OTHER` khi response thiếu trường. Kiểm tra enum và boolean do API trả về. Payload danh sách sai dạng phải báo lỗi, không biến thành danh sách rỗng. Dung lượng thiếu/không hợp lệ giữ null, không hiển thị 0 byte. |
| `src/shared/components/DocumentAttachmentsPanel.tsx` | Render lỗi tải và nút thử lại; không trình bày trạng thái không bắt buộc/chứng từ cũ như kết quả tải thành công khi request lỗi. Dung lượng chưa biết hiển thị giá trị trống theo UI hiện hành. |
| `src/modules/inventory/services/inventoryService.ts` | Net effect thiếu số lượng, số lần đảo hoặc cờ đảo hết giữ null; không tự bịa basis LEDGER. Dữ liệu biến động ưu tiên `qty_delta` có dấu. |
| `src/modules/inventory/components/TraceModal.tsx` | Đọc `qty_delta` ở chi tiết biến động thay vì bỏ sót trường này. Không chuyển số lượng thiếu thành 0 hoặc trạng thái chưa rõ thành còn hiệu lực. Bỏ row key ngẫu nhiên; khóa render tách biệt với định danh nghiệp vụ. |
| `src/shared/api/nonreport-read-integrity.test.ts` | Thêm 13 test về metadata chứng từ thiếu/sai, danh sách rỗng đã xác nhận so với payload sai dạng, net effect chưa biết, số 0 và số âm thật từ response. Test không gửi request ghi vào hệ thống kho. |

Contract đối chiếu: `Modules/Warehouse/app/Http/Controllers/DocumentAttachmentController.php` tại BE SHA trên. `indexPayload()` luôn công bố `meta.evidence_status` và boolean `meta.requires_evidence`; metadata attachment có loại, trạng thái và dung lượng. Không suy các giá trị này từ lỗi HTTP hoặc sự vắng mặt của response.

## Bằng chứng kiểm tra

Bản source candidate đã chạy: tree `74ec4c92836f25dc22398284b3d0d4f1b1f63357`, parent `9fab97b3d86343269dbde29b3c5245673ea5082c`.
Run: https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE/actions/runs/35964772834
Job: `107520830511`.

- Typecheck toàn bộ consumer: PASS.
- Build toàn bộ ứng dụng: PASS.
- Test ngoài báo cáo: **903 tổng, 891 đạt, 12 lỗi**.
- 13 test bổ sung đều đạt. Danh tính 12 test lỗi trùng với baseline `b248ab9`; không có test lỗi mới trong lần chạy này. Bộ test vẫn FAIL, không được diễn giải là toàn bộ PASS.
- `git diff --check`: PASS; không có source diff trong `src/modules/reports`.
- Commit bàn giao giữ nguyên các tệp source/test của candidate đã kiểm tra; chỉ bổ sung tài liệu này và xóa workflow/script vá tạm. Các thay đổi tài liệu/dọn công cụ không phải bằng chứng về deployment.

Baseline đã kiểm tra lại trên source thật `b248ab9`:
https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE/actions/runs/35877314426
Typecheck/build PASS; 890 test, 878 đạt, 12 lỗi. Guard phát hiện 0 vi phạm theo các quy tắc hiện có. Inspector ghi 439 tệp runtime văn bản, 436 tệp mã và 110 vị trí khai báo modal/dialog/drawer. Đây là số vị trí trong mã, KHÔNG phải 110 kịch bản trình duyệt đã chạy đạt và KHÔNG là chứng nhận mọi dữ liệu đúng.

## Những điểm còn tồn tại đã đọc lại và xác nhận

Các tệp dưới đây chưa được sửa trong đợt này. Danh sách là các phát hiện đã xác nhận, không khẳng định mọi lỗi khác đã được loại trừ.

### 1. Bảo hành: `src/modules/warranty/services/warrantyService.ts`

`canonicalStatus()` mặc định RECEIVED khi trạng thái thiếu/lạ; priority mặc định MEDIUM; version mặc định 1. Identification còn được suy ra khi API bỏ trường. Lịch sử và đính kèm có các mặc định STATUS_CHANGE, IMAGE, ACTIVE và dung lượng 0.

Cần phân biệt dữ liệu chưa xác định với enum/số liệu máy chủ xác nhận; kiểm tra consumer và contract để không phá các alias legacy hợp lệ. Không tự sinh version cho thao tác cập nhật. Không biến response ghi thiếu thông tin thành thất bại chắc chắn rồi tự gửi lại.

### 2. Nhập kho: `src/modules/inbound/services/inboundService.ts`

`num(value)` vẫn chuyển thiếu số liệu thành 0. Cờ `product_info_complete !== false` coi thiếu cờ là đủ thông tin; `pending_product_info === true` coi thiếu cờ là không chờ bổ sung. Tổng expected/scanned cần phân biệt dữ liệu không được gửi với số 0 thật. Version danh sách/chi tiết đã được sửa ở đợt trước, không còn fallback 1 tại chỗ đó.

Cần ánh xạ từng trường theo endpoint hiện hành, render unknown/partial và kiểm thử quyền thao tác, dữ liệu quét thực tế, danh sách rỗng thật.

### 3. Xuất kho: `src/modules/outbound/services/mvpOutboundService.ts`

`num()` còn chuyển thiếu/không hợp lệ thành 0. `rawLines()` mặc định mảng rỗng rồi tổng expected/scanned reduce từ 0. `code` còn fallback về ID khi thiếu mã phiếu. Version thiếu thành 0.

Cần không dùng UUID thay mã phiếu; giữ số liệu chưa có là chưa xác định và chỉ tổng hợp khi đủ tập dòng hoặc aggregate đúng scope từ API. Kiểm tra version thực trước các thao tác ghi.

### 4. Danh mục/tham chiếu SKU: `src/modules/master-data/services/mvp-master.service.ts`

`listCatalogRefs()` bắt mọi lỗi thành `[]`, chỉ đọc một trang active với per_page 200. `hasMvpSkuStock()` bắt lỗi thành false và thiếu on_hand thành 0. Hành vi này không phân biệt không tải được với không có bản ghi/tồn; có thể thiếu tham chiếu ngoài trang đã tải hoặc tham chiếu hiện đã inactive.

Cần trạng thái lỗi/unknown riêng, xử lý phân trang đúng metadata và tra các ID thật cần hiển thị. Backend vẫn là chốt chặn ghi; chưa kết luận những fallback này gây vượt quyền hay ghi sai dữ liệu.

### 5. Nhập danh mục SKU: `src/modules/master-data/services/sku-import.service.ts`

Các tổng total/valid/error/inserted/updated/skipped mặc định 0 và các cờ committed/partial_write/dry_run mặc định false khi trường thiếu. Cần giữ kết quả chưa xác định thay vì trình bày con số hoặc kết quả giao dịch chắc chắn. Các phép tính đơn vị từ số liệu API và mặc định tham số request hợp lệ không phải dữ liệu mẫu, không xóa máy móc.

### 6. 12 test tồn tại từ trước

- `SessionConfirmationGate.test.tsx`: 1 lỗi do thiếu QueryClient trong đường render được test.
- `LoginPage.mfa.test.tsx`: 2 lỗi truy cập trường Email không còn khớp UI.
- `LoginPage.test.tsx`: 2 lỗi kỳ vọng form/kiểm tra email.
- `LoginPage.transport-diagnostic.test.tsx`: 4 lỗi truy cập trường Email.
- `DashboardSnapshot.test.tsx`: 1 lỗi chọn custom range.
- `DashboardPage.test.tsx`: 2 lỗi kỳ vọng snapshot tiếng Anh và tính độc lập filter chart/KPI.

Cần đối chiếu UI và hành vi hiện hành, sửa code hoặc test đúng nguyên nhân. Không skip/xóa test để tạo PASS. Test thất bại không tự chứng minh toàn bộ luồng thật tương ứng đã hỏng.

## Điều kiện còn thiếu để nghiệm thu toàn bộ

1. Đóng các phát hiện trên, tiếp tục kiểm tra các mapper còn lại (kể cả dịch vụ scan/shipping legacy còn được dùng) và dependency dùng chung. Có ma trận route → component/modal → query/endpoint → field/aggregate → trạng thái lỗi/trống/partial.
2. Bộ test phải PASS thực sự trên cùng SHA; không chỉ build hoặc guard tên mock. Kiểm tra số 0, null, thiếu field, sai kiểu, payload thiếu trang, response đến sai thứ tự, đổi kho/phiếu và cache sau ghi.
3. Chạy phiên đăng nhập với API thật cho các màn/modal trong scope và đối soát luồng Nhập → Tồn → Xuất/Bảo hành → Hoàn tác, với bằng chứng response và dữ liệu hiển thị cùng bộ lọc/kho/chứng từ. Không tự tạo giao dịch kho để thay thế bằng chứng còn thiếu.
4. Xác nhận source/build đã triển khai và phiên bản backend thực tế. Trong lần này công cụ đọc web trả lỗi truy cập/proxy với địa chỉ frontend đã dùng trước đây; chưa kiểm chứng phiên đăng nhập/deployment. Không kết luận website ngừng hoạt động từ lỗi của công cụ.

Giữ workflow verification chỉ đọc và guard hiện có. Xóa công cụ vá một lần sau bàn giao source. Dữ liệu kiểm thử còn nằm riêng trong test; không được import vào runtime, không được làm fallback khi API lỗi. Không có tuyên bố đã xóa mọi fixture kiểm thử khỏi lịch sử hoặc toàn repository.
