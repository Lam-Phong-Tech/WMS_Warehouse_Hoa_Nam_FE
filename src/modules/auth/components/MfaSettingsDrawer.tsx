import { captureAuthOwner } from "@/shared/store/auth-owner";
import { useMfaRecoveryStore } from "@/shared/store/mfa-recovery.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UiAlert, UiDrawer, UiTextField, useUiConfirm } from "@/shared/ui";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { authService } from "../services/auth.service";
import { MFA_STATUS_QUERY_KEY } from "../types/mfa.types";
import { MfaSetupPage } from "../pages/MfaSetupPage";
import "./mfa-settings-drawer.css";

export function MfaSettingsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const epoch = useAuthStore((state) => state.authEpoch);
  const userId = String(
    useAuthStore(
      (state) =>
        state.profile?.user_id ?? state.user?.user_id ?? state.user?.id,
    ) ?? "",
  );

  const { confirm, confirmDialog } = useUiConfirm();
  const status = useQuery({
    queryKey: [...MFA_STATUS_QUERY_KEY, userId, epoch],
    queryFn: () => authService.mfaStatus(),
    enabled: open,
  });
  const codesAvailable = useMfaRecoveryStore(
    (state) =>
      state.ownerEpoch === epoch &&
      state.ownerUserId === userId &&
      state.codes !== null,
  );
  const [disableOpen, setDisableOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [setupPending, setSetupPending] = useState(false);
  const busy = pending || setupPending;
  const [error, setError] = useState("");
  const required = Boolean(
    status.data?.enforced && status.data.required_for_role,
  );
  async function close() {
    if (busy) return;
    const isCurrent = captureAuthOwner();
    const recovery = useMfaRecoveryStore.getState();
    const hasOwnedCodes =
      recovery.ownerEpoch === epoch &&
      recovery.ownerUserId === userId &&
      recovery.codes !== null;
    if (
      hasOwnedCodes &&
      !(await confirm({
        title: t("auth.mfa.recoveryTitle"),
        content: t("auth.mfa.recoveryHelp"),
        confirmText: t("auth.personal.mfaCodesSaved"),
        cancelText: t("auth.personal.mfaKeepCodes"),
        tone: "primary",
      }))
    )
      return;
    if (!isCurrent()) return;
    if (hasOwnedCodes) useMfaRecoveryStore.getState().clear();
    setDisableOpen(false);
    setPassword("");
    setCode("");
    setError("");
    onClose();
  }
  async function disable() {
    if (pending || required) return;
    if (
      !password ||
      !/^(?:\d{6}|[A-Z0-9]{5}-[A-Z0-9]{5})$/i.test(code.trim())
    ) {
      setError(t("auth.personal.mfaCodeInvalid"));
      return;
    }
    setPending(true);
    setError("");
    const isCurrent = captureAuthOwner();
    try {
      await authService.mfaDisable(password, code.trim());
      if (!isCurrent()) return;
      setPassword("");
      setCode("");
      setDisableOpen(false);
      await queryClient.invalidateQueries({ queryKey: MFA_STATUS_QUERY_KEY });
      toast.success(t("auth.mfa.disableSuccess"));
    } catch (cause) {
      setError(getApiErrorMessage(cause, t("auth.mfa.errorTitle")));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <UiDrawer
        className="hn-mfa-settings-drawer"
        open={open}
        width={640}
        slotProps={{ paper: { role: "dialog", "aria-modal": true } }}
        onClose={() => void close()}
        title={
          <span className="hn-mfa-drawer-heading">
            {t("auth.mfa.setupTitle")}
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              disabled={busy}
              onClick={() => void close()}
            />
          </span>
        }
        actions={
          <div className="hn-mfa-drawer-actions">
            <ActionButton
              kind="close"
              disabled={busy}
              onClick={() => void close()}
            >
              {t("common.close")}
            </ActionButton>
          </div>
        }
      >
        {open ? (
          <>
            {status.isLoading ? (
              <p role="status">{t("auth.mfa.statusLoading")}</p>
            ) : status.isError ? (
              <UiAlert
                tone="error"
                action={
                  <ActionButton
                    kind="refresh"
                    onClick={() => void status.refetch()}
                  >
                    {t("common.retry")}
                  </ActionButton>
                }
              >
                {t("auth.mfa.statusLoadError")}
              </UiAlert>
            ) : (
              <>
                <MfaSetupPage embedded onPendingChange={setSetupPending} />
                {status.data?.enabled && !codesAvailable ? (
                  <section className="hn-mfa-disable-section">
                    {required ? (
                      <UiAlert tone="info">
                        {t("auth.personal.mfaRequired")}
                      </UiAlert>
                    ) : !disableOpen ? (
                      <ActionButton
                        kind="deactivate"
                        onClick={() => setDisableOpen(true)}
                      >
                        {t("auth.mfa.disableTitle")}
                      </ActionButton>
                    ) : (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void disable();
                        }}
                      >
                        <h3>{t("auth.mfa.disableTitle")}</h3>
                        <p>{t("auth.mfa.disableHelp")}</p>
                        {error ? <UiAlert tone="error">{error}</UiAlert> : null}
                        <UiTextField
                          type="password"
                          autoComplete="current-password"
                          label={t("auth.personal.mfaDisablePassword")}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                          disabled={pending}
                          fullWidth
                        />
                        <UiTextField
                          label={t("auth.personal.mfaDisableCode")}
                          value={code}
                          onChange={(event) =>
                            setCode(
                              event.target.value
                                .replace(/[^a-z0-9-]/gi, "")
                                .slice(0, 11),
                            )
                          }
                          slotProps={{
                            htmlInput: {
                              autoComplete: "one-time-code",
                              maxLength: 11,
                            },
                          }}
                          required
                          disabled={pending}
                          fullWidth
                        />
                        <div className="hn-mfa-drawer-actions">
                          <ActionButton
                            kind="cancel"
                            disabled={pending}
                            onClick={() => {
                              setDisableOpen(false);
                              setPassword("");
                              setCode("");
                              setError("");
                            }}
                          >
                            {t("auth.personal.cancel")}
                          </ActionButton>
                          <ActionButton
                            kind="deactivate"
                            type="submit"
                            disabled={pending}
                          >
                            {t("auth.mfa.disableSubmit")}
                          </ActionButton>
                        </div>
                      </form>
                    )}
                  </section>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </UiDrawer>
      {confirmDialog}
    </>
  );
}
