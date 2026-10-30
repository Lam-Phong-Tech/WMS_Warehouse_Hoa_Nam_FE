import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionButton } from "./ActionButton";
import { ActionIconButton } from "./ActionIconButton";
import { ICON_FAMILY } from "@/shared/ui/icons/icon-family";

describe("dismiss buttons", () => {
  it.each(["cancel", "close"] as const)(
    "%s keeps a single X in the dialog header and a working text footer action",
    (kind) => {
      const onClose = vi.fn();
      render(
        <div role="dialog" aria-label="Sửa hãng">
          <ActionIconButton
            kind="close"
            label="Đóng hộp thoại"
            onClick={onClose}
          />
          <ActionButton kind={kind} onClick={onClose}>
            Hủy
          </ActionButton>
          <ActionButton kind="save">Lưu</ActionButton>
        </div>,
      );
      const footer = screen.getByRole("button", { name: "Hủy" });
      const header = screen.getByRole("button", { name: "Đóng hộp thoại" });
      expect(footer.querySelector(".MuiButton-startIcon")).toBeNull();
      expect(
        header.querySelector(`.${ICON_FAMILY.prefix}-cross`),
      ).not.toBeNull();
      expect(
        screen
          .getByRole("dialog")
          .querySelectorAll(`.${ICON_FAMILY.prefix}-cross`),
      ).toHaveLength(1);
      expect(
        screen
          .getByRole("button", { name: "Lưu" })
          .querySelector(".MuiButton-startIcon"),
      ).not.toBeNull();
      fireEvent.click(footer);
      fireEvent.click(header);
      expect(onClose).toHaveBeenCalledTimes(2);
    },
  );

  it("keeps an icon-only close action accessible", () => {
    render(<ActionButton kind="close" iconOnly aria-label="Đóng" />);
    expect(
      screen
        .getByRole("button", { name: "Đóng" })
        .querySelector(`.${ICON_FAMILY.prefix}-cross`),
    ).not.toBeNull();
  });

  it("keeps loading and disabled dismissal actions locked", () => {
    render(
      <>
        <ActionButton kind="cancel" loading>
          Đang đóng
        </ActionButton>
        <ActionButton kind="close" disabled>
          Đóng
        </ActionButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "Đang đóng" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang đóng" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Đóng" })).toBeDisabled();
  });
});
