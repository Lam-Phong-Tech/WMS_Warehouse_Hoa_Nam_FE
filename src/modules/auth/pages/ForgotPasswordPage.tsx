import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { useForgotPassword } from "@/modules/auth/hooks/use-forgot-password";
import { useVerifyOtp } from "@/modules/auth/hooks/use-verify-otp";
import { useResetPassword } from "@/modules/auth/hooks/use-reset-password";
import {
  forgotPasswordEmailSchema,
  otpSchema,
  resetPasswordFormSchema,
  type ForgotPasswordEmailFormValues,
  type OtpFormValues,
  type ResetPasswordFormValues,
} from "@/modules/auth/schemas/forgot-password.schema";
import { Box, UiAlert, UiFormText } from "@/shared/ui";
import { AuthShell, AuthNote } from "@/modules/auth/components/AuthShell";
import { ROUTES } from "@/shared/constants/routes";
import { ActionButton } from "@/shared/components/actions";

/** Đồng bộ với config/password_reset.php (otp_ttl_minutes=5) phía BE — chỉ là
 * đếm ngược hiển thị, BE mới là nguồn sự thật về hạn thật của OTP. */
const OTP_TTL_SECONDS = 5 * 60;

type Step = "email" | "otp" | "password";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return fallback;
}

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  // Đổi mỗi lần gửi/gửi lại OTP để trigger effect đếm ngược bên dưới — không
  // dùng ref cầm interval id (react-hooks/refs cấm đọc/ghi ref trong closure
  // được tạo lúc render, ví dụ bên trong handleSubmit()).
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (otpSentAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [otpSentAt]);

  const secondsLeft =
    otpSentAt === null
      ? OTP_TTL_SECONDS
      : Math.max(0, OTP_TTL_SECONDS - Math.floor((now - otpSentAt) / 1000));

  const forgotPassword = useForgotPassword();
  const verifyOtp = useVerifyOtp();
  const resetPassword = useResetPassword();

  const emailForm = useForm<ForgotPasswordEmailFormValues>({
    resolver: zodResolver(forgotPasswordEmailSchema),
    defaultValues: { email: "" },
  });
  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });
  const passwordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: "", newPasswordConfirmation: "" },
  });

  const isExpired = step === "otp" && secondsLeft <= 0;

  const onSubmitEmail = emailForm.handleSubmit((values) => {
    const trimmedEmail = values.email.trim();
    forgotPassword.mutate(
      { email: trimmedEmail },
      {
        onSuccess: () => {
          setEmail(trimmedEmail);
          otpForm.reset({ otp: "" });
          setStep("otp");
          setOtpSentAt(Date.now());
        },
      },
    );
  });

  const onResendOtp = () => {
    forgotPassword.mutate(
      { email },
      {
        onSuccess: () => {
          otpForm.reset({ otp: "" });
          setOtpSentAt(Date.now());
        },
      },
    );
  };

  const onSubmitOtp = otpForm.handleSubmit((values) => {
    verifyOtp.mutate(
      { email, otp: values.otp },
      {
        onSuccess: (data) => {
          setResetToken(data.reset_token);
          setStep("password");
        },
      },
    );
  });

  const onSubmitPassword = passwordForm.handleSubmit((values) => {
    resetPassword.mutate({
      email,
      reset_token: resetToken,
      new_password: values.newPassword,
      new_password_confirmation: values.newPasswordConfirmation,
    });
  });

  const isBusy =
    forgotPassword.isPending || verifyOtp.isPending || resetPassword.isPending;

  return (
    <AuthShell
      titleId="forgot-password-title"
      title="Quên mật khẩu"
      subtitle={
        <>
          {step === "email" && "Nhập email đã đăng ký để nhận mã xác thực."}
          {step === "otp" && `Nhập mã OTP 6 số vừa gửi tới ${email}.`}
          {step === "password" && "Đặt mật khẩu mới cho tài khoản."}
        </>
      }
      loadingText={isBusy ? "Đang xử lý..." : null}
    >
      {step === "email" && (
        <form onSubmit={onSubmitEmail} noValidate>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "13px" }}>
            <UiFormText
              control={emailForm.control}
              name="email"
              label="Email"
              placeholder="your@gmail.com"
              startIcon="user"
              autoFocus
              disabled={forgotPassword.isPending}
            />

            <ActionButton
              kind="send"
              loading={forgotPassword.isPending}
              disabled={forgotPassword.isPending}
              type="submit"
              fullWidth
            >
              Gửi mã OTP
            </ActionButton>

            <AuthNote sx={{ marginTop: 0 }}>
              <Link to={ROUTES.LOGIN}>Quay lại đăng nhập</Link>
            </AuthNote>
          </Box>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={onSubmitOtp} noValidate>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "13px" }}>
            {verifyOtp.isError && (
              <UiAlert tone="error">
                {getApiErrorMessage(
                  verifyOtp.error,
                  "Mã OTP không đúng hoặc đã hết hạn.",
                )}
              </UiAlert>
            )}

            <UiFormText
              control={otpForm.control}
              name="otp"
              label="Mã OTP"
              placeholder="Nhập 6 chữ số"
              startIcon="lock"
              numericOnly
              maxLength={6}
              autoFocus
              disabled={verifyOtp.isPending || isExpired}
            />

            <AuthNote sx={{ marginTop: 0 }}>
              {isExpired ? (
                "Mã OTP đã hết hạn."
              ) : (
                <>Mã có hiệu lực trong {formatCountdown(secondsLeft)}</>
              )}
            </AuthNote>

            {isExpired ? (
              <ActionButton
                kind="send"
                loading={forgotPassword.isPending}
                onClick={onResendOtp}
                fullWidth
              >
                Gửi lại mã OTP
              </ActionButton>
            ) : (
              <ActionButton
                kind="confirm"
                loading={verifyOtp.isPending}
                disabled={verifyOtp.isPending}
                type="submit"
                fullWidth
              >
                Xác nhận
              </ActionButton>
            )}
          </Box>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={onSubmitPassword} noValidate>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "13px" }}>
            {resetPassword.isError && (
              <UiAlert tone="error">
                {getApiErrorMessage(
                  resetPassword.error,
                  "Đặt lại mật khẩu thất bại.",
                )}
              </UiAlert>
            )}

            <UiFormText
              control={passwordForm.control}
              name="newPassword"
              label="Mật khẩu mới"
              placeholder="Tối thiểu 8 ký tự"
              startIcon="lock"
              type="password"
              autoFocus
              disabled={resetPassword.isPending}
            />

            <UiFormText
              control={passwordForm.control}
              name="newPasswordConfirmation"
              label="Xác nhận mật khẩu mới"
              placeholder="Nhập lại mật khẩu mới"
              startIcon="lock"
              type="password"
              disabled={resetPassword.isPending}
            />

            <ActionButton
              kind="reset"
              loading={resetPassword.isPending}
              disabled={resetPassword.isPending}
              type="submit"
              fullWidth
            >
              Đặt lại mật khẩu
            </ActionButton>
          </Box>
        </form>
      )}
    </AuthShell>
  );
}
