/**
 * Provider uniqueness contract: toàn src chỉ có
 *  - 1 createTheme (mui-adapter),
 *  - 1 điểm mount ThemeProvider + ConfigProvider (AppThemeProvider),
 * ngoài các ngoại lệ khai báo trong allowlist (hiện RỖNG) và file test.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const COMPOSITION_ROOT = "src/shared/ui/theme/AppThemeProvider.tsx";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");
    if (rel.includes(".test.") || rel.startsWith("src/test/")) continue;
    if (entry.isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const files = walk(path.join(ROOT, "src"));
const contents = new Map(
  files.map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]),
);

const exceptions: { files: string[] } = JSON.parse(
  fs.readFileSync(
    path.join(
      ROOT,
      "docs/ui/vuexy-sync/allowlists/themeprovider-exceptions.json",
    ),
    "utf8",
  ),
);

describe("provider uniqueness", () => {
  it("đúng 1 createTheme tại mui-adapter", () => {
    const hits = files.filter((f) =>
      /\bcreateTheme\s*\(/.test(contents.get(f)!),
    );
    expect(hits).toEqual(["src/shared/ui/theme/mui-adapter.ts"]);
  });

  it("ThemeProvider JSX chỉ ở composition root (+ allowlist rỗng)", () => {
    const hits = files.filter((f) =>
      /<(?:Mui)?ThemeProvider\b/.test(contents.get(f)!),
    );
    expect(hits.sort()).toEqual([COMPOSITION_ROOT, ...exceptions.files].sort());
  });

  it("ConfigProvider JSX chỉ ở composition root", () => {
    const hits = files.filter((f) =>
      /<ConfigProvider\b/.test(contents.get(f)!),
    );
    expect(hits).toEqual([COMPOSITION_ROOT]);
  });

  it("antd <App> mount duy nhất trong composition root", () => {
    const hits = files.filter((f) => /<AntdApp\b/.test(contents.get(f)!));
    expect(hits).toEqual([COMPOSITION_ROOT]);
  });
});
