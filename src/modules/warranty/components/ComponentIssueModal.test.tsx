import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { SEMANTIC_LIGHT } from "@/shared/ui/tokens";

vi.mock("@/modules/warranty/services/componentIssueService", () => ({
  fetchComponentIssueDocuments: vi.fn(),
  fetchComponentIssueDocument: vi.fn(),
  createComponentIssue: vi.fn(),
  scanComponentIssue: vi.fn(),
  cancelComponentIssue: vi.fn(),
  postComponentIssue: vi.fn(),
}));
vi.mock("@/modules/master-data/services/warehouse.service", () => ({
  fetchWarehouses: vi.fn(() =>
    Promise.resolve([{ id: "wh-1", code: "KHO-T", name: "Kho tổng" }]),
  ),
}));
vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpSkus: vi.fn(() => ({
    data: {
      data: [{ sku_id: "sku-1", sku_code: "LK-PIN-20V", sku_name: "Pin 20V" }],
    },
    isLoading: false,
  })),
  useMvpDefects: vi.fn(() => ({ data: { data: [] }, isLoading: false })),
}));
vi.mock("@/shared/components/forms/CameraScanModal", () => ({
  CameraScanModal: () => null,
}));
vi.mock("@/modules/outbound/services/alignedOutboundService", () => ({
  fetchAvailableQtyBySku: vi.fn(),
}));

import {
  cancelComponentIssue,
  createComponentIssue,
  fetchComponentIssueDocument,
  postComponentIssue,
  scanComponentIssue,
} from "@/modules/warranty/services/componentIssueService";
import { fetchAvailableQtyBySku } from "@/modules/outbound/services/alignedOutboundService";
import { useAuthStore } from "@/shared/store/auth.store";
import { formatDateTime } from "@/shared/utils/format-date";
import { ComponentIssueModal } from "./ComponentIssueModal";

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "ci-1",
    component_issue_no: "CI-0001",
    warehouse_id: "wh-1",
    warranty_case_id: "wc-1",
    document_date: "2026-08-13",
    created_at: "2026-08-13T01:30:00Z",
    posted_at: null,
    purpose: "WARRANTY" as const,
    status: "SCANNING" as const,
    version: 2,
    lines: [
      {
        id: "line-1",
        sku_id: "sku-1",
        sku_code: "LK-PIN-20V",
        sku_name: "Pin 20V",
        required_qty: 2,
        scanned_qty: 1,
        items: [
          {
            id: "item-1",
            item_id: "it-1",
            quantity: 1,
            status: "ACTIVE",
            created_at: "2026-08-13T02:00:00Z",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("ComponentIssueModal (COMP-01)", () => {
  beforeEach(() => {
    vi.mocked(fetchComponentIssueDocument).mockReset();
    vi.mocked(scanComponentIssue).mockReset();
    vi.mocked(cancelComponentIssue).mockReset();
    vi.mocked(postComponentIssue).mockReset();
    vi.mocked(createComponentIssue).mockReset();
    vi.mocked(fetchAvailableQtyBySku).mockReset();
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["warranty.component_issue"],
    });
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("case không còn active: cảnh báo và không cho tạo phiếu", async () => {
    renderWithProviders(
      <ComponentIssueModal
        caseId="wc-1"
        caseCode="BH-0001"
        caseActive={false}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText(/không còn hiệu lực/)).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Tạo phiếu/ }),
    ).toBeDisabled();
  });

  it("hiển thị tên kho thay vì UUID khi mở phiếu đã tạo", async () => {
    const onViewCase = vi.fn();
    vi.mocked(fetchComponentIssueDocument).mockResolvedValue(
      makeDetail() as never,
    );

    renderWithProviders(
      <ComponentIssueModal
        caseId="wc-1"
        caseActive
        documentId="ci-1"
        onViewCase={onViewCase}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText("Kho tổng")).toBeInTheDocument();
    expect(screen.queryByText("wh-1")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("columnheader", { name: "#" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem hồ sơ bảo hành" }));
    expect(onViewCase).toHaveBeenCalledOnce();
  });

  it("hiển thị mốc tạo phiếu, ghi nhận và quét gần nhất", async () => {
    vi.mocked(fetchComponentIssueDocument).mockResolvedValue(
      makeDetail({
        status: "POSTED",
        created_at: "2026-08-13T01:30:00Z",
        posted_at: "2026-08-13T03:45:00Z",
        lines: [
          {
            id: "line-1",
            sku_id: "sku-1",
            sku_code: "LK-PIN-20V",
            sku_name: "Pin 20V",
            required_qty: 1,
            scanned_qty: 1,
            items: [
              {
                id: "item-1",
                item_id: "it-1",
                quantity: 1,
                status: "ACTIVE",
                created_at: "2026-08-13T02:00:00Z",
              },
            ],
          },
        ],
      }) as never,
    );

    renderWithProviders(
      <ComponentIssueModal
        caseId="wc-1"
        caseActive
        documentId="ci-1"
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText("Ngày tạo phiếu")).toBeInTheDocument();
    expect(screen.getByText("Thời gian ghi nhận")).toBeInTheDocument();
    expect(screen.getByText("Thời gian quét")).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime("2026-08-13T01:30:00Z")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime("2026-08-13T03:45:00Z")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime("2026-08-13T02:00:00Z")),
    ).toBeInTheDocument();
  });

  it("SCANNING: quét serial gửi đúng line đang thiếu + If-Match version", async () => {
    vi.mocked(fetchComponentIssueDocument).mockResolvedValue(
      makeDetail() as never,
    );
    vi.mocked(scanComponentIssue).mockResolvedValue({
      version: 3,
      scanned_qty: 2,
      status: "SCANNING",
    });

    renderWithProviders(
      <ComponentIssueModal
        caseId="wc-1"
        caseActive
        documentId="ci-1"
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText("LK-PIN-20V")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    const scanInput = screen.getByLabelText("Quét mã");
    fireEvent.change(scanInput, { target: { value: "ser-lk-99" } });
    fireEvent.keyDown(scanInput, { key: "Enter" });

    await waitFor(() => {
      expect(scanComponentIssue).toHaveBeenCalledWith({
        documentId: "ci-1",
        lineId: "line-1",
        codeValue: "SER-LK-99",
        quantity: 1,
        ifMatch: 2,
      });
    });
  });

  it("Full Post chỉ bật khi mọi line quét đủ; Post gửi Idempotency-Key", async () => {
    vi.mocked(fetchComponentIssueDocument).mockResolvedValue(
      makeDetail({
        lines: [
          {
            id: "line-1",
            sku_id: "sku-1",
            sku_code: "LK-PIN-20V",
            sku_name: "Pin 20V",
            required_qty: 2,
            scanned_qty: 2,
            items: [],
          },
        ],
      }) as never,
    );
    vi.mocked(postComponentIssue).mockResolvedValue({
      version: 3,
      status: "POSTED",
      movement_ids: ["mv-1"],
    });

    renderWithProviders(
      <ComponentIssueModal
        caseId="wc-1"
        caseActive
        documentId="ci-1"
        onClose={() => {}}
      />,
    );

    const postButton = await screen.findByRole("button", {
      name: "Xuất linh kiện",
    });
    await waitFor(() => expect(postButton).toBeEnabled());
    fireEvent.click(postButton);

    // Modal.confirm (stub) hiện nút "Xác nhận" — xác nhận trước khi trừ tồn.
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận" }));

    await waitFor(() => {
      expect(postComponentIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: "ci-1",
          ifMatch: 2,
          idempotencyKey: expect.stringMatching(/^fe:component-post-ci-1:/),
        }),
      );
    });
  });

  it("Full Post bị disable khi còn line chưa quét đủ", async () => {
    vi.mocked(fetchComponentIssueDocument).mockResolvedValue(
      makeDetail() as never,
    );

    renderWithProviders(
      <ComponentIssueModal
        caseId="wc-1"
        caseActive
        documentId="ci-1"
        onClose={() => {}}
      />,
    );

    const postButton = await screen.findByRole("button", {
      name: "Xuất linh kiện",
    });
    expect(postButton).toBeDisabled();
    expect(postComponentIssue).not.toHaveBeenCalled();
  });

  it("hủy phiếu bắt buộc lý do ≥ 5 ký tự (không tính khoảng trắng) và gửi If-Match", async () => {
    vi.mocked(fetchComponentIssueDocument).mockResolvedValue(
      makeDetail() as never,
    );
    vi.mocked(cancelComponentIssue).mockResolvedValue({
      version: 3,
      status: "CANCELLED",
    });

    renderWithProviders(
      <ComponentIssueModal
        caseId="wc-1"
        caseActive
        documentId="ci-1"
        onClose={() => {}}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Hủy phiếu/ }));
    const reasonInput = await screen.findByLabelText(
      "Lý do hủy (tối thiểu 5 ký tự)",
    );

    // Chưa nhập lý do → không gọi API.
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    expect(cancelComponentIssue).not.toHaveBeenCalled();

    // Chỉ toàn khoảng trắng cũng là RỖNG — trước 06/09/2026 ô này chỉ kiểm
    // `trim()` khác rỗng nên "x" một ký tự là hủy được hồ sơ.
    fireEvent.change(reasonInput, { target: { value: "        " } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    expect(cancelComponentIssue).not.toHaveBeenCalled();

    // Dưới sàn 5 ký tự → vẫn chặn.
    fireEvent.change(reasonInput, { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    expect(cancelComponentIssue).not.toHaveBeenCalled();
    expect(await screen.findByText(/ít nhất 5 ký tự/i)).toBeInTheDocument();

    // Có khoảng trắng thừa hai đầu: gửi lên BE phải là chuỗi đã cắt.
    fireEvent.change(reasonInput, { target: { value: "  Nhập nhầm kho  " } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));

    await waitFor(() => {
      expect(cancelComponentIssue).toHaveBeenCalledWith({
        documentId: "ci-1",
        reason: "Nhập nhầm kho",
        ifMatch: 2,
      });
    });
  });

  it("chặn tạo phiếu khi SL cần vượt tồn khả dụng của SKU", async () => {
    vi.mocked(fetchAvailableQtyBySku).mockResolvedValue({ "sku-1": 1 });
    const user = userEvent.setup();

    renderWithProviders(
      <ComponentIssueModal caseId="wc-1" caseActive onClose={() => {}} />,
    );

    await user.click(await screen.findByRole("combobox"));
    await user.click(
      await screen.findByRole("option", { name: "LK-PIN-20V · Pin 20V" }),
    );

    const qtyInput = await screen.findByLabelText(/^SL cần/);
    fireEvent.change(qtyInput, { target: { value: "9" } });

    // Badge "Khả dụng" tô đỏ (tone error) ngay lúc gõ, không cần đợi bấm
    // "Tạo phiếu".
    const availabilityBadge = (await screen.findByText("Khả dụng: 1")).closest(
      ".MuiChip-root",
    );
    expect(availabilityBadge).toHaveStyle({
      backgroundColor: SEMANTIC_LIGHT.errorSoft,
      color: SEMANTIC_LIGHT.errorText,
    });

    fireEvent.click(screen.getByRole("button", { name: /Tạo phiếu/ }));

    expect(
      await screen.findByText("Vượt tồn khả dụng (còn 1)."),
    ).toBeInTheDocument();
    expect(createComponentIssue).not.toHaveBeenCalled();
  });

  it("cho tạo phiếu khi SL cần không vượt tồn khả dụng của SKU", async () => {
    vi.mocked(fetchAvailableQtyBySku).mockResolvedValue({ "sku-1": 5 });
    vi.mocked(createComponentIssue).mockResolvedValue({
      id: "ci-2",
      component_issue_no: "CI-0002",
      version: 1,
    } as never);
    vi.mocked(fetchComponentIssueDocument).mockResolvedValue(
      makeDetail({ id: "ci-2" }) as never,
    );
    const user = userEvent.setup();

    renderWithProviders(
      <ComponentIssueModal caseId="wc-1" caseActive onClose={() => {}} />,
    );

    await user.click(await screen.findByRole("combobox"));
    await user.click(
      await screen.findByRole("option", { name: "LK-PIN-20V · Pin 20V" }),
    );

    const qtyInput = await screen.findByLabelText(/^SL cần/);
    fireEvent.change(qtyInput, { target: { value: "2" } });

    const availabilityBadge = (await screen.findByText("Khả dụng: 5")).closest(
      ".MuiChip-root",
    );
    expect(availabilityBadge).toHaveStyle({
      backgroundColor: SEMANTIC_LIGHT.secondarySoft,
      color: SEMANTIC_LIGHT.secondaryDark,
    });

    fireEvent.click(screen.getByRole("button", { name: /Tạo phiếu/ }));

    await waitFor(() => {
      expect(createComponentIssue).toHaveBeenCalled();
    });
  });

  it("nút Xóa hoạt động: giảm về một dòng rồi bị vô hiệu hóa; thêm dòng thì bật lại", async () => {
    vi.mocked(fetchAvailableQtyBySku).mockResolvedValue({ "sku-1": 1 });
    const user = userEvent.setup();

    renderWithProviders(
      <ComponentIssueModal caseId="wc-1" caseActive onClose={() => {}} />,
    );

    // Ban đầu chỉ có 1 dòng → nút Xóa bị khóa để luôn giữ tối thiểu một dòng.
    expect(await screen.findByRole("button", { name: "Xóa" })).toBeDisabled();

    // Thêm dòng thứ hai → cả hai dòng đều có nút Xóa, cả hai đều bật.
    await user.click(
      screen.getByRole("button", { name: /Thêm dòng linh kiện/ }),
    );
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Xóa" })).toHaveLength(2);
    for (const button of screen.getAllByRole("button", { name: "Xóa" }))
      expect(button).toBeEnabled();

    // Xóa dòng thứ hai → còn một dòng → nút Xóa khóa lại.
    await user.click(screen.getAllByRole("button", { name: "Xóa" })[1]);
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Xóa" })).toBeDisabled();
  });
});
