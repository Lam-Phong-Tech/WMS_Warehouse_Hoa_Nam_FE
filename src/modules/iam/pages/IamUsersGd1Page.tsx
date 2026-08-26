import { Tabs } from "antd";
import { IamRolePermissionScreen } from "@/modules/iam/pages/IamRolePermissionScreen";
import { IamUserScreen } from "@/modules/iam/pages/IamUserScreen";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

export interface IamUsersGd1PageProps {
  openCreateOnMount?: boolean;
}

export function IamUsersGd1Page({ openCreateOnMount }: IamUsersGd1PageProps) {
  const canViewRoles = useCan(P.IAM_ROLE_VIEW);
  const canManageRoles = useCan(P.IAM_ROLE_MANAGE);

  return (
    <Tabs
      defaultActiveKey="users"
      items={[
        {
          key: "users",
          label: "Người dùng & phân quyền",
          children: <IamUserScreen openCreateOnMount={openCreateOnMount} />,
        },
        // Gộp màn /system/roles vào đây theo yêu cầu quy hoạch chung; route
        // cũ vẫn giữ cho deep-link. Tab ẩn với tài khoản không có quyền role.
        ...(canViewRoles || canManageRoles
          ? [
              {
                key: "roles",
                label: "Vai trò & ma trận quyền",
                children: <IamRolePermissionScreen />,
              },
            ]
          : []),
      ]}
    />
  );
}
