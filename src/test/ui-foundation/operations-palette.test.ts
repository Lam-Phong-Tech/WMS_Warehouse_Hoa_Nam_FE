import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERATIONS_COLORS, OPERATIONS_PALETTE } from "@/shared/ui/tokens";
import { MUI_THEMES } from "@/shared/ui/theme/mui-adapter";
import { ANTD_THEMES } from "@/shared/ui/theme/antd-adapter";

const css = readFileSync("src/shared/ui/tokens/operations.css", "utf8");
const kebab = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

describe.each(["light", "dark"] as const)("Operations palette: %s", (mode) => {
  it("keeps CSS and both UI frameworks on the same palette", () => {
    const selector = `html[data-theme="${mode}"]`;
    const block = css.slice(css.indexOf(selector)).split("}")[0];
    for (const [key, value] of Object.entries(OPERATIONS_COLORS[mode])) {
      const match = block.match(new RegExp(`--ops-${kebab(key)}:\\s*([^;]+);`));
      expect(match?.[1].trim().toLowerCase(), key).toBe(value.toLowerCase());
    }
    const p = OPERATIONS_PALETTE[mode];
    expect(MUI_THEMES[mode].palette.primary.main).toBe(p.primary);
    expect(MUI_THEMES[mode].palette.primary.contrastText).toBe(p.onPrimary);
    expect(MUI_THEMES[mode].palette.background.paper).toBe(p.bgSurface);
    expect(ANTD_THEMES[mode].token?.colorPrimary).toBe(p.primary);
    expect(ANTD_THEMES[mode].token?.colorBgContainer).toBe(p.bgSurface);
  });
});
