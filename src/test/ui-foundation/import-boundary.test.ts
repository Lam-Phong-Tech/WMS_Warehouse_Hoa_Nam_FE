/**
 * Import boundary — negative/positive tests cho matcher của bộ guard
 * (scripts/ui-guards-lib.mjs): chứng minh guard THẬT SỰ bắt vi phạm (negative)
 * và không bắt oan (positive).
 */
import { describe, expect, it } from "vitest";
import {
  findCssImports,
  findEmotionImports,
  findEngineImports,
  findForbiddenFonts,
  findHexLiterals,
  hasConfigProviderJsx,
  hasCreateTheme,
  hasThemeProviderJsx,
  looksLikeTokenSource,
} from "../../../scripts/ui-guards-lib.mjs";

describe("negative — vi phạm phải bị bắt", () => {
  it("import antd/@mui/@emotion trực tiếp", () => {
    expect(findEngineImports('import { Button } from "antd";')).toEqual([
      "antd",
    ]);
    expect(findEngineImports('import Box from "@mui/material/Box";')).toEqual([
      "@mui/material/Box",
    ]);
    expect(findEngineImports('import viVN from "antd/locale/vi_VN";')).toEqual([
      "antd/locale/vi_VN",
    ]);
    expect(findEmotionImports('import { css } from "@emotion/react";')).toEqual(
      ["@emotion/react"],
    );
  });

  it("createTheme/ThemeProvider/ConfigProvider lậu", () => {
    expect(hasCreateTheme("const t = createTheme({})")).toBe(true);
    expect(hasThemeProviderJsx("<ThemeProvider theme={t}>")).toBe(true);
    expect(hasThemeProviderJsx("<MuiThemeProvider theme={t}>")).toBe(true);
    expect(hasConfigProviderJsx("<ConfigProvider theme={cfg}>")).toBe(true);
  });

  it("hex literal + font drift", () => {
    expect(findHexLiterals('color: "#2563eb"; b: #fff')).toEqual([
      "#2563eb",
      "#fff",
    ]);
    expect(findHexLiterals('a: "#abc"; b: "#aabbccdd"')).toEqual([
      "#abc",
      "#aabbccdd",
    ]);
    expect(findForbiddenFonts('font-family: "Inter", sans-serif')).toContain(
      "Inter",
    );
    expect(findForbiddenFonts("font: Arial, Helvetica, sans-serif")).toContain(
      "Arial,Helvetica",
    );
    expect(
      findForbiddenFonts('@import url("https://fonts.googleapis.com/x")'),
    ).toContain("google-fonts");
  });

  it("nguồn token thứ hai (export UPPER_CASE >=3 hex)", () => {
    expect(
      looksLikeTokenSource(
        'export const MY_BRAND = { a: "#111111", b: "#222222", c: "#333333" };',
      ),
    ).toBe(true);
  });

  it("import CSS ngoài entrypoint", () => {
    expect(findCssImports('import "./rogue.css";')).toEqual(["./rogue.css"]);
  });
});

describe("positive — code hợp lệ không bị bắt oan", () => {
  it("import từ design system", () => {
    expect(
      findEngineImports('import { UiButton } from "@/shared/ui";'),
    ).toEqual([]);
    expect(
      findEngineImports('import { SEMANTIC_LIGHT } from "@/shared/ui/tokens";'),
    ).toEqual([]);
  });

  it("nhắc tên trong comment không phải JSX mount", () => {
    expect(hasThemeProviderJsx("// Theme lấy từ AppThemeProvider")).toBe(false);
    expect(hasConfigProviderJsx("// antd ConfigProvider nằm ở root")).toBe(
      false,
    );
  });

  it("token object không hex (đọc từ semantic) không bị coi là nguồn thứ hai", () => {
    expect(
      looksLikeTokenSource(
        "export const ACTION_ICON_COLORS = { primary: S.primary, view: S.info };",
      ),
    ).toBe(false);
  });

  it("var(--wms-*) không phải hex literal", () => {
    expect(findHexLiterals("color: var(--wms-primary);")).toEqual([]);
  });

  it("mảnh UUID trong comment không phải hex literal", () => {
    expect(
      findHexLiterals(
        "/** POST_ISSUE stock_document #ecd447d4-aae2-4f61-9c1e-0b7d52a3f9e8 */",
      ),
    ).toEqual([]);
    expect(
      looksLikeTokenSource(
        'export const NOTE = "#ecd447d4-a #ecd447d5-b #ecd447d6-c";',
      ),
    ).toBe(false);
  });
});
