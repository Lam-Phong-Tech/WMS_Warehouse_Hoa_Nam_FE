import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { profileService } from "@/modules/auth/services/profile.service";
import { profileKeys } from "@/modules/auth/types/profile.types";
import { useAuthStore } from "@/shared/store/auth.store";
import { useInterfacePreferencesStore } from "@/shared/store/interface-preferences.store";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { useThemeStore } from "@/shared/ui/theme/theme.store";
import { personalAccent } from "@/shared/ui/tokens";
import "./account-preferences.css";

export function AccountPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const token = useAuthStore((state) => state.token);
  const userId = String(
    useAuthStore(
      (state) =>
        state.profile?.user_id ?? state.user?.user_id ?? state.user?.id,
    ) ?? "",
  );
  const preferences = useQuery({
    queryKey: profileKeys.preferences(userId),
    queryFn: () => profileService.getPreferences(),
    enabled: Boolean(token && userId),
    retry: 1,
  });
  const owner = useInterfacePreferencesStore((state) => state.ownerUserId);
  const current = useInterfacePreferencesStore((state) => state.preferences);
  const mode = useThemeStore((state) => state.mode);
  useEffect(
    () => () => {
      useInterfacePreferencesStore.getState().clear();
      const root = document.documentElement;
      for (const key of [
        "--ops-primary",
        "--ops-primary-hover",
        "--ops-link",
        "--ops-pale",
        "--ops-table-header",
      ])
        root.style.removeProperty(key);
      delete root.dataset.accountAccent;
      delete root.dataset.accountFontSize;
      delete root.dataset.accountDensity;
      delete root.dataset.accountReducedMotion;
    },
    [],
  );
  useEffect(() => {
    if (!token || !userId || (owner !== null && owner !== userId))
      useInterfacePreferencesStore.getState().clear();
  }, [token, userId, owner]);
  useEffect(() => {
    if (!token || !userId || !preferences.data) return;
    const applied = useInterfacePreferencesStore.getState();
    if (
      applied.ownerUserId === userId &&
      applied.preferences &&
      (applied.preferences.version ?? 0) > preferences.data.version
    )
      return;
    useInterfacePreferencesStore.getState().apply(userId, preferences.data);
    useLanguageStore.getState().setLanguage(preferences.data.locale);
    useThemeStore.getState().setPreference(preferences.data.theme);
  }, [token, userId, preferences.data]);
  useEffect(() => {
    const root = document.documentElement;
    const active = owner === userId && token ? current : null;
    const accent = personalAccent(mode, active?.accent ?? "ocean");
    root.dataset.accountAccent = active?.accent ?? "ocean";
    root.dataset.accountFontSize = active?.font_size ?? "medium";
    root.dataset.accountDensity = active?.density ?? "comfortable";
    root.dataset.accountReducedMotion = String(active?.reduced_motion ?? false);
    if (active?.accent && active.accent !== "ocean") {
      root.style.setProperty("--ops-primary", accent.primary);
      root.style.setProperty("--ops-primary-hover", accent.primaryHover);
      root.style.setProperty("--ops-link", accent.link);
      root.style.setProperty("--ops-pale", accent.pale);
      root.style.setProperty("--ops-table-header", accent.tableHeader);
    } else
      for (const key of [
        "--ops-primary",
        "--ops-primary-hover",
        "--ops-link",
        "--ops-pale",
        "--ops-table-header",
      ])
        root.style.removeProperty(key);
  }, [current, mode, owner, userId, token]);
  return children;
}
