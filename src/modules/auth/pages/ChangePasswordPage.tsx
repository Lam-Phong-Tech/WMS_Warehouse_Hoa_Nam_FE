import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useChangePassword } from "@/modules/auth/hooks/use-change-password";
import {
  buildChangePasswordSchema,
  type ChangePasswordFormValues,
} from "@/modules/auth/schemas/change-password.schema";
import { Box, UiAlert, UiButton } from "@/shared/ui";
import { AuthShell, AuthNote } from "@/modules/auth/components/AuthShell";
import { AuthField } from "@/modules/auth/components/AuthField";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import { useT } from "@/shared/i18n/useT";

export function ChangePasswordPage() {
  const t = useT();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const changePassword = useChangePassword();
  const changePasswordSchema = useMemo(() => buildChangePasswordSchema(t), [t]);
  const { control, handleSubmit, setError } = useForm<ChangePasswordFormValues>(
    {
      resolver: zodResolver(changePasswordSchema),
      defaultValues: {
        currentPassword: "",
        newPassword: "",
        newPasswordConfirmation: "",
      },
    },
  );

  const onSubmit = handleSubmit((values) =>
    changePassword.mutate({
      current_password: values.currentPassword,
      new_password: values.newPassword,
      new_password_confirmation: values.newPasswordConfirmation,
    }),
  );

  const errorMessage = changePassword.isError
    ? isAxiosError(changePassword.error)
      ? (changePassword.error.response?.data?.message ??
        t("auth.changePassword.failed"))
      : t("auth.changePassword.failed")
    : null;

  useEffect(() => {
    if (!errorMessage) return;
    if (/mật khẩu hiện tại/i.test(errorMessage)) {
      setError("currentPassword", { type: "server", message: errorMessage });
    }
  }, [errorMessage, setError]);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return (
    <AuthShell
      titleId="change-password-title"
      baselineScreen="login"
      showBaselineHeading
      title={t("auth.changePassword.title")}
      subtitle={t("auth.changePassword.subtitle")}
      loadingText={
        changePassword.isPending ? t("auth.changePassword.updating") : null
      }
    >
      {errorMessage && !/mật khẩu hiện tại/i.test(errorMessage) && (
        <Box sx={{ marginBottom: "14px" }}>
          <UiAlert tone="error" title={t("auth.changePassword.errorTitle")}>
            {errorMessage}
          </UiAlert>
        </Box>
      )}

      <form onSubmit={onSubmit} noValidate>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: { xs: "20px", sm: "22px" },
          }}
        >
          <AuthField
            control={control}
            name="currentPassword"
            label={t("auth.changePassword.currentPassword")}
            placeholder={t("auth.changePassword.currentPasswordPlaceholder")}
            type="password"
            startIcon="lock"
            autoFocus
            disabled={changePassword.isPending}
          />

          <AuthField
            control={control}
            name="newPassword"
            label={t("auth.fields.newPassword")}
            placeholder={t("auth.fields.newPasswordPlaceholder")}
            type="password"
            startIcon="lock"
            disabled={changePassword.isPending}
          />

          <AuthField
            control={control}
            name="newPasswordConfirmation"
            label={t("auth.fields.confirmNewPassword")}
            placeholder={t("auth.fields.confirmNewPasswordPlaceholder")}
            type="password"
            startIcon="lock"
            disabled={changePassword.isPending}
          />

          <UiButton
            className="hn-auth-primary-cta"
            loading={changePassword.isPending}
            disabled={changePassword.isPending}
            type="submit"
            fullWidth
          >
            {t("auth.changePassword.submit")}
          </UiButton>
        </Box>
      </form>

      <AuthNote>{t("auth.changePassword.note")}</AuthNote>
    </AuthShell>
  );
}
