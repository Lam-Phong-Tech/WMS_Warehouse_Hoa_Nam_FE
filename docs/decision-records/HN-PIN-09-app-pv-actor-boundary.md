# HN-PIN-09 — Ranh giới actor và phạm vi "Hàng chờ" của App PV

| Trường | Giá trị |
|---|---|
| Pin ID | HN-PIN-09 |
| Ticket | WWHN-252 (FE252-P1-04) |
| Nguồn chuẩn | HN_SRS_FRD_v1.12_FULL — §3, §8.1, §13.8, §15 (OP-09), Annex C, Annex D |
| Ngày chốt | 2026-08-18 |
| Trạng thái | ĐÃ CHỐT — không còn hai cách hiểu |

## 1. Vấn đề cần chốt

Register FE252-P1-04 ghi: *"Chưa khóa rõ Hàng chờ: public read-only catalog hay
authenticated/assigned queue/action; hiện source đang có hai cách hiểu."*

Hai cách hiểu đang tồn tại:

- **(A) Public read-only catalog** — App PV là mặt trưng bày sản phẩm cho người
  xem ẩn danh, chỉ đọc.
- **(B) Authenticated/assigned queue** — App PV là hàng chờ công việc được giao
  cho một actor đã đăng nhập, có hành động (nhận việc, xử lý, hoàn tất).

## 2. Quyết định

**Chốt phương án (A): App PV là catalog công khai, chỉ đọc, cho actor ẩn danh.**
Không có hàng chờ công việc, không có hành động thay đổi trạng thái, không có
gán việc cho người dùng trong phạm vi App PV của MVP.

## 3. Căn cứ trong SRS v1.12 (không suy diễn)

| # | Điều khoản | Nội dung chốt |
|---|---|---|
| 1 | §3 bảng Actor | "Người xem App PV — Read-only published product and available quantity." Actor này **không** có dòng nào cấp hành động ghi. |
| 2 | §8.1 Endpoint Catalog, nhóm PV | `GET /pv/products\|industries\|recommendations` → **PUBLIC_ANONYMOUS**. Chỉ `PATCH /pv/products/{sku_id}/publish` (pv.publish) và `/pv-admin/resources/{resource_type}` (pv.master.manage) là có xác thực — và cả hai là màn **quản trị nội bộ**, không phải App PV. |
| 3 | Annex C | 4 operation `listPvProducts / getPvProduct / listPvIndustries / listPvRecommendations` đều khai `security: []` và error set `400, 404, 429, 500` — không có 401/403, tức là **không hề có khái niệm "đã đăng nhập"** ở nhóm này. |
| 4 | §15 OP-09 (Controlled Amendment 12/08/2026, có precedence) | "Anonymous public PV responses expose published SKU available_qty, stock_status and data_as_of only; they exclude serial/item/container/movement/cost and internal operational data." |
| 5 | Annex D | App PV chỉ có **SCR-PV-01 (List)**, **SCR-PV-02 (Detail)** và **SCR-PV-ADM-01 (Admin)**. Không có màn queue/assignment nào. |
| 6 | REQ-SRS-017/018 | "Web App responsive list/detail/search/filter" + "PV hiển thị available_qty kho tổng, **read-only**". |
| 7 | Wireframe MVP ALIGNED v3.20 | Tiêu đề tài liệu ghi rõ "Không gồm App PV" và MAP-01 ghi "Không dựng App PV trong bộ wireframe này" — nên **không được lấy wireframe làm nguồn suy ra hàng chờ**. |

## 4. Ranh giới cụ thể (dùng làm AC cho FE/BE/QA)

| Khía cạnh | Chốt |
|---|---|
| Actor | Ẩn danh. Không đăng nhập, không profile, không phiên làm việc. |
| Public/auth boundary | `/pv/*` (4 operation đọc) = public. `/pv/products/{id}/publish` = `pv.publish`. `/pv-admin/resources/*` = `pv.master.manage`. Không có mức trung gian. |
| Queue | **KHÔNG CÓ** trong MVP. Không entity, không endpoint, không màn hình, không permission. |
| Detail | SCR-PV-02, chỉ đọc; deep-link tới SKU chưa publish/không ACTIVE trả **404 masked** (§13.8), không được trả 403 vì 403 tự xác nhận SKU tồn tại. |
| Action | Người xem App PV **không có hành động nào**. Publish/unpublish là hành động của nhân viên nội bộ trên SCR-PV-ADM-01 với quyền `pv.publish`. |
| Read permission | Không có permission key nào cho người xem App PV — đó là ý nghĩa của PUBLIC_ANONYMOUS. Đọc được là do route nằm ngoài `auth:api`, có `throttle:pv-public` chống lạm dụng. |
| Dữ liệu được lộ | sku_code/tên hiển thị/mô tả/thương hiệu/nhóm hàng/nguồn điện/ảnh/ngành nghề/tag + `available_qty`, `stock_status`, `stock_label`, `data_as_of`, `last_inventory_sync_at`. |
| Dữ liệu bị cấm | serial, item, container, movement, cost, warehouse_id, reserved_qty, on_hand_qty, mọi PII bảo hành (§13.8: "never public PV"). |

## 5. Vì sao cách hiểu (B) bị loại

Không phải vì "ít khả năng hơn" mà vì nó **mâu thuẫn trực tiếp** với văn bản:
`security: []` trong Annex C và PUBLIC_ANONYMOUS trong §8.1 loại bỏ khả năng có
một hàng chờ gán theo người dùng — một hàng chờ như vậy bắt buộc phải biết người
dùng là ai, tức là phải có xác thực, tức là error set phải có 401/403. Annex C
không khai hai mã đó cho nhóm PV.

## 6. Ảnh hưởng downstream

- **FE**: `/pv` và `/pv/products/:skuId` khai NGOÀI `ProtectedRoute`; client gọi
  chúng không được gắn `Authorization`. `/pv-admin` nằm trong `ProtectedRoute`.
- **BE**: nhóm 4 operation đọc nằm ngoài `auth:api`, trong `throttle:pv-public`.
- **QA**: không viết test case cho queue/assignment ở App PV; test 404-masking,
  400-not-422, 429, và no-operational-leak thay thế.

## 7. Điều kiện mở lại

Pin này chỉ được mở lại bằng một amendment có precedence tương đương §15
(disposition của PM/PO/Process Owner), kèm sửa Annex C để nhóm PV có `security`
và error set 401/403. Trước khi có amendment đó, mọi yêu cầu "thêm hàng chờ vào
App PV" là **out of scope MVP**.
