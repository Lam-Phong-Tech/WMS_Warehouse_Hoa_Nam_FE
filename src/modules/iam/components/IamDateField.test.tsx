import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UiDialog } from "@/shared/ui/components/UiDialog";
import { IamDateField, type IamDateFieldProps } from "./IamDateField";

// Exercise the real picker: the global antd mock cannot cover keyboard entry,
// disabled calendar dates or focus inside the MUI dialog.
vi.unmock("antd");

const defaults: IamDateFieldProps = {
  id: "iam-test-date",
  label: "Có hiệu lực từ",
  value: "2026-09-15",
  onChange: () => undefined,
  min: "2026-09-10",
  max: "2026-09-20",
};

function DateDialog(props: Partial<IamDateFieldProps>) {
  const [value, setValue] = useState(props.value ?? defaults.value);
  return (
    <UiDialog open title="Thông tin người dùng">
      <IamDateField
        {...defaults}
        {...props}
        value={value}
        onChange={(next) => {
          setValue(next);
          props.onChange?.(next);
        }}
      />
    </UiDialog>
  );
}

describe("IamDateField", () => {
  it("keeps typed dates editable and emits the existing ISO value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateDialog onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: defaults.label });
    expect(input).toHaveValue("15/09/2026");

    await user.click(input);
    await user.clear(input);
    await user.type(input, "18/09/2026{Enter}");

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith("2026-09-18"),
    );
    expect(input).toHaveValue("18/09/2026");
  });

  it("opens the themed calendar inside the dialog and respects existing bounds", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateDialog onChange={onChange} />);
    await user.click(screen.getByRole("textbox", { name: defaults.label }));

    const dialog = screen.getByRole("dialog");
    const day = await within(dialog).findByTitle("2026-09-19");
    expect(day.closest(".hn-iam-date-popover")).not.toBeNull();
    expect(within(dialog).getByTitle("2026-09-09")).toHaveClass(
      "ant-picker-cell-disabled",
    );
    expect(within(dialog).getByTitle("2026-09-21")).toHaveClass(
      "ant-picker-cell-disabled",
    );
    await user.click(day);
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith("2026-09-19"),
    );
  });

  it("rejects an out-of-bounds typed date without changing the saved value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateDialog onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: defaults.label });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "25/09/2026{Enter}");
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalledWith("2026-09-25");
  });

  it("supports clearing an optional date", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateDialog onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: defaults.label });
    await user.click(input);
    const clearButton = input
      .closest(".ant-picker")
      ?.querySelector(".ant-picker-clear");
    expect(clearButton).not.toBeNull();
    await user.click(clearButton as HTMLElement);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(""));
  });

  it("retains disabled state and connects the field to its validation message", () => {
    render(
      <DateDialog disabled error helperText="Ngày hiệu lực không hợp lệ" />,
    );
    const input = screen.getByRole("textbox", { name: defaults.label });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Ngày hiệu lực không hợp lệ");
    expect(input).toHaveAttribute("id", defaults.id);
  });
});
