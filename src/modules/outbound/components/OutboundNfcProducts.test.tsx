import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { createJSONStorage } from "zustand/middleware";

const service = vi.hoisted(() => ({ fetchOutboundNfcItems: vi.fn() }));
vi.mock("@/modules/outbound/services/outboundNfcService", () => ({
  fetchOutboundNfcItems: service.fetchOutboundNfcItems,
}));
vi.mock("./OutboundNfcProductDetail", () => ({
  OutboundNfcProductDetail: ({ item }: { item: typeof assigned }) => (
    <div>
      Chi tiết NFC thử nghiệm <span>{item.nfc?.hardware_uid}</span>
    </div>
  ),
}));

import { OutboundNfcProducts } from "./OutboundNfcProducts";

const assigned = {
  document_id: "doc-1",
  document_no: "PX-0030",
  document_status: "POSTED",
  item_id: "item-1",
  item_code: "SP-0001",
  serial_number: "SN-0001",
  sku_code: "HN-PROD-001",
  sku_name: "Máy khoan",
  nfc_status: "ASSIGNED",
  nfc: {
    physical_code_id: "tag-1",
    hardware_uid: "04A1B2",
    assigned_at: "2026-10-31T10:20:00Z",
    actor_name: "Nguyễn Văn Nam",
  },
};
const unassigned = {
  ...assigned,
  item_id: "item-2",
  item_code: "SP-0002",
  serial_number: "SN-0002",
  nfc_status: "UNASSIGNED",
  nfc: null,
};

let liveClient: QueryClient;
function CaptureQueryClient() {
  const client = useQueryClient();
  useEffect(() => {
    liveClient = client;
  }, [client]);
  return null;
}

describe("OutboundNfcProducts", () => {
  beforeEach(() => {
    useLanguageStore.persist.setOptions({
      storage: createJSONStorage(() => ({
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      })),
    });
    service.fetchOutboundNfcItems.mockReset().mockResolvedValue({
      data: [assigned, unassigned],
      meta: {
        current_page: 1,
        per_page: 10,
        total: 2,
        tab_totals: { ALL: 2, ASSIGNED: 1, UNASSIGNED: 1 },
      },
    });
  });
  afterEach(() => {
    cleanup();
    cleanupTestState();
    useLanguageStore.setState({ language: "vi" });
  });

  it("numbers rows and keeps UID in detail rather than the product list", async () => {
    renderWithProviders(<OutboundNfcProducts />);

    expect(await screen.findByText("SP-0001")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sản phẩm đã xuất & NFC" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Làm mới" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "STT" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "UID chip" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("04A1B2")).not.toBeInTheDocument();
    expect(
      within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0],
    ).toHaveTextContent("1");
    expect(screen.getByText("SP-0002")).toBeInTheDocument();
    expect(screen.getAllByText("Chưa gắn NFC").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Gán chip" })).toBeNull();
    expect(service.fetchOutboundNfcItems).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: undefined }),
      expect.anything(),
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Xem chi tiết" })[0]);
    expect(await screen.findByText("04A1B2")).toBeInTheDocument();
  });

  it("updates a selected read-only NFC detail when its list row changes", async () => {
    renderWithProviders(
      <>
        <CaptureQueryClient />
        <OutboundNfcProducts />
      </>,
    );
    await screen.findByText("SP-0001");
    fireEvent.click(screen.getAllByRole("button", { name: "Xem chi tiết" })[0]);
    await screen.findByText("04A1B2");
    await act(async () => {
      liveClient.setQueriesData(
        { queryKey: ["outbound-nfc"] },
        {
          data: [
            {
              ...assigned,
              nfc: { ...assigned.nfc, hardware_uid: "UPDATED-UID" },
            },
            unassigned,
          ],
          meta: { total: 2 },
        },
      );
    });
    expect(await screen.findByText("UPDATED-UID")).toBeInTheDocument();
    expect(screen.queryByText("04A1B2")).not.toBeInTheDocument();
    await act(async () => {
      liveClient.setQueriesData(
        { queryKey: ["outbound-nfc"] },
        { data: [], meta: { total: 0 } },
      );
    });
    await waitFor(() =>
      expect(screen.queryByText("UPDATED-UID")).not.toBeInTheDocument(),
    );
    await act(async () => {
      liveClient.setQueriesData(
        { queryKey: ["outbound-nfc"] },
        { data: [assigned], meta: { total: 1 } },
      );
    });
    expect(screen.queryByText("04A1B2")).not.toBeInTheDocument();
  });

  it("continues row numbering across pages and preserves the full product-name tooltip", async () => {
    const name =
      "Máy khoan/vặn vít dùng pin không chổi than – DCJZ23-10 (EK/Z) với tên sản phẩm dài";
    service.fetchOutboundNfcItems.mockResolvedValue({
      data: [{ ...assigned, sku_name: name }],
      meta: { total: 23 },
    });
    renderWithProviders(<OutboundNfcProducts />);
    expect(await screen.findByText(name)).toHaveAttribute("title", name);
    fireEvent.click(screen.getByRole("button", { name: /Go to page 2/ }));
    await waitFor(() =>
      expect(service.fetchOutboundNfcItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(
        within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0],
      ).toHaveTextContent(/^11$/),
    );
  });

  it("filters on the server for the chosen document and NFC status", async () => {
    renderWithProviders(<OutboundNfcProducts documentId="doc-1" />);
    await screen.findByText("SP-0001");

    expect(
      screen.queryByRole("group", { name: "Trạng thái chip" }),
    ).not.toBeInTheDocument();
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "Trạng thái chip" }),
    );
    fireEvent.click(screen.getByRole("option", { name: /Đã gắn NFC.*1/ }));
    await waitFor(() =>
      expect(service.fetchOutboundNfcItems).toHaveBeenLastCalledWith(
        expect.objectContaining({
          documentId: "doc-1",
          nfcStatus: "ASSIGNED",
        }),
        expect.anything(),
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Xóa lọc" }),
    ).not.toBeInTheDocument();
  });

  it("filters NFC products as the search text changes without submitting", async () => {
    renderWithProviders(<OutboundNfcProducts />);
    await screen.findByText("SP-0001");

    fireEvent.change(screen.getByRole("textbox", { name: "Tìm sản phẩm" }), {
      target: { value: "HN-PROD-001" },
    });

    await waitFor(() =>
      expect(service.fetchOutboundNfcItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: "HN-PROD-001" }),
        expect.anything(),
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Áp dụng" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Xóa lọc" }),
    ).not.toBeInTheDocument();
  });

  it("shows the product range and changes the server page size", async () => {
    service.fetchOutboundNfcItems.mockResolvedValue({
      data: [assigned, unassigned],
      meta: {
        current_page: 1,
        per_page: 10,
        total: 23,
        tab_totals: { ALL: 23, ASSIGNED: 12, UNASSIGNED: 11 },
      },
    });
    renderWithProviders(<OutboundNfcProducts />);

    expect(
      await screen.findByText("Hiển thị 1–2 / 23 sản phẩm"),
    ).toBeInTheDocument();
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "20 / trang" }));

    await waitFor(() =>
      expect(service.fetchOutboundNfcItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ perPage: 20, page: 1 }),
        expect.anything(),
      ),
    );
  });

  it("localizes the page-size choices in English", async () => {
    useLanguageStore.setState({ language: "en" });
    await ensureEnglishMessages();
    renderWithProviders(<OutboundNfcProducts />);
    await screen.findByText("SP-0001");

    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "Rows per page" }),
    );
    expect(
      screen.getByRole("option", { name: "20 / page" }),
    ).toBeInTheDocument();
  });
});
