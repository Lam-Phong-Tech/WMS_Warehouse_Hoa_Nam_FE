#!/usr/bin/env node

const gateNames = [
  "FORMAT_OUTCOME",
  "LINT_OUTCOME",
  "TYPECHECK_OUTCOME",
  "UI_GUARDS_OUTCOME",
  "UNIT_TEST_OUTCOME",
  "ENV_CONTRACT_OUTCOME",
  "UAT_CONTRACT_OUTCOME",
  "WWHN_175_OUTCOME",
  "WWHN_165_OUTCOME",
  "WWHN_156_OUTCOME",
  "SMOKE_CONTRACT_OUTCOME",
  "MASTER_SKU_OUTCOME",
  "WWHN_178_RBAC_CONTRACT_OUTCOME",
  "WMS_CONTRACT_OUTCOME",
  "WWHN_148_OUTCOME",
  "WWHN_144_OUTCOME",
  "WWHN_211_OUTCOME",
  "WWHN_211_RBAC_CONTRACT_OUTCOME",
  "BUILD_OUTCOME",
  "HEALTH_OUTCOME",
  "API_MAPPING_OUTCOME",
  "WWHN_296_OUTCOME",
  // 8 outcome E2E (Playwright install, ui:visual/a11y/responsive, evidence 144/175/178)
  // đã rút 10/09/2026 cùng các bước chết trong ci.yml (e2e/ bị gỡ ở 3822d45).
  "WWHN_177_HANDOFF_OUTCOME",
  "WWHN_230_OUTCOME",
  "WWHN_237_OUTCOME",
  // WWHN-SEC-13: cổng advisory dependency production (scripts/audit-dependencies.mjs).
  "DEP_AUDIT_OUTCOME",
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
