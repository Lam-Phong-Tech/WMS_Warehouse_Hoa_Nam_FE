/**
 * Header trang dùng chung của shell — cùng khối với sidebar/topbar, áp cho MỌI
 * màn trong `MainLayout` thay vì mỗi màn tự dựng một kiểu tiêu đề.
 *
 * Cấu trúc bám đúng bản demo đã chốt (10.WMS_Hoa_Nam_Trang_Tong_Quan.html):
 * eyebrow → h1 → mô tả ở cột trái, chip ngữ cảnh ở cột phải.
 *
 * MỌI chuỗi đều lấy từ dữ liệu có thật, không bịa:
 *  · eyebrow  = tên NHÓM menu của route hiện tại (`getBreadcrumbTrail`).
 *  · title/mô tả = `resolveScreenMeta` (SCREEN_META theo ?screen= → ROUTE_META).
 *  · chip phạm vi / vai trò = bối cảnh đang chọn ở ContextSwitcher
 *    (`auth.currentContext`), tức đúng thứ quyết định dữ liệu người dùng thấy.
 *
 * Màn nào tự dựng header riêng (Tổng quan vận hành và RPT-07 là hai bản port
 * 1:1 từ mockup) thì `MainLayout` không render component này để tránh hai tiêu
 * đề chồng nhau — danh sách nằm ở `ROUTES_WITH_OWN_HEADER`.
 */
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Box, Stack, UiStatusBadge, SEMANTIC_LIGHT as S } from "@/shared/ui";
import { TYPOGRAPHY } from "@/shared/ui/tokens";
import {
  DEFAULT_SCREEN_BY_PATH,
  SCREEN_META,
  getBreadcrumbTrail,
  normalizeScreen,
  resolveScreenMeta,
  UNKNOWN_SCREEN_META,
} from "@/app/layouts/nav-data";
import { localizeScreenMeta, useNavLabel } from "@/shared/i18n/nav-labels";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { IAM_SCOPE_LABELS } from "@/shared/constants/business-labels";
import { useAuthStore } from "@/shared/store/auth.store";

/** Nhãn phạm vi dữ liệu theo `scope_type` của bối cảnh đang chọn. */
function scopeLabelOf(
  context: {
    scope_type: string;
    org_unit_name: string | null;
    department_name: string | null;
    warehouse_name: string | null;
  } | null,
): string | null {
  if (!context) return null;
  if (context.warehouse_name) return context.warehouse_name;
  if (context.scope_type === "phong_ban" && context.department_name) {
    return context.department_name;
  }
  if (context.scope_type === "co_so" && context.org_unit_name) {
    return context.org_unit_name;
  }
  // "Toàn hệ thống" / "System-wide" — map song ngữ đọc tại thời điểm render.
  if (context.scope_type === "he_thong") return IAM_SCOPE_LABELS.SYSTEM;
  return context.org_unit_name;
}

/** screen-id đã resolve theo đúng thứ tự của `resolveScreenMeta`. */
function resolveScreenId(pathname: string, search: string): string | null {
  const requested = normalizeScreen(new URLSearchParams(search).get("screen"));
  if (requested && SCREEN_META[requested]) return requested;
  const fallback = DEFAULT_SCREEN_BY_PATH[pathname];
  if (fallback && SCREEN_META[fallback]) return fallback;
  return null;
}

export function AppPageHeader({ actions }: { actions?: ReactNode }) {
  const location = useLocation();
  const navLabel = useNavLabel();
  const language = useLanguageStore((s) => s.language);
  const context = useAuthStore((s) => s.currentContext);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  const meta = localizeScreenMeta(
    language,
    resolveScreenMeta(location.pathname, location.search),
    resolveScreenId(location.pathname, location.search),
  );
  const trail = getBreadcrumbTrail(location.pathname);
  // Chặng giữa của breadcrumb là tên nhóm menu; route không thuộc nhóm nào
  // (403/404/hồ sơ…) thì không có eyebrow thay vì bịa ra một cụm chữ.
  const groupEntry = trail.length >= 3 ? trail[1] : null;
  const eyebrow = groupEntry
    ? (groupEntry.i18nKey
        ? navLabel(groupEntry.i18nKey, groupEntry.label)
        : groupEntry.label
      ).toUpperCase()
    : null;

  const scopeLabel = scopeLabelOf(context);
  const roleLabel = isSuperAdmin ? "Super Admin" : (context?.role_name ?? null);

  // Route chưa khai báo tiêu đề (vd 404 khớp mọi đường dẫn): không dựng header
  // rỗng nghĩa, để chính trang tự nói nó là gì.
  if (meta === UNKNOWN_SCREEN_META) return null;

  const contextBadges =
    scopeLabel || roleLabel ? (
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
      >
        {scopeLabel ? (
          <UiStatusBadge tone="primary" label={scopeLabel} />
        ) : null}
        {roleLabel ? <UiStatusBadge tone="neutral" label={roleLabel} /> : null}
      </Stack>
    ) : null;

  return (
    <Box
      component="section"
      aria-labelledby="hn-page-title"
      sx={{
        display: "flex",
        alignItems: {
          xs: "flex-start",
          md: actions ? "flex-start" : "flex-end",
        },
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Box
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: S.primaryDark,
            }}
          >
            {eyebrow}
          </Box>
        ) : null}
        <Box
          component="h1"
          id="hn-page-title"
          sx={{
            m: 0,
            mt: eyebrow ? 0.25 : 0,
            fontSize: { xs: 20, md: 24 },
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.025em",
            color: S.textHigh,
          }}
        >
          {meta.title}
        </Box>
        <Box
          sx={{
            mt: 0.5,
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            lineHeight: 1.45,
            color: S.textMedium,
          }}
        >
          {meta.description}
        </Box>
      </Box>
      {actions ? (
        <Stack
          spacing={1.5}
          sx={{
            alignItems: "flex-end",
            minWidth: 0,
            maxWidth: "100%",
            ml: "auto",
          }}
        >
          {contextBadges}
          {actions}
        </Stack>
      ) : (
        contextBadges
      )}
    </Box>
  );
}
