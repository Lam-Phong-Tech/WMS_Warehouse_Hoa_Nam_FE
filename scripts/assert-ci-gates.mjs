#!/usr/bin/env node

const gateNames = [
  "FORMAT_OUTCOME",
  "LINT_OUTCOME",
  "TYPECHECK_OUTCOME",
  "UNIT_TEST_OUTCOME",
  "ENV_CONTRACT_OUTCOME",
  "UAT_CONTRACT_OUTCOME",
  "WWHN_165_OUTCOME",
  "WWHN_156_OUTCOME",
  "SMOKE_CONTRACT_OUTCOME",
  "MASTER_SKU_OUTCOME",
  "WMS_CONTRACT_OUTCOME",
  "WWHN_148_OUTCOME",
  "WWHN_144_OUTCOME",
  "BUILD_OUTCOME",
  "HEALTH_OUTCOME",
  "API_MAPPING_OUTCOME",
  "PLAYWRIGHT_INSTALL_OUTCOME",
  "RUNTIME_EVIDENCE_OUTCOME",
  "WWHN_144_E2E_OUTCOME",
];

const failures = gateNames
  .map((name) => ({ name, outcome: process.env[name] ?? "missing" }))
  .filter(({ outcome }) => outcome !== "success");

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[ci-gate] ${failure.name}: ${failure.outcome}`);
  }
  process.exit(1);
}

console.log(`[ci-gate] PASS: ${gateNames.length} mandatory gates succeeded.`);
