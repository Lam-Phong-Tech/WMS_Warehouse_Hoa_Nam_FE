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
  COMPONENT_TOKENS,
  MOTION,
  RADIUS,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui/tokens";
import {
  DEFAULT_SCREEN_BY_PATH,
  getVisibleNavGroups,
  matchesPath,
  normalizeScreen,
} from "@/app/layouts/nav-data";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * HÌNH HỌC CÂY ĐIỀU HƯỚNG (phản hồi người dùng 2026-08-29: trang con không
 * thụt vào nên nhìn ngang hàng với tiêu đề nhóm, gây nhầm cấp).
 *
 * Tiêu đề nhóm: padding-left 12 + icon 16 + gap 10 ⇒ CHỮ bắt đầu ở 38px.
 * Trang con canh icon của nó thẳng cột chữ đó — đủ để thấy quan hệ cha–con mà
 * không cần vẽ thêm đường kẻ dọc.
 */
const NAV_GROUP_PADDING_X = 12;
const NAV_ICON_SIZE = COMPONENT_TOKENS.icon.sm;
const NAV_ICON_GAP = 10;
/**
 * Lề trái của mục con: icon của nó thẳng cột CHỮ của tiêu đề nhóm. Chỉ thụt
 * lề, KHÔNG kẻ đường dọc (yêu cầu người dùng 2026-08-29).
 */
const NAV_ITEM_INDENT = NAV_GROUP_PADDING_X + NAV_ICON_SIZE + NAV_ICON_GAP;

const itemButtonSx = (active: boolean, paddingLeft: number) =>
  ({
    display: "flex",
    alignItems: "center",
    gap: `${NAV_ICON_GAP}px`,
    width: "100%",
    minHeight: 38,
    padding: `8px ${NAV_GROUP_PADDING_X}px 8px ${paddingLeft}px`,
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

  // Mặc định TẤT CẢ nhóm đóng (yêu cầu người dùng 2026-08-28) — người dùng
  // bấm vào tiêu đề nhóm mới sổ ra các trang con; nhóm đang active vẫn tự mở
  // lại khi điều hướng tới (effect bên dưới), chỉ không áp dụng ở lần mount
  // đầu để giữ đúng trạng thái "chưa mở" khi vào ứng dụng.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  // Chốt activeGroupName lúc mount làm mốc so sánh — dùng giá trị khởi tạo
  // (không phải ref rỗng + cờ "lần đầu") để miễn nhiễm với StrictMode gọi
  // effect 2 lần ở dev: cờ boolean bị effect đầu tiêu thụ mất, effect thứ hai
  // (cùng lượt mount) sẽ lọt qua guard và tự mở nhóm ngay khi vào ứng dụng.
  const previousActiveGroupRef = useRef(activeGroupName);

  // Điều hướng SANG route khác → tự mở nhóm active mới, không đụng nhóm khác;
  // không tự mở ở lần mount đầu (giữ đúng "mặc định mọi nhóm đóng").
  useEffect(() => {
    const previousActiveGroup = previousActiveGroupRef.current;
    previousActiveGroupRef.current = activeGroupName;
    if (!activeGroupName || previousActiveGroup === activeGroupName) return;
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
      sx={{
        px: 1.5,
        py: 1.5,
        display: "grid",
        // minmax(0, 1fr) thay cho 1fr mặc định: item lưới mặc định có
        // `min-width: auto` nên cột bị NỞ theo nội dung rộng nhất — kể cả nội
        // dung đang ẩn trong <Collapse> (nhãn menu dài, whiteSpace: nowrap).
        // Hậu quả ở rail thu gọn 72px: cả khối con vẫn được dàn ở ~299px rồi
        // bị aside cắt đi, nên nút thu gọn nằm lọt ra ngoài vùng nhìn thấy.
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 0.5,
      }}
    >
      {/* Brand + nút thu gọn */}
      <Box
        className="hn-mvp-brand"
        sx={{
          display: "flex",
          // Rail thu gọn chỉ rộng 72px, không đủ cho logo 36px + nút 38px nằm
          // ngang: nút sẽ bị đẩy ra ngoài và bị cắt mất, khiến người dùng
          // không còn chỗ bấm để mở lại menu. Thu gọn thì xếp dọc, căn giữa.
          flexDirection: collapsed ? "column" : "row",
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
            sx={{
              // Thu gọn: đã xếp dọc nên bỏ marginLeft:auto, nếu giữ thì nút bị
              // đẩy khỏi rail. Mở rộng: vẫn đẩy nút về sát mép phải.
              marginLeft: collapsed ? 0 : "auto",
              flexShrink: 0,
              // 38×38: đạt cỡ chạm tối thiểu (32×32 cũ quá nhỏ cho ngón tay).
              width: 38,
              height: 38,
              // Vuông bo góc + viền + nền: nút trông "bấm được" thay vì một
              // ký tự mũi tên trơn lẫn vào nền sidebar.
              borderRadius: `${RADIUS.control}px`,
              border: "1px solid",
              borderColor: S.border,
              backgroundColor: S.bgSurface,
              color: S.textMedium,
              "&:hover": {
                backgroundColor: S.primarySoft,
                borderColor: S.primary,
                color: S.primary,
              },
            }}
          >
            {/* Một icon hamburger cho cả hai trạng thái — quy ước quen thuộc
                cho nút bật/tắt menu, người dùng không phải đoán hướng mũi tên.
                Trạng thái đóng/mở vẫn được truyền cho trợ năng qua
                aria-pressed + aria-label/title ở trên. */}
            {/* md (18px) cân với nút 38×38 — sm (16px) trông lọt thỏm. */}
            <UiIcon name="menu-burger" size="md" />
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
                gap: `${NAV_ICON_GAP}px`,
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: `8px ${NAV_GROUP_PADDING_X}px`,
                borderRadius: `${RADIUS.control}px`,
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                // Đậm hơn textDisabled cũ (0.4 alpha, khó đọc) — yêu cầu người
                // dùng 2026-08-28: tiêu đề nhóm phải rõ/nổi hơn.
                color: S.textMedium,
                "&:hover": { color: S.textHigh },
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
                  {/* Cặp icon phải CÙNG HỌ. Trước đây lệch: đóng dùng
                      `caret-right` (tam giác đặc) còn mở dùng `angle-down`
                      (chevron mảnh) nên hàng nhóm nhìn lộn xộn. Chốt dùng họ
                      caret ĐẶC cho cả hai trạng thái. */}
                  <UiIcon
                    name={open ? "caret-down" : "caret-right"}
                    size="sm"
                  />
                </>
              ) : null}
            </Box>
            <Collapse in={open && !collapsed} timeout={MOTION.duration.fast}>
              <Box
                sx={{
                  display: "grid",
                  gap: 0.25,
                  pb: 0.5,
                }}
              >
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
                      sx={itemButtonSx(active, NAV_ITEM_INDENT)}
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
