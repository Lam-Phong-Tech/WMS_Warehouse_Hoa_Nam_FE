import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Box, UiSpinner, type BoxProps } from "@/shared/ui";
import { flatIconClass } from "@/shared/ui/icons";
import {
  RADIUS,
  SEMANTIC_LIGHT as S,
  Z_INDEX,
  inkAlpha,
  inkAlphaVar,
} from "@/shared/ui/tokens";
import {
  AuthIllustration,
  type AuthIllustrationVariant,
} from "./AuthIllustration";
import authMaskLight from "../assets/auth-v2-mask-light.png";
import { HoaNamAuthShell } from "./HoaNamAuthShell";
import { BrandMark } from "@/shared/ui/BrandMark";

export interface AuthShellProps {
  /** id của h1 — section aria-labelledby trỏ về đây (giữ hợp đồng a11y cũ). */
  titleId: string;
  title: ReactNode;
  subtitle: ReactNode;
  /** Text overlay loading chặn toàn màn — null/undefined = không hiện. */
  loadingText?: string | null;
  /** Chọn asset minh hoạ cột trái theo màn (mặc định "login"). */
  illustration?: AuthIllustrationVariant;
  /** Shared Hoa Nam reference layout for login and work-session confirmation. */
  baselineScreen?: "login" | "session";
  showBaselineHeading?: boolean;
  recoveryStep?: string;
  extendIllustration?: boolean;
  hideRecoveryBack?: boolean;
  showRecoveryBack?: boolean;
  children: ReactNode;
}

/** Shared Hoa Nam mark and wordmark on the non-baseline auth screens. */
function AuthBrand() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "22px",
      }}
    >
      <BrandMark size={34} aria-hidden="true" />
      <Box
        sx={{
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: "0.15px",
          color: S.textStrong,
        }}
      >
        Hoa Nam{" "}
        <Box component="span" sx={{ color: S.primary }}>
          WMS
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Vỏ các màn auth (Login / ChangePassword / ForgotPassword) — bố cục login-v2
 * của Vuexy: hai cột trên desktop (minh hoạ trái + form phải), gộp về một cột
 * form căn giữa trên mobile. Nền trắng toàn màn, panel minh hoạ nền canvas bo
 * góc 20px như baseline.
 */
export function AuthShell({
  titleId,
  title,
  subtitle,
  loadingText,
  illustration = "login",
  baselineScreen,
  showBaselineHeading,
  recoveryStep,
  extendIllustration,
  hideRecoveryBack,
  showRecoveryBack,
  children,
}: AuthShellProps) {
  if (baselineScreen) {
    return (
      <HoaNamAuthShell
        screen={baselineScreen}
        titleId={titleId}
        title={title}
        subtitle={subtitle}
        loadingText={loadingText}
        showHeading={showBaselineHeading ?? true}
        recoveryStep={recoveryStep}
        extendIllustration={extendIllustration}
        hideRecoveryBack={hideRecoveryBack}
        showRecoveryBack={showRecoveryBack}
      >
        {children}
      </HoaNamAuthShell>
    );
  }
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "stretch",
        backgroundColor: S.bgSurface,
        // Vuexy login-v2: 32px padding quanh khung, hai panel sát nhau (không
        // gap — khoảng trắng quanh form đến từ việc căn giữa trong cột phải).
        padding: { xs: 0, lg: "32px" },
      }}
    >
      {loadingText ? (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: Z_INDEX.blockingLoading,
            display: "grid",
            placeItems: "center",
            backgroundColor: inkAlpha(0.38),
          }}
        >
          <Box
            sx={{
              minWidth: 280,
              padding: "18px 20px",
              textAlign: "center",
              backgroundColor: S.bgSurface,
              borderRadius: `${RADIUS.card}px`,
              boxShadow: S.shadowFloating,
            }}
          >
            <UiSpinner size={32} />
            <Box
              sx={{
                display: "block",
                marginTop: "12px",
                fontWeight: 600,
                color: S.textHigh,
              }}
            >
              {loadingText}
            </Box>
            <Box
              sx={{
                display: "block",
                marginTop: "4px",
                fontSize: 12,
                color: S.textMedium,
              }}
            >
              Hoa Nam WMS
            </Box>
          </Box>
        </Box>
      ) : null}

      {/* Cột minh hoạ — 7/12 như Vuexy, chỉ hiện từ lg trở lên (mobile giấu). */}
      <Box
        aria-hidden
        sx={{
          display: { xs: "none", lg: "flex" },
          flex: "0 0 58.333%",
          maxWidth: "58.333%",
          position: "relative",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px",
          borderRadius: "20px",
          backgroundColor: S.bgCanvas,
        }}
      >
        {/* Mask cong đáy panel — đúng asset auth-v2-mask của Vuexy. */}
        <Box
          component="img"
          src={authMaskLight}
          alt=""
          aria-hidden
          sx={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: "auto",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        {/* Nhân vật + thẻ số liệu, nằm trên mask (đặt trước cột form). */}
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <AuthIllustration variant={illustration} />
        </Box>
      </Box>

      {/* Cột form — 5/12 còn lại, form căn giữa trong cột (như Vuexy). */}
      <Box
        sx={{
          flex: "1 1 auto",
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: { xs: "24px 16px 32px", sm: "40px 24px", lg: "24px" },
        }}
      >
        <Box
          component="section"
          aria-labelledby={titleId}
          sx={{ width: "100%", maxWidth: 400 }}
        >
          <AuthBrand />

          <Box
            component="h1"
            id={titleId}
            sx={{
              // Vuexy login-v2: 26px / 500 / lineHeight 36 / màu ink 78%.
              margin: 0,
              color: inkAlphaVar(0.78),
              fontSize: 26,
              fontWeight: 500,
              lineHeight: "36px",
            }}
          >
            {title}
          </Box>
          <Box
            sx={{ marginTop: "6px", color: inkAlphaVar(0.68), fontSize: 15 }}
          >
            {subtitle}
          </Box>

          <Box sx={{ marginTop: "24px", "& a": { color: S.primary } }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** Link "Quay lại đăng nhập" căn giữa + mũi tên trái — như Vuexy login-v2. */
export function AuthBackLink({ children }: { children: ReactNode }) {
  return (
    <Box
      className="hn-auth-back-link"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        "& a": {
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          color: S.primary,
          fontSize: 15,
        },
        "& i": { fontSize: 15, display: "inline-flex" },
      }}
    >
      <Link to="/login">
        <i className={flatIconClass("angle-small-left")} aria-hidden />
        {children}
      </Link>
    </Box>
  );
}

/** Khối ghi chú viền đứt dưới form auth — thay `.hn-login-note`. */
export function AuthNote({
  children,
  sx,
}: {
  children: ReactNode;
  sx?: BoxProps["sx"];
}) {
  return (
    <Box
      className="hn-auth-note"
      sx={[
        {
          marginTop: "14px",
          padding: "9px 11px",
          border: `1px dashed ${S.border}`,
          borderRadius: `${RADIUS.control}px`,
          backgroundColor: S.bgSubtle,
          color: S.textMedium,
          fontSize: 11.5,
          "& a": { color: S.primary },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}
