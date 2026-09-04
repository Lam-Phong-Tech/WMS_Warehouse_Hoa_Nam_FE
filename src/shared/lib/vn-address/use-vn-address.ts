/**
 * Hook tải danh mục tỉnh/thành và phường/xã cho UiAddressField.
 *
 * Không dùng react-query để component design-system (src/shared/ui) không
 * phụ thuộc QueryClientProvider; cache nằm ở vn-address.api (module + localStorage)
 * nên nhiều ô địa chỉ trên cùng màn chỉ tải một lần.
 *
 * Dữ liệu được ĐỌC ĐỒNG BỘ từ cache lúc render (peek*), effect chỉ khởi động
 * request khi cache trống và chỉ setState trong callback — không có
 * setState đồng bộ trong thân effect (react-hooks/set-state-in-effect).
 */
import { useCallback, useEffect, useState } from "react";
import {
  fetchProvinces,
  fetchWards,
  peekProvinces,
  peekWards,
  type VnProvince,
  type VnWard,
} from "./vn-address.api";

export interface VnCatalogState<T> {
  data: T[];
  loading: boolean;
  error: boolean;
  /** Gọi lại API sau khi lỗi (mất mạng, dịch vụ ngoài tạm ngưng). */
  retry: () => void;
}

const EMPTY_PROVINCES: VnProvince[] = [];
const EMPTY_WARDS: VnWard[] = [];

export function useVnProvinces(enabled = true): VnCatalogState<VnProvince> {
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [, bump] = useState(0);

  const data = enabled ? peekProvinces() : null;

  useEffect(() => {
    if (!enabled || error || peekProvinces()) return;
    let cancelled = false;
    fetchProvinces()
      .then(() => {
        if (!cancelled) bump((n) => n + 1);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, error, attempt]);

  const retry = useCallback(() => {
    setError(false);
    setAttempt((n) => n + 1);
  }, []);

  return {
    data: data ?? EMPTY_PROVINCES,
    loading: enabled && !data && !error,
    error,
    retry,
  };
}

export function useVnWards(
  provinceCode: number | null,
  enabled = true,
): VnCatalogState<VnWard> {
  // Lỗi gắn với mã tỉnh: đổi sang tỉnh khác thì tự thử tải lại.
  const [errorFor, setErrorFor] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [, bump] = useState(0);

  const active = enabled && provinceCode !== null;
  const data = active ? peekWards(provinceCode) : null;
  const error = active && errorFor === provinceCode;

  useEffect(() => {
    if (!active || provinceCode === null || error || peekWards(provinceCode)) {
      return;
    }
    let cancelled = false;
    fetchWards(provinceCode)
      .then(() => {
        if (!cancelled) bump((n) => n + 1);
      })
      .catch(() => {
        if (!cancelled) setErrorFor(provinceCode);
      });
    return () => {
      cancelled = true;
    };
  }, [active, provinceCode, error, attempt]);

  const retry = useCallback(() => {
    setErrorFor(null);
    setAttempt((n) => n + 1);
  }, []);

  return {
    data: data ?? EMPTY_WARDS,
    loading: active && !data && !error,
    error,
    retry,
  };
}
