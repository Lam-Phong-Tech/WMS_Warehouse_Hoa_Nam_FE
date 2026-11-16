import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UiDrawer } from "@/shared/ui";
import { describe, expect, it, vi } from "vitest";
import { PvProductImageField } from "@/modules/pv/components/PvProductImageField";
import {
  importPvProductImage,
  uploadPvProductImage,
} from "@/modules/pv/services/pv-image.service";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/modules/pv/services/pv-image.service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/modules/pv/services/pv-image.service")
    >();
  return {
    ...actual,
    uploadPvProductImage: vi.fn(),
    importPvProductImage: vi.fn(),
  };
});

describe("PvProductImageField", () => {
  it("downloads a pasted URL and adds only the system URL after completion", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBusyChange = vi.fn();
    let finish!: (value: { url: string }) => void;
    vi.mocked(importPvProductImage).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve as typeof finish;
      }),
    );
    renderWithProviders(
      <PvProductImageField
        value={[]}
        onChange={onChange}
        onBusyChange={onBusyChange}
      />,
    );
    const input = screen.getByRole("textbox", {
      name: "Hoặc dán URL ảnh có sẵn",
    });
    await user.type(input, "https://png.pngtree.com/board.png");
    await user.click(screen.getByRole("button", { name: "Thêm" }));
    expect(importPvProductImage).toHaveBeenCalledWith(
      "https://png.pngtree.com/board.png",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toBeDisabled();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    finish({ url: "https://hoanam.test/api/v1/pv/product-images/one.png" });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        {
          url: "https://hoanam.test/api/v1/pv/product-images/one.png",
          alt_text: null,
          is_primary: true,
        },
      ]),
    );
    expect(input).toHaveValue("");
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps the URL and reports download failure without adding a broken image", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(importPvProductImage).mockRejectedValue(
      new Error("Không tải được ảnh từ link này."),
    );
    renderWithProviders(<PvProductImageField value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox", {
      name: "Hoặc dán URL ảnh có sẵn",
    });
    await user.type(input, "https://png.pngtree.com/blocked.png{Enter}");
    await screen.findByText("Không tải được ảnh từ link này.");
    expect(input).toHaveValue("https://png.pngtree.com/blocked.png");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens the clicked image at full size and closes without changing images", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <PvProductImageField
        value={[
          {
            url: "https://cdn.example.test/one.png",
            alt_text: "Ảnh thứ nhất",
            is_primary: true,
          },
          {
            url: "https://cdn.example.test/two.png",
            alt_text: "Ảnh thứ hai",
            is_primary: false,
          },
        ]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Phóng to ảnh 2" }));
    const preview = await screen.findByRole("dialog", { name: "Ảnh sản phẩm" });
    expect(
      await within(preview).findByRole("img", { name: "Ảnh thứ hai" }),
    ).toHaveAttribute("src", "https://cdn.example.test/two.png");
    await user.click(within(preview).getByRole("button", { name: "Đóng" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Ảnh sản phẩm" }),
      ).not.toBeInTheDocument(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("supports Enter and Escape without closing the product drawer", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <UiDrawer open title="Sửa sản phẩm" onClose={onClose}>
        <PvProductImageField
          disabled
          value={[
            {
              url: "https://cdn.example.test/one.png",
              alt_text: "Máy khoan",
              is_primary: true,
            },
          ]}
          onChange={vi.fn()}
        />
      </UiDrawer>,
    );
    const thumbnail = await screen.findByRole("button", {
      name: "Phóng to ảnh 1",
    });
    thumbnail.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Ảnh sản phẩm" });
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Ảnh sản phẩm" }),
      ).not.toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(thumbnail).toHaveFocus();
  });

  it("ảnh vừa tải lên KHÔNG lấy tên tệp làm mô tả ảnh (vd Untitled.png)", async () => {
    const url = "https://cdn.example.test/pv/anh-1.png";
    vi.mocked(uploadPvProductImage).mockResolvedValue({ url } as never);
    const onChange = vi.fn();

    const { container } = renderWithProviders(
      <PvProductImageField value={[]} onChange={onChange} />,
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
      "Untitled.png",
      {
        type: "image/png",
      },
    );
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange).toHaveBeenCalledWith([
      { url, alt_text: null, is_primary: true },
    ]);
  });
});
