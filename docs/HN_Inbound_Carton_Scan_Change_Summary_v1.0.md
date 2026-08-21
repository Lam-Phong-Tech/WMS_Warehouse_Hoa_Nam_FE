HOA NAM WMS \| Implementation Delta \| 20/08/2026


**TÓM TẮT THAY ĐỔI LUỒNG NHẬP PRODUCT THEO THÙNG**

**Carton scan context + nút “Đã quét xong thùng”**

Version 1.0 \| 20/08/2026


Mục đích: bổ sung đúng phần còn thiếu của luồng nhập PRODUCT theo CARTON mà không sửa lại toàn bộ BRD/SRS-FRD/BPD. Các rule không nêu trong tài liệu này tiếp tục theo baseline hiện tại. QR PRODUCT chứa SKU + item_unique tiếp tục theo Change Pack QR/SKU đã chốt; tài liệu này không thay đổi format QR đó.


# 1. Vấn đề của luồng hiện tại

- **Baseline hiện tại:** tạo Inbound DRAFT với SKU + expected_qty; scan CARTON/ITEM stock-neutral; Full Post chỉ khi mọi line scanned_qty = expected_qty.

- **Carton hiện tại:** chủ yếu là container/mapping. Không có một action nghiệp vụ rõ để hệ thống biết nhân viên đã quét hết hàng vật lý của thùng.

- **expected_item_qty của thùng:** nếu có chỉ có thể dùng đối chiếu. Thực tế kho vẫn nhận hàng thiếu/thừa và có thể sửa expected_qty của phiếu khi DRAFT/SCANNING, nên không thể dùng “actual = expected của thùng” để tự kết luận thùng đã xong.

- **Rủi ro:** sau CTN-001, nếu scan tiếp máy lẻ hoặc CTN-002 mà không có mốc đóng context thì Item có thể bị gắn nhầm vào thùng trước.

# 2. Thay đổi mới cần bổ sung

| **Điểm**                    | **Hiện tại**                                  | **Mới**                                                                                         |
|-----------------------------|-----------------------------------------------|-------------------------------------------------------------------------------------------------|
| Sau khi scan CARTON         | Chỉ nhận diện/mapping thùng                   | Đặt CARTON đó thành “Thùng đang quét” (active carton context).                                  |
| Trong khi thùng đang active | Không có mốc context rõ                       | Mọi PRODUCT Item scan tiếp theo được map vào active carton bằng container_id.                   |
| Kết thúc thùng              | Không có action rõ                            | Hiển thị nút “Đã quét xong thùng”. Người dùng bấm khi đã quét hết hàng vật lý trong thùng.      |
| Sau khi bấm xong thùng      | Không xác định rõ Item tiếp theo thuộc đâu    | Đóng active carton context. Có thể scan thùng tiếp theo hoặc scan máy lẻ (container_id = null). |
| Số lượng thùng lệch dự kiến | Có thể gây hiểu là phải đủ expected           | Không chặn. Số lượng thùng chỉ tham khảo/đối chiếu; hàng thực tế vẫn được ghi nhận.             |
| Tồn kho                     | Scan stock-neutral; Post Receipt mới tăng tồn | Giữ nguyên hoàn toàn.                                                                           |

# 3. Luồng TO-BE ngắn gọn


Tạo Inbound DRAFT: SKU + expected_qty  
↓  
Scan CTN-001  
↓  
Active carton = CTN-001  
↓  
Scan các QR PRODUCT trong CTN-001  
→ backend parse SKU + item_unique  
→ match đúng inbound line  
→ map Item/scan entry với container_id = CTN-001  
↓  
\[ĐÃ QUÉT XONG THÙNG\]  
↓  
Hệ thống ghi nhận việc kết thúc scan carton (stock-neutral)  
Active carton = null  
↓  
Scan CTN-002 → lặp lại  
HOẶC scan máy lẻ → container_id = null  
↓  
Nếu tổng thực tế khác expected_qty ban đầu:  
→ sửa expected_qty khi DRAFT/SCANNING  
↓  
Mọi line scanned_qty = expected_qty  
↓  
Post Receipt  
↓  
Tăng tồn +N / Item IN_STOCK / Inbound POSTED


# 4. Rule phải chốt để không hiểu sai

| **ID** | **Rule**                                                                                                                                                    |
|--------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| CTN-01 | “Đã quét xong thùng” chỉ xác nhận kết thúc thao tác vật lý với carton hiện tại; không phải Post Receipt.                                                    |
| CTN-02 | Nút này có stock effect = 0; không tạo Inventory_Movement, không đổi Inventory_Balance.                                                                     |
| CTN-03 | Không tạo state độ đầy mới như EMPTY/FULL/PARTIAL và không dùng container.status để biểu diễn “đang quét/xong quét”.                                        |
| CTN-04 | Không bắt actual item count của carton phải bằng expected_item_qty. Nếu có expected_item_qty thì chỉ hiển thị tham khảo/variance.                           |
| CTN-05 | Khi có active carton, PRODUCT Item scan hợp lệ phải mang container_id của carton đó.                                                                        |
| CTN-06 | Máy lẻ chỉ scan khi không còn active carton; scan entry của máy lẻ có container_id = null.                                                                  |
| CTN-07 | Muốn bổ sung máy bị sót sau khi đã bấm xong thùng: scan lại carton → carton trở thành active → scan thêm Item → bấm “Đã quét xong thùng” lần nữa.           |
| CTN-08 | Không cho tự động chỉnh expected_qty khi kết thúc carton. expected_qty chỉ sửa bằng flow Edit Inbound hiện có.                                              |
| CTN-09 | Nếu thực tế thừa so với expected_qty line, phải tăng expected_qty trước khi scan phần vượt; nếu thiếu, có thể giảm expected_qty sau khi xác nhận thực nhận. |
| CTN-10 | Full Post guard giữ nguyên: mọi inbound line phải scanned_qty = expected_qty tại thời điểm Post Receipt.                                                    |

# 5. Các tình huống vận hành

| **Tình huống**                         | **Cách xử lý**                                                                                                       |
|----------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Nhiều thùng                            | Scan thùng → scan hết Item → bấm “Đã quét xong thùng” → scan thùng tiếp theo.                                        |
| Thùng + máy lẻ                         | Hoàn tất các thùng; sau khi active carton = null, scan các máy lẻ trực tiếp.                                         |
| Thùng dự kiến 10, thực tế 8            | Scan 8 → bấm xong thùng. Nếu tổng phiếu thiếu so với expected_qty, sửa expected_qty line về số thực nhận trước Post. |
| Thùng dự kiến 10, thực tế 12           | Tăng expected_qty line đủ để nhận hàng thừa trước khi scan vượt; scan 12 → bấm xong thùng.                           |
| Bấm xong thùng rồi phát hiện sót 1 máy | Scan lại mã carton → scan máy bị sót → bấm xong thùng lại.                                                           |
| F5/đóng màn trong lúc đang quét thùng  | Không suy đoán carton active. Người dùng scan lại mã carton trước khi tiếp tục scan Item để tránh map nhầm.          |

# 6. Những phần KHÔNG đổi

- Inbound vẫn DRAFT → SCANNING → POSTED/CANCELLED; không partial post.

- Scan CARTON/ITEM và thao tác xong thùng đều stock-neutral.

- expected_qty vẫn được phép chỉnh khi DRAFT/SCANNING theo permission/version guard.

- Post Receipt vẫn là action duy nhất của inbound làm tăng tồn và phải atomic/idempotent.

- Carton không phải SKU/tồn độc lập; tồn tính theo Item/quantity bên trong.

- QR PRODUCT SKU + item_unique, RFID optional, Putaway, Reversal và các luồng khác giữ theo tài liệu hiện hành/Change Pack tương ứng.

# 7. Acceptance Criteria tối thiểu

1.  Scan một CARTON hợp lệ thì UI hiển thị rõ “Thùng đang quét” và mã thùng.

2.  Mọi PRODUCT Item scan khi carton active được gửi với đúng container_id và vẫn stock-neutral.

3.  Bấm “Đã quét xong thùng” không thay đổi tồn/movement và làm active carton về null.

4.  Sau khi xong thùng, scan Item lẻ không được gắn vào carton vừa kết thúc.

5.  Không chặn xong thùng khi actual count khác expected_item_qty.

6.  Scan lại carton đã kết thúc cho phép bổ sung Item bị sót mà không cần REOPEN state riêng.

7.  Thừa/thiếu toàn phiếu xử lý bằng sửa expected_qty hiện có; chỉ khi scanned_qty = expected_qty mới Post.

8.  Post Receipt sau cùng tăng tồn đúng một lần; carton completion không làm thay đổi stock semantics.

# Nguồn tham chiếu

**Baseline nghiệp vụ:** BRD v3.20; SRS/FRD v1.12 §5.1; BPD v1.12; HN-SPEC-INBOUND-001 v1.1. **Delta QR:** HN_Tong the thay doi / HN_Huong dan dev trien khai (20/08/2026).


Internal DEV/BA/QA \| Tài liệu ngắn gọn - không thay thế BRD/SRS-FRD/BPD hiện hành
