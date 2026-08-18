# WWHN-236 — Apply Adjustment: disposition DEFERRED / NO-CODE

Đóng register `DEV236-P1-01` … `DEV236-P1-07` (review 26/100).

| Field                  | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Task                   | `WWHN-236` — child of `WWHN-60`, QA gate `WWHN-238`                                   |
| Disposition            | `DISP-STK-236` — BE `docs/decision-records/DISP-STK-236-APPLY-ADJUSTMENT-DEFERRED.md` |
| Controlling source     | `REQ-SRS-037` (Must) — `docs/HN_SRS_FRD_v1.12_FULL.md`, adopt tại `WWHN-334`          |
| Kết luận               | **DEFERRED — NO CODE**. Không implement Apply Adjustment                              |
| Branch                 | `m1` (BE + FE)                                                                        |
| Trạng thái disposition | `PROPOSED` — chờ approver ghi trên Jira                                               |

---

## 1. Vì sao 26/100 — nguyên nhân gốc

Task trượt **không phải vì thiếu code**. Repo đang có **ba nguồn authority mâu thuẫn** về cùng hành vi
`apply-adjustment`, và không nguồn nào bị đánh dấu "không phải controlling":

| Nguồn                             | Nói gì                                                                                                                 | Trạng thái thật                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `REQ-SRS-037` — SRS/FRD v1.12     | **Cấm** mọi entity/API/permission/screen/report/action sửa tồn trực tiếp                                               | **ADOPTED** (WWHN-334), `Must`           |
| `DEC-STK-001` — WWHN-25           | Mô tả đủ `/stocktake-sessions/{id}/apply-adjustment`, permission `stocktake.adjust`, 4 bảng `stocktake_*`              | **PROPOSED**, no effective date          |
| `WWHN-180-posting-openapi` v1.7.0 | Khai path apply-adjustment, tag `Stocktake`, "Only Post Receipt, Post Issue **and Apply Adjustment** may change stock" | `PROPOSED`, pending independent sign-off |

Cộng thêm BRD/Handoff **v3.9** mà AC của `WWHN-60` còn trích — đã bị BRD v3.20 / SRS v1.12 thay thế.

⇒ AC của task yêu cầu implement đúng cái mà controlling source đang cấm. Task **không thể** vừa PASS AC
vừa PASS `REQ-SRS-037`. Đó là lý do điểm thấp, không phải chất lượng code.

---

## 2. Register mapping

| ID             | Sev | Kết quả                                                                                                                       | Bằng chứng                                                            |
| -------------- | --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `DEV236-P1-01` | P1  | **Đóng** — chốt `REQ-SRS-037` là authority duy nhất; `WWHN-60`/`236` = DEFERRED NO-CODE; điều kiện re-enable gồm 4 mục        | `DISP-STK-236` §1–§2                                                  |
| `DEV236-P1-02` | P1  | **Đóng** — gỡ reliance BRD/Handoff v3.9; source register đo lại được (không chép hash tay); AC parent được map sang Reversal  | `DISP-STK-236` §3, `docs/evidence/WWHN-236/SOURCE_REGISTER.json` (BE) |
| `DEV236-P1-03` | P1  | **Đóng** — `HN-STK-002` DEFERRED; ranh giới với nhánh `WWHN-233`/`235` (DISP-STK-233) ghi rõ; nêu giới hạn chưa đọc được Jira | `DISP-STK-236` §4                                                     |
| `DEV236-P1-04` | P1  | **Đóng** — publish NO-CODE handoff; task **không** ở trạng thái implementation-complete                                       | `docs/evidence/WWHN-236/NO_CODE_HANDOFF.md` (BE)                      |
| `DEV236-P1-05` | P1  | **Đóng dạng phủ định** — vì DEFERRED, nghĩa vụ là contract _không_ khai bề mặt cấm                                            | `docs/evidence/WWHN-236/CONTRACT_NEGATIVE_LOCK.json` (BE)             |
| `DEV236-P1-06` | P1  | **Đóng dạng phủ định** — không tồn tại đường ghi tồn thứ hai; `chk_stock_movement_type_current` chặn `ADJUST_*` ở DB          | test nhánh `pgsql`, `docs/evidence/WWHN-236/logs/` (BE)               |
| `DEV236-P1-07` | P1  | **Đóng** — `WWHN-238` = DEFERRED / N/A, không phải Blocked/Pending                                                            | `docs/evidence/WWHN-236/QA_DISPOSITION_WWHN-238.md` (BE)              |

---

## 3. Delta thực tế

### Capability: ZERO

Không route, controller, service, migration, model, permission, seeder, màn hình, report.

### Hàng rào

| Repo | File                                                              | Vai trò                                                                       |
| ---- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| BE   | `docs/decision-records/DISP-STK-236-APPLY-ADJUSTMENT-DEFERRED.md` | Disposition — chốt một authority                                              |
| BE   | `docs/contracts/HoaNam_Current_Baseline_Contract.json`            | **Bịt lỗ hổng**: thêm `adjustment`, `variance` vào `forbidden_path_fragments` |
| BE   | `scripts/verify-wwhn236-adjustment-disposition.mjs`               | Gate 11 check, fail-closed                                                    |
| BE   | `scripts/build-wwhn236-source-register.mjs`                       | Sinh source register đo lại được                                              |
| BE   | `tests/Feature/Wwhn236DeferredAdjustmentGateTest.php`             | 7 test                                                                        |
| FE   | `scripts/verify-wwhn-236-closure.mjs`                             | Gate 7 check                                                                  |
| FE   | `src/test/wwhn-236-adjustment-deferral-gate.test.ts`              | 4 test                                                                        |

**Lỗ hổng thật đã bịt:** trước task này `forbidden_path_fragments` chỉ có `"stocktake"`. Một route
sửa tồn đặt tên khác — `POST /api/v1/inventory/apply-adjustment` — **lọt qua toàn bộ gate hiện có**.
`REQ-SRS-037` cấm mọi action sửa tồn trực tiếp chứ không riêng action mang chữ `stocktake`.

---

## 4. Cách chạy lại bằng chứng

```bash
node scripts/verify-wwhn236-adjustment-disposition.mjs --emit-lock
```

```bash
node scripts/build-wwhn236-source-register.mjs
```

```bash
php artisan test --filter=Wwhn236DeferredAdjustmentGateTest
```

```bash
npm run wwhn-236:verify
```

```bash
npx vitest run src/test/wwhn-236-adjustment-deferral-gate.test.ts
```

Gate đã được chứng minh **fail-closed**, không chỉ chạy happy path: hai negative probe (thêm route
`inventory/apply-adjustment`; thêm `ADJUST_IN` vào `movement_types`) đều cho exit code `1`, khôi phục
xong trở lại `0`.

---

## 5. Ranh giới với nhánh chạy song song

`REQ-SRS-037` được đóng bởi **hai** nhánh khác nhau trên cùng `m1`:

```text
├── nhánh ADJUSTMENT    WWHN-60 → WWHN-236 → QA gate WWHN-238   ← DISP-STK-236 (task này)
└── nhánh COUNT/RECOUNT WWHN-59 → WWHN-233 → QA gate WWHN-235   ← DISP-STK-233
```

Task này **chỉ đọc**, không sửa artifact thuộc `WWHN-233` / `WWHN-237`
(`STOCKTAKE_GOVERNANCE_STATUS.json`, `verify-wwhn-233-closure.mjs`, WWHN-180 OpenAPI rebaseline).
Chi tiết ranh giới: `DISP-STK-236` §4, khớp `DISP-STK-233` §12.

---

## 6. Điều cần biết trước khi ký

- **Hệ quả nghiệp vụ**: MVP v1.12 không có kiểm kê vật lý. Lệch tồn chỉ phát hiện qua reconciliation
  report và chỉ sửa được bằng Reversal — tức phải truy về đúng chứng từ gốc sai. Lệch do nguyên nhân
  vật lý không gắn chứng từ (mất, hỏng, đếm sai) chỉ ghi nhận được bằng `reconciliation_incidents`,
  **không** có đường đưa số tồn về khớp thực tế. PM/PO cần xác nhận chấp nhận được về vận hành.
- **Giới hạn của bản disposition này**: phiên làm việc không truy cập được Jira (connector Atlassian
  chưa uỷ quyền), nên nội dung `HN-STK-002` và AC gốc của `WWHN-60` được suy ra từ artifact trong
  repo chứ không đọc trực tiếp từ ticket. BA cần đối chiếu lại danh sách ticket ở `DISP-STK-236` §4
  trước khi ký `DEV236-P1-03`.
- Disposition ở trạng thái `PROPOSED`; guard vẫn active bất kể trạng thái phê duyệt.

Bộ comment xác nhận: `docs/Task_docs_Jira/WWHN-236_SIGNOFF_COMMENTS.md`.
