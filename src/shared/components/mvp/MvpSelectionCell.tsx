import { useEffect, useRef } from "react";

interface MvpSelectionCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}

/** Checkbox chọn dòng cho các bảng MVP (raw <table>) — hỗ trợ trạng thái indeterminate ở checkbox header. */
export function MvpSelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: MvpSelectionCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={ariaLabel}
    />
  );
}

/** STT (số thứ tự) tính theo trang hiện tại, tô màu xoay vòng 5 màu khớp mẫu thiết kế. */
export function mvpRowNumber(page: number, perPage: number, index: number) {
  return (page - 1) * perPage + index + 1;
}
