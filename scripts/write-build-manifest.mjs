#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const distDir = join(root, "dist");
const envExamplePath = join(root, ".env.example");

function parseEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/u);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^["']|["']$/gu, "");
  }
  return values;
}

function resolveUrl(baseUrl, relativePath) {
  const normalizedBase = baseUrl.replace(/\/+$/u, "");
  const normalizedPath = `/${relativePath.replace(/^\/+|\/+$/gu, "")}`;
  return `${normalizedBase}${normalizedPath}`;
}

if (!existsSync(distDir)) {
  throw new Error("[build-manifest] dist/ does not exist. Run Vite build first.");
}
const fallbackEnv = existsSync(envExamplePath)
  ? parseEnv(readFileSync(envExamplePath, "utf8"))
  : {};
const apiBaseUrl = process.env.VITE_API_BASE_URL ?? fallbackEnv.VITE_API_BASE_URL;
const healthPath = process.env.VITE_API_HEALTH_PATH ?? fallbackEnv.VITE_API_HEALTH_PATH ?? "/health";
if (!apiBaseUrl) throw new Error("[build-manifest] VITE_API_BASE_URL is required.");

const sourceSha =
  process.env.SOURCE_SHA ??
  process.env.WMS_SOURCE_SHA ??
  process.env.GITHUB_SHA ??
  "local-uncommitted";
const executionSha =
  process.env.EXECUTION_SHA ?? process.env.WMS_EXECUTION_SHA ?? process.env.GITHUB_SHA ?? sourceSha;
const manifest = {
  schemaVersion: "1.0.0",
  service: "wms-hoa-nam-frontend",
  task: "WWHN-156",
  sourceSha,
  executionSha,
  artifactVersion:
    process.env.VITE_APP_VERSION ?? fallbackEnv.VITE_APP_VERSION ?? "0.0.0-local",
  environment: process.env.VITE_APP_ENV ?? fallbackEnv.VITE_APP_ENV ?? "local",
  generatedAt: new Date().toISOString(),
  healthContract: {
    contractVersion: "WWHN-156-health-v1",
    frontendStaticPath: "/health.json",
    backendResolvedUrl: resolveUrl(apiBaseUrl, healthPath),
    backendResolvedPath: new URL(resolveUrl(apiBaseUrl, healthPath)).pathname,
  },
};

mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `[build-manifest] Wrote dist/build-manifest.json for ${manifest.sourceSha} (${manifest.artifactVersion}).`,
);
