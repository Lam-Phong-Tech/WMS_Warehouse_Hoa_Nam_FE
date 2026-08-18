import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import {
  cancelReversalDocument,
  confirmReversalDocument,
  createReversalDocument,
  fetchReversalDocuments,
  fetchReversalLines,
  postReversalDocument,
} from "./reversalService";

describe("reversalService — luồng 05 REV-00/REV-01", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.post).mockReset();
  });

  it("normalize header theo SRS §6: giữ DRAFT/POSTED/CANCELLED và physical_return_status", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: "rev-1",
          reversal_code: "REV-20260817-0001",
          status: "POSTED",
          physical_return_status: "CONFIRMED",
          reference_document_type: "OUTBOUND",
          reference_document_code: "OUT-20260802-014",
          reference_document_id: "doc-1",
          correction_chain_id: "chain-1",
          warehouse_id: "wh-1",
          warehouse_name: "Kho tổng",
          total_lines: 1,
          total_qty: 1,
          reason_code: "CORRECTION",
          reason: "Giao nhầm Item",
          version: 3,
          created_at: "2026-08-17T00:00:00Z",
        },
      ],
      meta: { total: 1, page: 1, per_page: 15 },
    });

    const result = await fetchReversalDocuments({ status: "POSTED" });

    expect(result.rows[0]).toMatchObject({
      status: "POSTED",
      physical_return_status: "CONFIRMED",
      correction_chain_id: "chain-1",
      version: 3,
    });
  });

  it("phân biệt SL movement gốc với SL đảo và phần còn đảo được (BR-REV-05)", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: "line-1",
          reversal_document_id: "rev-1",
          line_no: 1,
          original_movement_id: "mv-1",
          original_movement_code: "MOV-ISSUE-000882",
          sku: "DCH-DRILL-DJZ10A-220V-V1",
          sku_name: "Máy khoan",
          original_qty: 5,
          reversal_qty: 2,
          reversed_qty: 2,
          remaining_qty: 3,
          return_condition: "SELLABLE",
          status: "POSTED",
        },
      ],
      meta: {},
    });

    const [line] = await fetchReversalLines("rev-1");

    expect(http.getPage).toHaveBeenCalledWith(
      "/reversal-documents/rev-1/lines",
    );
    expect(line.original_qty).toBe(5);
    expect(line.reversal_qty).toBe(2);
    expect(line.remaining_qty).toBe(3);
    expect(line.return_condition).toBe("SELLABLE");
  });

  it("create gửi Idempotency-Key + If-Match và không còn khái niệm reversal_type", async () => {
    vi.mocked(http.post).mockResolvedValue({ id: "rev-1" });

    await createReversalDocument({
      reference_document_id: "doc-1",
      reference_document_type: "OUTBOUND",
      reason: "Giao nhầm Item",
      return_condition: "SELLABLE",
      physical_return_confirmed: true,
      lines: [{ sku: "SKU-1", reversal_qty: 1, item_id: "item-1" }],
      idempotency_key: "idem-1",
      reference_version: "2",
    });

    const [url, body, config] = vi.mocked(http.post).mock.calls[0];
    expect(url).toBe("/reversal-documents");
    expect(body).not.toHaveProperty("reversal_type");
    expect(body).toMatchObject({
      reference_document_id: "doc-1",
      return_condition: "SELLABLE",
      physical_return_confirmed: true,
      lines: [{ sku: "SKU-1", reversal_qty: 1, item_id: "item-1" }],
    });
    expect(config?.headers).toMatchObject({
      "Idempotency-Key": "idem-1",
      "If-Match": "2",
    });
  });

  it("create fail-closed khi thiếu Idempotency-Key", async () => {
    await expect(
      createReversalDocument({
        reference_document_id: "doc-1",
        reference_document_type: "INBOUND",
        reason: "Nhập nhầm",
        lines: [{ sku: "SKU-1", reversal_qty: 1 }],
        idempotency_key: "",
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_IDEMPOTENCY_KEY_REQUIRED" });
    expect(http.post).not.toHaveBeenCalled();
  });

  it("confirm/post/cancel gửi đúng If-Match theo version (BR-REV-02)", async () => {
    vi.mocked(http.post).mockResolvedValue({});

    await confirmReversalDocument({
      id: "rev-1",
      version: 1,
      return_condition: "DEFECTIVE",
    });
    expect(vi.mocked(http.post).mock.calls[0][0]).toBe(
      "/reversal-documents/rev-1/confirm",
    );
    expect(vi.mocked(http.post).mock.calls[0][1]).toEqual({
      return_condition: "DEFECTIVE",
    });
    expect(vi.mocked(http.post).mock.calls[0][2]?.headers).toEqual({
      "If-Match": "1",
    });

    await postReversalDocument({
      id: "rev-1",
      version: 2,
      idempotency_key: "idem-post-1",
    });
    expect(vi.mocked(http.post).mock.calls[1][2]?.headers).toEqual({
      "If-Match": "2",
      "Idempotency-Key": "idem-post-1",
    });

    await cancelReversalDocument({
      id: "rev-1",
      version: 2,
      reason: "Huỷ do nhập sai",
    });
    expect(vi.mocked(http.post).mock.calls[2][0]).toBe(
      "/reversal-documents/rev-1/cancel",
    );
    expect(vi.mocked(http.post).mock.calls[2][2]?.headers).toEqual({
      "If-Match": "2",
    });
  });

  it("post fail-closed khi thiếu Idempotency-Key (BR-REV-12)", async () => {
    await expect(
      postReversalDocument({ id: "rev-1", version: 1, idempotency_key: "" }),
    ).rejects.toMatchObject({ code: "WMS_FE_IDEMPOTENCY_KEY_REQUIRED" });
    expect(http.post).not.toHaveBeenCalled();
  });
});
