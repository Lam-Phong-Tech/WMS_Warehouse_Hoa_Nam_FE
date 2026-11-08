import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { isOperationalReadQueryKey } from "@/shared/realtime/operational-queries";
import { fetchInboundDetail } from "../services/inboundService";
import { useInboundDetail } from "./use-inbound";

vi.mock("../services/inboundService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/inboundService")>()),
  fetchInboundDetail: vi.fn(),
}));

it("refreshes read-only report quantities and status without replacing the editor version snapshot", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const read = vi.mocked(fetchInboundDetail);
  read.mockResolvedValue({
    document: { version: 1, status: "SCANNING" },
    lines: [{ scanned: 1 }],
  } as never);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const { result, unmount } = renderHook(
    () => ({
      report: useInboundDetail("in-1", { readOnly: true }),
      editor: useInboundDetail("in-1"),
    }),
    { wrapper },
  );
  try {
    await waitFor(() => {
      expect(result.current.report.data?.document.version).toBe(1);
      expect(result.current.editor.data?.document.version).toBe(1);
    });
    read.mockResolvedValue({
      document: { version: 2, status: "POSTED" },
      lines: [{ scanned: 4 }],
    } as never);
    await act(async () => {
      await client.invalidateQueries({
        predicate: (query) => isOperationalReadQueryKey(query.queryKey),
      });
    });
    await waitFor(() =>
      expect(result.current.report.data?.document.status).toBe("POSTED"),
    );
    expect(result.current.report.data?.lines[0]?.scanned).toBe(4);
    expect(result.current.editor.data?.document.version).toBe(1);
    expect(result.current.editor.data?.document.status).toBe("SCANNING");
  } finally {
    unmount();
    client.clear();
  }
});
