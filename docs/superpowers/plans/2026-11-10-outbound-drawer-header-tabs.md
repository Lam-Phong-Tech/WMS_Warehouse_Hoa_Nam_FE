# Outbound Drawer Header Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, chosen by user: "tiến hành" for this session's workflow) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhóm "Chứng từ đính kèm / Sản phẩm & NFC" và nút đóng nằm cùng hàng với tiêu đề "Chi tiết phiếu xuất", dạt góc trên phải của drawer — không xuống hàng dưới như hiện tại.

**Architecture:** Sửa tầng CSS chung của `UiDrawer` header (`src/index.css`) thay `width: 100%` bằng `flex: 1 1 auto` cho title Typography, giữ `width: 100%` cho phần tử con bên trong title (bảo toàn fix `2d47662f` cho reversal-create), và ghim `headerEnd` sang phải bằng `margin-left: auto` trong `UiDialog.tsx`.

**Tech Stack:** React + MUI Drawer, plain CSS (`src/index.css`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-outbound-drawer-header-tabs-design.md`

## Global Constraints

- Không đổi nghiệp vụ, nhãn, a11y, hành vi đóng drawer; chỉ sửa layout header. (spec — Non-goals)
- Giữ `flexWrap: wrap` cho màn hẹp; headerEnd xuống hàng khi không đủ chỗ là hành vi chấp nhận. (spec)
- Giữ `width: 100%` cho `.ui-drawer-header .MuiTypography-root > span` và `> div`. (spec — Approaches)
- Không tạo CSS global mới; sửa đúng khối đã có trong `src/index.css`. (AGENTS.md / DESIGN_FOUNDATIONS §10)
- Chạy kiểm tra phù hợp phạm vi: `npm run typecheck`, test liên quan, `git diff --check`. (DESIGN_FOUNDATIONS §10)
- Commit chỉ thêm các file của thay đổi này; không đụng các file user đang sửa dở (putaway, reverse, warranty, i18n, UiSelect...).

## Review Focus

1. Reversal-create (`ReversalCreateModal`) dựa vào title stretch để ghim nút hành động trong title sang phải — thay đổi phải giữ `> span, > div { width: 100% }`. → Task 1, Step 3 test ghim điều này.
2. Drawer không có title mà chỉ có `headerEnd` — `headerEnd` phải dạt phải nhờ `margin-left: auto`. → Task 1, Step 5.
3. Màn hẹp không đủ chỗ: `headerEnd` được xuống hàng, không tràn ngang. → Giữ `flexWrap: wrap`, xác nhận bằng đọc code sau sửa (jsdom không đo được wrap).
4. Tab "Chứng từ đính kèm" / "Sản phẩm & NFC" phải thực sự nằm trong `.ui-drawer-header` (không rơi lại vào body/stepper). → Task 1, Step 4 mở rộng layout test có sẵn.
5. CSS guard test phải thất bại trước khi sửa và pass sau khi sửa — tránh test vacuous. → Task 1, Steps 1–3.

---

### Task 1: Pin outbound drawer header controls to the title row

**Files:**
- Create: `src/test/ui-drawer-header-css.test.ts`
- Modify: `src/index.css:713-720` (khối `.ui-drawer-header`)
- Modify: `src/shared/ui/components/UiDialog.tsx:117-128` (hộp bao `headerEnd`)
- Modify: `src/modules/outbound/components/AlignedOutboundDetailModal.layout.test.tsx` (thêm assertion header chứa tab)
- Test: `src/test/ui-drawer-header-css.test.ts`, `src/modules/outbound/components/AlignedOutboundDetailModal.layout.test.tsx`

**Interfaces:**
- Consumes: CSS class `ui-drawer-header` đã gắn trên header Box của `UiDrawer` (từ commit `2d47662f`).
- Produces: quy tắc `.ui-drawer-header .MuiTypography-root { flex: 1 1 auto; min-width: 0; }` — không export API nào.

- [ ] **Step 1: Viết CSS guard test thất bại**

Tạo `src/test/ui-drawer-header-css.test.ts`. Test đọc `src/index.css` (theo mẫu `src/test/report-page-css-no-universal-box-sizing.test.ts`), tách từng rule và khẳng định:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "index.css"), "utf8");

function ruleFor(selectorFragment: string): string {
  for (const chunk of css.split("}")) {
    const brace = chunk.indexOf("{");
    if (brace === -1) continue;
    if (chunk.slice(0, brace).includes(selectorFragment)) {
      return chunk.slice(brace + 1);
    }
  }
  return "";
}

describe("UiDrawer header CSS (khoang do 2026-11-10)", () => {
  it("title Typography co gian (flex) thay vì width 100% để headerEnd cùng hàng", () => {
    const body = ruleFor(".ui-drawer-header .MuiTypography-root");
    expect(body).toMatch(/flex:\s*1 1 auto/);
    expect(body).not.toMatch(/width:\s*100%/);
    expect(body).toMatch(/min-width:\s*0/);
  });

  it("phan tu con trong title van width 100% (giu ghim phai cho reversal-create)", () => {
    const child = ruleFor(".ui-drawer-header .MuiTypography-root > span");
    expect(child).toMatch(/width:\s*100%/);
    const childDiv = ruleFor(".ui-drawer-header .MuiTypography-root > div");
    expect(childDiv).toMatch(/width:\s*100%/);
  });
});
```

Lưu ý khi triển khai: nếu hai rule con (`> span` và `> div`) nằm chung một rule block như hiện tại, `ruleFor` với fragment `> span` và `> div` đều trả về cùng block đó — vẫn pass. Điều chỉnh regex fragment nếu cần để mỗi assertion thật sự soi đúng block.

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/test/ui-drawer-header-css.test.ts`
Expected: FAIL ở test đầu (hiện `width: 100%` tồn tại, `flex: 1 1 auto` chưa có); test thứ hai pass.

- [ ] **Step 3: Sửa `src/index.css`**

Thay khối:

```css
.ui-drawer-header .MuiTypography-root,
.ui-drawer-header .MuiTypography-root > span,
.ui-drawer-header .MuiTypography-root > div {
  width: 100%;
  min-width: 0;
}
```

bằng:

```css
/* Title co gian chiếm phần rộng còn lại (không ép width 100%) để headerEnd
   (tab phụ, nút đóng…) nằm cùng hàng với tiêu đề, dạt phải. */
.ui-drawer-header .MuiTypography-root {
  flex: 1 1 auto;
  min-width: 0;
}
.ui-drawer-header .MuiTypography-root > span,
.ui-drawer-header .MuiTypography-root > div {
  width: 100%;
  min-width: 0;
}
```

Run: `npx vitest run src/test/ui-drawer-header-css.test.ts`
Expected: PASS cả hai test.

- [ ] **Step 4: Ghim `headerEnd` dạt phải trong `UiDialog.tsx`**

Trong hộp `<Box>` bao `{headerEnd}` (khoảng dòng 118-128), thêm `marginLeft: "auto"` vào `sx`, giữ nguyên display/alignItems/gap/flexWrap. Đây là ghim phải khi drawer không có tiêu đề; khi có tiêu đề (title flex-grow) thì vô hại.

Mở rộng `AlignedOutboundDetailModal.layout.test.tsx` — trong test "opens the outbound detail as a right panel with grouped label actions", sau khi drawer render, thêm:

```tsx
const header = drawer?.querySelector(".ui-drawer-header");
expect(header).not.toBeNull();
expect(
  within(header as HTMLElement).getByRole("button", {
    name: translate("vi", "shared.attachments.title"),
  }),
).toBeInTheDocument();
```

(import `within` từ `@testing-library/react`; dùng `translate` đã có trong file; không dùng option `exact`.)

Run: `npx vitest run src/modules/outbound/components/AlignedOutboundDetailModal.layout.test.tsx`
Expected: PASS.

- [ ] **Step 5: Chạy bộ kiểm tra liên quan**

Run:
- `npx vitest run src/test/ui-drawer-header-css.test.ts src/modules/outbound/components/AlignedOutboundDetailModal.layout.test.tsx src/modules/outbound/components/AlignedOutboundDetailModal.drawer.test.tsx src/modules/outbound/components/AlignedOutboundDetailModal.realtime.test.tsx`
- `npm run typecheck`
- `npm run lint -- src/shared/ui/components/UiDialog.tsx src/test/ui-drawer-header-css.test.ts` (hoặc lint toàn bộ nếu cấu hình không nhận path)
- `npm run ui:tokens`
- `git diff --check`

Expected: tất cả PASS/exit 0. Nếu `ui:tokens` hoặc gate chung fail vì file ngoài phạm vi, ghi rõ nguyên nhân, không tăng baseline.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/shared/ui/components/UiDialog.tsx src/test/ui-drawer-header-css.test.ts src/modules/outbound/components/AlignedOutboundDetailModal.layout.test.tsx
git commit -m "fix(ui): keep drawer header actions on the title row, pinned right"
```

(Commit riêng `docs: add outbound drawer header spec and plan` cho hai file docs nếu muốn tách bạch; không add các file user đang sửa dở.)

**Kiểm chứng trực quan:** không đăng nhập được bản live (redirect `/login`); nếu môi trường local chạy được app với dữ liệu thật, mở drawer chi tiết phiếu xuất để xác nhận bằng mắt; nếu không, nêu rõ giới hạn trong báo cáo hoàn thành.
