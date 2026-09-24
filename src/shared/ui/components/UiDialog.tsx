/** Canonical overlay surface. Each visible dialog/drawer owns its loading group. */
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import type { DialogProps } from "@mui/material/Dialog";
import type { DrawerProps } from "@mui/material/Drawer";
import { useId, type ReactNode } from "react";
import { usePageVisible } from "@/shared/ui/page-visibility";
import { COMPONENT_TOKENS as C } from "@/shared/ui/tokens";
import { CoordinatedLoadingBoundary } from "@/shared/ui/loading/CoordinatedLoadingBoundary";
import { UiText } from "./UiText";
export interface UiDialogProps extends Omit<DialogProps, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}
export function UiDialog({ title, actions, children, ...rest }: UiDialogProps) {
  const titleId = useId();
  const pageVisible = usePageVisible();
  if (!pageVisible) return null;
  return (
    <Dialog fullWidth maxWidth="sm" aria-labelledby={title ? titleId : undefined} {...rest}>
      {title ? <DialogTitle id={titleId}>{title}</DialogTitle> : null}
      <DialogContent>
        <CoordinatedLoadingBoundary mode="dialog" active={rest.open}>{children}</CoordinatedLoadingBoundary>
      </DialogContent>
      {actions ? <DialogActions sx={{ px: 2.5, pb: 2 }}>{actions}</DialogActions> : null}
    </Dialog>
  );
}
export interface UiDrawerProps extends Omit<DrawerProps, "title"> { title?: ReactNode; width?: number; }
export function UiDrawer({ title, width = 420, children, ...rest }: UiDrawerProps) {
  const pageVisible = usePageVisible();
  if (!pageVisible) return null;
  return (
    <Drawer anchor="right" {...rest}>
      <Box sx={{ width, maxWidth: "100vw" }}>
        {title ? <Box sx={{ px: `${C.card.paddingDesktop}px`, pt: `${C.card.paddingMobile}px` }}><UiText variant="cardTitle">{title}</UiText></Box> : null}
        <Box sx={{ p: `${C.card.paddingDesktop}px` }}>
          <CoordinatedLoadingBoundary mode="drawer" active={Boolean(rest.open)}>{children}</CoordinatedLoadingBoundary>
        </Box>
      </Box>
    </Drawer>
  );
}
