/**
 * Hook đọc danh mục tỉnh/thành và phường/xã cho UiAddressField.
 *
 * Nguồn là JSON trong repo (xem vn-address.api), KHÔNG gọi dịch vụ ngoài:
 * - Tỉnh/thành nằm trong bundle → có ngay lần render đầu, `loading` luôn false
 *   và `error` luôn false. Ô "Tỉnh/Thành" vì thế không thể "không tải được".
 * - Phường/xã ở chunk riêng, được hâm sẵn khi ô địa chỉ mount nên thường đã
 *   nằm trong bộ nhớ trước lúc người dùng chọn xong tỉnh.
 *
 * Không dùng react-query để component design-system (src/shared/ui) không phụ
 * thuộc QueryClientProvider. Dữ liệu được ĐỌC ĐỒNG BỘ lúc render (peek*),
 * effect chỉ khởi động việc nạp và chỉ setState trong callback — không có
 * setState đồng bộ trong thân effect (react-hooks/set-state-in-effect).
 */
import { useCallback, useEffect, useState } from "react";
import {
  fetchWards,
  peekProvinces,
  peekWards,
  preloadVnWards,
  type VnProvince,
  type VnWard,
} from "./vn-address.api";

export interface VnCatalogState<T> {
  data: T[];
  loading: boolean;
  error: boolean;
  /** Nạp lại sau khi lỗi (chunk phường/xã hỏng giữa chừng). */
  retry: () => void;
}

const EMPTY_PROVINCES: VnProvince[] = [];
const EMPTY_WARDS: VnWard[] = [];

const NO_RETRY = () => undefined;

export function useVnProvinces(enabled = true): VnCatalogState<VnProvince> {
  return {
    data: enabled ? peekProvinces() : EMPTY_PROVINCES,
    loading: false,
    error: false,
    retry: NO_RETRY,
  };
}

export function useVnWards(
  provinceCode: number | null,
  enabled = true,
): VnCatalogState<VnWard> {
  // Lỗi gắn với mã tỉnh: đổi sang tỉnh khác thì tự thử nạp lại.
  const [errorFor, setErrorFor] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [, bump] = useState(0);

  const active = enabled && provinceCode !== null;
  const data = active ? peekWards(provinceCode) : null;
  const error = active && errorFor === provinceCode;

  // Hâm chunk phường/xã ngay khi ô địa chỉ mount, trước cả khi chọn tỉnh.
  useEffect(() => {
    if (enabled) preloadVnWards();
  }, [enabled]);

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
