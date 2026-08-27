/**
 * Foundation Avatar — không có ảnh thì hiện chữ cái đầu của 2 từ cuối trong
 * tên (quy ước tên tiếng Việt: "Nguyễn Văn An" → "VA"), nền primarySoft +
 * chữ primaryDark 600.
 */
import Avatar from "@mui/material/Avatar";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";

const SIZE_PX = { sm: 28, md: 36, lg: 44 } as const;

export interface UiAvatarProps {
  /** Tên hiển thị — dùng sinh initials khi không có ảnh + làm alt cho ảnh. */
  name?: string;
  src?: string;
  size?: keyof typeof SIZE_PX;
  className?: string;
}

/** Lấy chữ cái đầu của 2 từ cuối trong tên ("Nguyễn Văn An" → "VA"). */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((word) => word.charAt(0).toLocaleUpperCase("vi"))
    .join("");
}

export function UiAvatar({ name, src, size = "md", className }: UiAvatarProps) {
  const px = SIZE_PX[size];
  return (
    <Avatar
      src={src}
      alt={name}
      className={className}
      sx={{
        width: px,
        height: px,
        // Cỡ chữ initials tỉ lệ theo cỡ avatar (28→11, 36→14, 44→17).
        fontSize: Math.round(px * 0.38),
        fontWeight: 600,
        backgroundColor: S.primarySoft,
        color: S.primaryDark,
      }}
    >
      {name ? initialsOf(name) : null}
    </Avatar>
  );
}
