import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { rowActivationProps } from "./row-activation";

function Harness({
  onActivate,
  enabled = true,
}: {
  onActivate: () => void;
  enabled?: boolean;
}) {
  return (
    <table>
      <tbody>
        <tr {...rowActivationProps(onActivate, enabled)}>
          <td>
            <span>Row content</span>
            <button type="button">Row button</button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

describe("rowActivationProps", () => {
  it("activates the row from a normal cell click", () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);
    fireEvent.click(screen.getByText("Row content"));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("does not activate when a nested control is clicked", () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);
    fireEvent.click(screen.getByRole("button", { name: "Row button" }));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("supports Enter and Space from the focused row, not from nested content", () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);
    const row = screen.getByRole("row");
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    fireEvent.keyDown(screen.getByRole("button", { name: "Row button" }), {
      key: "Enter",
    });
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it("stays inert when disabled", () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} enabled={false} />);
    fireEvent.click(screen.getByText("Row content"));
    fireEvent.keyDown(screen.getByRole("row"), { key: "Enter" });
    expect(onActivate).not.toHaveBeenCalled();
    expect(screen.getByRole("row")).not.toHaveAttribute("data-clickable");
  });
});
