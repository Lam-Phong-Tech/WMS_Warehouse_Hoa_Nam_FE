#!/usr/bin/env node
import { spawnSync } from "node:child_process";

// Legacy compatibility entry point retained for the UAT readiness verifier.
// The current canonical suite covers role-filtered navigation, direct 403 and
// responsive desktop/tablet/mobile evidence in auth-role-navigation-qa2.spec.ts.
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["run", "test:e2e:wwhn-144"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(`[capture-role-scopes] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
