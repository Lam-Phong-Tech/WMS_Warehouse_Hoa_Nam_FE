#!/usr/bin/env node
/**
 * WWHN-SEC-07 + P2 bảo mật 10/09/2026 — kiểm header bảo mật trên ORIGIN THẬT của frontend.
 *
 * VÌ SAO CẦN SCRIPT NÀY
 *
 * `deploy/nginx/frontend.conf.example` là một file MẪU. Nó không được nạp tự động ở bất
 * kỳ đâu, và không có gì trong repo chứng minh máy chủ thật đã áp dụng nó. Frontend là
 * file tĩnh: header hoàn toàn do máy chủ phục vụ quyết định, nên cách duy nhất để biết là
 * ĐO chính origin đang phục vụ người dùng.
 *
 * Lần đo 10/09/2026 trên production (`khohoanamfe.bigk.click`) cho thấy KHÔNG MỘT header
 * bảo mật nào được phát — trên HTML, JS, CSS lẫn service worker — dù file mẫu trong repo
 * đã đủ. Vì vậy script này:
 *  - đo MỌI loại tài nguyên người dùng tải: `/`, `/index.html`, một bundle JS và một CSS có
 *    hash (lấy từ chính HTML), `/service-worker.js`, `/manifest.webmanifest`. `add_header`
 *    của nginx không kế thừa vào location có add_header riêng, nên header có ở `/` KHÔNG
 *    chứng minh có ở asset, và ngược lại;
 *  - soi CSP theo TỪNG directive: script-src không 'unsafe-inline'/'unsafe-eval', object-src
 *    'none', base-uri, form-action, frame-ancestors;
 *  - tuỳ chọn `--api <url>` kiểm luôn response JSON của API trong cùng một lượt;
 *  - `--json <file>` ghi evidence máy đọc được cho job post-deploy.
 *
 * `style-src 'unsafe-inline'` KHÔNG bị chặn: MUI + Emotion chèn <style> lúc chạy. Nó chỉ cho
 * chèn CSS, không cho chạy mã — rủi ro còn lại được ghi trong nginx mẫu.
 *
 * CÁCH DÙNG
 *   node scripts/check-frontend-security-headers.mjs https://khohoanamfe.example
 *   node scripts/check-frontend-security-headers.mjs https://khohoanamfe.example \
 *     --api https://khohoanamfe.example/api/v1/health --json build/security-headers.json
 *   node scripts/check-frontend-security-headers.mjs --self-test
 *
 * Thoát 1 khi thiếu/sai header BẮT BUỘC ở bất kỳ tài nguyên nào, 2 khi không gọi được origin.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const HSTS_MIN_SECONDS = 15552000; // 180 ngày, ngưỡng tối thiểu của các bài quét tuân thủ.
const STRICT_REFERRER_POLICIES = ["no-referrer", "same-origin", "strict-origin", "strict-origin-when-cross-origin"];

export function parseCsp(value) {
  const directives = new Map();
  for (const part of String(value ?? "").split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const [name, ...sources] = tokens;
    const key = name.toLowerCase();
    // Theo đặc tả, directive lặp lại chỉ có bản ĐẦU TIÊN có hiệu lực.
    if (!directives.has(key)) directives.set(key, sources.map((source) => source.toLowerCase()));
  }
  return directives;
}

export function cspProblems(value) {
  const csp = parseCsp(value);
  const problems = [];
  const only = (sources, allowed) => Array.isArray(sources) && sources.length > 0 && sources.every((s) => allowed.includes(s));

  const scriptSources = csp.get("script-src") ?? csp.get("default-src");
  if (!scriptSources) {
    problems.push("thiếu script-src (và default-src)");
  } else {
    if (scriptSources.includes("'unsafe-eval'")) problems.push("script-src có 'unsafe-eval'");
    if (scriptSources.includes("'unsafe-inline'")) problems.push("script-src có 'unsafe-inline'");
    if (scriptSources.some((s) => ["*", "data:", "http:", "https:", "blob:"].includes(s))) {
      problems.push("script-src cho phép wildcard/data:/blob:/http:/https:");
    }
  }

  // object-src có fallback về default-src; base-uri, form-action, frame-ancestors thì KHÔNG.
  if (!only(csp.get("object-src") ?? csp.get("default-src"), ["'none'"])) problems.push("object-src phải là 'none'");
  if (!only(csp.get("base-uri"), ["'self'", "'none'"])) problems.push("base-uri phải là 'self' hoặc 'none'");
  if (!only(csp.get("form-action"), ["'self'", "'none'"])) problems.push("form-action phải là 'self' hoặc 'none'");
  if (!only(csp.get("frame-ancestors"), ["'none'", "'self'"])) problems.push("frame-ancestors phải là 'none' (hoặc 'self')");

  return problems;
}

const RULES = {
  hsts: {
    header: "strict-transport-security",
    label: "HSTS",
    why: "Không có HSTS thì lần truy cập bằng http vẫn đi qua mạng ở dạng rõ, kèm cookie phiên.",
    check: (value) => {
      const maxAge = /max-age=(\d+)/i.exec(value);
      if (!maxAge) return "thiếu max-age";
      return Number(maxAge[1]) < HSTS_MIN_SECONDS ? `max-age=${maxAge[1]} quá ngắn (tối thiểu ${HSTS_MIN_SECONDS})` : null;
    },
  },
  csp: {
    header: "content-security-policy",
    label: "CSP",
    why: "Lớp duy nhất chặn được script lạ chạy trên chính trang giữ phiên đăng nhập.",
    check: (value) => {
      const problems = cspProblems(value);
      return problems.length === 0 ? null : problems.join("; ");
    },
  },
  nosniff: {
    header: "x-content-type-options",
    label: "nosniff",
    why: "Không có nosniff thì trình duyệt có thể đoán kiểu nội dung và chạy một file như script.",
    check: (value) => (value.trim().toLowerCase() === "nosniff" ? null : "phải đúng bằng 'nosniff'"),
  },
  frameOptions: {
    header: "x-frame-options",
    label: "X-Frame-Options",
    why: "Dự phòng chống clickjacking cho trình duyệt không hiểu frame-ancestors.",
    check: (value) => (["deny", "sameorigin"].includes(value.trim().toLowerCase()) ? null : `giá trị '${value}' không hợp lệ (DENY|SAMEORIGIN)`),
  },
  referrer: {
    header: "referrer-policy",
    label: "Referrer-Policy",
    why: "Đường dẫn của WMS mang mã chứng từ và id nghiệp vụ; không được rò sang origin khác.",
    check: (value) => (STRICT_REFERRER_POLICIES.includes(value.trim().toLowerCase()) ? null : `giá trị '${value}' quá lỏng`),
  },
  permissions: {
    header: "permissions-policy",
    label: "Permissions-Policy",
    why: "FE chỉ cần camera=(self) cho máy quét; mọi quyền khác phải đóng.",
    check: (value) => (/\bcamera=\*/i.test(value) ? "camera=* mở camera cho mọi origin nhúng" : null),
  },
  coop: {
    header: "cross-origin-opener-policy",
    label: "COOP",
    why: "Chặn cửa sổ do trang khác mở giữ tham chiếu tới window của ứng dụng.",
    check: (value) => (value.trim().toLowerCase().startsWith("same-origin") ? null : `giá trị '${value}' không cô lập cửa sổ`),
  },
  apiCsp: {
    header: "content-security-policy",
    label: "CSP (JSON)",
    why: "Response JSON không được nạp tài nguyên nào.",
    check: (value) => (/default-src\s+'none'/i.test(value) ? null : "response JSON nên có default-src 'none'"),
  },
};

/** Hồ sơ theo loại tài nguyên: HTML và service worker là ngữ cảnh chạy mã nên đòi đủ bộ. */
export const PROFILES = {
  document: { required: ["hsts", "csp", "nosniff", "frameOptions", "referrer", "permissions"], recommended: ["coop"] },
  asset: { required: ["hsts", "nosniff", "referrer"], recommended: ["csp", "frameOptions", "permissions"] },
  api: { required: ["nosniff", "frameOptions", "referrer"], recommended: ["apiCsp"] },
};

export function evaluate(headers, profileName = "document", { secure = true } = {}) {
  const profile = PROFILES[profileName];
  const get = (name) => {
    const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
    return found ? String(found[1]) : null;
  };

  const failures = [];
  const warnings = [];
  const required = [...profile.required];
  if (profileName === "api" && secure) required.push("hsts");

  for (const key of required) {
    const rule = RULES[key];
    const value = get(rule.header);
    if (value === null) {
      failures.push(`${rule.label}: THIẾU — ${rule.why}`);
      continue;
    }
    const problem = rule.check(value);
    if (problem) failures.push(`${rule.label}: ${problem}`);
  }

  for (const key of profile.recommended) {
    const rule = RULES[key];
    const value = get(rule.header);
    if (value === null) warnings.push(`${rule.label}: thiếu — ${rule.why}`);
    else if (rule.check(value)) warnings.push(`${rule.label}: ${rule.check(value)}`);
  }

  if (profileName === "api" && get("x-powered-by") !== null) {
    failures.push(`X-Powered-By: lộ phiên bản nền tảng ('${get("x-powered-by")}') cho bước dò lỗ hổng`);
  }

  return { failures, warnings };
}

function selfTest() {
  const document = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy":
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  const csp = (value) => ({ ...document, "Content-Security-Policy": value });

  const cases = [
    ["tài liệu cấu hình đúng", document, "document", 0],
    ["thiếu hết header (tài liệu)", {}, "document", PROFILES.document.required.length],
    ["HSTS max-age quá ngắn", { ...document, "Strict-Transport-Security": "max-age=600" }, "document", 1],
    ["CSP cho phép unsafe-eval", csp("script-src 'self' 'unsafe-eval'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"), "document", 1],
    ["CSP cho phép unsafe-inline ở script", csp("script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"), "document", 1],
    ["CSP thiếu object-src/base-uri/form-action/frame-ancestors", csp("default-src 'self'; script-src 'self'"), "document", 1],
    ["style-src unsafe-inline vẫn hợp lệ", document, "document", 0],
    ["thiếu X-Frame-Options", (({ "X-Frame-Options": _, ...rest }) => rest)(document), "document", 1],
    ["Permissions-Policy camera=*", { ...document, "Permissions-Policy": "camera=*" }, "document", 1],
    ["Referrer-Policy quá lỏng", { ...document, "Referrer-Policy": "unsafe-url" }, "document", 1],
    ["asset chỉ có HSTS + nosniff + Referrer", { "Strict-Transport-Security": "max-age=31536000", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" }, "asset", 0],
    ["asset thiếu nosniff", { "Strict-Transport-Security": "max-age=31536000", "Referrer-Policy": "no-referrer" }, "asset", 1],
    ["API lộ X-Powered-By", { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Strict-Transport-Security": "max-age=31536000", "X-Powered-By": "PHP/8.3" }, "api", 1],
    ["API https thiếu HSTS", { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" }, "api", 1],
  ];

  let failed = 0;
  for (const [name, headers, profile, expected] of cases) {
    const { failures } = evaluate(headers, profile);
    const ok = failures.length === expected;
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} (lỗi=${failures.length}, mong đợi=${expected})`);
    if (!ok) failures.forEach((failure) => console.log(`        ${failure}`));
  }

  console.log(failed === 0 ? "\nself-test: PASS" : `\nself-test: FAIL (${failed} case)`);
  return failed === 0 ? 0 : 1;
}

async function fetchHeaders(url, redirect = "follow") {
  const response = await fetch(url, { method: "GET", redirect, headers: { "User-Agent": "wms-security-headers-check/1.0" } });
  const body = redirect === "manual" ? "" : await response.text();
  return { status: response.status, url: response.url || url, headers: Object.fromEntries(response.headers.entries()), body };
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--self-test")) {
    process.exit(selfTest());
  }

  const target = args.find((arg, index) => !arg.startsWith("--") && !["--api", "--json"].includes(args[index - 1]));
  const apiUrl = optionValue(args, "--api");
  const jsonPath = optionValue(args, "--json");

  if (!target) {
    console.error("Thiếu URL. Ví dụ: node scripts/check-frontend-security-headers.mjs https://khohoanamfe.example [--api <url>] [--json <file>]");
    console.error("Hoặc chạy: node scripts/check-frontend-security-headers.mjs --self-test");
    process.exit(2);
  }

  const origin = new URL(target).origin;
  const results = [];
  let networkError = null;

  const record = (label, profile, response) => {
    const { failures, warnings } = evaluate(response.headers, profile, { secure: response.url.startsWith("https:") });
    results.push({ label, url: response.url, status: response.status, profile, failures, warnings });
  };

  try {
    // `redirect: manual` cho URL gốc là CÓ CHỦ ĐÍCH: gõ http:// thì phải NHÌN THẤY cú 301.
    const first = await fetchHeaders(target, "manual");
    if (first.status >= 300 && first.status < 400) {
      console.log(`Chuyển hướng: ${target} -> ${first.headers.location ?? "(không có Location)"} (header bảo mật đo ở origin đích)`);
    }

    const home = await fetchHeaders(`${origin}/`);
    record("/", "document", home);
    record("/index.html", "document", await fetchHeaders(`${origin}/index.html`));

    const script = /<script[^>]+src="(\/assets\/[^"]+\.js)"/i.exec(home.body)?.[1];
    const style = /<link[^>]+href="(\/assets\/[^"]+\.css)"/i.exec(home.body)?.[1];
    if (script) record(script, "asset", await fetchHeaders(`${origin}${script}`));
    else results.push({ label: "bundle JS", url: null, status: null, profile: "asset", failures: ["không tìm thấy <script src=/assets/*.js> trong HTML"], warnings: [] });
    if (style) record(style, "asset", await fetchHeaders(`${origin}${style}`));

    for (const [path, profile] of [["/service-worker.js", "document"], ["/manifest.webmanifest", "asset"]]) {
      const response = await fetchHeaders(`${origin}${path}`);
      if (response.status === 404) {
        results.push({ label: path, url: response.url, status: 404, profile, failures: [], warnings: ["không tồn tại (404) — bỏ qua"] });
      } else {
        record(path, profile, response);
      }
    }

    if (apiUrl) record(`API ${new URL(apiUrl).pathname}`, "api", await fetchHeaders(apiUrl));
  } catch (error) {
    networkError = error instanceof Error ? error.message : String(error);
  }

  for (const result of results) {
    console.log(`\n[${result.failures.length === 0 ? "PASS" : "FAIL"}] ${result.label}  HTTP ${result.status ?? "-"}  (${result.profile})`);
    result.failures.forEach((failure) => console.log(`    ✗ ${failure}`));
    result.warnings.forEach((warning) => console.log(`    ! ${warning}`));
  }

  const failedCount = results.reduce((sum, result) => sum + result.failures.length, 0);
  const overall = networkError ? "error" : failedCount === 0 ? "pass" : "fail";

  if (jsonPath) {
    mkdirSync(dirname(jsonPath), { recursive: true });
    writeFileSync(jsonPath, `${JSON.stringify({ target, api: apiUrl ?? null, checked_at: new Date().toISOString(), overall, network_error: networkError, results }, null, 2)}\n`);
  }

  if (networkError) {
    console.error(`\nKhông gọi được origin: ${networkError}`);
    process.exit(2);
  }

  if (failedCount > 0) {
    console.log(`\nFAIL — ${failedCount} vi phạm header bắt buộc. Khắc phục: áp dụng deploy/nginx/frontend.conf.example (hoặc Transform Rules tương đương ở CDN) cho MỌI location.`);
    process.exit(1);
  }

  console.log("\nPASS — mọi tài nguyên đã đo đều phát đủ header bảo mật bắt buộc.");
}

main();
