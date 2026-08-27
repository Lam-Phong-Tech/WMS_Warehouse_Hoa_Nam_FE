import { Checkbox } from "@mui/material";

interface MvpSelectionCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}

/**
 * Checkbox chọn dòng cho các bảng MVP (raw `<table>`) — hỗ trợ trạng thái
 * indeterminate ở checkbox header.
 *
 * Trước đây là `<input type="checkbox">` thuần: trình duyệt tự vẽ nên đổi
 * trạng thái không có chuyển động, màu theo hệ điều hành chứ không theo theme,
 * lệch hẳn checkbox ở các bảng khác. Checkbox của MUI ăn theme và có hiệu ứng
 * tick + ripple như mọi control còn lại.
 *
 * Đổi sang MUI cũng bỏ được thủ thuật `useRef` + `useEffect` để gán
 * `input.indeterminate` — MUI nhận thẳng prop `indeterminate`.
 *
 * KHÔNG bọc ThemeProvider ở đây: component render trong ô của bảng, mỗi trang
 * có hàng chục dòng — bọc theme từng ô là dựng hàng chục provider vô ích. Cả
 * hai màn đang dùng (IamUserScreen, ApiMasterScreens) đều đã bọc ThemeProvider
 * ở cấp trang.
 */
export function MvpSelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: MvpSelectionCheckboxProps) {
  return (
    <Checkbox
      size="small"
      checked={checked}
      indeterminate={indeterminate}
      onChange={(event) => onChange(event.target.checked)}
      // MUI v9 bỏ prop inputProps của Checkbox — nhãn a11y đi qua slotProps.input.
      slotProps={{ input: { "aria-label": ariaLabel } }}
      // Ô chọn dòng rộng 36px (.select-col): padding mặc định 9px của MUI làm
      // dòng cao lên, giữ padding nhỏ để bảng không bị giãn.
      sx={{ p: 0.5 }}
    />
  );
}

/** STT (số thứ tự) tính theo trang hiện tại, tô màu xoay vòng 5 màu khớp mẫu thiết kế. */
export function mvpRowNumber(page: number, perPage: number, index: number) {
  return (page - 1) * perPage + index + 1;
}
