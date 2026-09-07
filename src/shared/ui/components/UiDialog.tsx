/**
 * Foundation Modal/Drawer surface — bề mặt overlay canonical (radius/motion từ
 * theme adapter: Grow 280ms vào / 200ms ra, closeAfterTransition).
 */
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import type { DialogProps } from "@mui/material/Dialog";
import type { DrawerProps } from "@mui/material/Drawer";
import { useId } from "react";
import { usePageVisible } from "@/shared/ui/page-visibility";
import type { ReactNode } from "react";
import { COMPONENT_TOKENS as C } from "@/shared/ui/tokens";
import { UiText } from "./UiText";

export interface UiDialogProps extends Omit<DialogProps, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function UiDialog({ title, actions, children, ...rest }: UiDialogProps) {
  // Auto aria-labelledby: dialog lấy tên accessible từ DialogTitle khi có
  // title (caller vẫn override được qua props vì {...rest} spread sau).
  const titleId = useId();
  // Dialog render qua portal nên nằm NGOÀI cây DOM của trang. Trang thuộc nhóm
  // keep-alive bị ẩn (display:none) thì dialog của nó vẫn hiện đè lên trang mới.
  // Không render khi trang ẩn (không phải open=false — xem usePageVisible); trang
  // hiện lại thì mount lại với đúng `open` của caller (state còn nguyên).
  const pageVisible = usePageVisible();
  if (!pageVisible) return null;
  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      aria-labelledby={title ? titleId : undefined}
      {...rest}
    >
      {title ? <DialogTitle id={titleId}>{title}</DialogTitle> : null}
      <DialogContent>{children}</DialogContent>
      {actions ? (
        <DialogActions sx={{ px: 2.5, pb: 2 }}>{actions}</DialogActions>
      ) : null}
    </Dialog>
  );
}

export interface UiDrawerProps extends Omit<DrawerProps, "title"> {
  title?: ReactNode;
  /** Bề rộng nội dung drawer (px) — mặc định 420. */
  width?: number;
}

export function UiDrawer({
  title,
  width = 420,
  children,
  ...rest
}: UiDrawerProps) {
  const pageVisible = usePageVisible();
  if (!pageVisible) return null;
  return (
    <Drawer anchor="right" {...rest}>
      <Box sx={{ width, maxWidth: "100vw" }}>
        {title ? (
          <Box
            sx={{
              px: `${C.card.paddingDesktop}px`,
              pt: `${C.card.paddingMobile}px`,
            }}
          >
            <UiText variant="cardTitle">{title}</UiText>
          </Box>
        ) : null}
        <Box sx={{ p: `${C.card.paddingDesktop}px` }}>{children}</Box>
      </Box>
    </Drawer>
  );
}
