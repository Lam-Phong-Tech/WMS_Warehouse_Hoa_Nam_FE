/**
 * 404 — Part 4 (đóng NAV-02): catch-all trước đây redirect lặng lẽ về "/",
 * che mất URL sai và làm khó debug. Trang này render bare (ngoài MainLayout)
 * để hoạt động cho cả người dùng chưa đăng nhập.
 */
import { useNavigate } from "react-router-dom";
import {
  Box,
  SEMANTIC_LIGHT as S,
  UiButton,
  UiStateSurface,
} from "@/shared/ui";
import { ROUTES } from "@/shared/constants/routes";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: S.bgCanvas,
      }}
      data-testid="not-found-page"
    >
      <UiStateSurface
        kind="empty"
        title="Không tìm thấy trang (404)"
        description="Đường dẫn không tồn tại hoặc đã bị di chuyển. Kiểm tra lại URL hoặc quay về trang chính."
        action={
          <UiButton onClick={() => navigate(ROUTES.DASHBOARD)}>
            Về trang chính
          </UiButton>
        }
      />
    </Box>
  );
}
