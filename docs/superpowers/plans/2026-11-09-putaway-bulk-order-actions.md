# Thao tác hàng loạt trên lệnh xếp khay — kế hoạch

> **Cho người thực thi:** làm theo TDD, đánh dấu `- [ ]` khi xong.

**Mục tiêu:** thêm hai nút xác nhận/hủy hàng loạt khi chọn nhiều lệnh ở tab
"Lệnh xếp khay".

**Kiến trúc:** `PutawayQueue` phát callback hai danh sách; `MvpPutawayPage`
mở hộp thoại xác nhận chung và xử lý tuần tự từng DRAFT.

**Spec:** `docs/superpowers/specs/2026-11-09-putaway-bulk-order-actions-design.md`

## Ràng buộc chung

- Không đổi API/BE; mỗi DRAFT một lần gọi.
- Giữ nguyên menu thao tác từng dòng và luồng một lệnh.
- Mọi chuỗi mới có đủ VI/EN/ZH.
- Thao tác chỉ bật khi có quyền quản lý putaway.

## Trọng tâm rà soát

- Chọn lẫn lệnh không còn DRAFT/không có version: không gửi request sai.
- Một lệnh lỗi giữa chừng: các lệnh còn lại vẫn được xử lý.
- Danh sách làm mới sau mỗi lần xác nhận/hủy: không mất ngữ cảnh hộp thoại.
- Hủy lệnh nháp dùng màu danger, không lẫn với nút xác nhận.
- Không gọi API khi không có quyền.

---

### Task 1: Nút hàng loạt trong PutawayQueue

**Files:**
- Modify: `src/modules/putaway/components/PutawayQueue.tsx`
- Modify: `src/modules/putaway/pages/putaway-queue.css`
- Test: `src/modules/putaway/components/PutawayQueue.test.tsx`
- Test: `src/modules/putaway/components/PutawayQueue.alignment.test.tsx`

**Interfaces:**
- Produces: `onConfirmMany(rows: PutawayTask[])`, `onCancelMany(rows: PutawayTask[])`.

- [ ] **Step 1: Viết test thất bại**

Tab orders, chọn 2 dòng có `draft_id`; thấy nút "Xác nhận xếp khay" và
"Hủy lệnh nháp"; bấm lần lượt gọi đúng callback với 2 dòng. Chọn 1 dòng thì
hai nút không xuất hiện.

- [ ] **Step 2: Chạy test, xác nhận fail**

`npx vitest run src/modules/putaway/components/PutawayQueue.test.tsx`

- [ ] **Step 3: Triển khai**

Thêm prop, render hai nút trong `.ptw-selection-actions` khi
`orders && selectedRows.length >= 2`; nút hủy dùng class danger.

- [ ] **Step 4: Chạy test, xác nhận pass**

`npx vitest run src/modules/putaway/components/PutawayQueue.test.tsx`

- [ ] **Step 5: Commit**

`feat(putaway): add bulk order actions`

---

### Task 2: Hộp thoại và xử lý hàng loạt trong MvpPutawayPage

**Files:**
- Modify: `src/modules/putaway/pages/MvpPutawayPage.tsx`
- Test: `src/modules/putaway/pages/MvpPutawayPage.interactions.test.tsx`
- Modify: `src/shared/i18n/messages.ts`, `messages.en.ts`, `messages.zh.ts`

**Interfaces:**
- Consumes: `onConfirmMany`, `onCancelMany`.
- Produces: `confirmMany(rows)`, `cancelMany(rows)`, hai prompt tương ứng.

- [ ] **Step 1: Viết test thất bại**

Tab orders, chọn 2 draft; bấm "Xác nhận xếp khay"; hộp thoại hiện
"Xác nhận xếp khay cho 2 BOX?"; bấm "Xác nhận" gọi `confirmPutawayTask` hai
lần đúng id/version. Làm tương tự với "Hủy lệnh nháp". Thêm ca một lệnh lỗi
nhưng lệnh còn lại vẫn được gọi.

- [ ] **Step 2: Chạy test, xác nhận fail**

`npx vitest run src/modules/putaway/pages/MvpPutawayPage.interactions.test.tsx`

- [ ] **Step 3: Triển khai**

Thêm hai handler prompt; vòng lặp tuần tự, kiểm tra stock-neutral, đếm
thành công/thất bại, toast tổng kết.

- [ ] **Step 4: Chạy test, xác nhận pass**

`npx vitest run src/modules/putaway/pages/MvpPutawayPage.interactions.test.tsx`

- [ ] **Step 5: Commit**

`feat(putaway): handle bulk confirm and cancel`

---

### Task 3: Kiểm chứng và push

- [ ] `npm run typecheck`
- [ ] `npx vitest run src/modules/putaway/components/PutawayQueue.test.tsx src/modules/putaway/components/BoxChain.test.tsx src/modules/putaway/pages/MvpPutawayPage.interactions.test.tsx src/shared/i18n/english-coverage.test.ts`
- [ ] eslint các file sửa, `git diff --check`
- [ ] Commit và push `origin/dev`
