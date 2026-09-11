import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PvProductImageField } from "@/modules/pv/components/PvProductImageField";
import { uploadPvProductImage } from "@/modules/pv/services/pv-image.service";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/modules/pv/services/pv-image.service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/modules/pv/services/pv-image.service")
    >();
  return { ...actual, uploadPvProductImage: vi.fn() };
});

describe("PvProductImageField", () => {
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
