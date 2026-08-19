# WWHN-217 — UI Blocker / Defect Register

> Nguồn máy đọc được: [`UI_BLOCKER_DEFECT_REGISTER.json`](./UI_BLOCKER_DEFECT_REGISTER.json).
> Bảng dưới đây là bản đọc cho người; cổng `npm run wwhn-217:verify` kiểm tra file JSON,
> không kiểm tra bảng này — sửa JSON trước, rồi cập nhật bảng.

| Mục | Giá trị |
|---|---|
| Ticket | WWHN-217 (register item **FE217-P1-01**, đồng sở hữu với WWHN-53) |
| Nhánh | `m1` (canonical — mọi tham chiếu `m1ee` trong source register cũ là sai chính tả, xem FE217-P2-01) |
| Chu kỳ retest | WWHN-216 · temp-key **HN-QA-004-ST01** (xem FE217-P2-03) |
| Owner | FE1 + QA2 → QA Lead / PM |
| Chính sách bằng chứng | Mỗi defect có bằng chứng riêng của WWHN-217. **Không** dùng evidence của WWHN-292 / WWHN-144 / WWHN-211 làm closure thay thế; cổng `no-borrowed-evidence` chặn việc đó. |

## 1. Defect đã tìm và đã sửa

| ID | Màn | Vai | Viewport | Severity | Fix (repo · commit · file) | Retest | Trạng thái |
|---|---|---|---|---|---|---|---|
| **D-217-01** | SCR-IN-01 (IN-01 + overlay IN-02/IN-03) | Nhân viên kho | 375×812 (tái hiện cả 768/1280) | P1 · Major | FE · `2cf102d0` · `useOverlayBackDismiss.ts`, `InboundPage.tsx` | `TC-217-BACK-IN` | FIXED — RETESTED PASS |
| **D-217-02** | SCR-OUT-01 (OUT-01 + overlay OUT-REQ-01/OUT-03) | Nhân viên kho | 375×812 (tái hiện cả 768/1280) | P1 · Major | FE · `2cf102d0` · `useOverlayBackDismiss.ts`, `AlignedMvpOutboundPage.tsx` | `TC-217-BACK-OUT` (e2e mức màn hình, thêm ở `dc0e4b5e` theo review 80/100) + hợp đồng hook (`useOverlayBackDismiss.test.tsx`) | FIXED — RETESTED PASS |
| **D-217-03** | SCR-INV-01 (INV-01 + overlay INV-02/TRACE-01) | NV kho / QL kho | 375×812 (tái hiện cả 768/1280) | P1 · Major | FE · `2cf102d0` · `useOverlayBackDismiss.ts`, `InventoryPage.tsx` | `TC-217-BACK-INV` | FIXED — RETESTED PASS |
| **D-217-04** | Hợp đồng API dùng chung cho cả ba màn | Mọi vai gọi endpoint có stock effect | Không phụ thuộc viewport | P1 · Major | BE · `a6eca356` · `generate-error-code-catalog.mjs`, `HN-BE-API-002_ERROR_CODE_CATALOG.{json,md}` | `TC-217-API-409-IDEMPOTENCY` | FIXED — RETESTED PASS |

### D-217-01/02/03 — Back của trình duyệt rời hẳn màn hình đang thao tác

**Tái hiện:** vào `/inventory` rồi sang màn cần kiểm tra (để có lịch sử điều hướng) → mở
overlay (Tạo phiếu / Scan / Mở chi tiết) → bấm Back của trình duyệt hoặc nút Back cứng
trên Chrome Android.

**Mong đợi:** Back đóng overlay và giữ người dùng ở màn hub kèm bộ lọc đang dùng. Annex D
coi IN-02/IN-03, INV-02/TRACE-01, OUT-03 là lớp làm việc **trên** màn hub;
NFR-SRS-006/NFR-SRS-021 bắt buộc hỗ trợ Chrome Android — nơi Back là cử chỉ điều hướng chính.

**Thực tế:** overlay chỉ là state React và deep-link `?screen=&id=` bị tiêu thụ ngay bằng
`setSearchParams(..., { replace: true })`, nên mở overlay **không tạo history entry nào**.
Back nhảy thẳng ra khỏi màn hình; người đang quét dở một phiếu mất toàn bộ ngữ cảnh.

**Cách sửa tận gốc:** `src/shared/hooks/useOverlayBackDismiss.ts` — mở overlay push một
history entry **cùng URL** có marker; Back phát `popstate` không còn marker → đóng overlay;
đóng bằng nút trong UI → `history.back()` tiêu thụ đúng entry đã push (không để lại rác
khiến phải bấm Back hai lần). Mỗi màn gộp toàn bộ overlay vào **một** cờ để bước chuyển
giữa hai overlay không sinh cặp push/pop chồng nhau.

> Ghi chú kỹ thuật đã đo được (đừng sửa ngược): bản đầu dùng
> `useNavigate()/useLocation()` của react-router 7.18. Vì entry chèn thêm **cùng URL**,
> component có re-render với `location.state` mới nhưng effect phụ thuộc `location.state`
> **không chạy**, nên nhánh Back không bao giờ kích hoạt (đo bằng e2e probe). Nguồn sự thật
> của "người dùng vừa bấm Back" là sự kiện `popstate`, nên hook nghe thẳng ở đó.

### D-217-04 — Catalog error code thiếu `IDEMPOTENCY_CONFLICT` dù runtime phát thật

**Tái hiện:** gọi `POST /api/v1/inbound-documents/{id}/scan` hai lần với **cùng**
`Idempotency-Key` nhưng payload khác → đọc `error_code` của response 409 → tra mã đó trong
`docs/api-contract/HN-BE-API-002_ERROR_CODE_CATALOG.json`.

**Mong đợi:** runtime trả 409 `IDEMPOTENCY_CONFLICT` (một trong bốn lớp 409 bắt buộc của
SRS §8.2) và catalog hợp đồng công bố đúng mã đó ở hạng 409.

**Thực tế:** runtime trả đúng, nhưng catalog **thiếu** mã này (247 mã). Generator chỉ nhận
mã ở dạng literal cạnh HTTP status, trong khi mã này đi qua hai lớp gián tiếp —
`IdempotencyStore::CONFLICT_PAYLOAD_DIFFERS = ConflictCode::IDEMPOTENCY`, rồi gán vào biến
trong `switch ($status) { case 409: … }` của `ApiConventionMiddleware`. Hệ quả: FE đọc hợp
đồng **không biết** nhánh "phải sinh Idempotency-Key mới" tồn tại — đúng nhánh quyết định
của nhóm duplicate/retry mà register WWHN-217 yêu cầu kiểm.

**Cách sửa tận gốc:** generator phân giải hằng lớp trỏ (trực tiếp hoặc bắc cầu) về
`ConflictCode`, và suy HTTP status từ nhãn `case <status>:` gần nhất khi mã không nằm cạnh
status. Sinh lại catalog: 247 → 248 mã, `IDEMPOTENCY_CONFLICT` @409 đã có mặt.

## 2. Vùng đã retest và KHÔNG có defect

Ghi lại tường minh để không ai đọc nhầm "không có dòng trong register" thành "chưa kiểm".

| Vùng | Test case | Kết quả |
|---|---|---|
| Responsive 3 luồng × 3 viewport (NFR-SRS-006: 1280/768/375) | `TC-217-RSP-{INBOUND,OUTBOUND,INVENTORY}-{DESKTOP,TABLET,MOBILE}` | PASS — không tràn ngang, bảng dữ liệu hiển thị |
| Chặn route khi thiếu quyền | `TC-217-RBAC-{INBOUND,OUTBOUND,INVENTORY}-ENTRY` | PASS — router fail-closed sang `/errors/403` |
| 403 từ API trên màn đã vào được | `TC-217-RBAC-API-403` | PASS — hiện trạng thái không có quyền, đúng **1** request (không retry 4xx) |
| Mất mạng khi đọc / khôi phục bằng Thử lại | `TC-217-NET-READ`, `TC-217-RETRY-READ` | PASS |
| Bấm lặp; thao tác ghi khi ngoại tuyến | `TC-217-DUP-READ`, `TC-217-NET-WRITE-OFFLINE` | PASS — không bão request, không hàng đợi ghi bắn lại |
| Mã lỗi/RBAC runtime của backend | `TC-217-API-401/403/409/422-*` | PASS — xem [`runtime-error-contract.json`](./runtime-error-contract.json) |

## 3. Gate tại candidate SHA `dc0e4b5e79d706bceba4db4e7a5adb44ef4490fc` (vòng 2)

> Candidate vòng 1 `2cf102d0` (chứa toàn bộ fix) được siêu thế bởi `dc0e4b5e` — commit này
> **chỉ thêm** e2e mức màn hình `TC-217-BACK-OUT` cho D-217-02 theo review 80/100
> (FE217-P1-04), không đổi runtime fix nào. Xem `supersededCandidates` trong PINS.

| Gate | Kết quả | Ghi chú |
|---|---|---|
| `lint` | PASS | |
| `typecheck` | PASS | |
| `unit` | **FAIL — đỏ có trước, không do WWHN-217** | 755/758 pass. Ba test đỏ **đỏ y nguyên tại commit cha** `ebdb061098be` — xem `parent-gate-unit.log` |
| `build` | PASS | |
| `e2e-wwhn-217` | PASS | 20/20 TC (19 TC vòng 1 + `TC-217-BACK-OUT`) |

Ba test đỏ có trước, **chủ sở hữu không phải WWHN-217**:

| Test | Ticket sở hữu | Nguyên nhân |
|---|---|---|
| `wwhn-233-count-deferral-gate.test.ts` › digests in step (PIN ROT) | WWHN-233 / nhóm WWHN-31x | `docs/HoaNam_ERD_Moi_Nhat.md` đổi nội dung nhưng digest trong governance register chưa cập nhật |
| `wwhn-233-count-deferral-gate.test.ts` › round R2 pins the FE guard by content | WWHN-233 / nhóm WWHN-31x | Pin nội dung vòng R2 của WWHN-233 lệch file trên đĩa sau các commit song song — thuộc chu kỳ re-pin của WWHN-233 |
| `wwhn-260-migration-operational-only.test.ts` | WWHN-260 | Hợp đồng OpenAPI FE đang dùng vừa đổi; test pin của WWHN-260 chưa chạy lại |

Runner **không bỏ qua** hai lỗi này: nó chạy lại đúng gate `unit` tại commit cha trong một
worktree thứ hai và lưu log đối chứng. `overallResult` vẫn ghi `FAIL` (đúng sự thật của
nhánh); chỉ `wwhn217Verdict` mới là kết luận "WWHN-217 có làm vỡ gì không" — và nó là `PASS`.

## 4. Sign-off (FE217-P1-01 — review 80/100 yêu cầu xác nhận độc lập)

Register/retest do FE1 lập; xác nhận độc lập của từng vai được thực hiện bằng **Jira
comment** (không phải file trong repo, để chữ ký gắn với account thật của từng vai):

| Vai | Xác nhận cái gì | Nơi ký |
|---|---|---|
| QA2 | Đã đối chiếu register 4 defect + chạy/duyệt bộ retest TC-217-* tại exact candidate; xác nhận D-217-02 đã có e2e mức màn hình (`TC-217-BACK-OUT`) | Jira comment trên WWHN-216 (chu kỳ retest) |
| QA Lead | Duyệt phạm vi + chất lượng evidence của register (không làm việc mới) | Jira comment trên WWHN-217 |
| PM | Duyệt closure + chuẩn hoá Description (FE217-P2-02) | Jira comment trên WWHN-217 |

Ranh giới: sign-off là "đọc + duyệt" trên evidence có sẵn trong repo tại candidate SHA;
không ai ký thay phần UAT thiết bị vật lý (vẫn thuộc phạm vi WWHN-216 khi QA2 thực thi).

## 5. Ranh giới sự thật

- Suite e2e là bằng chứng **hành vi FE trên API mock có kiểm soát**: nó chứng minh FE gọi
  bao nhiêu lần, gửi header gì, hiển thị trạng thái gì. Nó **không** chứng minh backend
  cưỡng chế phân quyền.
- Vế cưỡng chế backend nằm ở `runtime-error-contract.json`, sinh từ HTTP thật qua middleware
  thật (SRS §8.4/WWHN-40: *UI hiding is not authorization*).
- Đây **không** phải UAT thiết bị thật của QA1 và không thay thế ma trận trình duyệt/thiết
  bị vật lý.
