#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const health = JSON.parse(
  readFileSync(join(root, "dist", "health.json"), "utf8"),
);
if (health.status !== "ok" || health.service !== "wms-hoa-nam-frontend") {
  console.error("[health] dist/health.json does not match FE health contract.");
  process.exit(1);
}

console.log("[health] Frontend build exposes /health.json and index.html.");
