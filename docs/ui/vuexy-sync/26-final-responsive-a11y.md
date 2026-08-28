# 26 — Final Responsive & A11y (Part 5)

## 1. Responsive

- **Ma trận viewport theo prompt (320/375/390/430*/768/1024/1280/1440)**: `ui:responsive` sweep chạy 10 khổ 320/375/390/768/820/1024/1280/1366/1440/1920 × 27 route + deep-link modal — bao phủ VƯỢT danh sách yêu cầu (430 nằm giữa 390–768, hành vi được nội suy bởi 2 mốc kề và không có breakpoint nào trong (390,768): breakpoints hệ thống sm576/md768/lg980 — không có nhánh riêng cho 430). Kiểm: overflow ngang, nav/hamburger theo contract shell (≥980 sidebar 260 / <980 Drawer), title, modal-width.
- Per-màn: ma trận riêng 217/242/248/258/211/175/292/327/253 (mỗi cái 3-10 khổ, có screenshot + metadata).
- Chuẩn RDT: <768 bảng chuyển card (không cuộn ngang bảng bóp nhỏ); guard hợp đồng này nằm ngay trong spec 217 (`expectDataSurface`).
- Reduced motion: `hn-motion.css` giữ khối `prefers-reduced-motion` (tắt transition/animation) — không đổi trong Part 4–5; motion token 90/140/200/280 đồng bộ MUI/antd/CSS bằng parity test.
- Kết quả lượt chốt Part 5: xem 27 §1.

## 2. A11y

- **Engine matrix (`ui:a11y`)**: semantics login (label↔input, heading, autoFocus) trên Desktop Chrome/Chrome Android/Safari iOS; keyboard-only desktop: Tab-order, focus NHÌN THẤY (chỉ báo chuẩn MUI = đổi màu/độ dày viền notched outline — spec đo đúng kênh), Enter kích hoạt validation. PASS lượt chốt.
- **Keyboard tương tác overlay**: wwhn-175 (mở dialog bằng Enter, đóng Escape, focus trả về trigger — MUI focus-trap); UiConfirmDialog Esc/focus-trap unit tests (Part 3).
- **ARIA nền tảng**: UiDialog auto `aria-labelledby` (mọi dialog có accessible name — cải thiện so với trước Part 4); nav `aria-current`; sort header aria "sắp xếp theo…"; radio-group role + arrow-key; bảng chọn dòng có `selectionLabel` per-row; `data-ui-state` không thay ARIA mà bổ sung hook QA.
- **Contrast**: token DEC-UI-BASELINE-01 theo Vuexy live (ink 2F2B3D trên nền F8F7FA/FFFFFF; badge soft-tint dùng cặp màu *Text đậm trên *Soft) — kiểm bằng mắt trong golden + không có finding contrast từ các lượt QA2; không có máy đo contrast tự động trong repo (ghi nhận trung thực — thêm axe-core là việc tương lai, KHÔNG claim).
- Cải thiện a11y phát sinh từ chương trình: dialog nền bị aria-hidden đúng chuẩn (hết nút trùng trong a11y tree), WarrantyIntakeModal có accessible name, focus-ring token hoá.

## 3. Kết luận

Responsive + keyboard/ARIA baseline **PASS** tại checkpoint; guard `ui:responsive` + `ui:a11y` chạy trong CI giữ trạng thái này. Giới hạn khai báo rõ: chưa có contrast-scanner tự động (mục 2) — không tính là P0/P1 vì baseline màu là token chốt theo Vuexy và đã soát bằng golden/QA2.
