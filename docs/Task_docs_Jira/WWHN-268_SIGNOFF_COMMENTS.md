# WWHN-268 — Comment xác nhận / sign-off theo vai trò

Nguyên tắc: **mỗi vai trò chỉ comment 1 lần**, nói rõ mình xác nhận cái gì, không
ký thay vai trò khác. Các mục còn phải làm việc thật (chạy độc lập trên build đã
deploy, disposition contract) tách riêng ở §2 và **không được ký**.

Trước khi dán: thay `<EXACT_GIT_SHA>` / `<FE_RUN_ID>` / `<BE_RUN_ID>` bằng giá
trị của lần chạy xanh cuối trên `m1` của hai workflow
`WWHN-268 FE defect closure` và `WWHN-268 BE regression closure`. Không dán số
run của task khác.

SHA ứng viên đã chốt trên `m1` (dùng cho `<EXACT_GIT_SHA>`):

| Repo | Commit |
|------|--------|
| `WMS_Warehouse_Hoa_Nam_FE` | `3bad47deb266b2cc276fa9844b1cf00e9b50348c` |
| `WMS_Warehouse_Hoa_Nam_BE` | `2e0515f26b622a5844f4973a3a8233bc7076541a` |

`<FE_RUN_ID>` / `<BE_RUN_ID>` chỉ có sau khi hai workflow chạy trên đúng hai SHA
trên; **không** dán số run của lượt chạy tại chỗ.

---

## 1. Các comment chỉ cần xác nhận (đọc + duyệt)

### 1.1. FE1 — chủ task WWHN-268

> **[FE1] Xác nhận đóng phần FE của WWHN-268 trên nhánh `m1`.**
> Tôi đã đọc và duyệt, xác nhận:
> - **P1 · defect list**: register đã cụ thể hoá thành `docs/evidence/WWHN-268/DEFECT_REGISTER.json` — 5 dòng (FE268-D01/D02/D03, BE268-D01/D02), mỗi dòng đủ module, route, tài khoản/vai trò, viewport, môi trường/build, expected, actual, root cause, file đã sửa, bằng chứng trước/sau, lệnh retest, owner và người xác nhận. `scripts/verify-wwhn-268-closure.mjs` fail-closed nếu thiếu trường, có chuỗi độn, hoặc trỏ tới file không tồn tại.
> - **P1 · UI evidence**: đủ 7 trạng thái Annex D (loading/empty/error/success/disabled/confirm/permission-denied) + responsive 3 viewport + RBAC gõ thẳng URL, mỗi ảnh chụp kèm JSON ghi SHA/env/build/vai trò/viewport/route/assertion — `e2e/wwhn-268-defect-retest.spec.ts`.
> - **P2 · closure matrix**: bảng 1-1 root cause → fix → evidence → retest → confirmer tại `docs/Task_docs_Jira/WWHN-268.md` §3.
> - Hai defect thật đã sửa tận gốc: **FE268-D01** (toàn FE chỉ có 5 test hook, không hook nào là trạng thái → thêm hợp đồng `UI_STATE`), **FE268-D02** (6 màn trong phạm vi tự viết `emptyText` nên empty ≡ error; `/inbound` có `ApiErrorAlert` cục bộ che component dùng chung nên 403 không ra `NoPermissionState`).
>
> Kết quả cổng FE tại SHA ứng viên: `yarn typecheck` PASS · `wwhn-268:verify` PASS · `ui-state.test.tsx` 8/8 PASS · `test:e2e:wwhn-268` **21/21 PASS** với 33 capture. Lượt chạy công bố lấy từ `<EXACT_GIT_SHA>` / run `<FE_RUN_ID>`.
> Lưu ý phụ thuộc nhánh: `yarn lint` / `yarn format:check` / `yarn test` toàn repo còn đỏ ở các tệp của workstream song song (WWHN-233/247/260/331) đã commit lên `m1`; **không** tệp nào thuộc WWHN-268 — xem `docs/evidence/WWHN-268/RUN_MANIFEST.json`.
> Tôi **không** xác nhận đây là UAT: bằng chứng FE là controlled/mock, không thay lượt chạy độc lập của QA2 và không chứng minh phân quyền backend.

### 1.2. BE1 / BE2 — WWHN-266 / WWHN-267

> **[BE1/BE2] Xác nhận phần contract/error/sample của WWHN-268 đã giao.**
> Tôi đã đọc và duyệt:
> - Phạm vi regression backend là artifact máy đọc được: `docs/evidence/WWHN-268/BE_REGRESSION_SCOPE.json`, đủ 5 vùng stock / reversal / warranty / PV / report, mỗi vùng trỏ tới class test có thật.
> - `tests/Feature/Wwhn268RegressionContractTest.php` khoá: (a) phạm vi không được rỗng hay trỏ tới class đã xoá, (b) 6 bề mặt bảo vệ trả 401 khi chưa xác thực với envelope đủ `error_code` + `meta.request_id`, (c) 403 dùng mã trong danh mục đã chốt và vẫn có `request_id`, (d) `GET /api/v1/pv/catalog` giữ nguyên là bề mặt công khai theo SRS §3/§8.4.
> - Biên nhận bàn giao: `docs/docs_task_jira/WWHN-268_BE_REGRESSION_RECEIPT.md`.
>
> Kết quả: `php artisan test --filter=Wwhn268RegressionContractTest` 4/4 PASS; Feature suite 732 test / 705 pass / 27 skip / 0 fail. Lượt chạy chốt trên PostgreSQL 16 tại `<EXACT_GIT_SHA>` / run `<BE_RUN_ID>`.
> Tôi **không** xác nhận thay QA1: lượt regression trên build đã deploy vẫn thuộc `WWHN-264`.

### 1.3. QA1 — WWHN-264

> **[QA1] Xác nhận phạm vi và hợp đồng lỗi backend dùng cho vòng retest là đúng.**
> Tôi đã đọc và duyệt:
> - Phạm vi tối thiểu cho regression API/DB/integration của vòng WWHN-70 là `BE_REGRESSION_SCOPE.json` (stock / reversal / warranty / PV / report) — đúng dependency mà register nêu.
> - Hợp đồng lỗi §8.2 mà FE dựa vào đã được test khoá lại: 401 khi chưa xác thực, 403 theo danh mục mã đã chốt, envelope luôn có `request_id`.
> - Ghi nhận **BE268-D02** là khác biệt cách gọi tên mã 403 giữa SRS §8.2 (cột *ví dụ*) và cài đặt (`ACCESS_DENIED`), **không** phải lỗi kỹ thuật; kiểm soát bù là FE nhận diện theo HTTP 403 chứ không theo chuỗi mã.
>
> Tôi **chưa** đóng `WWHN-264`: lượt chạy regression trên build đã deploy và comment pass/fail là việc thật, xem §2.

### 1.4. QA2 — WWHN-265

> **[QA2] Xác nhận ma trận bằng chứng UI/E2E của WWHN-268 là đủ điều kiện dùng cho retest.**
> Tôi đã đọc và duyệt:
> - Bộ retest phủ đúng 7 trạng thái Annex D, 3 viewport bắt buộc `1440x900` / `768x1024` / `375x812`, và 6 route trong phạm vi regression; mỗi capture ghi kèm SHA/env/build/tài khoản/vai trò/viewport/route nên truy được.
> - Trạng thái `loading` của **dữ liệu** đã tách khỏi skeleton lúc tải chunk route (`ui-state-loading-table`), nên ảnh chụp không còn nhập nhằng.
> - Trạng thái `empty`, `error` và `permission-denied` đã phân biệt được — trước đây cả ba hiển thị gần như giống nhau nên bằng chứng bị coi là generic.
>
> Tôi **chưa** đóng `WWHN-265`: lượt UI/E2E regression độc lập trên build công bố và comment pass/fail là việc thật, xem §2.

### 1.5. BA

> **[BA] Xác nhận cách WWHN-268 hiểu baseline là đúng tài liệu.**
> Tôi đã đọc và duyệt:
> - Bộ trạng thái UI bắt buộc theo **SRS/FRD v1.12 Annex D**: loading, empty, error, success, disabled, confirm, permission-denied — đúng 7 trạng thái mà register dùng.
> - **§8.2**: 403 (từ chối quyền/scope) phải phân biệt với 500 (lỗi máy chủ) và với danh sách rỗng; đây là căn cứ của FE268-D02.
> - Phạm vi 6 module regression (nhập / xuất / tồn / reversal / bảo hành / báo cáo) khớp screen map MVP; **App PV không có trong wireframe MVP** nên PV chỉ được kiểm ở tầng API.
> - **Kiểm kê/Stocktake không thuộc MVP** (SRS §5.3); đường sửa sai là đối soát + Reversal append-only. WWHN-268 không tạo màn/API ngoài baseline.
>
> Tôi **chưa** xác nhận **BE268-D02** — thống nhất danh mục mã lỗi 403 là thay đổi contract, xem §2.

### 1.6. Tech Lead

> **[Tech Lead] Xác nhận nhánh, ranh giới bằng chứng và cách khoá hợp đồng của WWHN-268.**
> Tôi đã đọc và duyệt:
> - Nhánh canonical là **`m1`**; không có nhánh riêng cho task này.
> - Định danh bằng chứng chỉ lấy từ `GITHUB_SHA` / `GITHUB_RUN_ID` của lần workflow xanh; chạy tại chỗ sinh `local-uncommitted` và **không** được trích dẫn ra ngoài như bằng chứng exact-SHA.
> - Ranh giới đúng: FE là **UX gate**, backend là biên phân quyền có thẩm quyền; WWHN-268 không thêm authorization phía client.
> - Cách chống tái phát là hợp lý: hợp đồng trạng thái nằm ở một file nguồn duy nhất (`src/shared/constants/ui-state.ts`), được khoá bằng unit test và verifier, thay vì mô tả trong tài liệu.
>
> Tôi **chưa** xác nhận **BE268-D02**: cần quyết định chung với BA trước khi đụng vào danh mục mã lỗi đã phát hành.

### 1.7. PM / PO

> **[PM/PO] Ghi nhận trạng thái closure của WWHN-268.**
> Tôi đã đọc và duyệt closure matrix tại `docs/Task_docs_Jira/WWHN-268.md` §3:
> - **Đã đóng**: FE268-D01, FE268-D02 (đã sửa + retest PASS), FE268-D03 (kiểm chứng, không có defect), BE268-D01 (đã giao phạm vi + test hợp đồng).
> - **Còn mở, có chủ**: `WWHN-264` (QA1), `WWHN-265` (QA2), phần ngoài phạm vi đã giao của `WWHN-266`/`WWHN-267` (BE1/BE2), BE268-D02 (BA + Tech Lead), trace PR/build (DEV + DevOps).
> - WWHN-268 **không** tự tuyên bố `WWHN-70` hoàn tất khi các mục trên còn mở.

---

## 2. Không được ký — phải làm việc thật

| Việc | Vì sao không ký được | Vai trò | Ticket |
|------|----------------------|---------|--------|
| UI/E2E regression độc lập trên build/SHA công bố, comment pass/fail | Bằng chứng hiện có là FE-controlled/mock, không phải lượt chạy độc lập | QA2 | `WWHN-265` |
| API/DB/integration regression trên build đã deploy | Lượt chạy tại chỗ là in-process trên DB test, không phải build deploy | QA1 | `WWHN-264` |
| Contract/error/sample/data fix cho blocker phát sinh ngoài phần đã giao | Phụ thuộc defect thật mà QA1/QA2 tìm thấy trong lượt chạy độc lập | BE1 / BE2 | `WWHN-266` / `WWHN-267` |
| Thống nhất danh mục mã lỗi 403 (§8.2 vs `ACCESS_DENIED`) | Là thay đổi contract, chạm OpenAPI + FE + nhiều bộ test đã chốt | BA + Tech Lead | BE268-D02 |
| PR URL + exact SHA + build ID + CI log của lượt chạy chốt | Log local Windows không đủ cho Beta sign-off | DEV + DevOps | W268-EXT-04 |
