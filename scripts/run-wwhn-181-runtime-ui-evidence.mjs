#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const REQUIRED_VIEWPORTS = [
  [1920, 1080],
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [390, 844],
];
const FORBIDDEN_ENVIRONMENTS = new Set([
  "LOCAL",
  "CI",
  "MOCK",
  "TEST",
  "SYNTHETIC",
]);

function fail(message) {
  throw new Error(`[WWHN-181 UI evidence] ${message}`);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required`);
  return value;
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]+/g, "-");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function requestIdOf(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  return body.request_id ?? body.meta?.request_id;
}

function errorCodeOf(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  return body.error_code ?? body.error?.code;
}

function parseScenarios(raw) {
  let scenarios;
  try {
    scenarios = JSON.parse(raw);
  } catch (error) {
    fail(`WWHN_181_UI_SCENARIOS_JSON is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    fail("WWHN_181_UI_SCENARIOS_JSON must be a non-empty array");
  }
  for (const scenario of scenarios) {
    if (!scenario?.id || !scenario?.path || !scenario?.viewport) {
      fail("Each scenario requires id, path and viewport");
    }
    const { width, height } = scenario.viewport;
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      fail(`Scenario ${scenario.id} viewport must use integer width/height`);
    }
  }
  return scenarios;
}

function verifyViewportMatrix(scenarios) {
  const present = new Set(
    scenarios.map((scenario) =>
      `${scenario.viewport.width}x${scenario.viewport.height}`,
    ),
  );
  const missing = REQUIRED_VIEWPORTS.filter(
    ([width, height]) => !present.has(`${width}x${height}`),
  );
  if (missing.length > 0) {
    fail(
      `Missing required responsive viewport(s): ${missing
        .map(([width, height]) => `${width}x${height}`)
        .join(", ")}`,
    );
  }
}

async function performAction(page, action) {
  const timeout = Number(action.timeout_ms ?? 10_000);
  if (action.type === "wait") {
    await page.waitForTimeout(Number(action.ms ?? 500));
    return;
  }
  if (!action.selector) fail(`Action ${action.type} requires selector`);
  const locator = page.locator(action.selector).first();
  if (action.type === "click") {
    await locator.click({ timeout });
    return;
  }
  if (action.type === "fill") {
    await locator.fill(String(action.value ?? ""), { timeout });
    return;
  }
  if (action.type === "press") {
    await locator.press(String(action.key ?? "Enter"), { timeout });
    return;
  }
  fail(`Unsupported action type: ${action.type}`);
}

const contract = {
  schema_version: "1.0.0",
  task: "WWHN-181",
  evidence_type: "LIVE_UI_RUNTIME",
  rules: {
    forbidden_environments: [...FORBIDDEN_ENVIRONMENTS],
    mock_or_route_interception: "FORBIDDEN",
    test_data_classification: "SANITIZED_NON_PROD",
    source_sha: "EXACT_40_HEX",
    required_viewports: REQUIRED_VIEWPORTS.map(([width, height]) => ({
      width,
      height,
    })),
    api_trace: "Only method/path/status/error_code/request_id/timing; no headers, cookies, query strings or bodies",
    pass_requires_real_api_error_with_request_id: true,
  },
  required_environment_variables: [
    "WWHN_181_UI_BASE_URL",
    "WWHN_181_ENVIRONMENT",
    "WWHN_181_SOURCE_SHA",
    "WWHN_181_BUILD_ID",
    "WWHN_181_QA2_ACCOUNT",
    "WWHN_181_QA2_ROLE",
    "WWHN_181_TEST_DATA_CLASSIFICATION=SANITIZED_NON_PROD",
    "WWHN_181_UI_SCENARIOS_JSON",
    "WWHN_181_STORAGE_STATE_PATH or per-scenario storage_state_env",
  ],
};

if (process.argv.includes("--contract-only")) {
  const outDir = path.resolve(
    process.env.WWHN_181_UI_OUTPUT_DIR ??
      "artifacts/WWHN-181/ui-runtime-contract",
  );
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, "WWHN-181_UI_RUNTIME_CONTRACT.json");
  fs.writeFileSync(target, `${JSON.stringify(contract, null, 2)}\n`);
  console.log(`Wrote ${target}`);
  process.exit(0);
}

const baseUrl = requiredEnv("WWHN_181_UI_BASE_URL").replace(/\/$/, "");
const environment = requiredEnv("WWHN_181_ENVIRONMENT").toUpperCase();
if (FORBIDDEN_ENVIRONMENTS.has(environment)) {
  fail(`Environment ${environment} is forbidden for release evidence`);
}
const sourceSha = requiredEnv("WWHN_181_SOURCE_SHA");
if (!/^[a-f0-9]{40}$/.test(sourceSha)) fail("WWHN_181_SOURCE_SHA must be exact 40-hex SHA");
const buildId = requiredEnv("WWHN_181_BUILD_ID");
const qa2Account = requiredEnv("WWHN_181_QA2_ACCOUNT");
const qa2Role = requiredEnv("WWHN_181_QA2_ROLE");
if (requiredEnv("WWHN_181_TEST_DATA_CLASSIFICATION") !== "SANITIZED_NON_PROD") {
  fail("Only SANITIZED_NON_PROD test data is allowed");
}
const scenarios = parseScenarios(requiredEnv("WWHN_181_UI_SCENARIOS_JSON"));
verifyViewportMatrix(scenarios);

const outputDir = path.resolve(
  process.env.WWHN_181_UI_OUTPUT_DIR ??
    `artifacts/WWHN-181/ui-runtime/${sourceSha}`,
);
const screenshotDir = path.join(outputDir, "screenshots");
const videoDir = path.join(outputDir, "videos");
fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const apiTrace = [];
const results = [];
let realApiErrorWithRequestId = false;

try {
  for (const scenario of scenarios) {
    const storagePath = scenario.storage_state_env
      ? requiredEnv(String(scenario.storage_state_env))
      : requiredEnv("WWHN_181_STORAGE_STATE_PATH");
    if (!fs.existsSync(storagePath)) {
      fail(`Storage state for ${scenario.id} does not exist: ${storagePath}`);
    }
    const context = await browser.newContext({
      viewport: scenario.viewport,
      storageState: storagePath,
      recordVideo: {
        dir: videoDir,
        size: scenario.viewport,
      },
    });
    const page = await context.newPage();
    const responseTasks = [];
    page.on("response", (response) => {
      const task = (async () => {
        const url = new URL(response.url());
        if (!url.pathname.startsWith("/api/v1/")) return;
        const entry = {
          scenario_id: scenario.id,
          method: response.request().method(),
          path: url.pathname,
          status: response.status(),
          status_text: response.statusText(),
          request_id: undefined,
          error_code: undefined,
        };
        if (response.status() >= 400) {
          try {
            const body = await response.json();
            entry.request_id = requestIdOf(body);
            entry.error_code = errorCodeOf(body);
          } catch {
            // Non-JSON error body is still traced without copying the body.
          }
          if (entry.request_id) realApiErrorWithRequestId = true;
        }
        apiTrace.push(entry);
      })();
      responseTasks.push(task);
    });

    const startedAt = new Date().toISOString();
    const scenarioResult = {
      id: scenario.id,
      role: scenario.role ?? qa2Role,
      path: scenario.path,
      viewport: scenario.viewport,
      started_at: startedAt,
      result: "PASS",
      horizontal_overflow: false,
      screenshot: null,
      video: null,
      error: null,
    };
    const video = page.video();
    try {
      await page.goto(`${baseUrl}${scenario.path}`, {
        waitUntil: "networkidle",
        timeout: Number(scenario.navigation_timeout_ms ?? 30_000),
      });
      for (const action of scenario.actions ?? []) {
        await performAction(page, action);
      }
      if (scenario.wait_after_ms) {
        await page.waitForTimeout(Number(scenario.wait_after_ms));
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      scenarioResult.horizontal_overflow = overflow;
      if (overflow && scenario.allow_horizontal_overflow !== true) {
        throw new Error("Unexpected page-level horizontal overflow");
      }
      const screenshot = path.join(
        screenshotDir,
        `${safeName(scenario.id)}-${scenario.viewport.width}x${scenario.viewport.height}.png`,
      );
      await page.screenshot({ path: screenshot, fullPage: true });
      scenarioResult.screenshot = path.relative(outputDir, screenshot).replaceAll("\\", "/");
    } catch (error) {
      scenarioResult.result = "FAIL";
      scenarioResult.error = error instanceof Error ? error.message : String(error);
      const screenshot = path.join(
        screenshotDir,
        `${safeName(scenario.id)}-${scenario.viewport.width}x${scenario.viewport.height}-FAIL.png`,
      );
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      if (fs.existsSync(screenshot)) {
        scenarioResult.screenshot = path.relative(outputDir, screenshot).replaceAll("\\", "/");
      }
    } finally {
      await Promise.allSettled(responseTasks);
      await context.close();
      if (video) {
        const videoPath = await video.path().catch(() => null);
        if (videoPath && fs.existsSync(videoPath)) {
          const renamed = path.join(
            videoDir,
            `${safeName(scenario.id)}-${scenario.viewport.width}x${scenario.viewport.height}.webm`,
          );
          if (videoPath !== renamed) fs.renameSync(videoPath, renamed);
          scenarioResult.video = path.relative(outputDir, renamed).replaceAll("\\", "/");
        }
      }
      scenarioResult.finished_at = new Date().toISOString();
      results.push(scenarioResult);
    }
  }
} finally {
  await browser.close();
}

const harPath = path.join(outputDir, "WWHN-181_SANITIZED.har.json");
fs.writeFileSync(
  harPath,
  `${JSON.stringify(
    {
      schema_version: "1.0.0",
      sanitization: "NO_HEADERS_COOKIES_QUERY_OR_BODIES",
      entries: apiTrace,
    },
    null,
    2,
  )}\n`,
);

const summary = {
  schema_version: "1.0.0",
  task: "WWHN-181",
  evidence_type: "LIVE_UI_RUNTIME",
  collected_at: new Date().toISOString(),
  identity: {
    source_sha: sourceSha,
    build_id: buildId,
    environment,
    base_origin: new URL(baseUrl).origin,
    qa2_account: qa2Account,
    qa2_role: qa2Role,
    test_data_classification: "SANITIZED_NON_PROD",
  },
  rules: contract.rules,
  result:
    results.every((scenario) => scenario.result === "PASS") &&
    realApiErrorWithRequestId
      ? "PASS"
      : "FAIL",
  real_api_error_with_request_id: realApiErrorWithRequestId ? "PASS" : "FAIL",
  responsive_matrix: "PASS",
  sanitized_har: "PASS",
  scenarios: results,
  api_trace_entry_count: apiTrace.length,
};
const summaryPath = path.join(outputDir, "WWHN-181_UI_RUNTIME_SUMMARY.json");
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.name !== "SHA256SUMS") files.push(absolute);
  }
}
walk(outputDir);
const checksums = files
  .sort()
  .map((file) => {
    const relative = path.relative(outputDir, file).replaceAll("\\", "/");
    return `${sha256(fs.readFileSync(file))}  ${relative}`;
  })
  .join("\n");
fs.writeFileSync(path.join(outputDir, "SHA256SUMS"), `${checksums}\n`);
fs.writeFileSync(
  path.join(outputDir, "SHA256SUMS.sha256"),
  `${sha256(Buffer.from(`${checksums}\n`))}  SHA256SUMS\n`,
);

console.log(JSON.stringify(summary, null, 2));
console.log(`Evidence directory: ${outputDir}`);
if (summary.result !== "PASS") process.exit(1);
