# WWHN-252 — Hồ sơ đóng vòng 2 (R2): App PV

> **Tài liệu này THAY THẾ mọi bản mô tả trước đó của WWHN-252 khi có mâu thuẫn**,
> bao gồm attachment **11436 (bản Aug-01)**. Bản Aug-01 mô tả trạng thái *"chưa có
> module/endpoint App PV"* — đúng tại thời điểm đó, **nhưng đã hết hiệu lực**:
> module FE `src/modules/pv/**` và 8 operation Annex C của BE đã tồn tại và đang
> chạy. Bản Aug-01 giữ lại như **tài liệu lịch sử**, không dùng để nghiệm thu.
> (Đây là hạng mục FE252-P2-04.)

| Trường | Giá trị |
|---|---|
| Ticket | WWHN-252 (FE) · liên đới WWHN-249 (BE governance), WWHN-253 (QA2) |
| Vòng | R2 — sau đánh giá 72/100 |
| Nhánh | `m1` (cả hai repo) — không tạo nhánh riêng |
| **FE exact SHA** | `ce179400c1117cf000b670107fcca2817fd1a38e` |
| **BE exact SHA** | `fb911c6` |
| Nguồn chuẩn | `HN_SRS_FRD_v1.12_FULL` (§3, §8.1, §8.2, §12, §13 Field mapping, NFR-SRS-016, Annex C/D) · `HoaNam_ERD_Moi_Nhat` (bảng 51–57) · `WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide` |
| Ghi chú nguồn thiết kế | Wireframe ALIGNED v3.20 ghi rõ **không dựng App PV**, nên nguồn thiết kế là §8.3 + Annex C/D, không phải wireframe (đã chốt ở HN-PIN-09). |

---

## A. Trạng thái từng hạng mục của register R2

| ID | Sev | Trạng thái | Bằng chứng đóng |
|---|---|---|---|
| FE252-P1-02R2 | P1 | **ĐÃ ĐÓNG** | `BE docs/evidence/WWHN-252/BE_CONTRACT_HANDOFF_REVIEW.md` — rà soát độc lập, pin API canonical + version + SHA, disposition đủ 7 RedFlag + 4 deviation của WWHN-249 |
| FE252-P1-05R2 | P1 | **ĐÃ ĐÓNG** | `docs/evidence/WWHN-253/QA2_PV_RESPONSIVE_REPORT.md` — 32 ô (4 khung nhìn × 8 trạng thái), ảnh + metadata có SHA, sinh fail-closed từ lần chạy thật |
| FE252-P1-06R2 | P1 | **ĐÃ ĐÓNG** | `docs/evidence/WWHN-252/WWHN-252_FE_FULL_GATE_ce17940.log` — lint + typecheck + test + build chạy tại đúng SHA trong worktree tách biệt |
| FE252-P1-08 | P1 | **ĐÃ SỬA (FE + BE)** | §B dưới đây; test BE 428/412/422/version-bump + test FE header trên dây + test UI |
| FE252-P2-02R2 | P2 | **CHỜ PM/BAS** | Metadata Jira, không sửa được từ repo — comment xác nhận đã soạn sẵn |
| FE252-P2-04 | P2 | **ĐÃ ĐÓNG** | Chính tài liệu này (đánh dấu attachment 11436 là lịch sử) |

---

## B. FE252-P1-08 — gốc lỗi và cách sửa tận gốc

### B.1 Bệnh

`PATCH /pv/products/{sku_id}/publish` được Annex C khai **có header `If-Match`**
và có **428** trong error set. Thực tế trước bản vá:

- **BE** coi header là tuỳ chọn (`assertVersionMatchesIfProvided` trả `null` khi
  thiếu) ⇒ **428 là mã chết**, không đường nào sinh ra được.
- **FE** không gửi header nào; ngoài ra bốn hook lưu master PV còn rơi về
  `version ?? 1` — tức là **tự bịa precondition** khi thiếu dữ liệu.
- Hệ quả nghiệp vụ: hai người mở SCR-PV-ADM-01 cùng lúc thì người bấm sau ghi đè
  trạng thái publish của người trước, **không ai được cảnh báo**. Đúng thứ mà
  optimistic locking sinh ra để chặn.

Đáng chú ý: OpenAPI runtime **đã khai `If-Match: required`** cho operation này —
nghĩa là tài liệu và code nói hai chuyện khác nhau, và FE wire theo code.

### B.2 Câu hỏi phải chốt: version nào?

`sku.version` hay version hồ sơ App PV? Chốt: **version hồ sơ**, vì

1. §13 Field mapping, dòng `SCR-PV-ADM-01 / published / Toggle`, khai nguồn dữ
   liệu là **`PV_Profile.published`** — công tắc thao tác trên hồ sơ.
2. `GET /pv-admin/resources/product-profiles` trả `version` của hồ sơ; đó là con
   số **duy nhất** FE nhìn thấy trên dòng đang bấm.
3. Dùng `sku.version` thì một lần `updateSku` hợp lệ (quyền `sku.manage`, hoàn
   toàn khác `pv.publish`) sẽ làm hỏng precondition của người đang publish.

Quyết định ghi tại `BE docs/decision-records/DEC-API-IFMATCH-002-pv-publish-precondition.md`.
Quy ước: `If-Match: 0` = SKU chưa có hồ sơ (lần publish đầu); `N ≥ 1` = version
hiện tại. Mỗi lần publish/unpublish thành công **tăng version** và trả về
`data.pv_profile_version`.

### B.3 Đã sửa gì

**BE** (`Modules/Warehouse/app/Http/Controllers/ProductController.php`)

- Thiếu `If-Match` ⇒ **428 PRECONDITION_REQUIRED**, trạng thái publish không đổi.
- Sai định dạng ⇒ **422 INVALID_VERSION**; lệch version ⇒ **412 STALE_VERSION**
  kèm `expected_version`/`current_version`.
- Bump version hồ sơ sau mỗi thao tác thành công; đọc/ghi qua `PvRelations` nên
  chạy đúng trên **cả sqlite lẫn PostgreSQL** (tên bảng/cột khoá khác nhau).

**FE**

- `setPvProductPublished(skuId, published, profileVersion)` gửi
  `If-Match: <profileVersion>`; `PvAdminPage` truyền `row.version` của đúng dòng.
- 412/428 ⇒ **tải lại danh sách hồ sơ rồi mới cho bấm tiếp** (báo lỗi suông sẽ
  khiến người dùng bấm lại đúng version cũ và hỏng lần nữa).
- **Gỡ sạch fallback `?? 1`**: thiếu version là lỗi lập trình của màn hình, ném
  ngay tại client, không gửi request.

### B.4 Bằng chứng

| Kịch bản | Test |
|---|---|
| Thiếu header ⇒ 428, không đổi trạng thái | BE `Wwhn252PvContractTest::test_publish_without_if_match_returns_428_and_changes_nothing` |
| Lệch version ⇒ 412 + expected/current | BE `…::test_publish_with_stale_profile_version_returns_412` |
| Version tăng, trả `pv_profile_version`, khớp số FE đọc từ danh sách | BE `…::test_publish_bumps_pv_profile_version_and_returns_it` |
| Sai định dạng ⇒ 422 | BE `…::test_publish_with_non_numeric_if_match_returns_422` |
| Header đi thật trên dây (service → http → axios) + 200/412/428 | FE `src/modules/pv/services/pv-publish-if-match.contract.test.ts` (6 test) |
| UI gửi đúng version của dòng đang bấm; 412/428 ⇒ tải lại | FE `src/modules/pv/pages/PvAdminPage.test.tsx` (7 test) |

Kết quả chạy thật (sqlite, BE `fb911c6`):
`Wwhn252PvContractTest` 21/21 · 136 assertion;
`Wwhn249 + MasterDataGovernance + Wwhn252` 38/38 · 217 assertion.

---

## C. FE252-P1-06R2 — cổng đầy đủ tại đúng SHA

Chạy trong **worktree tách biệt** (`git worktree add --detach <tmp> ce17940`) để
kết quả không dính WIP chưa commit của các phiên song song trên `m1`:

```bash
git worktree add --detach <tmp> ce179400c1117cf000b670107fcca2817fd1a38e
# node_modules junction về repo chính; copy .env
npm run lint && npm run typecheck && npm run test && npm run build
```

Log thô: `docs/evidence/WWHN-252/WWHN-252_FE_FULL_GATE_ce17940.log`.

### C.1 Hai đỏ đã phải gỡ trước khi pin được cổng

1. `src/test/wwhn-247-warranty-closure.test.ts:122` — FQN PHP
   `App\Support\WarrantyPiiMasker` viết một dấu chéo ⇒ 2 lỗi eslint
   `no-useless-escape`, **lint exit 1** cho toàn nhánh.
2. `src/test/wms-contract-signoff-guards.test.ts` — WWHN-187 (`3f2a5c2`) thêm
   `Idempotency-Key` cho hành động quét nhập nhưng guard vẫn khớp cứng cả object
   header ⇒ **đỏ tại HEAD**. Đã đổi sang khớp tập con và kiểm riêng hình dạng key.

### C.2 Hai cổng phụ thuộc môi trường (KHÔNG phải phạm vi WWHN-252 — đã báo)

Hai test dưới đây **xanh trên máy dev nhưng đỏ trên mọi checkout sạch/CI**. Chúng
không thuộc luồng App PV; ghi lại ở đây vì chúng làm "CI run xanh" không tái lập
được cho bất kỳ ticket nào:

| Test | Nguyên nhân | Chủ sở hữu |
|---|---|---|
| `src/test/wwhn-233-count-deferral-gate.test.ts` (PIN ROT) | Digest sha256 tính trên **byte thô** của tài liệu. Checkout trên Windows cho CRLF (51 085 byte), checkout sạch cho LF (50 698 byte) ⇒ digest lệch. Cần chuẩn hoá EOL trước khi băm (rồi cập nhật lại digest trong register). | WWHN-233 |
| `src/test/wwhn-260-migration-operational-only.test.ts` | Đọc `swagger-api.json` — tệp **gitignore**, sinh bởi `npm run contract:sync`. Checkout sạch không có ⇒ ENOENT. Cần chạy `contract:sync` trong cổng, hoặc đọc từ một bản snapshot có trong git. | WWHN-260 |

Trong lần chạy pin ở trên, hai artifact này được đưa vào worktree đúng như trên
máy dev (copy `swagger-api.json` và bản tài liệu CRLF) và **được ghi lại tường
minh** thay vì im lặng.

---

## D. FE252-P1-05R2 — bằng chứng QA2

`e2e/wwhn-253-pv-qa2-responsive.spec.ts` chạy **32 ô**: 4 khung nhìn
(390×844, 768×1024, 1366×768, 1440×900) × 8 trạng thái (public ẩn danh · RBAC từ
chối · RBAC cho phép · lỗi 500 + request_id · offline · 404 · 429 · freshness).

Mỗi ô ghi một ảnh + một JSON có SHA; `scripts/generate-wwhn-253-qa2-report.mjs`
dựng báo cáo và **fail-closed** khi thiếu ô hoặc lệch SHA. Ngoài các khẳng định
riêng, mọi ô đều kiểm **không tràn ngang** — lỗi responsive hay lọt nhất và không
nhìn ra được bằng ảnh chụp.

Cách chạy lại:

```bash
SOURCE_SHA=ce179400c1117cf000b670107fcca2817fd1a38e npx playwright test e2e/wwhn-253-pv-qa2-responsive.spec.ts --project=chromium
SOURCE_SHA=ce179400c1117cf000b670107fcca2817fd1a38e node scripts/generate-wwhn-253-qa2-report.mjs
```

**Ranh giới sự thật:** đây là bằng chứng FE có kiểm soát (API mock ở tầng
network). Nó KHÔNG thay bằng chứng backend enforce quyền/data-scope (thuộc test
BE) và KHÔNG thay UAT thiết bị thật của QA1 (WWHN-275).

---

## E. Việc còn lại không thuộc DEV

| Hạng mục | Chủ sở hữu | Nội dung |
|---|---|---|
| FE252-P2-02R2 | PM / BAS | Sprint Scope ghi W4 trong khi Sprint thực tế là ID93 W3 — sửa metadata hoặc ghi supersession. Không sửa được từ repo. |
| D-01 (WWHN-249) | BA | §3 cho NV kho (V*) và Lãnh đạo (V) mức xem trên dòng PV master, nhưng Annex C chỉ có một key `pv.master.manage`. Muốn mức chỉ-xem thật thì phải thêm key vào Annex C — **đổi contract**, không phải sửa code. |
| UAT thiết bị thật | QA1 (WWHN-275) | Ma trận thiết bị/trình duyệt thật. |
