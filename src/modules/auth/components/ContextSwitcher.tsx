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

/**
 * Bộ chuyển bối cảnh làm việc (vai trò + phạm vi) — gọi thật
 * POST /auth/switch-context (cấp JWT mới) rồi refetch /auth/me, không chỉ
 * đổi label cục bộ. Danh sách lựa chọn từ `contexts` (seed từ login,
 * sau đó đồng bộ lại từ available_contexts của /auth/me).
 */
export function ContextSwitcher() {
  const contexts = useAuthStore((s) => s.contexts);
  const current = useAuthStore((s) => s.currentContext);
  const switchContext = useSwitchContext();

  if (!current) return null;

  const label = (
    <Space size={6}>
      <ApartmentOutlined style={layoutStyles.contextSwitcherIcon} />
      <span style={layoutStyles.contextSwitcherLabel}>{current.role_name}</span>
      <Tag color="purple" style={layoutStyles.contextSwitcherTag}>
        {getScopeName(current)}
      </Tag>
    </Space>
  );

  // Chỉ có 1 bối cảnh: hiển thị tĩnh, không cần dropdown.
  if (contexts.length <= 1) {
    return label;
  }

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
            role_id: ctx.role_id,
            org_unit_id: ctx.org_unit_id,
            department_id: ctx.department_id,
            warehouse_id: ctx.warehouse_id,
          },
          {
            onError: () => {
              toast.error(
                "Không thể chuyển bối cảnh hoạt động, vui lòng thử lại.",
              );
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
