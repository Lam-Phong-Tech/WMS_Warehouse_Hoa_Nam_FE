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
import authSessionDesktop from "../assets/systemhn-auth02-desktop.jpg";

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
  showBaselineHeading?: boolean;
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
  showBaselineHeading = false,
  children,
}: Omit<AuthShellProps, "illustration" | "baselineScreen"> & {
  screen: "login" | "session";
}) {
  const desktopAsset =
    screen === "session" ? authSessionDesktop : authLoginDesktop;

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
        "& .hn-auth-sr-only": {
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        },
        "& .MuiInputLabel-root": {
          color: AUTH_BASELINE.ink,
          fontSize: 14,
          fontWeight: 600,
        },
        "& label": {
          fontSize: { xs: 14, sm: 15 },
          fontWeight: 700,
        },
        "& .MuiOutlinedInput-root": {
          minHeight: { xs: 52, sm: 60 },
          borderRadius: "10px",
          backgroundColor: "#F8FCFE",
          color: AUTH_BASELINE.ink,
          transition:
            "box-shadow var(--wms-motion-fast) var(--wms-ease-standard), border-color var(--wms-motion-fast) var(--wms-ease-standard)",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: AUTH_BASELINE.line,
          },
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
          fontSize: { xs: 15, sm: 16 },
          paddingTop: "10px",
          paddingBottom: "10px",
        },
        "& .MuiFormHelperText-root": {
          marginLeft: 0,
          marginTop: "5px",
          color: AUTH_BASELINE.muted,
        },
        "& .MuiFormHelperText-root.Mui-error": { color: AUTH_BASELINE.danger },
        "& .MuiCheckbox-root": { color: AUTH_BASELINE.muted },
        "& .MuiCheckbox-root.Mui-checked": { color: AUTH_BASELINE.cta },
        "& .MuiButton-contained": {
          minHeight: { xs: 52, sm: 62 },
          borderRadius: "10px",
          backgroundColor: AUTH_BASELINE.cta,
          color: AUTH_BASELINE.white,
          boxShadow: "none",
          fontSize: { xs: 16, sm: 18 },
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
        "& .hn-auth-back-link a": { color: AUTH_BASELINE.link },
        "& .hn-auth-note": {
          border: "none",
          borderRadius: "12px",
          backgroundColor: AUTH_BASELINE.pale,
          color: AUTH_BASELINE.muted,
          padding: { xs: "14px 16px", sm: "16px 18px" },
          fontSize: { xs: 13, sm: 15 },
        },
        "& .hn-auth-primary-cta": {
          position: "relative",
          "&::after": {
            content: '"→"',
            position: "absolute",
            right: { xs: 18, sm: 26 },
            fontSize: { xs: 22, sm: 28 },
            fontWeight: 400,
            lineHeight: 1,
          },
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "relative",
          minWidth: 0,
          height: { xs: "clamp(350px, 50.5vw, 728px)", lg: "100vh" },
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
          src={desktopAsset}
          alt=""
          sx={{
            display: { xs: "block", lg: "none" },
            position: "absolute",
            top: 0,
            left: 0,
            // The tablet reference is a full composed screen (including a static
            // form). Crop the desktop source to its left hero so the real,
            // interactive card below is never duplicated on narrow screens.
            width: "200%",
            maxWidth: "none",
            height: "auto",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </Box>

      <Box
        sx={{
          position: "relative",
          minWidth: 0,
          minHeight: {
            xs: "auto",
            sm: "auto",
            lg: "100vh",
          },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: { xs: "0 16px 48px", sm: "0 40px 72px", lg: "48px" },
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
            maxWidth: 600,
            marginTop: { xs: "-56px", lg: 0 },
            minHeight: { lg: 548 },
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            transform: { lg: "translateY(-10px)" },
            padding: { xs: "30px 22px", sm: "38px 36px", lg: "40px 38px" },
            overflow: "hidden",
            backgroundColor: AUTH_BASELINE.white,
            border: `1px solid ${AUTH_BASELINE.line}`,
            borderRadius: "16px",
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
                <Box
                  sx={{
                    marginTop: "12px",
                    color: AUTH_BASELINE.ink,
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {loadingText}
                </Box>
                <Box
                  sx={{
                    marginTop: "4px",
                    color: AUTH_BASELINE.muted,
                    fontSize: 13,
                  }}
                >
                  Hoa Nam WMS
                </Box>
              </Box>
            </Box>
          ) : null}

          {showBaselineHeading ? (
            <>
              <Box
                component="h1"
                id={titleId}
                sx={{
                  margin: 0,
                  color: AUTH_BASELINE.ink,
                  fontSize: { xs: 24, sm: 30 },
                  fontWeight: 800,
                  lineHeight: 1.2,
                }}
              >
                {title}
              </Box>
              <Box
                sx={{
                  marginTop: "8px",
                  marginBottom: { xs: "24px", sm: "28px" },
                  color: AUTH_BASELINE.muted,
                  fontSize: { xs: 14, sm: 16 },
                  lineHeight: 1.5,
                }}
              >
                {subtitle}
              </Box>
            </>
          ) : (
            <>
              <Box component="h1" id={titleId} className="hn-auth-sr-only">
                {title}
              </Box>
              <Box className="hn-auth-sr-only">{subtitle}</Box>
            </>
          )}
          {children}
        </Box>
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            right: { xs: 16, sm: 40, lg: 48 },
            bottom: { xs: 22, sm: 32, lg: 64 },
            left: { xs: 16, sm: 40, lg: 48 },
            display: "flex",
            alignItems: "center",
            gap: { xs: "12px", sm: "18px" },
            color: AUTH_BASELINE.muted,
            "&::before, &::after": {
              content: '""',
              height: "1px",
              flex: 1,
              backgroundColor: AUTH_BASELINE.line,
            },
          }}
        >
          <Box
            sx={{
              flex: "0 0 auto",
              textAlign: "center",
              fontSize: { xs: 9, sm: 12 },
              fontWeight: 700,
              letterSpacing: "0.02em",
              lineHeight: 1.5,
            }}
          >
            <Box>HOA NAM SCANNER</Box>
            <Box sx={{ fontWeight: 500 }}>
              KẾT NỐI CON NGƯỜI - VẬN HÀNH HIỆU QUẢ
            </Box>
          </Box>
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
  showBaselineHeading,
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
        showBaselineHeading={showBaselineHeading}
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
