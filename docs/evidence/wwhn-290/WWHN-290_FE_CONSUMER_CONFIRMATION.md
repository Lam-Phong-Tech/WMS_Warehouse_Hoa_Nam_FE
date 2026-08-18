# WWHN-290 — FE consumer confirmation (contract single source)

- Jira: `WWHN-290` — `[BE] Khắc phục lỗi dữ liệu/báo cáo/tính năng` (parent `WWHN-77`, QA ticket `WWHN-291`)
- Review item đóng ở đây: `DEV290-P1-03R` — *"Khóa một approved OpenAPI source; pin Postman + QA + FE consumer cùng version/SHA"*, phần **FE consumer**.
- Repo/nhánh: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` @ `m1`.
- Vai trò của repo FE trong WWHN-290: **CONSUMER EVIDENCE ONLY** — không phải nguồn implementation BE.
- Verifier: `node scripts/verify-wwhn-290-consumer.mjs` (hoặc `yarn wwhn-290:verify` / `npm run wwhn-290:verify`).

## 1. Contract mà FE thực sự tiêu thụ

| Trường | Giá trị | Kiểm bằng |
|---|---|---|
| Nguồn contract được duyệt | `storage/api-docs/api-docs.json` trên BE `m1` | `WWHN-290_PINS.json` (repo BE) |
| `openapi` | `3.0.0` | cổng BE `wwhn-290-closure.yml` |
| `info.version` | `2.0.0` | cổng BE + verifier BE |
| Namespace | `/api/v1` | `src/shared/config/env.ts` — hằng `CANONICAL_API_BASE_PATH` |

FE **không** tiêu thụ revision `1.0.0` từng xuất hiện trên nhánh `m1-be-2`, và cũng không tiêu thụ bất kỳ
file `openapi.yaml` per-ticket nào trong `docs/api-contract/` của BE. Những artifact đó là lineage lịch sử.

## 2. Invariant được thực thi bằng code, không phải bằng lời văn

`src/shared/config/env.ts`:

- `const CANONICAL_API_BASE_PATH = "/api/v1";`
- `normalizeApiBaseUrl()` ném lỗi khi `VITE_API_BASE_URL` không kết thúc đúng ở `/api/v1`
  (`must end at /api/v1`), khi có query/hash, khi nhúng credential, hoặc khi không phải `http/https`.

Hệ quả: **không tồn tại build FE nào trỏ sang namespace contract khác** — kể cả khi ai đó dựng lại
service theo revision `1.0.0` cũ. Đây là lý do FE consumer được coi là đã pin cùng một contract source,
chứ không phải một lời hứa trong tài liệu.

Hai HTTP client đều lấy base URL từ cùng một nguồn `runtimeConfig.apiBaseUrl`:

| Client | File | Dùng cho |
|---|---|---|
| `api` (authenticated) | `src/shared/api/axios.ts` | toàn bộ màn hình WMS có đăng nhập |
| `publicApi` | `src/shared/api/public-http.ts` | App PV công khai (WWHN-252) |

`src/test/wwhn-252-pv-contract.test.ts` đã chốt hai client dùng chung một `baseURL`.

## 3. Kết luận consumer cho WWHN-290

1. Phạm vi WWHN-290 đổi **0 file contract** ở BE, nên **không có breaking change** nào về endpoint/payload/enum
   buộc FE phải thích ứng. FE không cần thay đổi mã cho ticket này.
2. FE xác nhận chỉ có **một** contract source được tiêu thụ: `2.0.0` / `/api/v1` trên BE `m1`.
3. Bản ghi consumer này là bằng chứng phía FE cho `DEV290-P1-03R`. FE **không** ký thay QA1 (`DEV290-P1-04R`),
   PM/Tech Lead (`DEV290-P1-02R`), Data/Tech/DevOps (`DEV290-P1-05R`) hay BA/BAS (`DEV290-P1-06`).

## 4. Chống pin rot

Tài liệu này cố tình **không** pin blob SHA của file contract BE. `m1` là nhánh dùng chung và file
`storage/api-docs/api-docs.json` bị các ticket khác (ví dụ WWHN-328) regenerate nhiều lần trong cùng một ngày
dù `info.version` vẫn là `2.0.0`. Pin ở đây là **live invariant** (`2.0.0` + `/api/v1`) cộng với **range
invariant** phía BE (phạm vi commit của WWHN-290 chạm file contract 0 lần), hai thứ đúng vĩnh viễn.
