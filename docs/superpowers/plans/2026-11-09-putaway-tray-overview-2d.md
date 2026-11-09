# Tổng quan tình trạng khay — mặt bằng kho 2D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay bố cục card dashboard của `/putaway/trays` bằng một mặt bằng kho 2D: dải KPI gọn, khung sơ đồ khu vực, zone là khối sàn và khay là footprint phẳng.

**Architecture:** Giữ nguyên `useQuery`, logic gom nhóm/lọc trong `TrayOverviewPage`, chỉ thay lớp trình bày và bổ sung vài khoá i18n. Toàn bộ màu lấy từ `SEMANTIC_LIGHT` (`--ops-*`), không thêm thư viện hay API.

**Tech Stack:** React 19, TypeScript, MUI `Box`/`Stack`, React Query, Vitest + React Testing Library, i18n vi/en/zh.

**Spec:** `docs/superpowers/specs/2026-11-09-putaway-tray-overview-2d-design.md`

## Global Constraints

- Không đổi API/BE, không thêm trường dữ liệu, không tạo toạ độ kho.
- Giữ `data-testid="ptw-tray-overview"` và `data-testid="ptw-tray-cell"`.
- Màu/đường kẻ dùng token semantic hiện hành; không hard-code hex trong page.
- Không hiển thị số `0` giả khi query còn tải.
- Mọi nhãn mới phải có đủ vi/en/zh.
- Không dùng `exact` trong `getByRole`/`queryByRole`/`findByRole` của RTL.

## Review Focus

- Tên zone/khay dài: mã và `location_hint` phải wrap trong ô, không đẩy tràn grid ở 320px.
- Danh sách rỗng hoặc lọc không khớp: phải phân biệt với lỗi tải; nút xoá lọc phải đưa về trạng thái xem được.
- Query đang tải: KPI không được hiện `0`; khay cũ không được nhấp nháy biến mất nếu đã có dữ liệu.
- Bàn phím: KPI là button có `aria-pressed`; footprint không giả làm button khi không có hành động.
- Dark mode: lưới nền, viền zone và màu chữ phải đọc được bằng token, không dùng màu sáng cố định.

---

### Task 1: Khoá i18n cho mặt bằng và nút xoá lọc

**Files:**
- Modify: `src/shared/i18n/messages.ts:5476-5488`
- Modify: `src/shared/i18n/messages.en.ts:5480-5493`
- Modify: `src/shared/i18n/messages.zh.ts:5588-5600`

**Interfaces:**
- Produces: các khoá `putaway.overview.mapTitle`, `legendAria`,
  `clearFilters`, `layoutNote`, `zoneDistributionAria` dùng ở Task 2.

- [ ] **Step 1: Thêm khoá tiếng Việt**

```ts
mapTitle: "Sơ đồ khu vực khay",
legendAria: "Chú giải trạng thái khay",
clearFilters: "Xoá lọc",
layoutNote: "Bố cục theo khu vực — không phải sơ đồ vị trí.",
zoneDistributionAria: "Phân bố trạng thái trong {zone}",
```

- [ ] **Step 2: Thêm bản dịch tiếng Anh**

```ts
mapTitle: "Tray zone map",
legendAria: "Tray status legend",
clearFilters: "Clear filters",
layoutNote: "Grouped by zone — not a location map.",
zoneDistributionAria: "Status distribution in {zone}",
```

- [ ] **Step 3: Thêm bản dịch tiếng Trung**

```ts
"mapTitle": "托盘区域图",
"legendAria": "托盘状态图例",
"clearFilters": "清除筛选",
"layoutNote": "按区域分组 — 不是位置图。",
"zoneDistributionAria": "{zone} 的状态分布",
```

- [ ] **Step 4: Chạy typecheck i18n**

Run: `npm run typecheck`
Expected: PASS (các file message dùng cùng shape).

- [ ] **Step 5: Commit**

```bash
git add src/shared/i18n/messages.ts src/shared/i18n/messages.en.ts src/shared/i18n/messages.zh.ts
git commit -m "feat(putaway): add tray overview map labels"
```

---

### Task 2: Dựng mặt bằng kho 2D và test hành vi

**Files:**
- Create: `src/modules/putaway/pages/TrayOverviewPage.test.tsx`
- Modify: `src/modules/putaway/pages/TrayOverviewPage.tsx`

**Interfaces:**
- Consumes: `fetchAllPutawayTrays(): Promise<TrayOption[]>`,
  `TrayOption { container_id, container_code, status, zone_code?, location_hint? }`,
  các khoá i18n ở Task 1.
- Produces: DOM giữ `ptw-tray-overview`, `ptw-tray-cell`; thêm
  `data-testid="ptw-kpi-value"` cho 4 con số KPI.

- [ ] **Step 1: Viết test thất bại**

Tạo `TrayOverviewPage.test.tsx` mock
`@/modules/putaway/services/putawayService`:

```tsx
const fetchTrays = vi.fn();
vi.mock("@/modules/putaway/services/putawayService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/putaway/services/putawayService")>();
  return { ...actual, fetchAllPutawayTrays: () => fetchTrays() };
});
```

Dữ liệu mẫu: `TRAY-A1` (EMPTY, ZONE-A, "Kệ 01"), `TRAY-A2` (PARTIAL,
ZONE-A, "Khay A-02"), `TRAY-B1` (CLOSED, ZONE-B, "Kệ 02"), `TRAY-X`
(EMPTY, zone null, "Khu mẫu").

Các test:
1. `renders KPI counts, zones and tray footprints`: `ptw-tray-overview` có
   mặt; 4 `ptw-kpi-value` lần lượt `4, 2, 1, 1`; `ZONE-A` có 2
   `ptw-tray-cell`; zone chưa gán nằm sau `ZONE-B`.
2. `filters by status and clears the filter`: bấm button `/Cần chú ý/` →
   còn 1 footprint `TRAY-B1`; nút `/Xoá lọc/` xuất hiện; bấm → còn 4.
3. `filters by search across code, zone and location`: gõ `kệ 02` → còn
   `TRAY-B1`; gõ `không tồn tại` → thấy empty state.
4. `does not show fake zero counts while loading`: mock trả Promise treo;
   `getAllByTestId("ptw-kpi-value")` đều có text `—`.

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run src/modules/putaway/pages/TrayOverviewPage.test.tsx`
Expected: FAIL vì chưa có `ptw-kpi-value` và bố cục mới.

- [ ] **Step 3: Viết lại phần trình bày**

Trong `TrayOverviewPage.tsx`:
- Giữ nguyên `TrayBucket`, `BUCKET_META`, `bucketOf`, `counts`, `filtered`.
- Đổi `grouped` để zone có tên đứng trước, `zoneUnassigned` cuối.
- Thêm `hasActiveFilter = bucketFilter !== "ALL" || keyword.trim() !== ""`.
- Dải KPI: một `Box` surface viền `S.border`, radius `RADIUS.card`, grid 4 cột
  (2 cột < `md`); mỗi ô `button` có `aria-pressed`, số `data-testid="ptw-kpi-value"`.
  Khi `traysQuery.isPending` hiện `—`.
- Khung map: header `mapTitle` + tổng số + legend 3 chấm; toolbar có
  `SearchInput` và nút `clearFilters` khi `hasActiveFilter`; body nền
  `S.bgCanvas` + lưới 24px bằng `linear-gradient` từ `S.border`; chân khung
  `layoutNote`.
- Zone: `component="section"` + heading; header dùng `zoneCount`; thanh phân
  bố 3 trạng thái `aria-hidden`, kèm `aria-label` từ `zoneDistributionAria`;
  zone chưa gán dùng `borderStyle: "dashed"` và xếp cuối.
- Tray: `li` > `data-testid="ptw-tray-cell"`; dải màu 3px trên, khung nét đứt
  bên trong, mã + `location_hint` wrap, chấm + nhãn trạng thái. Không dùng
  `UiStatusBadge` để tránh pill lặp.
- Hover/focus-visible: dịch lên 1px, viền đậm, outline 2px `S.infoText`.
- Loading/error/empty giữ trong thân khung; bọc `minHeight` để khung ổn định.
- Giữ nguyên nút "Về xếp khay" và vị trí hiện tại.

- [ ] **Step 4: Chạy test mới**

Run: `npx vitest run src/modules/putaway/pages/TrayOverviewPage.test.tsx`
Expected: PASS 4/4.

- [ ] **Step 5: Chạy test putaway liên quan**

Run: `npx vitest run src/modules/putaway`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add src/modules/putaway/pages/TrayOverviewPage.tsx src/modules/putaway/pages/TrayOverviewPage.test.tsx
git commit -m "feat(putaway): redesign tray overview as 2d warehouse map"
```

---

### Task 3: Kiểm tra gate và đẩy nhánh dev

**Files:**
- Modify: `docs/ui/DESIGN_FOUNDATIONS.md` only if a new shared visual rule was
  introduced (không dự kiến; quyết định riêng theo AGENTS.md).
- Verify: working tree, tests, build.

- [ ] **Step 1: Chạy typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Chạy lint phạm vi sửa**

Run: `npx eslint --config eslint.config.js src/modules/putaway/pages/TrayOverviewPage.tsx src/modules/putaway/pages/TrayOverviewPage.test.tsx`
Expected: PASS, không warning mới.

- [ ] **Step 3: Chạy token gate và diff check**

Run: `npm run ui:tokens`

Run: `git diff --check`
Expected: PASS cả hai.

- [ ] **Step 4: Chạy build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Kiểm tra trực quan nếu app chạy được**

Mở `/putaway/trays` ở 1440 và 390 (nếu có phiên đăng nhập/dữ liệu). Ghi lại
màn/trạng thái đã xem. Nếu không truy cập được dữ liệu thật, ghi rõ giới hạn
trong báo cáo cuối.

- [ ] **Step 6: Commit tài liệu và push**

```bash
git add docs/superpowers/specs/2026-11-09-putaway-tray-overview-2d-design.md docs/superpowers/plans/2026-11-09-putaway-tray-overview-2d.md
git commit -m "docs(putaway): record tray overview 2d design"
git push origin dev
```

Expected: `dev` cập nhật lên `origin/dev`; không force push.
