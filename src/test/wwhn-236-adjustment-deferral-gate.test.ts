import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * `ROUTES`, `API_ENDPOINTS` và `WMS_PERMISSION_CATALOG` đều khai `as const`, nên
 * `Object.values(...)` trả về **union literal hẹp** chứ không phải `string[]`. Viết
 * `.filter((value): value is string => …)` trực tiếp trên đó là **nới rộng** kiểu, và
 * `tsc -b` chặn bằng TS2677 ("A type predicate's type must be assignable to its
 * parameter's type") — đúng lỗi đã làm hook pre-push từ chối push.
 *
 * Helper này đi qua `Record<string, unknown>` để phần tử là `unknown`, nhờ đó predicate
 * trở lại là **thu hẹp** và hợp kiểu. Nó giữ nguyên ý runtime ban đầu (bỏ giá trị không
 * phải chuỗi nếu catalog sau này lồng object/array) và không phụ thuộc hình dạng hiện
 * tại của catalog, nên guard không vỡ khi ba nguồn trên đổi cấu trúc.
 *
 * Không dùng `Object.values(x) as string[]`: cách đó im lặng nuốt cả giá trị lồng và
 * làm guard REQ-SRS-037 báo xanh sai khi catalog chuyển sang dạng nhóm.
 */
function stringValues(source: Record<string, unknown>): string[] {
  return Object.values(source).filter(
    (value): value is string => typeof value === "string",
  );
}

describe("WWHN-236 · DISP-STK-236 — Apply Adjustment DEFERRED (FE surface)", () => {
  const FORBIDDEN = /stocktake|adjustment|variance/i;

  it("không có route nào mang ngữ nghĩa kiểm kê hoặc sửa tồn trực tiếp", () => {
    const offendingKeys = Object.keys(ROUTES).filter((key) =>
      FORBIDDEN.test(key),
    );
    expect(offendingKeys).toEqual([]);

    const offendingPaths = stringValues(ROUTES).filter((path) =>
      FORBIDDEN.test(path),
    );
    expect(offendingPaths).toEqual([]);
  });

  it("permission catalog không cấp quyền kiểm kê, adjustment hay variance", () => {
    const codes = stringValues(WMS_PERMISSION_CATALOG);

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
    const paths = stringValues(API_ENDPOINTS);

    expect(paths.filter((path) => FORBIDDEN.test(path))).toEqual([]);
    expect(paths.some((path) => path.includes("apply-adjustment"))).toBe(false);
  });

  it("giữ nguyên đường sửa sai hợp lệ — Reversal append-only", () => {
    // Chiều ngược lại của cùng một quyết định: vì Apply Adjustment bị loại, Reversal là
    // correction path duy nhất (BR-REV-01/02). Gỡ nó đi là gỡ luôn cách sửa sai hợp lệ.
    const paths = stringValues(API_ENDPOINTS);

    expect(paths).toContain("/reversal-documents");
    expect(stringValues(WMS_PERMISSION_CATALOG)).toContain(
      "inventory.reversal.post",
    );
    expect(ROUTES.REVERSE).toBe("/reverse");
  });

  it("ba nguồn guard vẫn phẳng nên bốn test trên đọc được toàn bộ bề mặt", () => {
    // Guard tự bảo vệ chính nó: nếu một catalog chuyển sang dạng lồng, `stringValues()`
    // sẽ bỏ qua phần lồng và bốn test trên có thể báo xanh sai. Chốt "số giá trị chuỗi =
    // số key" để trường hợp đó lộ ra ngay tại đây thay vì lộ ở deployment.
    expect(stringValues(ROUTES).length).toBe(Object.keys(ROUTES).length);
    expect(stringValues(API_ENDPOINTS).length).toBe(
      Object.keys(API_ENDPOINTS).length,
    );
    expect(stringValues(WMS_PERMISSION_CATALOG).length).toBe(
      Object.keys(WMS_PERMISSION_CATALOG).length,
    );
  });
});

/**
 * WWHN-236 R3 — governance parity giữa hai repo (DEV236-P1-01R3 / P1-03R3 / P1-04R3).
 *
 * Bốn test trên khoá *bề mặt*. Ba test dưới khoá *cách task được đóng*: nếu bản ghi
 * phê duyệt biến mất, nếu một ticket trong chuỗi quay lại `Blocked`, hoặc nếu identity
 * của nửa FE không còn trỏ tới commit nào, thì suite này đỏ — không phải chờ tới vòng
 * rà soát sau mới phát hiện.
 *
 * Hai repo có thể được checkout lệch nhau nên phần đọc sang BE tự bỏ qua khi không
 * thấy file, đúng như verifier FE đang làm; điều đó không được biến thành lỗi FE.
 */
describe("WWHN-236 · R3 governance (DISP-STK-236)", () => {
  const FE_ROOT = join(__dirname, "..", "..");
  const BE_ROOT = join(
    FE_ROOT,
    "..",
    "..",
    "HoaNam_BE",
    "WMS_Warehouse_Hoa_Nam_BE",
  );

  const readJson = (
    root: string,
    rel: string,
  ): Record<string, unknown> | null => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return null;
    return JSON.parse(readFileSync(abs, "utf8")) as Record<string, unknown>;
  };

  it("bản ghi phê duyệt giữ decision/limitation và không tự tuyên bố APPROVED", () => {
    const approval = readJson(
      BE_ROOT,
      "docs/decision-records/DISP-STK-236-APPROVAL.json",
    );
    if (approval === null) {
      expect(existsSync(BE_ROOT)).toBe(false); // repo BE không có mặt ở checkout này
      return;
    }

    expect(approval.decision).toBe("DEFERRED_NO_CODE");
    expect(approval.controllingRequirement).toBe("REQ-SRS-037");

    const limitation = approval.limitationAccepted as Record<string, unknown>;
    expect(limitation?.id).toBe("LIM-STK-236-01");
    expect(JSON.stringify(limitation)).toContain("reconciliation_incidents");

    // Chặn đúng thứ nguy hiểm nhất: APPROVED mà chưa đủ chữ ký hoặc chưa có ngày hiệu lực.
    if (approval.status === "APPROVED") {
      expect(approval.effectiveDate).not.toBeNull();
      const signOff = approval.signOff as Record<
        string,
        { decision: string | null }
      >;
      for (const [role, signature] of Object.entries(signOff)) {
        expect(signature.decision, `vai trò ${role} chưa ký`).not.toBeNull();
      }
    }
  });

  it("không ticket nào trong chuỗi bị để Blocked/Pending", () => {
    const chain = readJson(
      BE_ROOT,
      "docs/evidence/WWHN-236/CHAIN_DISPOSITION.json",
    );
    if (chain === null) {
      expect(existsSync(BE_ROOT)).toBe(false);
      return;
    }

    const tickets = chain.tickets as Array<{
      ticket: string;
      targetStatus: string;
      disposition: string;
    }>;
    expect(tickets.length).toBeGreaterThan(0);

    for (const ticket of tickets) {
      expect(
        ticket.targetStatus.toLowerCase(),
        `${ticket.ticket}`,
      ).not.toContain("blocked");
      expect(
        ticket.targetStatus.toLowerCase(),
        `${ticket.ticket}`,
      ).not.toContain("pending");
      expect(ticket.disposition).toContain("DEFERRED");
    }

    for (const qa of (chain.qaTasksMustNotBeBlocked as string[]) ?? []) {
      const entry = tickets.find((t) => t.ticket === qa);
      expect(entry, `QA task ${qa} không có trong chuỗi`).toBeDefined();
      expect(entry?.targetStatus).toMatch(/DEFERRED|N\/A/i);
    }
  });

  /*
   * 3822d45 (09/2026) chủ đích rút kho lưu trữ docs/evidence + Task_docs_Jira +
   * e2e spec khỏi repo ("remove stale docs/evidence + Task_docs_Jira archives").
   * Theo nguyên tắc của chính các gate này — guard không sống lâu hơn artefact
   * nó khoá — các test ĐỌC những artefact đã rút được gỡ theo tại đây; phần khoá
   * baseline/hợp đồng còn trong repo giữ nguyên hiệu lực.
   */
});
