/**
 * SideNav — sidebar nghiệp vụ trên nền design system (Part 4 shell swap).
 *
 * - Data từ nav-data.ts (nguồn nav DUY NHẤT — NAV-01); visibility theo
 *   ROUTE_PERMISSIONS + hasAnyWmsPermission (RBAC domain, không theo screen-id).
 * - Style Vuexy SÁNG 100% bằng token/sx (SEMANTIC_LIGHT/MOTION) — các class
 *   `hn-mvp-*` GIỮ LẠI thuần tuý làm test-hook (E2E wwhn-144), không còn CSS.
 * - Điều hướng giữ dạng `path?screen=<id>` — hợp đồng URL của E2E/deep-link;
 *   việc render màn thuộc route+RequirePermission (bypass ?screen= đã gỡ ở
 *   MainLayout — SEC-RBAC-01).
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Collapse, UiIcon, UiIconButton } from "@/shared/ui";
import {
  MOTION,
  RADIUS,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui/tokens";
import {
  DEFAULT_SCREEN_BY_PATH,
  getVisibleNavGroups,
  matchesPath,
  NAV_GROUPS,
  normalizeScreen,
} from "@/app/layouts/nav-data";
import { useAuthStore } from "@/shared/store/auth.store";

const itemButtonSx = (active: boolean) =>
  ({
    display: "flex",
    alignItems: "center",
    gap: 1.25,
    width: "100%",
    minHeight: 38,
    padding: "8px 12px",
    border: "none",
    borderRadius: `${RADIUS.control}px`,
    cursor: "pointer",
    textAlign: "left" as const,
    fontFamily: "inherit",
    fontSize: TYPOGRAPHY.fontSizeBody,
    backgroundColor: active ? S.primary : "transparent",
    color: active ? S.onPrimary : S.textHigh,
    transition: `background-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}, color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
    "&:hover": {
      backgroundColor: active ? S.primary : S.primarySoft,
    },
    "&:focus-visible": {
      outline: "none",
      boxShadow: S.focusRing,
    },
  }) as const;

export interface SideNavProps {
  /** true khi thanh bên đang ở chế độ thu gọn (chỉ còn dải icon nhóm). */
  collapsed?: boolean;
  /** Yêu cầu mở lại thanh bên đầy đủ (gọi khi bấm icon nhóm lúc đang thu gọn). */
  onExpand?: () => void;
  /** Đảo trạng thái thu gọn — nút đóng/mở nằm ngay trong thanh bên. */
  onToggle?: () => void;
}

export function SideNav({
  collapsed = false,
  onExpand,
  onToggle,
}: SideNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const requestedScreen = new URLSearchParams(location.search).get("screen");
  const selectedScreen =
    normalizeScreen(requestedScreen) ??
    DEFAULT_SCREEN_BY_PATH[location.pathname];

  const visibleGroups = getVisibleNavGroups(permissionCodes, isSuperAdmin);

  const activeGroupName = visibleGroups.find((group) =>
    group.items.some(
      (item) =>
        (selectedScreen === item.screen || !selectedScreen) &&
        matchesPath(location.pathname, item.path),
    ),
  )?.name;

  // Vuexy mặc định MỞ mọi nhóm (khả năng khám phá menu theo quyền — role hạn
  // chế thấy ngay mục của mình); người dùng vẫn đóng/mở từng nhóm được.
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(NAV_GROUPS.map((group) => group.name)),
  );
  const isFirstRender = useRef(true);

  // Điều hướng đổi trang → đảm bảo nhóm active đang mở, không đụng nhóm khác.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!activeGroupName) return;
    setOpenGroups((prev) =>
      prev.has(activeGroupName) ? prev : new Set(prev).add(activeGroupName),
    );
  }, [activeGroupName]);

  const handleGroupHeaderClick = (name: string) => {
    if (collapsed) {
      onExpand?.();
      setOpenGroups((prev) => new Set(prev).add(name));
      return;
    }
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <Box
      component="nav"
      data-testid="primary-navigation"
      aria-label="Điều hướng chính"
      sx={{ px: 1.5, py: 1.5, display: "grid", gap: 0.5 }}
    >
      {/* Brand + nút thu gọn */}
      <Box
        className="hn-mvp-brand"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 1,
          pb: 1.5,
        }}
      >
        <Box
          className="hn-mvp-logo"
          aria-hidden="true"
          sx={{
            width: 36,
            height: 36,
            borderRadius: `${RADIUS.control}px`,
            backgroundColor: S.primary,
            color: S.onPrimary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          HN
        </Box>
        {!collapsed ? (
          <Box
            component="h1"
            sx={{
              margin: 0,
              fontSize: TYPOGRAPHY.cardTitle.fontSize,
              fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
              color: S.textHigh,
              whiteSpace: "nowrap",
            }}
          >
            Hoa Nam WMS
          </Box>
        ) : null}
        {onToggle ? (
          <UiIconButton
            className="hn-mvp-aside-toggle"
            onClick={onToggle}
            aria-label={collapsed ? "Hiện menu" : "Ẩn menu"}
            aria-pressed={collapsed}
            title={collapsed ? "Hiện menu" : "Ẩn menu"}
            sx={{ marginLeft: "auto" }}
          >
            <UiIcon name={collapsed ? "angle-right" : "angle-left"} />
          </UiIconButton>
        ) : null}
      </Box>

      {visibleGroups.map((group) => {
        const open = openGroups.has(group.name);
        return (
          <Box component="section" key={group.name} aria-label={group.name}>
            <Box
              component="button"
              type="button"
              className="hn-mvp-group"
              onClick={() => handleGroupHeaderClick(group.name)}
              aria-expanded={open}
              title={group.name}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "8px 12px",
                borderRadius: `${RADIUS.control}px`,
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: S.textDisabled,
                "&:hover": { color: S.textMedium },
                "&:focus-visible": { outline: "none", boxShadow: S.focusRing },
              }}
            >
              <Box
                component="span"
                sx={{ color: S.textMedium, display: "inline-flex" }}
              >
                <UiIcon name={group.icon} size="sm" />
              </Box>
              {!collapsed ? (
                <>
                  <Box component="span" sx={{ flex: 1, textAlign: "left" }}>
                    {group.name}
                  </Box>
                  <UiIcon
                    name={open ? "angle-down" : "caret-right"}
                    size="sm"
                  />
                </>
              ) : null}
            </Box>
            <Collapse in={open && !collapsed} timeout={MOTION.duration.fast}>
              <Box sx={{ display: "grid", gap: 0.25, pb: 0.5 }}>
                {group.items.map((item) => {
                  const active =
                    (selectedScreen === item.screen || !selectedScreen) &&
                    matchesPath(location.pathname, item.path);
                  return (
                    <Box
                      component="button"
                      key={item.screen}
                      type="button"
                      className={`hn-mvp-nav-btn${active ? " active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={() =>
                        navigate(`${item.path}?screen=${item.screen}`)
                      }
                      sx={itemButtonSx(active)}
                    >
                      <Box
                        component="span"
                        sx={{
                          display: "inline-flex",
                          color: active ? S.onPrimary : S.textMedium,
                        }}
                      >
                        <UiIcon name={item.icon} size="sm" />
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.label}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
}
