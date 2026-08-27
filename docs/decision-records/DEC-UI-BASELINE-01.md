# DEC-UI-BASELINE-01 — Chốt baseline UI cho chương trình Vuexy Sync (Part 1→5)

- **Ngày quyết định:** 2026-08-27
- **Người quyết định:** Product/Project owner (phiên làm việc Claude Code — trantunglam2025@gmail.com), trả lời trực tiếp Decision Gate Phase A của `docs/ui/vuexy-sync/09-remediation-architecture-plan.md`
- **Ngữ cảnh:** `docs/ui/vuexy-sync/01-context-readiness.md` §5 (BLK-BASELINE-01) và `02-baseline-source-matrix.md` §2 (BC-01…BC-06)
- **Hiệu lực:** giải toả blocker của `docs/ui/vuexy-sync/gates/part-01-gate.json`; là căn cứ thi hành Prompt 2 (Design System Foundation Remediation)

## D1 — Nguồn baseline & stack (giải quyết BC-01, BC-02 / câu hỏi A1+A2)

- Baseline Web Application: **React/Vite + MUI**; styling engine của MUI là **Emotion (`@emotion/react` + `@emotion/styled`)** — giữ mặc định MUI, không đổi styled-engine.
- Chuẩn thiết kế: **design-language parity theo Vuexy Vuejs demo-1** (rendered reference `https://demos.pixinvent.com/vuexy-vuejs-admin-template/demo-1`, số đo read-only ngày 2026-08-27 — evidence: `01-context-readiness.md` §4 + bảng token bên dưới).
- **KHÔNG** dùng licensed Vuexy source; **KHÔNG** scrape/copy proprietary bundle/asset của Pixinvent — chỉ chuyển design language (cùng phương án license-sạch mà Mini App đã dùng, `Mini_App_WMS_Hoa_Nam/docs/vuexy-miniapp-progress.md:394`).
- Hệ quả: mọi tuyên bố parity trong Prompt 2–5 là "design-language parity theo số đo live demo", không phải "100% source baseline".

## D2 — Chốt token lệch (giải quyết BC-03 / câu hỏi A3)

Chốt **theo live Vuejs demo** (không theo hệ X của Mini App ở các giá trị lệch):

| Token | Giá trị chốt (live demo) | Hệ X Mini App (không dùng) |
|---|---|---|
| error/danger | **#FF4C51** | #EA5455 |
| primary darken | **#675DD8** | #5E54D8 |
| secondary | **#808390** (bổ sung — hệ X không có) | — |
| info | **#00BAD1** (đo `--v-theme-info` 0,186,209) | #00CFE8 |

Chấp nhận: Web App sẽ lệch Mini App ở các giá trị trên. Follow-up (không bắt buộc, ngoài scope repo này): đề xuất Mini App đồng bộ ngược về bộ live-demo để 2 app khớp nhau.

## Bảng token khoá (nguồn cho Prompt 2 — toàn bộ từ số đo live demo 2026-08-27)

| Nhóm | Token | Giá trị |
|---|---|---|
| Brand | primary / on-primary | `#7367F0` / `#FFFFFF` |
| Brand | primary-darken | `#675DD8` |
| Neutral | background (canvas) / surface | `#F8F7FA` / `#FFFFFF` |
| Text | on-surface base | `#2F2B3D` (47,43,61) |
| Text | emphasis opacity: high / medium / disabled | 0.9 / 0.7 / 0.4 |
| Text | body mặc định | `rgba(47,43,61,0.7)` @ 15px, font "Public Sans" (system-preferred, không Google Fonts render-blocking) |
| Semantic | secondary / darken | `#808390` / `#737682` |
| Semantic | success / darken | `#28C76F` / `#24B364` |
| Semantic | warning / darken | `#FF9F43` / `#E68F3C` |
| Semantic | error / darken | `#FF4C51` / `#E64449` |
| Semantic | info / darken | `#00BAD1` / `#00A7BC` |
| Border | border-color / opacity | `47,43,61` / 0.12 → `rgba(47,43,61,0.12)` |
| State | hover-opacity | 0.06 |
| Grey | 100 / 200 / 300 / 500 | `#F5F5F5` / `#EEEEEE` / `#E0E0E0` / `#9E9E9E` |
| Control | button mặc định | cao 38px, radius 6px, font 15px/500, disableElevation |
| Radius | control/card ≈ 6px; sheet/modal 16–20px (chốt chi tiết trong Prompt 2 theo đo từng component) | |

## D3 — Kiến trúc đích (giải quyết BC-04 / câu hỏi A4+A5)

- **Engine đích: MUI 9** (antd 6 rút dần theo Phase D của `09-remediation-architecture-plan.md`).
- **Retire hệ warm P0**: `src/shared/design-tokens.ts`, `src/styles/hoa-nam-wireframe.css`, font Be Vietnam Pro (`@import`), font Inter (`index.html`) — xoá theo lộ trình Phase B/C (di trú consumer sống trước khi xoá).

## D4 — SEC-RBAC-01 (câu hỏi A6)

Sửa trong **Prompt 2 Phase C** (gỡ `renderMvpScreen`/`?screen=` khi dựng shell mới — `src/app/layouts/MainLayout.tsx:286-363`); không tạo ticket tách riêng trước. SEC-RBAC-01 giữ trạng thái **P0 OPEN** trong gate cho tới khi Phase C đóng bằng evidence (không đóng bằng cách đổi severity).

## Ghi chú governance

- BC-02 (đổi baseline thị giác từ BA-wireframe sang Vuexy) được phê duyệt qua quyết định này trong phiên làm việc; **khuyến nghị** mirror vào Jira/biên bản BA sign-off chính thức để đủ dấu vết nghiệm thu theo quy trình dự án (exact SHA + decision record này).
- Các tài liệu audit `docs/ui/vuexy-sync/01…09` là snapshot tại thời điểm audit (trước quyết định); trạng thái sống của blockers/conflicts theo dõi tại decision record này + gate JSON.
- Mini App "hệ X" (`docs/ui-system-x-vuexy.md`) vẫn là **tài liệu tham khảo phụ** cho quy tắc layout desktop/motion/forbidden-patterns ở những điểm không mâu thuẫn với số đo live demo.
