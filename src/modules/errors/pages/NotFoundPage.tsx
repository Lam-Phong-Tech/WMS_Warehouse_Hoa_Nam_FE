/**
 * 404 — catch-all thay cho việc redirect lặng lẽ về "/" (che mất URL sai, khó
 * debug). Trang render TRONG MainLayout nên vẫn còn sidebar/topbar để đi tiếp;
 * shell đã lo nền và chiều cao nên ở đây chỉ canh giữa vùng nội dung.
 */
import { useNavigate } from "react-router-dom";
import { Box, UiButton, UiStateSurface } from "@/shared/ui";
import { ROUTES } from "@/shared/constants/routes";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        minHeight: 420,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 3,
      }}
      data-testid="not-found-page"
    >
      <UiStateSurface
        kind="empty"
        title="Không tìm thấy trang (404)"
        description="Đường dẫn không tồn tại hoặc đã bị di chuyển. Kiểm tra lại đường dẫn hoặc quay về trang chính."
        action={
          <UiButton onClick={() => navigate(ROUTES.DASHBOARD)}>
            Về trang chính
          </UiButton>
        }
      />
    </Box>
  );
}
