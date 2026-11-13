import { afterEach, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { useAgencyOptions, useSkuImportReports } from "./report-data";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/shared/api/http", () => ({ http: { getPage: vi.fn() } }));
afterEach(cleanupTestState);

it("includes later authorized agencies and imports in searchable report sources", async () => {
  vi.mocked(http.getPage).mockImplementation(async (url, config) => {
    const page = config?.params?.page;
    return {
      data:
        url === API_ENDPOINTS.AGENCIES
          ? [
              {
                agency_id: `agency-${page}`,
                agency_name: `Agency ${page}`,
                agency_code: `A${page}`,
              },
            ]
          : [{ import_report_id: `import-${page}`, file_name: `File ${page}` }],
      meta: { last_page: 2, total: 2 },
    } as never;
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { result, unmount } = renderHook(
    () => ({ agencies: useAgencyOptions(), imports: useSkuImportReports({}) }),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  await waitFor(() => expect(result.current.agencies.options).toHaveLength(2));
  await waitFor(() =>
    expect(result.current.imports.data?.data).toHaveLength(2),
  );
  expect(http.getPage).toHaveBeenCalledWith(API_ENDPOINTS.AGENCIES, {
    params: { status: "ACTIVE", per_page: 200, page: 2 },
  });
  expect(http.getPage).toHaveBeenCalledWith(API_ENDPOINTS.SKU_IMPORT_REPORTS, {
    params: { per_page: 100, page: 2 },
  });
  unmount();
  client.clear();
});
