import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Form, Spin, Typography } from "antd";
import { LockOutlined, UserOutlined } from "@/shared/components/icons";
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
import { FormInput } from "@/shared/components/forms";
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
    <main className="hn-login-page">
      {isBusy && (
        <div className="hn-login-loading" role="status" aria-live="polite">
          <div className="hn-login-loading-card">
            <Spin size="large" />
            <Typography.Text strong style={{ display: "block", marginTop: 12 }}>
              Đang xử lý...
            </Typography.Text>
            <Typography.Text
              type="secondary"
              style={{ display: "block", marginTop: 4, fontSize: 12 }}
            >
              Hoa Nam WMS
            </Typography.Text>
          </div>
        </div>
      )}

      <section
        className="hn-login-wrap"
        aria-labelledby="forgot-password-title"
      >
        <div className="hn-login-kicker">
          Hoa Nam Tools <span>WMS · Quản lý kho</span>
        </div>

        <div className="hn-login-frame">
          <header className="hn-login-head">
            <div className="hn-login-brand">
              <div className="hn-login-mark" aria-hidden="true">
                HN
              </div>
              <div>
                <h1 id="forgot-password-title" className="hn-login-title">
                  Quên mật khẩu
                </h1>
                <div className="hn-login-subtitle">
                  {step === "email" &&
                    "Nhập email đã đăng ký để nhận mã xác thực."}
                  {step === "otp" && `Nhập mã OTP 6 số vừa gửi tới ${email}.`}
                  {step === "password" && "Đặt mật khẩu mới cho tài khoản."}
                </div>
              </div>
            </div>
          </header>

          <div className="hn-login-form">
            {step === "email" && (
              <Form
                layout="vertical"
                onSubmitCapture={onSubmitEmail}
                requiredMark={false}
                noValidate
              >
                <FormInput
                  control={emailForm.control}
                  name="email"
                  label="Email"
                  placeholder="your@gmail.com"
                  prefix={<UserOutlined style={{ color: "#8c887e" }} />}
                  autoFocus
                  disabled={forgotPassword.isPending}
                />

                <ActionButton
                  kind="send"
                  className="hn-login-submit"
                  loading={forgotPassword.isPending}
                  disabled={forgotPassword.isPending}
                  type="submit"
                  fullWidth
                >
                  Gửi mã OTP
                </ActionButton>

                <div className="hn-login-note">
                  <Link to={ROUTES.LOGIN}>Quay lại đăng nhập</Link>
                </div>
              </Form>
            )}

            {step === "otp" && (
              <Form
                layout="vertical"
                onSubmitCapture={onSubmitOtp}
                requiredMark={false}
                noValidate
              >
                {verifyOtp.isError && (
                  <Alert
                    type="error"
                    description={getApiErrorMessage(
                      verifyOtp.error,
                      "Mã OTP không đúng hoặc đã hết hạn.",
                    )}
                    style={{ marginBottom: 14 }}
                    showIcon
                  />
                )}

                <FormInput
                  control={otpForm.control}
                  name="otp"
                  label="Mã OTP"
                  placeholder="Nhập 6 chữ số"
                  prefix={<LockOutlined style={{ color: "#8c887e" }} />}
                  numericOnly
                  maxLength={6}
                  autoFocus
                  disabled={verifyOtp.isPending || isExpired}
                />

                <div className="hn-login-note" style={{ marginBottom: 14 }}>
                  {isExpired ? (
                    "Mã OTP đã hết hạn."
                  ) : (
                    <>Mã có hiệu lực trong {formatCountdown(secondsLeft)}</>
                  )}
                </div>

                {isExpired ? (
                  <ActionButton
                    kind="send"
                    className="hn-login-submit"
                    loading={forgotPassword.isPending}
                    onClick={onResendOtp}
                    fullWidth
                  >
                    Gửi lại mã OTP
                  </ActionButton>
                ) : (
                  <ActionButton
                    kind="confirm"
                    className="hn-login-submit"
                    loading={verifyOtp.isPending}
                    disabled={verifyOtp.isPending}
                    type="submit"
                    fullWidth
                  >
                    Xác nhận
                  </ActionButton>
                )}
              </Form>
            )}

            {step === "password" && (
              <Form
                layout="vertical"
                onSubmitCapture={onSubmitPassword}
                requiredMark={false}
                noValidate
              >
                {resetPassword.isError && (
                  <Alert
                    type="error"
                    description={getApiErrorMessage(
                      resetPassword.error,
                      "Đặt lại mật khẩu thất bại.",
                    )}
                    style={{ marginBottom: 14 }}
                    showIcon
                  />
                )}

                <FormInput
                  control={passwordForm.control}
                  name="newPassword"
                  label="Mật khẩu mới"
                  placeholder="Tối thiểu 8 ký tự"
                  prefix={<LockOutlined style={{ color: "#8c887e" }} />}
                  password
                  autoFocus
                  disabled={resetPassword.isPending}
                />

                <FormInput
                  control={passwordForm.control}
                  name="newPasswordConfirmation"
                  label="Xác nhận mật khẩu mới"
                  placeholder="Nhập lại mật khẩu mới"
                  prefix={<LockOutlined style={{ color: "#8c887e" }} />}
                  password
                  disabled={resetPassword.isPending}
                />

                <ActionButton
                  kind="reset"
                  className="hn-login-submit"
                  loading={resetPassword.isPending}
                  disabled={resetPassword.isPending}
                  type="submit"
                  fullWidth
                >
                  Đặt lại mật khẩu
                </ActionButton>
              </Form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
