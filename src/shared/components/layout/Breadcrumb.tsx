import { Breadcrumb as AntBreadcrumb } from "antd";
import type { BreadcrumbProps as AntBreadcrumbProps } from "antd";

export type BreadcrumbItemType = NonNullable<
  AntBreadcrumbProps["items"]
>[number];

export interface BreadcrumbProps {
  items: AntBreadcrumbProps["items"];
}

/** Breadcrumb điều hướng từ danh sách mục (wrapper antd Breadcrumb). */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return <AntBreadcrumb items={items} />;
}
