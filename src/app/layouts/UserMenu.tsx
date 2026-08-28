/** Nội bộ render bằng design-system foundation (Part 4) — public API giữ nguyên. */
import { useState } from "react";
import { LogoutOutlined, ProfileOutlined } from "@/shared/components/icons";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
  UiAvatar,
} from "@/shared/ui";
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
      <Box
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
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          cursor: "pointer",
          borderRadius: 1.5,
          padding: "4px 6px",
          "&:hover": { backgroundColor: S.primarySoft },
          "&:focus-visible": { outline: "none", boxShadow: S.focusRing },
        }}
      >
        <UiAvatar name={displayName} size={compact ? "md" : "md"} />
        {!compact && (
          <Box sx={{ lineHeight: 1.3, minWidth: 0 }}>
            <Box
              sx={{
                fontSize: 14,
                fontWeight: 600,
                color: S.textHigh,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </Box>
            {positionInfo && (
              <Box
                sx={{
                  fontSize: 11,
                  color: S.textMedium,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {positionInfo}
              </Box>
            )}
          </Box>
        )}
      </Box>
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ padding: "6px 16px", maxWidth: 280 }}>
          <Box sx={{ fontWeight: 600, color: S.textHigh }}>{displayName}</Box>
          {userEmail && (
            <Box
              sx={{
                fontSize: TYPOGRAPHY.fontSizeSecondary,
                color: S.textMedium,
              }}
            >
              {userEmail}
            </Box>
          )}
          {positionInfo && (
            <Box
              sx={{
                fontSize: TYPOGRAPHY.fontSizeSecondary,
                color: S.textMedium,
              }}
            >
              {positionInfo}
            </Box>
          )}
        </Box>
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
          sx={{ color: S.error }}
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
