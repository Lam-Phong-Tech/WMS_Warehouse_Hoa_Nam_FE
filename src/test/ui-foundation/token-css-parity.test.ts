/**
 * Parity contract: css-vars.css (mirror CSS) phải khớp TỪNG GIÁ TRỊ với
 * canonical TS tokens; hn-motion.css phải cùng bộ số motion. Lệch = FAIL —
 * đây là cơ chế bảo đảm "một nguồn token" khi CSS không import được TS.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CONTROL,
  INK_RGB,
  MOTION,
  RADIUS,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
  Z_INDEX,
} from "@/shared/ui/tokens";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

/** Parse `--name: value;` từ 1 file CSS (gộp multi-line, bỏ comment). */
function parseCssVars(css: string): Record<string, string> {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Record<string, string> = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(noComments))) {
    out[m[1]] = m[2].replace(/\s+/g, " ").trim().toLowerCase();
  }
  return out;
}

const norm = (v: string | number) =>
  String(v).replace(/\s+/g, " ").trim().toLowerCase();

describe("css-vars.css ↔ TS tokens parity", () => {
  const vars = parseCssVars(read("src/shared/ui/tokens/css-vars.css"));

  const expected: Record<string, string | number> = {
    "--wms-font-family": TYPOGRAPHY.fontFamily,
    "--wms-font-size-body": `${TYPOGRAPHY.fontSizeBody}px`,
    "--wms-font-size-secondary": `${TYPOGRAPHY.fontSizeSecondary}px`,
    "--wms-primary": S.primary,
    "--wms-primary-dark": S.primaryDark,
    "--wms-primary-light": S.primaryLight,
    "--wms-primary-soft": S.primarySoft,
    "--wms-on-primary": S.onPrimary,
    "--wms-secondary": S.secondary,
    "--wms-secondary-dark": S.secondaryDark,
    "--wms-secondary-soft": S.secondarySoft,
    "--wms-success": S.success,
    "--wms-success-dark": S.successDark,
    "--wms-success-soft": S.successSoft,
    "--wms-success-text": S.successText,
    "--wms-warning": S.warning,
    "--wms-warning-dark": S.warningDark,
    "--wms-warning-soft": S.warningSoft,
    "--wms-warning-text": S.warningText,
    "--wms-error": S.error,
    "--wms-error-dark": S.errorDark,
    "--wms-error-soft": S.errorSoft,
    "--wms-error-text": S.errorText,
    "--wms-info": S.info,
    "--wms-info-dark": S.infoDark,
    "--wms-info-soft": S.infoSoft,
    "--wms-info-text": S.infoText,
    "--wms-bg-canvas": S.bgCanvas,
    "--wms-bg-surface": S.bgSurface,
    "--wms-bg-subtle": S.bgSubtle,
    "--wms-text-strong": S.textStrong,
    "--wms-text-high": S.textHigh,
    "--wms-text-medium": S.textMedium,
    "--wms-text-disabled": S.textDisabled,
    "--wms-border": S.border,
    "--wms-border-input": S.borderInput,
    "--wms-divider": S.divider,
    "--wms-focus-ring": S.focusRing,
    "--wms-shadow-card": S.shadowCard,
    "--wms-shadow-floating": S.shadowFloating,
    "--wms-ink-rgb": INK_RGB,
    "--wms-radius-control": `${RADIUS.control}px`,
    "--wms-radius-card": `${RADIUS.card}px`,
    "--wms-radius-sheet": `${RADIUS.sheet}px`,
    "--wms-radius-pill": `${RADIUS.pill}px`,
    "--wms-control-height": `${CONTROL.height}px`,
    "--wms-control-height-touch": `${CONTROL.heightTouch}px`,
    "--wms-grey-100": S.grey100,
    "--wms-grey-200": S.grey200,
    "--wms-grey-300": S.grey300,
    "--wms-grey-500": S.grey500,
    "--wms-motion-instant": `${MOTION.duration.instant}ms`,
    "--wms-motion-fast": `${MOTION.duration.fast}ms`,
    "--wms-motion-normal": `${MOTION.duration.normal}ms`,
    "--wms-motion-slow": `${MOTION.duration.slow}ms`,
    "--wms-ease-standard": MOTION.easing.standard,
    "--wms-ease-out": MOTION.easing.out,
    "--wms-ease-in": MOTION.easing.in,
    "--wms-z-header": Z_INDEX.header,
    "--wms-z-sidebar": Z_INDEX.sidebar,
    "--wms-z-dropdown": Z_INDEX.dropdown,
    "--wms-z-pwa": Z_INDEX.pwaBanner,
    "--wms-z-loading": Z_INDEX.blockingLoading,
  };

  it("mọi biến kỳ vọng tồn tại và đúng giá trị", () => {
    const mismatches: string[] = [];
    for (const [name, value] of Object.entries(expected)) {
      if (!(name in vars)) mismatches.push(`${name}: THIẾU trong css-vars.css`);
      else if (vars[name] !== norm(value))
        mismatches.push(`${name}: css="${vars[name]}" ≠ ts="${norm(value)}"`);
    }
    expect(mismatches).toEqual([]);
  });

  it("css-vars.css không chứa biến lạ ngoài hợp đồng", () => {
    const extra = Object.keys(vars).filter((k) => !(k in expected));
    expect(extra).toEqual([]);
  });
});

describe("hn-motion.css ↔ MOTION parity", () => {
  const vars = parseCssVars(read("src/styles/hn-motion.css"));
  it("cùng bộ số duration/easing", () => {
    expect(vars["--hn-dur-instant"]).toBe(`${MOTION.duration.instant}ms`);
    expect(vars["--hn-dur-fast"]).toBe(`${MOTION.duration.fast}ms`);
    expect(vars["--hn-dur"]).toBe(`${MOTION.duration.normal}ms`);
    expect(vars["--hn-dur-slow"]).toBe(`${MOTION.duration.slow}ms`);
    expect(vars["--hn-ease"]).toBe(norm(MOTION.easing.standard));
    expect(vars["--hn-ease-out"]).toBe(norm(MOTION.easing.out));
    expect(vars["--hn-ease-in"]).toBe(norm(MOTION.easing.in));
  });
});
