import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { ROUTES } from "@/shared/constants/routes";

import { loadPinnedContract } from "../../scripts/pinned-openapi-contract.mjs";

/**
 * WWHN-260 — migration/tồn đầu kỳ là **operational-only** (`DEC-MIG-API-001`,
 * `REQ-SRS-021`, SRS §13.12).
 *
 * MVP không có endpoint public/admin và không có màn hình nào để nạp master hay
 * tồn đầu kỳ: việc đó chỉ chạy bằng controlled job phía BE (`migration:final-load`)
 * trong cửa sổ cutover. Guard này giữ đúng ranh giới đó — thêm một màn "import
 * tồn đầu" vào FE là mở một đường ghi tồn thứ hai không có checksum, không có
 * đối soát và không có rollback.
 */
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("WWHN-260 — migration là operational-only trên FE", () => {
  it("không khai route hay hằng số màn hình migration/tồn đầu kỳ", () => {
    const migrationRouteKeys = Object.keys(ROUTES).filter((key) =>
      /MIGRATION|OPENING_BALANCE|CUTOVER/.test(key),
    );
    expect(migrationRouteKeys).toEqual([]);

    const migrationRoutePaths = Object.values(ROUTES).filter(
      (routePath) =>
        typeof routePath === "string" &&
        /migration|opening-balance|cutover/.test(routePath.toLowerCase()),
    );
    expect(migrationRoutePaths).toEqual([]);
  });

  it("không gọi bất kỳ endpoint migration nào", () => {
    const migrationEndpoints = Object.entries(API_ENDPOINTS).filter(
      ([key, value]) =>
        /MIGRATION|CUTOVER|OPENING_BALANCE/.test(key) ||
        (typeof value === "string" &&
          /\/migration|\/cutover|\/opening-balance/.test(value.toLowerCase())),
    );
    expect(migrationEndpoints).toEqual([]);
  });

  it("hợp đồng OpenAPI mà FE dùng không có operation migration", () => {
    // Nguồn kín: chỉ mục path+method đã commit trong BE_CONTRACT_PIN.json, tự xác minh
    // niêm sha256 + số đếm. Pin thiếu/hỏng/lệch là THROW ⇒ test đỏ. Không đọc
    // swagger-api.json (gitignored ⇒ CI không có, máy dev có thể lệch pin).
    const contract = loadPinnedContract(repoRoot);
    expect(contract.paths.size).toBe(contract.pin.openapi_paths);

    const migrationPaths = [...contract.paths].filter((apiPath) =>
      /migration|cutover|opening-balance/.test(apiPath.toLowerCase()),
    );
    expect(migrationPaths).toEqual([]);
  });

  it("giữ ERD đồng bộ với bản BE ở phần bằng chứng migration", () => {
    // ERD-AMD-007: ba con số valid/invalid/duplicate của SRS §13.12 phải lưu
    // được trên `migration_runs`; bản ERD của FE là bản đối chiếu của BE nên
    // lệch bản là blocker của gói bàn giao dữ liệu (WWHN-310).
    const erd = readRepoFile("docs/HoaNam_ERD_Moi_Nhat.md");

    expect(erd).toContain("ERD-AMD-007");
    expect(erd).toMatch(/\*\*duplicate_rows\*\*\s+integer\s+No\s+DEFAULT 0/);
    expect(erd).toContain("58. migration_runs");
  });
});
