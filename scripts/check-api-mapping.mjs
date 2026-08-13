#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const swaggerPath = join(root, "swagger-api.json");
const endpointsPath = join(root, "src/shared/api/endpoints.ts");
const permissionPath = join(root, "src/shared/constants/wms-permissions.ts");
const baselinePath = join(
  root,
  "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json",
);
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
      failClosed: /fail-closed|blocked until|pending contract/i.test(
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
    const value = match[1];
    const normalized = normalizePath(value);
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
    for (const method of Object.keys(operations)) {
      if (methods.has(method.toUpperCase())) {
        routes.add(`${method.toUpperCase()} ${normalized}`);
      }
    }
  }
  return routes;
}

if (!existsSync(endpointsPath)) {
  failures.push("Missing src/shared/api/endpoints.ts");
}
if (!existsSync(permissionPath)) {
  failures.push("Missing src/shared/constants/wms-permissions.ts");
}
if (!existsSync(baselinePath)) {
  failures.push("Missing docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json");
}
for (const file of mappingFiles) {
  if (!existsSync(file)) failures.push(`Missing ${relative(root, file)}`);
}
if (failures.length) {
  for (const failure of failures)
    console.error(`[api-mapping] ERROR: ${failure}`);
  process.exit(1);
}

const swaggerRoutes = loadSwaggerRoutes();
const endpointPaths = loadEndpointPaths();
const permissionSource = readFileSync(permissionPath, "utf8");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

if (!swaggerRoutes) {
  warnings.push(
    "swagger-api.json is unavailable: running FE constant/baseline validation only; this is not BE OpenAPI sign-off.",
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

    if (swaggerRoutes) {
      const key = `${row.method} ${normalized}`;
      if (!swaggerRoutes.has(key)) {
        if (row.failClosed) {
          warnings.push(
            `${rel}:${row.line} ${key} is intentionally fail-closed pending canonical contract.`,
          );
        } else {
          failures.push(
            `${rel}:${row.line} ${key} not found in swagger-api.json`,
          );
        }
      }
    } else if (isM1 && !endpointPaths.has(normalized)) {
      failures.push(
        `${rel}:${row.line} ${row.path} not represented by an FE endpoint constant`,
      );
    }
  }
}

for (const flow of baseline.criticalFlows ?? []) {
  const rawPath = flow.relativePath ?? flow.endpointPath ?? flow.runtimePath;
  const normalized = normalizePath(rawPath);
  if (!normalized) {
    failures.push(
      `Baseline ${flow.id ?? "UNKNOWN_FLOW"} is missing relativePath/endpointPath/runtimePath`,
    );
  } else if (!endpointPaths.has(normalized)) {
    failures.push(
      `Baseline ${flow.id} path ${rawPath} not represented by endpoints.ts`,
    );
  }

  // Contract gate FE↔BE (WAR-P1-04): mỗi critical flow có method phải tồn tại
  // trong BE OpenAPI snapshot — bắt được endpoint FE gọi nhưng BE chưa đăng ký
  // route (vd GET /component-issue-documents/{id} từng thiếu ở audit 08/2026).
  if (swaggerRoutes && normalized && typeof flow.method === "string") {
    const key = `${flow.method.toUpperCase()} ${normalized}`;
    if (!swaggerRoutes.has(key)) {
      const pendingExternalSignoff =
        typeof flow.officialSignoff === "string" &&
        flow.officialSignoff.startsWith("PENDING");
      if (pendingExternalSignoff) {
        warnings.push(
          `Baseline ${flow.id} ${key} not in swagger-api.json; tolerated only while ${flow.officialSignoff}.`,
        );
      } else {
        failures.push(
          `Baseline ${flow.id} ${key} not found in swagger-api.json (BE route missing or drifted)`,
        );
      }
    }
  }

  const flowPermissions = [
    ...(Array.isArray(flow.permissionsAny) ? flow.permissionsAny : []),
    ...(typeof flow.permission === "string" ? [flow.permission] : []),
  ];
  if (flowPermissions.length === 0) {
    failures.push(`Baseline ${flow.id} has no permission or permissionsAny`);
  }
  for (const permission of flowPermissions) {
    if (!permissionSource.includes(`"${permission}"`)) {
      failures.push(
        `Baseline ${flow.id} permission ${permission} missing from catalog`,
      );
    }
  }
}

for (const code of [
  "stocktake.adjust",
  "warranty.temp_only",
  "scan.inbound",
  "scan.outbound",
  "scan.warranty",
  "report.export",
]) {
  if (!permissionSource.includes(`"${code}"`)) {
    failures.push(`Permission ${code} missing from WMS catalog`);
  }
}

for (const warning of warnings)
  console.warn(`[api-mapping] WARNING: ${warning}`);
if (failures.length) {
  for (const failure of failures)
    console.error(`[api-mapping] ERROR: ${failure}`);
  process.exit(1);
}
console.log(
  `[api-mapping] PASS: ${totalRows} documented rows checked (${failClosedRows} explicitly fail-closed); canonical paths and permissions match FE constants/baseline.`,
);
