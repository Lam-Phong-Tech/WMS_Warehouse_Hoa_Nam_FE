import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { UiAutocomplete, type UiAutocompleteProps } from "./UiAutocomplete";

const OPTIONS = [{ value: "SUP-1", label: "NCC-001 - Honda" }];

function Host({
  filterMode,
}: {
  filterMode?: UiAutocompleteProps["filterMode"];
}) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <MuiThemeProvider theme={muiTheme}>
      <UiAutocomplete
        label="Nhà cung cấp"
        options={OPTIONS}
        value={value}
        onChange={setValue}
        filterMode={filterMode}
      />
    </MuiThemeProvider>
  );
}

describe("UiAutocomplete filterMode", () => {
  it("local mode filters options by the typed text", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const input = screen.getByLabelText("Nhà cung cấp");
    await user.type(input, "zzz");

    expect(
      screen.queryByRole("option", { name: "NCC-001 - Honda" }),
    ).toBeNull();
  });

  it("server mode keeps options returned by the caller", async () => {
    const user = userEvent.setup();
    render(<Host filterMode="server" />);
    const input = screen.getByLabelText("Nhà cung cấp");
    await user.type(input, "zzz");

    expect(
      screen.getByRole("option", { name: "NCC-001 - Honda" }),
    ).toBeInTheDocument();
  });
});
