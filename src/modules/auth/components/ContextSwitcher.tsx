import { useState } from "react";
import { Space, Tag, Typography } from "antd";
import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ThemeProvider,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import {
  ApartmentOutlined,
  CheckOutlined,
  DownOutlined,
} from "@/shared/components/icons";
import { toast } from "sonner";
import { useAuthStore } from "@/shared/store/auth.store";
import { useSwitchContext } from "@/modules/auth/hooks/use-switch-context";
import {
  getContextKey,
  getScopeName,
  getScopeTypeLabel,
} from "@/modules/auth/utils/context";
import { layoutStyles } from "@/app/layouts/layout.styles";

/** Chuyển warehouse scope bằng đúng contract POST /api/v1/auth/switch-context. */
export function ContextSwitcher() {
  const contexts = useAuthStore((s) => s.contexts);
  const current = useAuthStore((s) => s.currentContext);
  const setCurrentContext = useAuthStore((s) => s.setCurrentContext);
  const switchContext = useSwitchContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  if (!current) return null;

  const label = (
    <Space size={6}>
      <ApartmentOutlined style={layoutStyles.contextSwitcherIcon} />
      <span style={layoutStyles.contextSwitcherLabel}>{current.role_name}</span>
      <Tag style={layoutStyles.contextSwitcherTag}>{getScopeName(current)}</Tag>
    </Space>
  );

  if (contexts.length <= 1) return label;

  const currentKey = getContextKey(current);
  const handleClose = () => setAnchorEl(null);

  return (
    <ThemeProvider theme={muiTheme}>
      <Space
        style={layoutStyles.contextSwitcherTrigger}
        size={6}
        onClick={(e) => {
          if (switchContext.isPending) return;
          setAnchorEl(e.currentTarget);
        }}
      >
        {label}
        <DownOutlined style={layoutStyles.contextSwitcherCaret} />
      </Space>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        {contexts.map((ctx) => {
          const key = getContextKey(ctx);
          const isCurrent = key === currentKey;
          return (
            <MenuItem
              key={key}
              selected={isCurrent}
              onClick={() => {
                handleClose();
                if (isCurrent) return;
                switchContext.mutate(
                  {
                    context_type:
                      ctx.context_type ??
                      (ctx.scope_ref ? "WAREHOUSE" : "SYSTEM"),
                    context_id: ctx.context_id ?? ctx.scope_ref ?? null,
                    scope_ref: ctx.scope_ref ?? null,
                  },
                  {
                    onSuccess: (result) => {
                      const confirmed = contexts.find((candidate) => {
                        const active = result.active_context;
                        if (active.scope_ref)
                          return candidate.scope_ref === active.scope_ref;
                        if (active.context_id)
                          return candidate.context_id === active.context_id;
                        return !candidate.scope_ref && !candidate.context_id;
                      });
                      setCurrentContext(confirmed ?? ctx);
                      toast.success("Đã chuyển phạm vi kho thành công.");
                    },
                    onError: () => {
                      toast.error(
                        "Không thể chuyển phạm vi kho, vui lòng thử lại.",
                      );
                    },
                  },
                );
              }}
            >
              <ListItemIcon>
                {isCurrent ? (
                  <CheckOutlined style={layoutStyles.contextSwitcherIcon} />
                ) : (
                  <span
                    style={layoutStyles.contextSwitcherItemIconPlaceholder}
                  />
                )}
              </ListItemIcon>
              <ListItemText>
                <div style={layoutStyles.contextSwitcherItem}>
                  <div style={layoutStyles.contextSwitcherItemTitle}>
                    {ctx.role_name}
                  </div>
                  <Typography.Text
                    type="secondary"
                    style={layoutStyles.contextSwitcherItemMeta}
                  >
                    {getScopeTypeLabel(ctx)}: {getScopeName(ctx)}
                  </Typography.Text>
                </div>
              </ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </ThemeProvider>
  );
}
