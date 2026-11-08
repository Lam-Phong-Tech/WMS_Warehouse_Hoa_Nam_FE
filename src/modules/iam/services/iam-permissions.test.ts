import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api/http";
import { getAllIamPermissions } from "./iam.service";
vi.mock("@/shared/api/http", () => ({ http: { getPage: vi.fn() } }));
describe("complete permission catalog for role and individual grants", () => {
  beforeEach(() => vi.clearAllMocks());
  it("loads supplier permissions even when the server caps the requested page size", async () => {
    const first = {
      permission_id: "catalog",
      permission_key: "catalog.view",
      permission_name: "Catalog",
      status: "ACTIVE",
      scope_type: "FUNCTION",
    };
    const supplier = {
      ...first,
      permission_id: "supplier",
      permission_key: "supplier.create",
      permission_name: "Thêm nhà cung cấp",
    };
    vi.mocked(http.getPage)
      .mockResolvedValueOnce({
        data: [first],
        meta: { current_page: 1, per_page: 1, total: 2, last_page: 2 },
      })
      .mockResolvedValueOnce({
        data: [supplier],
        meta: { current_page: 2, per_page: 1, total: 2, last_page: 2 },
      });
    const result = await getAllIamPermissions({ per_page: 100 });
    expect(result.data.map((row) => row.permission_key)).toEqual([
      "catalog.view",
      "supplier.create",
    ]);
    expect(http.getPage).toHaveBeenNthCalledWith(
      2,
      "/permissions",
      expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }),
    );
  });
  it("does not publish a partial catalog when a later page fails", async () => {
    vi.mocked(http.getPage)
      .mockResolvedValueOnce({
        data: [{ permission_id: "one" }],
        meta: { current_page: 1, total: 2, last_page: 2 },
      })
      .mockRejectedValueOnce(new Error("Second page unavailable"));
    await expect(getAllIamPermissions()).rejects.toThrow(
      "Second page unavailable",
    );
  });
});
