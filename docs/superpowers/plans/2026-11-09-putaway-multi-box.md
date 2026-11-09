# Xếp nhiều hộp vào một khay — kế hoạch triển khai

> **Cho người thực thi:** dùng TDD cho từng task. Đánh dấu `- [ ]` khi xong.

**Mục tiêu:** thêm luồng chọn nhiều BOX và tạo nhiều lệnh DRAFT cùng một khay,
với drawer tiêu đề "Hộp 1, Hộp 2..." và dãy card hộp nối bằng mũi tên.

**Kiến trúc:** `PutawayQueue` phát sự kiện chọn nhiều; `MvpPutawayPage` giữ
danh sách BOX đang chọn, dùng component `BoxChain` để hiển thị luồng và gọi
tuần tự `createPutawayTask` cho từng BOX. Không đổi BE.

**Công nghệ:** React + TypeScript, TanStack Query, i18n VI/EN/ZH, Vitest/RTL.

**Spec:** `docs/superpowers/specs/2026-11-09-putaway-multi-box-design.md`

## Ràng buộc chung

- Không đổi API/BE; mỗi BOX một DRAFT, cùng `to_tray_id`.
- Chỉ BOX `RECEIVED_PENDING_PUTAWAY` được tạo lệnh.
- Giữ nguyên toàn bộ hành vi một hộp hiện có.
- Mọi chuỗi mới phải có đủ VI/EN/ZH.

## Trọng tâm rà soát

- Chọn lẫn BOX đã lưu (STORED): nút nhiều hộp không được bật.
- Lỗi giữa chừng khi tạo N DRAFT: không gửi lại BOX đã tạo thành công.
- Danh sách chọn thay đổi sau khi query làm mới: drawer dùng snapshot đã chọn,
  không tự mở lại BOX khác.
- Nhiều hộp nhưng drawer hẹp: dãy card phải cuộn ngang, không làm tràn trang.
- Khay đích bị bỏ chọn/không còn khả dụng: nút tạo bị khóa.

---

### Task 1: Nút "Xếp nhiều hộp vào 1 khay" trong thanh chọn

**Files:**
- Modify: `src/modules/putaway/components/PutawayQueue.tsx`
- Modify: `src/shared/i18n/messages.ts`
- Modify: `src/shared/i18n/messages.en.ts`
- Modify: `src/shared/i18n/messages.zh.ts`
- Modify: `src/modules/putaway/pages/putaway-queue.css`
- Test: `src/modules/putaway/components/PutawayQueue.test.tsx`

**Interfaces:**
- Produces: prop `onCreateMany: (rows: PutawayTask[]) => void`.
- Produces: i18n key `putaway.queue.packMultiple`.

- [ ] **Step 1: Viết test thất bại**

Thêm test: chọn 2 checkbox BOX-01/BOX-02, thấy nút
`Xếp nhiều hộp vào 1 khay`, bấm thì `onCreateMany` nhận đúng 2 row; khi chỉ chọn
1 BOX thì nút này không xuất hiện và nút cũ vẫn gọi `onCreate`.

- [ ] **Step 2: Chạy test, xác nhận fail**

`npx vitest run src/modules/putaway/components/PutawayQueue.test.tsx`

- [ ] **Step 3: Triển khai**

Thêm prop, nhóm `.ptw-selection-actions` bọc nút nhiều hộp + nút một hộp +
"Bỏ chọn". Nút nhiều hộp chỉ render khi `selectedRows.length >= 2` và mọi row
`RECEIVED_PENDING_PUTAWAY`; disabled khi `!canManage`. Thêm CSS giữ nhóm hành
động bên phải.

- [ ] **Step 4: Chạy test, xác nhận pass**

`npx vitest run src/modules/putaway/components/PutawayQueue.test.tsx`

- [ ] **Step 5: Commit**

`feat(putaway): add multi-box selection action`

---

### Task 2: Component BoxChain

**Files:**
- Create: `src/modules/putaway/components/BoxChain.tsx`
- Create: `src/modules/putaway/components/BoxChain.test.tsx`
- Modify: `src/modules/putaway/pages/putaway-queue.css`

**Interfaces:**
- Consumes: `PutawayTask`, `TrayOption` từ `putawayService`.
- Produces: `BoxChain({ boxes, selectedTray })`.

- [ ] **Step 1: Viết test thất bại**

Render 2 hộp + khay `TRAY-A-01`; kỳ vọng có "Hộp 1", "Hộp 2", "Khay đích",
mã BOX/SKU/số lượng/phiếu của từng hộp và mã khay. Khi `selectedTray` null,
hiện "Chưa chọn".

- [ ] **Step 2: Chạy test, xác nhận fail**

`npx vitest run src/modules/putaway/components/BoxChain.test.tsx`

- [ ] **Step 3: Triển khai**

Tạo component dùng `ol`/`li`, card hộp, mũi tên `UiIcon name="angle-small-right"`,
card khay đích. CSS dãy ngang `overflow-x:auto`, responsive chuyển dọc dưới
768px, dùng token `--ptw-*`.

- [ ] **Step 4: Chạy test, xác nhận pass**

`npx vitest run src/modules/putaway/components/BoxChain.test.tsx`

- [ ] **Step 5: Commit**

`feat(putaway): add box-chain visualization`

---

### Task 3: Drawer nhiều hộp trong MvpPutawayPage

**Files:**
- Modify: `src/modules/putaway/pages/MvpPutawayPage.tsx`
- Test: `src/modules/putaway/pages/MvpPutawayPage.interactions.test.tsx`

**Interfaces:**
- Consumes: `BoxChain`, `onCreateMany`.
- Produces: state `selectedBoxes: PutawayTask[]`; hàm `openMultiPutaway(rows)`.

- [ ] **Step 1: Viết test thất bại**

Chọn 2 BOX chờ, bấm "Xếp nhiều hộp vào 1 khay"; kỳ vọng drawer có tiêu đề
`Xếp Hộp 1, Hộp 2 vào khay`, thấy "Khay đích"; quét `TRAY-A-01`, bấm
"Tạo lệnh xếp khay"; kỳ vọng `createPutawayTask` được gọi 2 lần với 2
`box_container_id` khác nhau cùng `to_tray_id: "tray-1"`; drawer đóng.

- [ ] **Step 2: Chạy test, xác nhận fail**

`npx vitest run src/modules/putaway/pages/MvpPutawayPage.interactions.test.tsx`

- [ ] **Step 3: Triển khai**

Đổi state `selected` thành `selectedBoxes`, giữ `selected` dẫn xuất cho luồng 1
hộp. Thêm `openMultiPutaway`. Tiêu đề nhiều hộp qua key mới. Thay card thông
tin bằng `BoxChain` khi `selectedBoxes.length > 1`. `pendingQuantity` là tổng.
`createDraft` lặp tuần tự, xử lý lỗi một phần như spec.

- [ ] **Step 4: Chạy test, xác nhận pass**

`npx vitest run src/modules/putaway/pages/MvpPutawayPage.interactions.test.tsx`

- [ ] **Step 5: Commit**

`feat(putaway): create multiple box drafts into one tray`

---

### Task 4: i18n và kiểm chứng cuối

**Files:**
- Modify: `src/shared/i18n/messages.ts`, `messages.en.ts`, `messages.zh.ts`

- [ ] **Step 1: Thêm đủ khoá VI/EN/ZH**

`putaway.queue.packMultiple`, `putaway.page.dialogTitleWithBoxes`,
`putaway.page.boxNumber`, `putaway.page.trayDestination`,
`putaway.page.chainAria`, `putaway.page.draftCreatedMany`,
`putaway.page.createManyPartial`.

- [ ] **Step 2: Chạy toàn bộ kiểm chứng**

`npm run typecheck`
`npx vitest run src/modules/putaway src/shared/i18n/english-coverage.test.ts`
`npm run lint -- --quiet` (hoặc lint các file liên quan)
`npm run ui:tokens`
`git diff --check`

- [ ] **Step 3: Commit + push**

Commit các file của feature (không gồm thay đổi tray-overview đang staged sẵn),
push lên `origin/dev`.
