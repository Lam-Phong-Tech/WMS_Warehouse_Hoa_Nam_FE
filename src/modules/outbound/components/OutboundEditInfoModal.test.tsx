import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { translate } from "@/shared/i18n/useT";

const services = vi.hoisted(() => ({
  fetchOutboundDetail: vi.fn(),
  updateOutboundDocument: vi.fn(),
}));

vi.mock("@/modules/outbound/services/alignedOutboundService", () => services);
vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpAgencies: () => ({
    data: { data: [] },
    isFetching: false,
  }),
}));
vi.mock("@/shared/components/DocumentAttachmentsPanel", () => ({
  DocumentAttachmentsPanel: () => <div data-testid="attachments-panel" />,
}));

import { OutboundEditInfoModal } from "./OutboundEditInfoModal";

const saveLabel = translate("vi", "outbound.edit.save");

function detail(overrides: Record<string, unknown> = {}) {
  return {
    document: {
      id: "OUT-1",
      code: "PX-001",
      date: "2026-11-03",
      warehouseId: "WH-1",
      outboundRequestId: "REQ-1",
      requestNo: "TOA-001",
      requestDate: "2026-11-01",
      agencyId: null,
      agencyCode: null,
      agencyName: null,
      recipientName: "Đại lý A",
      recipientAddress: "So 1",
      recipientPhone: "0901234567",
      note: "Ghi chú cũ",
      expected: 2,
      scanned: 0,
      status: "DRAFT",
      version: 3,
      createdBy: "USER-1",
      ...overrides,
    },
    lines: [
      {
        id: "LINE-1",
        documentId: "OUT-1",
        productId: "SKU-1",
        skuCode: "SKU-001",
        skuName: "Sản phẩm A",
        expected: 2,
        scanned: 0,
        remaining: 2,
      },
    ],
    itemMatches: [],
    movements: [],
    statusHistory: [],
  };
}

function renderEdit(onSaved = vi.fn()) {
  return renderWithProviders(
    <OutboundEditInfoModal
      documentId="OUT-1"
      canAttach
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );
}

function RefetchHarness({ onSaved }: { onSaved: () => void }) {
  const queryClient = useQueryClient();
  return (
    <>
      <button
        type="button"
        data-testid="refetch-detail"
        onClick={() =>
          void queryClient.invalidateQueries({
            queryKey: ["mvp-outbound", "detail", "OUT-1"],
          })
        }
      >
        refetch-detail
      </button>
      <OutboundEditInfoModal
        documentId="OUT-1"
        canAttach
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    </>
  );
}

beforeEach(() => {
  services.fetchOutboundDetail.mockReset();
  services.updateOutboundDocument.mockReset();
  services.fetchOutboundDetail.mockResolvedValue(detail() as never);
  services.updateOutboundDocument.mockResolvedValue(detail() as never);
});

afterEach(() => {
  cleanupTestState();
  vi.clearAllMocks();
});

describe("outbound draft edit form", () => {
  it("prefills the draft header and read-only lines", async () => {
    renderEdit();

    expect(await screen.findByDisplayValue("Đại lý A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0901234567")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ghi chú cũ")).toBeInTheDocument();
    expect(screen.getByText("SKU-001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xóa dòng/ })).toBeNull();
    expect(screen.getByTestId("attachments-panel")).toBeInTheDocument();
  });

  it("saves the edited header with the current version", async () => {
    const onSaved = vi.fn();
    renderEdit(onSaved);
    await screen.findByDisplayValue("Đại lý A");

    fireEvent.change(screen.getByDisplayValue("Đại lý A"), {
      target: { value: "Đại lý B" },
    });
    fireEvent.change(screen.getByDisplayValue("0901234567"), {
      target: { value: "0912345678" },
    });
    fireEvent.change(screen.getByDisplayValue("Ghi chú cũ"), {
      target: { value: "Ghi chú mới" },
    });
    fireEvent.click(screen.getByRole("button", { name: saveLabel }));

    await waitFor(() =>
      expect(services.updateOutboundDocument).toHaveBeenCalledWith(
        "OUT-1",
        expect.objectContaining({
          recipient_name: "Đại lý B",
          recipient_contact_phone: "0912345678",
          note: "Ghi chú mới",
          request_date: "2026-11-01",
        }),
        3,
      ),
    );
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("blocks an invalid phone before calling the API", async () => {
    renderEdit();
    await screen.findByDisplayValue("0901234567");

    fireEvent.change(screen.getByDisplayValue("0901234567"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: saveLabel }));

    expect(
      await screen.findByText(
        translate("vi", "shared.validation.phoneInvalid"),
      ),
    ).toBeInTheDocument();
    expect(services.updateOutboundDocument).not.toHaveBeenCalled();
  });

  it("keeps the form open and shows the API error on failure", async () => {
    services.updateOutboundDocument.mockRejectedValueOnce(
      new Error("Phiếu đã được người khác cập nhật."),
    );
    const onSaved = vi.fn();
    renderEdit(onSaved);
    await screen.findByDisplayValue("Đại lý A");

    fireEvent.click(screen.getByRole("button", { name: saveLabel }));

    expect(
      await screen.findByText("Phiếu đã được người khác cập nhật."),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows the DRAFT-only notice and hides save for other statuses", async () => {
    services.fetchOutboundDetail.mockResolvedValue(
      detail({ status: "SCANNING" }) as never,
    );
    renderEdit();

    expect(
      await screen.findByText(translate("vi", "outbound.edit.onlyDraft")),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: saveLabel })).toBeNull();
  });

  it("keeps the prefilled version for If-Match after a background refetch", async () => {
    services.fetchOutboundDetail
      .mockResolvedValueOnce(detail() as never)
      .mockResolvedValueOnce(
        detail({ version: 4, recipientName: "Đại lý mới" }) as never,
      );
    renderWithProviders(<RefetchHarness onSaved={vi.fn()} />);
    await screen.findByDisplayValue("Đại lý A");

    fireEvent.click(screen.getByTestId("refetch-detail"));
    await waitFor(() =>
      expect(services.fetchOutboundDetail).toHaveBeenCalledTimes(2),
    );
    // Refetch nền không được thay giá trị đang sửa.
    expect(screen.getByDisplayValue("Đại lý A")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: saveLabel }));
    await waitFor(() =>
      expect(services.updateOutboundDocument).toHaveBeenCalledWith(
        "OUT-1",
        expect.objectContaining({ recipient_name: "Đại lý A" }),
        3,
      ),
    );
  });

  it("offers a reload action when another user changed the draft", async () => {
    const stale = Object.assign(
      new Error("Phiếu đã được người khác cập nhật."),
      {
        isAxiosError: true,
        response: {
          status: 412,
          data: {
            success: false,
            message: "Phiếu đã được người khác cập nhật.",
          },
        },
      },
    );
    services.updateOutboundDocument.mockRejectedValueOnce(stale);
    services.fetchOutboundDetail
      .mockResolvedValueOnce(detail() as never)
      .mockResolvedValueOnce(
        detail({ version: 4, recipientName: "Đại lý mới" }) as never,
      );
    renderEdit();
    await screen.findByDisplayValue("Đại lý A");

    fireEvent.click(screen.getByRole("button", { name: saveLabel }));
    expect(
      await screen.findByText(translate("vi", "outbound.edit.staleNotice")),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: translate("vi", "outbound.edit.reload"),
      }),
    );
    expect(await screen.findByDisplayValue("Đại lý mới")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: saveLabel }));
    await waitFor(() =>
      expect(services.updateOutboundDocument).toHaveBeenLastCalledWith(
        "OUT-1",
        expect.objectContaining({ recipient_name: "Đại lý mới" }),
        4,
      ),
    );
  });
});
