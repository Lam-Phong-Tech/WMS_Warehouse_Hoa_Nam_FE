# SEC-20260910 — bằng chứng header bảo mật runtime (P2)

Công cụ: `scripts/check-frontend-security-headers.mjs`. Script đo `/`, `/index.html`, bundle JS và CSS có hash, `service-worker.js` và `manifest.webmanifest`, cộng response JSON của API (`--api`).

| Tệp | Đích | Kết quả |
|---|---|---|
| `security-headers-production-khohoanamfe.json` | `https://khohoanamfe.bigk.click` + `/api/v1/health`, đo 10/09/2026 08:13 UTC | **FAIL: 32 vi phạm bắt buộc.** Không tài nguyên nào có HSTS/CSP/nosniff/X-Frame-Options/Referrer-Policy/Permissions-Policy; API lộ `X-Powered-By: PHP/8.3.33`. |
| `security-headers-local-nginx-control.json` | nginx dựng từ chính `deploy/nginx/frontend.conf.example` (chỉ đổi cổng và placeholder), phục vụ `dist/` của repo | **PASS: 6/6 tài nguyên, 0 vi phạm.** |

Kết luận:
- Cấu hình trong repo đạt cổng.
- Production chưa áp cấu hình này. BE production cũng đang chạy build cũ, chưa có middleware `SecurityHeaders`.
- Việc còn lại là hạ tầng/triển khai. Sau khi deploy, chạy workflow post-deploy để xác nhận.
