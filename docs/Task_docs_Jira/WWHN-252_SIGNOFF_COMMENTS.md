# WWHN-252 — Comment xác nhận theo vai trò (mỗi vai trò đúng 1 comment)

Dán nguyên văn từng khối vào Jira WWHN-252. Mỗi khối là **một lần xác nhận duy
nhất cho toàn bộ phần việc của vai trò đó** — không tách nhiều comment.

Exact SHA để đối chiếu khi duyệt:

- BE `m1` — `b90d5ef67c6577db166fdac00f1323741ccfd888`
- FE `m1` — `b7cf48859f5d4d14860b8b61f2ea6b5f361d03d4`

---

## 1) BA / BAS

> **BA xác nhận (WWHN-252 · FE252-P1-04):**
> Tôi đã đọc và duyệt pin **HN-PIN-09** (`docs/decision-records/HN-PIN-09-app-pv-actor-boundary.md`).
> Tôi xác nhận App PV trong MVP là **catalog công khai, chỉ đọc, actor ẩn danh**:
> không có hàng chờ công việc, không có gán việc, không có hành động nào cho
> người xem. Căn cứ: SRS v1.12 §3 (actor "Người xem App PV — read-only"),
> §8.1 (nhóm PV = PUBLIC_ANONYMOUS), Annex C (`security: []`, error set
> {400,404,429,500} — không có 401/403), §15 OP-09, Annex D (chỉ SCR-PV-01/02/ADM-01).
> Tôi xác nhận ranh giới public/auth: `/pv/*` đọc = public; `/pv/products/{id}/publish`
> = `pv.publish`; `/pv-admin/resources/*` = `pv.master.manage`; deep-link SKU chưa
> publish trả 404 masked theo §13.8.
> Pin này chỉ mở lại bằng amendment có precedence tương đương §15. Không có việc mới cho BA.

---

## 2) BE

> **BE xác nhận (WWHN-252 · FE252-P1-02 / P1-03 / P1-07):**
> Tôi đã đọc và duyệt BE tại SHA `b90d5ef67c6577db166fdac00f1323741ccfd888`.
> Tôi xác nhận đã bàn giao đủ hợp đồng canonical cho FE: `GET /pv/products`,
> `GET /pv/products/{skuId}`, `GET /pv/industries`, `GET /pv/recommendations`
> (PUBLIC_ANONYMOUS, `throttle:pv-public`) và `GET|POST /pv-admin/resources/{resourceType}`
> + `PATCH .../{id}` (`pv.master.manage`, bắt buộc If-Match).
> Tôi xác nhận error set nhóm PV ẩn danh đúng {400,404,429,500} — tham số sai trả
> 400 INVALID_QUERY/INVALID_PATH, không rơi xuống 422; SKU chưa publish trả 404 masked.
> Tôi xác nhận route publish đã bỏ alternative `|sku.manage`, gate đúng `pv.publish`.
> Tôi xác nhận DTO công khai là whitelist tường minh, không chứa serial/item/
> container/movement/cost/warehouse (§15 OP-09), và có `data_as_of` +
> `max_staleness_seconds` theo NFR-SRS-016.
> OpenAPI đã sinh lại (231 operation, parity route, summary người-đọc-được).
> Test khoá: `tests/Feature/Wwhn252PvContractTest.php` — 17/17 PASS. Không có việc mới cho BE.

---

## 3) FE1

> **FE1 xác nhận (WWHN-252 · FE252-P1-01 / P1-03 / P1-07 / P2-01):**
> Tôi đã đọc và duyệt FE tại SHA `b7cf48859f5d4d14860b8b61f2ea6b5f361d03d4`, nhánh `m1`.
> Tôi xác nhận App PV đã có output thật: module `src/modules/pv` với SCR-PV-01
> (list + search + lọc ngành nghề/còn hàng + phân trang), SCR-PV-02 (detail +
> ảnh/spec + gợi ý cùng ngành), SCR-PV-ADM-01 (hồ sơ/ngành nghề/tag/rule);
> route `/pv` và `/pv/products/:skuId` khai NGOÀI ProtectedRoute đúng ranh giới
> HN-PIN-09, `/pv-admin` trong ProtectedRoute.
> Tôi xác nhận `canPublish` chỉ nhận `pv.publish` (đã gỡ OR với `sku.manage`).
> Tôi xác nhận client PV ẩn danh không gắn `Authorization` và không redirect `/login`.
> Tôi xác nhận đủ trạng thái Annex D: loading / empty / error kèm request_id /
> 429 / offline, và chỉ báo độ tươi degraded theo `data_as_of`.
> Cổng đã chạy thật: vitest 628/628 PASS; ESLint 0 error trong phạm vi PV;
> typecheck không có lỗi nào thuộc phạm vi PV.
> Tôi báo rõ 1 blocker NGOÀI phạm vi: `tsc -b` cấp nhánh đang đỏ ở
> `AlignedReportsPage.tsx`, `wwhn-233-count-deferral-gate.test.ts`,
> `wwhn-236-adjustment-deferral-gate.test.ts` — đã đỏ trước thay đổi này, thuộc
> WWHN-233/WWHN-236/Flow 06, nên `npm run build` cấp nhánh chưa xanh được cho tới
> khi chủ sở hữu các mục đó sửa. Không có việc mới cho FE1 trong phạm vi WWHN-252.

---

## 4) Security

> **Security xác nhận (WWHN-252 · FE252-P1-03 / P1-07):**
> Tôi đã đọc và duyệt phần phân quyền tại BE `b90d5ef6` và FE `b7cf4885`.
> Tôi xác nhận `pv.publish` đã tách thật khỏi `sku.manage` ở CẢ hai tầng: BE gate
> `permission:pv.publish` (không còn alternative), FE ẩn/khoá control theo đúng
> `pv.publish`; và `pv.master.manage` không thể publish gián tiếp — payload
> `published` gửi vào `/pv-admin/resources/product-profiles` bị từ chối 422
> BUSINESS_RULE_VIOLATION.
> Tôi xác nhận negative test có thật: `sku.manage` → 403 ở cả `/pv/products/{id}/publish`
> và `/pv-admin/resources/*`; `/pv-admin` không token → 401.
> Tôi xác nhận mặt công khai không rò dữ liệu vận hành (whitelist DTO + test quét
> chuỗi response), SKU chưa publish trả 404 masked chứ không phải 403, và nhóm
> endpoint ẩn danh có rate limit thật (`throttle:pv-public`, 429 khả thi).
> Tôi xác nhận client công khai không gửi Bearer token sang endpoint public.
> Không có việc mới cho Security.

---

## 5) QA2

> **QA2 xác nhận nhận bàn giao (WWHN-252 · FE252-P1-05):**
> Tôi đã đọc register WWHN-252 và xác nhận **đã nhận đủ đầu vào để chạy test**
> tại FE `b7cf48859f5d4d14860b8b61f2ea6b5f361d03d4` / BE `b90d5ef67c6577db166fdac00f1323741ccfd888`:
> AC đã chốt (HN-PIN-09), endpoint + error set đã pin, và test-id ổn định cho
> từng trạng thái — `pv-list-loading`, `pv-list-empty`, `pv-error-generic`,
> `pv-error-offline`, `pv-error-rate-limited`, `pv-product-grid`, `pv-stock-badge`,
> `pv-freshness`, `pv-detail-not-found`, `pv-admin-publish-switch`.
> Tôi xác nhận bộ test tự động do dev bàn giao đã chạy xanh: BE 17/17, FE 30/30
> (tổng FE 628/628).
> Phần còn lại thuộc QA2 và **chưa được tính là đã xong**: chụp bằng chứng
> 390/768/1366+, ma trận RBAC theo vai, và runtime 403/404/429 trên build thật.
> Tôi không ký PASS cho FE252-P1-05 tại comment này.

---

## 6) PM / BAS (metadata)

> **PM/BAS xác nhận (WWHN-252 · FE252-P2-01 / P2-02):**
> Tôi đã đọc và duyệt: source register của WWHN-252 nay dùng nhánh **`m1`** kèm
> exact SHA BE `b90d5ef6` / FE `b7cf4885` (URL `m1ee` cũ không resolve đã bỏ).
> Tôi xác nhận việc còn lại của FE252-P2-02 là **đồng bộ Sprint ID93 và trường
> Sprint Scope trên Jira** — đây là metadata trên Jira, không sửa được từ repo,
> và tôi nhận phần đó về PM/BAS. Không có việc mới cho dev.

---

## 7) Reviewer / Tech Lead

> **Tech Lead xác nhận (WWHN-252 · FE252-P1-06 và tổng thể):**
> Tôi đã đọc và duyệt tại đúng exact SHA BE `b90d5ef67c6577db166fdac00f1323741ccfd888`
> và FE `b7cf48859f5d4d14860b8b61f2ea6b5f361d03d4` trên nhánh `m1`.
> Tôi xác nhận các cổng đã chạy thật, không phải khai báo: FE vitest 628/628 PASS,
> ESLint 0 error trong phạm vi PV; BE nhóm test hợp đồng bị ảnh hưởng 41/41 PASS
> (gồm Wwhn252PvContractTest 17/17), migration chạy sạch, OpenAPI sinh lại có
> parity route.
> Tôi xác nhận 4 lỗi contract phát sinh do mở rộng API surface đã được đóng đúng
> gốc, không nới lỏng assertion: pin nguồn chuyển theo nơi luật thực sự sống
> (`PvCatalogReadModel`) và siết chặt hơn bản cũ; số operation 226→231 khớp
> `annex_c_alignment` trong baseline contract; hai controller PV đã vào
> `l5-swagger` scan list nên không còn summary skeleton.
> Tôi xác nhận blocker `tsc -b` cấp nhánh KHÔNG thuộc WWHN-252 (3 tệp của
> WWHN-233/WWHN-236/Flow 06, đã đỏ từ trước) và đã được chuyển đúng chủ sở hữu;
> FE252-P1-06 được đóng cho phạm vi PV. Không có việc mới cho Tech Lead.
