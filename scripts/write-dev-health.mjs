#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const sha = process.env.SOURCE_SHA ?? process.env.GITHUB_SHA;
if (!/^[0-9a-f]{40}$/u.test(sha ?? "")) {
  throw new Error("DEV health requires an exact 40-character source SHA");
}
const manifest = JSON.parse(readFileSync("dist/build-manifest.json", "utf8"));
const health = JSON.parse(readFileSync("dist/health.json", "utf8"));
if (manifest.sourceSha !== sha || manifest.environment !== "dev") {
  throw new Error("DEV build manifest does not match the source SHA and environment");
}
if (health.status !== "ok" || health.service !== "wms-hoa-nam-frontend") {
  throw new Error("DEV health template is invalid");
}
Object.assign(health, {
  success: true,
  environment: "dev",
  scanner_kiosk_mode: process.env.VITE_SCANNER_KIOSK_MODE === "true",
  domain: "khohoanamfe.lptech.info.vn",
  api_target: "http://127.0.0.1:8080",
  source_sha: sha,
  source_revision: sha,
  build_version: manifest.artifactVersion,
});
writeFileSync("dist/health.json", `${JSON.stringify(health, null, 2)}\n`);
console.log(`DEV health written for ${sha}`);
