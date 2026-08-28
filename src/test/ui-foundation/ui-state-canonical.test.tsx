import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { UiStateSurface } from "@/shared/ui/components/UiStateSurface";
import { UiConfirmDialog } from "@/shared/ui/components/UiConfirmDialog";
import { UI_STATE, UI_STATE_SELECTOR } from "@/shared/constants/ui-state";

/**
 * WWHN-268 trên TẦNG CANONICAL (Part 5): các bề mặt trạng thái của design
 * system phải phát `data-ui-state` — nếu ai gỡ hook khỏi UiStateSurface/
 * UiConfirmDialog, suite ui:components đỏ ngay (không đợi tới E2E wwhn-268).
 */
describe("WWHN-268 hooks trên foundation canonical", () => {
  it("UiStateSurface phát data-ui-state theo kind (no-permission → permission-denied)", () => {
    const cases: Array<
      [
        "loading" | "empty" | "error" | "no-permission",
        (typeof UI_STATE)[keyof typeof UI_STATE],
      ]
    > = [
      ["loading", UI_STATE.LOADING],
      ["empty", UI_STATE.EMPTY],
      ["error", UI_STATE.ERROR],
      ["no-permission", UI_STATE.PERMISSION_DENIED],
    ];
    for (const [kind, stateKey] of cases) {
      const { container, unmount } = render(<UiStateSurface kind={kind} />);
      expect(
        container.querySelector(UI_STATE_SELECTOR[stateKey]),
        `UiStateSurface kind="${kind}" phải phát data-ui-state="${stateKey}"`,
      ).not.toBeNull();
      unmount();
    }
  });

  it("UiConfirmDialog phát data-ui-state=confirm quanh nội dung xác nhận", () => {
    const { baseElement } = render(
      <UiConfirmDialog
        open
        title="Xóa phiếu?"
        onConfirm={() => {}}
        onClose={() => {}}
      >
        Hành động không thể hoàn tác.
      </UiConfirmDialog>,
    );
    expect(
      baseElement.querySelector(UI_STATE_SELECTOR[UI_STATE.CONFIRM]),
    ).not.toBeNull();
  });
});
