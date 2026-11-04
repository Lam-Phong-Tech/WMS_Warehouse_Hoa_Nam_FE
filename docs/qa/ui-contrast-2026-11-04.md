# Kiểm chứng viền và độ tương phản — 04/11/2026

Đây là biên bản kiểm chứng, không phải bộ chuẩn thiết kế thứ hai. Quy tắc chính nằm trong `docs/ui/DESIGN_FOUNDATIONS.md` mục 2 và quy cách bảng SKU.

## Nguyên nhân và sửa chữa

- Ảnh 1: đường chia header/nhóm/footer SKU dùng viền trang trí `--ops-line` quá nhạt. Tạo `--ops-divider` cho đường chia cần nhận biết, dùng ở SKU và header/footer `UiDrawer`; giữ nguyên viền trang trí và palette `divider` của bảng.
- Ảnh 2: tiêu đề dùng `--sku-muted`; MUI Drawer elevation 16 thêm gradient trắng 14.5% trên nền dark. Tiêu đề chuyển sang heading, title drawer 18/26px, theme bỏ gradient và dùng surface đặc. `UiText` pageTitle/cardTitle cũng dùng semantic heading.
- Ảnh 3: đầu bảng gán `#d2edf7`, hover gán `#dff0f7` nhưng chữ đổi theo theme. Chuyển nền sang `--ops-table-header`/`--ops-pale`, đầu bảng sang `--ops-heading`, gồm CSS và inline style.
- Đồng bộ cùng mẫu ở danh mục/đại lý/lỗi, nhập/xuất/NFC, tồn kho, bảo hành, sản phẩm ứng dụng, cất hàng, đảo kho, IAM và nhật ký. Đây là rà soát nguồn các mẫu màu liên quan, không chứng nhận toàn bộ màn/luồng của các module.

## Kiểm tra UI thực tế

Lệnh: `npm run test:ui-contrast`.

- **20/20 đạt**, Chromium, light/dark × 1440/1024/768/390/320px.
- Fixture dùng màn SKU, hook, normalizer và theme production; chỉ thay transport đọc bằng dữ liệu kiểm soát, không gọi mutation máy chủ.
- Đầu bảng ≥4.5:1; mũi tên SKU và `RowActionButton` thường/hover/focus bàn phím ≥3:1; title/section drawer ≥7:1; đường chia ≥3:1 và 1px. Kiểm tra cả `UiDrawer` dùng chung.
- Helper đo màu computed của trình duyệt, pha alpha và opacity theo nền tổ tiên. Gradient drawer được kiểm riêng là `none`.
- Kiểm tra drawer không tràn ngang; lưu và xem ảnh desktop light/dark. Ảnh tại `test-results/ui-contrast/table-*.png`, `drawer-*.png` (artifact local, không commit).
- Trước sửa, bộ test ghi nhận đầu bảng light **3.59:1**, dark **1.71:1**, title light **4.38:1**, và gradient trắng trên dark drawer; các ca thất bại đúng triệu chứng.

## Phòng hồi quy

- Cập nhật cả chuẩn chính và quy cách SKU, tránh mâu thuẫn ưu tiên nguồn.
- `ui:tokens` cấm hai hex light cũ ngoài token, kể cả baseline per-file từng cho phép. Self-test đã thất bại trước khi thêm rule và đạt sau khi thêm rule (8 vi phạm tổng hợp).
- Spec fixture có config riêng và bị loại khỏi suite E2E mặc định để tránh chạy nhầm server.
- Có rà soát độc lập; đã khắc phục phạm vi palette divider quá rộng và việc thiếu loại fixture khỏi E2E mặc định.

## Kiểm tra nguồn và môi trường

- Typecheck và lint toàn `src/`: đạt. `git diff --check`: đạt.
- `npm run build`: đạt (tsc, Vite và build manifest); đây là build kiểm tra với biến môi trường test, không phải triển khai lên máy chủ.
- Lint cuối cho toàn bộ file TypeScript thay đổi: đạt.
- Unit tập trung (`operations-palette`, `theme-adapter-parity`, `MvpMasterScreens`): **18 đạt, 1 thất bại**. Hai nhóm palette/theme đạt toàn bộ; các ca SKU và đại lý đạt. Ca lỗi là `thu gọn riêng thống kê và bộ lọc bệnh/lỗi, giữ từ khóa khi mở lại`, tìm nút tên `Bộ lọc tìm kiếm` không còn có trên giao diện bệnh/lỗi.
- `ui:tokens`: **28 vi phạm còn lại** ở file ngoài thay đổi này. Checkout sạch `4c71d1d1d9183d8738eababe5878fe6fb4d5b07e` có **35 vi phạm**; thay đổi này giảm 7 file vi phạm, không tăng baseline.
- Node máy kiểm tra là 26.2.0, trong khi CI dùng Node 22. Vitest trên Node 26 mặc định lỗi `localStorage` khi Zustand persist gọi `setItem`. Chạy unit với `NODE_OPTIONS=--no-experimental-webstorage` để dùng Web Storage của jsdom; chỉ đổi môi trường lệnh kiểm thử, không đổi runtime sản phẩm.
- Đã khởi chạy suite Vitest đầy đủ với 2 worker và phát hiện 10 ca thất bại trong `DefectMasterScreen.test.tsx`. Đã dừng lượt chạy rộng để đối chiếu baseline và ưu tiên kiểm chứng phạm vi sửa; **không coi toàn suite đã đạt**. Log local: `ui-contrast-vitest-final.log`.
- Đối chiếu checkout sạch tại SHA gốc: ca `keeps query filters, paging, apply and reset connected to the API hook` cũng thất bại ở assertion tham số hook; ca bệnh/lỗi trong `MvpMasterScreens` cũng thất bại vì không tìm được nút `Bộ lọc tìm kiếm`. Đã xác nhận hai ca này có sẵn trước thay đổi. Chưa chạy đối chiếu từng ca còn lại; không kết luận toàn bộ lỗi unit là lỗi cũ. JSON baseline local ở `test-results/ui-contrast/baseline-defect-one.json` và `baseline-mvp-one.json`.

Các ca thất bại đã quan sát trong lượt rộng:

- `keeps query filters, paging, apply and reset connected to the API hook`
- `refreshes the list from the visible refresh action`
- `clears the keyword independently and restores all statuses from the menu`
- `announces initial loading with skeleton rows and disables actions`
- `distinguishes an empty catalog from an empty filtered result and resets it`
- `retains rows and reports a background refresh while preventing edits`
- `verifies an uncertain create using a fresh unfiltered target query rather than the previous list`
- `settles pending verification after filters change when the read ends with success`
- `settles pending verification after filters change when the read ends with failure`
- `retries a known failed save through the same validated form payload`

## Giới hạn kiểm chứng

Không đăng nhập hay kiểm chứng trên website đã triển khai; không xác nhận mọi màn cũ hoặc mọi trạng thái nghiệp vụ đều đạt. Đích bàn giao là `dev` theo yêu cầu; push không tự chứng minh deployment đã cập nhật.
