import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  cleanupCreatedQueryClients,
  renderWithProviders,
} from "@/test/test-utils";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLanguageStore } from "@/shared/i18n/language.store";
import type { PvAdminProfile } from "@/modules/pv/types/pv.types";

const { listPvAdminResourcesMock, setPvProductPublishedMock, getMvpSkusMock } =
  vi.hoisted(() => ({
    listPvAdminResourcesMock: vi.fn(),
    setPvProductPublishedMock: vi.fn(),
    getMvpSkusMock: vi.fn(),
  }));

vi.mock("@/modules/pv/services/pv-admin.service", () => ({
  listPvAdminResources: listPvAdminResourcesMock,
  setPvProductPublished: setPvProductPublishedMock,
  createPvProfile: vi.fn(),
  updatePvProfile: vi.fn(),
  createPvIndustry: vi.fn(),
  updatePvIndustry: vi.fn(),
  createPvTag: vi.fn(),
  updatePvTag: vi.fn(),
  createPvRule: vi.fn(),
  updatePvRule: vi.fn(),
}));

vi.mock("@/modules/master-data/services/mvp-master.service", () => ({
  getMvpSkus: getMvpSkusMock,
  getMvpAgencies: vi.fn(),
  getMvpDefects: vi.fn(),
  getMvpProductCatalogs: vi.fn(),
  hasMvpSkuStock: vi.fn(),
  createMvpSku: vi.fn(),
  updateMvpSku: vi.fn(),
  setMvpSkuPublished: vi.fn(),
  createMvpAgency: vi.fn(),
  updateMvpAgency: vi.fn(),
  createMvpDefect: vi.fn(),
  updateMvpDefect: vi.fn(),
}));

import { PvProductCatalogPage } from "@/modules/pv/pages/PvProductCatalogPage";

const WITH_IMAGE: PvAdminProfile = {
  id: "33333333-3333-4333-8333-333333333333",
  sku_id: "11111111-1111-4111-8111-111111111111",
  sku_code: "SKU-PV-001",
  sku_name: "Máy khoan cầm tay",
  sku_status: "ACTIVE",
  display_name: "Máy khoan cầm tay HN",
  description: "Mô tả cho khách xem",
  sort_order: 7,
  published: true,
  industry_ids: ["industry-tools"],
  tag_ids: [],
  images: [
    {
      url: "https://res.cloudinary.com/demo/image/upload/v1/pv/a.jpg",
      alt_text: "Ảnh chính",
      is_primary: true,
    },
  ],
  version: 3,
};

const WITHOUT_IMAGE: PvAdminProfile = {
  ...WITH_IMAGE,
  id: "44444444-4444-4444-8444-444444444444",
  sku_id: "22222222-2222-4222-8222-222222222222",
  sku_code: "SKU-PV-002",
  sku_name: "Máy mài góc",
  display_name: "Máy mài góc HN",
  published: false,
  industry_ids: [],
  images: [],
};

function signInWith(permissionCodes = ["pv.master.manage", "pv.publish"]) {
  useAuthStore.setState({
    isSuperAdmin: false,
    isProfileLoaded: true,
    isAuthenticated: true,
    permissionCodes,
  });
}

function listResources(resource: string, params: Record<string, string> = {}) {
  const rows = [WITH_IMAGE, WITHOUT_IMAGE].filter(
    (row) => !params.published || String(row.published) === params.published,
  );
  return Promise.resolve({
    data:
      resource === "product-profiles"
        ? rows
        : resource === "industries"
          ? [
              {
                id: "industry-tools",
                code: "TOOLS",
                name: "Dụng cụ",
                status: "ACTIVE",
                sort_order: 1,
                version: 1,
              },
            ]
          : [],
    // A partial page with a server total larger than its two loaded profiles.
    meta: {
      current_page: Number(params.page ?? 1),
      per_page: Number(params.per_page ?? 20),
      total: resource === "product-profiles" ? 42 : 1,
      last_page: resource === "product-profiles" ? 3 : 1,
    },
  });
}

function profileCalls() {
  return listPvAdminResourcesMock.mock.calls.filter(
    ([resource]) => resource === "product-profiles",
  );
}

function searchInput() {
  return within(screen.getByTestId("pv-catalog-search")).getByRole("textbox");
}

async function chooseFilter(testId: string, label: string) {
  fireEvent.mouseDown(within(screen.getByTestId(testId)).getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", {
    name: (name) => name === label || name.endsWith(`: ${label}`),
  }));
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="Đường dẫn hiện tại">
      {location.pathname}
      {location.search}
    </output>
  );
}

describe("MST-PV-01 · catalog interactions", () => {
  beforeEach(() => {
    window.sessionStorage.removeItem("hn-pv-catalog-overview-open");
    signInWith();
    useLanguageStore.setState({ language: "vi" });
    listPvAdminResourcesMock.mockReset().mockImplementation(listResources);
    setPvProductPublishedMock.mockReset().mockResolvedValue({
      published_to_app: false,
      pv_profile_version: 4,
    });
    getMvpSkusMock.mockReset().mockResolvedValue({ data: [], meta: {} });
  });

  afterEach(() => {
    cleanup();
    cleanupCreatedQueryClients();
  });

  it("navigates internally to the App PV preview", async () => {
    const initialPath = "/master-data/pv-products?screen=MST-PV-01";
    const documentUrl = window.location.href;
    renderWithProviders(
      <>
        <PvProductCatalogPage />
        <LocationProbe />
      </>,
      [initialPath],
    );
    await screen.findByRole("table");

    const location = screen.getByLabelText("Đường dẫn hiện tại");
    expect(
      screen.queryByRole("button", { name: "Mở cấu hình kho" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xem trước App PV" }));
    expect(location).toHaveTextContent(/^\/pv$/);
    expect(window.location.href).toBe(documentUrl);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("đóng mở tổng quan danh mục mà vẫn giữ danh sách sản phẩm", async () => {
    renderWithProviders(<PvProductCatalogPage />);
    await screen.findByRole("table");

    const list = screen.getByRole("table");
    const toggle = screen.getByRole("button", { name: "Tổng quan danh mục" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("region", { name: "Tổng quan danh mục" }),
    ).toBeNull();

    fireEvent.click(toggle);
    const overview = screen.getByRole("region", { name: "Tổng quan danh mục" });
    expect(within(overview).getByText("Tổng sản phẩm")).toBeVisible();
    expect(list).toBeVisible();
    expect(window.sessionStorage.getItem("hn-pv-catalog-overview-open")).toBe(
      "true",
    );

    cleanup();
    renderWithProviders(<PvProductCatalogPage />);
    await screen.findByRole("table");
    const rememberedToggle = screen.getByRole("button", {
      name: "Tổng quan danh mục",
    });
    expect(rememberedToggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(rememberedToggle);
    expect(rememberedToggle).toHaveAttribute("aria-expanded", "false");
    expect(window.sessionStorage.getItem("hn-pv-catalog-overview-open")).toBe(
      "false",
    );
  });

  it("keeps search visible and expands display options from the filter button", async () => {
    renderWithProviders(<PvProductCatalogPage />);
    const table = await screen.findByRole("table");

    const filters = screen.getByRole("region", { name: "Bộ lọc tìm kiếm" });
    const list = screen.getByRole("region", { name: "Danh sách sản phẩm" });
    const toggle = within(filters).getByRole("button", {
      name: "Bộ lọc",
    });
    const search = within(filters).getByTestId("pv-catalog-search");
    const viewOptions = within(filters).getByTestId("pv-catalog-view-card");

    expect(filters).not.toContainElement(list);
    expect(list).toContainElement(table);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(search).toBeVisible();
    expect(viewOptions).not.toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(viewOptions).toBeVisible();
    expect(search).toBeVisible();
    expect(table).toBeVisible();

    fireEvent.click(toggle);
    expect(search).toBeVisible();
    expect(viewOptions).not.toBeVisible();
  });

  it("applies filters immediately and returns to page 1 when filters change", async () => {
    renderWithProviders(<PvProductCatalogPage />);
    await screen.findByRole("table");

    fireEvent.change(searchInput(), { target: { value: "khoan" } });
    await waitFor(() =>
      expect(profileCalls().at(-1)?.[1]).toEqual({
        keyword: "khoan",
        page: "1",
        per_page: "20",
      }),
    );

    await chooseFilter("pv-catalog-published-filter", "Đang hiển thị");
    await waitFor(() =>
      expect(profileCalls().at(-1)?.[1]).toMatchObject({
        keyword: "khoan",
        published: "true",
        page: "1",
      }),
    );
    await chooseFilter("pv-catalog-industry-filter", "Dụng cụ");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Go to page 2" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() =>
      expect(profileCalls().at(-1)?.[1]).toMatchObject({
        keyword: "khoan",
        published: "true",
        page: "2",
      }),
    );

    fireEvent.change(searchInput(), { target: { value: "" } });
    await waitFor(() =>
      expect(profileCalls().at(-1)?.[1]).toMatchObject({
        keyword: "",
        published: "true",
        page: "1",
      }),
    );
  });

  it.each([
    { permission: "pv.master.manage", canManage: true, canPublish: false },
    { permission: "pv.publish", canManage: false, canPublish: true },
  ])(
    "keeps edit and publish permissions separate for $permission",
    async ({ permission, canManage, canPublish }) => {
      signInWith([permission]);
      renderWithProviders(<PvProductCatalogPage />);
      const edit = await screen.findAllByTestId("pv-catalog-edit");
      expect(edit[0]).toBeEnabled();
      expect(
        screen.queryByRole("button", {
          name: `Thao tác với ${WITH_IMAGE.display_name}`,
        }),
      ).not.toBeInTheDocument();

      fireEvent.click(edit[0]);
      const publish = screen.getByTestId("pv-catalog-publish-switch");
      expect(publish).toHaveProperty("disabled", !canPublish);
      expect(screen.getByTestId("pv-catalog-submit")).toHaveProperty("disabled", !canManage);
      fireEvent.click(publish);
      if (canPublish) {
        await waitFor(() =>
          expect(setPvProductPublishedMock).toHaveBeenCalledWith(
            WITH_IMAGE.sku_id,
            false,
            WITH_IMAGE.version,
          ),
        );
      } else {
        expect(setPvProductPublishedMock).not.toHaveBeenCalled();
      }
    },
  );

  it("shows a hidden product on App PV with one click", async () => {
    renderWithProviders(<PvProductCatalogPage />);
    const editButtons = await screen.findAllByTestId("pv-catalog-edit");
    fireEvent.click(editButtons[1]);
    fireEvent.click(screen.getByTestId("pv-catalog-publish-switch"));
    await waitFor(() =>
      expect(setPvProductPublishedMock).toHaveBeenCalledWith(
        WITHOUT_IMAGE.sku_id,
        true,
        WITHOUT_IMAGE.version,
      ),
    );
  });

  it.each([412, 428])(
    "refetches a stale publish (%s) without losing filters or retrying the write",
    async (status) => {
      setPvProductPublishedMock.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status, data: { message: "Hồ sơ đã thay đổi." } },
      });
      renderWithProviders(<PvProductCatalogPage />);
      await screen.findByRole("table");
      fireEvent.change(searchInput(), { target: { value: "khoan" } });
      await chooseFilter("pv-catalog-published-filter", "Đang hiển thị");
      await waitFor(() =>
        expect(profileCalls().at(-1)?.[1]).toMatchObject({
          keyword: "khoan",
          published: "true",
          page: "1",
        }),
      );
      fireEvent.click((await screen.findAllByTestId("pv-catalog-edit"))[0]);
      expect(screen.getByTestId("pv-catalog-publish-switch")).toBeEnabled();
      const callCount = profileCalls().length;

      fireEvent.click(screen.getByTestId("pv-catalog-publish-switch"));
      await waitFor(() =>
        expect(profileCalls().length).toBeGreaterThan(callCount),
      );
      expect(setPvProductPublishedMock).toHaveBeenCalledExactlyOnceWith(
        WITH_IMAGE.sku_id,
        false,
        WITH_IMAGE.version,
      );
      expect(profileCalls().at(-1)?.[1]).toEqual({
        keyword: "khoan",
        published: "true",
        page: "1",
        per_page: "20",
      });
      await waitFor(() => {
        expect(searchInput()).toHaveValue("khoan");
        expect(screen.queryByTestId("pv-catalog-publish-switch")).not.toBeInTheDocument();
      });
    },
  );

  it("changes view without changing filters and replaces failed images in both views", async () => {
    renderWithProviders(<PvProductCatalogPage />);
    fireEvent.error(await screen.findByAltText("Ảnh chính"));
    expect(
      screen.getByRole("img", { name: "Ảnh không tải được" }),
    ).toHaveAttribute("data-image-broken", "true");
    expect(screen.queryByAltText("Ảnh chính")).not.toBeInTheDocument();
    fireEvent.change(searchInput(), { target: { value: "khoan" } });
    await waitFor(() =>
      expect(profileCalls().at(-1)?.[1]).toMatchObject({ keyword: "khoan" }),
    );
    const callCount = profileCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    const tableTab = screen.getByTestId("pv-catalog-view-table");
    const cardTab = screen.getByTestId("pv-catalog-view-card");
    fireEvent.click(cardTab);
    expect(cardTab).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findAllByTestId("pv-catalog-card")).toHaveLength(2);
    fireEvent.error(screen.getByAltText("Ảnh chính"));
    expect(screen.getByText("Ảnh không tải được")).toHaveAttribute(
      "data-image-broken",
      "true",
    );
    expect(screen.queryByAltText("Ảnh chính")).not.toBeInTheDocument();

    fireEvent.click(tableTab);
    expect(tableTab).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("pv-catalog-table")).toBeInTheDocument();
    expect(searchInput()).toHaveValue("khoan");
    expect(profileCalls()).toHaveLength(callCount);
  });

  it("distinguishes the server total from visibility and image counts on the loaded page", async () => {
    renderWithProviders(<PvProductCatalogPage />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Tổng quan danh mục" }));
    const overview = screen.getByRole("region", { name: "Tổng quan danh mục" });
    const total = within(overview).getByTitle(
      /^Tổng kết quả theo từ khóa và trạng thái;.*nhóm sản phẩm lọc trong trang hiện tại/,
    );
    expect(within(total).getByText("42")).toBeInTheDocument();
    const pageStats = within(overview).getAllByTitle("Trong trang hiện tại");
    expect(pageStats).toHaveLength(3);
    for (const stat of pageStats) {
      expect(within(stat).getByText("1")).toBeInTheDocument();
    }
    const info = within(overview).getByRole("button", {
      name: "Thông tin tổng quan danh mục",
    });
    expect(
      within(overview).queryByText(/Thống kê trạng thái trong trang hiện tại/),
    ).not.toBeInTheDocument();
    fireEvent.pointerEnter(info, { pointerType: "mouse" });
    expect(
      await screen.findByText(/Thống kê trạng thái trong trang hiện tại/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/không làm thay đổi số lượng tồn kho/),
    ).toBeInTheDocument();
    fireEvent.pointerLeave(info, { pointerType: "mouse" });
    await waitFor(() =>
      expect(
        screen.queryByText(/Thống kê trạng thái trong trang hiện tại/),
      ).not.toBeInTheDocument(),
    );

    fireEvent.pointerDown(info, { pointerType: "touch" });
    fireEvent.click(info);
    expect(info).toHaveAttribute("aria-expanded", "true");
    expect(
      await screen.findByText(/không làm thay đổi số lượng tồn kho/),
    ).toBeInTheDocument();
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    await waitFor(() => expect(info).toHaveAttribute("aria-expanded", "false"));

    await chooseFilter("pv-catalog-industry-filter", "Dụng cụ");
    expect(within(total).getByText("42")).toBeInTheDocument();
    for (const { label, value } of [
      { label: "Đang hiển thị", value: "1" },
      { label: "Đang ẩn", value: "0" },
      { label: "Chưa có ảnh", value: "0" },
    ]) {
      const stat = within(overview)
        .getAllByTitle("Trong trang hiện tại")
        .find((item) => within(item).queryByText(label));
      if (!stat) throw new Error("Missing current-page statistic: " + label);
      expect(within(stat).getByText(value)).toBeInTheDocument();
    }
  });

  it("recovers from a list error using Retry and shows a distinct filtered no-match state", async () => {
    let failProfiles = true;
    listPvAdminResourcesMock.mockImplementation(
      (resource: string, params: Record<string, string> = {}) => {
        if (resource === "product-profiles" && failProfiles) {
          failProfiles = false;
          return Promise.reject(new Error("Không tải được sản phẩm."));
        }
        if (resource === "product-profiles" && params.keyword === "NO-MATCH") {
          return Promise.resolve({
            data: [],
            meta: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
          });
        }
        return listResources(resource, params);
      },
    );
    renderWithProviders(<PvProductCatalogPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Thử lại/i }));
    expect(
      await screen.findByText(WITH_IMAGE.display_name),
    ).toBeInTheDocument();

    fireEvent.change(searchInput(), { target: { value: "NO-MATCH" } });
    expect(
      await screen.findByText("Không có kết quả phù hợp."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // Only the persistent header action remains; empty search results must not
    // imply that the entire product catalog has no profiles.
    expect(
      screen.getAllByRole("button", { name: "Thêm sản phẩm" }),
    ).toHaveLength(1);
  });
});
