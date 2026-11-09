import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ActionButton } from "@/shared/components/actions";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ROUTES } from "@/shared/constants/routes";
import { Box, Stack, UiIcon, UiSelect } from "@/shared/ui";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import {
  fetchAllPutawayTrays,
  type TrayOption,
} from "@/modules/putaway/services/putawayService";
import "./tray-overview.css";

/**
 * PTW-OVERVIEW — Màn TỔNG QUAN khay (read-only).
 *
 * Mục tiêu: người quản lý giả đọc nhanh toàn bộ khay theo bức tranh kho được
 * minh họa: zone giống kệ hàng, khay giống thùng chứa trong kệ. API chỉ có
 * zone_code/location_hint nên đây là bố cục minh họa, không phải sơ đồ vị trí
 * thực; xem `putaway.overview.illustrationNote`.
 */

type TrayBucket = "EMPTY" | "PARTIAL" | "ATTENTION";

const BUCKET_ORDER: TrayBucket[] = ["EMPTY", "PARTIAL", "ATTENTION"];
const BUCKET_LABEL_ICON: Record<TrayBucket, string> = {
  EMPTY: "□",
  PARTIAL: "●",
  ATTENTION: "▲",
};

const BUCKET_META: Record<TrayBucket, { color: string; icon: string }> = {
  EMPTY: { color: "var(--ops-success-text)", icon: BUCKET_LABEL_ICON.EMPTY },
  PARTIAL: { color: "var(--ops-link)", icon: BUCKET_LABEL_ICON.PARTIAL },
  ATTENTION: {
    color: "var(--ops-warning-text)",
    icon: BUCKET_LABEL_ICON.ATTENTION,
  },
};

function bucketLabel(t: TranslateFn, bucket: TrayBucket): string {
  if (bucket === "EMPTY") return t("putaway.trayStatus.empty");
  if (bucket === "PARTIAL") return t("putaway.trayStatus.partial");
  return t("putaway.overview.bucketAttention");
}

/** Trạng thái khay thật (EMPTY/PARTIAL) gom về 3 nhóm; còn lại (CLOSED/ISSUED/
 *  FULL...) là "cần chú ý" để người quản lý rá khu nhanh. */
function bucketOf(status: string): TrayBucket {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "EMPTY") return "EMPTY";
  if (normalized === "PARTIAL") return "PARTIAL";
  return "ATTENTION";
}

const ALL_ZONES = "__all__";

function zoneKey(tray: TrayOption): string {
  return tray.zone_code?.trim() || "__unassigned__";
}

function zoneLabel(t: TranslateFn, zone: string): string {
  return zone === "__unassigned__"
    ? t("putaway.overview.zoneUnassigned")
    : zone;
}

export default function TrayOverviewPage() {
  const t = useT();
  const traysQuery = useQuery({
    queryKey: ["putaway", "trays", "overview"],
    queryFn: fetchAllPutawayTrays,
  });

  const [keyword, setKeyword] = useState("");
  const [bucketFilter, setBucketFilter] = useState<TrayBucket | "ALL">("ALL");
  const [zoneFilter, setZoneFilter] = useState(ALL_ZONES);

  const trays = useMemo(() => traysQuery.data ?? [], [traysQuery.data]);

  const zoneOptions = useMemo(() => {
    const zones = new Set<string>();
    for (const tray of trays) zones.add(zoneKey(tray));
    return [...zones]
      .sort((a, b) => a.localeCompare(b, "vi", { numeric: true }))
      .map((zone) => ({
        value: zone,
        label: zoneLabel(t, zone),
      }));
  }, [t, trays]);

  const zoneCount = zoneOptions.filter(
    (zone) => zone.value !== "__unassigned__",
  ).length;

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return trays.filter((tray) => {
      const bucket = bucketOf(tray.status);
      const zone = zoneKey(tray);
      if (bucketFilter !== "ALL" && bucketFilter !== bucket) return false;
      if (zoneFilter !== ALL_ZONES && zoneFilter !== zone) return false;
      if (needle) {
        const haystack =
          `${tray.container_code} ${tray.zone_code ?? ""} ${tray.location_hint ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [bucketFilter, keyword, trays, zoneFilter]);

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

  const visibleBuckets = BUCKET_ORDER;

  const grouped = useMemo(() => {
    const map = new Map<string, TrayOption[]>();
    for (const tray of filtered) {
      const key = zoneKey(tray);
      const bucket = map.get(key);
      if (bucket) bucket.push(tray);
      else map.set(key, [tray]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === "__unassigned__") return 1;
        if (b === "__unassigned__") return -1;
        return a.localeCompare(b, "vi", { numeric: true });
      })
      .map(([key, zoneTrays]) => ({
        key,
        label: zoneLabel(t, key),
        unassigned: key === "__unassigned__",
        trays: zoneTrays,
      }));
  }, [filtered, t]);

  const hasActiveFilter =
    bucketFilter !== "ALL" || keyword.trim() !== "" || zoneFilter !== ALL_ZONES;
  const countsReady = Boolean(traysQuery.data);
  const noTrays = trays.length === 0;

  const clearFilters = () => {
    setBucketFilter("ALL");
    setZoneFilter(ALL_ZONES);
    setKeyword("");
  };

  return (
    <Box
      className="hn-tray-overview"
      sx={{ position: "relative", px: { xs: 2, md: 3 }, pb: 3, pt: 0 }}
      data-testid="ptw-tray-overview"
    >
      <Stack
        direction="row"
        sx={{
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

      <section aria-labelledby="ptw-map-title" className="hn-tray-wrap">
        <header className="hn-tray-header hn-tray-padded">
          <Box
            className="hn-tray-header-copy"
            sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
          >
            <Box
              aria-hidden
              sx={{
                width: 34,
                height: 34,
                borderRadius: "8px",
                background: "var(--ops-pale)",
                color: "var(--ops-link)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <UiIcon name="apps" size="sm" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <h2 id="ptw-map-title">{t("putaway.overview.mapTitle")}</h2>
              <p>
                {countsReady
                  ? t("putaway.overview.subtitle", {
                      count: trays.length,
                      zones: zoneCount,
                    })
                  : "—"}
              </p>
            </Box>
          </Box>
          <Box className="hn-tray-header-controls">
            <Box sx={{ width: { xs: "100%", sm: 300 }, minWidth: 0 }}>
              <SearchInput
                width={300}
                placeholder={t("putaway.overview.searchPlaceholder")}
                aria-label={t("putaway.overview.searchAria")}
                value={keyword}
                onChange={setKeyword}
              />
            </Box>
            <UiSelect
              value={zoneFilter}
              aria-label={t("putaway.overview.zoneFilterAria")}
              options={[
                { value: ALL_ZONES, label: t("putaway.overview.allZones") },
                ...zoneOptions,
              ]}
              minWidth={150}
              onChange={(value) => setZoneFilter(String(value))}
            />
          </Box>
        </header>

        <Box
          className="hn-tray-toolbar"
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.25,
            borderTop: `1px solid var(--ops-line)`,
          }}
        >
          <div
            role="group"
            aria-label={t("putaway.overview.legendAria")}
            className="hn-tray-legend"
          >
            {visibleBuckets.map((bucket) => {
              const active = bucketFilter === bucket;
              return (
                <button
                  key={bucket}
                  type="button"
                  className="hn-tray-legend-button"
                  aria-pressed={active}
                  onClick={() => setBucketFilter(active ? "ALL" : bucket)}
                >
                  <span
                    className={`hn-tray-legend-dot hn-tray-legend-dot--${bucket.toLowerCase()}`}
                    aria-hidden
                  />
                  {bucketLabel(t, bucket)}
                  {" · "}
                  <span data-testid="ptw-legend-count">
                    {countsReady ? counts[bucket] : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          {hasActiveFilter ? (
            <ActionButton
              kind="clear"
              label={t("putaway.overview.clearFilters")}
              onClick={clearFilters}
            />
          ) : null}
          <Box
            aria-hidden
            sx={{
              ml: "auto",
              color: "var(--ops-muted)",
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: ".02em",
              whiteSpace: "nowrap",
            }}
          >
            {t("putaway.overview.illustrationNote")}
          </Box>
        </Box>

        <div className="hn-tray-canvas">
          <div className="hn-tray-lane" aria-hidden />
          <div
            className="hn-tray-lane"
            aria-hidden
            style={{ marginTop: 320 }}
          />

          <Box sx={{ position: "relative", zIndex: 1 }}>
            {traysQuery.isError && traysQuery.data ? (
              <Box sx={{ mb: 1.5 }}>
                <ApiErrorAlert
                  error={traysQuery.error}
                  title={t("putaway.overview.loadFailed")}
                  onRetry={() => void traysQuery.refetch()}
                />
              </Box>
            ) : null}

            {traysQuery.isError && !traysQuery.data ? (
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
              <>
                <div className="hn-tray-scene">
                  {grouped
                    .filter((group) => !group.unassigned)
                    .map((group, index) => (
                      <section
                        key={group.key}
                        aria-label={group.label}
                        className={`hn-tray-zone${grouped.filter((item) => !item.unassigned).length > 3 && index >= 3 ? " hn-tray-zone--wide" : ""}`}
                      >
                        <h3 className="hn-tray-zone-plate">{group.label}</h3>
                        <div className="hn-tray-rack">
                          {group.trays.map((tray) => {
                            const bucket = bucketOf(tray.status);
                            return (
                              <div
                                key={tray.container_id}
                                className="hn-tray-bin"
                                data-testid="ptw-tray-cell"
                                data-bucket={bucket}
                              >
                                <div className="hn-tray-bin-shell">
                                  <div className="hn-tray-bin-sticker">
                                    <strong className="hn-tray-bin-code">
                                      {tray.container_code}
                                    </strong>
                                    <span className="hn-tray-bin-location">
                                      {tray.location_hint || "—"}
                                    </span>
                                    <span className="hn-tray-bin-status">
                                      <span
                                        className="hn-tray-bin-icon"
                                        aria-hidden
                                      >
                                        {BUCKET_META[bucket].icon}
                                      </span>
                                      {bucketLabel(t, bucket)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                </div>

                {grouped.some((group) => group.unassigned) ? (
                  <section
                    className="hn-tray-unassigned"
                    aria-label={t("putaway.overview.zoneUnassigned")}
                  >
                    <div className="hn-tray-unassigned-header">
                      <h3>
                        {t("putaway.overview.zoneUnassigned")} ·{" "}
                        {grouped.find((group) => group.unassigned)?.trays
                          .length ?? 0}
                      </h3>
                    </div>
                    <div className="hn-tray-unassigned-list">
                      {grouped
                        .find((group) => group.unassigned)
                        ?.trays.map((tray) => {
                          const bucket = bucketOf(tray.status);
                          return (
                            <div
                              className="hn-tray-unassigned-item"
                              key={tray.container_id}
                              data-testid="ptw-tray-cell"
                              data-bucket={bucket}
                            >
                              <div
                                className="hn-tray-unassigned-visual"
                                aria-hidden
                              />
                              <div>
                                <div className="hn-tray-unassigned-code">
                                  {tray.container_code}
                                </div>
                                <div className="hn-tray-unassigned-hint">
                                  {tray.location_hint || "—"}
                                </div>
                                <div className="hn-tray-unassigned-status">
                                  {bucketLabel(t, bucket)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </Box>
        </div>
      </section>
    </Box>
  );
}
