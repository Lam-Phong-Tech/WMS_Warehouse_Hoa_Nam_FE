# WWHN-248 — QA2 Independent Test Report cho WWHN-247 (Luồng 04 · Bảo hành FE)

| Trường | Giá trị |
|---|---|
| Ngày chạy | 19/08/2026 |
| Vai trò | QA2 — retest ĐỘC LẬP (đóng FE247-P1-01, FE247-P1-02) |
| Nhánh | `m1` (canonical — không tồn tại nhánh `m1ee`; mọi tham chiếu `m1ee`/`m1ee/m1` trong prompt/review cũ là sai chính tả, xem FE247-P2-01) |
| FE HEAD lúc chạy | `ebdb061098bea9426c2949e5c50b53ba8a09289f` |
| FE candidate (warranty-scope, commit cuối chạm phạm vi) | `c9f52df44638558cc3c2e08807e05a9d05f689c8` |
| Bất biến dải FE | `git diff --stat c9f52df..ebdb061 -- src/modules/warranty src/test/wwhn-247-warranty-closure.test.ts` = **rỗng** (đã kiểm 19/08) |
| BE HEAD lúc chạy | `4a6965b5d432947c497a2c3370a62a17907251a3` |
| BE commit cuối chạm artifact warranty | `0142b49ed11ac410136ca96993b3fb6ca2ac2971` (WWHN-234 — chỉ refactor import trong ParityTest + bản sao unrouted; ma trận GIỮ NGUYÊN, khoá bởi `Wwhn247WarrantyStateMachineParityTest` chạy PASS bên dưới) |
| **Kết luận QA2** | **ACCEPTED** |

## 1. Tính độc lập của lượt QA2

- Spec QA2 là file **mới, viết riêng cho lượt này**: `e2e/wwhn-248-warranty-qa2.spec.ts` —
  fixture riêng (case `BH-QA2-*`, PII thô cố ý `Đỗ Thị Hồng Gấm`/`0912345678`), kịch bản
  riêng (mô phỏng hồi quy BE trả PII thô; 500 bền để vượt qua auto-retry của query-client;
  409 từ BE), **không copy** e2e của DEV (`warranty-flow04-evidence.spec.ts`).
- QA2 đồng thời chạy lại spec của DEV để đối chứng — cả hai đều chạy trên cùng exact
  candidate ghi ở bảng trên.

## 2. Lệnh chạy + kết quả tổng

```
npx playwright test e2e/wwhn-248-warranty-qa2.spec.ts e2e/warranty-flow04-evidence.spec.ts --project=chromium
→ 16 passed (1.2m) — 12 test QA2 + 4 test DEV, 0 failed
```

Bổ trợ (cùng ngày, cùng candidate — log chi tiết ở `docs/evidence/WWHN-247/WWHN-247_R2_CLOSURE.md`):

```
npx vitest run src/modules/warranty src/test/wwhn-247-warranty-closure.test.ts src/test/warranty-v17-fail-closed.test.ts
→ 8 files / 59 tests PASS
npm run verify:wwhn-247            → PASS (đọc chéo BE thật; HN-WAR-001 = VERIFIED)
BE: phpunit 9 file warranty        → 46 tests / 44 passed / 2 skipped (driver-guard) / 501 assertions
```

## 3. Ma trận kết quả (đúng danh mục FE247-P1-02)

| # | Hạng mục review yêu cầu | Test (QA2 spec trừ khi ghi khác) | Kết quả | Ảnh |
|---|---|---|---|---|
| 1 | Loading state | `loading: dải ui-state-loading-table hiện trong lúc chờ API` — hook ổn định `data-testid="ui-state-loading-table"` (hợp đồng WWHN-268), biến mất khi có dữ liệu | PASS | `screenshots/qa2-state-loading.png` |
| 2 | Empty state | `empty: bảng rỗng...` — `ui-state-empty-table` + copy "Không có case bảo hành theo bộ lọc hiện tại" + CÒN nguyên nút Tiếp nhận (empty ≠ dead-end) | PASS | `screenshots/qa2-state-empty.png` |
| 3 | Error state | `error + retry: list 500...` — 500 bền (≥2 lần vì query-client tự retry 5xx đúng 1 lần), alert `data-ui-state="error"` + nút Thử lại phục hồi được dữ liệu; envelope lỗi mang `request_id` WWHN-248-QA2-LIST-500 | PASS | `screenshots/qa2-state-error.png` |
| 4 | Success state | `CHECKING chỉ mở đúng 3 cạnh...` — toast `[data-sonner-toast][data-type="success"]` sau transition thành công (hợp đồng UI_STATE ánh xạ SUCCESS → sonner) | PASS | `screenshots/qa2-transition-success.png` |
| 5 | TEMP_ONLY | Intake TEMP_ONLY (spec DEV — Idempotency-Key `fe:warranty-create:*`, stock-neutral) + detail QA2: alert `Mã tạm: TEMP-QA2-77 · sales_trace_status = NOT_TRACEABLE`, không link item gốc, không sinh movement (AC-SRS-016) | PASS | `screenshots/qa2-terminal-temp-only.png` |
| 6 | Transition guards | Dropdown CHECKING = đúng {Đang sửa chữa, Đã hoàn tất xử lý, Đã hủy} — khớp ma trận DEC-WAR-STATE-001 kể cả cạnh CHECKING→COMPLETED; thiếu `confirmed_defect`/`note` bị chặn NGAY TẠI FORM (0 request bắn ra); đủ bằng chứng → POST `/warranty-cases/:id/status` kèm `If-Match: 2` + `Idempotency-Key: fe:warranty-update-*`, payload đúng {status, confirmed_defect, note}; BE 409 STATE_CONFLICT hiển thị Alert TRONG modal + toast lỗi, không nuốt; terminal RETURNED: nút cập nhật bị `disabled` | PASS | `screenshots/qa2-transition-guard-blocked.png`, `qa2-transition-success.png` |
| 7 | 403 | Thiếu `warranty.manage` → điều hướng `/errors/403`, thông điệp "Không có quyền truy cập" | PASS | `screenshots/qa2-rbac-403.png` |
| 8 | PII masked (fail-closed) | **Mô phỏng hồi quy**: BE trả PII thô, không khai `pii_masked`; actor thiếu `warranty.pii.view` → list + detail chỉ hiện `Đ*** T*** H*** G***` / `*******678` / `***, Hà Nội`; **assert DOM không chứa chuỗi thô** (`page.content()` not-contain cả 3 giá trị); banner che hiện ở cả 2 màn | PASS | `screenshots/qa2-pii-masked-fail-closed.png` |
| 9 | PII full-view | Có `warranty.pii.view` + BE `pii_masked=false` → thấy đủ tên/SĐT/địa chỉ thật, KHÔNG có banner che | PASS | `screenshots/qa2-pii-full-view.png` |
| 10 | Responsive desktop/mobile | 360×800 / 768×1024 / 1440×900 (Annex D: 360/768/1280+): ô quét + nút Tiếp nhận luôn hiển thị trong viewport, `scrollWidth − clientWidth ≤ 1` (trang không tràn ngang; bảng cuộn trong container riêng là hợp lệ) | PASS ×3 | `screenshots/qa2-responsive-{mobile-360,tablet-768,desktop-1440}.png` |

## 4. Phát hiện của QA2 trong lượt chạy (đã xử lý, không phải defect sản phẩm)

1. **Spec DEV rot 2 locator** — `getByRole("button", { name: "+ Tiếp nhận bảo hành" })`
   không còn khớp: antd v6 icon không đóng góp ký tự "+" vào accessible name. Nút vẫn
   tồn tại và bấm được (QA2 bấm bằng regex `/Tiếp nhận bảo hành/` xanh). Đã sửa 2 locator
   trong `warranty-flow04-evidence.spec.ts` — **không đổi assertion nghiệp vụ nào**.
2. **antd v6 không render `.ant-modal-content`** — selector modal lồng nhau phải scope
   theo `.ant-modal` + title; ghi lại đây để spec sau không dẫm lại.
3. **query-client retry 5xx đúng 1 lần** (by design) — mock error phải fail bền, nếu
   không trạng thái error không bao giờ hiện. Không phải bug; là hành vi đã cam kết
   trong `src/app/providers/query-client.ts`.

## 5. Phạm vi & ranh giới

- E2e chạy với **API mock theo envelope chuẩn** (đúng mô hình evidence spec của luồng 04);
  hợp đồng FE↔BE thật được neo bởi `npm run verify:wwhn-247` (đọc chéo route/permission/
  ma trận từ mã nguồn BE) + bộ BE phpunit 46 test chạy cùng ngày. Chuỗi live-runtime
  (`warranty-flow04-live-runtime.spec.ts`) vẫn cần môi trường `E2E_LIVE_RUNTIME=1` — ngoài
  phạm vi lượt QA2 này, đúng như ranh giới đã khai ở hồ sơ WWHN-247.
- Không chạm `.github/workflows/*`, không trigger CI — toàn bộ bằng chứng chạy local.
