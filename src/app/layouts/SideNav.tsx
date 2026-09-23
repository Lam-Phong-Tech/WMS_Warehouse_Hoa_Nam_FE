/**
 * SideNav — thanh điều hướng bám 1:1 demo UI/UX đã chốt
 * `1.WMS_Hoa_Nam_Sidebar_Demo.html` (2026-08-31), theo Vuexy.
 *
 * Hình học/màu/motion KHÔNG ước lượng lại tại đây: mọi con số đọc từ
 * COMPONENT_TOKENS.nav (đo từ demo). Cấu trúc 3 loại hàng đúng demo:
 *   1. hàng phẳng (direct)   — icon + nhãn, không sổ;
 *   2. tiêu đề nhóm (group)  — icon + nhãn + chevron xoay 180° khi mở;
 *   3. mục con (child)       — KHÔNG icon, đánh dấu bằng chấm tròn viền,
 *      mục đang chọn tô gradient tím + đổ bóng.
 *
 * Thao tác đúng demo: accordion chỉ-một-nhóm-mở; thu gọn thì đóng hết và nhớ
 * nhóm đang mở để mở lại khi bung; ở rail chỉ còn icon + tooltip; bấm logo để
 * bung; rê chuột/focus vào rail thì "he mở" tạm (peek — do UiAppShell +
 * MainLayout điều phối vì nó đụng tới cột lưới của shell).
 *
 * Data từ nav-data.ts (nguồn nav DUY NHẤT — NAV-01); visibility theo
 * ROUTE_PERMISSIONS + hasAnyWmsPermission (RBAC domain, không theo screen-id).
 * Các class `hn-mvp-*` GIỮ LẠI thuần tuý làm test-hook (E2E wwhn-144).
 * Điều hướng giữ dạng `path?screen=<id>` — hợp đồng URL của E2E/deep-link.
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { preloadRoute } from "@/app/router/route-preload";
import { Box, Tooltip, UiIcon, VuexyNavIcon } from "@/shared/ui";
import { COMPONENT_TOKENS, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import {
  DEFAULT_SCREEN_BY_PATH,
  getVisibleNavGroups,
  matchesPath,
  normalizeScreen,
  type NavGroupData,
  type NavItemData,
} from "@/app/layouts/nav-data";
import { useAuthStore } from "@/shared/store/auth.store";
import { useNavLabel } from "@/shared/i18n/nav-labels";
import { useT } from "@/shared/i18n/useT";
import { tStatic as tUi } from "@/shared/i18n/useT";

const NAV = COMPONENT_TOKENS.nav;
const C = NAV.color;

/** Tooltip của demo: hiện sau 700ms, đi tiếp sang mục kế chỉ chờ 300ms. */
const TOOLTIP_ENTER_DELAY = 700;
const TOOLTIP_ENTER_NEXT_DELAY = 300;

/**
 * Tooltip CHỈ cho hàng menu ở rail thu gọn — lúc đó hàng chỉ còn icon nên cần
 * tooltip mới biết là mục gì. Khi MỞ RỘNG, nhãn đã hiện đầy đủ nên tooltip chỉ
 * gây rối (phản hồi người dùng 2026-08-31: bỏ cái "chữ xám" khi rê chuột) —
 * `enabled=false` thì render thẳng nút, không bọc Tooltip.
 */
function NavRowTooltip({
  enabled,
  title,
  children,
}: {
  enabled: boolean;
  title: string;
  children: ReactElement;
}) {
  if (!enabled) return children;
  return (
    <Tooltip
      title={title}
      placement="right"
      enterDelay={TOOLTIP_ENTER_DELAY}
      enterNextDelay={TOOLTIP_ENTER_NEXT_DELAY}
    >
      {children}
    </Tooltip>
  );
}

const ACTIVE_GRADIENT = `linear-gradient(${NAV.activeGradientAngle}, ${S.primary}, ${C.activeGradientEnd})`;

/** Nền/chữ của mục ĐANG CHỌN — gradient tím + bóng, đúng demo. */
const activeSurfaceSx = {
  background: ACTIVE_GRADIENT,
  boxShadow: NAV.shadow.activeItem,
  color: S.onPrimary,
  // Giữ nguyên gradient khi rê chuột (không nhạt đi thành màu hover).
  "&:hover": { background: ACTIVE_GRADIENT },
} as const;

const focusRingSx = {
  outline: `2px solid ${C.focus}`,
  outlineOffset: "2px",
} as const;

const rowResetSx = {
  display: "flex",
  alignItems: "center",
  border: 0,
  textAlign: "left" as const,
  textDecoration: "none",
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

/**
 * Hàng CẤP 1 (direct + tiêu đề nhóm). `highlighted` = nhóm đang mở hoặc đang
 * chứa mục active → nền hover + chữ đậm màu mực (demo: .is-open/.has-active).
 */
function topRowSx(rail: boolean, highlighted: boolean) {
  return {
    ...rowResetSx,
    position: "relative" as const,
    width: rail ? `${NAV.railItemSize}px` : "100%",
    minHeight: rail ? NAV.railItemSize : NAV.itemMinHeight,
    margin: rail ? `${NAV.railItemMarginY}px auto` : 0,
    justifyContent: rail ? "center" : "flex-start",
    gap: rail ? 0 : `${NAV.itemGap}px`,
    padding: rail ? 0 : `${NAV.itemPaddingY}px ${NAV.itemPaddingX}px`,
    borderRadius: `${NAV.radius}px`,
    backgroundColor: highlighted ? C.hover : "transparent",
    color: highlighted ? S.textStrong : C.itemText,
    fontSize: NAV.itemFontSize,
    fontWeight: NAV.itemFontWeight,
    letterSpacing: 0,
    textTransform: "none" as const,
    "&:hover": { backgroundColor: C.hover },
    "&:focus-visible": focusRingSx,
  };
}

/** Chấm tròn viền đứng trước mục con (demo: .hnw-child::before). */
function markerSx(color: string) {
  return {
    content: '""',
    position: "absolute" as const,
    left: `${NAV.markerLeft}px`,
    top: "50%",
    transform: "translateY(-50%)",
    width: `${NAV.markerSize}px`,
    height: `${NAV.markerSize}px`,
    border: `${NAV.markerBorderWidth}px solid ${color}`,
    borderRadius: "50%",
  };
}

/** Mục con — không icon, thụt 43px, chữ đậm màu mực (đậm hơn hàng cấp 1). */
function childRowSx(active: boolean) {
  return {
    ...rowResetSx,
    position: "relative" as const,
    width: "100%",
    minHeight: NAV.childMinHeight,
    gap: `${NAV.itemGap}px`,
    margin: `${NAV.childMarginY}px 0`,
    padding: `${NAV.childPaddingY}px ${NAV.itemPaddingX}px ${NAV.childPaddingY}px ${NAV.childPaddingLeft}px`,
    borderRadius: `${NAV.radius}px`,
    fontSize: NAV.itemFontSize,
    fontWeight: NAV.itemFontWeight,
    ...(active
      ? activeSurfaceSx
      : {
          background: "transparent",
          color: S.textStrong,
          "&:hover": { backgroundColor: C.hover },
        }),
    "&::before": markerSx(active ? S.onPrimary : C.marker),
    "&:focus-visible": focusRingSx,
  };
}

/** Nhãn 1 dòng, tràn thì cắt ellipsis (tooltip bù lại phần chữ bị cắt). */
const labelSx = {
  minWidth: 0,
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const liveRegionSx = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

export interface SideNavProps {
  /** true khi thanh bên đang ở chế độ thu gọn (chỉ còn dải icon). */
  collapsed?: boolean;
  /** Yêu cầu mở lại thanh bên đầy đủ (bấm logo, hoặc bấm icon nhóm ở rail). */
  onExpand?: () => void;
  /** Đảo trạng thái thu gọn — nút tròn nằm ngay trong khối brand. */
  onToggle?: () => void;
}

export function SideNav({
  collapsed = false,
  onExpand,
  onToggle,
}: SideNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const requestedScreen = new URLSearchParams(location.search).get("screen");
  const selectedScreen =
    normalizeScreen(requestedScreen) ??
    DEFAULT_SCREEN_BY_PATH[location.pathname];

  const visibleGroups = getVisibleNavGroups(permissionCodes, isSuperAdmin);
  const systemGroup = visibleGroups.find((group) => group.name === "Hệ thống");
  const primaryGroups = visibleGroups.filter(
    (group) => group.name !== "Hệ thống",
  );
  const warehouseItem = systemGroup?.items.find(
    (item) => item.screen === "WH-01",
  );
  /**
   * Nhãn menu đi qua i18n: khoá là screen-id (mục) và tên icon (nhóm) — nhãn
   * tiếng Việt trong nav-data vẫn là bản gốc và là fallback.
   */
  const navLabel = useNavLabel();

  const isItemActive = (item: NavItemData) =>
    (selectedScreen === item.screen || !selectedScreen) &&
    matchesPath(location.pathname, item.path);

  const activeGroupName = visibleGroups.find((group) =>
    group.items.some(isItemActive),
  )?.name;
  const activeItem = visibleGroups
    .flatMap((group) => group.items)
    .find(isItemActive);

  // Accordion "flush": CHỈ MỘT nhóm mở tại một thời điểm. Mặc định đóng hết —
  // vào ứng dụng thấy trọn cây menu, bấm tiêu đề nhóm mới sổ.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Chốt activeGroupName lúc mount làm mốc so sánh — miễn nhiễm StrictMode.
  const previousActiveGroupRef = useRef(activeGroupName);
  // Điều hướng SANG route khác → tự mở nhóm active mới.
  useEffect(() => {
    const previousActiveGroup = previousActiveGroupRef.current;
    previousActiveGroupRef.current = activeGroupName;
    if (!activeGroupName || previousActiveGroup === activeGroupName) return;
    setOpenGroup(activeGroupName);
  }, [activeGroupName]);

  const goTo = (item: NavItemData) =>
    navigate(`${item.path}?screen=${item.screen}`);

  /** Hàng phẳng: bấm là đi thẳng + đóng mọi nhóm đang sổ (đúng demo). */
  const handleDirectClick = (item: NavItemData) => {
    setOpenGroup(null);
    goTo(item);
  };

  const renderDirect = (group: NavGroupData) => {
    const item = group.items[0];
    if (!item) return null;
    const active = isItemActive(item);
    return (
      <NavRowTooltip
        key={group.name}
        enabled={collapsed}
        title={navLabel(item.screen, item.label)}
      >
        <Box
          component="button"
          type="button"
          className={`hn-mvp-nav-btn hn-mvp-direct${active ? " active" : ""}`}
          aria-current={active ? "page" : undefined}
          data-nav-path={item.path}
          onClick={() => handleDirectClick(item)}
          onPointerEnter={() => preloadRoute(item.path)}
          onFocus={() => preloadRoute(item.path)}
          sx={{
            ...topRowSx(collapsed, active && collapsed),
            // Ở rail, mục đang chọn chỉ tô nền hover (demo); khi mở rộng thì
            // tô gradient như mục con để trạng thái "đang ở đây" nhất quán.
            ...(active && !collapsed ? activeSurfaceSx : null),
          }}
        >
          <Box component="span" sx={{ display: "inline-flex", flexShrink: 0 }}>
            <VuexyNavIcon name={group.icon} size={NAV.iconSize} />
          </Box>
          {!collapsed ? (
            <Box component="span" sx={labelSx}>
              {navLabel(item.screen, item.label)}
            </Box>
          ) : null}
        </Box>
      </NavRowTooltip>
    );
  };

  const systemItemLabel = (item: NavItemData) => {
    if (item.screen === "IAM-01") return tUi("topbar.accountUsers");
    if (item.screen === "WH-01") return tUi("updatedUi.text_202e0e9b0b85");
    if (item.screen === "AUDIT-01") return tUi("topbar.accountAudit");
    return navLabel(item.screen, item.label);
  };

  const renderSystemItem = (item: NavItemData) => {
    const active = isItemActive(item);
    return (
      <Box
        key={item.screen}
        component="button"
        type="button"
        className={`hn-sidebar-system-item hn-mvp-nav-btn${active ? " active" : ""}`}
        aria-current={active ? "page" : undefined}
        data-nav-path={item.path}
        onClick={() => goTo(item)}
        onPointerEnter={() => preloadRoute(item.path)}
        onFocus={() => preloadRoute(item.path)}
        sx={{
          ...rowResetSx,
          width: "100%",
          minHeight: NAV.itemMinHeight,
          gap: `${NAV.itemGap}px`,
          padding: `${NAV.itemPaddingY}px ${NAV.itemPaddingX}px`,
          borderRadius: `${NAV.radius}px`,
          background: active ? ACTIVE_GRADIENT : "transparent",
          color: active ? S.onPrimary : C.itemText,
          fontSize: NAV.itemFontSize,
          fontWeight: NAV.itemFontWeight,
          "&:hover": active
            ? { background: ACTIVE_GRADIENT }
            : { backgroundColor: C.hover },
          "&:focus-visible": focusRingSx,
        }}
      >
        <Box component="span" sx={{ display: "inline-flex", flexShrink: 0 }}>
          <UiIcon name={item.icon} size="md" />
        </Box>
        <Box component="span" sx={labelSx}>
          {systemItemLabel(item)}
        </Box>
      </Box>
    );
  };

  const renderGroup = (group: NavGroupData, index: number) => {
    const open = openGroup === group.name && !collapsed;
    const hasActive = group.items.some(isItemActive);
    const submenuId = `hn-nav-submenu-${index}`;
    return (
      <Box
        component="section"
        key={group.name}
        aria-label={navLabel(group.icon, group.name)}
        sx={{
          // Rail: gạch 22px tách cụm ngay trên nhóm (demo: reports/system).
          ...(collapsed && group.railDivider
            ? {
                position: "relative",
                marginTop: `${NAV.railDividerGapTop}px`,
                paddingTop: `${NAV.railDividerPadTop}px`,
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  width: `${NAV.railDividerWidth}px`,
                  height: "1px",
                  backgroundColor: C.border,
                  transform: "translateX(-50%)",
                },
              }
            : null),
        }}
      >
        <NavRowTooltip
          enabled={collapsed}
          title={navLabel(group.icon, group.name)}
        >
          <Box
            component="button"
            type="button"
            className="hn-mvp-group"
            onClick={() => {
              if (collapsed) {
                // Ở rail: bấm icon nhóm vừa bung sidebar vừa sổ đúng nhóm đó.
                onExpand?.();
                setOpenGroup(group.name);
                return;
              }
              setOpenGroup((previous) =>
                previous === group.name ? null : group.name,
              );
            }}
            aria-expanded={open}
            aria-controls={submenuId}
            sx={topRowSx(collapsed, open || hasActive)}
          >
            <Box
              component="span"
              sx={{ display: "inline-flex", flexShrink: 0 }}
            >
              <VuexyNavIcon name={group.icon} size={NAV.iconSize} />
            </Box>
            {!collapsed ? (
              <>
                <Box component="span" sx={labelSx}>
                  {navLabel(group.icon, group.name)}
                </Box>
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    display: "inline-flex",
                    flexShrink: 0,
                    transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    transition: `transform ${NAV.motion.chevron}ms ${NAV.motion.easing}`,
                    "@media (prefers-reduced-motion: reduce)": {
                      transition: "none",
                    },
                  }}
                >
                  <VuexyNavIcon name="chevron-down" size={NAV.chevronSize} />
                </Box>
              </>
            ) : null}
          </Box>
        </NavRowTooltip>

        {/*
         * Sổ bằng grid-template-rows 0fr → 1fr (đúng demo): con giữ nguyên
         * chiều cao tự nhiên, không cần đo bằng JS. Khi đóng: aria-hidden +
         * inert ⇒ vừa khoá tab/trợ năng, vừa khiến truy vấn theo role bỏ qua.
         */}
        <Box
          id={submenuId}
          className="hn-mvp-submenu"
          aria-hidden={!open}
          inert={!open}
          sx={{
            display: collapsed ? "none" : "grid",
            gridTemplateRows: open ? "1fr" : "0fr",
            opacity: open ? 1 : 0,
            transition: `grid-template-rows ${NAV.motion.submenu}ms ${NAV.motion.easing}, opacity ${NAV.motion.submenuOpacity}ms ${NAV.motion.easing}`,
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        >
          <Box sx={{ minHeight: 0, overflow: "hidden" }}>
            {group.items.map((item) => {
              const active = isItemActive(item);
              // Mục con CHỈ hiện khi mở rộng (rail ẩn cả submenu) nên nhãn luôn
              // thấy — KHÔNG bọc tooltip (phản hồi người dùng 2026-08-31).
              return (
                <Box
                  key={item.screen}
                  component="button"
                  type="button"
                  className={`hn-mvp-nav-btn${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  data-nav-path={item.path}
                  onClick={() => goTo(item)}
                  onPointerEnter={() => preloadRoute(item.path)}
                  onFocus={() => preloadRoute(item.path)}
                  sx={childRowSx(active)}
                >
                  <Box component="span" sx={labelSx}>
                    {navLabel(item.screen, item.label)}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      className="hn-sidebar-content"
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        color: S.textStrong,
      }}
    >
      {/* Brand: logo + tên + nút thu gọn tròn (demo: .hnw-brand) */}
      <Box
        component="header"
        className="hn-mvp-brand"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : `${NAV.brand.gap}px`,
          minHeight: NAV.brand.height,
          padding: collapsed
            ? 0
            : `0 ${NAV.brand.paddingRight}px 0 ${NAV.brand.paddingLeft}px`,
        }}
      >
        <Tooltip
          title={collapsed ? t("nav.expand") : ""}
          placement="right"
          enterDelay={TOOLTIP_ENTER_DELAY}
          enterNextDelay={TOOLTIP_ENTER_NEXT_DELAY}
        >
          <Box
            component="button"
            type="button"
            className="hn-mvp-logo"
            aria-label={collapsed ? t("nav.expand") : t("nav.brand")}
            onClick={() => {
              if (collapsed) onExpand?.();
            }}
            sx={{
              display: "grid",
              placeItems: "center",
              flex: `0 0 ${collapsed ? NAV.brand.logoSize : NAV.brand.logoBasisExpanded}px`,
              width: NAV.brand.logoSize,
              height: NAV.brand.logoSize,
              padding: 0,
              border: 0,
              borderRadius: `${NAV.brand.logoRadius}px`,
              backgroundColor: S.primary,
              color: S.onPrimary,
              fontFamily: "inherit",
              fontSize: NAV.brand.logoFontSize,
              fontWeight: NAV.brand.logoFontWeight,
              letterSpacing: NAV.brand.logoLetterSpacing,
              // Chỉ bấm được khi đang thu gọn (demo: cursor default lúc mở).
              cursor: collapsed ? "pointer" : "default",
              "&:focus-visible": focusRingSx,
            }}
          >
            <svg
              className="hn-sidebar-brand-mark"
              viewBox="0 0 32 32"
              width="30"
              height="30"
              fill="none"
              aria-hidden="true"
            >
              <path d="M11 4H7a3 3 0 0 0-3 3v4M21 4h4a3 3 0 0 1 3 3v4M11 28H7a3 3 0 0 1-3-3v-4M21 28h4a3 3 0 0 0 3-3v-4" />
              <path d="M10 13.5 16 10l6 3.5v7L16 24l-6-3.5zM10 13.5l6 3.5 6-3.5M16 17v7" />
            </svg>
          </Box>
        </Tooltip>

        {!collapsed ? (
          <Box
            component="h1"
            className="hn-sidebar-brand-title"
            sx={{
              margin: 0,
              minWidth: 0,
              flex: 1,
              overflow: "hidden",
              fontSize: NAV.brand.nameFontSize,
              fontWeight: NAV.brand.nameFontWeight,
              color: S.textStrong,
              whiteSpace: "nowrap",
            }}
          >
            HOA NAM SCANNER
            <Box
              component="span"
              className="hn-sidebar-brand-subtitle"
              aria-hidden="true"
            ></Box>
          </Box>
        ) : null}

        {!collapsed && onToggle ? (
          <Tooltip
            title={t("nav.collapse")}
            placement="right"
            enterDelay={TOOLTIP_ENTER_DELAY}
            enterNextDelay={TOOLTIP_ENTER_NEXT_DELAY}
          >
            <Box
              component="button"
              type="button"
              className="hn-mvp-aside-toggle"
              onClick={onToggle}
              aria-label={t("nav.collapse")}
              aria-pressed={false}
              sx={{
                display: "grid",
                placeItems: "center",
                flex: `0 0 ${NAV.brand.collapseSize}px`,
                width: NAV.brand.collapseSize,
                height: NAV.brand.collapseSize,
                padding: 0,
                border: 0,
                borderRadius: "50%",
                background: "transparent",
                color: C.muted,
                cursor: "pointer",
                "&:hover": { color: S.primary },
                "&:focus-visible": focusRingSx,
              }}
            >
              <VuexyNavIcon
                name="circle-dot"
                size={NAV.brand.collapseIconSize}
                strokeWidth={NAV.brand.collapseStrokeWidth}
              />
            </Box>
          </Tooltip>
        ) : null}
      </Box>

      {/* Cây điều hướng (demo: .hnw-nav — padding 0 10px 18px) */}
      <Box
        component="nav"
        data-testid="primary-navigation"
        aria-label={t("nav.primary")}
        sx={{
          padding: `0 ${collapsed ? NAV.railPaddingX : NAV.paddingX}px ${NAV.paddingBottom}px`,
        }}
      >
        {primaryGroups.map((group, index) =>
          group.direct && group.items.length === 1
            ? renderDirect(group)
            : renderGroup(group, index),
        )}
      </Box>

      {systemGroup ? (
        collapsed ? (
          renderGroup(systemGroup, primaryGroups.length)
        ) : (
          <Box
            component="section"
            className="hn-sidebar-system"
            aria-label={tUi("iam.permissionModule.system")}
          >
            <Box className="hn-sidebar-system-title">
              {tUi("updatedUi.text_1beae08eb43f")}
            </Box>
            <Box className="hn-sidebar-system-list">
              {systemGroup.items.map(renderSystemItem)}
            </Box>
          </Box>
        )
      ) : null}

      {!collapsed ? (
        <>
          <Box className="hn-sidebar-worker" aria-hidden="true" />
          <Box className="hn-sidebar-bottom">
            <Box className="hn-sidebar-slogan" aria-hidden="true">
              <span>{tUi("updatedUi.text_5502102c0562")}</span>
              <span>{tUi("updatedUi.text_aef0bf441ad0")}</span>
              <span>{tUi("updatedUi.text_4ed68f6ac715")}</span>
            </Box>
            {warehouseItem ? (
              <Box
                component="button"
                type="button"
                className="hn-sidebar-warehouse-card"
                onClick={() => goTo(warehouseItem)}
                onPointerEnter={() => preloadRoute(warehouseItem.path)}
                onFocus={() => preloadRoute(warehouseItem.path)}
                aria-label={tUi("updatedUi.text_b4f188abbc07")}
              >
                <Box className="hn-sidebar-warehouse-icon">
                  <UiIcon name="home" size="md" />
                </Box>
                <Box className="hn-sidebar-warehouse-copy">
                  <strong>Kho Hoa Nam</strong>
                  <small>
                    <span
                      className="hn-sidebar-status-dot"
                      aria-hidden="true"
                    />
                    {tUi("dashboard.snapshot.warehouseActive")}
                  </small>
                </Box>
                <UiIcon name="angle-small-right" size="sm" />
              </Box>
            ) : null}
            <Box className="hn-sidebar-version">
              {tUi("updatedUi.text_3c311446f9b5")}
            </Box>
          </Box>
        </>
      ) : null}

      {/* Thông báo cho trình đọc màn hình (demo: .hnw-live) */}
      <Box component="p" aria-live="polite" sx={liveRegionSx}>
        {activeItem
          ? t("nav.currentlySelected", {
              label: navLabel(activeItem.screen, activeItem.label),
            })
          : ""}
      </Box>
    </Box>
  );
}
