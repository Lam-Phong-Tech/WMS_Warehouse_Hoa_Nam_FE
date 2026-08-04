#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const requiredDistFiles = [
  join(root, "dist", "index.html"),
  join(root, "dist", "health.json"),
  join(root, "dist", "build-manifest.json"),
];
const missing = requiredDistFiles.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error("[health] Missing deployable build artifacts:");
  for (const file of missing) console.error(`- ${relative(root, file)}`);
  process.exit(1);
}
for (const file of requiredDistFiles) {
  if (statSync(file).size === 0) {
    console.error(`[health] ${relative(root, file)} is empty.`);
    process.exit(1);
  }
}

const indexHtml = readFileSync(join(root, "dist", "index.html"), "utf8");
if (!/<script[^>]+type=["']module["'][^>]+src=["'][^"']+["']/iu.test(indexHtml)) {
  console.error("[health] dist/index.html does not include a module entry script.");
  process.exit(1);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`[health] ${label} is not valid JSON: ${error.message}`);
    process.exit(1);
  }
}

const health = readJson(join(root, "dist", "health.json"), "dist/health.json");
const expectedHealth = {
  status: "ok",
  service: "wms-hoa-nam-frontend",
  component: "frontend",
  healthcheck: "static",
};
for (const [key, value] of Object.entries(expectedHealth)) {
  if (health?.[key] !== value) {
    console.error(`[health] dist/health.json ${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(health?.[key])}`);
    process.exit(1);
  }
}

const manifest = readJson(
  join(root, "dist", "build-manifest.json"),
  "dist/build-manifest.json",
);
if (manifest.schemaVersion !== "1.0.0" || manifest.task !== "WWHN-156") {
  console.error("[health] build manifest schema/task is invalid.");
  process.exit(1);
}
if (manifest.service !== "wms-hoa-nam-frontend") {
  console.error("[health] build manifest service is invalid.");
  process.exit(1);
}
if (!manifest.sourceSha || !manifest.executionSha || !manifest.artifactVersion) {
  console.error("[health] build manifest must include sourceSha, executionSha and artifactVersion.");
  process.exit(1);
}
if (process.env.CI === "true" && !/^[0-9a-f]{40}$/iu.test(manifest.sourceSha)) {
  console.error(`[health] CI sourceSha is not immutable: ${manifest.sourceSha}`);
  process.exit(1);
}
if (manifest.healthContract?.backendResolvedPath !== "/api/v1/health") {
  console.error(
    `[health] backend health must resolve to /api/v1/health, got ${manifest.healthContract?.backendResolvedPath}.`,
  );
  process.exit(1);
}

console.log(
  `[health] PASS: deployable FE artifact ${manifest.artifactVersion} exposes /health.json and immutable build-manifest.json for source ${manifest.sourceSha}.`,
);
