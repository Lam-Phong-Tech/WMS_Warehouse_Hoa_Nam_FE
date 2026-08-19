# WWHN-242 — Ma trận bằng chứng QA2 (REV-00 / REV-01)

**Exact frozen SHA:** `2d9ca77bff67d27d4bc235ebf4542edb1d42f888`

**Lớp bằng chứng:** `FE_CONTROLLED_NOT_UAT` — payload mock deterministic, chạy trên đúng cây tại SHA trên.
Bằng chứng này KHÔNG thay lượt chạy độc lập của QA2 và KHÔNG phải UAT; nó là bộ
ca kiểm thử + ảnh để QA2 đối chiếu và chạy lại, kèm neo tài liệu cho từng ca.

**Tệp thuộc phạm vi hoàn đảo tại SHA này:** sạch (đã commit toàn bộ).

## Cách kiểm chứng lại (không cần tin lời FE)

```bash
git checkout 2d9ca77bff67d27d4bc235ebf4542edb1d42f888
SOURCE_SHA=2d9ca77bff67d27d4bc235ebf4542edb1d42f888 npm run test:e2e:wwhn-242
npm run verify:wwhn-242
```

Băm lại toàn bộ ảnh và so với `SHA256SUMS` trong cùng thư mục:

```bash
sha256sum -c SHA256SUMS
```

## Ma trận

| # | Ca kiểm thử | Neo tài liệu | Kỳ vọng | Ảnh (khổ màn hình) |
| --- | --- | --- | --- | --- |
| 1 | REV-00 · danh sách hoàn đảo | Annex D SCR-REV-01; NFR-SRS-006 | Hiện reversal_code + chứng từ nguồn; không tràn ngang ở cả bốn khổ màn hình. | [1366x768](./WWHN-242__rev00-list__inventory-view-inventory-reversal-post__1366x768.png)<br />[1440x900](./WWHN-242__rev00-list__inventory-view-inventory-reversal-post__1440x900.png)<br />[390x844](./WWHN-242__rev00-list__inventory-view-inventory-reversal-post__390x844.png)<br />[768x1024](./WWHN-242__rev00-list__inventory-view-inventory-reversal-post__768x1024.png) |
| 2 | REV-01 · chi tiết hoàn đảo | Annex D SCR-REV-01; SRS §5.5 BR-REV-01 | Movement gốc read-only hiển thị đúng mã; không tràn ngang ở cả bốn khổ. | [1366x768](./WWHN-242__rev01-detail__inventory-view-inventory-reversal-post__1366x768.png)<br />[1440x900](./WWHN-242__rev01-detail__inventory-view-inventory-reversal-post__1440x900.png)<br />[390x844](./WWHN-242__rev01-detail__inventory-view-inventory-reversal-post__390x844.png)<br />[768x1024](./WWHN-242__rev01-detail__inventory-view-inventory-reversal-post__768x1024.png) |
| 3 | REV-01 · hộp xác nhận trước khi Post | Annex D SCR-REV-01 (confirmation shows stock effect); BR-REV-01/08 | Hộp xác nhận nêu rõ append-only/không hoàn tác; bấm 'Kiểm tra lại' là no-write. | [1366x768](./WWHN-242__rev01-confirm__inventory-view-inventory-reversal-post__1366x768.png)<br />[1440x900](./WWHN-242__rev01-confirm__inventory-view-inventory-reversal-post__1440x900.png)<br />[390x844](./WWHN-242__rev01-confirm__inventory-view-inventory-reversal-post__390x844.png)<br />[768x1024](./WWHN-242__rev01-confirm__inventory-view-inventory-reversal-post__768x1024.png) |
| 4 | REV-00 · lỗi 403 DATA_SCOPE_DENIED | SRS §8.1 default deny; §8.2 bảng HTTP↔mã lỗi | Hiện NoPermissionState chuẩn hệ thống (không phải bảng trắng); không tràn ngang. | [1366x768](./WWHN-242__list-error-403__inventory-view-inventory-reversal-post__1366x768.png)<br />[1440x900](./WWHN-242__list-error-403__inventory-view-inventory-reversal-post__1440x900.png)<br />[390x844](./WWHN-242__list-error-403__inventory-view-inventory-reversal-post__390x844.png)<br />[768x1024](./WWHN-242__list-error-403__inventory-view-inventory-reversal-post__768x1024.png) |
| 5 | RBAC · vai chỉ có inventory.view | SRS §3 ma trận quyền; §8.1 | Vào được REV-00 ở chế độ đọc, có ghi chú chỉ đọc, KHÔNG có nút tạo/Post/huỷ. | [1440x900](./WWHN-242__role-readonly__inventory-view__1440x900.png) |
| 6 | RBAC · vai có inventory.reversal.post | SRS §3; BR-REV-02 | Hiện hành động tạo hoàn đảo; không có ghi chú chỉ đọc. | [1440x900](./WWHN-242__role-writer__inventory-view-inventory-reversal-post__1440x900.png) |
| 7 | Partial 2/20 + dependency guard | BR-REV-03/04/05 | Movement có downstream hiện đúng mã guard của BE; đảo một phần 2/20 được chấp nhận. | [1440x900](./WWHN-242__rev01-partial-and-guard__inventory-view-inventory-reversal-post__1440x900.png) |
| 8 | §6 · bước CONFIRMED (hàng vật lý đã về) | SRS §6 state model; BR-REV-06 | PENDING_RETURN hiện bước xác nhận hàng về và khoá Post cho tới khi xác nhận. | [1440x900](./WWHN-242__lifecycle-pending-return__inventory-view-inventory-reversal-post__1440x900.png) |
| 9 | Post → 403 PERMISSION_DENIED | SRS §8.2; TC-P1-027 | Báo lỗi đúng, KHÔNG tự nạp lại (không phải xung đột version), no-write. | [1440x900](./WWHN-242__post-error-403__inventory-view-inventory-reversal-post__1440x900.png) |
| 10 | Post → 409 DOWNSTREAM_DEPENDENCY_EXISTS | BR-REV-04; TC-P1-028 | Hiện cảnh báo lệch version + tự nạp lại phiếu; phiếu vẫn DRAFT. | [1440x900](./WWHN-242__post-error-409__inventory-view-inventory-reversal-post__1440x900.png) |
| 11 | Post → 412 STALE_VERSION | BR-REV-02 If-Match; TC-P1-031 | Hiện cảnh báo lệch version + tự nạp lại phiếu; phiếu vẫn DRAFT. | [1440x900](./WWHN-242__post-error-412__inventory-view-inventory-reversal-post__1440x900.png) |
| 12 | Post → 422 REVERSAL_QTY_EXCEEDS_REVERSIBLE | BR-REV-05; TC-P1-026 | Báo lỗi nghiệp vụ, KHÔNG tự nạp lại, no-write. | [1440x900](./WWHN-242__post-error-422__inventory-view-inventory-reversal-post__1440x900.png) |
| 13 | Post → 428 PRECONDITION_REQUIRED | BR-REV-02; SRS §8.2 | Hiện cảnh báo lệch version + tự nạp lại phiếu; phiếu vẫn DRAFT. | [1440x900](./WWHN-242__post-error-428__inventory-view-inventory-reversal-post__1440x900.png) |

## Ghi chú ranh giới

- Bốn khổ bắt buộc của FE242-P2-01: 1440x900, 1366x768, 768x1024, 390x844.
- Mỗi ảnh có một tệp `.json` cùng tên chứa metadata (route, role, assertion, timestamp).
- Data scope phía backend được chứng minh riêng bằng `Wwhn242ReversalScopeAndProjectionTest`
  (7/7 PASS) trong repo BE, không phải bằng ảnh chụp UI.

