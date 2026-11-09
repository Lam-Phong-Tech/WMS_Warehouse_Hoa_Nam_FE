import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  UiIcon,
  SEMANTIC_LIGHT as S,
  RADIUS,
} from "@/shared/ui";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ActionButton } from "@/shared/components/actions";
import { ROUTES } from "@/shared/constants/routes";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
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
 *
 * Bố cục là một mặt bằng kho 2D nhìn từ trên: zone là khối sàn, khay là
 * footprint phẳng. API chỉ có zone_code/location_hint nên đây là cách trình bày
 * theo nhóm khu vực thật, KHÔNG phải sơ đồ toạ độ vật lý.
 */

type TrayBucket = "EMPTY" | "PARTIAL" | "ATTENTION";

const BUCKET_META: Record<TrayBucket, { color: string }> = {
  EMPTY: {
    color: S.successText,
  },
  PARTIAL: {
    color: S.infoText,
  },
  ATTENTION: {
    color: S.warningText,
  },
};

const BUCKET_ORDER: TrayBucket[] = ["EMPTY", "PARTIAL", "ATTENTION"];

function bucketLabel(t: TranslateFn, bucket: TrayBucket): string {
  if (bucket === "EMPTY") return t("putaway.trayStatus.empty");
  if (bucket === "PARTIAL") return t("putaway.trayStatus.partial");
  return t("putaway.overview.bucketAttention");
}

/** Trạng thái khay thật (EMPTY/PARTIAL) gom về 3 nhóm; còn lại (CLOSED/ISSUED/
 *  FULL...) là "cần chú ý" để người quản lý rà nhanh. */
function bucketOf(status: string): TrayBucket {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "EMPTY") return "EMPTY";
  if (normalized === "PARTIAL") return "PARTIAL";
  return "ATTENTION";
}

function dotShape(bucket: TrayBucket): string {
  return bucket === "ATTENTION" ? "2px" : "50%";
}

const KPI_ORDER: Array<TrayBucket | "ALL"> = [
  "ALL",
  "EMPTY",
  "PARTIAL",
  "ATTENTION",
];

export default function TrayOverviewPage() {
  const t = useT();
  const traysQuery = useQuery({
    queryKey: ["putaway", "trays", "overview"],
    queryFn: fetchAllPutawayTrays,
  });

  const [keyword, setKeyword] = useState("");
  const [bucketFilter, setBucketFilter] = useState<TrayBucket | "ALL">("ALL");

  const trays = useMemo(() => traysQuery.data ?? [], [traysQuery.data]);

  const counts = useMemo(() => {
    const base: Record<TrayBucket | "ALL", number> = {
      ALL: trays.length,
      EMPTY: 0,
      PARTIAL: 0,
      ATTENTION: 0,
    };
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
    const map = new Map<string | null, TrayOption[]>();
    for (const tray of filtered) {
      const zone = tray.zone_code?.trim() || null;
      const bucket = map.get(zone);
      if (bucket) bucket.push(tray);
      else map.set(zone, [tray]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return a.localeCompare(b, "vi", { numeric: true });
      })
      .map(([key, zoneTrays]) => ({
        key,
        label: key ?? t("putaway.overview.zoneUnassigned"),
        unassigned: key === null,
        trays: zoneTrays,
      }));
  }, [filtered, t]);

  const hasActiveFilter = bucketFilter !== "ALL" || keyword.trim() !== "";
  const countsReady = Boolean(traysQuery.data);
  const noTrays = trays.length === 0;

  const clearFilters = () => {
    setBucketFilter("ALL");
    setKeyword("");
  };

  return (
    <Box
      sx={{ position: "relative", px: 3, pb: 3, pt: 0 }}
      data-testid="ptw-tray-overview"
    >
      <Stack
        direction="row"
        sx={{
          // Tiêu đề do shell dựng; đặt nút quay lại ngang hàng trên màn rộng.
          justifyContent: "flex-end",
          alignItems: "center",
          position: { xs: "static", md: "absolute" },
          top: { md: -56 },
          right: { md: 24 },
          mb: { xs: 1.5, md: 0 },
        }}
      >
        <RouterLink to={ROUTES.PUTAWAY} style={{ textDecoration: "none" }}>
          <ActionButton
            kind="back"
            label={t("putaway.overview.backToPutaway")}
          />
        </RouterLink>
      </Stack>

      {/* Dải số liệu kiêm bộ lọc nhanh theo nhóm trạng thái. */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
          },
          border: `1px solid ${S.border}`,
          borderRadius: `${RADIUS.card}px`,
          bgcolor: S.bgSurface,
          boxShadow: S.shadowCard,
          overflow: "hidden",
          mb: 2,
        }}
      >
        {KPI_ORDER.map((key, index) => {
          const active = bucketFilter === key;
          const label =
            key === "ALL"
              ? t("putaway.overview.totalTrays")
              : bucketLabel(t, key);
          const color = key === "ALL" ? S.primaryLight : BUCKET_META[key].color;
          const value = countsReady ? counts[key] : "—";
          return (
            <Box
              key={key}
              component="button"
              type="button"
              aria-pressed={active}
              onClick={() => setBucketFilter(active ? "ALL" : key)}
              sx={{
                position: "relative",
                textAlign: "left",
                cursor: "pointer",
                font: "inherit",
                border: 0,
                borderRight: {
                  xs: index % 2 === 0 ? `1px solid ${S.border}` : "none",
                  md:
                    index === KPI_ORDER.length - 1
                      ? "none"
                      : `1px solid ${S.border}`,
                },
                borderBottom: {
                  xs: index < 2 ? `1px solid ${S.border}` : "none",
                  md: "none",
                },
                bgcolor: active ? S.bgSubtle : S.bgSurface,
                px: { xs: 1.5, md: 2 },
                py: { xs: 1.25, md: 1.5 },
                display: "grid",
                gap: 0.35,
                "&::after": active
                  ? {
                      content: '""',
                      position: "absolute",
                      insetInline: 0,
                      bottom: 0,
                      height: 3,
                      bgcolor: color,
                    }
                  : undefined,
                "&:hover": { bgcolor: S.bgSubtle },
                "&:focus-visible": {
                  outline: `2px solid ${S.infoText}`,
                  outlineOffset: -2,
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  minWidth: 0,
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius:
                      key === "ALL" ? "50%" : dotShape(key),
                    bgcolor: color,
                    flexShrink: 0,
                  }}
                />
                <Box
                  sx={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: S.textMedium,
                    lineHeight: 1.35,
                  }}
                >
                  {label}
                </Box>
              </Box>
              <Box
                data-testid="ptw-kpi-value"
                sx={{
                  fontSize: { xs: 24, md: 26 },
                  lineHeight: 1.1,
                  fontWeight: 700,
                  color,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {value}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box
        sx={{
          position: "relative",
          border: `1px solid ${S.border}`,
          borderRadius: `${RADIUS.card}px`,
          bgcolor: S.bgSurface,
          boxShadow: S.shadowCard,
          overflow: "hidden",
        }}
      >
        <Box
          component="header"
          sx={{
            px: { xs: 1.5, md: 2 },
            py: 1.5,
            borderBottom: `1px solid ${S.border}`,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.25,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              aria-hidden
              sx={{
                width: 32,
                height: 32,
                borderRadius: "6px",
                bgcolor: S.bgSubtle,
                color: S.primaryLight,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <UiIcon name="apps" size="sm" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: S.textStrong,
                  lineHeight: 1.4,
                }}
              >
                {t("putaway.overview.mapTitle")}
              </Box>
              <Box
                sx={{
                  fontSize: 11.5,
                  color: S.textMedium,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {countsReady
                  ? t("putaway.overview.zoneTrayCount", { count: trays.length })
                  : "—"}
              </Box>
            </Box>
          </Box>

          <Box
            role="group"
            aria-label={t("putaway.overview.legendAria")}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 1.25, md: 1.75 },
              flexWrap: "wrap",
            }}
          >
            {BUCKET_ORDER.map((bucket) => (
              <Box
                key={bucket}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: S.textMedium,
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: dotShape(bucket),
                    bgcolor: BUCKET_META[bucket].color,
                    flexShrink: 0,
                  }}
                />
                {bucketLabel(t, bucket)}
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            px: { xs: 1.5, md: 2 },
            py: 1.25,
            borderBottom: `1px solid ${S.border}`,
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Box
            sx={{
              flex: { xs: "1 1 100%", sm: "0 1 340px" },
              minWidth: 0,
            }}
          >
            <SearchInput
              width={340}
              placeholder={t("putaway.overview.searchPlaceholder")}
              aria-label={t("putaway.overview.searchAria")}
              value={keyword}
              onChange={setKeyword}
            />
          </Box>
          {hasActiveFilter ? (
            <ActionButton
              kind="clear"
              label={t("putaway.overview.clearFilters")}
              onClick={clearFilters}
            />
          ) : null}
          {hasActiveFilter ? (
            <Box
              sx={{
                ml: "auto",
                fontSize: 11.5,
                fontWeight: 600,
                color: S.textMedium,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {t("putaway.overview.showingCount", {
                shown: filtered.length,
                total: trays.length,
              })}
            </Box>
          ) : null}
        </Box>

        <Box
          sx={{
            position: "relative",
            p: { xs: 1.5, md: 2 },
            minHeight: 280,
            bgcolor: S.bgCanvas,
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.55,
              backgroundImage: `linear-gradient(to right, ${S.border} 1px, transparent 1px), linear-gradient(to bottom, ${S.border} 1px, transparent 1px)`,
              backgroundSize: "24px 24px",
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              width: 12,
              height: 12,
              borderTop: `1px solid ${S.divider}`,
              borderLeft: `1px solid ${S.divider}`,
              pointerEvents: "none",
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              right: 8,
              bottom: 8,
              width: 12,
              height: 12,
              borderRight: `1px solid ${S.divider}`,
              borderBottom: `1px solid ${S.divider}`,
              pointerEvents: "none",
            }}
          />

          <Box sx={{ position: "relative" }}>
            {traysQuery.isError ? (
              <ApiErrorAlert
                error={traysQuery.error}
                title={t("putaway.overview.loadFailed")}
                onRetry={() => void traysQuery.refetch()}
              />
            ) : traysQuery.isPending ? (
              <LoadingState tip={t("putaway.overview.loadingTip")} />
            ) : filtered.length === 0 ? (
              <Box sx={{ py: 2 }}>
                <EmptyState
                  title={
                    noTrays
                      ? t("putaway.overview.noTraysTitle")
                      : t("putaway.overview.emptyTitle")
                  }
                  description={
                    noTrays
                      ? t("putaway.overview.noTraysDescription")
                      : t("putaway.overview.emptyDescription")
                  }
                >
                  {hasActiveFilter ? (
                    <ActionButton
                      kind="clear"
                      label={t("putaway.overview.clearFilters")}
                      onClick={clearFilters}
                    />
                  ) : null}
                </EmptyState>
              </Box>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  alignItems: "start",
                }}
              >
                {grouped.map((zone) => (
                  <ZoneBlock
                    key={zone.key ?? "__unassigned"}
                    zone={zone}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            px: { xs: 1.5, md: 2 },
            py: 1,
            borderTop: `1px solid ${S.border}`,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Box sx={{ fontSize: 11, color: S.textMedium }}>
            {t("putaway.overview.layoutNote")}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

interface ZoneBlockProps {
  zone: {
    key: string | null;
    label: string;
    unassigned: boolean;
    trays: TrayOption[];
  };
}

function ZoneBlock({ zone }: ZoneBlockProps) {
  const t = useT();
  const distribution = BUCKET_ORDER.map((bucket) => ({
    bucket,
    count: zone.trays.filter((tray) => bucketOf(tray.status) === bucket)
      .length,
  })).filter((item) => item.count > 0);

  return (
    <Box
      component="section"
      aria-label={zone.label}
      sx={{
        minWidth: 0,
        gridColumn: zone.unassigned ? "1 / -1" : "auto",
        border: `1px ${zone.unassigned ? "dashed" : "solid"} ${
          zone.unassigned ? S.textDisabled : S.border
        }`,
        borderRadius: "6px",
        bgcolor: S.bgSurface,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          px: 1.5,
          pt: 1.25,
          pb: 1,
          borderBottom: `1px solid ${S.border}`,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.9,
            minWidth: 0,
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 9,
              height: 9,
              border: `2px solid ${
                zone.unassigned ? S.textDisabled : S.primaryLight
              }`,
              borderRadius: "1px",
              flexShrink: 0,
            }}
          />
          <Box
            component="h3"
            sx={{
              m: 0,
              fontSize: { xs: 12.5, md: 13 },
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: zone.unassigned ? S.textMedium : S.textStrong,
              lineHeight: 1.4,
              overflowWrap: "anywhere",
            }}
          >
            {zone.label}
          </Box>
        </Box>
        <Box
          sx={{
            fontSize: 11.5,
            fontWeight: 600,
            color: S.textMedium,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {t("putaway.overview.zoneTrayCount", { count: zone.trays.length })}
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.5,
          pt: 1,
          pb: 0.75,
        }}
      >
        <Box
          role="img"
          aria-label={t("putaway.overview.zoneDistributionAria", {
            zone: zone.label,
          })}
          sx={{
            flex: 1,
            maxWidth: 480,
            display: "flex",
            height: 4,
            borderRadius: "999px",
            overflow: "hidden",
            bgcolor: S.bgCanvas,
            border: `1px solid ${S.border}`,
          }}
        >
          {distribution.map((item) => (
            <Box
              key={item.bucket}
              sx={{
                width: `${(item.count / zone.trays.length) * 100}%`,
                bgcolor: BUCKET_META[item.bucket].color,
              }}
            />
          ))}
        </Box>
      </Box>

      <Box
        component="ul"
        sx={{
          listStyle: "none",
          m: 0,
          p: 1.5,
          pt: 0.5,
          display: "grid",
          gap: 1,
          gridTemplateColumns:
            "repeat(auto-fill, minmax(min(100%, 148px), 1fr))",
        }}
      >
        {zone.trays.map((tray) => {
          const bucket = bucketOf(tray.status);
          const meta = BUCKET_META[bucket];
          return (
            <Box
              component="li"
              key={tray.container_id}
              data-testid="ptw-tray-cell"
              data-bucket={bucket}
              sx={{
                position: "relative",
                minWidth: 0,
                border: `1px solid ${
                  bucket === "ATTENTION" ? meta.color : S.border
                }`,
                borderRadius: "5px",
                bgcolor: S.bgSurface,
                overflow: "hidden",
                transition:
                  "transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
                "&:hover": {
                  transform: "translateY(-1px)",
                  borderColor: meta.color,
                  boxShadow: S.shadowCard,
                },
                "@media (prefers-reduced-motion: reduce)": {
                  transition: "none",
                  "&:hover": { transform: "none" },
                },
              }}
            >
              <Box
                aria-hidden
                sx={{ height: 3, bgcolor: meta.color }}
              />
              <Box
                sx={{
                  position: "relative",
                  zIndex: 1,
                  p: 1.1,
                  display: "grid",
                  gap: 0.4,
                }}
              >
                <Box
                  sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    color: S.textStrong,
                    overflowWrap: "anywhere",
                  }}
                >
                  {tray.container_code}
                </Box>
                <Box
                  sx={{
                    fontSize: 11.5,
                    lineHeight: 1.35,
                    color: S.textMedium,
                    minHeight: "1.35em",
                    overflowWrap: "anywhere",
                  }}
                >
                  {tray.location_hint || "—"}
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.6,
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1.35,
                    color: meta.color,
                    mt: 0.25,
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: dotShape(bucket),
                      bgcolor: meta.color,
                      flexShrink: 0,
                    }}
                  />
                  {bucketLabel(t, bucket)}
                </Box>
              </Box>
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 5,
                  border: `1px dashed ${S.border}`,
                  borderRadius: "3px",
                  opacity: 0.45,
                  pointerEvents: "none",
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
