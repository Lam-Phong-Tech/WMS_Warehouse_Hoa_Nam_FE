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
    <Dialog
      fullWidth
      maxWidth="sm"
      aria-labelledby={title ? titleId : undefined}
      {...rest}
    >
      {title ? <DialogTitle id={titleId}>{title}</DialogTitle> : null}
      <DialogContent>
        <CoordinatedLoadingBoundary mode="dialog" active={rest.open}>
          {children}
        </CoordinatedLoadingBoundary>
      </DialogContent>
      {actions ? (
        <DialogActions sx={{ px: 2.5, pb: 2 }}>{actions}</DialogActions>
      ) : null}
    </Dialog>
  );
}
export interface UiDrawerProps extends Omit<DrawerProps, "title"> {
  title?: ReactNode;
  width?: number;
  actions?: ReactNode;
}

export function UiDrawer({
  title,
  width = 420,
  actions,
  children,
  ...rest
}: UiDrawerProps) {
  const titleId = useId();
  const pageVisible = usePageVisible();
  if (!pageVisible) return null;
  return (
    <Drawer
      anchor="right"
      {...rest}
      slotProps={{
        ...rest.slotProps,
        paper: (ownerState) => ({
          ...(typeof rest.slotProps?.paper === "function"
            ? rest.slotProps.paper(ownerState)
            : rest.slotProps?.paper),
          "aria-labelledby": title ? titleId : undefined,
        }),
      }}
    >
      <Box
        sx={{
          width,
          maxWidth: "100vw",
          height: "100dvh",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {title ? (
          <Box
            sx={{
              flex: "none",
              px: { xs: 2, sm: 3 },
              py: { xs: 1.75, sm: 2.25 },
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <UiText id={titleId} variant="cardTitle">
              {title}
            </UiText>
          </Box>
        ) : null}
        <Box
          data-ui-drawer-body
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            p: { xs: 2, sm: 3 },
          }}
        >
          <CoordinatedLoadingBoundary mode="drawer" active={Boolean(rest.open)}>
            {children}
          </CoordinatedLoadingBoundary>
        </Box>
        {actions ? (
          <Box
            data-ui-drawer-actions
            sx={{
              flex: "none",
              px: { xs: 2, sm: 3 },
              py: 2,
              borderTop: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            {actions}
          </Box>
        ) : null}
      </Box>
    </Drawer>
  );
}
