import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listSuppliers } from "@/modules/master-data/services/supplier.service";

export interface InboundSupplierOption {
  value: string;
  label: string;
}

export interface UseInboundSupplierSearchResult {
  options: InboundSupplierOption[];
  loading: boolean;
  error: Error | null;
  retry: () => void;
  onSearch: (keyword: string) => void;
}

const SEARCH_DEBOUNCE_MS = 300;
const LOOKUP_PAGE_SIZE = 20;

/** Tìm NCC đang hoạt động cho form nhập kho — server-side, có debounce. */
export function useInboundSupplierSearch(
  enabled = true,
): UseInboundSupplierSearchResult {
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedKeyword(keyword.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const query = useQuery({
    queryKey: ["inbound", "supplier-lookup", debouncedKeyword],
    queryFn: ({ signal }) =>
      listSuppliers(
        {
          q: debouncedKeyword || undefined,
          status: "ACTIVE",
          page: 1,
          per_page: LOOKUP_PAGE_SIZE,
        },
        signal,
      ),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });

  return {
    options: (query.data?.rows ?? []).map((row) => ({
      value: row.id,
      label: row.display_name || row.name,
    })),
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    retry: () => {
      void query.refetch();
    },
    onSearch: setKeyword,
  };
}
