# WWHN-247 — Luồng 04 · Bảo hành (FE) · Hồ sơ khắc phục & đóng task

**Đầu vào review:** 77/100 — *Chưa đạt yêu cầu* (18/08/2026)
**Candidate:** FE `59c4b16883d64081c8cf150e0df74f90b1d5a8fc` · BE `08abf3f95f9e83be3bc9efe1258fd5f3ea5baa9e` · nhánh `m1`
**Gate:** `npm run verify:wwhn-247`

---

## 1. Đối chiếu từng RedFlag của review

| RedFlag                   | Kết quả review | Trạng thái sau khắc phục | Neo bằng chứng |
| ------------------------- | -------------- | ------------------------ | -------------- |
| HN-WAR-001 / API chưa sẵn | VẪN MỞ (dependency-level, WWHN-244 mới 66/100) | **ĐÓNG ở mức kỹ thuật** — 12 operation Annex C được đối chiếu thẳng với `routes/api.php` của BE mỗi lần chạy gate | `WWHN247-P0-01` · mục 4 |
| BA pin HN-PIN-08          | Không tính hard blocker | Giữ nguyên cách xử lý; nội dung cần BA ký gom vào một chỗ | `STATUS_MATRIX.md` §5 |
| UI skeleton               | ĐÓNG | ĐÓNG **+ có gate giữ** | `WWHN247-P2-01` |
| Endpoint mismatch         | ĐÓNG code-level | ĐÓNG **+ có gate giữ** (chặn cả alias legacy và `http.patch`) | `WWHN247-P2-01` |
| Status enum mismatch      | ĐÓNG phần FE, final matrix chờ BE/BA | **ĐÓNG kỹ thuật** — ba nơi khai báo đã trùng khít, còn lại chỉ là chữ ký BA | `WWHN247-P1-03` · `STATUS_MATRIX.md` |
| PII/RBAC                  | PARTIAL — còn P1 raw PII rendering | **ĐÓNG** — fail-closed ở cả tầng render lẫn tầng service, BE khai báo `pii_masked` ở cả list và detail | `WWHN247-P1-01`, `WWHN247-P1-02` |
| QA chưa chạy              | VẪN MỞ | **ĐÃ CHẠY** — FE 59/59 phạm vi bảo hành, BE 54/58 (1 fail không thuộc luồng 04, xem mục 5) | mục 5 |
| UI evidence thiếu         | PARTIAL — thiếu exact candidate/UAT/QA | **ĐÓNG** — evidence neo vào SHA đầy đủ 40 ký tự, gate từ chối placeholder | `WWHN-247_CLOSURE_REGISTER.json` |
| Mojibake                  | ĐÓNG | ĐÓNG **+ có gate quét lại mỗi lần chạy** | `WWHN247-P2-01` |

---

## 2. P1-01 · PII bảo hành từng render nguyên văn payload

**Vấn đề thật.** `WarrantyPage` in thẳng `row.customer_name` / `row.customer_phone`, `WarrantyDetailModal`
in thẳng `detail.customer_name/phone/address`. Không có bất kỳ lớp nào ở FE che chúng — masking phụ
thuộc 100% vào backend. Vì backend *đang* mask đúng nên màn hình trông không sai, và đó chính là lý do
lỗi này sống lâu: nó chỉ lộ ra khi backend hồi quy, khi response đến từ alias endpoint chưa mask, khi
cache trả bản cũ, hoặc khi chạy với fixture dev. §13.8 yêu cầu PII **không bao giờ** hiển thị/ghi log
đầy đủ ngoài phạm vi `warranty.pii.view` — một hợp đồng như vậy không thể dựa vào "hiện tại tầng kia
đang làm đúng".

Thêm một điểm sai về sự thật: banner *"Thông tin khách hàng đang được che"* suy ra từ danh sách quyền
phía client, nên khi backend và client lệch nhau, banner nói một đằng dữ liệu một nẻo.

**Đã sửa — hai lớp, không chồng lấn.**

1. *Tầng render* (WWHN-244, `be18bec`): WAR-01 và WAR-03 đi qua `warrantyPiiText()`.
2. *Tầng service* (WWHN-247, commit này): `normalizeWarrantyCase()` gọi `resolveWarrantyPii()`. Đây là
   cửa duy nhất mọi dữ liệu case bảo hành đi qua, nên cache React Query, prefill form hiệu chỉnh,
   deep-link và mọi code viết sau này đều chỉ nhận được giá trị đã mask. Fail-closed theo **cả hai**
   nguồn: backend báo `pii_masked` **hoặc** actor thiếu `warranty.pii.view`.

Ba shape mask (`N*** V*** A***`, `*******922`, `***, Hà Nội`) lặp đúng `App\Support\WarrantyPiiMasker`
và **idempotent** trên chính output của backend — mask lại chuỗi đã mask cho ra đúng chuỗi đó, nên hai
lớp không làm sai hiển thị. Trường `pii_masked` được đưa vào `WarrantyCase` để UI đọc trạng thái mask
từ dữ liệu thay vì tự suy.

**Bằng chứng.** `src/test/wwhn-247-warranty-closure.test.ts` đưa payload PII **thô** vào service với
actor thiếu quyền, rồi `JSON.stringify` kết quả và khẳng định không còn mảnh nào của tên/SĐT/địa chỉ
gốc. Hướng ngược lại cũng được khoá: actor có quyền và backend không báo mask thì nhận nguyên văn —
masking không được phép phá nghiệp vụ của người có quyền.

---

## 3. P1-02 · Bề mặt đọc danh sách không khai báo trạng thái mask

`GET /warranty-cases` mask giá trị nhưng không trả cờ nào, còn `GET /warranty-cases/{id}` lại có
`pii_masked`. Hệ quả: client cầm một chuỗi mà không có cách nào biết nó là thật hay đã mask, nên buộc
phải suy từ danh sách quyền phía mình — đúng lớp lỗi §13.8 cấm, và là **nguyên nhân gốc** khiến FE
render thẳng payload.

Đã bổ sung `pii_masked` cho bề mặt đọc danh sách trong `CanonicalMvpController::tablePage()`, kể cả
khi actor có quyền (giá trị `false`) để hợp đồng luôn tường minh thay vì "vắng mặt nghĩa là không mask".

`Wwhn247WarrantyPiiContractTest` khoá bốn điều: list khai báo đúng `pii_masked` theo quyền, không còn
mảnh PII thô nào trong payload, list và detail **nhất quán** cho cùng một actor, và keyword không dùng
được làm oracle dò PII (mask mà vẫn cho LIKE trên cột PII thì mask chỉ là trang trí).

---

## 4. P0-01 · Dependency HN-WAR-001 chuyển từ lời nói sang bằng chứng

Review ghi *"API chưa sẵn — VẪN MỞ dependency-level"*. Vấn đề của một dependency như vậy không phải
đúng hay sai, mà là **không ai chạy lại được** để biết nó còn đúng không.

`scripts/verify-wwhn-247-closure.mjs` đọc thẳng `Modules/Warehouse/routes/api.php` của repo BE, chuẩn
hoá tham số path (`:id` ↔ `{id}`) và đối chiếu **từng** operation Annex C mà WWHN-247 tiêu thụ:

```
/warranty-cases · /warranty-cases/{} · /warranty-cases/{}/status
/warranty-cases/{}/events · /warranty-cases/{}/attachments
/warranty-attachments/{} · /warranty-attachments/{}/download
/warranty-component-issues · /warranty-component-issues/{}
/warranty-component-issues/{}/scans · /cancel · /post
```

Gate kiểm thêm: permission của bề mặt đọc (`warranty.view|warranty.manage`) và ghi (`warranty.manage`),
sự tồn tại của `WarrantyPiiMasker`, `pii_masked` ở cả list lẫn detail, và hai test khoá hợp đồng
(`Wwhn244WarrantyStateMatrixTest`, `WarrantyFlow04ApiSurfaceTest`).

Không tìm thấy repo BE thì gate **fail**, trừ khi chạy `--fe-only` — khi đó dependency được ghi
`SKIPPED`, không bao giờ được ghi là PASS. Mặc định trỏ `../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE`,
ghi đè bằng `WWHN_247_BE_ROOT`.

Điểm review 66/100 của WWHN-244 là hạng mục của chính task đó. Ở phía WWHN-247 không còn phụ thuộc
kỹ thuật nào đang mở.

---

## 5. P1-04 · QA đã chạy thật

| Bộ | Lệnh | Kết quả |
| --- | ---- | ------- |
| FE — phạm vi bảo hành | `npx vitest run src/modules/warranty src/test/wwhn-247-warranty-closure.test.ts src/test/warranty-v17-fail-closed.test.ts` | **8 file / 59 test — PASS** |
| FE — toàn bộ | `npx vitest run` | **543/543 PASS** tại thời điểm tạo commit candidate |
| BE — luồng 04 | `php vendor/bin/phpunit --filter "Warranty\|Wwhn244\|Wwhn247"` | **58 test / 54 pass / 3 skip / 1 fail** |
| Gate | `npm run verify:wwhn-247` | **PASS** — dependency HN-WAR-001 = VERIFIED |

Hai fixture BE từng đỏ đã được sửa: `WarrantyFlow04DocsAlignmentTest` và
`WarrantyIdempotencyKeyContractTest` chuyển `CHECKING → REPAIRING` mà không gửi `confirmed_defect`
— hợp lệ trước khi guard DEC-WAR-STATE-001 tồn tại, nay trả 422 và làm hỏng chính happy path mà hai
test cần dựng. Ở test idempotency, payload lần gọi đầu và lần retry phải **giống hệt** nhau, nếu
không idempotency trả 409 thay vì replay.

**Một fail còn lại không thuộc WWHN-247:**
`CurrentBaselineFlowContractSourceTest::test_warranty_label_and_pv_rules_are_pinned` đỏ ở hai
assertion chuỗi PV catalog `where('p.published', true)` và `where('s.status', 'ACTIVE')`. Cả hai vẫn
tồn tại ở BE HEAD `08abf3f` (`git show HEAD:… | grep -c` = 4); chúng chỉ bị gỡ trong thay đổi **chưa
commit** của phiên WWHN-330 chạy song song trên cùng worktree. Không file nào liên quan nằm trong
commit WWHN-247.

Tương tự ở FE: chạy lại toàn bộ trên worktree hiện tại cho 2 fail ở
`src/modules/inventory/components/TraceModal.test.tsx` — `TraceModal.tsx` và bộ `shared/components`
ui-state đang là thay đổi chưa commit của phiên song song, không thuộc luồng 04.

---

## 6. P1-03 · Ma trận trạng thái

Chi tiết đầy đủ ở [`docs/evidence/WWHN-247/STATUS_MATRIX.md`](../evidence/WWHN-247/STATUS_MATRIX.md).

Điểm cốt lõi: cùng một state machine từng được khai ở **ba** nơi và mỗi nơi chỉ tự test chính mình,
nên khi một nơi đổi thì không nơi nào đỏ. `WARRANTY_NEXT_STATUS` của FE thiếu cạnh
`CHECKING → COMPLETED`; `CurrentBaselineOperationsController::WARRANTY_TRANSITIONS` giữ nguyên ma trận
cũ. Cạnh thiếu không chỉ là bất tiện: case kiểm tra xong kết luận không cần sửa bị ép đi vòng qua
`REPAIRING` giả sẽ thổi phồng metric turnaround "đã sửa chữa" của RPT-WAR-01.

Nay cả ba trùng khít và có ba lớp canh: test parity phía BE, test ma trận phía FE, và verifier đọc
chéo hai repo.

---

## 7. Ranh giới sự thật — những gì hồ sơ này **không** khẳng định

- FE chỉ là lớp phòng thủ thứ hai cho PII. Backend vẫn là authority, vẫn phải mask khi đọc và 403 khi
  ghi thiếu `warranty.pii.view`.
- Mask ở client idempotent nên không làm sai hiển thị, nhưng **không** khôi phục được giá trị thật cho
  actor có quyền nếu backend đã mask.
- Handler warranty trong `CurrentBaselineOperationsController` vẫn là code chết. Commit này chỉ đồng bộ
  hằng số; gỡ hẳn cần CR riêng vì đụng test pin nguồn.
- `e2e/warranty-flow04-evidence.spec.ts` chạy với API mock. Chuỗi runtime thật nằm ở
  `warranty-flow04-live-runtime.spec.ts`, cần `E2E_LIVE_RUNTIME=1` với BE + DB thật.
- Chữ ký BA lên bảng ma trận (`STATUS_MATRIX.md` §5) là hạng mục **quy trình** còn lại, không phải
  hạng mục kỹ thuật.

## 8. Vòng R2 — review 89/100 (19/08/2026)

- Register FE247-P1-01..04 / P2-01..02 đóng tại
  `docs/evidence/WWHN-247/WWHN-247_R2_CLOSURE.md`; QA2 độc lập (WWHN-248) tại
  `docs/evidence/WWHN-248/QA2_TEST_REPORT.md` — verdict **ACCEPTED**, 16/16 e2e PASS,
  12 screenshot.
- **Nhánh canonical là `m1`** — không tồn tại nhánh `m1ee`/`m1ee/m1`; mọi tham chiếu như
  vậy trong prompt/review cũ là sai chính tả (FE247-P2-01, cùng mẫu FE217-P2-01/FE242-P2-02/
  FE296-P2-01). Mọi trích dẫn nguồn dùng `m1` + exact SHA 40 ký tự.
- Candidate R2: FE warranty-scope `c9f52df44638558cc3c2e08807e05a9d05f689c8`, FE HEAD lúc
  chạy `ebdb061098bea9426c2949e5c50b53ba8a09289f`, BE HEAD
  `4a6965b5d432947c497a2c3370a62a17907251a3`. `STATUS_MATRIX.md` stamp **v1.1** cho BA Main
  sign-off trên Jira (FE247-P2-02).
