import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { UiText } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { profileService } from "../services/profile.service";
import { profileKeys } from "../types/profile.types";
import { resolvePreferredHomepage } from "../utils/preferred-homepage";
export function AccountLandingPage() {
  const t = useT();
  const userId = String(
    useAuthStore(
      (state) =>
        state.profile?.user_id ?? state.user?.user_id ?? state.user?.id,
    ) ?? "",
  );
  const permissions = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const preferences = useQuery({
    queryKey: profileKeys.preferences(userId),
    queryFn: () => profileService.getPreferences(),
    enabled: Boolean(userId),
    retry: 1,
  });
  if (preferences.isLoading)
    return (
      <div role="status">
        <UiText>{t("common.loadingData")}</UiText>
      </div>
    );
  return (
    <Navigate
      to={resolvePreferredHomepage(
        preferences.data?.default_homepage,
        permissions,
        isSuperAdmin,
      )}
      replace
    />
  );
}
