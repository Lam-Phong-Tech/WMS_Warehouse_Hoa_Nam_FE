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
const e2e = read("e2e/auth-role-navigation-qa2.spec.ts");
const mainLayout = read("src/app/layouts/MainLayout.tsx");
const sideNav = read("src/app/layouts/SideNav.tsx");
const exactCss = read("src/styles/hn-wms-mvp-exact.css");
const taskDoc = read("docs/Task_docs_Jira/WWHN-144.md");
const evidenceReadme = read("docs/evidence/wwhn-144/README.md");

for (const script of ["wwhn-144:verify", "test:e2e:wwhn-144"]) {
  if (!packageJson.scripts?.[script]) {
    failures.push(`package.json is missing script ${script}`);
  }
}

for (const viewport of ["1440, height: 900", "768, height: 1024", "375, height: 812"]) {
  requireText(e2e, viewport, "e2e/auth-role-navigation-qa2.spec.ts");
}

for (const contract of [
  "anonymous-direct-url-login-guard",
  "limited-role-menu-direct-url-403",
  "authenticated-errors-403-route",
  "sourceSha",
  "environment",
  "buildVersion",
  "role",
  "viewport",
  "timestamp",
  "screenshotFilename",
  "videoFilename",
  "apiScopeDisposition",
  "300px MVP sidebar",
  "MVP stacked sidebar/main layout",
]) {
  requireText(e2e, contract, "e2e/auth-role-navigation-qa2.spec.ts");
}

for (const shellContract of [
  'className="hn-mvp-app"',
  'className="hn-mvp-aside"',
  'className="hn-mvp-main"',
  'className="hn-mvp-screen"',
  // Banner "Giao diện demo..." đã gỡ khi UI lên bản chính thức (redesign 10-11/8);
  // giữ footer định danh sản phẩm làm marker shell thay thế.
  'className="hn-mvp-footer"',
]) {
  requireText(mainLayout, shellContract, "MainLayout.tsx");
}

for (const navigationContract of [
  'data-testid="primary-navigation"',
  "00 · Tổng quan",
  "02 · Nhập kho",
  "03 · Xuất kho",
  "06 · Báo cáo",
  "Bản đồ màn hình & phạm vi",
]) {
  requireText(sideNav, navigationContract, "SideNav.tsx");
}

for (const visualContract of [
  // Sidebar 300px chuyển từ grid-template-columns sang fixed aside (redesign
  // 10-11/8) — vẫn khóa đúng bề rộng 300px của khung MVP.
  "width:300px;height:100vh;background:#0f172a",
  "background:#0f172a",
  "border-radius:16px",
  "font-family:Arial,Helvetica,sans-serif",
  "@media (max-width:980px)",
]) {
  requireText(exactCss, visualContract, "hn-wms-mvp-exact.css");
}

for (const contract of [
  "Verify WWHN-144 closure contract",
  "Capture WWHN-144 QA2 evidence",
  "WWHN_144_OUTCOME",
  "docs/evidence/wwhn-144",
  "docs/Task_docs_Jira/WWHN-144.md",
  "Enforce all quality gate outcomes",
]) {
  requireText(ci, contract, ".github/workflows/ci.yml");
}

for (const disposition of [
  "UX frame scope",
  "không phải API integration endpoint scope",
  "WWHN-143",
  "WWHN-145",
  "không chuyển parent WWHN-29",
  "1440x900",
  "768x1024",
  "375x812",
  "exact-SHA",
  "Prettier drift",
]) {
  requireText(taskDoc, disposition, "docs/Task_docs_Jira/WWHN-144.md");
}

for (const forbidden of ["blob:http", "blob:https", "blob.core.windows.net"]) {
  if (taskDoc.toLowerCase().includes(forbidden)) {
    failures.push(
      `WWHN-144.md contains untraceable blob reference (${forbidden}); use repository/Actions artifact links instead.`,
    );
  }
}

for (const contract of [
  "wms-fe-closure-evidence-<SOURCE_SHA>",
  "playwright-report/index.html",
  "sourceSha",
  "timestamp",
  "90 ngày",
  "Không dùng một ZIP mơ hồ",
  "folder link chuẩn kèm manifest",
  "Automation pass là technical evidence",
]) {
  requireText(
    contract === "sourceSha" ? e2e : evidenceReadme,
    contract,
    "WWHN-144 evidence contract",
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[wwhn-144] ERROR: ${failure}`);
  }
  process.exit(1);
}

console.log(
  "[wwhn-144] PASS: MVP HTML responsive/RBAC/direct-URL/403 evidence contract, Jira scope disposition and CI gate are complete.",
);
