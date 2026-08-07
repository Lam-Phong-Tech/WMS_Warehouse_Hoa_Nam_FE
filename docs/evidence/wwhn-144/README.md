# WWHN-144 / WWHN-145 – Responsive, RBAC và navigation evidence

## Mục đích

Thư mục này định nghĩa evidence contract có thể tái tạo cho FE layout/navigation/shared component. Runtime evidence không được tự ghi nhận bằng nhận xét hoặc ảnh blob không truy vết; evidence chuẩn được sinh bởi GitHub Actions trên đúng `SOURCE_SHA`.

## Artifact chuẩn

- Tên artifact: `wms-fe-closure-evidence-<SOURCE_SHA>`.
- Retention: **90 ngày**.
- Báo cáo HTML: `playwright-report/index.html`.
- Báo cáo JSON: `test-results/playwright-results.json`.
- Screenshot và metadata: `test-results/wwhn-144/<SOURCE_SHA>/`.
- Video: Playwright project `wwhn-144-chromium` bật `video: on`; file video nằm trong `test-results/` và được đóng gói cùng artifact.
- Closure register trong repo: `docs/evidence/wwhn-144/WWHN-144_CLOSURE_REGISTER.json`.

Mỗi metadata JSON phải có tối thiểu: `sourceSha`, `environment`, `buildVersion`, `role`, `viewport`, `browserProject`, `route`, `finalUrl`, `timestamp`, `screenshotFilename`, `result`, `assertions` và disposition về API scope.

## Ma trận bắt buộc

| Nhóm | Trường hợp bắt buộc |
| --- | --- |
| Viewport | `1440x900`, `768x1024`, `375x812` |
| RBAC menu | Menu được phép hiển thị; menu không có quyền không tồn tại trong DOM |
| Direct URL | Anonymous bị đưa về `/login`; authenticated thiếu quyền bị đưa về `/errors/403` |
| 403 | `/errors/403` được bảo vệ bởi session và hiển thị trạng thái không có quyền đúng ngữ cảnh |
| Traceability | Artifact name, exact SHA, env, build, role, viewport và timestamp đều có trong report/metadata |

## Authoritative extracted handoff — 07/08/2026

Known-good FE evidence đã được tải lại trực tiếp từ GitHub Actions artifact `8918968586` và kiểm lại SHA-256 độc lập ngày 07/08/2026:

- Source SHA: `8f9ac97f5ebbc9ac036d5ad732ccbbfdf615adab`;
- CI run: `30977711589` — PASS;
- Artifact SHA-256 expected/actual: `ece3d04f85f014bc89411c8fa852023ca67df2989e98766f82c20ce0ef6344c1` — **MATCH**;
- Build: `1.0.0-ci.133.1`; environment: `test`;
- 19/19 mandatory gates PASS; 39 files / 320 unit-integration tests PASS;
- WWHN-144 technical matrix 6/6 PASS.

Bản đã giải nén để reviewer mở trực tiếp, không phải dùng ZIP làm evidence chính:

- Google Drive folder: https://drive.google.com/drive/folders/1ejdNCeP-wdq6KWHsBJ-hBdXE2yJyfqdh
- Root manifest: `WWHN-144_EVIDENCE_MANIFEST.json`;
- `screenshots/`: 6 PNG;
- `metadata/`: 6 JSON;
- `videos/`: 6 WEBM được đổi tên theo scenario;
- `manifests/`: build manifest, health, CI runtime manifest, Playwright result và snapshot tài liệu tại PASS SHA.

**Không dùng một ZIP mơ hồ** làm evidence duy nhất. Reviewer dùng **folder link chuẩn kèm manifest** và có thể đối chiếu hash từng file trong root manifest.

## Equivalence/provenance audit

Để tránh dùng evidence cũ một cách máy móc, FE đã so sánh known-good SHA `8f9ac97f5ebbc9ac036d5ad732ccbbfdf615adab` với `m1` head trước closure `2b88d55922c7fc4269918ef5e35beea86297b49a`.

Các blob quan trọng của WWHN-144 vẫn byte-identical giữa hai SHA, gồm `MainLayout`, `AppHeader`, `SideNav`, menu/layout styles, `ProtectedRoute`, `RequirePermission`, route access/index và `e2e/auth-role-navigation-qa2.spec.ts`. Vì vậy không phát hiện regression trong core layout/navigation/RBAC/direct-URL implementation của WWHN-144 sau run PASS.

Chi tiết blob SHA nằm trong `WWHN-144_CLOSURE_REGISTER.json`.

## Current exact-SHA CI boundary

Run `31074312011` trên SHA `2b88d55922c7fc4269918ef5e35beea86297b49a` hiển thị `failure`, nhưng GitHub check annotation xác nhận **job chưa được start** do account payment/spending limit của GitHub Actions. Không có quality-gate step nào chạy ở run này, nên đây không phải test/code failure và không được suy diễn thành FE regression.

Disposition:

1. FE giữ nguyên quality gates, không bypass, không whitelist và không hạ tiêu chuẩn.
2. Repository/org owner phải khôi phục GitHub Actions billing/spending capacity.
3. Sau khi runner hoạt động lại, CI phải rerun trên exact final `m1` SHA để tạo artifact mới.
4. Known-good artifact + equivalence audit là evidence kỹ thuật/provenance hiện có, không thay thế requirement exact-SHA rerun khi hạ tầng được khôi phục.

## Phân định phạm vi

WWHN-144 và parent WWHN-29 là **UX frame scope**: layout responsive, navigation, menu filtering và FE route guard. Đây **không phải API integration endpoint scope** và không phải bằng chứng backend authorization. Mock API chỉ tạo trạng thái xác định để kiểm thử hành vi FE; BE/QA1 vẫn phải xác nhận direct API denial, data scope và audit độc lập.

## Quy tắc bàn giao Jira/QA2

- GitHub Actions artifact là nguồn CI bất biến trên exact SHA.
- Không dùng một ZIP mơ hồ làm evidence duy nhất; gói bàn giao phải được giải nén thành report, screenshot, video và metadata có tên file rõ ràng, hoặc cung cấp folder link chuẩn kèm manifest.
- Jira authoritative comment phải ghi final commit SHA, workflow/run classification, artifact/hash, environment/build, Drive folder và owner/reviewer boundary.
- Không sử dụng URL `blob:` hoặc ảnh dán tạm trong comment làm nguồn evidence đóng ticket.
- Tất cả blob/ZIP-only/self-handoff comment cũ được xem là `SUPERSEDED_NON_EVIDENCE` cho final review khi đã có authoritative folder + manifest + closure register.
- Automation pass là technical evidence; không thay QA2 sign-off độc lập cho WWHN-145.
- Không chuyển parent WWHN-29 khi WWHN-143 còn `In Progress` hoặc WWHN-145 chưa đạt independent QA2 workflow gate.

## Self-reference / one-commit policy

Commit SHA không thể được chèn vào chính nội dung của cùng commit mà không phát sinh commit thứ hai. Vì yêu cầu WWHN-144 chỉ tạo **một commit**, file trong repo dùng immutable evidence SHA đã biết và closure register; final closure commit SHA được ghi ở authoritative Jira comment ngay sau commit. CI sử dụng `SOURCE_SHA` để tự ghi exact-SHA vào artifact khi GitHub Actions runner hoạt động trở lại.
