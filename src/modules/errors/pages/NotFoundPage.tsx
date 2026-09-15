/**
 * 404 — catch-all thay cho việc redirect lặng lẽ về "/" (che mất URL sai, khó
 * debug). Trang render TRONG MainLayout nên vẫn còn sidebar/topbar để đi tiếp;
 * shell đã lo nền và chiều cao nên ở đây chỉ canh giữa vùng nội dung.
 */
import { useNavigate } from "react-router-dom";
import { Box, UiButton, UiStateSurface } from "@/shared/ui";
import { DASHBOARD_CANONICAL } from "@/shared/constants/routes";
import { useT } from "@/shared/i18n/useT";

export function NotFoundPage() {
  const t = useT();
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
        title={t("errors.notFound.title")}
        description={t("errors.notFound.description")}
        action={
          <UiButton onClick={() => navigate(DASHBOARD_CANONICAL)}>
            {t("errors.notFound.goHome")}
          </UiButton>
        }
      />
    </Box>
  );
}
