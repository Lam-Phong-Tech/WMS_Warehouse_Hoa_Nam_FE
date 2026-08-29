import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  UiStatusBadge,
  SEMANTIC_LIGHT as S,
  RADIUS,
  type UiStatusTone,
} from "@/shared/ui";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ActionButton } from "@/shared/components/actions";
import { ROUTES } from "@/shared/constants/routes";
import {
  fetchAllPutawayTrays,
  type TrayOption,
} from "@/modules/putaway/services/putawayService";

/**
 * PTW-OVERVIEW — Màn TỔNG QUAN khay (read-only).
 *
 * Mục 15 (GHI CHÚ LỖI WMS): trước đây lưới khay chỉ hiện BÊN TRONG dialog "Tạo
 * lệnh xếp khay", nên không có chỗ chỉ để XEM tình trạng khay. Màn này tách
 * hẳn "xem tổng quan" khỏi "thao tác chọn khay": không tạo/sửa/xếp, chỉ liệt kê
 * mọi khay kèm trạng thái (Trống / Đang chứa / Cần chú ý) và cho lọc nhanh.
 */

type TrayBucket = "EMPTY" | "PARTIAL" | "ATTENTION";

const BUCKET_META: Record<
  TrayBucket,
  { label: string; tone: UiStatusTone; soft: string; color: string }
> = {
  EMPTY: {
    label: "Trống",
    tone: "success",
    soft: S.successSoft,
    color: S.successText,
  },
  PARTIAL: {
    label: "Đang chứa",
    tone: "info",
    soft: S.infoSoft,
    color: S.infoText,
  },
  ATTENTION: {
    label: "Cần chú ý",
    tone: "warning",
    soft: S.warningSoft,
    color: S.warningText,
  },
};

/** Trạng thái khay thật (EMPTY/PARTIAL) gom về 3 nhóm; còn lại (CLOSED/ISSUED/
 *  FULL...) là "cần chú ý" để người quản lý rà nhanh. */
function bucketOf(status: string): TrayBucket {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "EMPTY") return "EMPTY";
  if (normalized === "PARTIAL") return "PARTIAL";
  return "ATTENTION";
}

const KPI_ORDER: Array<TrayBucket | "ALL"> = [
  "ALL",
  "EMPTY",
  "PARTIAL",
  "ATTENTION",
];

export default function TrayOverviewPage() {
  const traysQuery = useQuery({
    queryKey: ["putaway", "trays", "overview"],
    queryFn: fetchAllPutawayTrays,
  });

  const [keyword, setKeyword] = useState("");
  const [bucketFilter, setBucketFilter] = useState<TrayBucket | "ALL">("ALL");

  const trays = useMemo(() => traysQuery.data ?? [], [traysQuery.data]);

  const counts = useMemo(() => {
    const base = { ALL: trays.length, EMPTY: 0, PARTIAL: 0, ATTENTION: 0 };
    for (const tray of trays) base[bucketOf(tray.status)] += 1;
    return base;
  }, [trays]);

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return trays.filter((tray) => {
      if (bucketFilter !== "ALL" && bucketOf(tray.status) !== bucketFilter) {
        return false;
      }
      if (needle) {
        const haystack =
          `${tray.container_code} ${tray.zone_code ?? ""} ${tray.location_hint ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [trays, bucketFilter, keyword]);

  /** Nhóm theo khu vực (zone) để người quản lý đọc theo bố trí kho. */
  const grouped = useMemo(() => {
    const map = new Map<string, TrayOption[]>();
    for (const tray of filtered) {
      const zone = tray.zone_code || "Chưa gán khu vực";
      const bucket = map.get(zone);
      if (bucket) bucket.push(tray);
      else map.set(zone, [tray]);
    }
    return [...map.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "vi", { numeric: true }),
    );
  }, [filtered]);

  return (
    <Box sx={{ p: 3 }} data-testid="ptw-tray-overview">
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box>
          <Box
            component="h1"
            sx={{
              fontSize: 20,
              fontWeight: 700,
              color: S.textHigh,
              m: 0,
            }}
          >
            Tổng quan tình trạng khay
          </Box>
          <Box sx={{ mt: 0.5, fontSize: 13, color: S.textMedium }}>
            Chỉ để xem nhanh khay nào trống, khay nào đang dùng, khay nào cần
            chú ý — không tạo/sửa/xếp khay tại đây.
          </Box>
        </Box>
        <RouterLink to={ROUTES.PUTAWAY} style={{ textDecoration: "none" }}>
          <ActionButton kind="back" label="Về xếp khay" />
        </RouterLink>
      </Stack>

      {/* KPI kiêm bộ lọc nhanh theo nhóm trạng thái */}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
          },
          mb: 2,
        }}
      >
        {KPI_ORDER.map((key) => {
          const active = bucketFilter === key;
          const label = key === "ALL" ? "Tổng số khay" : BUCKET_META[key].label;
          const color = key === "ALL" ? S.primaryDark : BUCKET_META[key].color;
          return (
            <Box
              key={key}
              component="button"
              type="button"
              aria-pressed={active}
              onClick={() => setBucketFilter(active ? "ALL" : key)}
              sx={{
                textAlign: "left",
                cursor: "pointer",
                font: "inherit",
                border: `1px solid ${active ? color : S.border}`,
                borderRadius: `${RADIUS.card}px`,
                bgcolor: S.bgSurface,
                p: 1.5,
                display: "grid",
                gap: 0.5,
                boxShadow: active ? S.shadowCard : "none",
                "&:hover": { borderColor: color },
                "&:focus-visible": {
                  outline: `2px solid ${color}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box sx={{ fontSize: 13, fontWeight: 700, color: S.textHigh }}>
                {label}
              </Box>
              <Box sx={{ fontSize: 26, fontWeight: 700, color }}>
                {counts[key]}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ mb: 2, maxWidth: 320 }}>
        <SearchInput
          placeholder="Tìm theo mã khay / khu vực..."
          aria-label="Tìm khay theo mã hoặc khu vực"
          value={keyword}
          onChange={setKeyword}
        />
      </Box>

      {traysQuery.isError ? (
        <ApiErrorAlert
          error={traysQuery.error}
          title="Không tải được danh sách khay"
          onRetry={() => void traysQuery.refetch()}
        />
      ) : traysQuery.isPending ? (
        <LoadingState tip="Đang tải tình trạng khay…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có khay phù hợp"
          description="Thử bỏ bộ lọc hoặc đổi từ khoá tìm kiếm."
        />
      ) : (
        <Stack spacing={2}>
          {grouped.map(([zone, zoneTrays]) => (
            <Box key={zone}>
              <Box
                sx={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: S.textMedium,
                  mb: 1,
                }}
              >
                {zone} · {zoneTrays.length} khay
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 150px), 1fr))",
                }}
              >
                {zoneTrays.map((tray) => {
                  const bucket = bucketOf(tray.status);
                  const meta = BUCKET_META[bucket];
                  return (
                    <Box
                      key={tray.container_id}
                      data-testid="ptw-tray-cell"
                      data-bucket={bucket}
                      sx={{
                        border: `1px solid ${S.border}`,
                        borderLeft: `4px solid ${meta.color}`,
                        borderRadius: `${RADIUS.card}px`,
                        bgcolor: meta.soft,
                        p: 1.25,
                        display: "grid",
                        gap: 0.5,
                      }}
                    >
                      <Box
                        sx={{
                          fontWeight: 700,
                          color: S.textHigh,
                          fontSize: 14,
                        }}
                      >
                        {tray.container_code}
                      </Box>
                      <UiStatusBadge
                        size="small"
                        tone={meta.tone}
                        label={meta.label}
                      />
                      {tray.location_hint ? (
                        <Box sx={{ fontSize: 12, color: S.textMedium }}>
                          {tray.location_hint}
                        </Box>
                      ) : null}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
