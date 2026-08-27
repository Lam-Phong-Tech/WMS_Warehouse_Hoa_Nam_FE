import type { CSSProperties, ReactNode } from "react";
import { Stack } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

export interface ActionGroupProps {
  children: ReactNode;
  /** Cho phép xuống dòng khi ô hẹp (mặc định bật — cột Thao tác trên mobile). */
  wrap?: boolean;
  /** Căn nhóm nút (mặc định căn trái). */
  justify?: CSSProperties["justifyContent"];
  className?: string;
  sx?: SxProps<Theme>;
}

/**
 * KHUNG NHÓM NÚT HÀNH ĐỘNG CHUẨN — bọc các `<ActionButton />` trong cột
 * "Thao tác", thanh công cụ hoặc footer modal.
 *
 * Chốt cứng hướng ngang + khoảng cách 8px để mọi bảng trong dự án giống nhau,
 * không nơi dùng `gap: 4` nơi dùng `gap: 12`.
 */
export function ActionGroup({
  children,
  wrap = true,
  justify,
  className,
  sx,
}: ActionGroupProps) {
  return (
    <Stack
      className={className}
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : "nowrap",
        rowGap: 1,
        ...sx,
      }}
    >
      {children}
    </Stack>
  );
}
