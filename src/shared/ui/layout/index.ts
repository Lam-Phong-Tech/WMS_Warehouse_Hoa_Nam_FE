/**
 * Barrel của bộ LAYOUT canonical Vuexy (Part 3 — presentational only).
 * Shell thật (MainLayout/router) sẽ nối về đây ở Part 4.
 */
export { LAYOUT } from "./layout-tokens";
export { UiAppShell, type UiAppShellProps } from "./UiAppShell";
export {
  UiSidebarNav,
  type UiSidebarNavProps,
  type UiSidebarNavGroup,
  type UiSidebarNavItem,
} from "./UiSidebarNav";
export { UiTopbar, type UiTopbarProps } from "./UiTopbar";
export { UiPageContainer, type UiPageContainerProps } from "./UiPageContainer";
export {
  UiBreadcrumb,
  type UiBreadcrumbProps,
  type UiBreadcrumbItem,
} from "./UiBreadcrumb";
export { UiFooter, type UiFooterProps } from "./UiFooter";
