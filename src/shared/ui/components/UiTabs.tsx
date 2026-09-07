/**
 * Foundation Tabs — thanh tab canonical (textTransform none + motion đã có
 * trong theme adapter), scrollable để không vỡ hàng trên mobile.
 *
 * KHÔNG KHOÁ LUỒNG CHÍNH KHI ĐỔI TAB (07/09/2026): `onChange` của màn hình
 * thường kéo theo việc dựng lại cả panel (bảng hàng trăm dòng, biểu đồ, KPI).
 * Trước đây việc đó chạy ở mức ưu tiên GẤP ngay trong tác vụ của cú bấm, nên
 * trình duyệt không vẽ được khung hình nào cho tới khi dựng xong — khoảng chờ
 * đó CHÍNH LÀ chỉ số INP mà người dùng cảm thấy là "lag khi đổi tab".
 *
 * Nay tách hai việc theo đúng độ khẩn của chúng: thanh tab sáng NGAY bằng một
 * state cục bộ (vài chục node), còn `onChange` của màn hình chạy trong
 * `startTransition` để React được phép cắt nhỏ và nhường luồng chính. Mọi màn
 * đang dùng `UiTabs` hưởng lợi mà không phải sửa dòng nào.
 *
 * Nếu màn hình bỏ qua `onChange` (tab bị chặn theo điều kiện nghiệp vụ) thì sau
 * khi transition xong `value` vẫn là giá trị cũ và thanh tab tự quay về — đúng
 * ngữ nghĩa controlled như trước.
 */
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useState, useTransition, type ReactNode } from "react";

export interface UiTabItem {
  key: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface UiTabsProps {
  items: UiTabItem[];
  /** key của tab đang chọn (controlled). */
  value: string;
  onChange: (key: string) => void;
  "aria-label"?: string;
}

export function UiTabs({
  items,
  value,
  onChange,
  "aria-label": ariaLabel,
}: UiTabsProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Đang chờ panel dựng thì hiện tab người dùng vừa bấm; xong thì trả về nguồn
  // sự thật là `value` của màn hình.
  const shown = isPending && pending !== null ? pending : value;

  return (
    <Tabs
      value={shown}
      onChange={(_event, nextKey: string) => {
        setPending(nextKey);
        startTransition(() => onChange(nextKey));
      }}
      variant="scrollable"
      allowScrollButtonsMobile
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <Tab
          key={item.key}
          value={item.key}
          label={item.label}
          disabled={item.disabled}
        />
      ))}
    </Tabs>
  );
}
