import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scopes = [
  "src/shared/i18n/",
  "src/shared/api/api-error",
  "src/shared/ui/forms/",
  "src/shared/utils/report-excel-style.test.ts",
  "src/shared/utils/report-excel-style.localization.test.ts",
  "src/shared/ui/components/UiAlert.localization.test.tsx",
  "src/test/i18n-",
  "src/modules/auth/components/auth-fallback-localization.test.tsx",
  "src/modules/master-data/components/feedback-localization.test.tsx",
  "src/modules/master-data/pages/SkuMasterScreen.localization.test.tsx",
  "src/modules/pv/components/PvErrorState.test.tsx",
  "src/modules/reports/import-match/ImportQualityIssuePanel.test.tsx",
  "src/modules/reports/import-match/ImportMatchReport.test.tsx",
  "src/modules/reports/recipient-agency/RecipientReturnPanel.test.tsx",
  "src/modules/outbound/components/AlignedOutboundDetailModal.i18n.test.tsx",
];
function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory()
      ? collect(name)
      : /\.(test|spec)\.[jt]sx?$/.test(name)
        ? [path.relative(root, name).split(path.sep).join("/")]
        : [];
  });
}
const all = collect(path.join(root, "src"));
for (const scope of scopes) {
  if (!all.some((file) => file.startsWith(scope)))
    throw new Error("Required localization test scope is missing: " + scope);
}
const tests = all
  .filter((file) => scopes.some((scope) => file.startsWith(scope)))
  .sort();
console.log(
  "Running " + tests.length + " localization regression files with one worker.",
);
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/vitest/vitest.mjs"),
    "run",
    ...tests,
    "--maxWorkers=1",
    ...process.argv.slice(2),
  ],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
