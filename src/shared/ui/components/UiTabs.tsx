/**
 * Foundation Tabs — thanh tab canonical (textTransform none + motion đã có
 * trong theme adapter), scrollable để không vỡ hàng trên mobile.
 */
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import type { ReactNode } from "react";

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
  return (
    <Tabs
      value={value}
      onChange={(_event, nextKey: string) => onChange(nextKey)}
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
