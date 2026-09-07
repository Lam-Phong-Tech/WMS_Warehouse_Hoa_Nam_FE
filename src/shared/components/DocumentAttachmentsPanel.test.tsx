/**
 * Hồi quy cho lỗi thật ngày 06/09/2026: vùng KÉO-THẢ của khối chứng từ đính
 * kèm chỉ đo dung lượng, không kiểm loại tệp. Thuộc tính `accept` trên
 * `<input type="file">` CHỈ lọc hộp thoại chọn tệp nên thả thẳng một `.exe`
 * vào là tệp bay lên API, người dùng chỉ nhận toast 422 chung chung.
 *
 * Test đi qua đúng đường kéo-thả (`fireEvent.drop` + `dataTransfer.files`),
 * không phải đường chọn tệp — đó mới là đường đã hở.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { DocumentAttachmentsPanel } from "./DocumentAttachmentsPanel";
import {
  deleteDocumentAttachment,
  fetchDocumentAttachments,
  uploadDocumentAttachment,
} from "@/shared/api/documentAttachmentService";
import { FILE_SIZE_LIMITS } from "@/shared/validation/file-rules";

/**
 * Bắt câu lỗi ngay ở nguồn (`toast.error`) thay vì dò DOM: toast của sonner
 * render bất đồng bộ qua portal nên dò DOM là test lúc xanh lúc đỏ.
 */
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: Object.assign(vi.fn(), actual.toast, { error: toastError }),
  };
});

vi.mock("@/shared/api/documentAttachmentService", () => ({
  fetchDocumentAttachments: vi.fn(),
  uploadDocumentAttachment: vi.fn(),
  downloadDocumentAttachment: vi.fn(),
  deleteDocumentAttachment: vi.fn(),
}));

const FILE_INPUT_SELECTOR = String.raw`input[type="file"]`;

function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** Vùng thả là thẻ `label` bọc input file — tìm qua chính input đó. */
function dropZone(): HTMLElement {
  const input = document.querySelector<HTMLInputElement>(FILE_INPUT_SELECTOR);
  expect(input).not.toBeNull();
  const zone = input?.closest("label");
  expect(zone).not.toBeNull();
  return zone as HTMLElement;
}

function drop(files: File[]) {
  fireEvent.drop(dropZone(), { dataTransfer: { files } });
}

async function renderPanel() {
  vi.mocked(fetchDocumentAttachments).mockResolvedValue({
    attachments: [],
    evidence_status: "PENDING",
  } as never);
  renderWithProviders(
    <DocumentAttachmentsPanel documentType="INBOUND" documentId="doc-1" />,
  );
  // Đợi query settle: vùng thả chỉ render sau khi hết trạng thái "Đang tải".
  await waitFor(() =>
    expect(document.querySelector(FILE_INPUT_SELECTOR)).not.toBeNull(),
  );
}

describe("DocumentAttachmentsPanel — kéo-thả tệp", () => {
  beforeEach(() => {
    toastError.mockReset();
    vi.mocked(uploadDocumentAttachment).mockReset();
    vi.mocked(deleteDocumentAttachment).mockReset();
    vi.mocked(uploadDocumentAttachment).mockResolvedValue({} as never);
  });

  it("KHÔNG tải lên tệp .exe thả vào vùng thả (bug gốc)", async () => {
    await renderPanel();
    drop([makeFile("virus.exe", "application/x-msdownload")]);
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining("virus.exe"),
    );
  });

  it("KHÔNG tải lên tệp .zip dù trình duyệt không đoán được MIME", async () => {
    await renderPanel();
    drop([makeFile("chung-tu.zip", "")]);
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining("chung-tu.zip"),
    );
  });

  it("vẫn tải lên ảnh và PDF hợp lệ", async () => {
    await renderPanel();
    drop([
      makeFile("hien-truong.jpg", "image/jpeg"),
      makeFile("hoa-don.pdf", "application/pdf"),
    ]);
    await waitFor(() =>
      expect(uploadDocumentAttachment).toHaveBeenCalledTimes(2),
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it("vẫn chặn tệp hợp lệ nhưng vượt trần dung lượng", async () => {
    await renderPanel();
    drop([
      makeFile("qua-nang.jpg", "image/jpeg", FILE_SIZE_LIMITS.document + 1),
    ]);
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("15 MB"));
  });

  it("thả nhiều tệp: chỉ tệp hỏng bị loại, tệp hợp lệ vẫn đi", async () => {
    await renderPanel();
    drop([
      makeFile("ok.png", "image/png"),
      makeFile("script.js", "text/javascript"),
    ]);
    await waitFor(() =>
      expect(uploadDocumentAttachment).toHaveBeenCalledTimes(1),
    );
    expect(uploadDocumentAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({ name: "ok.png" }),
      }),
    );
  });

  it("ô chọn tệp khai đúng danh sách đuôi của luật dùng chung", async () => {
    await renderPanel();
    expect(document.querySelector(FILE_INPUT_SELECTOR)).toHaveAttribute(
      "accept",
      ".jpg,.jpeg,.png,.webp,.pdf",
    );
  });
});
