/**
 * Guard "no duplicate public component": các compatibility adapter (đã có bản
 * canonical cạnh tranh) bị ĐÓNG BĂNG consumer theo
 * docs/ui/vuexy-sync/allowlists/deprecated-components.json — file MỚI import
 * chúng ⇒ FAIL (dùng bản canonical @/shared/ui thay thế). Consumer GIẢM là
 * hợp lệ (migrate dần ở Part 4) — cập nhật allowlist trong cùng PR migrate.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

interface DeprecatedEntry {
  canonical: string;
  consumers: string[];
}

const manifest: { components: Record<string, DeprecatedEntry> } = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, "docs/ui/vuexy-sync/allowlists/deprecated-components.json"),
    "utf8",
  ),
);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");
    if (rel.includes(".test.") || rel.startsWith("src/test/")) continue;
    // Vùng định nghĩa adapter/design-system không tính là consumer.
    if (
      rel.startsWith("src/shared/components/") ||
      rel.startsWith("src/shared/ui/")
    )
      continue;
    if (entry.isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const files = walk(path.join(ROOT, "src"));
const importLines = new Map<string, string>(
  files.map((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    // Chỉ xét các câu import — nhắc tên trong code/comment không tính.
    const imports =
      src.match(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm) ?? [];
    return [f, imports.join("\n")];
  }),
);

describe("deprecated components — consumer bị đóng băng", () => {
  for (const [name, entry] of Object.entries(manifest.components)) {
    it(`${name} → canonical: ${entry.canonical}`, () => {
      const re = new RegExp(`\\b${name}\\b`);
      const actual = files.filter((f) => re.test(importLines.get(f) ?? ""));
      const frozen = new Set(entry.consumers);
      const newcomers = actual.filter((f) => !frozen.has(f));
      expect(
        newcomers,
        `Consumer MỚI của ${name} — dùng ${entry.canonical}`,
      ).toEqual([]);
    });
  }
});
