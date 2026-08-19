# WWHN-217 — Bản ghi thực thi retest vòng 2 (đối chiếu review 80/100)

> Phục vụ FE217-P1-01/-02/-04/-05. Đây là **bản ghi thực thi** (execution record) tại exact
> candidate SHA để QA2/QA Lead/PM ký trên Jira; nó KHÔNG tự nhận là chữ ký của vai nào —
> chữ ký nằm ở Jira comment gắn account thật (xem §4 của `UI_BLOCKER_DEFECT_REGISTER.md`).

## 1. Điểm review 80/100 đã đóng trong vòng này

| Register ID | Review nói gì | Đã làm gì |
|---|---|---|
| FE217-P1-04 | "D-217-02 chưa có screen-level OUT-01 E2E" | Thêm `TC-217-BACK-OUT` vào `e2e/wwhn-217-ui-blocker-retest.spec.ts` (commit `dc0e4b5e`): mở overlay chi tiết OUT trên `/outbound` @375×812 → Back đóng overlay, KHÔNG rời `/outbound`. Trace matrix D-217-02 đã trỏ sang TC này (hợp đồng hook giữ vai trò tầng đơn vị). |
| FE217-P1-03 | "Exact SHA tồn tại nhưng m1 đã đi tiếp khỏi candidate" | Re-pin candidate = `dc0e4b5e79d706bceba4db4e7a5adb44ef4490fc` (commit cuối chạm `runtimeArtifacts`). Cổng `wwhn-217:verify` cưỡng chế bất biến: mọi commit sau candidate KHÔNG được chạm artifact — m1 trôi bao xa cũng không làm evidence sai, đụng artifact là pin đỏ. Xem `supersededCandidates`/`rangeInvariant` trong `WWHN-217_PINS.json`. |
| FE217-P1-01/-02/-05 | Evidence có thật nhưng thiếu xác nhận độc lập QA2/QA Lead/PM; WWHN-216 vẫn Blocked | Register bổ sung §4 Sign-off (vai nào ký cái gì, ở đâu). Bộ retest 20 TC chạy lại toàn bộ tại exact candidate (bảng §2). Phần ký là Jira comment của từng vai — ngoài phạm vi repo. |

## 2. Thực thi tại exact candidate SHA

- **Candidate:** `dc0e4b5e79d706bceba4db4e7a5adb44ef4490fc` (nhánh `m1`)
- **Cách chạy:** `npm run wwhn-217:evidence -- --sha=dc0e4b5e…` — worktree detached tại đúng
  SHA (không dính rác working tree của các phiên song song), raw log + manifest tại
  `docs/evidence/WWHN-217/dc0e4b5e79d706bceba4db4e7a5adb44ef4490fc/`.
- **Kết quả gate:** xem bảng dưới (điền từ `gate-results.json` của lần chạy này).
- **Ghi chú môi trường (minh bạch):** hai lượt chạy đầu bị chết giữa chừng bởi race port
  5173 — nhánh `m1` có nhiều phiên chạy gate song song, `reuseExistingServer: true` khiến
  playwright của lượt này mượn dev server của phiên khác rồi bị giết theo khi phiên đó xong
  (raw: `ERR_CONNECTION_REFUSED`, chính `TC-217-BACK-OUT` vẫn PASS trước khi server chết).
  Lượt chốt evidence chạy e2e qua `E2E_BASE_URL=http://127.0.0.1:5317` — vite dựng riêng từ
  một worktree detached **tại đúng candidate SHA**, không chung port với phiên nào.

| Gate | Kết quả | Chi tiết |
|---|---|---|
| `lint` | PASS | 33s |
| `typecheck` | PASS | 46s |
| `unit` | FAIL — **đỏ có trước, không do WWHN-217** | 755/758 pass; 3 test đỏ (2 × WWHN-233 pin-rot, 1 × WWHN-260 OpenAPI pin) **đỏ y nguyên tại commit cha `ebdb061098be`** — raw đối chứng `parent-gate-unit.log` |
| `build` | PASS | 19s |
| `e2e-wwhn-217` | **PASS 20/20** | 19 TC vòng 1 + `TC-217-BACK-OUT` mới; screenshot + metadata từng TC tại `test-results/wwhn-217/dc0e4b5e…/` |

**Verdict runner:** `wwhn217Verdict = PASS`, `evidenceValidity = VALID_AT_EXACT_SHA_WITH_PREEXISTING_FAILURES`
(`overallResult` vẫn ghi FAIL đúng sự thật của nhánh — không có cơ chế "bỏ qua"; xem
`gate-results.json` trong thư mục evidence của candidate).

## 3. Ranh giới sự thật (giữ nguyên từ vòng 1)

- Suite e2e chứng minh hành vi FE trên API mock có kiểm soát; vế cưỡng chế backend nằm ở
  `runtime-error-contract.json` (sinh từ HTTP thật, phủ 401/403/409/422, cả 3 luồng).
- Đây không phải UAT thiết bị vật lý. Khi QA2 thực thi chu kỳ WWHN-216 trên thiết bị thật,
  bộ TC-217-* này là kịch bản chạy lại được tại đúng SHA.
