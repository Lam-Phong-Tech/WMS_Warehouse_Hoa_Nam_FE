import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const requiredFiles = [
  "docs/Task_docs_Jira/WWHN-165.md",
  "docs/evidence/wwhn-165/WWHN-165_CLOSURE_REGISTER.json",
  "docs/evidence/wwhn-165/QA1_SECURITY_RBAC_AUDIT_MATRIX.md",
  "docs/evidence/wwhn-165/QA2_UI_ROLE_NAVIGATION_MATRIX.md",
  "docs/evidence/wwhn-165/CONTRACT_HANDOFF.md",
  "src/shared/api/axios.ts",
  "src/shared/store/auth.store.ts",
  "src/app/router/ProtectedRoute.tsx",
];

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) failures.push(`Missing ${relative}`);
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

if (failures.length === 0) {
  const axiosSource = read("src/shared/api/axios.ts");
  const storeSource = read("src/shared/store/auth.store.ts");
  const guardSource = read("src/app/router/ProtectedRoute.tsx");
  const register = JSON.parse(read("docs/evidence/wwhn-165/WWHN-165_CLOSURE_REGISTER.json"));

  const assertions = [
    [axiosSource.includes("refreshPromise"), "401 refresh requests must be single-flight"],
    [axiosSource.includes("_isRetryAfterRefresh"), "original request must retry at most once"],
    [axiosSource.includes("status === 403"), "403 must be handled separately from 401"],
    [axiosSource.includes("PASSWORD_CHANGE_REQUIRED"), "password-change-required path must be explicit"],
    [storeSource.includes("queryClient.clear()"), "logout must clear scope-sensitive query cache"],
    [storeSource.includes("permissionCodes"), "permissions must come from active context"],
    [guardSource.includes("meQuery.isError"), "profile/RBAC loading failure must fail closed"],
    [guardSource.includes("ROUTES.LOGIN"), "anonymous access must redirect to login"],
    [register.schema_version === "WWHN-165-closure-v1", "closure register schema version invalid"],
    [register.release_gate?.status === "CONDITIONAL", "register must not self-approve cross-role evidence"],
  ];

  for (const [ok, message] of assertions) if (!ok) failures.push(message);

  for (const owner of ["FE1", "BE1_BE2", "QA1", "QA2", "BAS_BA", "LEAD_QA"]) {
    if (!register.owners?.[owner]) failures.push(`Missing owner gate ${owner}`);
  }

  const sourceSha = process.env.SOURCE_SHA || process.env.GITHUB_SHA;
  if (sourceSha && !/^[0-9a-f]{40}$/i.test(sourceSha)) failures.push("SOURCE_SHA must be a 40-char commit SHA");
}

if (failures.length) {
  console.error("WWHN-165 closure verification FAILED");
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log("WWHN-165 closure verification PASSED");
console.log("FE controls are present; external QA/BE/BA approvals remain independently required.");
