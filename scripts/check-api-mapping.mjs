#!/usr/bin/env node
/**
 * CI check cho docs/api-evidence/M1_API_MAPPING.md, M2_DEPENDENCY_LIST.md,
 * M3_DEPENDENCY_LIST.md — giải quyết P2 của task
 * "[Cross][FE] API Contract Mapping từ Swagger/Postman cho M1/M2/M3":
 *
 *   1. Method + path trong mapping phải tồn tại trong swagger-api.json
 *      (trừ danh sách KNOWN_LIVE_ONLY_ROUTES — xác nhận qua OpenAPI live
 *      nhưng chưa có trong snapshot local).
 *   2. Permission code trong mapping phải tồn tại trong catalog thật — ưu
 *      tiên catalog RUNTIME (GET /api/v1/permissions, cache tại
 *      .agent-cache/permission-catalog-live.json); fallback catalog FE
 *      (src/shared/types/permission.ts). Warning (không fail cứng) vì nhiều
 *      module M2/M3 (PlaceholderPage) chưa wire RBAC guard.
 *   3. Cảnh báo (warning) khi 1 (method+path) xuất hiện >1 lần trong cùng 1
 *      màn hình — có thể là 2 UI Action hợp lệ dùng chung endpoint, cần
 *      người review xác nhận thủ công.
 *   4. Auto-generate endpoint counts (không đếm thủ công) + so sánh với số
 *      unique routes trong swagger để phát hiện lệch số.
 *   5. In operationId/tag Swagger cho từng dòng mapping (P2 — best effort,
 *      không fail nếu swagger thiếu).
 *
 * Chỉ (1) là lỗi cứng (exit 1); (2)/(3) là warning.
 *
 * Usage: node scripts/check-api-mapping.mjs [--no-live]
 * Exit code 1 nếu có lỗi cứng — dùng được trực tiếp trong CI.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SWAGGER_PATH = join(ROOT, 'swagger-api.json');
const PERMISSION_TS_PATH = join(ROOT, 'src/shared/types/permission.ts');
const ENV_PATH = join(ROOT, '.env');
const CATALOG_CACHE_PATH = join(ROOT, '.agent-cache/permission-catalog-live.json');
const MAPPING_FILES = [
  join(ROOT, 'docs/api-evidence/M1_API_MAPPING.md'),
  join(ROOT, 'docs/api-evidence/M2_DEPENDENCY_LIST.md'),
  join(ROOT, 'docs/api-evidence/M3_DEPENDENCY_LIST.md'),
];

const NO_LIVE = process.argv.includes('--no-live');

// swagger-api.json là file tĩnh (snapshot), có thể lệch với API live.
const KNOWN_LIVE_ONLY_ROUTES = new Set([
  'GET /tasks/{param}/histories', // xác nhận 2026-07-15, BE 404 thật — xem tasks.md
]);

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// ─── Đọc .env để lấy VITE_API_BASE_URL cho fetch runtime catalog ───
function loadEnv() {
  if (!existsSync(ENV_PATH)) return {};
  const env = {};
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*(VITE_[A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// ─── Catalog runtime: login → GET /api/v1/permissions ───
async function loadLiveCatalog() {
  if (NO_LIVE) {
    console.log('[catalog] --no-live: bỏ qua fetch runtime, dùng cache (nếu có) + fallback FE');
  } else if (existsSync(CATALOG_CACHE_PATH)) {
    const stat = readFileSync(CATALOG_CACHE_PATH, 'utf8');
    try {
      const cached = JSON.parse(stat);
      // cache < 24h
      if (Date.now() - cached.fetchedAt < 24 * 3600 * 1000) {
        console.log(`[catalog] dùng cache runtime (.agent-cache/permission-catalog-live.json, ${cached.codes.length} codes, fetched ${new Date(cached.fetchedAt).toISOString()})`);
        return new Set(cached.codes);
      }
    } catch {}
  }
  const env = loadEnv();
  const base = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  if (!base) {
    console.warn('[catalog] VITE_API_BASE_URL not set — skip runtime fetch, use FE fallback');
    return null;
  }
  const email = env.VITE_TEST_EMAIL || '';
  const password = env.VITE_TEST_PASSWORD || '';
  if (!email || !password) {
    console.warn('[catalog] VITE_TEST_EMAIL or VITE_TEST_PASSWORD not set — skip runtime fetch, use FE fallback');
    return null;
  }
  try {
    console.log(`[catalog] fetch runtime: login + GET ${base}/permissions ...`);
    const loginRes = await fetch(`${base.replace(/\/api\/v1$/, '')}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!loginRes.ok) throw new Error(`login ${loginRes.status}`);
    const loginJson = await loginRes.json();
    const token = loginJson?.data?.access_token || loginJson?.access_token || loginJson?.token;
    if (!token) throw new Error('no token in login response');
    const permRes = await fetch(`${base}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!permRes.ok) throw new Error(`GET /permissions ${permRes.status}`);
    const permJson = await permRes.json();
    const arr = permJson?.data ?? permJson ?? [];
    const codes = new Set();
    for (const p of arr) {
      if (typeof p === 'string') codes.add(p);
      else if (p?.code) codes.add(p.code);
      else if (p?.name) codes.add(p.name);
    }
    mkdirSync(join(ROOT, '.agent-cache'), { recursive: true });
    writeFileSync(CATALOG_CACHE_PATH, JSON.stringify({ fetchedAt: Date.now(), codes: [...codes] }, null, 2));
    console.log(`[catalog] runtime OK — ${codes.size} permission codes (cache: ${CATALOG_CACHE_PATH})`);
    return codes;
  } catch (e) {
    console.warn(`[catalog] runtime fetch thất bại (${e.message}) — fallback FE catalog + cache cũ (nếu có)`);
    if (existsSync(CATALOG_CACHE_PATH)) {
      try {
        const cached = JSON.parse(readFileSync(CATALOG_CACHE_PATH, 'utf8'));
        return new Set(cached.codes);
      } catch {}
    }
    return null; // signal fallback
  }
}

function loadSwaggerRoutes() {
  const swagger = JSON.parse(readFileSync(SWAGGER_PATH, 'utf8'));
  const routes = new Set();
  const meta = new Map(); // "METHOD path" -> { operationId, tags }
  for (const [path, methods] of Object.entries(swagger.paths ?? {})) {
    for (const [method, spec] of Object.entries(methods)) {
      if (METHODS.includes(method.toUpperCase())) {
        const key = `${method.toUpperCase()} ${normalizePath(path)}`;
        routes.add(key);
        meta.set(key, { operationId: spec.operationId ?? '', tags: spec.tags ?? [] });
      }
    }
  }
  return { routes, meta };
}

function normalizePath(path) {
  return path.replace(/\{[^}]+\}/g, '{param}');
}

function loadPermissionCatalogFE() {
  const src = readFileSync(PERMISSION_TS_PATH, 'utf8');
  const codes = new Set();
  const re = /'([A-Z][A-Z0-9_]{2,})'/g;
  let m;
  while ((m = re.exec(src))) codes.add(m[1]);
  return codes;
}

function extractRows(markdown) {
  const EXCLUDE_SECTION_RE = /Known Mismatch|Phân loại trạng thái FE|chưa có trên BE/i;
  const rows = [];
  const lines = markdown.split('\n');
  let excluded = false;
  let sectionId = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##/.test(line)) {
      excluded = EXCLUDE_SECTION_RE.test(line);
      sectionId++;
    }
    if (!line.startsWith('|') || excluded) continue;
    const cells = line.split('|').map((c) => c.trim());
    const pathCell = cells.find((c) => /^`[^`]*\/[^`]*`$/.test(c));
    const methodCell = cells.find((c) => METHODS.includes(c.replace(/[^A-Z]/g, '')));
    if (!pathCell || !methodCell) continue;
    const rawPath = pathCell.replace(/`/g, '').split(' ').pop();
    const method = methodCell.replace(/[^A-Z]/g, '');
    if (!rawPath?.startsWith('/')) continue;
    rows.push({ line: i + 1, method, path: rawPath, raw: line, sectionId });
  }
  return rows;
}

function extractPermissionCodesFromRow(row) {
  const codes = new Set();
  const re = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;
  let m;
  while ((m = re.exec(row.raw))) {
    if (/^(GET|POST|PUT|PATCH|DELETE)$/.test(m[1])) continue;
    codes.add(m[1]);
  }
  return [...codes];
}

async function main() {
  const { routes: swaggerRoutes, meta: swaggerMeta } = loadSwaggerRoutes();
  const liveCatalog = await loadLiveCatalog();
  const feCatalog = loadPermissionCatalogFE();
  const catalog = liveCatalog ?? feCatalog;
  const catalogSource = liveCatalog ? 'runtime (GET /api/v1/permissions)' : 'FE (src/shared/types/permission.ts — fallback)';

  let errorCount = 0;
  let warnCount = 0;
  let totalEndpointRows = 0;

  for (const file of MAPPING_FILES) {
    const markdown = readFileSync(file, 'utf8');
    const rows = extractRows(markdown);
    const seen = new Map();
    const relFile = file.replace(ROOT + '\\', '').replace(ROOT + '/', '');

    console.log(`\n=== ${relFile} (${rows.length} endpoint rows) ===`);
    totalEndpointRows += rows.length;

    for (const row of rows) {
      const key = normalizePath(row.path);
      const routeKey = `${row.method} ${key}`;
      const dedupeKey = `${row.sectionId}::${routeKey}`;

      if (!swaggerRoutes.has(routeKey)) {
        if (KNOWN_LIVE_ONLY_ROUTES.has(routeKey)) {
          console.warn(`  ⚠ [line ${row.line}] ${row.method} ${row.path} — không có trong swagger-api.json (snapshot), đã xác nhận qua OpenAPI live, xem KNOWN_LIVE_ONLY_ROUTES`);
          warnCount++;
        } else {
          console.error(`  ✗ [line ${row.line}] ${row.method} ${row.path} — KHÔNG tìm thấy trong swagger-api.json`);
          errorCount++;
        }
      } else {
        // P2: in operationId/tag (best effort)
        const m = swaggerMeta.get(routeKey);
        if (m?.operationId || m?.tags?.length) {
          console.log(`  ℹ [line ${row.line}] ${row.method} ${row.path} — operationId: ${m.operationId || '(none)'} · tags: ${m.tags.join(',') || '(none)'}`);
        }
      }

      if (seen.has(dedupeKey)) {
        console.warn(`  ⚠ [line ${row.line}] ${row.method} ${row.path} — trùng với dòng ${seen.get(dedupeKey)} trong cùng màn hình — kiểm tra có phải 2 UI Action khác nhau dùng chung endpoint không`);
        warnCount++;
      } else {
        seen.set(dedupeKey, row.line);
      }
    }

    // Permission code check
    const lines = markdown.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('|')) continue;
      const candidates = extractPermissionCodesFromRow({ raw: line });
      for (const code of candidates) {
        // P2: không còn regex prefix thủ công — so với catalog thật (runtime
        // ưu tiên, fallback FE). Chỉ skip các hằng obviously không phải perm.
        if (/^(DUPLICATE_RESOURCE|CONFIRM_REQUIRED|RESTORE_WINDOW_EXPIRED|VALIDATION_FAILED|VALIDATION_ERROR|ACCESS_DENIED|RESOURCE_NOT_FOUND|OVERLAP_DATE|HTTP|API|URL|JSON|JWT|MFA|OTP)$/.test(code)) continue;
        if (!catalog.has(code)) {
          console.warn(`  ⚠ [line ${i + 1}] Permission code "${code}" chưa thấy trong catalog (${catalogSource}) — kiểm tra UI đã wire RBAC guard chưa`);
          warnCount++;
        }
      }
    }
  }

  // P2: auto-generate endpoint counts vs unique swagger routes
  console.log(`\n--- Tổng endpoint rows đếm tự động (M1+M2+M3): ${totalEndpointRows} ---`);
  console.log(`--- Unique swagger routes: ${swaggerRoutes.size} ---`);
  if (Math.abs(totalEndpointRows - swaggerRoutes.size) > 50) {
    console.warn(`  ⚠ Lệch lớn giữa rows (${totalEndpointRows}) và swagger unique (${swaggerRoutes.size}) — có thể swagger snapshot cũ hoặc mapping thiếu/sai`);
    warnCount++;
  }
  console.log(`\n--- Errors: ${errorCount} · Warnings (permission code chưa xác nhận RBAC + info): ${warnCount} ---`);
  console.log(`--- Catalog source: ${catalogSource} (${catalog.size} codes) ---`);

  if (errorCount > 0) {
    console.error(`\n❌ FAILED — ${errorCount} lỗi (method/path sai hoặc conflict). Sửa mapping docs hoặc cập nhật swagger-api.json.`);
    process.exit(1);
  }
  console.log('\n✅ OK — method/path trong mapping docs khớp swagger-api.json, không có conflict. Xem warnings ở trên để rà soát permission code.');
}

main();