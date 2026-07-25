import { Tabs as AntTabs } from 'antd';
import type { TabsProps } from 'antd';

export type { TabsProps };

/** Tabs chung (wrapper antd Tabs) — dùng cho trang chi tiết nhiều phần. */
export function Tabs(props: TabsProps) {
  return <AntTabs {...props} />;
}
