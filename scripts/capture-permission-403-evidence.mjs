#!/usr/bin/env node
import { spawnSync } from "node:child_process";

// Legacy compatibility entry point retained for HN-UAT-003. The canonical
// controlled browser evidence lives in e2e/auth-role-navigation-qa2.spec.ts.
// This does not replace independent backend authorization / direct API 403
// evidence owned by BE/RBAC + QA.
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
  npm,
  [
    "run",
    "test:e2e:wwhn-144",
    "--",
    "--grep",
    "limited role menu is filtered and forbidden direct URL renders 403|authenticated user can open /errors/403 directly",
  ],
  { stdio: "inherit", env: process.env },
);

if (result.error) {
  console.error(`[capture-permission-403] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
