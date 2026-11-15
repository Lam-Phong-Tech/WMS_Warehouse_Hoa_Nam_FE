import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SkuMasterScreen } from "./ApiMasterScreens";
import { SideNav } from "@/app/layouts/SideNav";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";

vi.mock("@/modules/master-data/hooks/use-mvp-master", () => {
  const mutation = () => ({ isPending: false, mutateAsync: vi.fn() });
  // Query caches retain row identity until a response changes. The detail
  // drawer follows that identity when synchronizing refreshed SKU data.
  const skuData = {
    data: [
      {
        sku_id: "incomplete",
        sku_code: "SKU-001",
        sku_name: "Fixture product",
        sku_type: "PRODUCT",
        status: "ACTIVE",
        unit: "pc",
        version: 1,
      },
    ],
    meta: { total: 1 },
  };
  return {
    useMvpSkus: () => ({
      data: skuData,
      isLoading: false,
      isSuccess: true,
      refetch: vi.fn(),
    }),
    useMvpProductCatalogs: () => ({
      data: {
        brands: [{ id: "brand-1", code: "BRAND", name: "Fixture brand" }],
        categories: [],
        models: [],
        powerSources: [],
        packageVariants: [],
      },
      isLoading: false,
    }),
    useMvpSkuHasStock: () => ({ data: false, isLoading: false }),
    useCreateMvpSku: mutation,
    useUpdateMvpSku: mutation,
    useSetMvpSkuPublished: mutation,
  };
});

beforeAll(async () => {
  await Promise.all([ensureChineseMessages(), ensureEnglishMessages()]);
});

afterEach(() => {
  cleanup();
  useLanguageStore.setState({ language: "vi" });
  useAuthStore.setState({ isSuperAdmin: false, permissionCodes: [] });
});

describe.each([
  {
    language: "en" as const,
    title: "SKU list",
    filters: "Filters",
    information: "Information: All",
    complete: "Information: Complete",
    pending: "Information: Pending details",
    brand: "Brand: All",
    brandChoice: "Brand: Fixture brand",
    informationAria: "Filter information completeness",
    searchAria: "Search and filter SKUs",
    unit: "Unit",
    product: "Type: Product",
    component: "Type: Component",
    missing: "Missing: Brand, Category, Model",
    details: "View details",
    basic: "BASIC INFORMATION",
    operations: "MANAGEMENT & OPERATIONS",
    model: "Model",
    close: "Close details",
    heading: "HOA NAM SCANNER",
    warehouse: "Hoa Nam Warehouse",
  },
  {
    language: "zh" as const,
    title: "SKU 列表",
    filters: "筛选",
    information: "信息：全部",
    complete: "信息：完整",
    pending: "信息：待完善",
    brand: "品牌：全部",
    brandChoice: "品牌: Fixture brand",
    informationAria: "按信息完整度筛选",
    searchAria: "搜索和筛选 SKU",
    unit: "单位",
    product: "类型：产品",
    component: "类型：配件",
    missing: "缺少: 品牌, 类别, 型号",
    details: "查看详情",
    basic: "基本信息",
    operations: "管理与运营",
    model: "型号",
    close: "关闭详情",
    heading: "HOA NAM 扫描器",
    warehouse: "华南仓库",
  },
])("SKU UI in $language", (labels) => {
  it("localizes filter choices, incomplete fields and detail sections", async () => {
    useLanguageStore.setState({ language: labels.language });
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: labels.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(labels.information)).toBeInTheDocument();
    expect(screen.getByText(labels.missing)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: labels.searchAria }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: labels.unit }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: labels.filters }));
    expect(screen.getByText(labels.brand)).toBeVisible();
    fireEvent.mouseDown(screen.getByText(labels.brand));
    expect(
      await screen.findByRole("option", { name: labels.brandChoice }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: labels.informationAria }),
    );
    expect(
      await screen.findByRole("option", { name: labels.pending }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: labels.complete }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    fireEvent.mouseDown(
      screen.getByText(labels.language === "zh" ? "类型：全部" : "Type: All"),
    );
    expect(
      await screen.findByRole("option", { name: labels.product }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: labels.component }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: labels.details }));
    expect(
      screen.getByRole("heading", { name: labels.basic }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: labels.operations }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(labels.model, { selector: "dt" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: labels.close }),
    ).toBeInTheDocument();
  });

  it("localizes the scanner descriptor and warehouse card while retaining HOA NAM", () => {
    useLanguageStore.setState({ language: labels.language });
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
    render(
      <MemoryRouter>
        <SideNav />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: labels.heading }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(labels.warehouse, { selector: "strong" }),
    ).toBeInTheDocument();
  });
});
