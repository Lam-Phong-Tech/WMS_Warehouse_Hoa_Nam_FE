# 08 — Root Cause Analysis

Ngày: 2026-08-27 · SHA: `a908c420663270d783a34fd378689f7940377c85`
Mỗi root cause theo template bắt buộc của Prompt 1. Symptom là hiện tượng người dùng/dev thấy; root cause truy tới provider/token/component/CSS/import boundary.

---

```text
Root Cause ID: RC-01 — Ba baseline thiết kế cùng hiệu lực, không có Decision Record
Symptom: Cùng một app có primary #2563eb (hầu hết), #356fa3 (heading/PlaceholderPage), fallback #6c5ce7 (chết);
  3 font stack; 10 giá trị radius; sidebar tối kiểu BA-wireframe trong khi định hướng nói "Vuexy".
Exact files/imports/selectors:
  - src/app/theme.ts:5-8 tự tuyên bố nguồn = "HN_WMS_Wireframe_MVP.html supplied by BA" (hệ cool #2563eb/Arial),
    khớp đúng :root của docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html:8-11.
  - src/shared/design-tokens.ts:5-6 tự tuyên bố nguồn = "Wireframe P0/Design System - Module 1.md" — TÀI LIỆU KHÔNG TỒN TẠI
    trong repo (hệ warm #356fa3/Be Vietnam Pro), đi cùng src/styles/hoa-nam-wireframe.css (30 vars --hn-*).
  - Commit 5df4f210 (27/08/2026) "chuyển toàn bộ giao diện FE sang MUI (Vuexy)" — 193 files, +22.004 dòng —
    nhưng KHÔNG đổi token (muiTheme map từ BRAND cool) và KHÔNG có Decision Record nào trong docs/decision-records/.
  - docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md vẫn ghi "UI: Ant Design 6.x" + tham chiếu 4 doc design không tồn tại.
Why it happens: Mỗi đợt làm UI (P0 warm → MVP cool → MUI/Vuexy) thêm nguồn token mới mà không retire nguồn cũ
  và không có authority chốt baseline; "Vuexy" mới chỉ đổi ENGINE (antd→MUI) chứ chưa đổi TOKEN.
Affected components/screens: 100% màn hình.
Regression risk: Mọi chỉnh sửa màu/khoảng cách có thể trúng nguồn không còn hiệu lực; nghiệm thu UI không có chuẩn để so.
Required architectural fix: Decision (BC-01/BC-02/BC-03 trong 02-baseline-source-matrix.md) → 1 token source duy nhất;
  retire hệ warm (BC-04) và cập nhật Techstack guide.
Evidence: 02-baseline-source-matrix.md; 03-token-source-matrix.md §1-3.
```

```text
Root Cause ID: RC-02 — Migration engine nửa chừng: antd và MUI cùng chạy trong từng flow
Symptom: Cùng một flow (vd Inventory) bảng list là MUI table, modal chi tiết là antd Table; modal MUI Grow 280ms
  cạnh modal antd; 2 kiểu focus/validation; bundle chứa 2 UI framework đầy đủ.
Exact files/imports/selectors:
  - 93 file import antd, 59 file import @mui/material, 29 file import CẢ HAI (danh sách: 06-library-import-graph.md §2).
  - Commit 5df4f210 chủ đích "Giữ nguyên antd Table cho các bảng dữ liệu phức tạp và giữ nguyên các thành phần dùng chung
    (DataTable, CameraScanModal, ScanInput...)" (nguyên văn commit message).
  - src/modules/master-data/pages/ApiMasterScreens.tsx dùng đồng thời MUI Dialog + antd Modal + antd Modal.confirm.
  - Tầng shared/forms (antd+RHF) chỉ còn 3 trang auth dùng; 25 file dùng MUI TextField trực tiếp.
Why it happens: Chiến lược migration "đổi tại chỗ từng màn" không có tầng wrapper trung gian bắt buộc, nên điểm dừng
  của mỗi màn = mức trộn của màn đó; các phần khó (Table, DatePicker, Scan) bị giữ lại antd vô thời hạn.
Affected components/screens: 26/29 file mixed là trang/modal nghiệp vụ chính (inbound, outbound, warranty, reverse,
  inventory, master-data, reports).
Regression risk: Hành vi khác nhau giữa 2 engine trong cùng flow (đóng modal, keyboard nav, validation timing) =
  rủi ro nghiệp vụ khi thao tác nhanh bằng scanner; bundle nặng gấp đôi phần UI.
Required architectural fix: Chốt engine đích (MUI — đã 80% trang theo hướng này) + wrapper layer bắt buộc cho
  Modal/Table/Form/Tag/Pagination (pattern đã thành công với icons/toast/actions) + lộ trình gỡ antd theo độ khó
  (04-component-inventory.md §4.2).
Evidence: 06-library-import-graph.md; 04-component-inventory.md §2.
```

```text
Root Cause ID: RC-03 — Kiến trúc CSS "giải quyết xung đột bằng vị trí import + !important"
Symptom: Sửa một file CSS bất kỳ có thể vỡ chỗ khác không liên quan; hn-responsive phải "khôi phục" rule đã bị lớp
  giữa "đè chết"; 177 !important; responsive tại 768px chạy đồng thời nhánh mobile và desktop.
Exact files/imports/selectors:
  - src/main.tsx:8-21 import 8 lớp CSS theo thứ tự sống còn, comment tự thú tại main.tsx:14-15, 18-20.
  - Chuỗi 3 đời: hoa-nam-wireframe (≤576px rules) bị hn-wms-mvp-exact (!important) giết, hn-responsive.css:474-475 hồi sinh.
  - hn-wms-page-normalize.css:7-10,24 match attribute-substring div[style*="padding: 24px"] (4 biến thể) đè !important
    lên inline style React; hn-wms-sidebar-account.css:2-13 tương tự với span[style]/div[style].
  - 502 selector .ant-* trong CSS tĩnh vs antd cssinjs + MUI emotion inject runtime — hn-motion.css:296-303 thừa nhận
    "ai thắng tùy lúc".
  - Cặp breakpoint lệch 767/768 và 575/576; hn-wms-page-normalize dùng min-width:981 vs max-width:980.
Why it happens: Mỗi thế hệ style mới được THÊM thành lớp sau cùng để "thắng" lớp trước thay vì sửa/xoá lớp trước
  (vì sợ vỡ những gì lớp trước đang giữ); dần dần thứ tự import trở thành hợp đồng ngầm không kiểm chứng được.
Affected components/screens: Toàn app; nặng nhất shell (.hn-mvp-*), modal/drawer (CSS-07), bảng.
Regression risk: CAO NHẤT REPO — bất kỳ ai đổi thứ tự import, gỡ inline style, hoặc nâng antd/MUI (đổi timing inject)
  đều có thể đổi giao diện im lặng.
Required architectural fix: Nguyên tắc mới: token qua theme API (ConfigProvider/createTheme), CSS tĩnh chỉ còn
  1 foundation layer + không override component internals; xoá dần 5 lớp wireframe/exact/normalize theo lộ trình
  09-remediation §Phase C; cấm selector attribute-substring.
Evidence: 07-css-conflict-register.md CSS-02..CSS-12 + §2 (7 comment tự thú).
```

```text
Root Cause ID: RC-04 — Token đúng nghĩa không có "một nguồn": 11 nguồn, 3 hệ, mirror tay
Symptom: Đổi màu primary phải sửa ≥6 chỗ (theme.ts, mvp-exact.css, actionIconColors.ts, chart-theme.ts, hex rải rác,
  docs); 450 hex literals / 110 giá trị; height control 35 vs 36 lệch 1px nhân bản 10 file.
Exact files/imports/selectors: T1-T11 liệt kê tại 03-token-source-matrix.md §1; đặc biệt:
  - src/shared/theme/actionIconColors.ts import BRAND rồi vẫn hard-code lại chính các giá trị BRAND.
  - Block sx `height: 35` copy-paste 10 file (03 §3.5) vs mui-theme.ts:78 height 36 vs theme.ts:62 controlHeight 36.
  - motion là ngoại lệ TỐT: motion-tokens.ts ↔ hn-motion.css ↔ theme.ts ↔ mui-theme.ts đồng bộ cùng bộ số
    (mẫu "một bộ số, nhiều adapter" — nhưng vẫn là 2 nguồn sao chép tay).
Why it happens: Không có tầng token vật lý chung (CSS vars + TS export sinh từ 1 chỗ); mỗi consumer (antd theme,
  MUI theme, CSS, chart, TSX) tự chép giá trị tại thời điểm viết.
Affected components/screens: 100%.
Regression risk: Retheme Vuexy mà sửa thiếu 1 nguồn sẽ tạo giao diện loang lổ khó phát hiện bằng test logic.
Required architectural fix: 1 module token duy nhất (09-remediation §Phase B): src/shared/design-system/tokens.css
  (:root --wms-*) + tokens.ts (mirror cùng file sinh) → theme.ts/mui-theme.ts/chart-theme.ts/actionIconColors.ts
  chỉ được đọc từ đó; ESLint rule cấm hex literal ngoài tokens.
Evidence: 03-token-source-matrix.md; 07-css CSS-01, CSS-15.
```

```text
Root Cause ID: RC-05 — Provider lồng đúng nhưng bị nhân bản 37 lần
Symptom: 36 file re-wrap <ThemeProvider theme={muiTheme}> quanh subtree dù AppProviders đã cung cấp toàn cục
  (một số file wrap 2-3 lần); thêm context re-render và che khuất việc theme root là nguồn duy nhất.
Exact files/imports/selectors: AppProviders.tsx:35 (root duy nhất cần thiết); 36 file re-wrap liệt kê đầy đủ tại
  06-library-import-graph.md §3 (2 chỗ có lý do chính đáng: ActionDropdown.tsx:74-76 — portal; MvpListPagination.tsx:38-39).
Why it happens: Các màn MUI-hoá ở commit 5df4f21/a908c42 được viết như đảo độc lập ("island") khi root provider
  chưa chắc tồn tại, rồi root được thêm vào AppProviders nhưng các đảo không được dọn.
Affected components/screens: 34 file re-wrap thừa.
Regression risk: Thấp về hành vi (cùng theme object) nhưng là nợ dọn dẹp bắt buộc trước khi đổi token
  (nếu sau này ai truyền theme khác nhau sẽ phân mảnh thật).
Required architectural fix: Xoá 34 re-wrap thừa (codemod đơn giản), giữ root + 2 ngoại lệ portal có comment.
Evidence: 06-library-import-graph.md §3.
```

```text
Root Cause ID: RC-06 — Tầng shared bị bypass và chết một nửa; quy ước tài liệu mâu thuẫn
Symptom: 41 shared exports 0 consumer (nguyên layout/, cards/, gần hết forms/, nửa feedback/); modules dùng
  MUI TextField/Dialog trực tiếp; 2 README shared mâu thuẫn (root README chuẩn antd vocabulary vs actions/README chuẩn MUI).
Exact files/imports/selectors: Danh sách 41 symbol tại 04-component-inventory.md §3; shared/components/README.md
  (antd conventions) vs shared/components/actions/README.md (MUI + allowlist + action-standard.test.ts).
Why it happens: Tầng shared được thiết kế cho kiến trúc antd; khi migration đổi engine từng trang, trang mới bỏ qua
  wrapper antd thay vì nâng cấp wrapper — shared trở thành di tích trong khi convention mới chỉ được enforce
  ở action layer.
Affected components/screens: Dev experience toàn dự án; mọi PR mới không biết theo chuẩn nào.
Regression risk: Trung bình — mỗi trang mới lại tự chọn kiểu, tăng entropy.
Required architectural fix: Viết lại tầng shared theo engine đích (Modal/Table/Form wrappers MUI + token mới),
  xoá 41 exports chết, hợp nhất 2 README thành 1 convention + test enforce (nhân bản mẫu action-standard.test.ts).
Evidence: 04-component-inventory.md §1, §3; Agent A §3-4 (06-library-import-graph.md).
```

```text
Root Cause ID: RC-07 — Shell tự viết + cơ chế ?screen= vô hiệu hoá route guard (SEC-RBAC-01)
Symptom: (a) Shell (MainLayout/SideNav) là màn lệch Vuexy nặng nhất (sidebar tối #0f172a, CSS .hn-mvp-* 3 lớp);
  (b) /dashboard?screen=IAM-01 mount được màn IAM ngoài RequirePermission; (c) breadcrumb và sidebar lệch nhau.
Exact files/imports/selectors:
  - src/app/layouts/MainLayout.tsx:286-363 renderMvpScreen() render 11 page theo query ?screen= THAY CHO <Outlet/>,
    nằm ngoài RequirePermission của route đích (danh sách page tại 05-screen-role-inventory.md §3).
  - SideNav.tsx điều hướng dạng `${path}?screen=${screenId}` — toàn bộ nav phụ thuộc cơ chế này.
  - 2 nguồn nav: SideNav.NAV_GROUPS (render) vs app/layouts/menu.tsx MENU (breadcrumb/test) — lệch /scan, /pv-admin,
    /notifications (05 §3 NAV-01).
  - Shell chết song song: AppHeader/AppFooter/PartnerLayout/layout.styles.ts (z-index 100/99) + middleware.ts
    (redirect /403 không tồn tại).
Why it happens: Shell MVP được dựng để render "screen" theo wireframe HTML (query param) trước khi router/RBAC
  hoàn chỉnh; router thật được thêm sau nhưng cơ chế cũ không bị gỡ, thành cửa hậu UX-gate.
Affected components/screens: Mọi màn trong MainLayout; RBAC UX-gate của 11 màn nghiệp vụ.
Regression risk: P0 — (bảo mật UX-gate + sai lệch cam kết SRS về hiển thị no-permission; BE vẫn là boundary cuối
  nên không phải lỗ hổng dữ liệu trực tiếp).
Required architectural fix: Gỡ renderMvpScreen, điều hướng thuần route (đưa các "screen" thành route con thật có
  RequirePermission); hợp nhất NAV_GROUPS + MENU thành 1 nguồn nav data; xoá shell chết; việc này là ĐIỀU KIỆN
  TIÊN QUYẾT của layout Vuexy mới (không retheme shell cũ).
Evidence: 05-screen-role-inventory.md §3 (SEC-RBAC-01, NAV-01, NAV-02, DEAD-01).
```

---

## Tổng hợp mức ưu tiên

| ID | P | Chặn Prompt 2? |
|---|---|---|
| RC-01 (baseline authority) | **P0** | CÓ — cần Decision BC-01/02/03 trước khi đổi token |
| RC-07 (SEC-RBAC-01 + shell) | **P0** | Một phần — sửa trong phase shell |
| RC-02 (dual engine) | P1 | Không (là nội dung của Prompt 3-4) |
| RC-03 (CSS cascade) | P1 | Không (Phase C) |
| RC-04 (token sources) | P1 | Không (Phase B) |
| RC-05 (37 ThemeProvider) | P1 | Không (dọn đầu Phase B) |
| RC-06 (shared chết/mâu thuẫn) | P1 | Không (Phase D) |

Không có nhận định "CSS chưa đồng bộ" chung chung nào — mọi RC đều trỏ file/dòng/selector cụ thể ở trên.
