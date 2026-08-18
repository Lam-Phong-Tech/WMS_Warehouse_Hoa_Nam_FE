#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const swaggerPath = join(root, "swagger-api.json");
const endpointsPath = join(root, "src/shared/api/endpoints.ts");
const permissionPath = join(root, "src/shared/constants/wms-permissions.ts");
const mappingFiles = [
  join(root, "docs/api-evidence/M1_API_MAPPING.md"),
  join(root, "docs/api-evidence/M2_DEPENDENCY_LIST.md"),
  join(root, "docs/api-evidence/M3_DEPENDENCY_LIST.md"),
];

const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const failures = [];
const warnings = [];

function normalizePath(path) {
  if (typeof path !== "string" || path.trim() === "") return null;
  return (
    path
      .trim()
      .replace(/^\/api\/v1(?=\/)/, "")
      .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, "{param}")
      .replace(/\{[^}]+\}/g, "{param}")
      .replace(/\/+$/, "") || "/"
  );
}

function extractRows(markdown) {
  const rows = [];
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
    const method = cells
      .map((cell) => cell.replace(/[^A-Z]/g, ""))
      .find((cell) => methods.has(cell));
    const pathCell = cells.find((cell) => /`\/(?:api\/v1\/)?[^`]+`/.test(cell));
    if (!method || !pathCell) continue;
    const path = pathCell.match(/`(\/[^`]+)`/)?.[1];
    if (!path) continue;
    const disposition = cells.at(-1) ?? "";
    rows.push({
      line: index + 1,
      method,
      path,
      disposition,
      failClosed: /fail-closed|blocked until|pending contract|removed-from-mvp/i.test(
        disposition,
      ),
    });
  }
  return rows;
}

function loadEndpointPaths() {
  const source = readFileSync(endpointsPath, "utf8");
  const paths = new Set();
  for (const match of source.matchAll(/:\s*"([^"]+)"/g)) {
    const normalized = normalizePath(match[1]);
    if (normalized) paths.add(normalized);
  }
  return paths;
}

function loadSwaggerRoutes() {
  if (!existsSync(swaggerPath)) return null;
  const swagger = JSON.parse(readFileSync(swaggerPath, "utf8"));
  const routes = new Set();
  for (const [path, operations] of Object.entries(swagger.paths ?? {})) {
    const normalized = normalizePath(path);
    if (!normalized) continue;
    for (const method of Object.keys(operations ?? {})) {
      if (methods.has(method.toUpperCase())) {
        routes.add(`${method.toUpperCase()} ${normalized}`);
      }
    }
  }
  return routes;
}

for (const [path, label] of [
  [endpointsPath, "src/shared/api/endpoints.ts"],
  [permissionPath, "src/shared/constants/wms-permissions.ts"],
]) {
  if (!existsSync(path)) failures.push(`Missing ${label}`);
}
for (const file of mappingFiles) {
  if (!existsSync(file)) failures.push(`Missing ${relative(root, file)}`);
}
if (failures.length) {
  failures.forEach((failure) => console.error(`[api-mapping] ERROR: ${failure}`));
  process.exit(1);
}

const swaggerRoutes = loadSwaggerRoutes();
const endpointPaths = loadEndpointPaths();
const endpointSource = readFileSync(endpointsPath, "utf8");
const permissionSource = readFileSync(permissionPath, "utf8");

if (!swaggerRoutes) {
  warnings.push(
    "swagger-api.json is unavailable: validating FE constants/registers only; this is not BE OpenAPI sign-off.",
  );
}

let totalRows = 0;
let failClosedRows = 0;
for (const file of mappingFiles) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const rows = extractRows(readFileSync(file, "utf8"));
  totalRows += rows.length;
  failClosedRows += rows.filter((row) => row.failClosed).length;
  const isM1 = rel.endsWith("M1_API_MAPPING.md");
  console.log(`[api-mapping] ${rel}: ${rows.length} endpoint rows`);

  for (const row of rows) {
    const normalized = normalizePath(row.path);
    if (!normalized) {
      failures.push(`${rel}:${row.line} invalid endpoint path: ${row.path}`);
      continue;
    }

    // M1 is the active FE runtime map: every non-fail-closed path must be represented
    // by a shared endpoint constant. M2/M3 may also contain external-only dependencies.
    if (isM1 && !row.failClosed && !endpointPaths.has(normalized)) {
      failures.push(
        `${rel}:${row.line} ${row.path} not represented by an FE endpoint constant`,
      );
    }

    if (swaggerRoutes) {
      const key = `${row.method} ${normalized}`;
      if (!swaggerRoutes.has(key)) {
        if (row.failClosed) {
          warnings.push(`${rel}:${row.line} ${key} is explicitly fail-closed/pending.`);
        } else {
          failures.push(`${rel}:${row.line} ${key} not found in swagger-api.json`);
        }
      }
    }
  }
}

// WWHN-296 / FE296-P1-01 — re-derive the authority of the no-Stocktake rule from
// the baseline documents instead of asserting a Decision ID string. A guard that
// only knows a slogan keeps enforcing a requirement nobody can trace; this reads
// the requirement itself, and fails if the register starts claiming an approval
// the Jira Decision Record has not actually granted.
const governancePath = join(root, "docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json");
if (!existsSync(governancePath)) {
  failures.push("docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json is missing.");
} else {
  let governance = null;
  try {
    governance = JSON.parse(readFileSync(governancePath, "utf8"));
  } catch (error) {
    failures.push(`STOCKTAKE_GOVERNANCE_STATUS.json is invalid JSON: ${error.message}`);
  }

  if (governance) {
    const authority = governance.ruleAuthority ?? {};
    const requirementId = authority.controllingRequirement?.id;
    if (requirementId !== "REQ-SRS-037") {
      failures.push("Governance register must name REQ-SRS-037 as the controlling requirement.");
    }

    const baselinePath = authority.controllingBaseline?.repositoryPath;
    const baselineFile = baselinePath ? join(root, baselinePath) : null;
    if (!baselineFile || !existsSync(baselineFile)) {
      failures.push(`Controlling baseline document is missing: ${baselinePath ?? "(unset)"}`);
    } else {
      const baseline = readFileSync(baselineFile, "utf8");
      if (!baseline.includes("REQ-SRS-037")) {
        failures.push(`${baselinePath} no longer contains REQ-SRS-037; re-check the rule before enforcing it.`);
      }
      if (!baseline.includes("Không expose Stocktake/Variance")) {
        failures.push(`${baselinePath} no longer states the no-Stocktake requirement; the guard must not outlive it.`);
      }
    }

    const erdPath = (authority.corroboratingBaselines ?? []).find(
      (entry) => typeof entry?.repositoryPath === "string" && entry.repositoryPath.includes("ERD"),
    )?.repositoryPath;
    const erdFile = erdPath ? join(root, erdPath) : null;
    if (!erdFile || !existsSync(erdFile)) {
      failures.push(`Corroborating ERD baseline is missing: ${erdPath ?? "(unset)"}`);
    } else if (!/Không tạo Stocktake_Session/u.test(readFileSync(erdFile, "utf8"))) {
      failures.push(`${erdPath} no longer excludes Stocktake entities from the baseline.`);
    }

    // Never let the register drift back into claiming approval that WWHN-25 has
    // not granted; an approved id without an artifact hash is exactly the
    // unverifiable claim the review rejected.
    const gate = governance.decisionRecordGate ?? {};
    if (gate.approvedStandaloneDecisionId && !gate.approvedArtifactHash) {
      failures.push(
        "Governance register claims an approved standalone Decision ID without an approved artifact hash.",
      );
    }
    for (const [rel, source] of [
      ["docs/api-evidence/M1_API_MAPPING.md", readFileSync(join(root, "docs/api-evidence/M1_API_MAPPING.md"), "utf8")],
      ["docs/api-evidence/M3_DEPENDENCY_LIST.md", readFileSync(join(root, "docs/api-evidence/M3_DEPENDENCY_LIST.md"), "utf8")],
    ]) {
      // A negated mention ("must not be cited as an approved Decision ID") is
      // the wording we want, so only an affirmative claim on the same line is a
      // finding.
      const claimsApproval = source
        .split(/\r?\n/u)
        .some(
          (line) =>
            line.includes("DEC-NO-STOCKTAKE-001") &&
            /approved\s+(standalone\s+)?Decision\s+ID/iu.test(line) &&
            !/\b(not|never)\b/iu.test(line),
        );
      if (claimsApproval) {
        failures.push(`${rel} presents DEC-NO-STOCKTAKE-001 as an approved Decision ID.`);
      }
      if (!source.includes("REQ-SRS-037")) {
        failures.push(`${rel} must trace the no-Stocktake boundary to REQ-SRS-037.`);
      }
    }
  }
}

// Current MVP invariant. Authority is REQ-SRS-037 ("Must") in the adopted
// SRS/FRD v1.12 baseline, corroborated by ERD section 0.1 — not by the standalone
// Decision Record WWHN-25/DEC-STK-001, which is still In Progress. The block
// above re-derives that authority from the baseline files so the rule can never
// outlive the requirement it claims to enforce (WWHN-296 / FE296-P1-01).
if (/STOCKTAKE_[A-Z0-9_]*\s*:/u.test(endpointSource)) {
  failures.push("Stocktake endpoint constant detected although current MVP removes Stocktake.");
}
if (/stocktake\./iu.test(permissionSource)) {
  failures.push("stocktake.* permission detected although current MVP removes Stocktake.");
}

for (const code of [
  "scan.classify",
  "scan.execute",
  "inbound.scan",
  "inbound.post",
  "outbound.scan",
  "outbound.post",
  "inventory.reversal.post",
  "warranty.manage",
  "warranty.component_issue",
  "report.view",
  "report.export",
]) {
  if (!permissionSource.includes(`"${code}"`)) {
    failures.push(`Permission ${code} missing from WMS catalog`);
  }
}

// Canonical scan route must stay aligned with FE/OpenAPI. The BE may keep a
// backward-compatible alias, but FE must never drift back to the legacy path.
if (!/SCAN_BATCHES_CLASSIFY:\s*"\/scan\/classify"/u.test(endpointSource)) {
  failures.push("SCAN_BATCHES_CLASSIFY must remain /scan/classify.");
}

warnings.forEach((warning) => console.warn(`[api-mapping] WARNING: ${warning}`));
if (failures.length) {
  failures.forEach((failure) => console.error(`[api-mapping] ERROR: ${failure}`));
  process.exit(1);
}

console.log(
  `[api-mapping] PASS: ${totalRows} documented rows checked (${failClosedRows} explicitly fail-closed); current MVP paths and permissions are internally consistent.`,
);
