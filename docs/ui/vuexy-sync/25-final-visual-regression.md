# 25 — Final Visual Regression (Part 5)

> Kết luận thị giác cuối chương trình tại exact checkpoint Part 5. Chi tiết per-screen: doc 19 (matrix) + 21 (visual report Part 4); doc này chốt trạng thái sau cleanup Part 5 và lượt E2E toàn bộ cuối.

## 1. Golden baseline

- 2 golden Foundation Catalog (desktop 1280 full-page ~14 section, mobile 375) — **PASS nguyên trạng** ở lượt chốt Part 5 (không regenerate trong Part 5; các thay đổi Part 5 — hooks WWHN-268, toast demo — đã pass golden từ lượt Part 4 cuối vì không đổi pixel trong khung chụp).
- Threshold `maxDiffPixelRatio: 0.02` giữ nguyên; giao thức update-có-disposition tại doc 29 §4.3; negative-proof threshold: sự kiện fail 0.04 thật trong Part 4 (doc 22).

## 2. Computed-style contract (chống drift không-pixel)

`ui:visual` còn khoá computed styles ĐỘC LẬP với golden: palette/radius/height control (Part 2), component mới Part 3 (badge tone/tab indicator/pagination…), dialog radius/motion, focus-ring token trên sidebar. Token đổi sai → đỏ cả khi golden chưa kịp bắt.

## 3. Migrate/cleanup Part 5 không tạo diff thị giác ngoài dự kiến

- PvAdminPage (3 bảng DataTable antd → ResponsiveDataTable): dáng bảng đồng nhất với phần còn lại của app (cùng RDT); pv unit 24/24 giữ nguyên; E2E pv (wwhn-253) + 292 pass lượt chốt.
- Xoá `@ant-design/icons`/deps chết: không đổi render (icon vốn đã qua shim Flaticon).
- Kết quả lượt E2E toàn bộ cuối (mọi project, --retries=1): **xem 27 §1 — bảng tổng hợp lượt chốt**; golden + catalog sweep + computed-style đều PASS.

## 4. Kết luận

Visual regression **PASS trong approved threshold**: 0 diff chưa giải thích; mọi khác biệt có chủ đích đã ghi disposition (doc 19 Tồn dư, doc 22 §4). Bộ guard `ui:visual` + giao thức baseline bảo đảm trạng thái này không trôi im lặng.
