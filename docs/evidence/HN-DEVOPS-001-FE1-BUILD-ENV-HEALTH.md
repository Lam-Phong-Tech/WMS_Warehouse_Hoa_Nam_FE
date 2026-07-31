# HN-DEVOPS-001 - Bằng chứng Build/Env/Health FE1

## Truy xuất nguồn gốc

| Trường | Giá trị |
| --- | --- |
| Nhiệm vụ Cha | WWHN-32 - [DEVOPS] Môi trường local/DEV/UAT, CI/CD và secret cơ sở |
| Khóa tạm Cha | HN-DEVOPS-001 |
| Khóa tạm Epic | HN-EPIC-03 |
| Phụ thuộc | HN-DEVOPS-001-ST01 |
| Vai trò | FE1 |
| Người được gán | HN-FE-01 |
| Chủ sở hữu FE | Quang Nguyen Thanh |
| Đầu ra | Frontend có thể triển khai |
| Ngày đánh giá | 2026-07-30 |

## Phạm vi

FE1 đã chuẩn hóa bề mặt frontend build/env/health mà không thay đổi các hợp đồng API backend hoặc quy tắc nghiệp vụ.

## Đã bàn giao

| Khu vực | Bằng chứng |
| --- | --- |
| Runtime env | `src/shared/config/env.ts` xác thực `VITE_APP_ENV`, `VITE_API_BASE_URL`, `VITE_API_HEALTH_PATH`, `VITE_API_TIMEOUT_MS`, storage URL và các cờ tính năng. |
| Tích hợp API | `src/shared/api/axios.ts` hiện đọc base URL và timeout từ `runtimeConfig`; các service tiếp tục sử dụng `http` và hằng số endpoint dùng chung. |
| Storage URL | `src/shared/utils/storage-url.ts` sử dụng cấu hình env tập trung và tránh truy cập trực tiếp `import.meta.env`. |
| Health artifact | `public/health.json` được sao chép vào `dist/health.json`; `scripts/check-frontend-health.mjs` xác minh các artifact frontend có thể triển khai. |
| Cổng CI/CD | `.github/workflows/ci.yml` chạy `npm run health:check` sau khi build. |
| Tài liệu | `.env.example`, `README.md` và `docs/WMS_FRONTEND_STANDARDIZATION.md` ghi lại các kỳ vọng FE env/build/health. |

## Ghi chú Hợp đồng

- FE không định nghĩa ngữ nghĩa phản hồi health backend. Health backend vẫn thuộc sở hữu của DevOps/BE thông qua `VITE_API_BASE_URL + VITE_API_HEALTH_PATH`.
- Không có endpoint/payload API nào được đổi tên trong nhiệm vụ này.
- Không có quy tắc RBAC/nghiệp vụ nào được suy luận trong FE.
- Secret không được giới thiệu. `.env.example` chỉ chứa các mặc định không phải secret.

## Ánh xạ Tiêu chí Chấp nhận

| Tiêu chí Chấp nhận | Kết quả |
| --- | --- |
| Đầu ra "Frontend có thể triển khai" đã được đánh giá/xác minh | Artifact build bao gồm `index.html` và `/health.json`; CI có cổng kiểm tra health. |
| UI xử lý các trạng thái và tuân theo đặc tả | Các nền tảng UI/RBAC/API lỗi dùng chung hiện có được giữ nguyên; nhiệm vụ này không thay đổi hành vi UI module. |
| Hiển thị quyền/RBAC và lỗi API | Hành vi bảo vệ route/interceptor API hiện có được giữ nguyên. |
| Không có dữ liệu/quy tắc hard-code trái ngược hợp đồng | Env được tập trung hóa; không có dữ liệu nghiệp vụ hoặc hợp đồng API nào được hard-code trong module. |
| Lint/build/test đạt yêu cầu | Kết quả chạy sẽ được đính kèm bên dưới sau khi xác minh. |
| Bằng chứng BA/QA | File này cộng với tài liệu README/env cung cấp bằng chứng FE1 cho HN-DEVOPS-001. |

## Nhật ký Xác minh

Chạy vào ngày 2026-07-30:

| Lệnh | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm.cmd run lint` | Đạt | ESLint đã vượt qua cho `src/`. |
| `npm.cmd run test -- --run src/shared/config/env.test.ts src/shared/api/axios.test.ts src/shared/api/http.test.ts` | Đạt | 3 file kiểm thử, 24 bài kiểm tra đã qua. |
| `npm.cmd run build` | Đạt | `tsc -b` và Vite production build đã hoàn thành. Lần chạy đầu tiên bị chặn bởi quyền filesystem `dist` cũ; đã tạo lại sau khi dọn dẹp `dist` đã tạo. |
| `npm.cmd run health:check` | Đạt | Đã xác minh `dist/index.html` và `dist/health.json`. |
| `npm.cmd run check:api-mapping` | Đạt với cảnh báo | Không có xung đột method/path. Runtime catalog fetch bị bỏ qua vì `VITE_TEST_EMAIL`/`VITE_TEST_PASSWORD` cố tình không được đặt. |
| `npm.cmd run format:check` | Lỗi tồn tại ngoài phạm vi | Chỉ lỗi trên `src/modules/master-data/pages/MasterPage.tsx` đã tồn tại trước; các file env mới đã được định dạng. |

## Blockers Mở

Không có trong phạm vi FE1 build/env/health sau khi xác minh. Backend/DevOps vẫn sở hữu việc triển khai endpoint health API thực tế và cung cấp secret theo môi trường.