import type { CSSProperties } from "react";
import { BRAND } from "@/app/theme";

/** Layout styles bám bộ token của wireframe Hoa Nam WMS P0. */
export const layoutStyles = {
  sideNavBrand: {
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    color: BRAND.ink,
    background: BRAND.paperAlt,
    fontWeight: 800,
    fontSize: 17,
    letterSpacing: 0,
    userSelect: "none",
    borderBottom: `1px solid ${BRAND.divider}`,
  } satisfies CSSProperties,

  sideNavBrandIcon: {
    width: 32,
    height: 32,
    borderRadius: 3,
    border: `1.5px solid ${BRAND.primary}`,
    background: BRAND.accentBg,
    color: BRAND.primary,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontWeight: 800,
  } satisfies CSSProperties,

  headerToggleButton: {
    fontSize: 16,
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
  } satisfies CSSProperties,

  breadcrumb: {
    marginBottom: 12,
    padding: "0 2px",
  } satisfies CSSProperties,

  footer: {
    textAlign: "center",
    padding: "14px 20px",
    color: BRAND.muted,
  } satisfies CSSProperties,

  userMenuClickable: {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "3px 7px",
    borderRadius: 3,
    transition: "background 0.15s ease",
  } satisfies CSSProperties,

  userMenuProfile: {
    lineHeight: 1.38,
  } satisfies CSSProperties,

  userMenuProfileName: {
    fontWeight: 700,
  } satisfies CSSProperties,

  userMenuProfileMeta: {
    fontSize: 12,
    color: BRAND.muted,
  } satisfies CSSProperties,

  mainLayoutRoot: {
    minHeight: "100vh",
    background: BRAND.canvas,
  } satisfies CSSProperties,

  siderFixed: {
    overflow: "auto",
    height: "100vh",
    position: "fixed",
    insetInlineStart: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
    background: BRAND.paper,
    scrollbarWidth: "thin",
    scrollbarColor: `${BRAND.border} transparent`,
    borderInlineEnd: `2px solid ${BRAND.ink}`,
  } satisfies CSSProperties,

  siderOffset: (width: number): CSSProperties => ({
    marginInlineStart: width,
    transition: "margin-inline-start 0.2s ease",
  }),

  contentMargin: (isMobile: boolean): CSSProperties => ({
    margin: isMobile ? 12 : 20,
  }),

  contentBody: (): CSSProperties => ({
    padding: "clamp(16px, 2vw, 20px)",
    minHeight: "calc(100vh - 60px - 62px - 40px)",
    background: BRAND.paper,
    borderRadius: 4,
    border: `2px solid ${BRAND.ink}`,
    boxShadow: "4px 5px 0 rgba(43,43,43,.12)",
  }),

  drawerBody: {
    padding: 0,
    background: BRAND.paper,
  } satisfies CSSProperties,

  contextSwitcherIcon: {
    color: BRAND.primary,
  } satisfies CSSProperties,

  contextSwitcherLabel: {
    fontWeight: 700,
    color: BRAND.inkSecondary,
  } satisfies CSSProperties,

  contextSwitcherTag: {
    marginInlineEnd: 0,
    borderRadius: 3,
    borderColor: BRAND.accentBorder,
    background: BRAND.accentBg,
    color: BRAND.primary,
    fontWeight: 700,
  } satisfies CSSProperties,

  contextSwitcherItemIconPlaceholder: {
    display: "inline-block",
    width: 14,
  } satisfies CSSProperties,

  contextSwitcherItem: {
    lineHeight: 1.3,
  } satisfies CSSProperties,

  contextSwitcherItemTitle: {
    fontWeight: 700,
  } satisfies CSSProperties,

  contextSwitcherItemMeta: {
    fontSize: 12,
  } satisfies CSSProperties,

  contextSwitcherTrigger: {
    cursor: "pointer",
    minHeight: 36,
    padding: "0 8px",
    border: `1.5px solid ${BRAND.border}`,
    borderRadius: 3,
    background: BRAND.paper,
  } satisfies CSSProperties,

  contextSwitcherCaret: {
    fontSize: 10,
    color: BRAND.muted,
  } satisfies CSSProperties,

  headerContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 clamp(10px, 2vw, 16px)",
    height: 60,
    transition: "box-shadow 0.2s ease",
    position: "sticky",
    top: 0,
    zIndex: 99,
    background: BRAND.headerBg,
  } satisfies CSSProperties,

  siderDrawerMask: {
    background: "rgba(43,43,43,.38)",
    backdropFilter: "blur(2px)",
  } satisfies CSSProperties,
};
