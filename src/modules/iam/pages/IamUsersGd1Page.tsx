import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, UiTabs, type UiTabItem } from "@/shared/ui";
import {
  SafetyCertificateOutlined,
  UserOutlined,
} from "@/shared/components/icons";
import { IamRolePermissionScreen } from "@/modules/iam/pages/IamRolePermissionScreen";
import { IamUserScreen } from "@/modules/iam/pages/IamUserScreen";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

export interface IamUsersGd1PageProps {
  openCreateOnMount?: boolean;
}

/** Nhãn tab kèm icon — UiTabs nhận label ReactNode nên icon ghép ngay trong label. */
function TabLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
    >
      {icon}
      <span>{text}</span>
    </Box>
  );
}

export function IamUsersGd1Page({ openCreateOnMount }: IamUsersGd1PageProps) {
  // Deep-link ?screen=IAM-02 (mở modal tạo user) — trước đây do MainLayout
  // renderMvpScreen xử lý; sau khi gỡ bypass (SEC-RBAC-01) page tự đọc param.
  const [searchParams] = useSearchParams();
  const openCreateFromScreen = searchParams.get("screen") === "IAM-02";
  const canViewRoles = useCan(P.IAM_ROLE_VIEW);
  const canManageRoles = useCan(P.IAM_ROLE_MANAGE);
  const showRolesTab = canViewRoles || canManageRoles;
  const [tab, setTab] = useState<"users" | "roles">("users");
  const activeTab = tab === "roles" && !showRolesTab ? "users" : tab;

  const tabItems: UiTabItem[] = [
    {
      key: "users",
      label: (
        <TabLabel
          icon={<UserOutlined style={{ fontSize: 15 }} />}
          text="Người dùng & phân quyền"
        />
      ),
    },
    ...(showRolesTab
      ? [
          {
            key: "roles",
            label: (
              <TabLabel
                icon={<SafetyCertificateOutlined style={{ fontSize: 15 }} />}
                text="Vai trò & ma trận quyền"
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <Box sx={{ marginBottom: 2 }}>
        <UiTabs
          items={tabItems}
          value={activeTab}
          onChange={(key) => setTab(key as "users" | "roles")}
        />
      </Box>

      {activeTab === "users" ? (
        <IamUserScreen
          openCreateOnMount={openCreateOnMount || openCreateFromScreen}
        />
      ) : (
        <IamRolePermissionScreen />
      )}
    </>
  );
}
