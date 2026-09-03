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
  MOTION,
  NAV_COLOR,
  NAV_COLOR_DARK,
  PALETTE,
  PALETTE_KEYS,
  RADIUS,
  TYPOGRAPHY,
  Z_INDEX,
  cssVarNameOf,
} from "@/shared/ui/tokens";

/**
 * Nguồn so sánh là `PALETTE` (giá trị THÔ) chứ không phải `SEMANTIC_LIGHT`:
 * từ đợt dark mode, SEMANTIC_LIGHT là mặt tiền `var(--wms-…)` nên so nó với
 * css-vars.css là so biến với chính nó — test sẽ xanh mà chẳng chứng minh gì.
 */
const S = PALETTE.light;

/** `itemText` ⇒ `--wms-nav-item-text` — cùng quy ước với NAV_COLOR_VARS. */
function navVars(source: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      `--wms-nav-${key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`,
      value,
    ]),
  );
}

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
    // Toàn bộ nhóm màu sinh từ PALETTE — thêm token mới không phải sửa test.
    ...Object.fromEntries(
      PALETTE_KEYS.map((key) => [cssVarNameOf(key), S[key]]),
    ),
    "--wms-radius-control": `${RADIUS.control}px`,
    "--wms-radius-card": `${RADIUS.card}px`,
    "--wms-radius-sheet": `${RADIUS.sheet}px`,
    "--wms-radius-pill": `${RADIUS.pill}px`,
    "--wms-control-height": `${CONTROL.height}px`,
    "--wms-control-height-touch": `${CONTROL.heightTouch}px`,
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
    ...navVars(NAV_COLOR),
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

describe("css-vars-dark.css ↔ PALETTE.dark parity", () => {
  const vars = parseCssVars(read("src/shared/ui/tokens/css-vars-dark.css"));

  it("mọi màu của chế độ tối có mặt và đúng giá trị", () => {
    const mismatches: string[] = [];
    const expectedDark: Record<string, string> = {
      ...Object.fromEntries(
        PALETTE_KEYS.map((key) => [cssVarNameOf(key), PALETTE.dark[key]]),
      ),
      ...navVars(NAV_COLOR_DARK),
    };
    for (const [name, value] of Object.entries(expectedDark)) {
      if (!(name in vars))
        mismatches.push(`${name}: THIẾU trong css-vars-dark.css`);
      else if (vars[name] !== norm(value))
        mismatches.push(`${name}: css="${vars[name]}" ≠ ts="${norm(value)}"`);
    }
    expect(mismatches).toEqual([]);
  });

  it("không khai biến lạ ngoài bảng màu", () => {
    const allowed = new Set([
      ...PALETTE_KEYS.map(cssVarNameOf),
      ...Object.keys(navVars(NAV_COLOR_DARK)),
    ]);
    expect(Object.keys(vars).filter((k) => !allowed.has(k))).toEqual([]);
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
