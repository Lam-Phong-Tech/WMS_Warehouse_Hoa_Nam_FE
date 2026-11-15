import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.tsx?$/.test(path) && !/\.(test|spec)\./.test(path)
        ? [path]
        : [];
  });
}

it("subscribes to the full language so EN and ZH changes reach legacy inline copy", () => {
  const violations = ["src/modules", "src/app", "src/shared"]
    .flatMap(sourceFiles)
    .flatMap((path) => {
      const source = readFileSync(path, "utf8");
      // A boolean selector hides EN↔ZH (or VI↔ZH) changes from React even when
      // localizedEnglish/tStatic correctly knows all three translations.
      return /useLanguageStore\(\s*\(?\w+\)?\s*=>\s*\w+\.language\s*[!=]==?/.test(
        source,
      )
        ? [relative(process.cwd(), path)]
        : [];
    });
  expect(violations).toEqual([]);
});

it("localizes backend message columns without touching adjacent source data columns", () => {
  const violations = ["src/modules", "src/app", "src/shared/components"]
    .flatMap(sourceFiles)
    .flatMap((path) => {
      const source = readFileSync(path, "utf8");
      // Error/scan message columns are server prose. Names, values, field IDs,
      // notes and reason fields deliberately do not belong to this guard.
      return /render:\s*\(?\w+\)?\s*=>\s*\w+\.message\s*(?:,|\|\||\?\?)/.test(
        source,
      )
        ? [relative(process.cwd(), path)]
        : [];
    });
  expect(violations).toEqual([]);
});
