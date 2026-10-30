import { AUTH_BASELINE } from "@/shared/ui/tokens";

/** Applied only to the login/recovery forms, never to shared fields elsewhere. */
export const AUTH_UAT_FORM_SX = {
  display: "flex", flexDirection: "column", gap: { xs: "16px", sm: "18px" },
  "&& label[for]": { color: AUTH_BASELINE.ink, fontWeight: 700 },
  "&& .MuiOutlinedInput-root.Mui-error .MuiInputAdornment-positionStart": {
    color: AUTH_BASELINE.danger,
    "& i": { color: "inherit" },
  },
  "&& .MuiFormHelperText-root.Mui-error": {
    display: "flex", alignItems: "flex-start", gap: "5px",
    "&::before": {
      content: '""', flex: "0 0 12px", width: 12, height: 12, marginTop: "3px",
      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='6.25' fill='none' stroke='%23B54155' stroke-width='1.3'/%3E%3Cpath d='M8 7v4M8 4.5v.5' stroke='%23B54155' stroke-width='1.3' stroke-linecap='round'/%3E%3C/svg%3E\")",
    },
  },
  "&[data-busy='true'] .MuiOutlinedInput-root.Mui-disabled": { backgroundColor: "#F8FCFE" },
  "&[data-busy='true'] .MuiInputBase-input.Mui-disabled": {
    WebkitTextFillColor: AUTH_BASELINE.ink, opacity: 1,
  },
  "&& .MuiButton-contained.Mui-disabled[aria-busy='true']": {
    backgroundColor: AUTH_BASELINE.cta, color: AUTH_BASELINE.white,
    "& .MuiCircularProgress-root": { color: "inherit" },
  },
  "& a:focus-visible, & button:focus-visible": {
    outline: `3px solid ${AUTH_BASELINE.focusRing}`, outlineOffset: 3,
  },
} as const;
