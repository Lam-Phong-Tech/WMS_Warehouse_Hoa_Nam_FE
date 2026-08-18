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

// Current MVP invariant (REQ-SRS-037 / DEC-NO-STOCKTAKE-001): do not let stale
// historical evidence silently re-introduce stocktake/direct-stock-edit surface.
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
