import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { API_ENDPOINTS } from "@/shared/api/endpoints";
import {
  WWHN_202_CONTRACT_REVISION,
  WWHN_202_ERROR_TAXONOMY,
  WWHN_202_READ_SURFACES,
  WWHN_202_RECONCILIATION_FIELDS,
} from "@/shared/api/wwhn-202-balance-contract-pin";
import * as inventoryService from "@/modules/inventory/services/inventoryService";
import * as reversalService from "@/modules/reverse/services/reversalService";

/**
 * WWHN-202 · DEV202-P1-05R2 — xác nhận phía FE cho hợp đồng "Balance hỗ trợ".
 *
 * Đây là bằng chứng thay cho câu "FE đã xem và thấy dùng được". Bốn thứ được khoá:
 *
 *  1. Path trong `API_ENDPOINTS` khớp đúng route BE đã đăng ký (pin).
 *  2. Mỗi bề mặt có hàm service **thật** và hàm đó **thật sự tham chiếu** đúng hằng
 *     endpoint — chặn đúng trường hợp `INVENTORY_RECONCILIATION` từng được khai nhưng
 *     không hàm nào gọi, khiến "reconcile usable" là tuyên bố không kiểm chứng được.
 *  3. Normalizer của balance không nuốt mất 3 trường đối soát mà RPT-INV-01 cần.
 *  4. FE không hardcode giả định sai về mã lỗi (đặc biệt: hết tồn là 422, không phải 409).
 *
 * Nửa BE: `tests/Feature/Wwhn202OutboundBalanceEvidenceTest.php`
 * (`test_read_surface_permission_matrix_matches_the_registered_routes` khoá cùng bảng
 * permission từ phía route thật) và `scripts/verify-wwhn-202-closure.mjs`.
 */

const REPO_ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("WWHN-202 — pin hợp đồng bề mặt đọc Balance hỗ trợ", () => {
  it("ghim đúng 8 route tạo nên 5 bề mặt nghiệp vụ mà register liệt kê", () => {
    expect(WWHN_202_READ_SURFACES).toHaveLength(8);
    expect(new Set(WWHN_202_READ_SURFACES.map((s) => s.surface)).size).toBe(8);
    // 5 nhóm nghiệp vụ: balance, subledger, movement(4 route), reversible, reconcile.
    expect(
      WWHN_202_READ_SURFACES.filter((s) => s.surface.startsWith("movement-")),
    ).toHaveLength(4);
  });

  it.each(WWHN_202_READ_SURFACES)(
    "$surface: API_ENDPOINTS.$endpointKey trỏ đúng path đã pin",
    ({ endpointKey, path }) => {
      const endpoints = API_ENDPOINTS as unknown as Record<string, string>;
      expect(
        endpoints[endpointKey],
        `API_ENDPOINTS.${endpointKey} phải tồn tại — FE và QA1 dùng chung path này.`,
      ).toBe(path);
    },
  );

  it.each(WWHN_202_READ_SURFACES)(
    "$surface: có hàm service $serviceExport và hàm đó gọi đúng hằng endpoint",
    ({ endpointKey, serviceExport, serviceModule }) => {
      const moduleExports = (serviceModule.includes("reversalService")
        ? reversalService
        : inventoryService) as unknown as Record<string, unknown>;

      expect(
        typeof moduleExports[serviceExport],
        `${serviceModule} phải export ${serviceExport}() — endpoint được khai mà không ai gọi thì không tính là usable.`,
      ).toBe("function");

      const source = readSource(serviceModule);
      expect(
        source.includes(`API_ENDPOINTS.${endpointKey}`),
        `${serviceExport}() phải dùng API_ENDPOINTS.${endpointKey}, không được hardcode path.`,
      ).toBe(true);
    },
  );

  it("không bề mặt nào bị bỏ lại trong endpoints.ts mà thiếu người gọi", () => {
    const pinnedKeys = WWHN_202_READ_SURFACES.map((s) => s.endpointKey);
    const serviceSources = [
      ...new Set(WWHN_202_READ_SURFACES.map((s) => s.serviceModule)),
    ]
      .map(readSource)
      .join("\n");

    const orphans = pinnedKeys.filter(
      (key) => !serviceSources.includes(`API_ENDPOINTS.${key}`),
    );
    expect(
      orphans,
      `Endpoint đã pin nhưng không service nào gọi: ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("normalizer balance giữ nguyên 3 trường đối soát của RPT-INV-01", () => {
    const source = readSource(
      "src/modules/inventory/services/inventoryService.ts",
    );
    for (const field of WWHN_202_RECONCILIATION_FIELDS) {
      expect(
        source.includes(field),
        `inventoryService phải đọc \`${field}\` — thiếu nó thì cổng "Ledger=Balance=subledger" không quan sát được trên UI.`,
      ).toBe(true);
    }
    // ledger_total được đọc dưới dạng raw + camelCase; kiểm cả hai để không bị đổi lặng lẽ.
    expect(source).toMatch(/ledger_total|ledgerTotal/);
  });

  it("ghim revision hợp đồng BE bằng sha256 của slice, không bằng số version", () => {
    expect(WWHN_202_CONTRACT_REVISION.openApiSliceSha256).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(WWHN_202_CONTRACT_REVISION.apiBasePath).toBe("/api/v1");
    expect(WWHN_202_CONTRACT_REVISION.decisionRecord).toBe("DEC-STK-202");
    // QA1 phải retest được đủ 8 bề mặt trên cùng collection Postman đã pin.
    expect(WWHN_202_CONTRACT_REVISION.postmanSurfaceCount).toBe(
      WWHN_202_READ_SURFACES.length,
    );
  });

  it("phân lớp mã lỗi bám DEC-STK-202: hết tồn là 422, xung đột idempotency là 409", () => {
    expect(WWHN_202_ERROR_TAXONOMY.insufficientStock).toEqual({
      http: 422,
      errorCode: "INSUFFICIENT_STOCK",
    });
    expect(WWHN_202_ERROR_TAXONOMY.idempotencyPayloadDiffers.http).toBe(409);
    expect(WWHN_202_ERROR_TAXONOMY.staleIfMatch.http).toBe(412);
    expect(WWHN_202_ERROR_TAXONOMY.missingIfMatch.http).toBe(428);
  });

  it("FE không suy mã lỗi từ message và không coi 409 là hết tồn", () => {
    for (const relativePath of [
      "src/modules/inventory/services/inventoryService.ts",
      "src/modules/reverse/services/reversalService.ts",
    ]) {
      const source = readSource(relativePath);
      expect(
        /409[^\n]{0,40}(INSUFFICIENT|hết tồn|het ton)/i.test(source),
        `${relativePath} không được gán 409 cho tình huống hết tồn (§8.2 + DEC-STK-202 §D-1).`,
      ).toBe(false);
    }
  });
});
