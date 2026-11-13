import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate } from "react-router-dom";
import { useChangePassword } from "@/modules/auth/hooks/use-change-password";
import {
  buildChangePasswordSchema,
  NEW_PASSWORD_MAX_LENGTH,
  type ChangePasswordFormValues,
} from "@/modules/auth/schemas/change-password.schema";
import { PASSWORD_MAX_LENGTH } from "@/modules/auth/schemas/login.schema";
import { Box, UiAlert, UiButton } from "@/shared/ui";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { AuthField } from "@/modules/auth/components/AuthField";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import { useT } from "@/shared/i18n/useT";
import { resolveFormErrors } from "@/shared/api/api-error";

const PASSWORD_FORM_FIELDS = [
  "currentPassword",
  "newPassword",
  "newPasswordConfirmation",
] as const;

export function ChangePasswordPage() {
  const t = useT();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const changePassword = useChangePassword();
  const changePasswordSchema = useMemo(
    () => buildChangePasswordSchema(t, user ?? undefined),
    [t, user],
  );
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    getFieldState,
    trigger,
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      newPasswordConfirmation: "",
    },
  });

  useEffect(() => {
    const invalidFields = PASSWORD_FORM_FIELDS.filter((field) => {
      const error = getFieldState(field).error;
      return error && error.type !== "server";
    });
    if (invalidFields.length) void trigger(invalidFields);
  }, [t, getFieldState, trigger]);

  const onSubmit = handleSubmit((values) =>
    changePassword.mutate({
      current_password: values.currentPassword,
      new_password: values.newPassword,
      new_password_confirmation: values.newPasswordConfirmation,
    }),
  );

  // Lỗi 422 của BE có kèm `errors.<field>` — đặt ngay dưới ô tương ứng. Banner
  // chỉ giữ lại phần không gắn được vào ô nào để tránh lặp thông tin.
  const serverError = useMemo(
    () =>
      changePassword.isError
        ? resolveFormErrors(changePassword.error, PASSWORD_FORM_FIELDS)
        : null,
    // t changes when the active dictionary/locale changes; resolveFormErrors reads that locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [changePassword.error, changePassword.isError, t],
  );

  useEffect(() => {
    if (!serverError) return;
    clearErrors(PASSWORD_FORM_FIELDS);
    for (const [field, message] of Object.entries(serverError.fieldErrors)) {
      setError(field as keyof ChangePasswordFormValues, {
        type: "server",
        message,
      });
    }
  }, [clearErrors, serverError, setError]);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return (
    <AuthShell
      titleId="change-password-title"
      baselineScreen="login"
      showBaselineHeading
      title={t("auth.changePassword.title")}
      subtitle={
        user?.password_expired
          ? t("auth.changePassword.expiredSubtitle")
          : t("auth.changePassword.subtitle")
      }
      loadingText={
        changePassword.isPending ? t("auth.changePassword.updating") : null
      }
    >
      {serverError?.message && (
        <Box sx={{ marginBottom: "14px" }}>
          <UiAlert tone="error" title={t("auth.changePassword.errorTitle")}>
            {serverError.message}
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
            maxLength={PASSWORD_MAX_LENGTH}
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
            maxLength={NEW_PASSWORD_MAX_LENGTH}
            disabled={changePassword.isPending}
          />

          <AuthField
            control={control}
            name="newPasswordConfirmation"
            label={t("auth.fields.confirmNewPassword")}
            placeholder={t("auth.fields.confirmNewPasswordPlaceholder")}
            type="password"
            startIcon="lock"
            maxLength={NEW_PASSWORD_MAX_LENGTH}
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
    </AuthShell>
  );
}
