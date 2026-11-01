import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import QRCode from "qrcode";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import {
  MFA_STATUS_QUERY_KEY,
  type MfaEnrollment,
  type MfaStatus,
} from "@/modules/auth/types/mfa.types";
import { Box, UiAlert, UiButton, UiCard, UiTextField } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { ROUTES } from "@/shared/constants/routes";
import "@/shared/ui/sku-aligned-settings.css";
import "./mfa-setup-page.css";

function errorMessageOf(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string" &&
      data.message.trim() !== ""
    ) {
      return data.message;
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * WWHN-SEC-08 — màn tự đăng ký xác thực hai bước.
 *
 * BA QUYẾT ĐỊNH GIAO DIỆN ĐÁNG GHI LẠI:
 *
 * 1. QR được tạo ngay trong trình duyệt bằng thư viện trong bundle. Không gửi
 *    `otpauth://` chứa bí mật TOTP tới dịch vụ tạo ảnh bên ngoài.
 *
 * 2. Mã khôi phục nằm trong state của component và KHÔNG được ghi vào
 *    localStorage/sessionStorage. Lưu lại "cho tiện" là biến 8 chìa khoá dự
 *    phòng thành 8 chuỗi nằm sẵn trên máy — đúng thứ mà XSS tìm.
 *
 * 3. Sau khi bật thành công, trạng thái được invalidate để mọi nơi khác trong
 *    app (banner nhắc đăng ký) cập nhật ngay, thay vì hiển thị dữ liệu cũ tới
 *    lần F5 kế tiếp.
 */
export function MfaSetupPage() {
  const t = useT();
  const queryClient = useQueryClient();

  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [qrCode, setQrCode] = useState<{ uri: string; dataUrl: string } | null>(
    null,
  );
  const [qrErrorUri, setQrErrorUri] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    const uri = enrollment?.otpauth_uri;
    if (!uri?.startsWith("otpauth://")) return;

    let cancelled = false;
    QRCode.toDataURL(uri, { width: 220, margin: 2 })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrCode({ uri, dataUrl });
          setQrErrorUri(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCode(null);
          setQrErrorUri(uri);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enrollment?.otpauth_uri]);

  const status = useQuery<MfaStatus>({
    queryKey: MFA_STATUS_QUERY_KEY,
    queryFn: () => authService.mfaStatus(),
  });

  const enroll = useMutation({
    mutationFn: () => authService.mfaEnroll(),
    onSuccess: (data) => {
      setQrCode(null);
      setQrErrorUri(null);
      setEnrollment(data);
    },
    onError: () => {},
  });

  const confirm = useMutation({
    mutationFn: (value: string) => authService.mfaConfirm(value),
    onSuccess: (data) => {
      queryClient.setQueryData<MfaStatus>(MFA_STATUS_QUERY_KEY, (previous) => ({
        enabled: true,
        pending: false,
        required_for_role: previous?.required_for_role ?? false,
        enforced: previous?.enforced ?? false,
        must_enroll_now: false,
        recovery_codes_remaining: data.recovery_codes.length,
      }));
      setRecoveryCodes(data.recovery_codes);
      setEnrollment(null);
      setQrCode(null);
      setQrErrorUri(null);
      setCode("");
      toast.success(t("auth.mfa.enableSuccess"));
      void queryClient.invalidateQueries({ queryKey: MFA_STATUS_QUERY_KEY });
    },
    onError: () => {},
  });

  const onConfirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.trim() === "") return;
    confirm.mutate(code.trim());
  };

  const actionError = enroll.isError
    ? errorMessageOf(enroll.error, t("auth.mfa.errorTitle"))
    : confirm.isError
      ? errorMessageOf(confirm.error, t("auth.mfa.errorTitle"))
      : null;
  const isEnabled = status.data?.enabled === true || recoveryCodes !== null;

  return (
    <Box className="hn-settings-screen hn-mfa-screen">
      <header className="hn-mfa-header">
        <div>
          <Link className="hn-mfa-back-link" to={ROUTES.PROFILE}>
            <span aria-hidden="true">←</span>
            {t("auth.mfa.backToProfile")}
          </Link>
          <p className="hn-mfa-eyebrow">{t("auth.mfa.eyebrow")}</p>
          <h1>{t("auth.mfa.setupTitle")}</h1>
          <p className="hn-mfa-subtitle">{t("auth.mfa.setupSubtitle")}</p>
        </div>
        <span
          className="hn-mfa-status"
          data-state={
            isEnabled ? "enabled" : enrollment !== null ? "pending" : "disabled"
          }
        >
          <span className="hn-mfa-status-dot" aria-hidden="true" />
          {isEnabled
            ? t("auth.mfa.statusEnabled")
            : enrollment !== null
              ? t("auth.mfa.statusPending")
              : t("auth.mfa.statusDisabled")}
        </span>
      </header>

      {status.data?.must_enroll_now === true && (
        <UiAlert tone="warning" title={t("auth.mfa.setupTitle")}>
          {t("auth.mfa.requiredForRole")}
        </UiAlert>
      )}
      {actionError && (
        <UiAlert tone="error" title={t("auth.mfa.errorTitle")}>
          {actionError}
        </UiAlert>
      )}

      {isEnabled && recoveryCodes === null && (
        <UiCard className="hn-settings-card hn-mfa-result-card">
          <UiAlert tone="success" title={t("auth.mfa.statusEnabled")}>
            {t("auth.mfa.recoveryRemaining", {
              count: String(status.data?.recovery_codes_remaining ?? 0),
            })}
          </UiAlert>
        </UiCard>
      )}

      {/* Mã khôi phục — hiển thị đúng MỘT LẦN, ngay sau khi bật. */}
      {recoveryCodes !== null && (
        <UiCard className="hn-settings-card hn-mfa-result-card">
          <UiAlert tone="warning" title={t("auth.mfa.recoveryTitle")}>
            {t("auth.mfa.recoveryHelp")}
          </UiAlert>
          <ul className="hn-mfa-recovery-list">
            {recoveryCodes.map((recoveryCode) => (
              <li key={recoveryCode}>{recoveryCode}</li>
            ))}
          </ul>
        </UiCard>
      )}

      {!isEnabled && enrollment === null && (
        <UiCard className="hn-settings-card hn-mfa-intro-card">
          <div className="hn-mfa-intro-copy">
            <span className="hn-mfa-section-label">
              {t("auth.mfa.introLabel")}
            </span>
            <h2>{t("auth.mfa.introTitle")}</h2>
            <p>{t("auth.mfa.introHelp")}</p>
            <UiButton
              className="hn-settings-primary hn-mfa-start-button"
              onClick={() => enroll.mutate()}
              loading={enroll.isPending}
              disabled={enroll.isPending}
            >
              {t("auth.mfa.startEnroll")}
            </UiButton>
          </div>
          <ol className="hn-mfa-intro-steps">
            <li>
              <span>1</span>
              {t("auth.mfa.step1")}
            </li>
            <li>
              <span>2</span>
              {t("auth.mfa.step2")}
            </li>
          </ol>
        </UiCard>
      )}

      {enrollment !== null && (
        <div className="hn-mfa-setup-grid">
          <UiCard className="hn-settings-card hn-mfa-setup-card">
            <div className="hn-mfa-card-heading">
              <span className="hn-mfa-step-number">1</span>
              <div>
                <h2>{t("auth.mfa.scanTitle")}</h2>
                <p>{t("auth.mfa.step1")}</p>
              </div>
            </div>
            <div className="hn-mfa-qr-stage">
              {qrCode?.uri === enrollment.otpauth_uri ? (
                <img
                  src={qrCode.dataUrl}
                  alt={t("auth.mfa.qrCodeAlt")}
                  width={220}
                  height={220}
                />
              ) : qrErrorUri === enrollment.otpauth_uri ? (
                <span>{t("auth.mfa.qrErrorTitle")}</span>
              ) : (
                <span>{t("auth.mfa.qrLoading")}</span>
              )}
            </div>
            {qrErrorUri === enrollment.otpauth_uri && (
              <UiAlert tone="warning" title={t("auth.mfa.qrErrorTitle")}>
                {t("auth.mfa.qrErrorHelp")}
              </UiAlert>
            )}
            <div className="hn-mfa-manual-key">
              <span className="hn-mfa-manual-label">
                {t("auth.mfa.manualKeyLabel")}
              </span>
              <code>{enrollment.secret}</code>
              <span className="hn-mfa-manual-hint">
                {t("auth.mfa.manualKeyHint")}
              </span>
            </div>
            {enrollment.otpauth_uri.startsWith("otpauth://") && (
              <a className="hn-mfa-app-link" href={enrollment.otpauth_uri}>
                {t("auth.mfa.openApp")}
              </a>
            )}
          </UiCard>

          <UiCard className="hn-settings-card hn-mfa-setup-card hn-mfa-verify-card">
            <div className="hn-mfa-card-heading">
              <span className="hn-mfa-step-number">2</span>
              <div>
                <h2>{t("auth.mfa.verifyTitle")}</h2>
                <p>{t("auth.mfa.step2")}</p>
              </div>
            </div>
            <form
              className="hn-mfa-confirm-form"
              onSubmit={onConfirm}
              noValidate
            >
              <UiTextField
                label={t("auth.mfa.codeLabel")}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                disabled={confirm.isPending}
                fullWidth
              />
              <UiButton
                className="hn-settings-primary"
                type="submit"
                loading={confirm.isPending}
                disabled={confirm.isPending || code.trim() === ""}
              >
                {t("auth.mfa.confirmSubmit")}
              </UiButton>
            </form>
          </UiCard>
        </div>
      )}
    </Box>
  );
}

export default MfaSetupPage;
