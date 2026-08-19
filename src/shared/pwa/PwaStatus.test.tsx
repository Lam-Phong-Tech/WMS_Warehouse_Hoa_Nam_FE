import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { activateWaitingServiceWorkerMock } = vi.hoisted(() => ({
  activateWaitingServiceWorkerMock: vi.fn(),
}));

vi.mock("./register-pwa", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./register-pwa")>();
  return {
    ...actual,
    activateWaitingServiceWorker: activateWaitingServiceWorkerMock,
  };
});

import { PWA_UPDATE_READY_EVENT } from "./register-pwa";
import { PwaStatus } from "./PwaStatus";

/**
 * WWHN-325 / FE325-P1-12: nửa UI của SW update flow. Nửa runtime (waiting
 * worker + SKIP_WAITING + controllerchange trên service worker thật) nằm ở
 * e2e/wwhn-325-pwa-offline.spec.ts; registerPwa chỉ chạy ở production build
 * nên banner update không thể xuất hiện trên dev server của e2e — vì vậy UI
 * update flow phải được chốt ở đây bằng chính event contract của register-pwa.
 */
describe("WWHN-325 PwaStatus online/offline/update UX", () => {
  function setOnLine(value: boolean) {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => value,
    });
  }

  beforeEach(() => {
    activateWaitingServiceWorkerMock.mockReset();
    setOnLine(true);
  });

  it("renders nothing while online without a pending update", () => {
    const { container } = render(<PwaStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the offline banner on offline event and hides it again when back online", () => {
    render(<PwaStatus />);

    setOnLine(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Đang ngoại tuyến");
    expect(banner).toHaveTextContent("mọi thao tác ghi đã bị khóa");

    setOnLine(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the update banner on update-ready and activates only on user click", () => {
    render(<PwaStatus />);

    act(() => {
      window.dispatchEvent(new CustomEvent(PWA_UPDATE_READY_EVENT));
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Có phiên bản ứng dụng mới",
    );
    // Update là hành động do người dùng chủ động bấm — không tự kích hoạt.
    expect(activateWaitingServiceWorkerMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cập nhật ngay" }));
    expect(activateWaitingServiceWorkerMock).toHaveBeenCalledTimes(1);
  });
});
