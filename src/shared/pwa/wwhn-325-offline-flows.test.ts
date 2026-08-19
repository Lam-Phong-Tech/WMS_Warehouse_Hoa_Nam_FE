import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// setup.ts mock toàn cục axios (adapter giả trả undefined). Test này cần đúng
// interceptor chain thật của shared client nên chỉ giả lập tầng HTTP adapter,
// giống axios.refresh.integration.test.ts.
vi.unmock("axios");
vi.unmock("@/shared/api/axios");

import MockAdapter from "axios-mock-adapter";
import { api } from "@/shared/api/axios";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { OFFLINE_MUTATION_CODE } from "@/shared/pwa/offline-policy";
import { postOutboundIssue } from "@/modules/outbound/services/mvpOutboundService";
import { postReversalDocument } from "@/modules/reverse/services/reversalService";

/**
 * WWHN-325 / FE325-P1-12: bằng chứng automated cho QA assertion "receipt, issue,
 * reversal, adjustment khi offline không gửi request, không queue, không replay".
 *
 * Guard nằm ở request interceptor của shared axios client (`api`), tức TRƯỚC
 * HTTP adapter. Vì vậy mock được đặt ở tầng adapter: nếu adapter không bao giờ
 * nhận request (history rỗng) thì về mặt cơ chế KHÔNG THỂ có network call,
 * không có hàng đợi và không có replay — mọi flow mutation dùng `http`/`api`
 * đều fail-safe tại một điểm duy nhất.
 *
 * - Receipt/Issue/Reversal: có bề mặt FE thật (inbound/outbound/reversal
 *   service đều đi qua `http` → `api`).
 * - Adjustment: KHÔNG có bề mặt FE (WWHN-236 Apply Adjustment =
 *   DEFERRED/NO-CODE; xem src/test/wwhn-236-adjustment-deferral-gate.test.ts).
 *   Bằng chứng ở đây là mức endpoint: kể cả khi một adjustment endpoint được
 *   gọi qua shared client thì vẫn bị chặn theo method, không phụ thuộc path.
 */
describe("WWHN-325 offline mutation guard — receipt/issue/reversal/adjustment", () => {
  let mock: MockAdapter;
  let onLine = true;

  function setOnLine(value: boolean) {
    onLine = value;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => onLine,
    });
  }

  beforeEach(() => {
    mock = new MockAdapter(api);
    mock.onAny().reply(200, { success: true, data: {} });
    setOnLine(false);
  });

  afterEach(() => {
    mock.restore();
    setOnLine(true);
  });

  function mutationHistoryCount(): number {
    return (
      mock.history.post.length +
      mock.history.put.length +
      mock.history.patch.length +
      mock.history.delete.length
    );
  }

  async function expectOfflineBlocked(promise: Promise<unknown>) {
    await expect(promise).rejects.toMatchObject({
      code: OFFLINE_MUTATION_CODE,
    });
  }

  it("blocks Post Issue (flow-level, real outbound service) without any network call", async () => {
    await expectOfflineBlocked(
      postOutboundIssue({
        documentId: "e2e-325-out",
        ifMatch: 1,
        idempotencyKey: "wwhn325-issue-1",
      }),
    );
    expect(mutationHistoryCount()).toBe(0);
  });

  it("blocks Post Reversal (flow-level, real reversal service) without any network call", async () => {
    await expectOfflineBlocked(
      postReversalDocument({
        id: "e2e-325-rev",
        version: 1,
        idempotency_key: "wwhn325-rev-1",
      }),
    );
    expect(mutationHistoryCount()).toBe(0);
  });

  it("blocks Post Receipt endpoint and adjustment-style endpoints at the shared client", async () => {
    await expectOfflineBlocked(
      http.post(
        API_ENDPOINTS.INBOUND_POST_RECEIPT.replace(":id", "e2e-325-in"),
        undefined,
        {
          headers: {
            "If-Match": "1",
            "Idempotency-Key": "wwhn325-receipt-1",
          },
        },
      ),
    );

    // Adjustment không có FE surface (WWHN-236 DEFERRED/NO-CODE); guard theo
    // method vẫn phải chặn mọi biến thể ghi nếu một endpoint như vậy xuất hiện.
    await expectOfflineBlocked(http.post("/adjustments/apply", { qty: 1 }));
    await expectOfflineBlocked(http.put("/adjustments/e2e-325", { qty: 1 }));
    await expectOfflineBlocked(http.patch("/adjustments/e2e-325", { qty: 1 }));
    await expectOfflineBlocked(http.delete("/adjustments/e2e-325"));

    expect(mutationHistoryCount()).toBe(0);
  });

  it("does not queue or replay blocked mutations after reconnect (no-queue/no-replay)", async () => {
    await expectOfflineBlocked(
      postOutboundIssue({
        documentId: "e2e-325-out",
        ifMatch: 1,
        idempotencyKey: "wwhn325-issue-replay",
      }),
    );
    expect(mutationHistoryCount()).toBe(0);

    // Online trở lại: nếu tồn tại bất kỳ hàng đợi/optimistic retry nào thì
    // adapter sẽ nhận request trong các microtask/macrotask kế tiếp.
    setOnLine(true);
    window.dispatchEvent(new Event("online"));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mutationHistoryCount()).toBe(0);
  });

  it("keeps read-only GET usable offline and mutations usable online (control)", async () => {
    // Control 1: offline GET không bị guard chặn (read-only shell theo SRS).
    await http.get("/health");
    expect(mock.history.get.length).toBe(1);

    // Control 2: online mutation đi qua bình thường — guard không over-block.
    setOnLine(true);
    await http.post("/adjustments/apply", { qty: 1 });
    expect(mock.history.post.length).toBe(1);
  });
});
