#!/usr/bin/env node
/**
 * WWHN-SEC-07 — kiểm ORIGIN THẬT của frontend có phát đủ header bảo mật chưa.
 *
 * VÌ SAO CẦN SCRIPT NÀY
 *
 * `deploy/nginx/frontend.conf.example` là một file MẪU. Nó không được nạp tự
 * động ở bất kỳ đâu, và không có gì trong repo chứng minh rằng máy chủ thật đã
 * áp dụng nó. Trước script này, câu "FE đã có CSP/HSTS" chỉ là niềm tin dựa vào
 * sự tồn tại của một file ví dụ — đúng kiểu bằng chứng mà một bài audit không
 * được phép chấp nhận.
 *
 * Backend đã tự phát header của nó (App\Http\Middleware\SecurityHeaders) nên
 * kiểm được bằng một request. Frontend là file tĩnh: header hoàn toàn do nginx
 * quyết định, nên cách duy nhất để biết là ĐO chính origin đang phục vụ người
 * dùng.
 *
 * CÁCH DÙNG
 *   node scripts/check-frontend-security-headers.mjs https://khohoanamfe.example
 *   node scripts/check-frontend-security-headers.mjs --self-test
 *
 * Thoát khác 0 khi thiếu header BẮT BUỘC -> cắm thẳng vào job deploy được.
 *
 * PHẠM VI CỐ Ý HẸP: script kiểm SỰ CÓ MẶT và các thuộc tính nguy hiểm rõ ràng
 * (`unsafe-eval`, `frame-ancestors` thiếu, HSTS max-age quá ngắn). Nó KHÔNG cố
 * chấm điểm toàn bộ CSP — một bộ chấm điểm nửa vời sẽ hoặc báo động giả liên tục
 * rồi bị tắt đi, hoặc cho điểm cao cho một policy vô dụng.
 */

const REQUIRED = [
  {
    header: "strict-transport-security",
    label: "HSTS",
    why: "Không có HSTS thì lần truy cập đầu bằng http vẫn đi qua mạng ở dạng rõ, kèm cookie phiên.",
    check: (value) => {
      const maxAge = /max-age=(\d+)/i.exec(value ?? "");
      if (!maxAge) return "thiếu max-age";
      // 15552000 = 180 ngày, ngưỡng tối thiểu của mọi bài quét tuân thủ.
      if (Number(maxAge[1]) < 15552000) return `max-age=${maxAge[1]} quá ngắn (tối thiểu 15552000)`;
      return null;
    },
  },
  {
    header: "content-security-policy",
    label: "CSP",
    why: "Là lớp duy nhất chặn được script lạ chạy trên chính trang giữ phiên đăng nhập.",
    check: (value) => {
      const policy = (value ?? "").toLowerCase();
      if (!policy.includes("frame-ancestors")) return "thiếu frame-ancestors (chống nhúng iframe)";
      if (!policy.includes("script-src")) return "thiếu script-src";
      // 'unsafe-eval' cho SCRIPT là lỗ thật. 'unsafe-inline' cho STYLE thì
      // KHÔNG bị chặn ở đây: giao diện dùng MUI + Emotion nên bắt buộc phải có,
      // và nó chỉ cho chèn CSS chứ không cho chạy mã. Xem chú thích trong
      // deploy/nginx/frontend.conf.example.
      if (/script-src[^;]*'unsafe-eval'/.test(policy)) return "script-src có 'unsafe-eval'";
      if (/script-src[^;]*'unsafe-inline'/.test(policy)) return "script-src có 'unsafe-inline'";
      return null;
    },
  },
  {
    header: "x-content-type-options",
    label: "nosniff",
    why: "Không có nosniff thì trình duyệt có thể đoán kiểu nội dung và chạy một file tải lên như script.",
    check: (value) => ((value ?? "").toLowerCase().trim() === "nosniff" ? null : "phải đúng bằng 'nosniff'"),
  },
  {
    header: "referrer-policy",
    label: "Referrer-Policy",
    why: "Đường dẫn của WMS mang mã chứng từ và id nghiệp vụ; không nên rò sang máy chủ ảnh/CDN.",
    check: (value) => {
      const allowed = ["no-referrer", "same-origin", "strict-origin", "strict-origin-when-cross-origin"];
      return allowed.includes((value ?? "").toLowerCase().trim()) ? null : `giá trị '${value}' quá lỏng`;
    },
  },
];

const RECOMMENDED = [
  {
    header: "x-frame-options",
    label: "X-Frame-Options",
    why: "Dự phòng cho trình duyệt cũ không hiểu frame-ancestors.",
  },
  {
    header: "permissions-policy",
    label: "Permissions-Policy",
    why: "FE cần camera=(self) cho máy quét; các quyền còn lại nên đóng.",
  },
  {
    header: "cross-origin-opener-policy",
    label: "COOP",
    why: "Chặn cửa sổ do trang khác mở giữ tham chiếu tới window của ứng dụng.",
  },
];

function evaluate(headers) {
  const get = (name) => {
    const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
    return found ? String(found[1]) : null;
  };

  const failures = [];
  const warnings = [];

  for (const rule of REQUIRED) {
    const value = get(rule.header);
    if (value === null) {
      failures.push(`${rule.label}: THIẾU — ${rule.why}`);
      continue;
    }
    const problem = rule.check(value);
    if (problem) failures.push(`${rule.label}: ${problem}`);
  }

  for (const rule of RECOMMENDED) {
    if (get(rule.header) === null) warnings.push(`${rule.label}: thiếu — ${rule.why}`);
  }

  return { failures, warnings };
}

function selfTest() {
  const good = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy":
      "default-src 'self'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(self)",
    "Cross-Origin-Opener-Policy": "same-origin",
  };

  const cases = [
    ["cấu hình đúng thì không có lỗi", good, 0],
    ["thiếu hết header", {}, REQUIRED.length],
    ["HSTS max-age quá ngắn", { ...good, "Strict-Transport-Security": "max-age=600" }, 1],
    [
      "CSP cho phép unsafe-eval",
      { ...good, "Content-Security-Policy": "frame-ancestors 'none'; script-src 'self' 'unsafe-eval'" },
      1,
    ],
    [
      "CSP thiếu frame-ancestors",
      { ...good, "Content-Security-Policy": "default-src 'self'; script-src 'self'" },
      1,
    ],
    ["nosniff sai giá trị", { ...good, "X-Content-Type-Options": "none" }, 1],
    ["Referrer-Policy quá lỏng", { ...good, "Referrer-Policy": "unsafe-url" }, 1],
    // style-src 'unsafe-inline' là BẮT BUỘC với MUI/Emotion — không được coi là lỗi.
    ["style-src unsafe-inline vẫn hợp lệ", good, 0],
  ];

  let failed = 0;
  for (const [name, headers, expected] of cases) {
    const { failures } = evaluate(headers);
    const ok = failures.length === expected;
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} (lỗi=${failures.length}, mong đợi=${expected})`);
    if (!ok) failures.forEach((f) => console.log(`        ${f}`));
  }

  console.log(failed === 0 ? "\nself-test: PASS" : `\nself-test: FAIL (${failed} case)`);
  return failed === 0 ? 0 : 1;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--self-test")) {
    process.exit(selfTest());
  }

  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    console.error("Thiếu URL. Ví dụ: node scripts/check-frontend-security-headers.mjs https://khohoanamfe.example");
    console.error("Hoặc chạy: node scripts/check-frontend-security-headers.mjs --self-test");
    process.exit(2);
  }

  let response;
  try {
    // `redirect: manual` là CÓ CHỦ ĐÍCH: nếu gõ http:// thì ta muốn NHÌN THẤY
    // cú 301, không muốn fetch âm thầm đi theo rồi báo "mọi thứ ổn".
    response = await fetch(url, { method: "GET", redirect: "manual" });
  } catch (error) {
    console.error(`Không gọi được ${url}: ${error.message}`);
    process.exit(2);
  }

  const headers = Object.fromEntries(response.headers.entries());
  const { failures, warnings } = evaluate(headers);

  console.log(`URL      : ${url}`);
  console.log(`HTTP     : ${response.status}`);
  if (response.status >= 300 && response.status < 400) {
    console.log(`Redirect : ${headers.location ?? "(không có Location)"}`);
    console.log("Lưu ý: đây là response chuyển hướng. Header bảo mật phải có ở origin ĐÍCH (https).");
  }
  console.log("");

  if (warnings.length > 0) {
    console.log("Cảnh báo:");
    warnings.forEach((w) => console.log(`  - ${w}`));
    console.log("");
  }

  if (failures.length > 0) {
    console.log("THIẾU HEADER BẮT BUỘC:");
    failures.forEach((f) => console.log(`  - ${f}`));
    console.log("");
    console.log("Khắc phục: áp dụng deploy/nginx/frontend.conf.example lên máy chủ tĩnh của FE.");
    process.exit(1);
  }

  console.log("PASS — origin FE phát đủ header bảo mật bắt buộc.");
  process.exit(0);
}

main();
