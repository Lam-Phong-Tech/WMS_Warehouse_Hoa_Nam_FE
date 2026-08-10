#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(
  root,
  "docs/evidence/format-baseline/known-prettier-debt.json",
);
const prettierPath = join(root, "node_modules/prettier/bin/prettier.cjs");

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
if (!Array.isArray(baseline.knownDebt)) {
  console.error(
    "[format-baseline] Invalid baseline schema: knownDebt must be an array.",
  );
  process.exit(1);
}

const invalidDebt = baseline.knownDebt.find(
  (item) =>
    !item ||
    typeof item !== "object" ||
    typeof item.path !== "string" ||
    item.path.trim() === "" ||
    typeof item.blobPrefix !== "string" ||
    item.blobPrefix.trim() === "",
);
if (invalidDebt) {
  console.error(
    `[format-baseline] Invalid knownDebt entry: ${JSON.stringify(invalidDebt)}`,
  );
  process.exit(1);
}

const knownDebt = new Map(
  baseline.knownDebt.map((item) => [
    item.path.replaceAll("\\", "/"),
    item,
  ]),
);
if (knownDebt.size !== baseline.knownDebt.length) {
  console.error("[format-baseline] Duplicate knownDebt path is not allowed.");
  process.exit(1);
}

const prettier = spawnSync(
  process.execPath,
  [prettierPath, "--list-different", "src/**/*.{ts,tsx,css}"],
  { cwd: root, encoding: "utf8" },
);

if (![0, 1].includes(prettier.status ?? -1)) {
  console.error(prettier.stderr || prettier.stdout);
  process.exit(prettier.status ?? 1);
}

const different = (prettier.stdout ?? "")
  .split(/\r?\n/u)
  .map((value) => value.trim().replaceAll("\\", "/"))
  .filter(Boolean)
  .map((path) => relative(root, join(root, path)).replaceAll("\\", "/"));

const unexpected = different.filter((path) => !knownDebt.has(path));
if (unexpected.length > 0) {
  console.error(
    `[format-baseline] New Prettier drift is not allowed:\n- ${unexpected.join("\n- ")}`,
  );
  process.exit(1);
}

for (const path of different) {
  const expected = knownDebt.get(path);
  const hash = spawnSync("git", ["hash-object", path], {
    cwd: root,
    encoding: "utf8",
  });
  if (hash.status !== 0) {
    console.error(`[format-baseline] Cannot hash ${path}: ${hash.stderr}`);
    process.exit(1);
  }
  const actual = hash.stdout.trim();
  if (!actual.startsWith(expected.blobPrefix)) {
    console.error(
      `[format-baseline] ${path} changed while still unformatted. Expected blob prefix ${expected.blobPrefix}, received ${actual}. Format the file instead of expanding debt.`,
    );
    process.exit(1);
  }
}

console.log(
  `[format-baseline] PASS: no new formatting drift; ${different.length} unchanged baseline-debt file(s) remain, ${knownDebt.size - different.length} were cleaned.`,
);
