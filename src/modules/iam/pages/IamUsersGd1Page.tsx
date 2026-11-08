import { IamEffectivePermissionsScreen } from "./IamEffectivePermissionsScreen";
import type { IamUser } from "../types/iam.types";
import "./iam-users.css";
import "./iam-reference.css";
import { useT } from "@/shared/i18n/useT";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  UiTabs,
  UiTabPanel,
  type UiTabItem,
  useUiConfirm,
} from "@/shared/ui";
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
  const t = useT();
  // Deep-link ?screen=IAM-02 (mở modal tạo user) — trước đây do MainLayout
  // renderMvpScreen xử lý; sau khi gỡ bypass (SEC-RBAC-01) page tự đọc param.
  const [searchParams] = useSearchParams();
  const openCreateFromScreen = searchParams.get("screen") === "IAM-02";
  const canViewRoles = useCan(P.IAM_ROLE_VIEW);
  const canManageRoles = useCan(P.IAM_ROLE_MANAGE);
  const showRolesTab = canViewRoles || canManageRoles;
  const [tab, setTab] = useState<"users" | "roles" | "effective">("users");
  const [selectedRole, setSelectedRole] = useState("");
  const [initialViewingUser, setInitialViewingUser] = useState<IamUser | null>(
    null,
  );
  const [roleDirty, setRoleDirty] = useState(false);
  const { confirm, confirmDialog } = useUiConfirm();
  const activeTab = tab === "roles" && !showRolesTab ? "users" : tab;

  const tabItems: UiTabItem[] = [
    {
      key: "users",
      label: (
        <TabLabel
          icon={<UserOutlined style={{ fontSize: 15 }} />}
          text={t("iam.userUi.title")}
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
                text={t("iam.roleUi.title")}
              />
            ),
          },
        ]
      : []),
    { key: "effective", label: t("iam.userUi.effectiveTitle") },
  ];

  const navigation = (
    <Box className="hn-iam-tabs" sx={{ minWidth: 0 }}>
      <UiTabs
        items={tabItems}
        value={activeTab}
        onChange={async (key) => {
          if (key === activeTab) return;
          if (
            activeTab === "roles" &&
            roleDirty &&
            !(await confirm({
              title: t("iam.roleUi.discardTitle"),
              content: t("iam.roleUi.discardBody"),
              confirmText: t("iam.roleUi.discard"),
              cancelText: t("iam.roleUi.keepEditing"),
              tone: "danger",
            }))
          )
            return;
          setRoleDirty(false);
          setInitialViewingUser(null);
          setTab(key as "users" | "roles" | "effective");
        }}
      />
    </Box>
  );
  return (
    <div className="hn-iam-page">
      <UiTabPanel value={activeTab} sx={{ minWidth: 0 }}>
        {activeTab === "roles" ? (
          <IamRolePermissionScreen
            navigation={navigation}
            onDirtyChange={setRoleDirty}
            onViewUsers={(roleId) => {
              setRoleDirty(false);
              setInitialViewingUser(null);
              setSelectedRole(roleId);
              setTab("users");
            }}
          />
        ) : activeTab === "effective" ? (
          <IamEffectivePermissionsScreen
            navigation={navigation}
            onViewUser={(user) => {
              setInitialViewingUser(user);
              setTab("users");
            }}
          />
        ) : (
          <IamUserScreen
            key={activeTab + selectedRole + (initialViewingUser?.user_id ?? "")}
            initialViewingUser={initialViewingUser}
            initialRoleFilter={selectedRole}
            navigation={navigation}
            openCreateOnMount={
              activeTab === "users" &&
              (openCreateOnMount || openCreateFromScreen)
            }
          />
        )}
      </UiTabPanel>
      {confirmDialog}
    </div>
  );
}
