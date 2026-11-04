import { captureAuthOwner } from "@/shared/store/auth-owner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { profileService } from "../services/profile.service";
import { profileKeys, type ProfilePreferences } from "../types/profile.types";
import { useAuthStore } from "@/shared/store/auth.store";
import { useInterfacePreferencesStore } from "@/shared/store/interface-preferences.store";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { useThemeStore } from "@/shared/ui/theme/theme.store";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { useT } from "@/shared/i18n/useT";
type Shortcut = Partial<Pick<ProfilePreferences, "locale" | "theme">>;
/** Topbar shortcuts persist through the same versioned account preference contract as /profile. */
export function useInterfacePreferenceShortcut() {
  const t = useT();
  const cache = useQueryClient();
  const userId = String(
    useAuthStore(
      (state) =>
        state.profile?.user_id ?? state.user?.user_id ?? state.user?.id,
    ) ?? "",
  );
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const authEpoch = useAuthStore((state) => state.authEpoch);
  return useMutation({
    onMutate: async () => {
      const isCurrent = captureAuthOwner();
      await cache.cancelQueries({ queryKey: profileKeys.preferences(userId) });
      return isCurrent;
    },
    mutationFn: async (changes: Shortcut) => {
      const isCurrent = captureAuthOwner();
      if (useAuthStore.getState().authEpoch !== authEpoch)
        throw new Error("PROFILE_OWNER_CHANGED");
      if (!authenticated || !userId) return null;
      const current =
        cache.getQueryData<ProfilePreferences>(
          profileKeys.preferences(userId),
        ) ??
        (await cache.fetchQuery({
          queryKey: profileKeys.preferences(userId),
          queryFn: profileService.getPreferences,
        }));
      if (!isCurrent()) throw new Error("PROFILE_OWNER_CHANGED");
      if (!current) throw new Error("PREFERENCES_UNAVAILABLE");
      return profileService.updatePreferences(changes, current.version);
    },
    onSuccess: async (data, changes, isCurrent) => {
      if (!isCurrent?.()) return;
      if (data) {
        await cache.cancelQueries({
          queryKey: profileKeys.preferences(userId),
        });
        if (!isCurrent()) return;
        cache.setQueryData(profileKeys.preferences(userId), data);
        useInterfacePreferencesStore.getState().apply(userId, data);
        useLanguageStore.getState().setLanguage(data.locale);
        useThemeStore.getState().setPreference(data.theme);
      } else {
        if (changes.locale)
          useLanguageStore.getState().setLanguage(changes.locale);
        if (changes.theme)
          useThemeStore.getState().setPreference(changes.theme);
      }
    },
    onError: (error, _variables, isCurrent) => {
      if (!isCurrent?.()) return;
      toast.error(getApiErrorMessage(error, t("auth.profile.updateFailed")));
      void cache.invalidateQueries({
        queryKey: profileKeys.preferences(userId),
      });
    },
  });
}
