import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  UiStatusBadge,
  SEMANTIC_LIGHT as S,
  RADIUS,
  TYPOGRAPHY,
} from "@/shared/ui";
import dayjs from "dayjs";
import { useCan, useCanAny } from "@/shared/components/permission";
import { ROUTES } from "@/shared/constants/routes";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import {
  ExportOutlined,
  SafetyCertificateOutlined,
  StockOutlined,
} from "@/shared/components/icons";
import { fetchOutboundDocuments } from "@/modules/outbound/services/mvpOutboundService";
import { fetchWarrantyCases } from "@/modules/warranty/services/warrantyService";
import { fetchPutawayTasks } from "@/modules/putaway/services/putawayService";
import type { WarrantyCaseStatus } from "@/modules/warranty/types";

const OPEN_WARRANTY_STATUSES: WarrantyCaseStatus[] = [
  "RECEIVED",
  "CHECKING",
  "REPAIRING",
];
const OPEN_WARRANTY_PER_PAGE = 50;

function ActionRow({
  icon,
  color,
  softColor,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  color: string;
  /** Nền nhạt cùng dải với `color` — token *Soft (thay `${color}1a`). */
  softColor: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      onClick={onClick}
      sx={{
        alignItems: "center",
        cursor: "pointer",
        py: 1,
        borderBottom: `1px solid ${S.border}`,
        "&:last-child": { borderBottom: 0 },
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          flex: "none",
          borderRadius: `${RADIUS.card}px`,
          display: "grid",
          placeItems: "center",
          color,
          bgcolor: softColor,
        }}
        aria-hidden="true"
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            fontWeight: 700,
            color: S.textHigh,
          }}
        >
          {title}
        </Box>
        <Box sx={{ fontSize: 12, color: S.textMedium }}>{subtitle}</Box>
      </Box>
    </Stack>
  );
}

/**
 * "Cần xử lý" — mỗi mục tự kiểm tra quyền (route Dashboard không có
 * RequirePermission) và tự ẩn nếu thiếu quyền hoặc query lỗi, không hiện lỗi
 * 403 xấu cho người dùng.
 */
export function DashboardActionItems() {
  const navigate = useNavigate();
  const canViewOutbound = useCan("outbound.view");
  const canViewWarranty = useCanAny(["warranty.view", "warranty.manage"]);
  const canViewPutaway = useCanAny(["container.view", "putaway.view"]);

  const draftOutboundQuery = useQuery({
    queryKey: ["dashboard", "action-items", "outbound-draft"],
    queryFn: () => fetchOutboundDocuments({ status: "DRAFT", per_page: 1 }),
    enabled: canViewOutbound,
    staleTime: 60_000,
  });

  const openWarrantyQuery = useQuery({
    queryKey: ["dashboard", "action-items", "warranty-open"],
    queryFn: async () => {
      const pages = await Promise.all(
        OPEN_WARRANTY_STATUSES.map((status) =>
          fetchWarrantyCases({ status, per_page: OPEN_WARRANTY_PER_PAGE }),
        ),
      );
      const cases = pages.flatMap((page) => page.data);
      const truncated = pages.some(
        (page) => Number(page.meta?.total ?? 0) > OPEN_WARRANTY_PER_PAGE,
      );
      // "Quá hạn" = còn mở (RECEIVED/CHECKING/REPAIRING) và đã qua ngày dự kiến
      // hoàn thành (estimated_completion_date/expected_completion_date) — dùng
      // đúng field nghiệp vụ có sẵn, không tự đặt ngưỡng số ngày.
      const overdue = cases
        .filter((item) => {
          const dueDate =
            item.estimated_completion_date ?? item.expected_completion_date;
          return Boolean(dueDate) && dayjs(dueDate).isBefore(dayjs(), "day");
        })
        .sort((a, b) => {
          const dueA =
            a.estimated_completion_date ?? a.expected_completion_date;
          const dueB =
            b.estimated_completion_date ?? b.expected_completion_date;
          return dayjs(dueA).valueOf() - dayjs(dueB).valueOf();
        });
      return {
        totalOpen: cases.length,
        overdueCount: overdue.length,
        truncated,
        mostOverdue: overdue[0],
      };
    },
    enabled: canViewWarranty,
    staleTime: 60_000,
  });

  const putawayQuery = useQuery({
    queryKey: ["dashboard", "action-items", "putaway-pending"],
    queryFn: () => fetchPutawayTasks({ status: "RECEIVED_PENDING_PUTAWAY" }),
    enabled: canViewPutaway,
    staleTime: 60_000,
  });

  const draftTotal = Number(draftOutboundQuery.data?.meta?.total ?? 0);
  const putawayTotal = putawayQuery.data?.length ?? 0;
  const openWarranty = openWarrantyQuery.data;
  const mostOverdueDueDate = openWarranty?.mostOverdue
    ? (openWarranty.mostOverdue.estimated_completion_date ??
      openWarranty.mostOverdue.expected_completion_date)
    : null;
  const mostOverdueDays = mostOverdueDueDate
    ? dayjs().diff(dayjs(mostOverdueDueDate), "day")
    : null;

  const rows: Array<{
    id: string;
    icon: React.ReactNode;
    color: string;
    softColor: string;
    title: string;
    subtitle: string;
    onClick: () => void;
  }> = [];

  if (canViewOutbound && draftOutboundQuery.isSuccess && draftTotal > 0) {
    rows.push({
      id: "outbound-draft",
      icon: <ExportOutlined />,
      color: CHART_COLORS.warning,
      softColor: S.warningSoft,
      title: `${draftTotal} phiếu xuất đang chờ hoàn tất`,
      subtitle: "Trạng thái DRAFT — chưa Post Issue",
      onClick: () => navigate(ROUTES.OUTBOUND),
    });
  }

  if (
    canViewWarranty &&
    openWarrantyQuery.isSuccess &&
    (openWarranty?.overdueCount ?? 0) > 0
  ) {
    rows.push({
      id: "warranty-overdue",
      icon: <SafetyCertificateOutlined />,
      color: CHART_COLORS.danger,
      softColor: S.errorSoft,
      title: `${openWarranty?.overdueCount} case bảo hành quá hạn`,
      subtitle:
        mostOverdueDays !== null
          ? `Trễ nhất (${openWarranty?.mostOverdue?.case_code}) đã ${mostOverdueDays} ngày so với ngày dự kiến${openWarranty?.truncated ? " · trong tối đa " + OPEN_WARRANTY_PER_PAGE * OPEN_WARRANTY_STATUSES.length + " case đang mở" : ""}`
          : "",
      onClick: () => navigate(ROUTES.WARRANTY),
    });
  }

  if (canViewPutaway && putawayQuery.isSuccess && putawayTotal > 0) {
    rows.push({
      id: "putaway-pending",
      icon: <StockOutlined />,
      color: CHART_COLORS.info,
      softColor: S.infoSoft,
      title: `${putawayTotal} box linh kiện chờ Putaway`,
      subtitle: "Chưa xếp vào khay/vị trí",
      onClick: () => navigate(ROUTES.PUTAWAY),
    });
  }

  if (!canViewOutbound && !canViewWarranty && !canViewPutaway) return null;

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: S.bgSurface,
        border: `1px solid ${S.border}`,
        borderRadius: `${RADIUS.card}px`,
      }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 1,
        }}
      >
        <Box>
          <Box
            component="h3"
            sx={{
              m: 0,
              fontSize: TYPOGRAPHY.fontSizeBody,
              fontWeight: 700,
              color: S.textHigh,
            }}
          >
            Cần xử lý
          </Box>
          <Box sx={{ fontSize: 12, color: S.textMedium }}>
            Các mục cần người vận hành chú ý
          </Box>
        </Box>
        {rows.length > 0 ? (
          <UiStatusBadge tone="warning" label={rows.length} />
        ) : null}
      </Stack>
      {rows.length === 0 ? (
        <Box
          sx={{
            mt: 1,
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            color: S.textMedium,
          }}
        >
          Không có mục nào cần xử lý.
        </Box>
      ) : (
        <Stack sx={{ mt: 0.5 }}>
          {rows.map((row) => (
            <ActionRow key={row.id} {...row} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
