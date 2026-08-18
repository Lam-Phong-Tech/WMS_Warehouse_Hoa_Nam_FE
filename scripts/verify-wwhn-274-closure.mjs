import { existsSync, readFileSync } from "node:fs";

const failures = [];

function requireFile(path) {
  if (!existsSync(path)) {
    failures.push(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function requireText(content, needle, label) {
  if (!content.includes(needle)) {
    failures.push(`Missing ${label}: ${needle}`);
  }
}

const taskDoc = requireFile("docs/Task_docs_Jira/WWHN-274.md");
const e2e = requireFile("e2e/wwhn-274-release-signoff.spec.ts");
const workflow = requireFile(".github/workflows/wwhn-274-fe-release-signoff.yml");
const envExample = requireFile(".env.example");
const techGuide = requireFile("docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md");
const srs = requireFile("docs/HN_SRS_FRD_v1.12_FULL.md");
const erd = requireFile("docs/HoaNam_ERD_Moi_Nhat.md");
const wireframe = requireFile("docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html");

for (const [content, label] of [
  [srs, "SRS/FRD baseline"],
  [erd, "ERD baseline"],
  [wireframe, "wireframe baseline"],
  [techGuide, "techstack baseline"],
]) {
  if (!content.trim()) failures.push(`${label} is empty`);
}

requireText(envExample, "VITE_API_BASE_URL=", "API base env contract");
requireText(envExample, "/api/v1", "canonical API version prefix");
requireText(envExample, "VITE_API_WITH_CREDENTIALS=true", "credentialed browser requests");

for (const viewport of ["1440, height: 900", "768, height: 1024", "375, height: 812"]) {
  requireText(e2e, viewport, `required viewport ${viewport}`);
}
for (const state of [
  "Loading",
  "Empty",
  "Error",
  "No permission",
  "API error + field errors",
  "Confirm action",
  "Disabled until valid",
]) {
  requireText(e2e, state, `shared UI state ${state}`);
}
requireText(e2e, "/errors/403", "direct URL permission fail-closed route");
requireText(e2e, "FE_CONTROLLED_NOT_QA_UAT", "controlled-evidence truth boundary");
requireText(e2e, "sourceSha", "exact SHA evidence metadata");
requireText(e2e, "timestamp", "timestamp evidence metadata");
requireText(e2e, "browserProject", "browser evidence metadata");
requireText(e2e, "role", "role evidence metadata");
requireText(e2e, "viewport", "viewport evidence metadata");
requireText(e2e, "login-api-422-retry-safe", "API error/retry scenario");

for (const gate of [
  "npm run format:check",
  "npm run lint",
  "npm run typecheck",
  "npm run test",
  "npm run env:verify",
  "npm run check:api-mapping",
  "npm run build",
  "npm run health:check",
  "e2e/wwhn-274-release-signoff.spec.ts",
  "scripts/verify-wwhn-274-closure.mjs",
  "actions/upload-artifact@v4",
]) {
  requireText(workflow, gate, `workflow gate ${gate}`);
}
requireText(workflow, "branches: [m1]", "m1-only release-signoff branch trigger");
requireText(workflow, "github.sha", "workflow exact SHA binding");
requireText(workflow, "release-signoff.json", "machine-readable release evidence");

for (const boundary of [
  "FE-controlled",
  "WWHN-272",
  "WWHN-275",
  "Stocktake",
  "P0/P1/P2",
]) {
  requireText(taskDoc, boundary, `task traceability boundary ${boundary}`);
}

if (failures.length > 0) {
  console.error("WWHN-274 closure verification FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("WWHN-274 source-controlled closure contract PASS");
console.log("Truth boundary: FE controlled evidence only; independent QA/UAT/DevOps evidence remains role-owned.");
