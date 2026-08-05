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

Mỗi metadata JSON phải có tối thiểu: `sourceSha`, `environment`, `buildVersion`, `role`, `viewport`, `browserProject`, `route`, `finalUrl`, `timestamp`, `screenshotFilename`, `result`, `assertions` và disposition về API scope.

## Ma trận bắt buộc

| Nhóm | Trường hợp bắt buộc |
| --- | --- |
| Viewport | `1440x900`, `768x1024`, `375x812` |
| RBAC menu | Menu được phép hiển thị; menu không có quyền không tồn tại trong DOM |
| Direct URL | Anonymous bị đưa về `/login`; authenticated thiếu quyền bị đưa về `/errors/403` |
| 403 | `/errors/403` được bảo vệ bởi session và hiển thị trạng thái không có quyền đúng ngữ cảnh |
| Traceability | Artifact name, exact SHA, env, build, role, viewport và timestamp đều có trong report/metadata |

## Phân định phạm vi

WWHN-144 và parent WWHN-29 là **UX frame scope**: layout responsive, navigation, menu filtering và FE route guard. Đây không phải bằng chứng backend authorization hoặc API integration endpoint scope. Mock API chỉ tạo trạng thái xác định để kiểm thử hành vi FE; BE/QA1 vẫn phải xác nhận direct API denial, data scope và audit độc lập.

## Jira

Jira chỉ tham chiếu commit, workflow run và GitHub Actions artifact chuẩn. Không sử dụng URL `blob:` hoặc ảnh dán tạm trong comment làm nguồn evidence đóng ticket.
