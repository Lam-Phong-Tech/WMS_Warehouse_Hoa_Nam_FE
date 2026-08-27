import { useState } from "react";
import { Avatar, Space, Typography } from "antd";
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  LogoutOutlined,
  UserOutlined,
  ProfileOutlined,
} from "@/shared/components/icons";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import { BRAND } from "@/app/theme";
import { layoutStyles } from "@/app/layouts/layout.styles";
import { ROUTES } from "@/shared/constants/routes";

interface Props {
  /** Ẩn tên cạnh avatar trên màn nhỏ. */
  compact?: boolean;
}

/** Avatar + dropdown hồ sơ người dùng (tên · chức vụ/phòng ban/đơn vị) + đăng xuất. */
export function UserMenu({ compact = false }: Props) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const logout = useLogout();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const displayName =
    profile?.name ?? user?.name ?? user?.code ?? user?.email ?? "Người dùng";

  const positionInfo = [
    profile?.position?.name,
    profile?.department?.name,
    profile?.branch?.name ?? profile?.company?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  const userEmail = profile?.email ?? user?.email;

  const handleClose = () => setAnchorEl(null);

  const handleLogout = () => {
    handleClose();
    logout.mutate(undefined, {
      onSuccess: () => toast.success("Đăng xuất thành công"),
    });
  };

  return (
    <>
      <Space
        style={layoutStyles.userMenuClickable}
        tabIndex={0}
        role="button"
        aria-haspopup="menu"
        aria-controls={open ? "user-menu" : undefined}
        aria-expanded={open || undefined}
        aria-label={`Menu tài khoản của ${displayName}`}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.currentTarget.click();
          }
        }}
      >
        <Avatar
          style={{
            background: BRAND.primary,
            verticalAlign: "middle",
            flexShrink: 0,
          }}
          icon={<UserOutlined />}
          size={compact ? "default" : 36}
        />
        {!compact && (
          <div style={{ lineHeight: 1.3 }}>
            <Typography.Text strong style={{ fontSize: 14, display: "block" }}>
              {displayName}
            </Typography.Text>
            {positionInfo && (
              <Typography.Text
                type="secondary"
                style={{ fontSize: 11, display: "block" }}
              >
                {positionInfo}
              </Typography.Text>
            )}
          </div>
        )}
      </Space>
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <div style={layoutStyles.userMenuProfile}>
          <div style={{ padding: "6px 16px" }}>
            <div style={layoutStyles.userMenuProfileName}>{displayName}</div>
            {userEmail && (
              <Typography.Text
                type="secondary"
                style={layoutStyles.userMenuProfileMeta}
              >
                {userEmail}
              </Typography.Text>
            )}
            {positionInfo && (
              <div>
                <Typography.Text
                  type="secondary"
                  style={layoutStyles.userMenuProfileMeta}
                >
                  {positionInfo}
                </Typography.Text>
              </div>
            )}
          </div>
        </div>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => {
            handleClose();
            navigate(ROUTES.PROFILE);
          }}
        >
          <ListItemIcon>
            <ProfileOutlined />
          </ListItemIcon>
          <ListItemText>Thông tin tài khoản</ListItemText>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          disabled={logout.isPending}
          onClick={handleLogout}
          sx={{ color: BRAND.danger }}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            <LogoutOutlined />
          </ListItemIcon>
          <ListItemText>Đăng xuất</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
