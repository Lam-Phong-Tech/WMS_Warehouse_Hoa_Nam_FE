import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Box, UiSpinner } from "@/shared/ui";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { useThemeStore } from "@/shared/ui/theme/theme.store";
import desktopReference from "../assets/hoanam-auth-reference-desktop.png";
import tabletReference from "../assets/hoanam-auth-reference-tablet.png";

interface HoaNamAuthShellProps {
  titleId: string;
  title: ReactNode;
  subtitle: ReactNode;
  loadingText?: string | null;
  showHeading?: boolean;
  recoveryStep?: string;
  hideRecoveryBack?: boolean;
  showRecoveryBack?: boolean;
  children: ReactNode;
}

const blue = "#0069f5";
const ink = "#071c57";
const muted = "#657db3";

export function HoaNamAuthShell({
  titleId,
  title,
  subtitle,
  loadingText,
  showHeading = true,
  recoveryStep,
  hideRecoveryBack,
  showRecoveryBack,
  children,
}: HoaNamAuthShellProps) {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const themeMode = useThemeStore((state) => state.mode);
  const setThemePreference = useThemeStore((state) => state.setPreference);

  return (
    <Box
      component="main"
      data-auth-baseline="login"
      sx={{
        minHeight: "100vh",
        display: "grid",
        alignContent: "start",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          xl: "minmax(0, 1fr) minmax(0, 1fr)",
        },
        background: "#f1fbff",
        fontFamily: "var(--wms-font-family)",
        color: ink,
        overflowX: "hidden",
        "& a": { color: blue, textDecoration: "none" },
        "& a:hover": { textDecoration: "underline" },
        "& label": {
          color: ink,
          fontWeight: 700,
          fontSize: { xs: 15, sm: 22, xl: 17 },
        },
        "&& .MuiOutlinedInput-root": {
          height: {
            xs: "54px !important",
            sm: "80px !important",
            xl: "62px !important",
          },
          borderRadius: "9px",
          backgroundColor: "#f9fcff",
          color: ink,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#c9dfff" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: blue },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: blue,
            borderWidth: "2px",
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: "#f32637",
          },
        },
        "& .MuiInputBase-input": {
          color: ink,
          fontSize: { xs: 16, sm: 22, xl: 18 },
        },
        "& .MuiInputBase-input::placeholder": { color: muted, opacity: 1 },
        "& .MuiInputAdornment-root, & .MuiInputAdornment-root i": {
          color: muted,
          fontSize: 22,
        },
        "& .MuiFormHelperText-root": { marginLeft: 0, marginTop: "5px" },
        "& .MuiFormHelperText-root.Mui-error": { color: "#ed1426" },
        "& .MuiButton-contained": {
          minHeight: { xs: 56, sm: 74, xl: 64 },
          borderRadius: "9px",
          backgroundColor: blue,
          color: "white",
          boxShadow: "none",
          fontSize: { xs: 17, sm: 25, xl: 20 },
          fontWeight: 700,
          textTransform: "none",
          "&:hover": { backgroundColor: "#0056df", boxShadow: "none" },
          "&.Mui-disabled": { backgroundColor: "#d4dfeb", color: muted },
        },
        "& .hn-auth-note": {
          border: 0,
          borderRadius: "9px",
          backgroundColor: "#ebf6ff",
          color: ink,
          padding: "17px 20px",
        },
        "& .hn-auth-primary-cta": { position: "relative" },
        "& .hn-auth-primary-cta::after": {
          content: '"→"',
          position: "absolute",
          right: 24,
          fontSize: 28,
          fontWeight: 400,
        },
        "& .hn-auth-resend": {
          minHeight: 62,
          borderRadius: "9px",
          backgroundColor: "#ecf3f9",
          color: blue,
          fontSize: 17,
          textTransform: "none",
          "&.Mui-disabled": { backgroundColor: "#ecf3f9", color: "#96a9ce" },
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: "relative",
          overflow: "hidden",
          minWidth: 0,
          height: { xs: "clamp(240px, 57vw, 580px)", xl: "100vh" },
          minHeight: { xl: 650 },
          backgroundColor: "#07395e",
        }}
      >
        <Box
          component="img"
          src={desktopReference}
          alt=""
          sx={{
            display: { xs: "block", sm: "none", xl: "block" },
            position: "absolute",
            inset: 0,
            width: "200%",
            maxWidth: "none",
            height: "100%",
            objectFit: "fill",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <Box
          component="img"
          src={tabletReference}
          alt=""
          sx={{
            display: { xs: "none", sm: "block", xl: "none" },
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            maxWidth: "none",
            height: "auto",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      </Box>

      <Box
        sx={{
          position: "relative",
          minWidth: 0,
          minHeight: { xs: "auto", xl: "100vh" },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: { xs: "flex-start", xl: "center" },
          padding: {
            xs: "0 22px 26px",
            sm: "0 50px 34px",
            xl: "96px 48px 80px",
          },
          background: "linear-gradient(135deg, #f6fdff, #effaff)",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: { xs: "-215px", sm: "-510px", xl: 28 },
            right: { xs: 24, sm: 50, xl: 38 },
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: "15px",
            opacity: { xs: 1, sm: 0, xl: 1 },
            color: { xs: "white", xl: blue },
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => setLanguage(language === "vi" ? "en" : "vi")}
            aria-label={
              language === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"
            }
            sx={{
              border: 0,
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: 18,
              padding: 0,
            }}
          >
            {language.toUpperCase()}⌄
          </Box>
          <Box
            sx={{
              width: "1px",
              height: 30,
              backgroundColor: "currentColor",
              opacity: 0.25,
            }}
          />
          <Box
            component="button"
            type="button"
            onClick={() =>
              setThemePreference(themeMode === "light" ? "dark" : "light")
            }
            aria-label={
              themeMode === "light" ? "Bật giao diện tối" : "Bật giao diện sáng"
            }
            sx={{
              border: 0,
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: 30,
              lineHeight: 1,
              padding: 0,
            }}
          >
            {themeMode === "light" ? "☼" : "☾"}
          </Box>
        </Box>

        <Box
          component="section"
          aria-labelledby={titleId}
          aria-busy={Boolean(loadingText) || undefined}
          sx={{
            position: "relative",
            width: "100%",
            maxWidth: { xs: 620, sm: 824, xl: 620 },
            minHeight: { xl: recoveryStep ? 636 : undefined },
            marginTop: { xs: "-30px", sm: "-45px", xl: 0 },
            padding: { xs: "30px 23px", sm: "46px 62px", xl: "40px" },
            borderRadius: "16px",
            border: "1px solid #cce2ff",
            backgroundColor: "#fff",
            boxShadow: "0 15px 38px rgba(28, 85, 132, .11)",
            "& form [data-busy]": recoveryStep
              ? { gap: { xl: "34px" } }
              : undefined,
          }}
        >
          {loadingText && (
            <Box
              role="status"
              aria-live="polite"
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 3,
                display: "grid",
                placeItems: "center",
                borderRadius: "inherit",
                backgroundColor: "rgba(255,255,255,.88)",
              }}
            >
              <Box sx={{ textAlign: "center", fontWeight: 700 }}>
                <UiSpinner size={32} />
                <Box sx={{ mt: 1 }}>{loadingText}</Box>
              </Box>
            </Box>
          )}

          {(recoveryStep || showRecoveryBack) && (
            <>
              {!hideRecoveryBack && (
                <Link
                  to="/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 14,
                    fontSize: 17,
                    marginBottom: 30,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ fontSize: 27, lineHeight: 1 }}
                  >
                    ←
                  </span>
                  {language === "vi" ? "Quay lại đăng nhập" : "Back to sign in"}
                </Link>
              )}
              {recoveryStep && <Box sx={{ color: blue, fontSize: { xs: 16, sm: 18 }, marginBottom: "7px" }}>
                {recoveryStep}
              </Box>}
            </>
          )}
          {showHeading ? (
            <>
              <Box
                component="h1"
                id={titleId}
                sx={{
                  margin: 0,
                  fontSize: { xs: 32, sm: 50, xl: 40 },
                  lineHeight: 1.15,
                  fontWeight: 800,
                  color: ink,
                }}
              >
                {title}
              </Box>
              <Box
                sx={{
                  mt: "6px",
                  mb: {
                    xs: "24px",
                    sm: "46px",
                    xl: recoveryStep ? "75px" : "30px",
                  },
                  color: muted,
                  fontSize: { xs: 16, sm: 23, xl: 19 },
                  lineHeight: 1.45,
                }}
              >
                {subtitle}
              </Box>
            </>
          ) : (
            <>
              <Box
                component="h1"
                id={titleId}
                sx={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0,0,0,0)",
                }}
              >
                {title}
              </Box>
            </>
          )}
          {children}
        </Box>
        <Box
          aria-hidden="true"
          sx={{
            width: { xs: "100%", xl: "calc(100% - 96px)" },
            maxWidth: 750,
            display: "flex",
            alignItems: "center",
            gap: 20,
            mt: { xs: "60px", sm: "130px", xl: 0 },
            position: { xl: "absolute" },
            bottom: { xl: 42 },
            color: muted,
            "&::before, &::after": {
              content: '""',
              height: "1px",
              flex: 1,
              backgroundColor: "#bcd0e6",
            },
          }}
        >
          <Box
            sx={{
              flex: "0 0 auto",
              textAlign: "center",
              fontSize: { xs: 12, sm: 14 },
            }}
          >
            Hoa Nam WMS ·{" "}
            {language === "vi"
              ? "Hệ thống quản lý kho"
              : "Warehouse management system"}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
