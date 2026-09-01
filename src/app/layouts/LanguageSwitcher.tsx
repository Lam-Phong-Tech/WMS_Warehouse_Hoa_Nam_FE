/** Chọn ngôn ngữ hiển thị (VI/EN) trên topbar. */
import { useState } from "react";
import {
  Box,
  Menu,
  MenuItem,
  ListItemText,
  SEMANTIC_LIGHT as S,
} from "@/shared/ui";
import { LANGUAGES, useLanguageStore } from "@/shared/i18n/language.store";
import { useT } from "@/shared/i18n/useT";

export function LanguageSwitcher() {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-haspopup="menu"
        aria-controls={open ? "language-menu" : undefined}
        aria-expanded={open || undefined}
        aria-label={t("topbar.language")}
        data-testid="language-switcher"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          font: "inherit",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.4,
          color: S.textHigh,
          background: "none",
          border: `1px solid ${S.border}`,
          borderRadius: 1.5,
          padding: "4px 10px",
          cursor: "pointer",
          "&:hover": { backgroundColor: S.primarySoft },
          "&:focus-visible": { outline: "none", boxShadow: S.focusRing },
        }}
      >
        {language.toUpperCase()}
      </Box>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
      >
        {LANGUAGES.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === language}
            onClick={() => {
              setLanguage(option.value);
              setAnchorEl(null);
            }}
          >
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
