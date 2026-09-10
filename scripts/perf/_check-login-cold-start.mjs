#!/usr/bin/env node
/**
 * KIỂM: đăng nhập NGAY khi vừa mở trang (gõ nhanh, Enter tức thì) có bị race với
 * phần khởi động của app không.
 *
 * Bối cảnh (10/09/2026): tester chụp màn "Không kết nối được hệ thống" và mô tả
 * "gõ nhanh thì lỗi, gõ chậm lại thì được". Ba thứ chạy NGAY lúc mở /login và có
 * thể đụng vào request đăng nhập:
 *   1. service worker cài lần đầu + `clients.claim()` → `controllerchange`;
 *   2. `bootstrapAuth` gọi POST /auth/refresh khi còn dấu vết phiên cũ (cookie
 *      `erp-auth`) — nếu refresh trả 401 SAU khi login đã xong, nó xoá luôn phiên mới;
 *   3. chế độ máy quét (VITE_SCANNER_KIOSK_MODE=true, đang bật trên UAT) tự áp bản
 *      cập nhật service worker → reload trang ngay giữa lúc người dùng đăng nhập.
 *
 * Harness chạy trên BẢN BUILD PRODUCTION thật (service worker chỉ đăng ký ở PROD)
 * và một máy chủ giả lập CÙNG ORIGIN, HTTP/1.1 — đúng hình dạng của
 * khohoanamfe.lptech.info.vn (nginx phục vụ dist/ và proxy /api/v1). Không đụng
 * BE thật, không dùng tài khoản thật: API đăng nhập giả lập chỉ nhận email/mật
 * khẩu giả (`ok.*@example.test` = đúng, còn lại = 401).
 *
 * Chạy (PowerShell, từ gốc repo):
 *   $env:VITE_API_BASE_URL='http://localhost:5288/api/v1'; $env:VITE_APP_ENV='local'
 *   $env:VITE_SCANNER_KIOSK_MODE='true'; $env:VITE_RUM_SAMPLE_RATE='0'
 *   $env:WMS_BUILD_ID='race-a'; yarn vite build --outDir ..\race-a --emptyOutDir
 *   $env:WMS_BUILD_ID='race-b'; yarn vite build --outDir ..\race-b --emptyOutDir
 *   node scripts/perf/_check-login-cold-start.mjs --dist-a ..\race-a --dist-b ..\race-b
 *
 * Tuỳ chọn: --iterations 50 (cold) · --hint-iterations 10 · --update-iterations 5
 *           --scenarios cold,hint,update · --channel msedge · --json <file> · --headed
 *           RACE_DEBUG=1 in thêm nhật ký máy chủ + console của trang cho từng lượt.
 *
 * Tiêu chí đạt của MỖI lượt: đúng 1 POST /auth/login, 0 request API bị huỷ/hỏng,
 * 0 lần tải lại trang ngoài ý muốn, 0 POST /auth/refresh trên phiên sạch, và kết
 * quả là một HTTP response bình thường (200 vào hệ thống / 401 báo sai mật khẩu).
 * Lượt nào KHÔNG dựng được đúng tình huống cần kiểm (không có refresh song song,
 * bản cập nhật không được áp) cũng tính là trượt — không để đạt suông.
 * Thoát mã 1 nếu có lượt trượt.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";

const DEBUG = process.env.RACE_DEBUG === "1";
const FAKE_PASSWORD = "not-a-real-password";
/** Thông điệp 401 của API giả — thấy nó trong UI nghĩa là request đã nhận response thật. */
const MOCK_INVALID_MESSAGE = "MOCK_INVALID_CREDENTIALS";
const UI_ERROR_NETWORK = "Không kết nối được hệ thống";
const UI_ERROR_TIMEOUT = "Máy chủ phản hồi quá thời gian";

const USER = {
  id: "u-race-01",
  user_id: "u-race-01",
  username: "race.qa",
  email: "ok.race@example.test",
  display_name: "Race QA",
  name: "Race QA",
  status: "ACTIVE",
  roles: [
    { role_id: "r-super", role_code: "SUPER_ADMIN", role_name: "Super Admin", scope_ref: null },
  ],
  permissions: ["dashboard.view"],
  warehouse_scope_ids: [],
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const now = () => Math.round(performance.now());

function parseArgs(argv) {
  const args = {
    port: 5288,
    iterations: 50,
    hintIterations: 10,
    updateIterations: 5,
    scenarios: ["cold", "hint", "update"],
    channel: undefined,
    distA: undefined,
    distB: undefined,
    json: undefined,
    headed: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const [key, inline] = argv[index].split("=", 2);
    const value = () => inline ?? argv[++index];
    switch (key) {
      case "--dist-a": args.distA = resolve(value()); break;
      case "--dist-b": args.distB = resolve(value()); break;
      case "--port": args.port = Number(value()); break;
      case "--iterations": args.iterations = Number(value()); break;
      case "--hint-iterations": args.hintIterations = Number(value()); break;
      case "--update-iterations": args.updateIterations = Number(value()); break;
      case "--scenarios": args.scenarios = value().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--channel": args.channel = value(); break;
      case "--json": args.json = resolve(value()); break;
      case "--headed": args.headed = true; break;
      default: throw new Error(`Tham số không hợp lệ: ${argv[index]}`);
    }
  }
  if (!args.distA || !existsSync(join(args.distA, "index.html"))) {
    throw new Error("Thiếu --dist-a <thư mục build có index.html>");
  }
  if (args.scenarios.includes("update") && (!args.distB || !existsSync(join(args.distB, "index.html")))) {
    throw new Error("Kịch bản update cần --dist-b: một bản build KHÁC WMS_BUILD_ID");
  }
  return args;
}

/**
 * Máy chủ tĩnh + API giả lập trên CÙNG một origin. Header cache theo đúng mẫu
 * deploy/nginx/frontend.conf.example (assets immutable, còn lại no-cache).
 */
function createMockServer() {
  const state = {
    dist: "",
    log: [],
    refreshDelayMs: 0,
    loginDelayMs: 0,
    refreshTokens: new Set(),
    seq: 0,
  };
  const note = (kind, extra = {}) => state.log.push({ kind, t: now(), ...extra });

  function sendJson(res, status, body, headers = {}) {
    if (res.writableEnded || res.destroyed) return;
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    });
    res.end(JSON.stringify(body));
  }

  function readBody(req) {
    return new Promise((done) => {
      let raw = "";
      req.on("data", (chunk) => { raw += chunk; });
      req.on("end", () => done(raw));
      req.on("error", () => done(raw));
    });
  }

  function cookies(req) {
    return Object.fromEntries(
      (req.headers.cookie ?? "")
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const at = part.indexOf("=");
          return [part.slice(0, at), part.slice(at + 1)];
        }),
    );
  }

  function issueRefreshCookie() {
    const value = `rt-${++state.seq}`;
    state.refreshTokens.add(value);
    return `wms_refresh_token=${value}; HttpOnly; Path=/api/v1/auth; SameSite=Lax`;
  }

  async function handleApi(req, res, path) {
    const method = req.method ?? "GET";

    if (method === "POST" && path === "/api/v1/auth/login") {
      const id = ++state.seq;
      note("login-start", { id });
      res.on("close", () => {
        if (!res.writableEnded) note("login-client-aborted", { id });
      });
      let body = {};
      try {
        body = JSON.parse((await readBody(req)) || "{}");
      } catch {
        body = {};
      }
      await sleep(state.loginDelayMs);
      if (res.destroyed) return;
      if (typeof body.email !== "string" || typeof body.password !== "string") {
        note("login-end", { id, status: 422 });
        return sendJson(res, 422, { success: false, message: "MOCK_VALIDATION", error_code: "VALIDATION_ERROR" });
      }
      if (!body.email.startsWith("ok.")) {
        note("login-end", { id, status: 401 });
        return sendJson(res, 401, { success: false, message: MOCK_INVALID_MESSAGE, error_code: "INVALID_CREDENTIALS" });
      }
      note("login-end", { id, status: 200 });
      return sendJson(
        res,
        200,
        { success: true, data: { access_token: `acc-${id}`, token_type: "bearer", expires_in: 3600, user: USER } },
        { "Set-Cookie": issueRefreshCookie() },
      );
    }

    if (method === "POST" && path === "/api/v1/auth/refresh") {
      const id = ++state.seq;
      const current = cookies(req).wms_refresh_token;
      note("refresh-start", { id, cookie: Boolean(current) });
      await readBody(req);
      await sleep(state.refreshDelayMs);
      if (current && state.refreshTokens.has(current)) {
        state.refreshTokens.delete(current);
        note("refresh-end", { id, status: 200 });
        return sendJson(
          res,
          200,
          { success: true, data: { access_token: `acc-${id}`, token_type: "bearer", expires_in: 3600, user: USER } },
          { "Set-Cookie": issueRefreshCookie() },
        );
      }
      note("refresh-end", { id, status: 401 });
      return sendJson(res, 401, { success: false, message: "Unauthenticated.", error_code: "UNAUTHENTICATED" });
    }

    if (path === "/api/v1/auth/me") {
      if (!(req.headers.authorization ?? "").startsWith("Bearer acc-")) {
        return sendJson(res, 401, { success: false, message: "Unauthenticated.", error_code: "UNAUTHENTICATED" });
      }
      return sendJson(res, 200, { success: true, data: USER });
    }

    if (path === "/api/v1/telemetry/vitals") {
      res.writeHead(204);
      return res.end();
    }

    if (method === "GET") {
      return sendJson(res, 200, {
        success: true,
        data: [],
        meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
      });
    }
    await readBody(req);
    return sendJson(res, 200, { success: true, data: {} });
  }

  function handleStatic(res, path) {
    const root = state.dist;
    const target = normalize(join(root, path));
    const inside = target === root || target.startsWith(root + sep);
    let file = inside && existsSync(target) && statSync(target).isFile() ? target : null;
    if (!file) {
      if (path.startsWith("/assets/")) {
        res.writeHead(404, { "Cache-Control": "no-store" });
        return res.end();
      }
      file = join(root, "index.html");
    }
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
      "Cache-Control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(readFileSync(file));
  }

  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    if (path.startsWith("/api/")) {
      handleApi(req, res, path).catch((error) =>
        sendJson(res, 500, { success: false, message: String(error) }),
      );
      return;
    }
    handleStatic(res, path);
  });

  return {
    listen: (port) =>
      new Promise((done, fail) => {
        server.once("error", fail);
        server.listen(port, () => done());
      }),
    close: () =>
      new Promise((done) => {
        server.closeAllConnections?.();
        server.close(() => done());
      }),
    setDist: (dir) => { state.dist = dir; },
    reset: ({ refreshDelayMs = 0, loginDelayMs = 0 } = {}) => {
      state.log = [];
      state.refreshDelayMs = refreshDelayMs;
      state.loginDelayMs = loginDelayMs;
    },
    log: () => state.log,
  };
}

function watchPage(page, origin) {
  const events = { docLoads: [], failedApi: [], loginResponses: [], console: [] };
  page.on("domcontentloaded", () => events.docLoads.push(now()));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith("/api/")) {
      events.failedApi.push({ path: url.pathname, error: request.failure()?.errorText ?? "?", t: now() });
    }
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/v1/auth/login") {
      events.loginResponses.push({ status: response.status(), t: now() });
    }
  });
  if (DEBUG) page.on("console", (message) => events.console.push(`${now()} ${message.type()}: ${message.text()}`));
  return events;
}

/** Chờ điều kiện trong trang; trang đang điều hướng thì thử lại thay vì ném lỗi. */
async function waitUntil(page, predicate, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await page.evaluate(predicate)) return true;
    } catch {
      // context bị huỷ vì điều hướng — thử lại ở vòng sau
    }
    await sleep(50);
  }
  return false;
}

async function readOutcome(page) {
  const path = new URL(page.url()).pathname;
  try {
    return await page.evaluate(() => ({
      path: location.pathname,
      alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? null,
      diagnostic:
        document.querySelector('[data-testid="login-transport-diagnostic"]')?.textContent?.trim() ?? null,
    }));
  } catch {
    return { path, alert: null, diagnostic: null };
  }
}

function describeAlert(alert) {
  if (!alert) return "không có thông báo";
  if (alert.includes(UI_ERROR_NETWORK)) return `errorNetwork ("${alert}")`;
  if (alert.includes(UI_ERROR_TIMEOUT)) return `errorTimeout ("${alert}")`;
  return `"${alert}"`;
}

/** Gõ như người gõ nhanh: từng phím, không trễ, Enter ngay khi xong. */
async function typeCredentials(page, email) {
  const emailBox = page.getByLabel("Email", { exact: true });
  await emailBox.waitFor({ state: "visible", timeout: 15_000 });
  await emailBox.pressSequentially(email, { delay: 0 });
  const passwordBox = page.getByLabel("Mật khẩu", { exact: true });
  await passwordBox.pressSequentially(FAKE_PASSWORD, { delay: 0 });
  const submittedAt = now();
  await passwordBox.press("Enter");
  return submittedAt;
}

const hasOutcome = () =>
  location.pathname !== "/login" || Boolean(document.querySelector('[role="alert"]'));

function debugRow(row, server, events) {
  if (!DEBUG) return row;
  return {
    ...row,
    serverLog: server.log().map((e) => `${e.t} ${e.kind}${e.status ? ` ${e.status}` : ""}${e.cookie !== undefined ? ` cookie=${e.cookie}` : ""}`),
    docLoads: events.docLoads,
    console: events.console.slice(0, 40),
  };
}

async function scenarioCold(browser, server, args, origin) {
  server.setDist(args.distA);
  const rows = [];
  for (let i = 1; i <= args.iterations; i += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const events = watchPage(page, origin);
    server.reset();
    const valid = i % 2 === 0;
    const problems = [];
    let outcome = null;
    try {
      await page.goto(`${origin}/login`, { waitUntil: "commit" });
      await typeCredentials(page, `${valid ? "ok" : "wrong"}.cold${i}@example.test`);
      if (!(await waitUntil(page, hasOutcome, 10_000))) problems.push("không có kết quả đăng nhập sau 10 s");
      // Cửa sổ service worker cài lần đầu + clients.claim(): reload (nếu có) rơi vào đây.
      await page.waitForTimeout(1_500);
      outcome = await readOutcome(page);
    } catch (error) {
      problems.push(`harness: ${String(error.message).split("\n")[0]}`);
    }
    const log = server.log();
    const loginPosts = log.filter((e) => e.kind === "login-start").length;
    const refreshPosts = log.filter((e) => e.kind === "refresh-start").length;
    if (loginPosts !== 1) problems.push(`POST /auth/login = ${loginPosts} (cần đúng 1)`);
    if (refreshPosts !== 0) problems.push(`POST /auth/refresh = ${refreshPosts} trên trình duyệt sạch (cần 0)`);
    if (events.failedApi.length) {
      problems.push(`request API hỏng: ${events.failedApi.map((f) => `${f.path} ${f.error}`).join(", ")}`);
    }
    if (events.docLoads.length !== 1) problems.push(`trang tải ${events.docLoads.length} lần (cần 1)`);
    if (outcome && valid && outcome.path === "/login") {
      problems.push(`thông tin đúng nhưng vẫn ở /login: ${describeAlert(outcome.alert)}`);
    }
    if (outcome && !valid && !(outcome.alert ?? "").includes(MOCK_INVALID_MESSAGE)) {
      problems.push(`không thấy phản hồi 401 bình thường: ${describeAlert(outcome.alert)}`);
    }
    rows.push(debugRow({ i, valid, ok: problems.length === 0, problems, outcome, loginPosts, refreshPosts }, server, events));
    await context.close();
  }
  return rows;
}

async function scenarioHint(browser, server, args, origin) {
  server.setDist(args.distA);
  const rows = [];
  for (let i = 1; i <= args.hintIterations; i += 1) {
    const context = await browser.newContext();
    // Dấu vết phiên cũ (hồ sơ không nhạy cảm do zustand persist ghi) → bootstrap sẽ refresh.
    await context.addCookies([
      {
        name: "erp-auth",
        value: encodeURIComponent(JSON.stringify({ state: { user: USER, contexts: [] }, version: 0 })),
        url: origin,
      },
    ]);
    const page = await context.newPage();
    const events = watchPage(page, origin);
    // Refresh chậm và trả 401 (cookie refresh đã hết hạn) — trả về SAU khi người dùng bấm đăng nhập.
    server.reset({ refreshDelayMs: 2_500 });
    const problems = [];
    let outcome = null;
    let hintVisible = null;
    let submittedAt = null;
    try {
      await page.goto(`${origin}/login`, { waitUntil: "commit" });
      hintVisible = await page.evaluate(() => document.cookie.includes("erp-auth")).catch(() => null);
      submittedAt = await typeCredentials(page, `ok.hint${i}@example.test`);
      if (!(await waitUntil(page, hasOutcome, 10_000))) problems.push("không có kết quả đăng nhập sau 10 s");
      const deadline = Date.now() + 6_000;
      while (Date.now() < deadline && !server.log().some((e) => e.kind === "refresh-end")) await sleep(50);
      await page.waitForTimeout(1_500);
      outcome = await readOutcome(page);
    } catch (error) {
      problems.push(`harness: ${String(error.message).split("\n")[0]}`);
    }
    const log = server.log();
    const loginStart = log.find((e) => e.kind === "login-start");
    const refreshStart = log.find((e) => e.kind === "refresh-start");
    const refreshEnd = log.find((e) => e.kind === "refresh-end");
    const loginPosts = log.filter((e) => e.kind === "login-start").length;
    if (!refreshStart) {
      problems.push(`bootstrap không gọi /auth/refresh dù có dấu vết phiên (cookie thấy được: ${hintVisible}) — không dựng được race`);
    } else if (submittedAt !== null && submittedAt > (refreshEnd?.t ?? Infinity)) {
      // So với lúc BẤM Enter, không phải lúc máy chủ nhận login: bản đã vá cố ý gửi
      // login sau khi refresh xong, nên mốc máy chủ luôn muộn hơn.
      problems.push("người dùng bấm đăng nhập sau khi refresh đã xong — không dựng được race (tăng refreshDelayMs)");
    }
    if (loginPosts !== 1) problems.push(`POST /auth/login = ${loginPosts} (cần đúng 1)`);
    if (events.failedApi.length) {
      problems.push(`request API hỏng: ${events.failedApi.map((f) => `${f.path} ${f.error}`).join(", ")}`);
    }
    if (events.docLoads.length !== 1) problems.push(`trang tải ${events.docLoads.length} lần (cần 1)`);
    if (outcome && outcome.path === "/login") {
      problems.push(`đăng nhập xong vẫn bị đá về /login khi refresh 401 của bootstrap trả về (${describeAlert(outcome.alert)})`);
    }
    const serialized = Boolean(loginStart && refreshEnd && loginStart.t >= refreshEnd.t);
    rows.push(debugRow({ i, ok: problems.length === 0, problems, outcome, serialized }, server, events));
    await context.close();
  }
  return rows;
}

async function controllerScript(page) {
  return page.evaluate(() => navigator.serviceWorker?.controller?.scriptURL ?? null).catch(() => null);
}

async function scenarioUpdate(browser, server, args, origin) {
  const rows = [];
  for (let i = 1; i <= args.updateIterations; i += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const problems = [];
    let outcome = null;
    let events = { docLoads: [], failedApi: [], loginResponses: [], console: [] };
    let before = null;
    let after = null;
    try {
      // Lần mở trước: bản A cài service worker và nhận quyền điều khiển trang.
      server.setDist(args.distA);
      server.reset();
      await page.goto(`${origin}/login`, { waitUntil: "load" });
      if (!(await waitUntil(page, () => Boolean(navigator.serviceWorker?.controller), 10_000))) {
        problems.push("service worker bản A không nhận quyền điều khiển trong 10 s");
      }
      before = await controllerScript(page);
      // Deploy bản B, người dùng mở lại trang và đăng nhập ngay; login cố ý chậm 2,5 s.
      server.setDist(args.distB);
      server.reset({ loginDelayMs: 2_500 });
      events = watchPage(page, origin);
      await page.reload({ waitUntil: "commit" });
      await typeCredentials(page, `ok.update${i}@example.test`);
      // (1) chờ đăng nhập có kết quả: có response, hoặc request bị huỷ.
      const loginDeadline = Date.now() + 12_000;
      while (
        Date.now() < loginDeadline &&
        !events.loginResponses.length &&
        !events.failedApi.some((f) => f.path === "/api/v1/auth/login")
      ) {
        await sleep(50);
      }
      // (2) chờ trang yên: đã rời /login, ≥ 3 s sau khi login trả về và 3 s liền không tải lại.
      const quietDeadline = Date.now() + 15_000;
      while (Date.now() < quietDeadline) {
        const lastLoad = events.docLoads[events.docLoads.length - 1] ?? 0;
        const loginAt = events.loginResponses[0]?.t ?? 0;
        const left = new URL(page.url()).pathname !== "/login";
        if (left && now() - lastLoad >= 3_000 && now() - loginAt >= 3_000) break;
        await sleep(100);
      }
      outcome = await readOutcome(page);
      after = await controllerScript(page);
    } catch (error) {
      problems.push(`harness: ${String(error.message).split("\n")[0]}`);
    }
    const loginResponse = events.loginResponses[0];
    const extraLoads = events.docLoads.slice(1);
    const reloadsBeforeLoginDone = extraLoads.filter((t) => !loginResponse || t < loginResponse.t);
    const loginAborted = events.failedApi.filter((f) => f.path === "/api/v1/auth/login");
    if (!before || !after || before === after) {
      problems.push(`bản cập nhật service worker không được áp (trước: ${before}, sau: ${after}) — không dựng được tình huống`);
    }
    if (loginAborted.length) {
      problems.push(`POST /auth/login bị huỷ giữa chừng (${loginAborted.map((f) => f.error).join(", ")})`);
    }
    if (!loginResponse) problems.push("trình duyệt không nhận được HTTP response nào cho /auth/login");
    if (reloadsBeforeLoginDone.length) {
      problems.push(`trang tự tải lại ${reloadsBeforeLoginDone.length} lần TRƯỚC khi đăng nhập có kết quả`);
    }
    if (outcome && outcome.path === "/login") problems.push(`không vào được hệ thống (${describeAlert(outcome.alert)})`);
    rows.push(
      debugRow(
        {
          i,
          ok: problems.length === 0,
          problems,
          outcome,
          deferredReloadsAfterLogin: extraLoads.length - reloadsBeforeLoginDone.length,
        },
        server,
        events,
      ),
    );
    await context.close();
  }
  return rows;
}

function summarize(name, rows, extra = () => "") {
  const passed = rows.filter((row) => row.ok).length;
  console.log(`\n[${name}] ${passed}/${rows.length} lượt đạt ${extra(rows)}`);
  for (const row of rows.filter((r) => !r.ok || DEBUG).slice(0, 10)) {
    if (row.problems.length) console.log(`  #${row.i}: ${row.problems.join(" | ")}`);
    if (DEBUG) {
      console.log(`  #${row.i} server: ${JSON.stringify(row.serverLog)}`);
      console.log(`  #${row.i} docLoads: ${JSON.stringify(row.docLoads)}`);
      for (const line of row.console ?? []) console.log(`  #${row.i} console ${line}`);
    }
  }
  return passed === rows.length;
}

const args = parseArgs(process.argv.slice(2));
const origin = `http://localhost:${args.port}`;
const server = createMockServer();
await server.listen(args.port);
const browser = await chromium.launch({ channel: args.channel, headless: !args.headed });
const results = {};
const started = Date.now();
try {
  if (args.scenarios.includes("cold")) results.cold = await scenarioCold(browser, server, args, origin);
  if (args.scenarios.includes("hint")) results.hint = await scenarioHint(browser, server, args, origin);
  if (args.scenarios.includes("update")) results.update = await scenarioUpdate(browser, server, args, origin);
} finally {
  await browser.close();
  await server.close();
}

console.log(`\nTrình duyệt: ${args.channel ?? "chromium (Playwright)"} · ${Math.round((Date.now() - started) / 1000)} s`);
let allOk = true;
if (results.cold) allOk = summarize("cold — máy sạch, gõ nhanh", results.cold) && allOk;
if (results.hint) {
  allOk =
    summarize("hint — còn dấu vết phiên cũ, refresh 401 trả về sau", results.hint, (rows) =>
      `· login chờ refresh xong: ${rows.filter((r) => r.serialized).length}/${rows.length}`,
    ) && allOk;
}
if (results.update) {
  allOk =
    summarize("update — kiosk tự áp bản cập nhật giữa lúc đăng nhập", results.update, (rows) =>
      `· reload áp bản mới SAU khi đăng nhập xong: ${rows.reduce((n, r) => n + r.deferredReloadsAfterLogin, 0)}`,
    ) && allOk;
}
if (args.json) writeFileSync(args.json, `${JSON.stringify({ args, results }, null, 2)}\n`);
console.log(allOk ? "\nKẾT LUẬN: ĐẠT" : "\nKẾT LUẬN: TRƯỢT");
process.exit(allOk ? 0 : 1);
