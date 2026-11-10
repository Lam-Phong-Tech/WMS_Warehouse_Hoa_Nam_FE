import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api/http";
import {
  createSupplier,
  listSuppliers,
  updateSupplier,
} from "./supplier.service";

vi.mock("@/shared/api/http", () => ({
  http: { getPage: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
const row = {
  id: "supplier-uuid",
  code: "NCC-001",
  name: "Honda",
  status: "ACTIVE",
  version: 4,
  updated_at: "2026-11-08T01:00:00+07:00",
  display_name: "NCC-001 - Honda",
  code_status: "ASSIGNED",
  description: "Linh kiện nhập khẩu",
};

describe("supplier transport", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses P04 q/status/page/per_page and respects meta.page", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [row],
      meta: { page: 2, per_page: 10, total: 12, last_page: 2 },
    });
    const result = await listSuppliers({
      q: "Honda",
      status: "ACTIVE",
      page: 2,
      per_page: 10,
    });
    expect(http.getPage).toHaveBeenCalledWith(
      "/mini-app/inbound/suppliers",
      expect.objectContaining({
        params: { q: "Honda", status: "ACTIVE", page: 2, per_page: 10 },
      }),
    );
    expect(result.page).toBe(2);
    expect(result.total).toBe(12);
    expect(result.rows[0].id).toBe("supplier-uuid");
  });
  it("sends only writable fields on create, with no fabricated code", async () => {
    vi.mocked(http.post).mockResolvedValue(row);
    await createSupplier({
      name: "  Honda  ",
      status: "ACTIVE",
      description: "  Nhà cung cấp  ",
    });
    expect(http.post).toHaveBeenCalledWith("/mini-app/inbound/suppliers", {
      name: "Honda",
      status: "ACTIVE",
      description: "Nhà cung cấp",
    });
  });
  it("updates UUID using the exact returned version in If-Match", async () => {
    vi.mocked(http.patch).mockResolvedValue(row);
    await updateSupplier(row.id, 4, {
      name: "New name",
      status: "INACTIVE",
      description: "  ",
    });
    expect(http.patch).toHaveBeenCalledWith(
      "/mini-app/inbound/suppliers/supplier-uuid",
      { name: "New name", status: "INACTIVE", description: null },
      { headers: { "If-Match": '"4"' } },
    );
  });
  it("refuses missing versions before writing", async () => {
    await expect(
      updateSupplier(row.id, 0, { name: "New", status: "ACTIVE" }),
    ).rejects.toThrow();
    expect(http.patch).not.toHaveBeenCalled();
  });
  it("treats a missing description as null and accepts the shared max length", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [{ ...row, description: undefined }],
      meta: { page: 1, per_page: 20, total: 1, last_page: 1 },
    });
    expect(
      (await listSuppliers({ status: "ACTIVE", page: 1, per_page: 20 })).rows[0]
        .description,
    ).toBeNull();
    await expect(
      updateSupplier(row.id, 4, {
        name: "New",
        status: "ACTIVE",
        description: "a".repeat(501),
      }),
    ).rejects.toThrow();
    expect(http.patch).not.toHaveBeenCalled();
  });
  it("preserves unassigned legacy codes and rejects incomplete API rows", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [{ ...row, code: null, code_status: "NOT_ASSIGNED" }],
      meta: { page: 1, per_page: 20, total: 1, last_page: 1 },
    });
    expect(
      (await listSuppliers({ status: "ACTIVE", page: 1, per_page: 20 })).rows[0]
        .code,
    ).toBeNull();
    vi.mocked(http.getPage).mockResolvedValue({
      data: [{ ...row, version: null }],
      meta: { total: 1 },
    });
    await expect(
      listSuppliers({ status: "ACTIVE", page: 1, per_page: 20 }),
    ).rejects.toThrow();
  });
});
