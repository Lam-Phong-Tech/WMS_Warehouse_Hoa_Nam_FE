import { Dropdown, Space, Tag, Typography } from "antd";
import type { MenuProps } from "antd";
import {
  ApartmentOutlined,
  CheckOutlined,
  DownOutlined,
} from "@ant-design/icons";
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
  const items: MenuProps["items"] = contexts.map((ctx) => {
    const key = getContextKey(ctx);
    return {
      key,
      icon:
        key === currentKey ? (
          <CheckOutlined style={layoutStyles.contextSwitcherIcon} />
        ) : (
          <span style={layoutStyles.contextSwitcherItemIconPlaceholder} />
        ),
      label: (
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
      ),
      onClick: () => {
        if (key === currentKey) return;
        switchContext.mutate(
          {
            context_type:
              ctx.context_type ?? (ctx.scope_ref ? "WAREHOUSE" : "SYSTEM"),
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
            },
            onError: () => {
              toast.error("Không thể chuyển phạm vi kho, vui lòng thử lại.");
            },
          },
        );
      },
    };
  });

  return (
    <Dropdown
      menu={{ items, selectedKeys: [currentKey] }}
      trigger={["click"]}
      disabled={switchContext.isPending}
    >
      <Space style={layoutStyles.contextSwitcherTrigger} size={6}>
        {label}
        <DownOutlined style={layoutStyles.contextSwitcherCaret} />
      </Space>
    </Dropdown>
  );
}
