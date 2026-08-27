import { useState } from "react";
import { Tab, Tabs } from "@mui/material";
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

export function IamUsersGd1Page({ openCreateOnMount }: IamUsersGd1PageProps) {
  const canViewRoles = useCan(P.IAM_ROLE_VIEW);
  const canManageRoles = useCan(P.IAM_ROLE_MANAGE);
  const showRolesTab = canViewRoles || canManageRoles;
  const [tab, setTab] = useState<"users" | "roles">("users");
  const activeTab = tab === "roles" && !showRolesTab ? "users" : tab;

  return (
    <>
      <Tabs
        value={activeTab}
        onChange={(_event, value: "users" | "roles") => setTab(value)}
        sx={{ marginBottom: 2 }}
      >
        <Tab
          value="users"
          icon={<UserOutlined style={{ fontSize: 15 }} />}
          iconPosition="start"
          label="Người dùng & phân quyền"
          sx={{ minHeight: 40, textTransform: "none" }}
        />
        {showRolesTab ? (
          <Tab
            value="roles"
            icon={<SafetyCertificateOutlined style={{ fontSize: 15 }} />}
            iconPosition="start"
            label="Vai trò & ma trận quyền"
            sx={{ minHeight: 40, textTransform: "none" }}
          />
        ) : null}
      </Tabs>

      {activeTab === "users" ? (
        <IamUserScreen openCreateOnMount={openCreateOnMount} />
      ) : (
        <IamRolePermissionScreen />
      )}
    </>
  );
}
