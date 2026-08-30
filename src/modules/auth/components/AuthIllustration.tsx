import { Box } from "@/shared/ui";
import loginLight from "../assets/auth-v2-login-illustration-light.png";
import forgotLight from "../assets/auth-v2-forgot-password-illustration-light.png";

/** Biến thể minh hoạ theo màn auth — mỗi màn một asset Vuexy tương ứng. */
export type AuthIllustrationVariant = "login" | "forgot";

/**
 * Cấu hình từng minh hoạ. Vuexy giới hạn ảnh theo CHIỀU CAO (không phải chiều
 * rộng) để mọi màn cùng một tỉ lệ hiển thị. Hai ảnh có tỉ lệ khác nhau (login
 * 945×1069, forgot 901×1402) và lượng khoảng trắng nội tại khác nhau, nên
 * `maxHeight` được canh RIÊNG để KÍCH THƯỚC NHÂN VẬT trông đồng đều giữa các màn.
 */
const ILLUSTRATION: Record<
  AuthIllustrationVariant,
  { src: string; maxHeight: number }
> = {
  login: { src: loginLight, maxHeight: 560 },
  forgot: { src: forgotLight, maxHeight: 680 },
};

/**
 * Minh hoạ cột trái màn auth — dùng đúng asset login-v2 của Vuexy để khớp 100%
 * bản gốc; ảnh đổi theo `variant`, canh chiều cao để nhân vật đồng đều mọi màn.
 */
export function AuthIllustration({
  variant = "login",
}: {
  variant?: AuthIllustrationVariant;
}) {
  const { src, maxHeight } = ILLUSTRATION[variant];
  return (
    <Box
      component="img"
      src={src}
      alt=""
      aria-hidden
      sx={{
        display: "block",
        width: "auto",
        height: "auto",
        maxHeight,
        maxWidth: "100%",
        userSelect: "none",
        pointerEvents: "none",
      }}
    />
  );
}
