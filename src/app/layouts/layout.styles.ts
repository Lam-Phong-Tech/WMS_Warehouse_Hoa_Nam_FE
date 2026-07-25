import type { CSSProperties } from 'react';
import { BRAND } from '@/app/theme';

/**
 * Style dùng chung cho các component layout (Sider/Header/Footer/Breadcrumb).
 * P2: trước đây các style này lặp lại rải rác dạng inline trong từng
 * component — gom vào đây để dễ soát/sửa đồng bộ. Nếu tiếp tục scale (nhiều
 * theme, cần pseudo-class/media query thật) thì chuyển hẳn sang CSS module;
 * hiện tại toàn bộ style layout khác đều là style object nên giữ cùng cách
 * tiếp cận cho nhất quán, tránh trộn 2 kiểu (inline object + CSS module) chỉ
 * cho riêng layout.
 */
export const layoutStyles = {
  sideNavBrand: {
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: 0.5,
    userSelect: 'none',
  } satisfies CSSProperties,

  sideNavBrandIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.15)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } satisfies CSSProperties,

  headerToggleButton: {
    fontSize: 16,
    width: 40,
    height: 40,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  } satisfies CSSProperties,

  breadcrumb: {
    marginBottom: 16,
    padding: '0 2px',
  } satisfies CSSProperties,

  footer: {
    textAlign: 'center',
    padding: '16px 24px',
  } satisfies CSSProperties,

  userMenuClickable: {
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    borderRadius: 8,
    transition: 'background 0.2s ease',
  } satisfies CSSProperties,

  userMenuProfile: {
    lineHeight: 1.4,
  } satisfies CSSProperties,

  userMenuProfileName: {
    fontWeight: 600,
  } satisfies CSSProperties,

  userMenuProfileMeta: {
    fontSize: 12,
  } satisfies CSSProperties,

  mainLayoutRoot: {
    minHeight: '100vh',
  } satisfies CSSProperties,

  /**
   * Sider cố định (position: fixed) khi cuộn trang — trước đây Sider cuộn
   * theo nội dung vì nằm trong luồng cuộn chung của `<Layout>`. `overflow:
   * auto` để bản thân menu tự cuộn riêng nếu danh sách dài hơn màn hình,
   * không đẩy Header/Footer.
   */
  siderFixed: {
    overflow: 'auto',
    height: '100vh',
    position: 'fixed',
    insetInlineStart: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(255,255,255,0.12) transparent',
  } satisfies CSSProperties,

  /** Bù khoảng trống bên trái = độ rộng Sider (đã fixed, không còn chiếm chỗ trong luồng). */
  siderOffset: (width: number): CSSProperties => ({
    marginInlineStart: width,
    transition: 'margin-inline-start 0.2s ease',
  }),

  contentMargin: (isMobile: boolean): CSSProperties => ({
    margin: isMobile ? 12 : 24,
  }),

  contentBody: (
    colorBgContainer: string,
    borderRadiusLG: number,
  ): CSSProperties => ({
    padding: 'clamp(16px, 2vw, 24px)',
    minHeight: 'calc(100vh - 64px - 70px - 80px)',
    background: colorBgContainer,
    borderRadius: borderRadiusLG,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  }),

  drawerBody: {
    padding: 0,
    background: BRAND.siderBg,
  } satisfies CSSProperties,

  contextSwitcherIcon: {
    color: BRAND.primary,
  } satisfies CSSProperties,

  contextSwitcherLabel: {
    fontWeight: 500,
  } satisfies CSSProperties,

  contextSwitcherTag: {
    marginInlineEnd: 0,
  } satisfies CSSProperties,

  contextSwitcherItemIconPlaceholder: {
    display: 'inline-block',
    width: 14,
  } satisfies CSSProperties,

  contextSwitcherItem: {
    lineHeight: 1.3,
  } satisfies CSSProperties,

  contextSwitcherItemTitle: {
    fontWeight: 600,
  } satisfies CSSProperties,

  contextSwitcherItemMeta: {
    fontSize: 12,
  } satisfies CSSProperties,

  contextSwitcherTrigger: {
    cursor: 'pointer',
  } satisfies CSSProperties,

  contextSwitcherCaret: {
    fontSize: 10,
    color: '#999',
  } satisfies CSSProperties,

  // Animation & responsive helpers
  headerContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 clamp(12px, 2vw, 24px)',
    height: 64,
    transition: 'box-shadow 0.3s ease',
    position: 'sticky',
    top: 0,
    zIndex: 99,
    backdropFilter: BRAND.headerBlur,
    background: BRAND.headerBg,
  } satisfies CSSProperties,

  siderDrawerMask: {
    background: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(4px)',
  } satisfies CSSProperties,
};
