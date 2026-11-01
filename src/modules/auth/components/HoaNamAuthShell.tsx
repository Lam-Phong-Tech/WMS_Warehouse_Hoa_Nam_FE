import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Box, UiSpinner } from "@/shared/ui";
import { LANGUAGES, useLanguageStore } from "@/shared/i18n/language.store";
import { useT } from "@/shared/i18n/useT";
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
  extendIllustration?: boolean;
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
  extendIllustration,
  hideRecoveryBack,
  showRecoveryBack,
  children,
}: HoaNamAuthShellProps) {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const t = useT();
  const themeMode = useThemeStore((state) => state.mode);
  const setThemePreference = useThemeStore((state) => state.setPreference);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const isDark = themeMode === "dark";

  useEffect(() => {
    if (!languageOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLanguageOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [languageOpen]);

  return (
    <Box
      component="main"
      data-auth-baseline="login"
      sx={{
        "--auth-ink": isDark ? "#edf5ff" : ink,
        "--auth-muted": isDark ? "#aec3e4" : muted,
        "--auth-panel": isDark ? "#102544" : "#fff",
        "--auth-field": isDark ? "#172f52" : "#f9fcff",
        "--auth-border": isDark ? "#45658e" : "#c9dfff",
        "--auth-note": isDark ? "#18385d" : "#ebf6ff",
        "--auth-page": isDark ? "#081a32" : "#f1fbff",
        "--auth-line": isDark ? "#385678" : "#bcd0e6",
        "--auth-link": isDark ? "#88b8ff" : blue,
        "--auth-error-bg": isDark ? "#492b3b" : "#fff1f3",
        "--auth-error-ink": isDark ? "#ffd2dc" : "#a33348",
        "--auth-alert-error-bg": isDark ? "#47283a" : "#fff0f1",
        "--auth-alert-error-border": isDark ? "#8e5067" : "#ffc0c5",
        "--auth-alert-error-ink": isDark ? "#ffd2dc" : "#b0121f",
        "--auth-alert-warning-bg": isDark ? "#4a3727" : "#fff0d9",
        "--auth-alert-warning-border": isDark ? "#8f6942" : "#ffe0a9",
        "--auth-alert-warning-ink": isDark ? "#ffd9a7" : "#a55000",
        minHeight: "100vh",
        display: "grid",
        alignContent: "start",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          xl: "minmax(0, 1fr) minmax(0, 1fr)",
        },
        background: "var(--auth-page)",
        fontFamily: "var(--wms-font-family)",
        color: "var(--auth-ink)",
        overflowX: "hidden",
        "& a": { color: "var(--auth-link)", textDecoration: "none" },
        "& a:hover": { textDecoration: "underline" },
        "& label": {
          color: "var(--auth-ink)",
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
          backgroundColor: "var(--auth-field)",
          color: "var(--auth-ink)",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--auth-border)" },
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
          color: "var(--auth-ink)",
          fontSize: { xs: 16, sm: 22, xl: 18 },
        },
        "& .MuiInputBase-input::placeholder": { color: "var(--auth-muted)", opacity: 1 },
        "& .MuiInputAdornment-root, & .MuiInputAdornment-root i": {
          color: "var(--auth-muted)",
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
          "&.Mui-disabled": { backgroundColor: isDark ? "#334969" : "#d4dfeb", color: "var(--auth-muted)" },
        },
        "& .hn-auth-note": {
          border: 0,
          borderRadius: "9px",
          backgroundColor: "var(--auth-note)",
          color: "var(--auth-ink)",
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
          backgroundColor: "var(--auth-note)",
          color: "var(--auth-link)",
          fontSize: 17,
          textTransform: "none",
          "&.Mui-disabled": { backgroundColor: "var(--auth-note)", color: "var(--auth-muted)" },
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: "relative",
          overflow: "hidden",
          minWidth: 0,
          height: { xs: "clamp(240px, 57vw, 580px)", xl: extendIllustration ? "100%" : "100vh" },
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
          background: isDark
            ? "linear-gradient(135deg, #081a32, #0d2543)"
            : "linear-gradient(135deg, #f6fdff, #effaff)",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: { xs: "calc(24px - clamp(240px, 57vw, 580px))", sm: "calc(44px - clamp(240px, 57vw, 580px))", xl: 28 },
            right: { xs: 24, sm: 28, xl: 38 },
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: "15px",
            color: { xs: "white", xl: isDark ? "#a9c9ff" : blue },
            backgroundColor: { sm: "#052b4e", xl: "transparent" },
            borderRadius: { sm: "14px", xl: 0 },
            padding: { sm: "9px 14px", xl: 0 },
            minWidth: { sm: 190, xl: 0 },
            minHeight: { sm: 72, xl: 0 },
            justifyContent: "space-between",
          }}
        >
          <Box ref={languageMenuRef} sx={{ position: "relative" }}>
            <Box
              component="button"
              type="button"
              onClick={() => setLanguageOpen((open) => !open)}
              aria-label={t("topbar.languageLabel")}
              aria-haspopup="menu"
              aria-expanded={languageOpen}
              aria-controls={languageOpen ? "auth-language-menu" : undefined}
              sx={{ display: "inline-flex", alignItems: "center", gap: "6px", border: 0,
                background: "transparent", color: "inherit", cursor: "pointer", fontSize: 18,
                lineHeight: 1, padding: 0 }}
            >
              <span>{language.toUpperCase()}</span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"
                style={{ flex: "0 0 16px", transform: languageOpen ? "rotate(180deg)" : undefined }}>
                <path d="m3.5 6 4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Box>
            {languageOpen && (
              <Box
                id="auth-language-menu"
                role="menu"
                aria-label={t("topbar.languageLabel")}
                sx={{ position: "absolute", top: "calc(100% + 12px)", right: 0, zIndex: 5,
                  minWidth: 190, padding: "6px", border: "1px solid var(--auth-border)", borderRadius: "12px",
                  backgroundColor: "var(--auth-panel)", color: "var(--auth-ink)",
                  boxShadow: isDark ? "0 14px 30px rgba(0,0,0,.4)" : "0 14px 30px rgba(28,85,132,.2)" }}
              >
                {LANGUAGES.map(({ value, label }) => (
                  <Box key={value} component="button" type="button" role="menuitemradio" aria-checked={language === value}
                    onClick={() => { setLanguage(value); setLanguageOpen(false); }}
                    sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                      width: "100%", border: 0, borderRadius: "8px", padding: "10px 12px", textAlign: "left",
                      backgroundColor: language === value ? "var(--auth-note)" : "transparent",
                      color: "inherit", cursor: "pointer", fontSize: 15, whiteSpace: "nowrap",
                      "&:hover": { backgroundColor: "var(--auth-note)" } }}>
                    {label}<span aria-hidden="true">{language === value ? "✓" : ""}</span>
                  </Box>
                ))}
              </Box>
            )}
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
            border: "1px solid var(--auth-border)",
            backgroundColor: "var(--auth-panel)",
            boxShadow: isDark ? "0 15px 38px rgba(0,0,0,.28)" : "0 15px 38px rgba(28, 85, 132, .11)",
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
                backgroundColor: isDark ? "rgba(16,37,68,.9)" : "rgba(255,255,255,.88)",
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
                  {t("auth.forgotPassword.backToLogin")}
                </Link>
              )}
              {recoveryStep && <Box sx={{ color: "var(--auth-link)", fontSize: { xs: 16, sm: 18 }, marginBottom: "7px" }}>
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
                  color: "var(--auth-ink)",
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
                  color: "var(--auth-muted)",
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
            color: "var(--auth-muted)",
            "&::before, &::after": {
              content: '""',
              height: "1px",
              flex: 1,
              backgroundColor: "var(--auth-line)",
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
            {language === "vi" ? "Hệ thống quản lý kho" : language === "zh" ? "仓库管理系统" : "Warehouse management system"}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
