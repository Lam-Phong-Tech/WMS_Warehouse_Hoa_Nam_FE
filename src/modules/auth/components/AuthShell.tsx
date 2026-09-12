import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Box, UiSpinner, type BoxProps } from "@/shared/ui";
import { flatIconClass } from "@/shared/ui/icons";
import {
  AUTH_BASELINE,
  COLOR,
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
import authLoginDesktop from "../assets/systemhn-auth01-desktop.jpg";
import authLoginTablet from "../assets/systemhn-auth01-tablet.jpg";
import authSessionDesktop from "../assets/systemhn-auth02-desktop.jpg";
import authSessionTablet from "../assets/systemhn-auth02-tablet.jpg";

export interface AuthShellProps {
  /** id của h1 — section aria-labelledby trỏ về đây (giữ hợp đồng a11y cũ). */
  titleId: string;
  title: ReactNode;
  subtitle: ReactNode;
  /** Text overlay loading chặn toàn màn — null/undefined = không hiện. */
  loadingText?: string | null;
  /** Chọn asset minh hoạ cột trái theo màn (mặc định "login"). */
  illustration?: AuthIllustrationVariant;
  /** Baseline chính thức chỉ tồn tại cho AUTH-01/AUTH-02 trong SystemHNWeb. */
  baselineScreen?: "login" | "session";
  children: ReactNode;
}

/** Logo Hoa Nam WMS — ô vuông bo tròn tím + wordmark, đặt trên đầu cột form
 * (đúng vị trí logo Vuexy trong login-v2). */
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
      <Box
        aria-hidden
        sx={{
          width: 34,
          height: 34,
          display: "grid",
          placeItems: "center",
          borderRadius: "8px",
          background: `linear-gradient(135deg, ${COLOR.purpleGradientStart} 0%, ${S.primary} 100%)`,
          boxShadow: `0 4px 10px ${inkAlpha(0.16)}`,
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 9.5 12 4l8 5.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1V9.5Z"
            fill={S.onPrimary}
          />
        </svg>
      </Box>
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
function BaselineAuthShell({
  titleId,
  title,
  subtitle,
  loadingText,
  screen,
  children,
}: Omit<AuthShellProps, "illustration" | "baselineScreen"> & {
  screen: "login" | "session";
}) {
  const desktopAsset =
    screen === "session" ? authSessionDesktop : authLoginDesktop;
  const tabletAsset =
    screen === "session" ? authSessionTablet : authLoginTablet;

  return (
    <Box
      component="main"
      data-auth-baseline={screen}
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
        backgroundColor: AUTH_BASELINE.surface,
        fontFamily: "var(--wms-font-family)",
        overflowX: "hidden",
        "& a": {
          color: AUTH_BASELINE.link,
          fontWeight: 600,
          textDecoration: "none",
          transition: "color var(--wms-motion-fast) var(--wms-ease-standard)",
        },
        "& a:hover": { color: AUTH_BASELINE.cta, textDecoration: "underline" },
        "& .MuiInputLabel-root": {
          color: AUTH_BASELINE.ink,
          fontSize: 14,
          fontWeight: 600,
        },
        "& .MuiOutlinedInput-root": {
          minHeight: 48,
          borderRadius: "10px",
          backgroundColor: AUTH_BASELINE.white,
          color: AUTH_BASELINE.ink,
          transition:
            "box-shadow var(--wms-motion-fast) var(--wms-ease-standard), border-color var(--wms-motion-fast) var(--wms-ease-standard)",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: AUTH_BASELINE.line },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: AUTH_BASELINE.link,
          },
          "&.Mui-focused": {
            boxShadow: `0 0 0 3px ${AUTH_BASELINE.focusRing}`,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: AUTH_BASELINE.link,
            borderWidth: "1px",
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: AUTH_BASELINE.danger,
          },
        },
        "& .MuiInputBase-input": {
          color: AUTH_BASELINE.ink,
          fontSize: 15,
          paddingTop: "12px",
          paddingBottom: "12px",
        },
        "& .MuiFormHelperText-root": {
          marginLeft: 0,
          marginTop: "5px",
          color: AUTH_BASELINE.muted,
        },
        "& .MuiFormHelperText-root.Mui-error": { color: AUTH_BASELINE.danger },
        "& .MuiCheckbox-root": { color: AUTH_BASELINE.muted },
        "& .MuiCheckbox-root.Mui-checked": { color: AUTH_BASELINE.cta },
        "& .MuiButton-containedPrimary": {
          minHeight: 48,
          borderRadius: "10px",
          backgroundColor: AUTH_BASELINE.cta,
          color: AUTH_BASELINE.white,
          boxShadow: "none",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 0,
          textTransform: "none",
          transition:
            "background-color var(--wms-motion-fast) var(--wms-ease-standard), transform var(--wms-motion-fast) var(--wms-ease-standard)",
          "&:hover": {
            backgroundColor: AUTH_BASELINE.ctaHover,
            boxShadow: "none",
            transform: "translateY(-1px)",
          },
          "&:active": { transform: "translateY(0)" },
          "&.Mui-disabled": {
            backgroundColor: AUTH_BASELINE.pale,
            color: AUTH_BASELINE.muted,
          },
        },
        "& .MuiAlert-root": {
          borderRadius: "10px",
          border: `1px solid ${AUTH_BASELINE.line}`,
          boxShadow: "none",
        },
        "& .MuiAlert-standardError": {
          color: AUTH_BASELINE.danger,
          backgroundColor: AUTH_BASELINE.surface,
          borderColor: AUTH_BASELINE.danger,
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "relative",
          minWidth: 0,
          height: { xs: 260, sm: 360, lg: "100vh" },
          minHeight: { lg: 640 },
          overflow: "hidden",
          background: `linear-gradient(135deg, ${AUTH_BASELINE.navy} 0%, ${AUTH_BASELINE.heroMid} 65%, ${AUTH_BASELINE.heroEnd} 100%)`,
        }}
      >
        <Box
          component="img"
          src={desktopAsset}
          alt=""
          sx={{
            display: { xs: "none", lg: "block" },
            position: "absolute",
            inset: 0,
            width: "200%",
            maxWidth: "none",
            height: "100%",
            objectFit: "fill",
            objectPosition: "left top",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
        <Box
          component="img"
          src={tabletAsset}
          alt=""
          sx={{
            display: { xs: "block", lg: "none" },
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            maxWidth: "none",
            height: "auto",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </Box>

      <Box
        sx={{
          minWidth: 0,
          minHeight: {
            xs: "calc(100vh - 260px)",
            sm: "calc(100vh - 360px)",
            lg: "100vh",
          },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: { xs: "28px 16px 48px", sm: "44px 40px 72px", lg: "48px" },
          backgroundColor: AUTH_BASELINE.surface,
        }}
      >
        <Box
          component="section"
          aria-labelledby={titleId}
          aria-busy={Boolean(loadingText) || undefined}
          sx={{
            position: "relative",
            width: "100%",
            maxWidth: 688,
            minHeight: { sm: 590, lg: 620 },
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: { xs: "30px 22px", sm: "42px 44px", lg: "46px 48px" },
            overflow: "hidden",
            backgroundColor: AUTH_BASELINE.white,
            border: `1px solid ${AUTH_BASELINE.line}`,
            borderRadius: "18px",
            boxShadow: AUTH_BASELINE.cardShadow,
          }}
        >
          {loadingText ? (
            <Box
              role="status"
              aria-live="polite"
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                display: "grid",
                placeItems: "center",
                padding: "24px",
                textAlign: "center",
                backgroundColor: AUTH_BASELINE.loadingMask,
                backdropFilter: "blur(2px)",
              }}
            >
              <Box>
                <UiSpinner size={32} />
                <Box sx={{ marginTop: "12px", color: AUTH_BASELINE.ink, fontSize: 15, fontWeight: 700 }}>
                  {loadingText}
                </Box>
                <Box sx={{ marginTop: "4px", color: AUTH_BASELINE.muted, fontSize: 13 }}>
                  Hoa Nam WMS
                </Box>
              </Box>
            </Box>
          ) : null}

          <Box
            sx={{
              marginBottom: "24px",
              color: AUTH_BASELINE.link,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Hoa Nam · WMS
          </Box>
          <Box
            component="h1"
            id={titleId}
            sx={{
              margin: 0,
              color: AUTH_BASELINE.ink,
              fontSize: { xs: 27, sm: 32 },
              fontWeight: 750,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </Box>
          <Box sx={{ marginTop: "8px", color: AUTH_BASELINE.muted, fontSize: 15, lineHeight: 1.55 }}>
            {subtitle}
          </Box>
          <Box sx={{ marginTop: "28px" }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}

export function AuthShell({
  titleId,
  title,
  subtitle,
  loadingText,
  illustration = "login",
  baselineScreen,
  children,
}: AuthShellProps) {
  if (baselineScreen) {
    return (
      <BaselineAuthShell
        titleId={titleId}
        title={title}
        subtitle={subtitle}
        loadingText={loadingText}
        screen={baselineScreen}
      >
        {children}
      </BaselineAuthShell>
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
