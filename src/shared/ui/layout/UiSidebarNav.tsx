/**
 * UiSidebarNav — điều hướng dọc canonical Vuexy (Part 3, PRESENTATIONAL ONLY).
 *
 * Baseline DEC-UI-BASELINE-01 + spec X §3: item active = nền primary + chữ
 * onPrimary radius control; hover = primarySoft; focus-visible = focus ring
 * token (mirror var(--wms-focus-ring)). `collapsed` → chỉ icon + Tooltip.
 * Không router-aware — active/onClick do caller quyết định (nối shell Part 4).
 */
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import type { ReactNode } from "react";
import {
  CONTROL,
  MOTION,
  RADIUS,
  SEMANTIC_LIGHT as S,
  SPACING,
  TYPOGRAPHY,
} from "@/shared/ui/tokens";
import { UiIcon } from "@/shared/ui/components";

export interface UiSidebarNavItem {
  key: string;
  label: string;
  /** Slug Flaticon rounded-regular (vd "box", "user") — render qua UiIcon. */
  icon?: string;
  active?: boolean;
  onClick?: () => void;
  /** Badge góc phải item (vd số thông báo) — ẩn khi collapsed. */
  badge?: ReactNode;
}

export interface UiSidebarNavGroup {
  /** Nhãn nhóm (uppercase, nhạt) — ẩn khi collapsed. */
  label?: string;
  items: UiSidebarNavItem[];
}

export interface UiSidebarNavProps {
  /** Vùng đầu sidebar (logo/brand). */
  header?: ReactNode;
  groups: UiSidebarNavGroup[];
  /** Thu gọn: chỉ icon, label chuyển vào Tooltip. */
  collapsed?: boolean;
  /** Vùng cuối sidebar (user card, version…). */
  footer?: ReactNode;
}

/** Transition màu cho item nav — theo motion token (không dùng `all`). */
const ITEM_TRANSITION = [
  `color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
  `background-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
  `box-shadow ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
].join(", ");

function NavItemButton({
  item,
  collapsed,
}: {
  item: UiSidebarNavItem;
  collapsed: boolean;
}) {
  const button = (
    <Box
      component="button"
      type="button"
      onClick={item.onClick}
      aria-current={item.active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: `${SPACING.md}px`,
        width: "100%",
        minHeight: CONTROL.height,
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        border: "none",
        borderRadius: `${RADIUS.control}px`,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        fontSize: TYPOGRAPHY.fontSizeBody,
        lineHeight: TYPOGRAPHY.lineHeightBody,
        fontWeight: item.active ? TYPOGRAPHY.button.fontWeight : 400,
        // Active theo baseline: nền primary + chữ onPrimary; còn lại chữ textHigh.
        backgroundColor: item.active ? S.primary : "transparent",
        color: item.active ? S.onPrimary : S.textHigh,
        transition: ITEM_TRANSITION,
        "&:hover": {
          backgroundColor: item.active ? S.primary : S.primarySoft,
        },
        "&:focus-visible": {
          outline: "none",
          boxShadow: S.focusRing,
        },
      }}
    >
      {item.icon ? <UiIcon name={item.icon} size="md" /> : null}
      {!collapsed ? (
        <>
          <Box
            component="span"
            sx={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </Box>
          {item.badge ?? null}
        </>
      ) : null}
    </Box>
  );

  // Collapsed: label chuyển thành tooltip bên phải item.
  return collapsed ? (
    <Tooltip title={item.label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

export function UiSidebarNav({
  header,
  groups,
  collapsed = false,
  footer,
}: UiSidebarNavProps) {
  return (
    <Box
      component="nav"
      aria-label="Điều hướng chính"
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        padding: `${SPACING.md}px`,
        gap: `${SPACING.sm}px`,
      }}
    >
      {header ?? null}

      <Box sx={{ flex: 1, minHeight: 0 }}>
        {groups.map((group, groupIndex) => (
          <Box
            key={group.label ?? `group-${groupIndex}`}
            sx={{ marginBottom: `${SPACING.sm}px` }}
          >
            {group.label && !collapsed ? (
              <Box
                component="span"
                sx={{
                  display: "block",
                  padding: `${SPACING.sm}px ${SPACING.md}px ${SPACING.xs}px`,
                  fontSize: 11,
                  fontWeight: TYPOGRAPHY.button.fontWeight,
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  color: S.textDisabled,
                }}
              >
                {group.label}
              </Box>
            ) : null}
            {/* Collapsed: thay nhãn nhóm bằng divider mảnh để vẫn tách nhóm */}
            {group.label && collapsed && groupIndex > 0 ? (
              <Box
                aria-hidden
                sx={{
                  borderTop: `1px solid ${S.divider}`,
                  margin: `${SPACING.sm}px ${SPACING.md}px`,
                }}
              />
            ) : null}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: `${SPACING.xs}px`,
              }}
            >
              {group.items.map((item) => (
                <NavItemButton
                  key={item.key}
                  item={item}
                  collapsed={collapsed}
                />
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      {footer ?? null}
    </Box>
  );
}
