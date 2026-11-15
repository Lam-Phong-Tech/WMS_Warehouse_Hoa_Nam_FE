import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import "./check-i18n.mjs";
import { checkSourceReview } from "./i18n-source-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const backendRoot = path.resolve(
  option("--backend-root", path.join(root, "../WMS_Warehouse_Hoa_Nam_BE")),
);
const destination = path.resolve(
  root,
  option("--report", "outputs/i18n-audit/backend-live-summary.json"),
);
const emittedPath = path.join(
  path.dirname(destination),
  "backend-emitted.json",
);
fs.mkdirSync(path.dirname(destination), { recursive: true });
if (!fs.existsSync(path.join(backendRoot, "vendor/autoload.php"))) {
  throw new Error(
    "Live backend audit requires the backend source and installed PHP dependencies: " +
      backendRoot,
  );
}
const run = spawnSync(
  option("--php", "php"),
  [
    path.join(root, "scripts/extract-backend-messages.php"),
    backendRoot,
    emittedPath,
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
if (run.error || run.status !== 0)
  throw run.error ?? new Error(run.stderr || run.stdout);
const extraction = JSON.parse(fs.readFileSync(emittedPath, "utf8"));
const module = (name) =>
  import(pathToFileURL(path.join(root, "src/shared/i18n", name)).href);
const [
  { translateBackendCatalogMessage, BACKEND_CATALOG },
  { BACKEND_MESSAGES, VALIDATION_MESSAGES },
  { BACKEND_MESSAGES_ZH, VALIDATION_MESSAGES_ZH },
  { MESSAGES_VI },
  { MESSAGES_EN },
  { MESSAGES_ZH },
] = await Promise.all([
  module("backend-message-catalog.ts"),
  module("server-message-catalog.ts"),
  module("server-message-catalog.zh.ts"),
  module("messages.ts"),
  module("messages.en.ts"),
  module("messages.zh.ts"),
]);
function flatten(tree, prefix = "", result = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const name = prefix ? prefix + "." + key : key;
    if (typeof value === "string") result[name] = value;
    else if (value && typeof value === "object") flatten(value, name, result);
  }
  return result;
}
const vi = flatten(MESSAGES_VI),
  targets = { en: flatten(MESSAGES_EN), zh: flatten(MESSAGES_ZH) };
const exact = {
  en: new Set(Object.keys(BACKEND_MESSAGES)),
  zh: new Set(Object.keys(BACKEND_MESSAGES_ZH)),
};
// A source declaration can deliberately constrain runtime parameter values.
// Check its reviewed template as well as concrete matches; runtime safety is
// covered by the catalog regression tests.
for (const [source, en, zh] of BACKEND_CATALOG) {
  if (en.trim()) exact.en.add(source);
  if (zh.trim()) exact.zh.add(source);
}
for (const [key, source] of Object.entries(vi)) {
  for (const language of ["en", "zh"])
    if (targets[language][key]?.trim()) exact[language].add(source);
}
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = Object.fromEntries(
  [
    ["en", VALIDATION_MESSAGES],
    ["zh", VALIDATION_MESSAGES_ZH],
  ].map(([language, rules]) => [
    language,
    rules.map(
      ([source]) =>
        new RegExp(
          "^" +
            source
              .split(/(\{\w+\})/)
              .map((part) =>
                /^\{\w+\}$/.test(part) ? "[\\s\\S]*?" : escape(part),
              )
              .join("") +
            "$",
          "u",
        ),
    ),
  ]),
);
function covered(message, language) {
  if (!message) return false;
  return (
    exact[language].has(message) ||
    translateBackendCatalogMessage(message, language, (value) => value) !==
      undefined ||
    templates[language].some((pattern) => pattern.test(message))
  );
}
const missing = extraction.records.filter((record) =>
  ["en", "zh"].some((language) =>
    [...new Set([record.normalized, record.source].filter(Boolean))].some(
      (message) => !covered(message, language),
    ),
  ),
);
// Generic validation templates can retain an unknown Vietnamese attribute.
// A regex match alone therefore never approves new backend prose: it must
// also belong to the source contract exercised by the runtime corpus tests.
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(root, "src/shared/i18n/backend-source-manifest.json"),
    "utf8",
  ),
);
const { unreviewed, unreviewedRuntime } = checkSourceReview(
  extraction.records,
  extraction.unresolved,
  manifest,
);
const report = {
  generatedAt: new Date().toISOString(),
  backendRoot,
  emittedVariants: extraction.records.length,
  uniqueMessages: new Set(
    extraction.records.map((record) => record.normalized ?? record.source),
  ).size,
  parseErrors: extraction.parseErrors,
  missing,
  unreviewedSources: unreviewed,
  unreviewedRuntimeExpressions: unreviewedRuntime,
  unresolvedExpressions: extraction.unresolved,
  limits: [
    "The AST scan verifies complete source-backed emission expressions, not all runtime UI states.",
    "Variable-only transport relays, user-entered notes and external exception details require producer/runtime review; they are listed as unresolved, never counted as translated.",
  ],
};
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      ...report,
      missing: missing.length,
      unreviewedSources: unreviewed.length,
      unreviewedRuntimeExpressions: unreviewedRuntime.length,
      unresolvedExpressions: extraction.unresolved.length,
      report: destination,
    },
    null,
    2,
  ),
);
if (
  missing.length ||
  unreviewed.length ||
  unreviewedRuntime.length ||
  extraction.parseErrors.length
)
  process.exitCode = 1;
