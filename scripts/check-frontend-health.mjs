#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const requiredDistFiles = [
  join(root, "dist", "index.html"),
  join(root, "dist", "health.json"),
];

const missing = requiredDistFiles.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error("[health] Missing deployable build artifacts:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

for (const file of requiredDistFiles) {
  if (statSync(file).size === 0) {
    console.error(`[health] ${relative(root, file)} is empty.`);
    process.exit(1);
  }
}

const indexHtml = readFileSync(join(root, "dist", "index.html"), "utf8");
if (
  !/<script[^>]+type=["']module["'][^>]+src=["'][^"']+["']/i.test(indexHtml)
) {
  console.error(
    "[health] dist/index.html does not include a module entry script.",
  );
  process.exit(1);
}

let health;
try {
  health = JSON.parse(readFileSync(join(root, "dist", "health.json"), "utf8"));
} catch (error) {
  const message = error instanceof Error ? error.message : "Invalid JSON";
  console.error(`[health] dist/health.json is not valid JSON: ${message}`);
  process.exit(1);
}

const expectedHealth = {
  status: "ok",
  service: "wms-hoa-nam-frontend",
  component: "frontend",
  healthcheck: "static",
};

const mismatches = Object.entries(expectedHealth).filter(
  ([key, value]) => health?.[key] !== value,
);

if (mismatches.length > 0) {
  console.error("[health] dist/health.json does not match FE health contract:");
  for (const [key, value] of mismatches) {
    console.error(
      `- ${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(health?.[key])}`,
    );
  }
  process.exit(1);
}

console.log(
  "[health] Frontend build exposes index.html and /health.json with the approved static contract.",
);
