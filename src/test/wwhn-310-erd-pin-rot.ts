import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * WWHN-310 / DEV310-P1-02 — dò "pin rot" của digest ERD.
 *
 * Digest của `HoaNam_ERD_Moi_Nhat.md` được nhắc lại trong nhiều governance
 * register (WWHN-230/233/236/237/242, DEVOPS register, M1/M3 API mapping…).
 * Sửa ERD mà chỉ cập nhật `docs/contracts/erd-document-pin.json` sẽ để những
 * register đó nói sai, và chỉ vỡ ở test của ticket khác — rất khó truy.
 *
 * Hai dạng ghi được nhận diện, và **chỉ** hai dạng đó (tránh bắt nhầm digest
 * của file đứng kế bên trong cùng bảng/mảng):
 *   1. cùng một dòng:  `docs/HoaNam_ERD_Moi_Nhat.md` … <64 hex>
 *   2. JSON object:    { "path": "…/HoaNam_ERD_Moi_Nhat.md", "sha256": "<64 hex>" }
 */
const DOCUMENT_NAME = "HoaNam_ERD_Moi_Nhat.md";
const HEX64 = /\b([0-9a-f]{64})\b/g;
const PATH_KEYS =
  /^(path|file|filepath|repositoryPath|repository_path|document|artifact)$/i;
const DIGEST_KEYS = /(sha256|sha_256|digest|checksum)/i;

export interface StaleDigest {
  file: string;
  digest: string;
}

function listDocs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listDocs(full, acc);
    } else if (/\.(json|md)$/i.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function collectFromJson(
  node: unknown,
  expected: string,
  found: string[],
): void {
  if (Array.isArray(node)) {
    for (const child of node) collectFromJson(child, expected, found);
    return;
  }
  if (node === null || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const entries = Object.entries(record);

  // Dạng map: { "docs/HoaNam_ERD_Moi_Nhat.md": "<digest>" }
  for (const [key, value] of entries) {
    if (
      key.endsWith(DOCUMENT_NAME) &&
      typeof value === "string" &&
      /^[0-9a-f]{64}$/.test(value)
    ) {
      if (value !== expected) found.push(value);
    }
  }

  // Dạng object: { path: "...", sha256: "..." }
  const pointsAtErd = entries.some(
    ([key, value]) =>
      PATH_KEYS.test(key) &&
      typeof value === "string" &&
      value.endsWith(DOCUMENT_NAME),
  );
  if (pointsAtErd) {
    for (const [key, value] of entries) {
      if (
        DIGEST_KEYS.test(key) &&
        typeof value === "string" &&
        /^[0-9a-f]{64}$/.test(value) &&
        value !== expected
      ) {
        found.push(value);
      }
    }
  }

  for (const value of Object.values(record))
    collectFromJson(value, expected, found);
}

export function findStaleErdDigests(
  repoRoot: string,
  expected: string,
): StaleDigest[] {
  const stale: StaleDigest[] = [];

  for (const file of listDocs(path.join(repoRoot, "docs"))) {
    const body = readFileSync(file, "utf8");
    if (!body.includes(DOCUMENT_NAME)) continue;

    const relative = path.relative(repoRoot, file).split(path.sep).join("/");
    const found: string[] = [];

    if (file.toLowerCase().endsWith(".json")) {
      try {
        collectFromJson(JSON.parse(body), expected, found);
      } catch {
        // JSON hỏng: rơi về so theo dòng bên dưới.
      }
    }

    for (const line of body.split("\n")) {
      if (!line.includes(DOCUMENT_NAME)) continue;
      for (const match of line.matchAll(HEX64)) {
        if (match[1] !== expected) found.push(match[1]);
      }
    }

    for (const digest of new Set(found)) {
      stale.push({ file: relative, digest });
    }
  }

  return stale;
}
