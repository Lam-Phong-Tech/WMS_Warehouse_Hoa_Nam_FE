# 01 — Context Readiness (Part 1/5: Vuexy Baseline & UI Library Conflict Audit)

Ngày thực hiện: 2026-08-27
Người thực hiện: Claude Code (claude-fable-5, effort xhigh) — vận hành bởi trantunglam2025@gmail.com

## 1. Runtime check

```text
CLAUDE CODE RUNTIME CHECK
Model requested: claude-fable-5
Model active: claude-fable-5 (xác nhận qua environment của session)
Effort requested: xhigh (Extra High)
Effort active: xhigh (CLAUDE_EFFORT=xhigh trong environment)
Claude Code version/runtime: CLI 2.1.185 / agent claude-code_2-1-246 / SDK 0.3.246 (entrypoint: claude-desktop)
Status: PASS
```

## 2. Context Readiness Report

```text
PART 1 CONTEXT READINESS = READY (phạm vi audit) — 1 P0 governance blocker ghi nhận, chặn Prompt 2
Claude model / effort: claude-fable-5 / xhigh
Target repository / branch / SHA: Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE / dev / a908c420663270d783a34fd378689f7940377c85
Working tree: sạch tại thời điểm bắt đầu (git status --porcelain rỗng; không có thay đổi chồng lấn của người khác)
Mini App repository / branch / SHA: Lam-Phong-Tech/Mini_App_WMS_Hoa_Nam (local clone) / main / b9d4d025a935f4c716d7d731c4d253bbaee46365
Vuexy licensed source/version: KHÔNG CÓ — placeholder trong prompt chưa được điền; không tìm thấy bản licensed nào trên máy (đã quét Downloads/Documents/GitHub)
Live demo audited: CÓ (read-only) — https://demos.pixinvent.com/vuexy-vuejs-admin-template/demo-1 (đo computed styles; trang /components/button yêu cầu login demo nên đo tại màn login + global theme vars, KHÔNG submit form)
AGENTS.md read to EOF: KHÔNG TỒN TẠI trong cả 2 repo (đã glob toàn repo; chỉ có .claude/launch.json). Mini App có CLAUDE.md nhưng đã STALE (mô tả sai router/tokens — xem 02-baseline-source-matrix.md)
Architecture/UI/business docs read to EOF: README.md, system-design.md, docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md (đọc toàn bộ); docs/HN_SRS_FRD_v1.12_FULL.md (§8.3 Screen/UX Baseline + Annex D Screen Map đọc toàn bộ — phần nghiệp vụ còn lại đọc theo heading map); docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html (đọc phần :root/tokens + đối chiếu class); Mini App: docs/ui-system-x-vuexy.md, docs/vuexy-miniapp-progress.md, docs/prompts/vuexy-terra-phases/* (đọc qua audit agent)
Package manager / runtime: Yarn 1.22.22 (yarn.lock), Node baseline v22.17.1 (.nvmrc; local node khớp), Vite 8.1.5, TypeScript ~6.0.2
Current UI engines: Ant Design 6.4.5 + @ant-design/icons 6.2.5 + MUI @mui/material 9.3.1 (+Emotion 11.14.x làm engine nội bộ của MUI) + @flaticon/flaticon-uicons 3.3.1 + ApexCharts 7 + sonner 2.0.7 + 8 lớp CSS global tự viết
Branch/delivery boundary: default branch = dev; CI chạy trên push dev/m1 + mọi PR (.github/workflows/ci.yml); các nhánh remote: dev, m1, cross. DELIVERY_MODE=COMMIT_LOCAL_CHECKPOINT, không push/PR/merge/deploy
Blockers: BLK-BASELINE-01 (P0 — thiếu licensed Vuexy source & thiếu quyết định authority về "source parity" vs "design-language parity"; chi tiết mục 5)
```

## 3. Nguồn đã xác minh (exact SHA/version)

| Nguồn | Định danh chính xác | Trạng thái truy cập |
|---|---|---|
| Target Web App | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` @ `dev` @ `a908c420663270d783a34fd378689f7940377c85` | ĐỌC ĐẦY ĐỦ (local worktree, sạch). SHA khớp đúng snapshot tham chiếu trong prompt |
| Mini App reference | `Lam-Phong-Tech/Mini_App_WMS_Hoa_Nam` @ `main` @ `b9d4d025a935f4c716d7d731c4d253bbaee46365` (1 commit duy nhất "chore: initialize Mini App WMS source"; remote origin xác nhận đúng URL GitHub) | ĐỌC ĐẦY ĐỦ (local clone cạnh Target repo) |
| Vuexy live demo | `demos.pixinvent.com/vuexy-vuejs-admin-template/demo-1` — engine Vuetify (`--v-theme-*`, `v-btn`); phiên bản template KHÔNG xác minh được từ rendered page | ĐO READ-ONLY 2026-08-27 (chi tiết mục 4) |
| Vuexy licensed source | `<BẮT BUỘC ĐIỀN>` — chưa được điền trong prompt | **KHÔNG CÓ** |
| Design System spec (Mini App "hệ X") | `Mini_App_WMS_Hoa_Nam/docs/ui-system-x-vuexy.md` + `src/css/app.scss` (:root tokens) + `docs/vuexy-miniapp-progress.md` (5 phase đều PASS) | ĐỌC ĐẦY ĐỦ |
| BA wireframe (baseline hiện tại của Web App) | `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html` | ĐỌC (tokens + vocabulary) |
| SRS/FRD | `docs/HN_SRS_FRD_v1.12_FULL.md` v1.12 | ĐỌC (§8.3 + Annex D toàn bộ; heading map toàn tài liệu) |
| Review/Staging URL | `<ĐIỀN>` — chưa được điền trong prompt | KHÔNG CÓ (không blocking cho audit) |

## 4. Bằng chứng đo live demo (read-only, 2026-08-27)

Đo bằng `getComputedStyle` trên trang login của demo-1 (route `/components/button` redirect về login; không đăng nhập/submit form theo chính sách an toàn):

| Thuộc tính | Giá trị đo được | Khớp reference trong prompt? |
|---|---|---|
| Body font | `"Public Sans", sans-serif, ...` | ✔ |
| Body font-size | `15px` | ✔ (~15px) |
| Body color | `rgba(47, 43, 61, 0.7)` | ✔ |
| `--v-theme-primary` | `115,103,240` = `#7367F0` | ✔ |
| `--v-theme-primary-darken-1` | `103,93,216` = `#675DD8` | ✔ |
| `--v-theme-background` | `248,247,250` = `#F8F7FA` | ✔ |
| `--v-theme-surface` | `255,255,255` = `#FFFFFF` | ✔ |
| `--v-theme-secondary` | `128,131,144` = `#808390` | ✔ |
| `--v-theme-success` | `40,199,111` = `#28C76F` | ✔ |
| `--v-theme-warning` | `255,159,67` = `#FF9F43` | ✔ |
| `--v-theme-error` | `255,76,81` = `#FF4C51` | ✔ (lưu ý: Mini App "hệ X" dùng `#EA5455` — xem Conflict BC-03) |
| `--v-border-color` / opacity | `47,43,61` / `0.12` | ✔ |
| Primary button (Login) | bg `#7367F0`, chữ trắng, cao `38px`, radius `6px`, font `15px/500` | ✔ (~38px, ~6px) |

Kết luận: bảng "Vuexy rendered snapshot tham khảo" trong prompt là chính xác so với demo-1 Vuejs tại ngày đo. Tuy nhiên demo Vuejs chạy **Vuetify**, còn Mini App lấy baseline từ **Vuexy Next.js demo (MUI)** — hai bản có palette lệch nhau ở `error/danger` (chi tiết 02-baseline-source-matrix.md).

## 5. Blockers

### BLK-BASELINE-01 (P0 — governance, chặn Prompt 2)

- **Sự kiện:** Prompt yêu cầu "Company Vuexy licensed source/package: `<BẮT BUỘC ĐIỀN>`" nhưng placeholder chưa được điền; quét máy không tìm thấy bản Vuexy licensed nào.
- **Hệ quả theo luật của prompt:** không được tuyên bố "100% source baseline"; điều kiện PASS "Đọc được ... licensed Vuexy source" không thể thỏa; nếu yêu cầu của chương trình vẫn là *source parity 100%* thì đây là blocker tuyệt đối.
- **Ngữ cảnh quan trọng:** Mini App (baseline ưu tiên #3) đã hoàn tất migration Vuexy theo phương án **design-language transfer, KHÔNG copy proprietary source/asset** (ràng buộc cứng ghi tại `docs/prompts/vuexy-terra-phases/01-audit-baseline.prompt.md:26` và xác nhận tại `docs/vuexy-miniapp-progress.md:394`). Tức là tiền lệ nội bộ của dự án là parity theo *design language* (spec "hệ X"), không phải theo source.
- **Quyết định cần authority (PM/PO/BA — baseline priority #1):** chọn một trong hai:
  1. Cung cấp đường dẫn Company Vuexy licensed source đúng version → chạy lại readiness để nâng gate lên PASS theo source parity; hoặc
  2. Phê duyệt chính thức baseline = **"hệ X" của Mini App** (`docs/ui-system-x-vuexy.md` + tokens `app.scss`) + số đo live demo, với phạm vi "design-language parity" — khi đó điều kiện licensed source được thay thế bằng Design System specification đã phê duyệt (baseline priority #5 nâng lên nhờ Decision #1).
- **Trạng thái:** OPEN. Toàn bộ audit Part 1 đã hoàn tất không phụ thuộc quyết định này; chỉ Prompt 2 (thi hành remediation) bị chặn.

### Ghi nhận không-blocking

- Review/Staging URL chưa điền — không cần cho audit tĩnh; cần cho Prompt 5 (visual QA) nếu muốn evidence trên môi trường staging.
- MCP server `atlassian` (Jira) chưa authenticate trong session này — không dùng đến trong Part 1.

## 6. Điều kiện ghi (write-gate)

Theo quy tắc "Chỉ được tạo audit/evidence/checkpoint sau Context Readiness Gate READY": readiness được tuyên bố **READY cho phạm vi audit** (mọi nguồn đọc/ghi cần thiết cho audit đều truy cập được; blocker duy nhất là quyết định governance cho Prompt 2, không ảnh hưởng tính đúng đắn của evidence Part 1). Các thao tác ghi của Part 1 giới hạn trong `docs/ui/vuexy-sync/**` + 1 checkpoint commit local, đúng DELIVERY_MODE=COMMIT_LOCAL_CHECKPOINT (không push/PR/merge/deploy).
