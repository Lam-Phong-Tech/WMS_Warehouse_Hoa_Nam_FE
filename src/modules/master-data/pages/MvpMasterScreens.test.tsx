import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AgencyMasterScreen,
  DefectMasterScreen,
  SkuMasterScreen,
} from "@/modules/master-data/pages/MvpMasterScreens";

describe("MVP master screens", () => {
  it("opens create SKU in a modal and edits an existing SKU without leaving the list", () => {
    render(<SkuMasterScreen />);

    expect(screen.getByText("DCH-DRILL-DJZ10A-220V-V1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Tạo SKU" }));

    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Tạo SKU")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));

    const row = screen.getByText("DCH-DRILL-DJZ10A-220V-V1").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(
      within(row as HTMLTableRowElement).getByRole("button", { name: "Sửa" }),
    );

    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("SKU code *")).toBeDisabled();
    const nameInput = within(dialog).getByLabelText("Tên SKU *");
    expect(nameInput).toHaveValue("Máy khoan Dongcheng DJZ10A 220V");
    fireEvent.change(nameInput, {
      target: { value: "Máy khoan Dongcheng DJZ10A bản mới" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu SKU" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByText("Máy khoan Dongcheng DJZ10A bản mới"),
    ).toBeInTheDocument();
  });

  it("opens add and edit agency as a modal on the agency list", () => {
    render(<AgencyMasterScreen />);

    expect(screen.getByText("Đại lý Minh Anh")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm đại lý" }));

    let dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Thêm đại lý / nơi nhận"),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));

    const row = screen.getByText("Đại lý Minh Anh").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(
      within(row as HTMLTableRowElement).getByRole("button", { name: "Sửa" }),
    );

    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Mã đại lý *")).toHaveValue("AG-HN-001");
    expect(within(dialog).getByLabelText("Tên đại lý *")).toHaveValue(
      "Đại lý Minh Anh",
    );
  });

  it("opens add and edit defect as a modal on the defect list", () => {
    render(<DefectMasterScreen />);

    expect(screen.getByText("Không chạy motor")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "+ Thêm bệnh / lỗi" }),
    );

    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Thêm bệnh / lỗi")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));

    const row = screen.getByText("Không chạy motor").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(
      within(row as HTMLTableRowElement).getByRole("button", { name: "Sửa" }),
    );

    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Mã lỗi *")).toHaveValue("DF-MOTOR-01");
    expect(within(dialog).getByLabelText("Tên bệnh / lỗi *")).toHaveValue(
      "Không chạy motor",
    );
  });

  it("supports legacy create-screen deep links by opening the parent list modal", () => {
    const { unmount } = render(<SkuMasterScreen openCreateOnMount />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    unmount();

    const agency = render(<AgencyMasterScreen openCreateOnMount />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    agency.unmount();

    render(<DefectMasterScreen openCreateOnMount />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
