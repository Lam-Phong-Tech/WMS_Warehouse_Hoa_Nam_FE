# Flow 06 — Current Baseline (Báo cáo · Packing Label · RFID)

Phiên bản: v1.1 · Cập nhật: 2026-08-19 · Chủ sở hữu: FE1 / Tech Lead
Phạm vi: **hợp đồng nghiệp vụ hiện hành của Flow 06**, dùng làm neo cho cổng
`Flow 06 FE Exact SHA` (`.github/workflows/flow06-fe-exact-sha.yml`, bước
*Current-baseline documentation semantics*).

## Vì sao tài liệu này tồn tại ở đúng đường dẫn này

Cổng Flow 06 khẳng định ba mệnh đề nghiệp vụ bằng cách `grep` vào
`docs/HoaNam_Tai_lieu_tong_hop_Moi_Nhat.md`. Bản tổng hợp cũ ở đường dẫn này bị
đổi tên ở commit `68a6a68` rồi bị xoá hẳn ở `f9f7206` (cùng subject "gỡ cờ 4",
2026-08-16) trong một đợt dọn tài liệu; cổng không được cập nhật theo, nên bước
kiểm ngữ nghĩa **đỏ liên tục kể từ 16/08/2026** — mọi bước sau (lint, typecheck,
test, build) không bao giờ chạy tới. Đó là nguyên nhân đỏ thứ hai của
WWHN-258 / FE258-P1-01, độc lập với lỗi Prettier.

Tài liệu này khôi phục **đúng phần baseline mà cổng bảo vệ**, không phục dựng lại
938 dòng bản cũ: nội dung chi tiết đã nằm ở bốn tài liệu baseline còn sống và
tài liệu này không được phép mâu thuẫn với chúng.

| Nguồn chuẩn | Vai trò |
| --- | --- |
| `docs/HN_SRS_FRD_v1.12_FULL.md` | §13.10 Report Contract, §13.8 Privacy, §5.6 BR-RPT/BR-EXP, Annex C/D |
| `docs/HoaNam_ERD_Moi_Nhat.md` | Lược đồ dữ liệu, `UNIQUE(outbound_document_id)`, `customer_phone` |
| `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` | Kiến trúc FE, `PERMISSION_CATALOG`, mục "Flow 06 — Current Report / Packing Label Baseline" |
| `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html` | RPT-01 màn hình nguồn |

## 1. Packing Label — cardinality hiện hành

Baseline hiện hành: **đúng 01 Packing Label cho phiếu/lô** xuất. Nhãn là một
snapshot bất biến, chỉ sinh sau khi scan đủ, và mang số điện thoại người nhận
cùng dữ liệu tổng hợp SKU/Item của phiếu.

ERD khoá ràng buộc này bằng `UNIQUE(outbound_document_id)` trên bảng nhãn — một
phiếu xuất không thể có hai nhãn.

Hệ quả cho báo cáo RPT-LABEL-01: cột "số lần in" đếm **lần in**, không đếm nhãn.
Mọi hành vi in/in lại là stock-neutral.

## 2. RFID — không phải cổng chặn

RFID là **tuỳ chọn** với hàng PRODUCT và **không bao giờ chặn Post Issue**. Các
guard bắt buộc khi Post Issue vẫn là: khớp item cụ thể, post toàn phiếu một lần,
đủ tồn, idempotency và guard tương tranh.

## 3. Ranh giới ảnh hưởng tồn kho

Scan / in nhãn / in lại / apply / RFID đều **stock-neutral**. Chỉ Post Issue mới
trừ tồn. Mọi sửa sai sau Post đi bằng Reversal append-only (DEC-REV-001 /
WWHN-26), không sửa trực tiếp ledger hay balance.

## 4. Báo cáo Flow 06 — tám nhóm MVP

Tồn kho hiện tại · Nhập-Xuất-Tồn · Lịch sử phiếu nhập/xuất · Movement/Trace ·
Đối soát toa (Import/Match) · Nhật ký Packing Label · Bảo hành & linh kiện ·
Xuất theo nơi nhận (Agency).

- Đọc báo cáo cần `report.view`; xuất XLSX/PDF cần `report.export`.
- Danh sách phân trang tại BE (`page`, `per_page`); export dùng đúng bộ lọc của
  màn hình và bị chặn ở **10.000 dòng/file**.
- Agency chỉ là chiều "nơi nhận", không bao giờ là bucket tồn kho.
- Stocktake / Variance / Adjustment nằm ngoài MVP hiện hành (REQ-SRS-037);
  đường sửa sai là đối soát + Reversal append-only.

## 5. PII bảo hành trong báo cáo

Cột khách hàng (`customer_name`, `customer_phone`, `customer_address`) **luôn
hiển thị ở dạng đã mask** trên API đọc và trên màn hình.

File export chỉ chứa PII thô khi hội đủ **cả hai**: actor có
`warranty.pii.export` **và** gửi kèm `reason` từ 5 ký tự trở lên. Thiếu quyền mà
vẫn gửi `reason` → 403 `PERMISSION_DENIED`; `reason` quá ngắn → 422
`PII_EXPORT_REASON_INVALID`; không gửi `reason` → file vẫn xuất nhưng đã mask.
Mọi lần export đều được audit kèm lý do (§13.8, NFR-SRS-015).
