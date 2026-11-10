# Tray Overview Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native) or superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Dựng lại `/putaway/trays` (Tổng quan khay) theo mockup `Hoa_Nam_UIUX_V2/so-do-khu-vuc-khay.html` với dữ liệu thật từ `fetchAllPutawayTrays`, giữ trọn tương tác mẫu: SVG scene, filter/search, zoom, toàn màn hình, dải khay chưa gán, dialog chi tiết + copy mã.

**Architecture:** Tách đôi. (1) `WarehouseMap.tsx` — component SVG thuần (layout model + JSX), không state nghiệp vụ. (2) `TrayOverviewPage.tsx` — state lọc/tìm/zoom/chọn/fullscreen, render panel theo mockup, mở dialog chi tiết. CSS riêng module, thay toàn bộ `tray-overview.css`.

**Tech Stack:** React + TSX SVG, zustand/TanStack giữ nguyên, sonner (toast), Flaticon Uicons qua `shared/components/icons`, `UiDialog`, `SearchInput`, `UiSelect`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-tray-overview-so-do-khu-vuc-design.md` (approved 2026-11-10)

## Global Constraints

- Màu theo token Hoa Nam (`--ops-*`, `var(--ops-link)`, `--ops-warning-text`, `--ops-success-text`…), KHÔNG lấy `#195cfa`/Roboto/nền base64 của bản demo. Sàn = gradient CSS + lưới CSS. (spec — Verification)
- Chỉ sửa module putaway + i18n 3 locale; không đụng các màn khác, không backend. (spec — Non-goals)
- i18n vi/en/zh đủ bộ khoá mới; nhãn hiện có tái dùng `putaway.overview.*`. (AGENTS.md §10)
- Giữ nguyên hợp đồng hành vi hiện có của trang (loading không lộ số đếm, phân biệt empty vs no-match, lỗi + thử lại, cached zones khi refetch lỗi) — chỉ cập nhật selector khi cấu trúc DOM đổi. (test file hiện hành)
- Chạy `npm run typecheck`, eslint phạm vi, `git diff --check`; báo đúng những gì đã kiểm tra. (DESIGN_FOUNDATIONS §10)
- Commit chỉ file trong phạm vi; không add file user đang sửa dở (warranty/*, reversal-list.css, UiSelect.tsx).

## Review Focus

1. Khay có `zone_code` nằm trong rack; khay `zone_code` rỗng → dải "Chưa gán khu vực", không tính vào zone. → Task 2, Step 4.
2. Filter/tìm KHÔNG xóa khay khỏi scene — dim + `aria-disabled` + chặn tương tác; "Hiển thị x/y" đúng; đếm bucket đúng cả khi đang tải (hiện "—"). → Task 2.
3. Zone có >5 khay phải sinh rack thứ hai cùng tên (ngăn > 5 không được rơi mất cây trạng thái). → Task 1.
4. Dialog: bấm khay hoặc khay chưa gán đều mở; copy mã gọi clipboard đúng mã hiển thị; dòng "Tìm trên sơ đồ" ẩn với khay chưa gán; Escape/đóng trả focus. → Task 3.
5. Loading/error/empty không lộ số; sau khi load lỗi mà có cache vẫn hiển thị dữ liệu + banner thử lại. → Task 3 tests (giữ ca cũ).

---

### Task 1: `WarehouseMap` — SVG scene builder + component

**Files:**
- Create: `src/modules/putaway/components/WarehouseMap.tsx`
- Create: `src/modules/putaway/components/warehouse-map.ts` (layout model thuần: racks, slots, viewBox)
- Create: `src/modules/putaway/pages/warehouse-map.css`
- Test: `src/modules/putaway/components/WarehouseMap.test.tsx`

**Interfaces:**
- Consumes: `TrayOption` (`container_id`, `container_code`, `status`, `zone_code`, `location_hint`) từ `putawayService`.
- Produces:
  - `buildWarehouseLayout(trays: readonly TrayOption[]): WarehouseLayout` — nhóm theo `zone_code` (bỏ rỗng/sorted `vi, numeric`), 5 ngăn/rack, rack thứ hai khi >5; viewBox `0 0 1440 H`.
  - `type WarehouseLayout = { racks: WarehouseRack[]; unassigned: TrayOption[]; viewBox: string; aspect: number }`
  - `WarehouseRack = { zone: string; label: string; y: number; slots: WarehouseSlot[] }`, `WarehouseSlot = { index: number; tray: TrayOption | null }`
  - `<WarehouseMap trays layout filteredIds onSelect selectedId dimmedIds />` — render SVG tĩnh (không state), khay = `<g role="button" tabIndex={0} data-testid="ptw-tray-cell" data-bucket={...}>`.

- [ ] **Step 1: Write failing test** (`WarehouseMap.test.tsx`): render với 3 khay 2 khu + 1 khay chưa gán → `getAllByTestId("ptw-tray-cell")` = 3; khay A xuất thành label "ZONE-A" (text), khay chưa gán KHÔNG có data-testid trong SVG (nằm ở dải riêng — page lo); với zone có 7 khay → sinh 2 rack (2 text "ZONE-X"), 10 slots; placeholder slot có `aria-label` "Vị trí 03, Chưa gán khay".
- [ ] **Step 2: Run test — FAIL** (`npx vitest run src/modules/putaway/components/WarehouseMap.test.tsx`)
- [ ] **Step 3: Implement `warehouse-map.ts`** (pure): hằng `TRAY_PITCH=242`, `BAYS=5`, `RACK_WIDTH = 5*TRAY_PITCH+18`, `rackX` canh giữa viewBox 1440; mỗi rack chiếm 325px dọc + 56px lối đi; rack thứ hai của cùng zone nối tiếp; cao tổng → `viewBox`.
- [ ] **Step 4: Implement `WarehouseMap.tsx`**: gradient defs (steel/upright/joint/foot/sign-plate/label-plate/rim/basin/handle-inset theo bản mockup, màu đã chuyển sang hệ #004E74/neutral/amber/xanh), `RackBank` (posts, joint plates, rails, sign plate "ZONE-X", fasteners), `Tray` (giá sườn, label plate, status symbol: attention=▲ hổ, occupied=● xanh, empty=viền xanh, theo bucket: EMPTY→empty/verde viền, PARTIAL→occupied/blue, còn lại→attention/amber), `Aisle` (2 đường nét đứt vàng `#dbb45c` + chữ LỐI ĐI). Khay không khớp filter → `opacity .16` + `aria-disabled` + `tabIndex=-1` + `pointer-events:none`. `dimmedIds` = set id không khớp; `selectedId` → stroke `--ops-link`.
- [ ] **Step 5: Run test — PASS**, then Step 6: commit `feat(putaway): render the illustrative warehouse SVG scene`.

---

### Task 2: Rebuild page shell — header, toolbar, chips, topline, footer (no map yet)

**Files:**
- Modify: `src/modules/putaway/pages/TrayOverviewPage.tsx` (phần JSX panel + state lọc/tìm/zoom/fullscreen; map để trống tạm)
- Modify: `src/modules/putaway/pages/tray-overview.css` (ghi đè toàn bộ — rename thành `putaway-overview.css`? **Giữ nguyên tên file** để diff sạch)
- Modify: `src/shared/i18n/messages.ts`, `messages.en.ts`, `messages.zh.ts` (thêm keys: `putaway.overview.toplineMap`, `toplineHint`, `footDisclaimer`, `footUnassignedNote`, `trayDialogTitle`, `copyCode`, `codeCopied`, `locateOnMap`, `fullscreen`, `exitFullscreen`, `slotUnassigned`, `showingCount` đã có, `zoomIn`, `zoomOut`, `zoomFit`)
- Test: sửa `TrayOverviewPage.test.tsx`

- [ ] **Step 1: Write failing test** cho các nhãn/chips/hiển thị số trên trang mới: render → thấy h2 "Sơ đồ khu vực khay", chips "Tất cả" kèm số, "Hiển thị …", hai dòng topline.
- [ ] **Step 2: Run — FAIL** (DOM cũ khác cấu trúc).
- [ ] **Step 3: Rewrite JSX**: giữ shell (`ptw-tray-overview`, back button, routes); panel MỘT khối: header (icon `AppsOutlined`-một grid 2×2 như mẫu, h2 mapTitle, subtitle `subtitle` khi có data "—" khi chưa, nút fullscreen `ExpandAltOutlined`), toolbar 2 hàng (SearchInput full-width-max 480px + UiSelect zone + `ActionButton kind="clear"` reset + spacer), hàng chips (`role=group`, `aria-pressed`, chấm màu) + `Hiển thị x/y khay` bên phải, topline strip, `<div className="map-viewport">` **tạm đặt SVG placeholder** (Task 3 lấp), nút zoom (MinusOutlined/PlusOutlined/ExpandAltOutlined + `%`), dải unassigned (nút từng khay — mini SVG + mã + hint + badge + `ChevronRight`), footer hints.
- [ ] **Step 4: Reset/clear hành vi** giống hiện hành (`clearFilters`), `showingCount` chỉ hiện khi `countsReady`.
- [ ] **Step 5: Run tests hiện có — cập nhật selector** (`getByTestId("ptw-tray-cell")` count, chips) đến khi pass; **không nới assertion nào thay vì sửa DOM/test**.
- [ ] **Step 6: Commit** `feat(putaway): rebuild the tray overview page around the map panel`.

---

### Task 3: Map + zoom + dialog + shortcuts + fullscreen + unassigned + tests

**Files:**
- Modify: `TrayOverviewPage.tsx` (ráp `<WarehouseMap>`, zoom state `[0.25..2, step .2]`, `fit`, viewport `overflow:auto`, `maxHeight: min(baseWidth*aspect, 720px)`, `ResizeObserver` hoặc `clientWidth` đo)
- Create: `TrayDetailDialog.tsx` (UiDialog width 392: preview SVG minh họa theo bucket, `container_code` `user-select:text`, badge status, `Khu vực` / `Vị trí / mô tả`, actions [Sao chép mã `CopyOutlined` → `navigator.clipboard` + `toast.success(codeCopied)`] [Tìm trên sơ đồ `EnvironmentOutlined` — ẩn nếu `zone_code` rỗng])
- Modify: `test` — ca mới: dialog mở từ khay SVG, từ dải unassigned; copy gọi clipboard đúng mã; `Tìm trên sơ đồ` ẩn cho khay chưa gán; zoom in/out đổi `%`; focus trả về nút mở sau Escape (UiDialog mặc định).
- Modify: `index.css` **KHÔNG** — mọi style trong `tray-overview.css` (+ dark mode qua biến `--ops-*` sẵn).

- [ ] **Step 1: Write failing tests** (dialog open/click copy/locate/unassigned) — FAIL.
- [ ] **Step 2: Implement dialog + zoom + fullscreen + `/` & `Escape` handlers + toast**. Fullscreen: `panelRef.requestFullscreen()` + `fullscreenchange` → toast fallback "Trình duyệt này chưa hỗ trợ toàn màn hình" (key `putaway.overview.fullscreenFailed`/`fullscreenFallback`).
- [ ] **Step 3: Run full module tests** — PASS (gồm ca cũ đã cập nhật ở Task 2).
- [ ] **Step 4: Visual check** trên dev nếu đăng nhập được; nếu không — nêu giới hạn.
- [ ] **Step 5: Commit** `feat(putaway): wire the warehouse scene, tray dialog, zoom and fullscreen`.

---

### Task 4: Verification & gates

- [ ] `npx vitest run src/modules/putaway` (toàn bộ module), `npm run typecheck`, `npx eslint …page/css/map`, `git diff --check`.
- [ ] Soát contrast chính (chips, tray labels trên sàn sáng, topline) bằng mắt + `npm run test:ui-contrast` nếu chạm theme; ghi rõ bài không kiểm được.
- [ ] Báo cáo: màn đã kiểm, giới hạn, test đếm.
