# 30 — Final Handoff (Chương trình Vuexy-sync 5 phần)

> Repository: WMS_Warehouse_Hoa_Nam_FE · Branch: dev · DELIVERY_MODE: COMMIT_LOCAL_CHECKPOINT (không push/PR/merge/deploy).
> Runtime toàn chương trình: claude-fable-5 / xhigh (xác minh CLAUDE_EFFORT mỗi part).

## 1. Chuỗi truy vết (theo yêu cầu prompt 05 §15)

```
Licensed Vuexy Baseline  = KHÔNG có source licensed (VUEXY_LICENSED_SOURCE không được cấp).
                           DEC-UI-BASELINE-01 (2026-08-28, user chốt qua AskUserQuestion):
                           parity theo DESIGN LANGUAGE của Vuexy Vuejs demo-1 LIVE
                           (đo trực tiếp từ demo public), KHÔNG copy source Vue.
→ Mini App Reference     : Mini_App_WMS_Hoa_Nam — tham chiếu identity/ngữ nghĩa;
                           giá trị số chốt theo live demo (ghi trong DEC + docs 02-04).
→ Canonical Tokens       : src/shared/ui/tokens (primitives [ĐO]/[X]/[DX] + semantic
                           + component + css-vars mirror; parity test khoá lệch).
→ Theme Adapters         : mui-adapter (createTheme duy nhất) + antd-adapter
                           + AppThemeProvider (composition root duy nhất).
→ Component Contracts    : @/shared/ui (foundation + forms + layout + overlay),
                           docs 15-17, catalog /ui-foundation làm golden sống.
→ Screen/Role Consumers  : 29/29 route × 100% role/state (docs 19-20);
                           0 direct import ngoài adapter-zone (24 file ratchet).
→ Tests/Visual Evidence  : unit 999 · E2E một-lượt 266+2/268 (0 fail) · goldens 2
                           + computed-style + sweep 10 viewport + a11y 3 engine
                           (docs 21-22, 25-27; evidence PNG/JSON per-scenario).
→ CI Negative Tests      : 10 ca fixture-vi-phạm-thật (negative-tests-part5.txt),
                           9 lệnh ui:* nối vào ci.yml + assert-ci-gates (doc 29).
→ Exact SHA              : gate chain a55462c → 67c1537 → ab69c36 → e3044d6 → <output_sha
                           trong part-05-gate.json> (mỗi part: checkpoint + seal).
```

## 2. Final P0/P1/P2 Register

| ID | Severity | Screen/Component | Problem | Expected baseline | Required fix | Evidence | Status |
|---|---|---|---|---|---|---|---|
| SEC-RBAC-01 | P0 | MainLayout `?screen=` | mount màn ngoài RequirePermission | route guard là boundary duy nhất | layout luôn render Outlet | wwhn-212:301 FAIL-baseline→PASS; 5b16823 | **CLOSED (P4a)** |
| RC-02 | P1 | 82 file feature | direct antd/MUI import | 0 ngoài adapter | migrate wave 8 cụm + integration | doc 23; allowlist 82→24 | **CLOSED (P4-P5)** |
| RC-03/CSS-14 | P1/P2 | 8 lớp CSS legacy | cascade xung đột/hex | token-only, manifest cố định | xoá 4+DashboardPage.css, token-hoá 5 | doc 23 §5; ui:styles | **CLOSED** |
| NAV-01/02 | P1 | menu/404 | nav 3 nguồn, không 404 | nav-data duy nhất + 404 thật | P4a | wwhn-144/sweep | **CLOSED** |
| CSS-15 | P2 | sx height:35 | control lệch 35px | 38px token | xoá toàn bộ hack | grep=0 | **CLOSED (P4)** |
| DEP-01 | P2 | package.json | deps chết/duplicate | không dep UI thừa | gỡ 5 package + guard ui:dependencies | doc 24; bundle −8.5% JS | **CLOSED (P5)** |
| FRZ-01 | P2 | 6 adapter deprecated còn consumer (StatusTag 3 · TopPagination 3 · PageHeader 1 · MvpPaginationFooter 3 · MvpPageSizeSelector 3 · ReportKpiCard+Grid 1) | antd/MUI-internal adapter | canonical Ui* | freeze chỉ-giảm; xoá khi gỡ antd remnant | deprecated-components.json + test | **OPEN P2** (owner FE1, deadline "gỡ antd remnant") |
| GAP-01 | P2 | UiAutocomplete/UiSwitch | 4 chỗ mất typeahead; PvSwitch cục bộ | canonical đủ bộ | thêm 2 canonical rồi thay | doc 19 Tồn dư | **OPEN P2** |
| A11Y-TOOL | P2 | contrast scanner | chưa có máy đo tự động | axe-core trong ui:a11y | thêm sau | doc 26 §2 | **OPEN P2** |

**0 P0 · 0 P1 mở.** 3 mục P2 có owner/deadline — không mục nào chặn vận hành.

## 3. Vận hành tiếp (cho DEV kế nhiệm)

1. Trước PR đụng UI: `yarn ui:guards` (giây) — checklist doc 29 §4.
2. Thêm component/token/golden: theo 3 giao thức doc 29 §4 (creation/token/baseline).
3. E2E wording: đổi text người-dùng-thấy = cập nhật spec CÙNG PR (bài học 83 drift từ kỷ nguyên [skip ci] — doc 22 §3c).
4. Xoá tiếp adapter freeze: migrate consumer → gỡ entry manifest → xoá file (mẫu doc 24 §2).
5. E2E local chậm/flaky goto: `--retries=1 --workers=4` (IO OneDrive); CI ubuntu không cần.

## 4. Kết luận

**PROGRAM COMPLETE = PASS · BASELINE PARITY = PASS** (định nghĩa §10 prompt 05 thoả từng điều kiện — với ranh giới trung thực: "licensed source identity" được thay bằng DEC-UI-BASELINE-01 do user chốt vì không có licensed source; mọi kết luận parity là THEO LIVE DEMO). Số liệu và điều kiện chi tiết: part-05-gate.json + Output block cuối phiên.
