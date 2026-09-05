import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { api } from "@/shared/api/axios";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutocompleteOption {
  value: string | number;
  label: string;
  /** Dữ liệu gốc trả về từ API, có thể dùng để render thêm thông tin */
  raw?: Record<string, unknown>;
}

export interface UseAutocompleteOptions {
  /** URL API để fetch options (nếu fetch từ xa) */
  apiUrl?: string;
  /** Hàm fetch tuỳ chỉnh, override apiUrl */
  fetcher?: (searchText: string) => Promise<AutocompleteOption[]>;
  /** Axios instance, mặc định dùng api (axios instance gốc) */
  axiosInstance?: AxiosInstance;
  /** Delay debounce (ms), mặc định 300 */
  debounceMs?: number;
  /** Số ký tự tối thiểu để bắt đầu tìm kiếm, mặc định 1 */
  minSearchLength?: number;
  /** Options tĩnh (nếu không fetch từ xa) */
  staticOptions?: AutocompleteOption[];
  /** Query key cho react-query (nếu fetch từ xa) */
  queryKey?: string;
  /** Enabled/disabled cho react-query */
  enabled?: boolean;
  /** Hàm transform response từ API thành AutocompleteOption[] */
  transformResponse?: (data: unknown) => AutocompleteOption[];
  /** Hàm filter local options (chỉ dùng khi có staticOptions) */
  filterFn?: (option: AutocompleteOption, searchText: string) => boolean;
}

export interface UseAutocompleteReturn {
  /** Options đã được lọc/fetch */
  options: AutocompleteOption[];
  /** Text tìm kiếm hiện tại */
  searchText: string;
  /** Set text tìm kiếm (thường dùng từ onSearch của AutoComplete) */
  setSearchText: (text: string) => void;
  /** Đang loading */
  loading: boolean;
  /** Lỗi nếu có */
  error: Error | null;
  /** Reset về trạng thái ban đầu */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Debounce function */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/** Filter mặc định: tìm kiếm không dấu, không phân biệt hoa thường */
function defaultFilterFn(
  option: AutocompleteOption,
  searchText: string,
): boolean {
  if (!searchText) return true;
  const search = removeAccents(searchText.toLowerCase());
  const label = removeAccents(option.label.toLowerCase());
  const value = String(option.value).toLowerCase();
  return label.includes(search) || value.includes(search);
}

/** Loại bỏ dấu tiếng Việt */
function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook autocomplete dùng chung cho toàn dự án.
 * Hỗ trợ cả local filter (staticOptions) và remote fetch (apiUrl/fetcher).
 *
 * @example
 * ```tsx
 * // Local options
 * const autocomplete = useAutocomplete({
 *   staticOptions: allEmployees.map(e => ({ value: e.id, label: `${e.code} — ${e.fullName}` })),
 * });
 *
 * // Remote fetch
 * const autocomplete = useAutocomplete({
 *   apiUrl: '/employees/search',
 *   transformResponse: (data: any) => data.data.map((e: any) => ({ value: e.id, label: e.fullName })),
 * });
 * ```
 */
export function useAutocomplete(
  options: UseAutocompleteOptions = {},
): UseAutocompleteReturn {
  const {
    apiUrl,
    fetcher,
    axiosInstance = api,
    debounceMs = 300,
    minSearchLength = 1,
    staticOptions,
    queryKey = "autocomplete",
    enabled = true,
    transformResponse,
    filterFn = defaultFilterFn,
  } = options;

  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebounce(searchText, debounceMs);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset khi enabled = false
  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchText("");
    }
  }, [enabled]);

  // Remote fetch với react-query
  const remoteQuery = useQuery({
    queryKey: [queryKey, debouncedSearch, apiUrl],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < minSearchLength) {
        return [];
      }

      // Cancel previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      if (fetcher) {
        return fetcher(debouncedSearch);
      }

      if (apiUrl) {
        const response = await axiosInstance.get<unknown>(apiUrl, {
          params: { search: debouncedSearch },
          signal: abortControllerRef.current.signal,
        });

        if (transformResponse) {
          return transformResponse(response.data);
        }

        // Mặc định: response.data.data là array of { value, label }
        const data =
          (response.data as { data?: AutocompleteOption[] })?.data ??
          response.data;
        return (data as AutocompleteOption[]) ?? [];
      }

      return [];
    },
    enabled:
      enabled &&
      !!debouncedSearch &&
      debouncedSearch.length >= minSearchLength &&
      (!!apiUrl || !!fetcher),
    retry: 1,
  });

  // Local filter
  const localOptions = useCallback(() => {
    if (!staticOptions) return [];
    if (!debouncedSearch || debouncedSearch.length < minSearchLength) {
      return staticOptions;
    }
    return staticOptions.filter((opt) => filterFn(opt, debouncedSearch));
  }, [staticOptions, debouncedSearch, minSearchLength, filterFn]);

  const isRemote = !!apiUrl || !!fetcher;
  const optionsList = isRemote ? (remoteQuery.data ?? []) : localOptions();

  const reset = useCallback(() => {
    setSearchText("");
    abortControllerRef.current?.abort();
  }, []);

  return {
    options: optionsList,
    searchText,
    setSearchText,
    loading: isRemote ? remoteQuery.isLoading : false,
    error: isRemote ? (remoteQuery.error as Error | null) : null,
    reset,
  };
}
