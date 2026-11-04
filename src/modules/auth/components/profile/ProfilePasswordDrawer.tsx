import { useState, type FormEvent } from "react";
import { UiAlert, UiConfirmDialog, UiDrawer, UiTextField } from "@/shared/ui";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import { resolveFormErrors } from "@/shared/api/api-error";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authService } from "../../services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";
import { captureAuthOwner } from "@/shared/store/auth-owner";
import {
  buildChangePasswordSchema,
  type ChangePasswordFormValues,
} from "../../schemas/change-password.schema";

export function ProfilePasswordDrawer({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [values, setValues] = useState<ChangePasswordFormValues>({
    currentPassword: "",
    newPassword: "",
    newPasswordConfirmation: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [discard, setDiscard] = useState(false);
  // Existing hook clears auth/cache and requires re-login: changing the password revokes every family.
  const client = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: authService.changePassword,
    onMutate: () => captureAuthOwner(),
    onSuccess: (_result, _variables, stillCurrent) => {
      if (!stillCurrent?.()) return;
      setValues({
        currentPassword: "",
        newPassword: "",
        newPasswordConfirmation: "",
      });
      client.clear();
      useAuthStore.getState().logout();
      toast.success(t("auth.changePassword.success"));
      navigate(ROUTES.LOGIN, { replace: true });
    },
  });
  const close = () => {
    if (mutation.isPending) return;
    if (Object.values(values).some(Boolean)) setDiscard(true);
    else onClose();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();

    setError("");
    const result = buildChangePasswordSchema(t).safeParse(values);
    if (!result.success) {
      const next: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        next[String(issue.path[0])] ??= issue.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await mutation.mutateAsync({
        current_password: values.currentPassword,
        new_password: values.newPassword,
        new_password_confirmation: values.newPasswordConfirmation,
      });
    } catch (cause) {
      const resolved = resolveFormErrors(cause, [
        "currentPassword",
        "newPassword",
        "newPasswordConfirmation",
      ]);
      setErrors(resolved.fieldErrors);
      setError(resolved.message || t("auth.personal.saveError"));
    }
  };
  const fields = [
    {
      key: "currentPassword" as const,
      label: t("auth.personal.currentPassword"),
      autoComplete: "current-password",
    },
    {
      key: "newPassword" as const,
      label: t("auth.personal.newPassword"),
      autoComplete: "new-password",
    },
    {
      key: "newPasswordConfirmation" as const,
      label: t("auth.personal.confirmPassword"),
      autoComplete: "new-password",
    },
  ];
  return (
    <>
      <UiDrawer
        open
        onClose={close}
        width={560}
        className="hn-personal-drawer"
        slotProps={{ paper: { role: "dialog", "aria-modal": true } }}
        title={
          <span className="hn-personal-drawer-title">
            {t("auth.personal.changePassword")}
            <ActionIconButton
              kind="close"
              label={t("auth.personal.close")}
              onClick={close}
              disabled={mutation.isPending}
            />
          </span>
        }
        actions={
          <div className="hn-personal-actions">
            <ActionButton
              kind="cancel"
              onClick={close}
              disabled={mutation.isPending}
            >
              {t("auth.personal.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              type="submit"
              form="profile-password-form"
              loading={mutation.isPending}
            >
              {t("auth.personal.changePassword")}
            </ActionButton>
          </div>
        }
      >
        <form
          id="profile-password-form"
          className="hn-personal-form"
          onSubmit={submit}
          noValidate
        >
          <p className="hn-personal-muted">{t("auth.personal.passwordHint")}</p>
          {fields.map(({ key, label, autoComplete }) => (
            <UiTextField
              key={key}
              label={label}
              required
              fullWidth
              type={revealed[key] ? "text" : "password"}
              autoComplete={autoComplete}
              value={values[key]}
              disabled={mutation.isPending}
              error={Boolean(errors[key])}
              helperText={errors[key]}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  [key]: event.target.value,
                }));
                setErrors((current) => ({ ...current, [key]: "" }));
              }}
              slotProps={{
                htmlInput: { maxLength: 128 },
                input: {
                  endAdornment: (
                    <ActionIconButton
                      kind="view"
                      label={t(
                        revealed[key]
                          ? "auth.personal.hidePassword"
                          : "auth.personal.showPassword",
                      )}
                      onClick={() =>
                        setRevealed((current) => ({
                          ...current,
                          [key]: !current[key],
                        }))
                      }
                    />
                  ),
                },
              }}
            />
          ))}
          <UiAlert tone="info">{t("auth.personal.passwordRelogin")}</UiAlert>
          {error ? <UiAlert tone="error">{error}</UiAlert> : null}
        </form>
      </UiDrawer>
      <UiConfirmDialog
        open={discard}
        title={t("auth.personal.unsavedTitle")}
        tone="danger"
        confirmText={t("auth.personal.discard")}
        cancelText={t("auth.personal.keepEditing")}
        onConfirm={onClose}
        onClose={() => setDiscard(false)}
      >
        {t("auth.personal.unsavedBody")}
      </UiConfirmDialog>
    </>
  );
}
