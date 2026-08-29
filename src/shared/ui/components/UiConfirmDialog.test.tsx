/**
 * UiConfirmDialog — accessible name qua aria-labelledby (UiDialog auto),
 * focus vào trong dialog, Escape đóng, callback xác nhận/hủy, loading khoá
 * nút, tone danger đổi màu nút xác nhận.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiConfirmDialog } from "./UiConfirmDialog";
import { ICON_FAMILY } from "@/shared/ui/icons/icon-family";

function renderUi(node: React.ReactElement) {
  return render(<MuiThemeProvider theme={muiTheme}>{node}</MuiThemeProvider>);
}

describe("UiConfirmDialog", () => {
  it("open → dialog có accessible name = title (aria-labelledby tự động)", () => {
    renderUi(
      <UiConfirmDialog
        open
        title="Ghi sổ phiếu xuất?"
        onConfirm={() => {}}
        onClose={() => {}}
      >
        Hành động không thể hoàn tác.
      </UiConfirmDialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Ghi sổ phiếu xuất?" });
    expect(dialog).toHaveTextContent("Hành động không thể hoàn tác.");
    // Focus trap của MUI đưa focus vào trong dialog khi mở.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("nút xác nhận/hủy mặc định + gọi đúng callback", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderUi(
      <UiConfirmDialog
        open
        title="Xóa phiếu?"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape → gọi onClose", () => {
    const onClose = vi.fn();
    renderUi(
      <UiConfirmDialog
        open
        title="Xóa phiếu?"
        onConfirm={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("loading → khoá cả hai nút + spinner trên nút xác nhận", () => {
    renderUi(
      <UiConfirmDialog
        open
        title="Đang ghi sổ"
        loading
        confirmText="Ghi sổ"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Ghi sổ" });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    // Spinner canonical là glyph Flaticon (UiSpinner), không còn SVG của MUI.
    expect(
      confirm.querySelector(`.hn-spinner i.${ICON_FAMILY.prefix}-spinner`),
    ).not.toBeNull();
  });

  it("tone danger → nút xác nhận màu error", () => {
    renderUi(
      <UiConfirmDialog
        open
        title="Xóa phiếu?"
        tone="danger"
        confirmText="Xóa"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Xóa" }).className).toMatch(
      /Error/,
    );
  });

  it("đổi confirmText/cancelText", () => {
    renderUi(
      <UiConfirmDialog
        open
        title="Rời trang?"
        confirmText="Rời đi"
        cancelText="Ở lại"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Rời đi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ở lại" })).toBeInTheDocument();
  });
});
