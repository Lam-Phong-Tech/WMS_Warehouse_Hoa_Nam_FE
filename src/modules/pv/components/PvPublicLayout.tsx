import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Box } from "@/shared/ui";
import { RADIUS, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { ROUTES } from "@/shared/constants/routes";

export interface PvPublicLayoutProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * WWHN-252 — khung của App PV công khai (SCR-PV-01/02).
 *
 * Cố ý KHÔNG dùng lại MainLayout: MainLayout nằm dưới ProtectedRoute, đọc
 * auth store để dựng sidebar/menu theo permission và điều hướng sang /login khi
 * chưa đăng nhập. Người xem App PV là actor ẩn danh (SRS §3) nên khung của họ
 * không được chứa bất kỳ affordance nội bộ nào — kể cả menu bị ẩn.
 *
 * Bố cục responsive theo NFR-SRS-006 (mobile >= 360px, tablet >= 768px,
 * desktop >= 1280px) bằng clamp/grid tự xuống dòng, không dùng breakpoint JS.
 */
export function PvPublicLayout({
  title,
  subtitle,
  actions,
  children,
}: PvPublicLayoutProps) {
  return (
    <Box
      data-testid="pv-public-layout"
      sx={{
        minHeight: "100vh",
        backgroundColor: S.bgCanvas,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        component="header"
        sx={{
          backgroundColor: S.bgSurface,
          borderBottom: `1px solid ${S.border}`,
          padding: "12px clamp(12px, 4vw, 32px)",
        }}
      >
        <Box
          sx={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box
            component={Link}
            to={ROUTES.PV_CATALOG}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: S.textHigh,
              textDecoration: "none",
            }}
          >
            <Box
              component="span"
              aria-hidden
              sx={{
                width: 34,
                height: 34,
                borderRadius: `${RADIUS.control}px`,
                backgroundColor: S.primary,
                color: S.onPrimary,
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
              }}
            >
              HN
            </Box>
            <Box component="span">
              <Box
                component="span"
                sx={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "clamp(15px, 2.4vw, 18px)",
                  lineHeight: 1.2,
                }}
              >
                Hoa Nam · Danh mục sản phẩm
              </Box>
              <Box
                component="span"
                sx={{ display: "block", fontSize: 12, color: S.textMedium }}
              >
                Trang công khai · chỉ xem
              </Box>
            </Box>
          </Box>
          {actions}
        </Box>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1280,
          margin: "0 auto",
          padding: "clamp(12px, 3vw, 24px) clamp(12px, 4vw, 32px) 40px",
        }}
      >
        <Box
          component="h1"
          sx={{
            fontSize: "clamp(18px, 3.2vw, 24px)",
            fontWeight: 700,
            color: S.textHigh,
            margin: "0 0 4px",
          }}
        >
          {title}
        </Box>
        {subtitle ? (
          <Box
            sx={{ color: S.textMedium, fontSize: 13, marginBottom: "16px" }}
            data-testid="pv-page-subtitle"
          >
            {subtitle}
          </Box>
        ) : (
          <Box sx={{ marginBottom: "16px" }} />
        )}
        {children}
      </Box>

      <Box
        component="footer"
        sx={{
          borderTop: `1px solid ${S.divider}`,
          padding: "12px clamp(12px, 4vw, 32px)",
          fontSize: 12,
          color: S.textDisabled,
          textAlign: "center",
        }}
      >
        Số lượng hiển thị là tồn khả dụng của kho tổng, chỉ mang tính tham khảo.
      </Box>
    </Box>
  );
}
