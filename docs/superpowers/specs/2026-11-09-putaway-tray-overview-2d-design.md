# Tổng quan tình trạng khay — mặt bằng kho 2D

Ngày: 09/11/2026. Màn: `PUTAWAY_TRAYS` (`/putaway/trays`), component
`src/modules/putaway/pages/TrayOverviewPage.tsx`.

## Ý định và lý do

Màn hiện tại là bốn card KPI + mỗi khu vực một nhóm card pastel viền trái. Cách
trình bày này giống dashboard mẫu, không gợi được cảm giác đang nhìn một khu
kho thật. Người dùng yêu cầu thiết kế lại phần "Tổng quan tình trạng khay" để
khu vực và khay trông chuyên nghiệp như một kho hàng mô phỏng, hơi hướng 2D.

## Mục tiêu

- Dựng lại toàn bộ vùng nội dung thành **một mặt bằng kho 2D nhìn từ trên**:
  khu vực (zone) là các khối sàn, khay là các footprint phẳng xếp trong khối.
- Bỏ 4 card KPI rời; thay bằng một dải số liệu gọn, vẫn bấm được để lọc.
- Giữ nguyên dữ liệu, tìm kiếm, lọc trạng thái, `data-testid="ptw-tray-overview"`
  và `data-testid="ptw-tray-cell"`.
- Đạt chuẩn token/theme hiện hành: `--ops-*` qua `SEMANTIC_LIGHT`, light/dark,
  responsive 1440 / 1024 / 768 / 390 / 320, bàn phím và `aria-pressed`.
- Không hiển thị số `0` giả khi danh sách khay còn tải.

## Không nằm trong phạm vi

- Không đổi API/BE, không thêm trường dữ liệu.
- Không tạo toạ độ kệ/ô vật lý hay tuyên bố đây là sơ đồ kho chính thức.
- Không thêm thao tác xếp khay, sửa/xoá khay hoặc drawer chi tiết.
- Không đổi `TraySelectionGrid` trong luồng tạo lệnh xếp khay.

## Ràng buộc dữ liệu

`TrayOption` chỉ trả `container_code`, `status`, `zone_code`, `location_hint`.
Vì vậy bố cục là cách trình bày theo nhóm khu vực thật, không phải bản đồ toạ
độ. Cuối khung có ghi chú nhỏ: bố cục theo khu vực, không phải sơ đồ vị trí.

## Phương án

1. **Mặt bằng kho 2D nhìn từ trên** (chọn): một khung mặt bằng nền lưới kỹ
   thuật, các zone là khối sàn, khay là footprint phẳng. Phù hợp mục tiêu quét
   tổng quan theo khu vực, không cần toạ độ.
2. **Kệ hàng nhìn chính diện**: mỗi zone là một kệ, khay là ô trên kệ. Giống
   rack nhưng trang này không có số tầng/ô thật; dễ sinh ô trống giả và khó
   quét toàn cảnh — loại.
3. **Dashboard công nghiệp**: giữ bố cục card hiện tại, chỉ đổi màu/đường kẻ.
   Ít rủi ro nhưng không đạt yêu cầu "kho hàng mô phỏng" — loại.

## Thiết kế

### Dải số liệu

- Một thanh surface duy nhất, chia 4 đoạn bằng đường kẻ dọc, viền `--ops-line`,
  radius card 8px.
- Mỗi đoạn là `button` gồm nhãn 12–13px và số tabular 24–26px; màu trạng thái
  chỉ nằm ở chấm nhỏ và số. Đoạn đang lọc có nền `--ops-pale`, viền dưới 2px
  theo màu trạng thái và `aria-pressed`.
- Khi query đang tải, số hiển thị `—`; khi lỗi, giữ số liệu cũ nếu có.

### Khung mặt bằng

- Surface trắng, viền 1px, radius 8px, các góc có dấu ngoặc kỹ thuật mảnh.
- Header: nhãn nhỏ "SƠ ĐỒ KHU VỰC KHAY", tổng số khay, chú giải 3 trạng thái.
- Toolbar ngay dưới header: ô tìm kiếm (320px, co giãn), nút "Xoá lọc" và
  dòng "Hiển thị x/y khay" chỉ hiện khi có từ khoá hoặc bộ lọc trạng thái.
- Thân khung nền `--ops-canvas` phủ lưới 24px bằng gradient từ `--ops-line` ở
  độ tương phản thấp; zone surface nằm trên lưới.
- Chân khung: ghi chú bố cục theo khu vực, không phải sơ đồ toạ độ.

### Khối khu vực

- Zone là `section` có heading; tiêu đề zone (uppercase, letter-spacing nhẹ) và
  số khay bên phải. Zone chưa gán dùng viền nét đứt và nhãn muted.
- Dưới tiêu đề là một thanh phân bố 3 trạng thái mảnh, tối đa 480px, có
  `role="img"` + nhãn phân bố để đọc nhanh tỷ lệ trống/đang chứa/cần chú ý.
- Các khay nằm trong `ul`/`li`, grid `auto-fill minmax(140px, 1fr)`, gap 10px.
- Zone xếp tối đa 2 cột từ breakpoint `md`; dưới `md` xếp 1 cột. Zone có tên
  đứng trước; "Chưa gán khu vực" xếp cuối và chiếm toàn bộ hàng.

### Footprint khay

- Hình chữ nhật phẳng tỉ lệ ngang, viền 1px, radius 4px, surface trắng.
- Một dải màu 3px ở cạnh trên theo trạng thái; bên trong có đường bao nét đứt
  mảnh tạo cảm giác footprint.
- Nội dung: mã khay 13–14px/600 `--ops-heading`, `location_hint` 11–12px
  muted; hàng cuối là chấm 7px + nhãn trạng thái 11px.
- Khay "Cần chú ý" có viền `--ops-warning`, dải màu và nhãn cảnh báo; giữ nền
  surface, không tô kín ô bằng pastel.
- Hover/focus: nhấc nhẹ 1px, viền đậm hơn, focus-visible có quỹ đạo 2px.

### Trạng thái màn hình

- Loading: `LoadingState` trong thân khung, giữ chiều cao tối thiểu.
- Lỗi: `ApiErrorAlert` trong thân khung, có thử lại.
- Rỗng / không khớp: `EmptyState` trong thân khung, phân biệt "Chưa có khay nào"
  với "Không có khay phù hợp".
- Không có kết quả theo bộ lọc thì nút "Xoá lọc" là bước tiếp theo.

## i18n

Thêm khoá vi/en/zh cho: nhãn sơ đồ, chú giải, nút xoá lọc, ghi chú bố cục,
số khay mỗi zone, số kết quả đang hiển thị, tiêu đề/mô tả khi chưa có khay.
Các khoá hiện có (`totalTrays`, `bucketAttention`, `zoneCount`,
`zoneUnassigned`, ...) được giữ nguyên.

## Kiểm chứng

- Unit test mới cho `TrayOverviewPage`: render zone/khay, đếm KPI, lọc theo
  trạng thái, tìm kiếm, xoá lọc, phân biệt kho chưa có khay với lọc không
  khớp, trạng thái đang tải không hiện số 0 giả.
- `npm run typecheck`, lint file liên quan, test file mới, `npm run build`,
  `git diff --check`. `npm run ui:tokens` bị chặn bởi file baseline
  `docs/ui/vuexy-sync/allowlists/hardcoded-hex-baseline.json` không có trong
  repo; trang không chứa mã hex tự khai.
- Kiểm tra trực quan bằng preview harness ở 1440 / 1024 / 390 / 320, dark mode,
  trạng thái lọc "Cần chú ý" và hover; ảnh lưu tại
  `test-results/tray-overview-preview/`. Không đăng nhập được vào dữ liệu thật
  nên chưa kiểm chứng trên API production.
