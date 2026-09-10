import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { authService } from "@/modules/auth/services/auth.service";
import type { MfaEnrollment, MfaStatus } from "@/modules/auth/types/mfa.types";
import { Box, UiAlert, UiButton, UiTextField } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";

const MFA_STATUS_QUERY_KEY = ["auth", "mfa", "status"] as const;

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
 * 1. QR dựng bằng một service ảnh NGOÀI thì tiện — và cũng có nghĩa là gửi
 *    `otpauth://` chứa BÍ MẬT TOTP sang máy chủ của người khác. Ở đây không
 *    dùng ảnh ngoài: bí mật hiển thị dạng chữ để người dùng dán vào ứng dụng
 *    xác thực, kèm liên kết `otpauth://` để mở thẳng app trên chính thiết bị đó.
 *    Muốn có QR thật thì phải render CỤC BỘ (thư viện qr trong bundle), không
 *    bao giờ bằng URL của bên thứ ba.
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
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");

  const status = useQuery<MfaStatus>({
    queryKey: MFA_STATUS_QUERY_KEY,
    queryFn: () => authService.mfaStatus(),
  });

  const enroll = useMutation({
    mutationFn: () => authService.mfaEnroll(),
    onSuccess: (data) => setEnrollment(data),
    onError: () => {},
  });

  const confirm = useMutation({
    mutationFn: (value: string) => authService.mfaConfirm(value),
    onSuccess: (data) => {
      setRecoveryCodes(data.recovery_codes);
      setEnrollment(null);
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

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        maxWidth: 640,
      }}
    >
      <Box>
        <h1 style={{ margin: 0 }}>{t("auth.mfa.setupTitle")}</h1>
        <p style={{ marginTop: 8 }}>{t("auth.mfa.setupSubtitle")}</p>
      </Box>

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

      {status.data?.enabled === true && recoveryCodes === null && (
        <UiAlert tone="success" title={t("auth.mfa.statusEnabled")}>
          {t("auth.mfa.recoveryRemaining", {
            count: String(status.data.recovery_codes_remaining),
          })}
        </UiAlert>
      )}

      {/* Mã khôi phục — hiển thị đúng MỘT LẦN, ngay sau khi bật. */}
      {recoveryCodes !== null && (
        <Box>
          <UiAlert tone="warning" title={t("auth.mfa.recoveryTitle")}>
            {t("auth.mfa.recoveryHelp")}
          </UiAlert>
          <Box
            component="ul"
            sx={{
              marginTop: "12px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "8px",
              listStyle: "none",
              padding: 0,
              fontFamily: "monospace",
            }}
          >
            {recoveryCodes.map((recoveryCode) => (
              <li key={recoveryCode}>{recoveryCode}</li>
            ))}
          </Box>
        </Box>
      )}

      {status.data?.enabled !== true && enrollment === null && (
        <Box>
          <UiButton
            onClick={() => enroll.mutate()}
            loading={enroll.isPending}
            disabled={enroll.isPending}
          >
            {t("auth.mfa.startEnroll")}
          </UiButton>
        </Box>
      )}

      {enrollment !== null && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ margin: 0 }}>{t("auth.mfa.step1")}</p>
          <p style={{ margin: 0 }}>{t("auth.mfa.step2")}</p>

          <Box>
            <div>{t("auth.mfa.manualKeyLabel")}</div>
            <code
              style={{
                display: "inline-block",
                marginTop: 4,
                padding: "6px 10px",
                fontSize: 16,
                letterSpacing: 1,
                wordBreak: "break-all",
              }}
            >
              {enrollment.secret}
            </code>
          </Box>

          {/* Liên kết otpauth:// mở thẳng ứng dụng xác thực khi người dùng đang
              đứng trên CHÍNH thiết bị đó. Không bao giờ gửi chuỗi này ra ngoài.
              Chỉ chấp nhận đúng scheme otpauth: — đây là URL do server trả về
              được gắn vào href, mọi scheme khác (javascript:, http:...) bị bỏ,
              người dùng vẫn còn mã thủ công ở trên. */}
          {enrollment.otpauth_uri.startsWith("otpauth://") ? (
            <a href={enrollment.otpauth_uri}>{t("auth.mfa.startEnroll")}</a>
          ) : null}

          <form onSubmit={onConfirm} noValidate>
            <Box sx={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
              <UiTextField
                label={t("auth.mfa.codeLabel")}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                disabled={confirm.isPending}
              />
              <UiButton
                type="submit"
                loading={confirm.isPending}
                disabled={confirm.isPending || code.trim() === ""}
              >
                {t("auth.mfa.confirmSubmit")}
              </UiButton>
            </Box>
          </form>
        </Box>
      )}
    </Box>
  );
}

export default MfaSetupPage;
