import { useAuthStore } from "@/shared/store/auth.store";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { ReportExportAction } from "./ReportExportAction";

afterEach(cleanupTestState);
beforeEach(() => useAuthStore.setState({ isSuperAdmin: true }));
const props = {
  title: "Xuất báo cáo xuất kho",
  fileStem: "BaoCaoXuatKho",
  total: 12,
  currentCount: 3,
  sections: [
    {
      id: "summary",
      label: "Tổng quan",
      description: "Số liệu tổng hợp",
      selected: true,
    },
    {
      id: "detail",
      label: "Danh sách phiếu xuất",
      description: "Chi tiết từng phiếu",
      selected: true,
    },
  ],
};
describe("report export drawer", () => {
  it("opens options without exporting, then submits actual choices", async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<ReportExportAction {...props} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
    expect(onExport).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("dialog", { name: /Xuất báo cáo xuất kho/ }),
    ).toBeVisible();
    fireEvent.click(
      await screen.findByRole("radio", { name: /Trang hiện tại/ }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Tổng quan/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tên tệp xuất" }), {
      target: { value: "XuatKho.xlsx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
    await waitFor(() =>
      expect(onExport).toHaveBeenCalledWith({
        scope: "page",
        sectionIds: ["detail"],
        filename: "XuatKho.xlsx",
        format: "xlsx",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
  it("blocks empty content and filename; retains an error for retry", async () => {
    const onExport = vi
      .fn()
      .mockRejectedValueOnce(new Error("Mất kết nối"))
      .mockResolvedValue(undefined);
    renderWithProviders(<ReportExportAction {...props} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
    const input = await screen.findByRole("textbox", { name: "Tên tệp xuất" });
    fireEvent.change(input, { target: { value: " " } });
    expect(screen.getByRole("button", { name: "Xuất Excel" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "result" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Tổng quan/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Danh sách phiếu xuất/ }),
    );
    expect(screen.getByRole("button", { name: "Xuất Excel" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Danh sách phiếu xuất/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mất kết nối");
    fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
    await waitFor(() => expect(onExport).toHaveBeenCalledTimes(2));
  });
});

it("disables an open drawer when the export status becomes unavailable", async () => {
  const onExport = vi.fn();
  const view = renderWithProviders(
    <ReportExportAction {...props} disabled={false} onExport={onExport} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  await screen.findByRole("radio", { name: /Trang hiện tại/ });
  view.rerender(
    <ReportExportAction {...props} disabled={true} onExport={onExport} />,
  );
  expect(screen.getByRole("button", { name: "Xuất Excel" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
  expect(onExport).not.toHaveBeenCalled();
});
