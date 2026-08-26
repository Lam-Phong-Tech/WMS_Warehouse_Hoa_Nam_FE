import type { ReactNode } from "react";
import { Link } from "react-router-dom";
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
    <div
      data-testid="pv-public-layout"
      style={{
        minHeight: "100vh",
        background: "#f6f5f1",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          background: "#fff",
          borderBottom: "2px solid #2b2b2b",
          padding: "12px clamp(12px, 4vw, 32px)",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            to={ROUTES.PV_CATALOG}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#2b2b2b",
              textDecoration: "none",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                background: "#2b2b2b",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
              }}
            >
              HN
            </span>
            <span>
              <span
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "clamp(15px, 2.4vw, 18px)",
                  lineHeight: 1.2,
                }}
              >
                Hoa Nam · Danh mục sản phẩm
              </span>
              <span
                style={{ display: "block", fontSize: 12, color: "#7a766c" }}
              >
                Trang công khai · chỉ xem
              </span>
            </span>
          </Link>
          {actions}
        </div>
      </header>

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 1280,
          margin: "0 auto",
          padding: "clamp(12px, 3vw, 24px) clamp(12px, 4vw, 32px) 40px",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(18px, 3.2vw, 24px)",
            fontWeight: 700,
            margin: "0 0 4px",
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <div
            style={{ color: "#7a766c", fontSize: 13, marginBottom: 16 }}
            data-testid="pv-page-subtitle"
          >
            {subtitle}
          </div>
        ) : (
          <div style={{ marginBottom: 16 }} />
        )}
        {children}
      </main>

      <footer
        style={{
          borderTop: "1px solid #e2ded3",
          padding: "12px clamp(12px, 4vw, 32px)",
          fontSize: 12,
          color: "#8c887e",
          textAlign: "center",
        }}
      >
        Số lượng hiển thị là tồn khả dụng của kho tổng, chỉ mang tính tham khảo.
      </footer>
    </div>
  );
}
