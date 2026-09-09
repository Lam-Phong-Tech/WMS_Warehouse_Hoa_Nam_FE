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

// ── Tài liệu canonical + evidence index — ĐÃ RÚT theo 3822d45 ──────────────
// docs/Task_docs_Jira/WWHN-165.md và docs/evidence/wwhn-165/* đã được gỡ khỏi
// repo trong đợt dọn kho tài liệu (commit 3822d45); các kiểm tra đọc artefact
// đó rút theo. Kiểm tra mã nguồn sống phía dưới giữ nguyên hiệu lực.
requirePatterns("docs/api-evidence/WWHN-165_AUTH_CONTRACT_EXPECTATION.md", [
  /FE_PROPOSED_PENDING_BE_APPROVAL/,
  /OpenAPI/,
  /Postman/,
  /SHA256/,
  /permission_codes/,
  /DATA_SCOPE_DENIED/,
  /idempotency/i,
]);
// ── Ma trận QA1/QA2 (docs/evidence/wwhn-165) — ĐÃ RÚT theo 3822d45 ─────────
requirePatterns("src/shared/store/auth.store.ts", [
  /bootstrapError/,
  /currentContext:\s*null/,
  /permissionCodes:\s*\[\]/,
  /isProfileLoaded:\s*false/,
  /permissionCodes:\s*me\.permissions/,
]);
// Bootstrap chuyển sang refresh bằng HttpOnly cookie (authService.refresh) —
// không còn đọc refresh token từ JS memory khi khởi động.
requirePatterns("src/app/bootstrap-auth.ts", [/activeBootstrap/, /isInvalidSession/, /bootstrapError:\s*error/, /persist\.clearStorage/, /authService\.refresh\(\)/]);
// Chuỗi lỗi đã chuyển sang i18n key (shared.states.*) — pin theo key thay vì text cứng.
requirePatterns("src/app/router/ProtectedRoute.tsx", [/shared\.states\.sessionRestoreError/, /bootstrapAuth\(\)/, /shared\.states\.profileLoadError/]);
requirePatterns("src/modules/auth/hooks/use-me.ts", [/queryKey:\s*\["auth",\s*"me",\s*token\]/, /status === 401 \|\| status === 403/]);
// WWHN-SEC-08 tách bước MFA: setAuth/refresh_token/available_contexts dời sang use-after-login.
requirePatterns("src/modules/auth/hooks/use-login.ts", [/authService\.login/, /mfa_required/, /afterLogin\(data\)/]);
requirePatterns("src/modules/auth/hooks/use-after-login.ts", [/setAuth\(/, /refreshToken:\s*data\.refresh_token/, /available_contexts/]);
requirePatterns("src/modules/auth/types/auth.types.ts", [/context_type/, /context_id/, /scope_ref/, /refresh_token:\s*string/]);
requirePatterns("src/modules/auth/services/auth.service.ts", [/class AuthContractError/, /AUTH_CONTRACT_INVALID/, /requireNonEmptyString\(data\.access_token/, /normalizeTokenResponse/, /warehouse_scope_ids/, /refresh_token:\s*refreshToken/]);
requirePatterns("src/modules/auth/components/ContextSwitcher.tsx", [/context_type:/, /context_id:/, /scope_ref:/]);
requirePatterns("src/shared/api/axios.ts", [/isAuthEndpoint/, /refreshStatus === 401 \|\| refreshStatus === 403/, /setToken\(token\)/, /Network\/5xx/]);
// e2e/wwhn-165-auth-session.spec.ts — ĐÃ RÚT theo 3822d45 (bộ e2e đã gỡ).

for (const path of ["vite.config.ts", "vitest.config.ts"]) {
  const content = read(path);
  for (const forbidden of [/\b__dirname\b/, /\b__filename\b/, /\brequire\s*\(/]) {
    if (forbidden.test(content)) failures.push(`${path} has legacy config-loader coupling`);
  }
  if (!/fileURLToPath\(import\.meta\.url\)/.test(content)) failures.push(`${path} must remain ESM-safe`);
}

// ── WWHN-165_CLOSURE_REGISTER.json — ĐÃ RÚT theo 3822d45 (docs/evidence) ───

const packageJson = JSON.parse(read("package.json") || "{}");
if (packageJson.scripts?.["wwhn-165:verify"] !== "node scripts/verify-wwhn-165-closure.mjs") failures.push("package.json must expose exact wwhn-165:verify script");
// test:e2e:evidence check đã rút theo 3822d45 (bộ e2e không còn trong repo).
requirePatterns(".github/workflows/ci.yml", [/Verify WWHN-165 auth session closure controls/, /npm run wwhn-165:verify/]);
// Ranh giới independent-evidence từng nằm trong tài liệu canonical — đã rút theo 3822d45.

if (failures.length) {
  failures.forEach((failure) => console.error(`[wwhn-165] ERROR: ${failure}`));
  process.exit(1);
}
console.log("[wwhn-165] PASS: auth/session live-source controls and contract mapping are enforced (doc/evidence/e2e checks retired by 3822d45).");
