/**
 * WWHN-274 / FE274-P1-06 — Real-environment FE-BE integration smoke.
 *
 * Ranh giới sự thật (KHÁC với e2e/wwhn-274-release-signoff.spec.ts):
 * - File kia là bằng chứng FE-controlled: API bị mock bằng `page.route`, chỉ chứng minh
 *   hành vi FE tất định. Nó KHÔNG chứng minh FE nói chuyện được với backend thật.
 * - File này KHÔNG được phép mock bất kỳ request nào. Mọi response phải đến từ backend
 *   thật đang chạy (`WWHN_274_REAL_API_BASE_URL`) và từ FE build đã deploy
 *   (`WWHN_274_REAL_BASE_URL`). Verifier `scripts/verify-wwhn-274-closure.mjs` chặn
 *   `page.route(` trong file này để invariant "no-mock" không thể bị phá âm thầm.
 *
 * Fail-closed: khi `WWHN_274_REQUIRE_REAL_ENV=1` mà thiếu cấu hình thì test ĐỎ, không skip.
 * Skip im lặng bị cấm vì một lần skip = một lần claim PASS giả cho release sign-off.
 *
 * Baseline: SRS v1.12 NFR-SRS-005 (backend là biên bảo mật), Techstack Guide "API base
 * luôn kết thúc ở /api/v1", `VITE_API_WITH_CREDENTIALS=true` cho HttpOnly refresh cookie.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  expect,
  test,
  type APIResponse,
  type Page,
  type TestInfo,
} from "@playwright/test";

const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const APP_ENV = process.env.VITE_APP_ENV ?? "local-real-env";
const BUILD_VERSION = process.env.VITE_APP_VERSION ?? "local-dev";

const REAL_BASE_URL = (
  process.env.WWHN_274_REAL_BASE_URL ??
  process.env.E2E_BASE_URL ??
  ""
).replace(/\/+$/u, "");
const REAL_API_BASE_URL = (
  process.env.WWHN_274_REAL_API_BASE_URL ??
  process.env.VITE_API_BASE_URL ??
  ""
).replace(/\/+$/u, "");
const REAL_USER = process.env.WWHN_274_REAL_USER ?? "";
const REAL_PASSWORD = process.env.WWHN_274_REAL_PASSWORD ?? "";
const REQUIRE_REAL_ENV = process.env.WWHN_274_REQUIRE_REAL_ENV === "1";
const REQUIRE_AUTHENTICATED =
  process.env.WWHN_274_REQUIRE_AUTHENTICATED === "1";

// Xem ghi chú cùng chỗ trong e2e/wwhn-274-release-signoff.spec.ts: test-results/ bị
// Playwright dọn ở đầu mỗi run và bị .gitignore, nên không dùng làm nơi giữ evidence.
const EVIDENCE_ROOT =
  process.env.WWHN_274_REAL_EVIDENCE_DIR ??
  join("docs", "evidence", "WWHN-274", "generated", SOURCE_SHA, "real-env");

interface RealEvidence {
  scenario: string;
  result: "PASS" | "NOT_EXECUTED";
  assertions: string[];
  observed: Record<string, unknown>;
}

interface ApiTrafficEntry {
  method: string;
  url: string;
  status: number;
}

function apiOrigin(): string {
  return new URL(REAL_API_BASE_URL).origin;
}

/** Cấu hình tối thiểu để bài test có nghĩa. Thiếu thì đỏ (khi bắt buộc) hoặc skip có ghi nhận. */
function requireRealEnv(): void {
  const missing: string[] = [];
  if (!REAL_BASE_URL) missing.push("WWHN_274_REAL_BASE_URL");
  if (!REAL_API_BASE_URL) missing.push("WWHN_274_REAL_API_BASE_URL");
  if (missing.length === 0) {
    if (!REAL_API_BASE_URL.endsWith("/api/v1")) {
      throw new Error(
        `Canonical API contract vi pham: WWHN_274_REAL_API_BASE_URL phai ket thuc o /api/v1 nhung la "${REAL_API_BASE_URL}"`,
      );
    }
    return;
  }
  const reason = `Real-env smoke chua duoc cau hinh: thieu ${missing.join(", ")}`;
  if (REQUIRE_REAL_ENV) {
    throw new Error(
      `${reason} (WWHN_274_REQUIRE_REAL_ENV=1 nen day la FAIL, khong phai skip)`,
    );
  }
  test.skip(true, reason);
}

function requireCredentials(): void {
  if (REAL_USER && REAL_PASSWORD) return;
  const reason =
    "Thieu WWHN_274_REAL_USER/WWHN_274_REAL_PASSWORD cho luong da dang nhap";
  if (REQUIRE_AUTHENTICATED) {
    throw new Error(`${reason} (WWHN_274_REQUIRE_AUTHENTICATED=1 nen day la FAIL)`);
  }
  test.skip(true, reason);
}

async function writeRealEvidence(
  testInfo: TestInfo,
  input: RealEvidence,
): Promise<void> {
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const payload = {
    ticket: "WWHN-274",
    finding: "FE274-P1-06",
    parent: "WWHN-72",
    evidenceClass: "FE_BE_REAL_INTEGRATION_NOT_QA_UAT",
    scenario: input.scenario,
    result: input.result,
    sourceSha: SOURCE_SHA,
    environment: APP_ENV,
    buildVersion: BUILD_VERSION,
    frontendBaseUrl: REAL_BASE_URL,
    apiBaseUrl: REAL_API_BASE_URL,
    browserProject: testInfo.project.name,
    timestamp: new Date().toISOString(),
    assertions: input.assertions,
    observed: input.observed,
    truthBoundary:
      "Bang chung tich hop that FE-BE tren build da deploy. KHONG thay the QA1 release smoke (WWHN-275) va KHONG phai bang chung deploy/backup/rollback cua DevOps (WWHN-272).",
  };
  const file = `WWHN-274__real-env__${input.scenario}.json`;
  writeFileSync(
    join(EVIDENCE_ROOT, file),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  await testInfo.attach("wwhn-274-real-env-evidence", {
    body: Buffer.from(JSON.stringify(payload, null, 2)),
    contentType: "application/json",
  });
}

/**
 * Đọc envelope JSON của backend thật, và khi backend KHÔNG trả JSON thì báo đúng
 * nguyên nhân.
 *
 * `response.json()` trên một trang lỗi PHP/nginx chỉ ném `SyntaxError: Unexpected
 * token '<'`, khiến người đọc kết quả tưởng hợp đồng API sai trong khi thực tế là
 * backend đang hỏng (thiếu vendor, 502 của proxy, trang lỗi của WAF...). Với một bộ
 * kiểm dùng để sign-off release, thông báo phải chỉ thẳng vào backend.
 */
async function readJsonEnvelope(
  response: APIResponse,
  label: string,
): Promise<unknown> {
  const contentType = response.headers()["content-type"] ?? "";
  const raw = await response.text();
  if (!contentType.includes("json")) {
    throw new Error(
      `${label} tra content-type "${contentType || "(khong co)"}" thay vi JSON ` +
        `(HTTP ${response.status()}). Backend that dang khong phuc vu envelope API. ` +
        `Doan dau body: ${raw.slice(0, 300)}`,
    );
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(
      `${label} khai bao JSON nhung parse that bai: ${(error as Error).message}. ` +
        `Doan dau body: ${raw.slice(0, 300)}`,
    );
  }
}

/** Ghi lại mọi lưu lượng thật FE tới API để chứng minh không có mock nào chen vào. */
function recordApiTraffic(page: Page): ApiTrafficEntry[] {
  const traffic: ApiTrafficEntry[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith(REAL_API_BASE_URL)) return;
    traffic.push({
      method: response.request().method(),
      url,
      status: response.status(),
    });
  });
  return traffic;
}

test.describe("WWHN-274 real-environment FE-BE smoke", () => {
  test.describe.configure({ mode: "serial" });

  test("real backend health contract on canonical /api/v1", async ({
    request,
  }, testInfo) => {
    requireRealEnv();

    const health: APIResponse = await request.get(`${REAL_API_BASE_URL}/health`);
    expect([200, 503]).toContain(health.status());
    const body = (await readJsonEnvelope(health, "GET {api}/health")) as Record<
      string,
      unknown
    >;
    expect(body).toHaveProperty("success");

    // Envelope chuẩn: payload health nằm ở data (200) hoặc errors (503 degraded).
    const payload = (body.data ?? body.errors ?? {}) as Record<string, unknown>;
    const checks = (payload.checks ?? {}) as Record<
      string,
      { status?: string } | undefined
    >;
    expect(Object.keys(checks)).toEqual(
      expect.arrayContaining(["app", "database", "migrations"]),
    );
    expect(checks.database?.status).toBe("ok");
    expect(checks.migrations?.status).toBe("ok");

    // Chống tái phát W274-P0-01: route health không phiên bản phải không tồn tại.
    const legacy = await request.get(`${apiOrigin()}/api/health`);
    expect(legacy.status()).toBe(404);

    await writeRealEvidence(testInfo, {
      scenario: "backend-health-canonical",
      result: "PASS",
      assertions: [
        "GET {api}/health tra envelope chuan tu backend that",
        "checks.database va checks.migrations = ok",
        "GET {origin}/api/health legacy = 404 (canonical /api/v1 giu nguyen)",
      ],
      observed: {
        healthStatus: health.status(),
        legacyHealthStatus: legacy.status(),
        appEnvironment: payload.environment ?? null,
        version: payload.version ?? null,
        build: payload.build ?? null,
        checks,
      },
    });
  });

  test("protected API fails closed without a session", async ({
    request,
  }, testInfo) => {
    requireRealEnv();

    const protectedRead = await request.get(`${REAL_API_BASE_URL}/skus`, {
      headers: { Accept: "application/json" },
    });
    expect(protectedRead.status()).toBe(401);
    const body = (await readJsonEnvelope(
      protectedRead,
      "GET {api}/skus (khong phien)",
    )) as Record<string, unknown>;
    expect(body.success).toBe(false);

    await writeRealEvidence(testInfo, {
      scenario: "protected-api-401-fail-closed",
      result: "PASS",
      assertions: [
        "GET {api}/skus khong co phien tra 401 tu backend that (NFR-SRS-005)",
        "Envelope loi giu success=false",
      ],
      observed: {
        status: protectedRead.status(),
        errorCode: body.error_code ?? null,
      },
    });
  });

  test("deployed FE boots against the real API and guards protected routes", async ({
    page,
  }, testInfo) => {
    requireRealEnv();
    const traffic = recordApiTraffic(page);

    await page.goto(`${REAL_BASE_URL}/dashboard`);
    await page.waitForURL(/\/login$/u, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Đăng nhập hệ thống" }),
    ).toBeVisible();

    // Bootstrap phiên phải thực sự chạm backend thật (không mock, không stub).
    const refreshCalls = traffic.filter((entry) =>
      entry.url.endsWith("/auth/refresh"),
    );
    expect(refreshCalls.length).toBeGreaterThan(0);

    await writeRealEvidence(testInfo, {
      scenario: "deployed-fe-guard-and-bootstrap",
      result: "PASS",
      assertions: [
        "Build FE da deploy tai duoc tu WWHN_274_REAL_BASE_URL",
        "Route /dashboard chua dang nhap fail-closed ve /login",
        "Bootstrap goi that {api}/auth/refresh (khong mock)",
      ],
      observed: { apiTraffic: traffic, finalUrl: page.url() },
    });
  });

  test("real login rejection stays visible and retry-safe", async ({
    page,
  }, testInfo) => {
    requireRealEnv();
    const traffic = recordApiTraffic(page);

    await page.goto(`${REAL_BASE_URL}/login`);
    await page
      .locator('input[name="identifier"]')
      .fill("wwhn274.invalid@hoanam.local");
    await page
      .locator('input[name="password"]')
      .fill("wwhn-274-invalid-password");

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/auth/login") &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Đăng nhập" }).click(),
    ]);

    expect([401, 422]).toContain(loginResponse.status());
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
    await expect(page).toHaveURL(/\/login$/u);

    await writeRealEvidence(testInfo, {
      scenario: "real-login-rejection-retry-safe",
      result: "PASS",
      assertions: [
        "POST {api}/auth/login sai thong tin tra 401/422 tu backend that",
        "Nguoi dung van o /login va nut dang nhap con bam lai duoc",
      ],
      observed: { loginStatus: loginResponse.status(), apiTraffic: traffic },
    });
  });

  test("authenticated session survives reload and serves a representative read", async ({
    page,
  }, testInfo) => {
    requireRealEnv();
    requireCredentials();
    const traffic = recordApiTraffic(page);

    await page.goto(`${REAL_BASE_URL}/login`);
    await page.locator('input[name="identifier"]').fill(REAL_USER);
    await page.locator('input[name="password"]').fill(REAL_PASSWORD);

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/auth/login") &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Đăng nhập" }).click(),
    ]);
    expect(loginResponse.status()).toBe(200);

    await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
      timeout: 30_000,
    });
    await expect(page.getByTestId("primary-navigation")).toBeVisible();

    const meCalls = traffic.filter(
      (entry) => entry.url.endsWith("/auth/me") && entry.status === 200,
    );
    expect(meCalls.length).toBeGreaterThan(0);

    // F5: phiên phải sống lại qua HttpOnly refresh cookie (VITE_API_WITH_CREDENTIALS=true).
    const urlBeforeReload = page.url();
    await page.reload();
    await expect(page.getByTestId("primary-navigation")).toBeVisible({
      timeout: 30_000,
    });
    expect(page.url()).toBe(urlBeforeReload);

    // Doc nghiep vu sau F5 la bat dong bo: chup `traffic` ngay khi shell hien ra se
    // dem hut cac request con dang bay va bai test do ngau nhien. Cho den khi that su
    // co it nhat mot GET nghiep vu 200, thay vi dem mot lan roi ket luan.
    const isRepresentativeRead = (entry: ApiTrafficEntry): boolean =>
      entry.method === "GET" &&
      entry.status === 200 &&
      !entry.url.endsWith("/auth/me");

    await expect
      .poll(() => traffic.filter(isRepresentativeRead).length, {
        timeout: 30_000,
        message:
          "Sau khi dang nhap that va F5, khong co GET nghiep vu nao tra 200 tu backend that",
      })
      .toBeGreaterThan(0);

    const representativeReads = traffic.filter(isRepresentativeRead);

    await writeRealEvidence(testInfo, {
      scenario: "authenticated-session-and-representative-read",
      result: "PASS",
      assertions: [
        "Dang nhap that tra 200 va dieu huong khoi /login",
        "GET {api}/auth/me 200 nap permission that",
        "F5 giu phien qua HttpOnly refresh cookie",
        "Co it nhat mot GET nghiep vu 200 tu backend that",
      ],
      observed: {
        loginStatus: loginResponse.status(),
        urlAfterLogin: urlBeforeReload,
        representativeReads: representativeReads.slice(0, 20),
      },
    });
  });
});
