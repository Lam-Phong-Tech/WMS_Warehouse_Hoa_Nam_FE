# NFC trên Web Admin

Menu **NFC** mở `/nfc`, dùng shell và component hiện hành. Giao diện tham khảo:
`Hoa_Nam_UIUX_V2/nfc`, màn 01, 09 và 10. Các màn ghi/đọc chip vật lý không áp dụng cho web.

## API đọc

Đối chiếu OpenAPI trực tiếp ngày 31/10/2026 tại
<https://khohoanamdev.lptech.info.vn/docs?api-docs.json>.
NFC hiện thuộc **22. Mini App**; **21. Public Catalog** là danh mục công khai.
Các đường dẫn dưới đây tương đối với API base URL `/api/v1` của ứng dụng.

| Chức năng       | API                                  | Quyền vào vùng dữ liệu                                                      |
| --------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Hiện vật        | `GET /mini-app/items`                | `physical_code.assign_rfid` hoặc `item_instance.view` hoặc `inventory.view` |
| Chip đã đăng ký | `GET /mini-app/nfc-tags`             | `physical_code.assign_rfid` hoặc `inventory.trace`                          |
| Chi tiết chip   | `GET /mini-app/nfc-tags/{id}`        | Như danh sách chip                                                          |
| Lịch sử chip    | `GET /mini-app/nfc-tags/{id}/events` | Như danh sách chip                                                          |

Tìm hiện vật gửi `keyword`; tìm chip gửi UID đầy đủ qua `hardware_uid`.
Danh sách và lịch sử phân trang bằng `page`/`per_page`, giữ `meta.total` từ backend.
KPI ưu tiên `meta.tab_totals`, khi thiếu chỉ đếm trang hiện tại và ghi rõ phạm vi.
Chip ngoài phạm vi truy cập không mở được từ danh sách hiện vật.
Query NFC tách theo ngữ cảnh đăng nhập, thuộc nhóm `volatile`, không lưu xuống đĩa.

## Thao tác qua app

Gán, quét, thay và thu hồi chip chỉ mở thông báo **“Vui lòng thao tác qua app”**.
Web không gọi prepare, confirm, release hoặc deactivate, không giữ chỗ và không thay đổi tồn.
Chú thích chỉ hiện khi hover, focus hoặc bấm icon ⓘ.

## Kiểm thử

- `npm run typecheck`
- `npm run test:ci` (bao gồm kiểm thử NFC)
- `npx vitest run src/app/layouts/nav-data.test.ts src/app/router/access.test.ts src/app/router/route-preload.test.ts src/shared/cache/cache-policy.test.ts`
- `npx playwright test --config playwright.nfc.config.ts`
- `npm run build`

Browser fixture dùng dữ liệu giả lập với trang/component production; không đăng nhập hay ghi dữ liệu backend.
Browser test kiểm tra 1440, 1024, 768 và 390px, sáng/tối, tooltip, thông báo app và chi tiết/lịch sử.
Ảnh kiểm tra sinh trong `test-results/nfc/`.
