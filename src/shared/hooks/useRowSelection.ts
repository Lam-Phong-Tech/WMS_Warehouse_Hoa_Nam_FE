import { useCallback, useMemo, useState, type Key } from "react";

/**
 * Trạng thái + thao tác chọn nhiều dòng, dùng chung cho bảng raw `<table>`
 * (IamUserScreen, ApiMasterScreens) lẫn `ResponsiveDataTable`.
 */
export interface RowSelectionState {
  selectedKeys: Set<Key>;
  /** Số dòng đang chọn TRONG trang hiện tại. */
  selectedCount: number;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  toggleOne: (key: Key, checked: boolean) => void;
  toggleAll: (checked: boolean) => void;
  isSelected: (key: Key) => boolean;
  clear: () => void;
}

/**
 * Chọn nhiều dòng cho các bảng danh sách MVP (raw <table>, không dùng antd Table).
 * Chỉ theo dõi các key đang hiển thị trên trang hiện tại — đổi trang/bộ lọc
 * thì lựa chọn của trang trước không còn áp dụng cho "chọn tất cả".
 */
export function useRowSelection<T>(
  items: T[],
  getKey: (item: T) => Key,
): RowSelectionState {
  const [selectedKeys, setSelectedKeys] = useState<Set<Key>>(new Set());

  const visibleKeys = useMemo(() => items.map(getKey), [items, getKey]);

  const selectedCount = useMemo(
    () => visibleKeys.filter((key) => selectedKeys.has(key)).length,
    [visibleKeys, selectedKeys],
  );

  const isAllSelected =
    visibleKeys.length > 0 && selectedCount === visibleKeys.length;
  const isIndeterminate = selectedCount > 0 && !isAllSelected;

  const toggleOne = useCallback((key: Key, checked: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedKeys((current) => {
        const next = new Set(current);
        visibleKeys.forEach((key) => {
          if (checked) next.add(key);
          else next.delete(key);
        });
        return next;
      });
    },
    [visibleKeys],
  );

  const isSelected = useCallback(
    (key: Key) => selectedKeys.has(key),
    [selectedKeys],
  );

  const clear = useCallback(() => setSelectedKeys(new Set()), []);

  return {
    selectedKeys,
    selectedCount,
    isAllSelected,
    isIndeterminate,
    toggleOne,
    toggleAll,
    isSelected,
    clear,
  };
}
