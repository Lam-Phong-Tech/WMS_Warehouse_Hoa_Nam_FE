import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AxiosAdapter, AxiosInstance } from "axios";
import { PageLoadBoundary } from "@/app/router/PageLoadBoundary";
import { installRequestActivityTracker } from "@/shared/api/request-activity";
import { CoordinatedLoadingBoundary } from "@/shared/ui/loading/CoordinatedLoadingBoundary";
import { cleanupTestState } from "@/test/setup";

type SettleMode = "resolve" | "reject";

interface PendingRequest {
  settle: (mode: SettleMode) => void;
}

/**
 * Axios THẬT (setup.ts mock toàn bộ module "axios") + adapter giữ request để test
 * quyết định đúng thời điểm request kết thúc: không cần mạng, không giả dữ liệu.
 */
async function createDirectHttp() {
  const { default: realAxios, AxiosError } =
    await vi.importActual<typeof import("axios")>("axios");
  const client = realAxios.create();
  const pending: PendingRequest[] = [];
  const adapter: AxiosAdapter = (config) =>
    new Promise((resolve, reject) => {
      pending.push({
        settle: (mode) => {
          if (mode === "reject") {
            reject(new AxiosError("read failed", "ERR_BAD_RESPONSE", config));
            return;
          }
          resolve({
            data: {},
            status: 200,
            statusText: "OK",
            headers: {},
            config,
          });
        },
      });
    });
  client.defaults.adapter = adapter;
  installRequestActivityTracker(client);
  return {
    client,
    pendingCount() {
      return pending.length;
    },
    settle(mode: SettleMode = "resolve") {
      const entries = pending.splice(0);
      for (const entry of entries) entry.settle(mode);
      return entries.length;
    },
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function Page({
  client,
  action = false,
}: {
  client: AxiosInstance;
  action?: boolean;
}) {
  useEffect(() => {
    void client.get("/direct-read").catch(() => {});
  }, [client]);
  return (
    <div>
      <p>direct-content</p>
      {action ? (
        <button
          type="button"
          onClick={() => {
            void client.get("/later-read").catch(() => {});
          }}
        >
          reload
        </button>
      ) : null}
    </div>
  );
}

function renderSurface(node: ReactNode, queryClient: QueryClient) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CoordinatedLoadingBoundary>
        <PageLoadBoundary>{node}</PageLoadBoundary>
      </CoordinatedLoadingBoundary>
    </QueryClientProvider>,
  );
  const surface = view.container.querySelector(".hn-loading-boundary");
  const content = view.container.querySelector(".hn-loading-boundary__content");
  if (!surface || !content) throw new Error("barrier loading không render");
  return { surface, content };
}

/** Qua hẳn cửa sổ hai frame render mà controller dùng để công bố trang. */
function passFrames() {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
}

afterEach(() => cleanupTestState());

describe("PageLoadBoundary (request HTTP trực tiếp vào barrier loading)", () => {
  it("giữ cổng chờ tới khi request HTTP trực tiếp kết thúc", async () => {
    const http = await createDirectHttp();
    const queryClient = createClient();
    const { surface, content } = renderSurface(
      <Page client={http.client} />,
      queryClient,
    );
    await waitFor(() => expect(http.pendingCount()).toBe(1));

    await waitFor(() =>
      expect(surface).toHaveAttribute("data-loading-phase", "loading"),
    );
    expect(content).toHaveAttribute("aria-hidden", "true");

    // Màn không có query nào đang chạy: nếu request transport không được tính là
    // tác vụ chuẩn bị thì barrier đã công bố trang sau hai frame.
    await passFrames();
    expect(surface).toHaveAttribute("data-loading-phase", "loading");
    expect(content).toHaveAttribute("aria-hidden", "true");

    await act(async () => {
      expect(http.settle()).toBe(1);
    });
    await waitFor(() =>
      expect(surface).toHaveAttribute("data-loading-phase", "ready"),
    );
    expect(content).not.toHaveAttribute("aria-hidden");
    expect(screen.getByText("direct-content")).toBeVisible();

    queryClient.clear();
  });

  it("không giữ trang khi màn không có request trực tiếp nào", async () => {
    const queryClient = createClient();
    const { surface, content } = renderSurface(
      <p>plain-content</p>,
      queryClient,
    );

    await waitFor(() =>
      expect(surface).toHaveAttribute("data-loading-phase", "ready"),
    );
    expect(content).not.toHaveAttribute("aria-hidden");
    expect(screen.getByText("plain-content")).toBeVisible();

    queryClient.clear();
  });

  it("không che lại trang khi request trực tiếp đến sau lần công bố đầu tiên", async () => {
    const http = await createDirectHttp();
    const queryClient = createClient();
    const { surface, content } = renderSurface(
      <Page client={http.client} action />,
      queryClient,
    );

    await waitFor(() => expect(http.pendingCount()).toBe(1));
    await act(async () => {
      expect(http.settle()).toBe(1);
    });
    await waitFor(() =>
      expect(surface).toHaveAttribute("data-loading-phase", "ready"),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "reload" }));
    });
    await waitFor(() => expect(http.pendingCount()).toBe(1));
    await passFrames();
    expect(surface).toHaveAttribute("data-loading-phase", "ready");
    expect(content).not.toHaveAttribute("aria-hidden");
    expect(screen.getByText("direct-content")).toBeVisible();

    await act(async () => {
      expect(http.settle()).toBe(1);
    });
    queryClient.clear();
  });

  it("không treo cổng chờ khi request trực tiếp trả lỗi", async () => {
    const http = await createDirectHttp();
    const queryClient = createClient();
    const { surface } = renderSurface(
      <Page client={http.client} />,
      queryClient,
    );

    await waitFor(() => expect(http.pendingCount()).toBe(1));
    await act(async () => {
      expect(http.settle("reject")).toBe(1);
    });
    await waitFor(() =>
      expect(surface).toHaveAttribute("data-loading-phase", "ready"),
    );

    queryClient.clear();
  });
});
