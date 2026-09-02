import { useNavigate } from "react-router-dom";
import { Box, Stack, UiDescriptions, UiStatusBadge } from "@/shared/ui";
import { NoPermissionState } from "@/shared/components/feedback/NoPermissionState";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * Trang 403 - Không có quyền truy cập.
 * Route: /errors/403
 */
export function NoPermissionPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const permissionCodes = useAuthStore((s) => s.permissionCodes);

  return (
    // Trang render TRONG MainLayout nên không tự vẽ nền/chiều cao toàn màn:
    // shell đã lo nền, sidebar và topbar.
    <Box
      sx={{
        minHeight: 420,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 3,
      }}
    >
      <Box sx={{ maxWidth: 600, width: "100%" }}>
        <NoPermissionState
          title="Không có quyền truy cập"
          description={
            <>
              Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị
              viên để được cấp quyền phù hợp.
              {user && (
                <Box sx={{ marginTop: "12px", textAlign: "left" }}>
                  <UiDescriptions
                    columns={1}
                    items={[
                      {
                        label: "Tài khoản",
                        value: user.name || user.email,
                      },
                      {
                        label: "Email",
                        value: user.email,
                      },
                      {
                        label: "Quyền hiện tại",
                        value:
                          permissionCodes.length > 0 ? (
                            <Stack
                              direction="row"
                              spacing={0.5}
                              sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                            >
                              {permissionCodes.slice(0, 5).map((code) => (
                                <UiStatusBadge
                                  key={code}
                                  tone="info"
                                  label={code}
                                />
                              ))}
                              {permissionCodes.length > 5 && (
                                <UiStatusBadge
                                  tone="neutral"
                                  label={`+${permissionCodes.length - 5} khác`}
                                />
                              )}
                            </Stack>
                          ) : (
                            <UiStatusBadge
                              tone="error"
                              label="Chưa có quyền nào"
                            />
                          ),
                      },
                    ]}
                  />
                </Box>
              )}
            </>
          }
          actionText="Quay lại"
          onAction={() => navigate(-1)}
          showHomeButton={true}
        />
      </Box>
    </Box>
  );
}
