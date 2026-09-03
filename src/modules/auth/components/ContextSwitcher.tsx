import { useState, type CSSProperties, type MouseEvent } from "react";
import { Box, Menu, MenuItem } from "@/shared/ui";
import { RADIUS, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
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
import { useT } from "@/shared/i18n/useT";
/**
 * Style cục bộ theo token Vuexy — thay `layoutStyles` (bảng style wireframe cũ
 * đã xoá ở Part 4; ContextSwitcher là consumer cuối cùng).
 */
const styles = {
  icon: { color: S.primary },
  label: { fontWeight: 700, color: S.textHigh },
  tag: {
    marginInlineEnd: 0,
    borderRadius: RADIUS.control,
    borderColor: S.primaryLight,
    background: S.primarySoft,
    color: S.primary,
    fontWeight: 700,
  },
  trigger: {
    cursor: "pointer",
    minHeight: 36,
    padding: "0 8px",
    border: `1px solid ${S.borderInput}`,
    borderRadius: RADIUS.control,
    background: S.bgSurface,
  },
  caret: { fontSize: 10, color: S.textMedium },
  itemIconPlaceholder: { display: "inline-block", width: 14 },
  item: { lineHeight: 1.3 },
  itemTitle: { fontWeight: 700 },
  itemMeta: { fontSize: 12 },
} satisfies Record<string, CSSProperties>;

/** Chuyển warehouse scope bằng đúng contract POST /api/v1/auth/switch-context. */
export function ContextSwitcher() {
  const t = useT();
  const contexts = useAuthStore((s) => s.contexts);
  const current = useAuthStore((s) => s.currentContext);
  const setCurrentContext = useAuthStore((s) => s.setCurrentContext);
  const switchContext = useSwitchContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  if (!current) return null;

  const label = (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
    >
      <ApartmentOutlined style={styles.icon} />
      <span style={styles.label}>{current.role_name}</span>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0 7px",
          fontSize: 12,
          lineHeight: "20px",
          border: "1px solid",
        }}
        style={styles.tag}
      >
        {getScopeName(current, t)}
      </Box>
    </Box>
  );

  if (contexts.length <= 1) return label;

  const currentKey = getContextKey(current);
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <Box
        component="span"
        sx={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        style={styles.trigger}
        onClick={(e: MouseEvent<HTMLElement>) => {
          if (switchContext.isPending) return;
          setAnchorEl(e.currentTarget);
        }}
      >
        {label}
        <DownOutlined style={styles.caret} />
      </Box>
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
                      toast.success(t("auth.context.switchSuccess"));
                    },
                    onError: () => {
                      toast.error(t("auth.context.switchError"));
                    },
                  },
                );
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Box
                  component="span"
                  sx={{ display: "inline-flex", minWidth: 20 }}
                >
                  {isCurrent ? (
                    <CheckOutlined style={styles.icon} />
                  ) : (
                    <span style={styles.itemIconPlaceholder} />
                  )}
                </Box>
                <div style={styles.item}>
                  <div style={styles.itemTitle}>{ctx.role_name}</div>
                  <Box
                    component="span"
                    sx={{ color: "text.secondary" }}
                    style={styles.itemMeta}
                  >
                    {getScopeTypeLabel(ctx, t)}: {getScopeName(ctx, t)}
                  </Box>
                </div>
              </Box>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
