import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useLogin, useMfaVerify } from "@/modules/auth/hooks/use-login";
import {
  buildLoginSchema,
  toLoginRequest,
  type LoginFormValues,
} from "@/modules/auth/schemas/login.schema";
import { Box, UiAlert, UiButton, UiTextField } from "@/shared/ui";
import { flatIconClass } from "@/shared/ui/icons";
import { AUTH_BASELINE } from "@/shared/ui/tokens";
import { AuthShell } from "@/modules/auth/components/AuthShell";
import { AuthField } from "@/modules/auth/components/AuthField";
import { OFFLINE_MUTATION_CODE } from "@/shared/pwa/offline-policy";
import { backendProbeOf } from "@/shared/api/backend-availability";
import { transportDiagnosticOf } from "@/shared/api/transport-monitor";
import { useBackendWait } from "@/shared/hooks/useBackendWait";
import { DASHBOARD_CANONICAL, ROUTES } from "@/shared/constants/routes";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { runtimeConfig } from "@/shared/config/env";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * "Ghi nhớ đăng nhập": chỉ lưu identifier (KHÔNG BAO GIỜ lưu mật khẩu) để
 * prefill lần sau; storage bị chặn (private mode) thì bỏ qua trong im lặng.
 */
const REMEMBER_STORAGE_KEY = "hn-wms.login.remember-identifier";

function readRememberedIdentifier(): string {
  try {
    return window.localStorage.getItem(REMEMBER_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistRememberedIdentifier(identifier: string | null): void {
  try {
    if (identifier === null) {
      window.localStorage.removeItem(REMEMBER_STORAGE_KEY);
    } else {
      window.localStorage.setItem(REMEMBER_STORAGE_KEY, identifier.trim());
    }
  } catch {
    // tiện ích phụ — không chặn đăng nhập
  }
}

function getLoginErrorMessage(error: unknown, t: TranslateFn): string {
  if (isAxiosError(error)) {
    const status = error.response?.status;

    // Gateway báo ứng dụng chưa phục vụ được (đang khởi động lại, bảo trì) — kể cả
    // sau khi đã tự chờ (shared/api/backend-availability). Dùng câu theo ngôn ngữ
    // giao diện thay vì body của gateway (nginx: tiếng Việt cố định; Laravel bảo
    // trì: "Service Unavailable").
    if (status === 502 || status === 503) {
      return t("auth.login.errorServerUnavailable");
    }
    if (status === 504) {
      return t("auth.login.errorTimeout");
    }

    const responseData = error.response?.data;
    if (
      responseData &&
      typeof responseData === "object" &&
      "message" in responseData &&
      typeof responseData.message === "string" &&
      responseData.message.trim() !== ""
    ) {
      return responseData.message;
    }

    if (!error.response) {
      // WWHN-325: guard offline chặn mutation ngay tại axios (không có
      // response); phải hiển thị đúng thông điệp khóa ghi ngoại tuyến thay vì
      // báo lỗi kết nối chung chung khiến người dùng tưởng BE hỏng.
      if (error.code === OFFLINE_MUTATION_CODE) {
        return error.message;
      }
      if (error.code === "ECONNABORTED") {
        return t("auth.login.errorTimeout");
      }
      // Đã dò /health mà vẫn không được: nói đúng điều dò thấy thay vì mặc định đổ
      // cho mạng của người dùng (ticket 10/09: mạng không lỗi, backend đang dựng lại).
      const probe = backendProbeOf(error);
      if (probe === "unavailable") {
        return t("auth.login.errorServerUnavailable");
      }
      if (probe === "unreachable" || probe === "ready") {
        return t("auth.login.errorServerUnreachable");
      }
      return t("auth.login.errorNetwork");
    }

    if (error.response.status === 401) {
      return t("auth.login.errorInvalidCredentials");
    }
    if (error.response.status === 429) {
      return t("auth.login.errorTooManyAttempts");
    }
    return t("auth.login.errorGeneric");
  }

  return error instanceof Error && error.message
    ? error.message
    : t("auth.login.failed");
}

/** `error_code` của envelope API — chỉ nhận SCREAMING_SNAKE_CASE để dòng mã gọn, sạch. */
function envelopeErrorCode(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("error_code" in data)) return null;
  const code = (data as { error_code?: unknown }).error_code;
  return typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code)
    ? code
    : null;
}

/**
 * Nội dung dòng "mã chẩn đoán": lỗi tầng vận chuyển (không có HTTP response) hoặc
 * lỗi gateway 502–504, kèm kết quả lần dò /health cuối nếu đã tự chờ máy chủ.
 */
function loginDiagnosticSummary(error: unknown): string | null {
  const probe = backendProbeOf(error);
  const probePart = probe ? ` | probe:${probe}` : "";
  const transport = transportDiagnosticOf(error);
  if (transport) return `${transport.summary}${probePart}`;
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status !== undefined && status >= 502 && status <= 504) {
      const code = envelopeErrorCode(error.response?.data);
      return `HTTP ${status}${code ? ` ${code}` : ""}${probePart}`;
    }
  }
  return null;
}

/**
 * Dòng "mã chẩn đoán" cho lỗi KHÔNG có HTTP response (mất mạng, bị huỷ, hết thời
 * gian) hoặc gateway báo máy chủ chưa sẵn sàng. Câu thông báo chung không phân biệt
 * được các nguyên nhân đó; dòng mã này nằm ngay trong ảnh chụp màn hình người dùng
 * gửi lên nên đủ để khoanh vùng mà không cần tái hiện. Chỉ gồm mã kỹ thuật — không
 * email, token hay dữ liệu cá nhân (xem shared/api/transport-monitor.ts).
 */

const MFA_OTP_LENGTH = 6;

function MfaOtpInput({
  digits,
  onChange,
  disabled,
  label,
}: {
  digits: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  label: string;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const writeDigits = (startIndex: number, rawValue: string) => {
    const numeric = rawValue.replace(/\D/g, "");
    const next = [...digits];

    if (numeric === "") {
      next[startIndex] = "";
      onChange(next);
      return;
    }

    const chunk = numeric.slice(0, MFA_OTP_LENGTH - startIndex);
    chunk.split("").forEach((digit, offset) => {
      next[startIndex + offset] = digit;
    });
    onChange(next);

    const nextFocusIndex = Math.min(
      startIndex + chunk.length,
      MFA_OTP_LENGTH - 1,
    );
    inputRefs.current[nextFocusIndex]?.focus();
  };

  const handleChange = (
    index: number,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    writeDigits(index, event.target.value);
  };

  const handlePaste = (
    index: number,
    event: ClipboardEvent<HTMLDivElement>,
  ) => {
    const pasted = event.clipboardData.getData("text");
    if (!/\d/.test(pasted)) return;
    event.preventDefault();
    writeDigits(index, pasted);
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Backspace" && digits[index] === "" && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      onChange(next);
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < MFA_OTP_LENGTH - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <Box
      component="fieldset"
      sx={{
        minWidth: 0,
        margin: 0,
        padding: 0,
        border: 0,
      }}
    >
      <Box
        component="legend"
        sx={{
          marginBottom: "8px",
          padding: 0,
          color: AUTH_BASELINE.ink,
          fontSize: { xs: 14, sm: 15 },
          fontWeight: 700,
        }}
      >
        {label}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: "6px", sm: "8px" },
        }}
      >
        {digits.map((digit, index) => (
          <UiTextField
            key={index}
            value={digit}
            inputRef={(node) => {
              inputRefs.current[index] = node;
            }}
            onChange={(event) => handleChange(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            autoFocus={index === 0}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            disabled={disabled}
            slotProps={{
              htmlInput: {
                maxLength: 1,
                pattern: "[0-9]*",
                "aria-label": `${label} ${index + 1}`,
              },
            }}
            sx={{
              width: { xs: 40, sm: 48 },
              flex: "0 0 auto",
              "& .MuiOutlinedInput-root": {
                minHeight: { xs: 44, sm: 48 },
                borderRadius: "8px",
              },
              "& .MuiInputBase-input": {
                boxSizing: "border-box",
                height: { xs: 44, sm: 48 },
                padding: "0 !important",
                textAlign: "center",
                fontSize: { xs: 18, sm: 20 },
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function TransportDiagnosticLine({ error }: { error: unknown }) {
  const t = useT();
  const summary = loginDiagnosticSummary(error);
  if (!summary) return null;
  return (
    <Box
      component="span"
      data-testid="login-transport-diagnostic"
      sx={{
        display: "block",
        marginTop: "6px",
        fontSize: "12px",
        opacity: 0.8,
        overflowWrap: "anywhere",
      }}
    >
      {t("auth.login.diagnosticCode", { code: summary })}
    </Box>
  );
}

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  useEffect(() => {
    if (runtimeConfig.temporaryAutoLogin && isAuthenticated) {
      navigate(DASHBOARD_CANONICAL, { replace: true });
    }
  }, [isAuthenticated, navigate]);
  // Đăng nhập hợp lệ phải đi thẳng vào ứng dụng. Màn xác nhận phiên chỉ xuất
  // hiện sau 60 phút không thao tác, tại SessionConfirmationGate.
  const login = useLogin();
  const mfaVerify = useMfaVerify();
  const [mfaDigits, setMfaDigits] = useState<string[]>(() =>
    Array.from({ length: MFA_OTP_LENGTH }, () => ""),
  );
  const [mfaRecoveryCode, setMfaRecoveryCode] = useState("");
  const rememberedIdentifier = readRememberedIdentifier();
  const loginSchema = useMemo(() => buildLoginSchema(t), [t]);
  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: rememberedIdentifier,
      password: "",
      remember: rememberedIdentifier !== "",
    },
  });

  // Đang tự chờ máy chủ khởi động lại (backend-availability): nói rõ thay vì để
  // vòng xoay "đang xác thực" kéo dài vài chục giây không lời giải thích.
  const serverWaitText = useBackendWait()
    ? t("auth.login.waitingForServer")
    : null;

  const onSubmit = handleSubmit((values) => {
    persistRememberedIdentifier(values.remember ? values.identifier : null);
    login.mutate(toLoginRequest(values));
  });

  // WWHN-SEC-08 — bước 2. Điều kiện render dựa trên KẾT QUẢ của bước 1, không
  // phải một state riêng: state riêng có thể lệch với dữ liệu (ví dụ người dùng
  // bấm Back rồi submit lại) và tạo ra màn hình nhập mã cho một phiên chờ đã hết.
  const challenge = login.data?.kind === "mfa_required" ? login.data : null;

  const mfaErrorMessage = mfaVerify.isError
    ? getLoginErrorMessage(mfaVerify.error, t)
    : null;

  const otpCode = mfaDigits.join("");
  const trimmedRecoveryCode = mfaRecoveryCode.trim();
  const isOtpCodeReady = otpCode.length === MFA_OTP_LENGTH;
  const submittedMfaCode = isOtpCodeReady ? otpCode : trimmedRecoveryCode;
  const isMfaCodeReady = isOtpCodeReady || trimmedRecoveryCode !== "";

  const onSubmitMfa = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (challenge === null || !isMfaCodeReady) return;
    mfaVerify.mutate({
      mfaToken: challenge.mfa_token,
      code: submittedMfaCode,
    });
  };

  const errorMessage = login.isError
    ? getLoginErrorMessage(login.error, t)
    : null;

  const isSubmitting = login.isPending || login.isSuccess;

  // WWHN-SEC-08 — màn nhập mã. Trả về sớm, KHÔNG render kèm form mật khẩu:
  // để hai form cùng tồn tại thì người dùng có thể submit lại mật khẩu và sinh
  // một phiên chờ thứ hai, còn phiên đang hiển thị thì im lặng chết.
  if (challenge !== null) {
    return (
      <AuthShell
        baselineScreen="login"
        titleId="login-mfa-title"
        title={<>{t("auth.mfa.challengeTitle")}</>}
        subtitle={t("auth.mfa.challengeSubtitle")}
        loadingText={
          mfaVerify.isPending
            ? (serverWaitText ?? t("auth.login.authenticating"))
            : null
        }
        showBaselineHeading
      >
        {mfaErrorMessage && (
          <Box sx={{ marginBottom: "14px" }}>
            <UiAlert tone="error" title={t("auth.login.errorTitle")}>
              {mfaErrorMessage}
              <TransportDiagnosticLine error={mfaVerify.error} />
            </UiAlert>
          </Box>
        )}

        <form onSubmit={onSubmitMfa} noValidate>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <MfaOtpInput
              digits={mfaDigits}
              onChange={setMfaDigits}
              disabled={mfaVerify.isPending}
              label={t("auth.mfa.codeLabel")}
            />

            <Box
              component="details"
              sx={{
                color: AUTH_BASELINE.muted,
                fontSize: { xs: 12, sm: 13 },
                "& summary": {
                  cursor: "pointer",
                  color: AUTH_BASELINE.link,
                  fontWeight: 600,
                },
              }}
            >
              <Box component="summary">{t("auth.mfa.codeHelp")}</Box>
              <Box sx={{ marginTop: "10px" }}>
                <UiTextField
                  fullWidth
                  label={t("auth.mfa.recoveryTitle")}
                  value={mfaRecoveryCode}
                  onChange={(event) => setMfaRecoveryCode(event.target.value)}
                  autoComplete="off"
                  disabled={mfaVerify.isPending}
                />
              </Box>
            </Box>

            <UiButton
              type="submit"
              fullWidth
              loading={mfaVerify.isPending}
              disabled={mfaVerify.isPending || !isMfaCodeReady}
            >
              {t("auth.mfa.verifySubmit")}
            </UiButton>
          </Box>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      baselineScreen="login"
      titleId="login-title"
      title={<>{t("auth.login.title")}</>}
      subtitle={t("auth.login.subtitle")}
      loadingText={
        isSubmitting
          ? login.isPending
            ? (serverWaitText ?? t("auth.login.authenticating"))
            : t("auth.login.loadingAccess")
          : null
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: { xs: "16px", sm: "18px" },
          }}
        >
          <AuthField
            control={control}
            name="identifier"
            label={t("auth.login.identifierLabel")}
            placeholder={t("auth.login.identifierPlaceholder")}
            startIcon="user"
            autoFocus
            disabled={isSubmitting}
          />

          <AuthField
            control={control}
            name="password"
            label={t("auth.fields.password")}
            placeholder={t("auth.fields.passwordPlaceholder")}
            type="password"
            startIcon="lock"
            disabled={isSubmitting}
          />

          {errorMessage ? (
            <Box
              role="alert"
              sx={{
                marginTop: { xs: "-10px", sm: "-12px" },
                color: AUTH_BASELINE.danger,
                fontSize: { xs: 13, sm: 15 },
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {errorMessage}
              <TransportDiagnosticLine error={login.error} />
            </Box>
          ) : null}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: { xs: "-9px", sm: "-10px" },
              fontSize: { xs: 14, sm: 15 },
            }}
          >
            <Link to={ROUTES.FORGOT_PASSWORD}>
              {t("auth.login.forgotPassword")}
            </Link>
          </Box>

          <UiButton
            type="submit"
            fullWidth
            loading={login.isPending}
            disabled={isSubmitting}
            sx={{
              position: "relative",
              "& .hn-login-submit-arrow": {
                position: "absolute",
                right: { xs: 18, sm: 22 },
                fontSize: { xs: 19, sm: 22 },
                lineHeight: 1,
              },
              "&.Mui-disabled .hn-login-submit-arrow": { opacity: 0.6 },
            }}
          >
            {t("auth.login.submit")}
            <i
              className={`${flatIconClass("arrow-right")} hn-login-submit-arrow`}
              aria-hidden
            />
          </UiButton>

          <Box
            role="note"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: "10px", sm: "12px" },
              marginTop: 0,
              padding: { xs: "13px 14px", sm: "14px 16px" },
              borderRadius: "12px",
              backgroundColor: AUTH_BASELINE.pale,
              color: AUTH_BASELINE.ink,
              "& > i": {
                color: "#008CFF",
                fontSize: { xs: 24, sm: 28 },
                flex: "0 0 auto",
              },
            }}
          >
            <i className={flatIconClass("shield-check")} aria-hidden />
            <Box sx={{ fontSize: { xs: 13, sm: 14 }, lineHeight: 1.4 }}>
              <Box sx={{ fontWeight: 700 }}>
                {t("auth.login.accessNoticeTitle")}
              </Box>
              <Box sx={{ color: AUTH_BASELINE.muted }}>
                {t("auth.login.accessNoticeBody")}
              </Box>
            </Box>
          </Box>
        </Box>
      </form>
    </AuthShell>
  );
}
