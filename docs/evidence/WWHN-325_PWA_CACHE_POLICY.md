# WWHN-325 — PWA/cache policy và QA handoff

## Phạm vi

WWHN-325 chỉ bổ sung khả năng cài đặt PWA và cache giao diện tĩnh để ứng dụng PV có thể mở shell khi mạng không ổn định. Đây **không phải** cơ chế offline transaction và không thay đổi API contract.

## Cache allowlist

- App shell: `/`, `/index.html`, `/manifest.webmanifest`.
- Icon PWA 192x192 và 512x512.
- Static same-origin asset do browser phân loại `script`, `style`, `image`, `font`.
- Navigation dùng network-first; chỉ fallback về cached `index.html` khi network lỗi.

## Cache denylist / security

- Không intercept hoặc cache bất kỳ URL `/api/**`.
- Không intercept cross-origin request.
- Không intercept request có header `Authorization`.
- Không lưu auth/session/token/private API response vào CacheStorage.
- Không dùng Background Sync.

## Offline mutation policy

Axios request interceptor chặn toàn bộ `POST`, `PUT`, `PATCH`, `DELETE` khi `navigator.onLine === false` với code `OFFLINE_MUTATION_BLOCKED`. Vì guard đặt tại shared API client, receipt/issue/reversal/adjustment và mọi mutation khác đều fail-safe trước khi gửi request; không có queue hoặc optimistic replay.

## Online/offline/update UX

- Khi offline: hiển thị banner cố định giải thích chỉ static shell được cache và mutation bị khóa.
- Khi có service worker mới: hiển thị nút `Cập nhật ngay`.
- Chỉ khi người dùng bấm cập nhật mới gửi `SKIP_WAITING`; sau `controllerchange` ứng dụng reload một lần để tránh chạy bundle cũ không nhất quán.
- Service worker chỉ đăng ký ở production build để không gây cache nhiễu môi trường DEV.

## Automated evidence mapping (FE325-P1-12)

QA assertion "receipt/issue/reversal/adjustment offline, no-network/no-queue/no-replay, SW update flow" được chốt bằng test tự động chạy được tại exact SHA:

| Assertion | Bằng chứng tự động |
|---|---|
| Receipt/Issue/Reversal offline bị chặn ở flow thật, adapter không nhận request | `src/shared/pwa/wwhn-325-offline-flows.test.ts` — gọi `postOutboundIssue`, `postReversalDocument` thật và endpoint `INBOUND_POST_RECEIPT` qua shared client; guard nằm ở request interceptor nên mutation không thể chạm tầng HTTP adapter |
| Adjustment offline | Không có FE surface (WWHN-236 Apply Adjustment = DEFERRED/NO-CODE, xem `src/test/wwhn-236-adjustment-deferral-gate.test.ts`); guard theo method vẫn chặn POST/PUT/PATCH/DELETE tới path adjustment — bằng chứng mức endpoint trong cùng file test |
| No-network/no-queue/no-replay runtime | `e2e/wwhn-325-pwa-offline.spec.ts` — mutation offline nhận network-error (SW không handle non-GET), Background Sync không có tag/bị engine tắt, sau reconnect không có mutation `/api` nào được phát trong cửa sổ chờ; GET refetch sau reconnect là read hợp lệ, không tính là replay |
| No Background Sync (static) | `src/shared/pwa/pwa-assets.test.ts` — SW không đăng ký handler `sync`, không tham chiếu `SyncManager` |
| SW update flow runtime | `e2e/wwhn-325-pwa-offline.spec.ts` — bản SW mới vào trạng thái `waiting`, controller cũ giữ quyền cho tới khi gửi `SKIP_WAITING` (đúng message của nút `Cập nhật ngay`), sau `controllerchange` controller là bản mới |
| SW update flow UI | `src/shared/pwa/PwaStatus.test.tsx` — banner update hiện theo `PWA_UPDATE_READY_EVENT`, chỉ kích hoạt khi người dùng bấm; banner offline hiện/ẩn theo online/offline (registerPwa chỉ chạy production build nên nửa UI phải chốt ở unit test) |

## QA matrix tối thiểu

1. Chrome Application > Manifest: name/short_name/start_url/display/theme/background/icons 192/512 hợp lệ và installable.
2. Chrome Application > Service Workers: worker active, scope `/`, update flow tạo trạng thái waiting và nút `Cập nhật ngay`.
3. Cache Storage: chỉ thấy app shell/static asset; không có `/api/**`, token hoặc private JSON response.
4. DevTools Offline: GET shell fallback được; POST/PUT/PATCH/DELETE trả `OFFLINE_MUTATION_BLOCKED`, không có request mutation trong Network.
5. Thực hiện ít nhất receipt, issue, reversal, adjustment khi offline và xác nhận không queue/replay sau khi online lại.
6. Chuyển online → offline → online: banner thay đổi đúng trạng thái; retry thủ công sau reconnect hoạt động theo API hiện hành.
7. Chạy `lint`, `typecheck`, `test`, `build` trên exact SHA và lưu raw log/exit code 0.

## Traceability

- Jira: WWHN-325 / HN-STR-001.
- Dependency: HN-FE-008.
- Independent QA: WWHN-326.
- Branch canonical: `m1`.
