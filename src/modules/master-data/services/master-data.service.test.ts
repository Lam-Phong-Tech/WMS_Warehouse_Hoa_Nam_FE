import { describe, expect, it, vi, beforeEach } from "vitest";
import { http } from "@/shared/api/http";
import {
  createProduct,
  createProductCategory,
  getItems,
  getPhysicalCodes,
  getProductCategories,
  getProducts,
  getSuppliers,
  getUoms,
  importSkus,
  updateProductStatus,
} from "@/modules/master-data/services/master-data.service";

vi.mock("@/shared/api/http", () => ({
  http: {
    getPage: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("master-data.service contract mapping", () => {
  beforeEach(() => {
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.patch).mockReset();
  });

  it("maps Product/SKU list to canonical /products with cleaned params and OpenAPI sort format", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [{ id: 1, product_code: "SKU-001", name: "Inverter", status: "active" }],
      meta: { total: 1 },
    });

    await expect(
      getProducts({
        page: 2,
        per_page: 50,
        search: "inverter",
        status: "active",
        sort_by: "product_code",
        sort_direction: "desc",
      }),
    ).resolves.toMatchObject({ meta: { total: 1 } });

    expect(http.getPage).toHaveBeenCalledWith("/products", {
      params: {
        page: 2,
        per_page: 50,
        search: "inverter",
        status: "active",
        sort: "-product_code",
      },
    });
  });

  it("uses only canonical category and reference endpoints", async () => {
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });

    await getProductCategories({ page: 1, per_page: 15, search: "" });
    await getUoms();
    await getSuppliers();

    expect(http.getPage).toHaveBeenNthCalledWith(1, "/product-categories", {
      params: { page: 1, per_page: 15 },
    });
    expect(http.getPage).toHaveBeenNthCalledWith(2, "/uoms", {
      params: { per_page: 100, status: 1 },
    });
    expect(http.getPage).toHaveBeenNthCalledWith(3, "/suppliers", {
      params: { per_page: 100, status: 1 },
    });
  });

  it("creates product/category and toggles product status through canonical endpoints", async () => {
    vi.mocked(http.post).mockResolvedValue({ id: 1 });
    vi.mocked(http.patch).mockResolvedValue({ id: 1, status: "inactive" });

    await createProduct({
      product_code: "SKU-001",
      name: "Inverter",
      uom_id: 1,
      list_price_net: 100000,
      vat_rate: 8,
      status: "active",
    });
    await createProductCategory({ code: "PV", name: "PV", status: 1 });
    await updateProductStatus(1, "inactive");
    await updateProductStatus(1, "active");

    expect(http.post).toHaveBeenNthCalledWith(1, "/products", expect.any(Object));
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      "/product-categories",
      expect.any(Object),
    );
    expect(http.patch).toHaveBeenNthCalledWith(1, "/products/1/disable", {
      status: "inactive",
    });
    expect(http.patch).toHaveBeenNthCalledWith(2, "/products/1/enable", {
      status: "active",
    });
  });

  it("blocks item, physical-code, and import runtime until BE publishes OpenAPI contracts", async () => {
    await expect(getItems({ page: 1, per_page: 15 })).rejects.toThrow(
      "/items is not in OpenAPI",
    );
    await expect(getPhysicalCodes({ page: 1, per_page: 15 })).rejects.toThrow(
      "/physical-codes is not in OpenAPI",
    );
    await expect(importSkus(new File([""], "sku.csv"))).rejects.toThrow(
      "/skus/import-excel is not in OpenAPI",
    );

    expect(http.getPage).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
    expect(http.patch).not.toHaveBeenCalled();
  });
});
