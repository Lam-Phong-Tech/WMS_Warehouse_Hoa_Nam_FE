import { describe, expect, it } from "vitest";

import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { ROUTES } from "@/shared/constants/routes";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";

/**
 * WWHN-236 — khoá nửa FE của disposition DISP-STK-236
 * (BE `docs/decision-records/DISP-STK-236-APPLY-ADJUSTMENT-DEFERRED.md`).
 *
 * `REQ-SRS-037` (Must, SRS/FRD v1.12 adopt tại WWHN-334) cấm expose Stocktake/Variance
 * ở **menu, screen, permission, API client** — không riêng backend. AC-SRS-037 nói rõ
 * deployment v1.12 không được chứa capability legacy.
 *
 * Khác biệt với các guard đã có:
 * - `src/app/router/access.test.ts` khoá key `STOCKTAKE` trong ROUTES.
 * - `src/test/wms-contract-signoff-guards.test.ts` khoá permission chứa "stocktake".
 * - File này khoá thêm bề mặt **adjustment/variance** — tên gọi mà một route sửa tồn
 *   có thể mang mà không hề chứa chữ "stocktake" — và khoá chiều ngược lại: đường sửa
 *   sai hợp lệ (Reversal) phải còn nguyên.
 *
 * Nhánh count/recount (`recount`, `cycle-count`, `physical-count`) thuộc WWHN-233 và
 * cố ý không nằm ở đây (DISP-STK-236 §4).
 */
describe("WWHN-236 · DISP-STK-236 — Apply Adjustment DEFERRED (FE surface)", () => {
  const FORBIDDEN = /stocktake|adjustment|variance/i;

  it("không có route nào mang ngữ nghĩa kiểm kê hoặc sửa tồn trực tiếp", () => {
    const offendingKeys = Object.keys(ROUTES).filter((key) =>
      FORBIDDEN.test(key),
    );
    expect(offendingKeys).toEqual([]);

    const offendingPaths = Object.values(ROUTES).filter(
      (path) => typeof path === "string" && FORBIDDEN.test(path),
    );
    expect(offendingPaths).toEqual([]);
  });

  it("permission catalog không cấp quyền kiểm kê, adjustment hay variance", () => {
    const codes = Object.values(WMS_PERMISSION_CATALOG).filter(
      (value): value is string => typeof value === "string",
    );

    expect(codes.filter((code) => FORBIDDEN.test(code))).toEqual([]);

    // `stocktake.adjust` là permission mà DEC-STK-001 (PROPOSED) từng dự kiến. Nó
    // không được xuất hiện lại dưới bất kỳ biến thể nào.
    for (const legacy of [
      "stocktake.adjust",
      "stocktake.manage",
      "stocktake.count",
      "inventory.adjust",
    ]) {
      expect(codes).not.toContain(legacy);
    }
  });

  it("API client không khai endpoint apply-adjustment", () => {
    const paths = Object.values(API_ENDPOINTS).filter(
      (value): value is string => typeof value === "string",
    );

    expect(paths.filter((path) => FORBIDDEN.test(path))).toEqual([]);
    expect(paths.some((path) => path.includes("apply-adjustment"))).toBe(false);
  });

  it("giữ nguyên đường sửa sai hợp lệ — Reversal append-only", () => {
    // Chiều ngược lại của cùng một quyết định: vì Apply Adjustment bị loại, Reversal là
    // correction path duy nhất (BR-REV-01/02). Gỡ nó đi là gỡ luôn cách sửa sai hợp lệ.
    const paths = Object.values(API_ENDPOINTS).filter(
      (value): value is string => typeof value === "string",
    );

    expect(paths).toContain("/reversal-documents");
    expect(Object.values(WMS_PERMISSION_CATALOG)).toContain(
      "inventory.reversal.post",
    );
    expect(ROUTES.REVERSE).toBe("/reverse");
  });
});
