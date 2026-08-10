#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const read = (path) => {
  const full = join(root, path);
  if (!existsSync(full)) {
    failures.push(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(full, "utf8");
};
const requirePatterns = (path, patterns) => {
  const content = read(path);
  for (const pattern of patterns) {
    if (!pattern.test(content)) failures.push(`${path} missing ${pattern}`);
  }
  return content;
};

const canonical = requirePatterns("docs/Task_docs_Jira/WWHN-165.md", [
  /FE-owned closure: COMPLETE/i,
  /Final acceptance: PENDING_INDEPENDENT_EVIDENCE/i,
  /WWHN-166/,
  /WWHN-167/,
  /WWHN-146/,
  /WWHN-147/,
  /run #107/i,
  /30913628631/,
  /c87c01b37bc8c84dee5cf3788b4bb69026d756364c860a355bad9bef4ff5bc00/,
  /SUPERSEDED_NON_EVIDENCE/,
  /401/,
  /403/,
  /409/,
  /422/,
  /idempotency/i,
]);

requirePatterns("docs/evidence/wwhn-165/WWHN-165_EVIDENCE_INDEX.md", [
  /Exact source SHA/,
  /Artifact ID/,
  /Digest/,
  /SUPERSEDED_NON_EVIDENCE/,
  /Same-build reconciliation rule/,
  /PENDING INDEPENDENT RUN/,
]);
requirePatterns("docs/api-evidence/WWHN-165_AUTH_CONTRACT_EXPECTATION.md", [
  /FE_PROPOSED_PENDING_BE_APPROVAL/,
  /OpenAPI/,
  /Postman/,
  /SHA256/,
  /permission_codes/,
  /DATA_SCOPE_DENIED/,
  /idempotency/i,
]);
requirePatterns("docs/evidence/wwhn-165/WWHN-166_QA1_SECURITY_MATRIX.md", [
  /READY_FOR_QA1_EXECUTION/,
  /Anonymous direct API/,
  /Direct API missing permission/,
  /Audit/,
  /no stack trace/i,
]);
requirePatterns("docs/evidence/wwhn-165/WWHN-167_QA2_UI_MATRIX.md", [
  /READY_FOR_QA2_EXECUTION/,
  /Chrome/,
  /Edge/,
  /1440x900/,
  /1024x768/,
  /390x844/,
  /errors\/403/,
]);
requirePatterns("src/shared/store/auth.store.ts", [
  /bootstrapError/,
  /currentContext:\s*null/,
  /permissionCodes:\s*\[\]/,
  /isProfileLoaded:\s*false/,
  /permissionCodes:\s*me\.permissions/,
]);
requirePatterns("src/app/bootstrap-auth.ts", [/activeBootstrap/, /isInvalidSession/, /bootstrapError:\s*error/, /persist\.clearStorage/, /getRefreshToken/]);
requirePatterns("src/app/router/ProtectedRoute.tsx", [/Không thể khôi phục phiên làm việc/, /bootstrapAuth\(\)/, /Không thể tải hồ sơ và phân quyền/]);
requirePatterns("src/modules/auth/hooks/use-me.ts", [/queryKey:\s*\["auth",\s*"me",\s*token\]/, /status === 401 \|\| status === 403/]);
requirePatterns("src/modules/auth/hooks/use-login.ts", [/authService\.login/, /setAuth\(/, /refreshToken:\s*data\.refresh_token/, /available_contexts/]);
requirePatterns("src/modules/auth/types/auth.types.ts", [/context_type/, /context_id/, /scope_ref/, /refresh_token:\s*string/]);
requirePatterns("src/modules/auth/services/auth.service.ts", [/class AuthContractError/, /AUTH_CONTRACT_INVALID/, /requireNonEmptyString\(data\.access_token/, /normalizeTokenResponse/, /warehouse_scope_ids/, /refresh_token:\s*refreshToken/]);
requirePatterns("src/modules/auth/components/ContextSwitcher.tsx", [/context_type:/, /context_id:/, /scope_ref:/]);
requirePatterns("src/shared/api/axios.ts", [/isAuthEndpoint/, /refreshStatus === 401 \|\| refreshStatus === 403/, /setToken\(token\)/, /Network\/5xx/]);
requirePatterns("e2e/wwhn-165-auth-session.spec.ts", [/bootstrap 503 stays fail-closed/, /limited role navigation/, /logout clears protected session/, /env-/, /sha-/, /role-/, /viewport-/]);

for (const path of ["vite.config.ts", "vitest.config.ts"]) {
  const content = read(path);
  for (const forbidden of [/\b__dirname\b/, /\b__filename\b/, /\brequire\s*\(/]) {
    if (forbidden.test(content)) failures.push(`${path} has legacy config-loader coupling`);
  }
  if (!/fileURLToPath\(import\.meta\.url\)/.test(content)) failures.push(`${path} must remain ESM-safe`);
}

const registerPath = "docs/evidence/wwhn-165/WWHN-165_CLOSURE_REGISTER.json";
try {
  const register = JSON.parse(read(registerPath));
  if (register.schemaVersion !== "1.1.0") failures.push(`${registerPath}: schemaVersion must be 1.1.0`);
  if (register.task !== "WWHN-165" || register.feOwnedStatus !== "COMPLETE") failures.push(`${registerPath}: invalid FE closure identity/status`);
  if (register.finalAcceptanceStatus !== "PENDING_INDEPENDENT_EVIDENCE") failures.push(`${registerPath}: final gate must remain fail-closed`);
  if (register.verifiedCiBaseline?.runId !== 30913628631 || register.verifiedCiBaseline?.status !== "COMPLETED_SUCCESS") failures.push(`${registerPath}: verified run #107 baseline missing`);
  if (register.verifiedCiBaseline?.artifact?.digest !== "sha256:c87c01b37bc8c84dee5cf3788b4bb69026d756364c860a355bad9bef4ff5bc00") failures.push(`${registerPath}: artifact digest mismatch`);
  if (register.traceability?.blobCommentDisposition !== "Jira comment 14612 không có filename/metadata, bị đánh dấu SUPERSEDED_NON_EVIDENCE và không được dùng để nghiệm thu.") failures.push(`${registerPath}: blob disposition missing`);
  for (const gate of ["qa1", "qa2", "backend", "bas", "ba"]) {
    if (register.independentGates?.[gate]?.status !== "PENDING") failures.push(`${registerPath}: ${gate} must remain PENDING until independently signed`);
  }
} catch (error) {
  failures.push(`${registerPath} invalid JSON: ${error.message}`);
}

const packageJson = JSON.parse(read("package.json") || "{}");
if (packageJson.scripts?.["wwhn-165:verify"] !== "node scripts/verify-wwhn-165-closure.mjs") failures.push("package.json must expose exact wwhn-165:verify script");
if (!packageJson.scripts?.["test:e2e:evidence"]?.includes("wwhn-165-auth-session")) failures.push("test:e2e:evidence must include WWHN-165 Playwright evidence");
requirePatterns(".github/workflows/ci.yml", [/Verify WWHN-165 auth session closure controls/, /npm run wwhn-165:verify/, /WWHN_165_OUTCOME/, /docs\/evidence\/wwhn-165/]);
if (!/không thay thế bằng chứng độc lập/i.test(canonical)) failures.push("Canonical document must preserve independent-evidence boundary");

if (failures.length) {
  failures.forEach((failure) => console.error(`[wwhn-165] ERROR: ${failure}`));
  process.exit(1);
}
console.log("[wwhn-165] PASS: auth/session controls, backend-m1 auth contract mapping and independent final gates are enforced.");
