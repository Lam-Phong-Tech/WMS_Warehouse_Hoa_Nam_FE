import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

const service = vi.hoisted(() => ({
  fetchPhysicalCodes: vi.fn(),
  fetchScanBatchesPage: vi.fn(),
  fetchScanEventsPage: vi.fn(),
  classifyScanCodes: vi.fn(),
  warehouses: [{ id: "warehouse-1", name: "Kho chính" }],
}));
vi.mock("../services/scanService", () => service);
vi.mock("@/shared/data/reference-queries", () => ({
  useActiveWarehouses: () => ({ data: service.warehouses }),
}));
vi.mock("@/shared/components/permission", () => ({ useCan: () => true }));
vi.mock("../components/IssuePhysicalCodeModal", () => ({
  IssuePhysicalCodeModal: () => null,
}));

import PhysicalCodesPage from "./PhysicalCodesPage";

let queryClient: QueryClient;
function QueryCapture() {
  const client = useQueryClient();
  useEffect(() => {
    queryClient = client;
  }, [client]);
  return null;
}
function showPage() {
  return renderWithProviders(
    <>
      <QueryCapture />
      <PhysicalCodesPage />
    </>,
  );
}
const code = {
  id: "code-1",
  code_value: "ITEM-001",
  code_type: "QR",
  carrier_type: "QR",
  target_type: "ITEM",
  sku_code: "SKU-1",
  status: "ACTIVE",
  created_at: "2026-11-06",
  updated_at: "2026-11-06",
};
const batch = {
  id: "batch-1",
  batch_no: "BATCH-001",
  source_type: "INBOUND",
  status: "OPEN",
  total_codes: 1,
  valid_count: 1,
  duplicate_count: 0,
  unknown_count: 0,
  invalid_count: 0,
  created_at: "2026-11-06",
  created_by: "operator",
};
const event = {
  id: "event-1",
  batch_id: "batch-1",
  code_value: "ITEM-001",
  code_type: "QR",
  status: "VALID",
  message: "Initial result",
  scanned_at: "2026-11-06",
  scanned_by: "operator",
};

describe("physical code reads during background refresh", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    service.fetchPhysicalCodes.mockResolvedValue([code]);
    service.fetchScanBatchesPage.mockResolvedValue({
      data: [batch],
      meta: { total: 1 },
    });
    service.fetchScanEventsPage.mockResolvedValue({
      data: [event],
      meta: { total: 1 },
    });
  });
  afterEach(cleanupTestState);

  it("disables code search while the list contract cannot load", async () => {
    service.fetchPhysicalCodes.mockRejectedValue(
      new Error("Physical code list endpoint is not approved"),
    );
    showPage();
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Giá trị mã" }),
      ).toBeDisabled(),
    );
  });

  it("sends history searches to the server instead of filtering a fetched page", async () => {
    showPage();
    fireEvent.click(screen.getByRole("tab", { name: "Lịch sử quét" }));
    await screen.findByText("Initial result");
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm theo số lô" }), {
      target: { value: " remote-batch " },
    });
    await waitFor(() =>
      expect(service.fetchScanBatchesPage).toHaveBeenLastCalledWith({
        page: 1,
        per_page: 10,
        keyword: "remote-batch",
      }),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Tìm theo mã sự kiện quét" }),
      {
        target: { value: " REMOTE-CODE " },
      },
    );
    await waitFor(() =>
      expect(service.fetchScanEventsPage).toHaveBeenLastCalledWith({
        page: 1,
        per_page: 10,
        keyword: "REMOTE-CODE",
        scan_batch_id: undefined,
      }),
    );
  });

  it("updates the visible filtered code list from the query cache without clearing search", async () => {
    showPage();
    await screen.findByText("ITEM-001");
    const search = screen.getByRole("textbox", { name: "Giá trị mã" });
    fireEvent.change(search, { target: { value: "ITEM" } });
    await act(async () => {
      queryClient.setQueryData(
        ["scan", "physical-codes", { page: 1, per_page: 10 }],
        [{ ...code, code_value: "ITEM-002" }],
      );
    });
    expect(await screen.findByText("ITEM-002")).toBeInTheDocument();
    expect(screen.queryByText("ITEM-001")).not.toBeInTheDocument();
    expect(search).toHaveValue("ITEM");
  });

  it("refreshes the active history pages and retains its server event filter", async () => {
    showPage();
    await screen.findByText("ITEM-001");
    fireEvent.click(screen.getByRole("tab", { name: "Lịch sử quét" }));
    await screen.findByText("Initial result");
    const search = screen.getByRole("textbox", {
      name: "Tìm theo mã sự kiện quét",
    });
    fireEvent.change(search, { target: { value: "ITEM-001" } });
    await waitFor(() =>
      expect(service.fetchScanEventsPage).toHaveBeenLastCalledWith({
        page: 1,
        per_page: 10,
        keyword: "ITEM-001",
        scan_batch_id: undefined,
      }),
    );
    await waitFor(() =>
      expect(queryClient.isFetching({ queryKey: ["scan", "events"] })).toBe(0),
    );
    service.fetchScanEventsPage.mockResolvedValue({
      data: [{ ...event, message: "Updated result" }],
      meta: { total: 1 },
    });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["scan"] });
    });
    expect(await screen.findByText("Updated result")).toBeInTheDocument();
    expect(search).toHaveValue("ITEM-001");
    expect(
      queryClient.getQueryData(["scan", "batches", { page: 1, per_page: 10 }]),
    ).toMatchObject({ data: [batch] });
  });

  it("leaves an unsubmitted classify code and chosen context alone while list reads are disabled", async () => {
    showPage();
    await screen.findByText("ITEM-001");
    fireEvent.click(screen.getByRole("tab", { name: "Nhận diện mã quét" }));
    const draft = screen.getByRole("textbox", { name: "Quét hoặc nhập mã" });
    fireEvent.change(draft, { target: { value: "UNSUBMITTED-CODE" } });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["scan"] });
    });
    expect(draft).toHaveValue("UNSUBMITTED-CODE");
    expect(
      screen.getByRole("combobox", { name: "Ngữ cảnh quét" }),
    ).toHaveTextContent("Truy vết");
    expect(service.classifyScanCodes).not.toHaveBeenCalled();
    expect(service.fetchPhysicalCodes).toHaveBeenCalledTimes(1);
  });

  it("keeps retry working after a failed read", async () => {
    service.fetchPhysicalCodes.mockRejectedValueOnce(
      new Error("Read unavailable"),
    );
    showPage();
    await screen.findByText("Read unavailable");
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(await screen.findByText("ITEM-001")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Read unavailable")).not.toBeInTheDocument(),
    );
  });
});
