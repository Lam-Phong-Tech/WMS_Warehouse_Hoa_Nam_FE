#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function readRequired(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    fail(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(fullPath, "utf8");
}

function requirePatterns(path, patterns) {
  const content = readRequired(path);
  for (const pattern of patterns) {
    if (!pattern.test(content)) {
      fail(`${path} is missing required pattern ${pattern}`);
    }
  }
  return content;
}

const canonicalDoc = requirePatterns("docs/Task_docs_Jira/WWHN-165.md", [
  /FE-owned closure: COMPLETE/i,
  /Final acceptance: PENDING_INDEPENDENT_EVIDENCE/i,
  /WWHN-166/,
  /WWHN-167/,
  /WWHN-146/,
  /WWHN-147/,
  /401/,
  /403/,
  /409/,
  /422/,
  /idempotency/i,
  /desktop/i,
  /tablet/i,
  /mobile/i,
  /Vite\/Vitest/i,
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

requirePatterns(
  "docs/evidence/wwhn-165/WWHN-166_QA1_SECURITY_MATRIX.md",
  [
    /READY_FOR_QA1_EXECUTION/,
    /Anonymous direct API/,
    /Direct API missing permission/,
    /Audit/,
    /no stack trace/i,
    /same build\/SHA|cùng build\/SHA/i,
  ],
);

requirePatterns("docs/evidence/wwhn-165/WWHN-167_QA2_UI_MATRIX.md", [
  /READY_FOR_QA2_EXECUTION/,
  /Chrome/,
  /Edge/,
  /1440x900/,
  /1024x768/,
  /390x844/,
  /errors\/403/,
]);

requirePatterns("docs/evidence/wwhn-165/WWHN-165_UI_STATE_MATRIX.md", [
  /PENDING_WWHN-146_WWHN-147_APPROVAL/,
  /bootstrap infrastructure error/,
  /Permission chỉ lấy từ/,
  /Approval checklist WWHN-146/,
  /Approval checklist WWHN-147/,
]);

requirePatterns("src/shared/store/auth.store.ts", [
  /bootstrapError/,
  /currentContext:\s*null/,
  /permissionCodes:\s*\[\]/,
  /isProfileLoaded:\s*false/,
  /setToken:[\s\S]{0,500}currentContext:\s*null/,
]);

requirePatterns("src/app/bootstrap-auth.ts", [
  /activeBootstrap/,
  /isInvalidSession/,
  /bootstrapError:\s*error/,
  /persist\.clearStorage/,
]);

requirePatterns("src/app/router/ProtectedRoute.tsx", [
  /Không thể khôi phục phiên làm việc/,
  /bootstrapAuth\(\)/,
  /Không thể tải hồ sơ và phân quyền/,
]);

requirePatterns("src/modules/auth/hooks/use-me.ts", [
  /queryKey:\s*\["auth",\s*"me",\s*token\]/,
  /status === 401 \|\| status === 403/,
]);

requirePatterns("src/modules/auth/hooks/use-login.ts", [
  /available_contexts\.length >= 2/,
  /authService\.switchContext/,
  /useAuthStore\.getState\(\)\.logout\(\)/,
]);

requirePatterns("src/modules/auth/services/auth.service.ts", [
  /class AuthContractError/,
  /AUTH_CONTRACT_INVALID/,
  /requireNonEmptyString\(data\.access_token/,
  /normalizeTokenResponse/,
]);

requirePatterns("src/shared/api/axios.ts", [
  /isAuthEndpoint/,
  /refreshStatus === 401 \|\| refreshStatus === 403/,
  /setToken\(token\)/,
  /Network\/5xx/,
]);

requirePatterns("e2e/wwhn-165-auth-session.spec.ts", [
  /bootstrap 503 stays fail-closed/,
  /limited role navigation/,
  /logout clears protected session/,
  /env-/,
  /sha-/,
  /role-/,
  /viewport-/,
]);

const viteConfig = readRequired("vite.config.ts");
const vitestConfig = readRequired("vitest.config.ts");
for (const [path, content] of [
  ["vite.config.ts", viteConfig],
  ["vitest.config.ts", vitestConfig],
]) {
  for (const forbidden of [/\b__dirname\b/, /\b__filename\b/, /\brequire\s*\(/]) {
    if (forbidden.test(content)) fail(`${path} has legacy config-loader coupling`);
  }
  if (!/fileURLToPath\(import\.meta\.url\)/.test(content)) {
    fail(`${path} must remain ESM-safe`);
  }
}

const registerPath = "docs/evidence/wwhn-165/WWHN-165_CLOSURE_REGISTER.json";
const registerText = readRequired(registerPath);
if (registerText) {
  try {
    const register = JSON.parse(registerText);
    if (register.task !== "WWHN-165") fail(`${registerPath}: wrong task`);
    if (register.feOwnedStatus !== "COMPLETE") {
      fail(`${registerPath}: feOwnedStatus must be COMPLETE`);
    }
    if (register.finalAcceptanceStatus !== "PENDING_INDEPENDENT_EVIDENCE") {
      fail(`${registerPath}: final acceptance boundary is not truthful`);
    }
    const gates = register.independentGates;
    for (const gate of ["qa1", "qa2", "backend", "bas", "ba"]) {
      if (!gates?.[gate] || gates[gate].status !== "PENDING") {
        fail(`${registerPath}: ${gate} must remain explicitly PENDING`);
      }
    }
  } catch (error) {
    fail(`${registerPath} invalid JSON: ${error.message}`);
  }
}

const packageJson = JSON.parse(readRequired("package.json") || "{}");
if (
  packageJson.scripts?.["wwhn-165:verify"] !==
  "node scripts/verify-wwhn-165-closure.mjs"
) {
  fail("package.json must expose exact wwhn-165:verify script");
}
if (!packageJson.scripts?.["test:e2e:evidence"]?.includes("wwhn-165-auth-session")) {
  fail("test:e2e:evidence must include WWHN-165 Playwright evidence");
}

requirePatterns(".github/workflows/ci.yml", [
  /Verify WWHN-165 auth session closure controls/,
  /npm run wwhn-165:verify/,
  /WWHN_165_OUTCOME/,
  /docs\/evidence\/wwhn-165/,
]);

if (!/không thay thế bằng chứng độc lập/i.test(canonicalDoc)) {
  fail("WWHN-165 document must preserve independent evidence boundary");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[wwhn-165] ERROR: ${failure}`);
  process.exit(1);
}

console.log(
  "[wwhn-165] PASS: auth state machine, fail-closed bootstrap/profile, atomic context switch, contract validation, handoff matrices, runtime evidence and truthful independent gates are wired.",
);
