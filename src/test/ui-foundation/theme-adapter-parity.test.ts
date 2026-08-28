/**
 * Parity contract: antd adapter và MUI adapter phải render CÙNG canonical
 * tokens (màu/kích thước/chữ/motion) — hai engine, một nguồn.
 */
import { describe, expect, it } from "vitest";
import { muiTheme } from "@/shared/ui/theme/mui-adapter";
import { antdTheme } from "@/shared/ui/theme/antd-adapter";
import {
  BREAKPOINTS,
  COMPONENT_TOKENS as C,
  MOTION,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui/tokens";

describe("MUI adapter ↔ tokens", () => {
  it("palette map đúng semantic", () => {
    expect(muiTheme.palette.primary.main).toBe(S.primary);
    expect(muiTheme.palette.primary.dark).toBe(S.primaryDark);
    expect(muiTheme.palette.secondary.main).toBe(S.secondary);
    expect(muiTheme.palette.success.main).toBe(S.success);
    expect(muiTheme.palette.warning.main).toBe(S.warning);
    expect(muiTheme.palette.error.main).toBe(S.error);
    expect(muiTheme.palette.info.main).toBe(S.info);
    expect(muiTheme.palette.background.default).toBe(S.bgCanvas);
    expect(muiTheme.palette.background.paper).toBe(S.bgSurface);
    expect(muiTheme.palette.text.primary).toBe(S.textHigh);
    expect(muiTheme.palette.text.secondary).toBe(S.textMedium);
    expect(muiTheme.palette.divider).toBe(S.divider);
  });

  it("shape/typography/breakpoints đúng tokens", () => {
    expect(muiTheme.shape.borderRadius).toBe(C.button.radius);
    expect(muiTheme.typography.fontFamily).toBe(TYPOGRAPHY.fontFamily);
    expect(muiTheme.typography.fontSize).toBe(TYPOGRAPHY.fontSizeBody);
    expect(muiTheme.breakpoints.values).toEqual({ ...BREAKPOINTS });
  });

  it("transitions đúng motion contract", () => {
    expect(muiTheme.transitions.duration.shortest).toBe(
      MOTION.duration.instant,
    );
    expect(muiTheme.transitions.duration.standard).toBe(MOTION.duration.normal);
    expect(muiTheme.transitions.duration.enteringScreen).toBe(
      MOTION.duration.slow,
    );
    expect(muiTheme.transitions.easing.easeInOut).toBe(MOTION.easing.standard);
  });
});

describe("antd adapter ↔ tokens", () => {
  const token = antdTheme.token!;
  it("token map đúng semantic", () => {
    expect(token.colorPrimary).toBe(S.primary);
    expect(token.colorSuccess).toBe(S.success);
    expect(token.colorWarning).toBe(S.warning);
    expect(token.colorError).toBe(S.error);
    expect(token.colorInfo).toBe(S.info);
    expect(token.colorBgLayout).toBe(S.bgCanvas);
    expect(token.colorBgContainer).toBe(S.bgSurface);
    expect(token.colorText).toBe(S.textHigh);
    expect(token.colorTextSecondary).toBe(S.textMedium);
    expect(token.colorBorder).toBe(S.borderInput);
    expect(token.colorBorderSecondary).toBe(S.border);
  });

  it("control/typography đúng component tokens", () => {
    expect(token.borderRadius).toBe(C.button.radius);
    expect(token.controlHeight).toBe(C.button.height);
    expect(token.fontSize).toBe(TYPOGRAPHY.fontSizeBody);
    expect(token.fontFamily).toBe(TYPOGRAPHY.fontFamily);
  });

  it("motion antd = motion MUI (một nguồn, hai adapter)", () => {
    expect(token.motionDurationFast).toBe(`${MOTION.duration.fast / 1000}s`);
    expect(token.motionDurationMid).toBe(`${MOTION.duration.normal / 1000}s`);
    expect(token.motionDurationSlow).toBe(`${MOTION.duration.slow / 1000}s`);
    expect(token.motionEaseInOut).toBe(MOTION.easing.standard);
  });

  it("hai engine cùng số đo control", () => {
    expect(token.controlHeight).toBe(C.button.height);
    expect(token.borderRadius).toBe(C.input.radius);
    expect(token.fontSize).toBe(C.input.fontSize);
  });
});

// Part 4: shim `@/app/theme` và `@/app/mui-theme` đã XOÁ (consumer = 0) —
// describe "shim tương thích" gỡ theo; nguồn theme duy nhất được bảo vệ bởi
// provider-uniqueness.test + check-ui-architecture.
