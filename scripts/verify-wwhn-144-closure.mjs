#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    failures.push(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(absolute, "utf8");
}

function requireText(source, expected, location) {
  if (!source.includes(expected)) {
    failures.push(`${location} must contain: ${expected}`);
  }
}

const packageJson = JSON.parse(read("package.json") || "{}");
const ci = read(".github/workflows/ci.yml");
// ĐÃ RÚT: e2e/auth-role-navigation-qa2.spec.ts + docs/Task_docs_Jira/WWHN-144.md
// + docs/evidence/wwhn-144/README.md gỡ theo 3822d45 (dọn kho tài liệu);
// src/styles/hn-wms-mvp-exact.css gỡ khi UI hợp nhất về canonical @/shared/ui
// (chương trình Vuexy Part 4/5). Các kiểm tra đọc những artefact đó rút theo.
const mainLayout = read("src/app/layouts/MainLayout.tsx");
const sideNav = read("src/app/layouts/SideNav.tsx");

// ĐÃ RÚT 10/09/2026: script test:e2e:wwhn-144 trỏ spec đã gỡ ở 3822d45 nên bị xoá khỏi
// package.json (và bước "Capture WWHN-144 QA2 evidence" khỏi ci.yml) — pin rút theo.
for (const script of ["wwhn-144:verify"]) {
  if (!packageJson.scripts?.[script]) {
    failures.push(`package.json is missing script ${script}`);
  }
}

// Kiểm tra e2e viewport/contract + khung CSS exact — ĐÃ RÚT (xem chú thích trên).

// Shell chuyển sang UiAppShell (Vuexy Part 4a); MainLayout giữ marker
// `hn-mvp-screen` làm test-hook. Pin theo hiện trạng sống.
for (const shellContract of [
  "UiAppShell",
  'className="hn-mvp-screen hn-page-transition"',
]) {
  requireText(mainLayout, shellContract, "MainLayout.tsx");
}

// SideNav redesign Vuexy: nhãn menu đi qua useNavLabel (i18n), hết chuỗi
// "0x · ..." cứng; giữ test-hook primary-navigation + hn-mvp-nav-btn.
for (const navigationContract of [
  'data-testid="primary-navigation"',
  "useNavLabel",
  "hn-mvp-nav-btn",
]) {
  requireText(sideNav, navigationContract, "SideNav.tsx");
}

// 10/09/2026: CI tách thành job cổng cứng — biến WWHN_144_OUTCOME không còn (cổng tổng đọc
// kết quả job), còn docs/evidence/wwhn-144 và docs/Task_docs_Jira/WWHN-144.md (gỡ ở 3822d45)
// không còn nằm trong artifact. Pin chuyển sang tên bước, lệnh chạy và cổng tổng.
for (const contract of [
  "Verify WWHN-144 closure contract",
  "npm run wwhn-144:verify",
  "Enforce all quality gate outcomes",
]) {
  requireText(ci, contract, ".github/workflows/ci.yml");
}

// Kiểm tra Task doc disposition + evidence README — ĐÃ RÚT theo 3822d45.

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[wwhn-144] ERROR: ${failure}`);
  }
  process.exit(1);
}

console.log(
  "[wwhn-144] PASS: live shell/navigation markers, script and CI wiring hold (e2e/doc/evidence/exact-CSS checks retired by 3822d45 + canonical UI program).",
);
