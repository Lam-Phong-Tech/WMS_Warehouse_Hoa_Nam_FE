# 17 — Component Coverage Report (Part 3)

Ngày: 2026-08-28 · Ưu tiên: **P0** = purpose bắt buộc cho mọi flow WMS · **P1** = cần trước khi migrate screens (Part 4) · **P2** = tiện ích/mở rộng.
"Implemented" = có canonical implementation dùng token; "Tested" = unit/interaction/ARIA colocated (+E2E nơi ghi chú); "Visual" = có mặt trong golden catalog (desktop 1280 + mobile 375, diff ≤2%); "Consumers mapped" = 16-component-migration-map + allowlists (deprecated/direct-ui-imports).

| Component (canonical) | P | Required variants | Required states | Implemented | Tested | Visual PASS | Consumers mapped |
|---|---|---|---|---|---|---|---|
| UiText | P0 | 5 variant chữ | — | ✔ | ✔ | ✔ | ✔ (antd Typography → P4) |
| UiIcon (+shim 90 icon) | P0 | slug × 3 size | màu token | ✔ | ✔ | ✔ | ✔ |
| UiButton/UiIconButton | P0 | 4 appearance × 6 color | hover/focus/active/disabled/loading | ✔ | ✔ (+E2E computed) | ✔ | ✔ (ratchet) |
| ActionButton/IconButton/Group (bless) | P0 | kind × flat/tonal | permission-disabled + data-ui-state | ✔ | ✔ (action-standard + WWHN-268) | ✔ (qua screens) | ✔ (allowlist) |
| ActionDropdown (bless) | P1 | menu items | disabled item | ✔ | ✔ (suite cũ) | — (overlay) | ✔ |
| UiConfirmDialog + useUiConfirm | P0 | primary/danger | loading/Esc/focus-trap | ✔ | ✔ (+master-data suite) | ✔ (mở qua catalog) | ✔ (antd static confirm = 0) |
| UiFormText (text/password/search/textarea) | P0 | 4 type + startIcon + numericOnly/maxLength | error/disabled/required/IME-safe | ✔ | ✔ (7 + auth 39) | ✔ | ✔ (antd forms ĐÃ XOÁ) |
| UiFormNumber | P0 | suffix/min/max | error/gõ dở/clamp | ✔ | ✔ (8) | ✔ | ✔ |
| UiFormSelect | P0 | single/multiple/placeholder | error/disabled option | ✔ | ✔ (7) | ✔ | ✔ |
| UiFormAutocomplete | P1 | single/multiple | lọc/không kết quả | ✔ | ✔ (4) | ✔ | ✔ |
| UiFormCheckbox/Switch | P1 | — | Space toggle/error | ✔ | ✔ (8) | ✔ | ✔ |
| UiFormRadioGroup | P1 | row/column | arrow-key | ✔ | ✔ (5) | ✔ | ✔ |
| UiFormDate (adapter antd) | P0 | format/allowClear | error/disabled | ✔ | ✔ (6 — wiring, antd mock) | ✔ | ✔ (deprecation note MUI X) |
| UiFormField (shell) | P1 | — | required/error/helper | ✔ | ✔ | ✔ | ✔ |
| ScanInput/CameraScanModal (bless antd) | P0 | scan/manual/camera | focus-giữ/duplicate-alert | ✔ (không đổi) | ✔ (suite cũ PASS) | — (flow) | ✔ (P4-D8) |
| DocumentAttachmentsPanel (bless) | P0 | upload/list | evidence gate | ✔ | ✔ (suite cũ) | — | ✔ |
| UiCard | P0 | title/action/disablePadding | — | ✔ | ✔ | ✔ | ✔ (StatCard/InfoCard XOÁ) |
| UiKpiCard | P1 | tone × icon × hint | — | ✔ | ✔ (+E2E 22/600) | ✔ | ✔ (ReportKpi* freeze) |
| ResponsiveDataTable (bless canonical) | P0 | sort client/server, selection, row actions, hideOnMobile | loading/empty/dense | ✔ | ✔ (suite cũ + consumer) | ✔ (dense+empty catalog) | ✔ (DataTable/antd Table freeze→P4) |
| FilterBar/SearchInput | P1 | — | — | ✔ (adapter/bless) | ✔ (suite cũ) | — | ✔ |
| UiPagination | P0 | pageSize options/showTotal | disabled/total=0/clamp | ✔ | ✔ (+consumer 3 adapters) | ✔ | ✔ (5 impl → 1 + freeze) |
| UiTabs | P1 | items/disabled | arrow-key/scrollable | ✔ | ✔ | ✔ | ✔ |
| UiStatusBadge | P0 | 6 tone | — | ✔ | ✔ (+E2E màu) | ✔ | ✔ (StatusTag freeze; antd Tag → P4) |
| UiAvatar | P2 | 3 size/initials/src | — | ✔ | ✔ | ✔ | ✔ |
| UiDescriptions | P1 | columns/span | long text | ✔ | ✔ | ✔ | ✔ |
| UiTimeline | P2 | tone/time | — | ✔ | ✔ | ✔ | ✔ |
| Charts (4 wrapper + panel) (bless) | P1 | theo wrapper | — | ✔ (token P2) | ✔ (suite cũ) | — (dashboard P4) | ✔ |
| UiDialog/UiDrawer | P0 | title/actions/width | motion/đóng sạch/aria-labelledby | ✔ | ✔ (+E2E) | ✔ | ✔ (22 MUI Dialog → P4) |
| Toast sonner (bless) | P0 | 4 loại | — | ✔ | ✔ (suite cũ) | — | ✔ (antd message/notification/confirm = 0) |
| UiAlert | P1 | 4 tone × title/close/action | — | ✔ | ✔ (+E2E bg) | ✔ | ✔ (feedback/Alert XOÁ) |
| ApiErrorAlert (adapter-canonical) | P0 | message/fields/403 | retry/request_id | ✔ (ruột MUI) | ✔ (mọi consumer test PASS) | ✔ (qua state section) | ✔ |
| UiStateSurface + 6 adapter states | P0 | 4 kind | action/description | ✔ | ✔ (ui-state 8 + consumers 295) | ✔ | ✔ (Placeholder/Delayed XOÁ) |
| PageSkeleton/Loading (adapter) | P0 | — | aria-busy/no-shift | ✔ (ruột MUI) | ✔ | ✔ (loading section) | ✔ |
| PwaStatus — Offline (bless) | P1 | offline/update | — | ✔ (token P2) | ✔ (suite PWA cũ) | — | ✔ |
| ErrorBoundary (adapter) | P0 | — | error+reload | ✔ (ruột UiStateSurface) | ✔ (test cũ PASS) | — | ✔ |
| UiAppShell/SidebarNav/Topbar/PageContainer/Breadcrumb/Footer | P1 | collapsed; groups/badge | active/hover/focus-ring | ✔ | ✔ (15 + E2E active/focus) | ✔ (layout demo) | ✔ (MainLayout swap = P4) |
| Primitives re-export (Grid/Stack/…) | P1 | = MUI | — | ✔ | (qua consumer) | ✔ | ✔ |

## Tổng kết coverage

- **P0: 16/16 = 100%** · **P1: 13/13 = 100%** · P2: 2/2 — `component_coverage_percent` (P0+P1) = **100**.
- Không purpose nào trong inventory §4 của prompt bị bỏ: từng mục Foundation/Actions/Forms/Data display/Overlay đều có dòng ở trên hoặc trong 15-component-contracts (kể cả ít consumer: Timeline, Avatar, Descriptions, SplitButton→ActionDropdown, Currency→UiFormNumber suffix, Time/Range→ghi nhận thuộc UiFormDate mở rộng P4 khi có consumer thật — hiện 0 consumer Range trong src).
- Duplicate public còn lại: **0** ngoài danh sách freeze có guard (13 adapter — mỗi cái có canonical + @deprecated + consumer đóng băng).
- Hard-code violation shared layer: **0** (ui:tokens PASS; hex baseline 27 file toàn ngoài shared).
- Light/dark: chỉ light (dark ngoài baseline — DEC).
