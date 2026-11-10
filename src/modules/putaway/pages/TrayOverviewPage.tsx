import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ActionButton } from "@/shared/components/actions";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ROUTES } from "@/shared/constants/routes";
import { Box, Stack, UiSelect } from "@/shared/ui";
import {
  AppstoreOutlined,
  ExpandAltOutlined,
  RightOutlined,
  ShrinkOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@/shared/components/icons";
import { toast } from "sonner";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import {
  fetchAllPutawayTrays,
  type TrayOption,
} from "@/modules/putaway/services/putawayService";
import {
  buildWarehouseLayout,
  bucketOfStatus,
  type TrayBucket,
} from "@/modules/putaway/components/warehouse-map";
import { WarehouseMap } from "@/modules/putaway/components/WarehouseMap";
import { TrayDetailDialog } from "@/modules/putaway/components/TrayDetailDialog";
import { MiniTrayIcon } from "@/modules/putaway/components/MiniTrayIcon";
import "./tray-overview.css";

/**
 * PTW-OVERVIEW — Màn TỔNG QUAN khay (read-only).
 *
 * Mục tiêu: người quản lý đọc nhanh toàn bộ khay theo bức tranh kho được minh
 * họa: zone giống kệ hàng, khay giống thùng chứa trong kệ. API chỉ có
 * zone_code/location_hint nên đây là bố cục minh họa, không phải sơ đồ vị trí
 * thực; xem `putaway.overview.illustrationNote`.
 */

const ALL_ZONES = "__all__";
const SEARCH_ID = "ptw-tray-search";
const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;

const BUCKET_LABEL = {
  ATTENTION: "putaway.overview.bucketAttention",
  PARTIAL: "putaway.trayStatus.partial",
  EMPTY: "putaway.trayStatus.empty",
} as const;

const CHIP_ORDER: ReadonlyArray<TrayBucket | "ALL"> = [
  "ALL",
  "ATTENTION",
  "PARTIAL",
  "EMPTY",
];

function zoneKey(tray: TrayOption): string {
  return tray.zone_code?.trim() || "__unassigned__";
}

function zoneLabel(t: TranslateFn, zone: string): string {
  return zone === "__unassigned__"
    ? t("putaway.overview.zoneUnassigned")
    : zone;
}

function bucketLabel(t: TranslateFn, bucket: TrayBucket): string {
  return t(BUCKET_LABEL[bucket]);
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
  const [selectedTray, setSelectedTray] = useState<TrayOption | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const measureViewport = () => {
    setViewportWidth(viewportRef.current?.clientWidth ?? 0);
  };

  useLayoutEffect(() => {
    measureViewport();
    window.addEventListener("resize", measureViewport);
    return () => window.removeEventListener("resize", measureViewport);
  }, [traysQuery.isPending]);

  const trays = useMemo(() => traysQuery.data ?? [], [traysQuery.data]);

  const zoneOptions = useMemo(() => {
    const zones = new Set<string>();
    for (const tray of trays) zones.add(zoneKey(tray));
    return [...zones]
      .sort((a, b) => {
        if (a === "__unassigned__") return 1;
        if (b === "__unassigned__") return -1;
        return a.localeCompare(b, "vi", { numeric: true });
      })
      .map((zone) => ({ value: zone, label: zoneLabel(t, zone) }));
  }, [t, trays]);

  const zoneCount = zoneOptions.filter(
    (zone) => zone.value !== "__unassigned__",
  ).length;

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return trays.filter((tray) => {
      const bucket = bucketOfStatus(tray.status);
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

  const visibleIds = useMemo(
    () => new Set(filtered.map((tray) => tray.container_id)),
    [filtered],
  );

  const dimmedIds = useMemo(() => {
    const dimmed = new Set<string>();
    for (const tray of trays) {
      if (!visibleIds.has(tray.container_id)) dimmed.add(tray.container_id);
    }
    return dimmed;
  }, [trays, visibleIds]);

  const layout = useMemo(() => buildWarehouseLayout(trays), [trays]);
  const sceneWidth = Math.max(viewportWidth, 1000) * zoom;

  const counts = useMemo(() => {
    const base: Record<TrayBucket | "ALL", number> = {
      ALL: trays.length,
      EMPTY: 0,
      PARTIAL: 0,
      ATTENTION: 0,
    };
    for (const tray of trays) base[bucketOfStatus(tray.status)] += 1;
    return base;
  }, [trays]);

  const unassigned = useMemo(() => layout.unassigned, [layout]);

  const hasActiveFilter =
    bucketFilter !== "ALL" || keyword.trim() !== "" || zoneFilter !== ALL_ZONES;
  const countsReady = Boolean(traysQuery.data);
  const noTrays = trays.length === 0;

  const clearFilters = () => {
    setBucketFilter("ALL");
    setZoneFilter(ALL_ZONES);
    setKeyword("");
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await panelRef.current?.requestFullscreen();
      }
    } catch {
      toast.error(t("putaway.overview.fullscreenFailed"));
    }
  };

  const clampZoom = (value: number) =>
    Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
  const zoomBy = (delta: number) =>
    setZoom((current) => clampZoom(current + delta));

  const fitMap = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const baseWidth = Math.max(viewport.clientWidth, 1000);
    setZoom(
      clampZoom(
        Math.min(
          1,
          viewport.clientWidth / baseWidth,
          720 / (baseWidth * layout.aspect),
        ),
      ),
    );
    viewport.scrollTo({ left: 0, top: 0 });
  };

  const locateTray = (tray: TrayOption) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const escaped = tray.container_code.replace(/["\\]/g, "\\$&");
    // Khay trong map là thẻ <g> (SVGElement) — không được lọc theo
    // HTMLElement, nếu không nhánh locate là dead code.
    const element = viewport.querySelector(`[data-tray="${escaped}"]`);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    viewport.scrollTo({
      left:
        viewport.scrollLeft +
        rect.left -
        bounds.left -
        (viewport.clientWidth - rect.width) / 2,
      top:
        viewport.scrollTop +
        rect.top -
        bounds.top -
        (viewport.clientHeight - rect.height) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    // jsdom không polyfill focus() cho SVGElement — gọi tùy chọn.
    (element as SVGElement).focus?.({ preventScroll: true });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing =
        target !== null && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      const editingSearch = target?.id === SEARCH_ID;
      if (event.key === "/" && !editing && selectedTray === null) {
        const field = document.getElementById(SEARCH_ID);
        if (field instanceof HTMLElement) {
          event.preventDefault();
          field.focus();
        }
        return;
      }
      if (event.key === "Escape" && editingSearch && keyword) {
        setKeyword("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyword, selectedTray]);

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

      <section
        aria-labelledby="ptw-map-title"
        className="hn-tray-panel"
        ref={panelRef}
      >
        <header className="hn-tray-panel-header">
          <Box className="hn-tray-panel-identity">
            <Box className="hn-tray-panel-icon" aria-hidden="true">
              <AppstoreOutlined />
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
          <button
            type="button"
            className="hn-tray-fullscreen"
            aria-pressed={isFullscreen}
            aria-label={
              isFullscreen
                ? t("putaway.overview.fullscreenExit")
                : t("putaway.overview.fullscreen")
            }
            title={
              isFullscreen
                ? t("putaway.overview.fullscreenExit")
                : t("putaway.overview.fullscreen")
            }
            onClick={() => void toggleFullscreen()}
          >
            <ExpandAltOutlined aria-hidden="true" />
            <span className="hn-tray-fullscreen-label">
              {isFullscreen
                ? t("putaway.overview.fullscreenExit")
                : t("putaway.overview.fullscreen")}
            </span>
          </button>
        </header>

        <div className="hn-tray-toolbar">
          <Box
            sx={{ width: { xs: "100%", sm: 340 }, minWidth: 0, maxWidth: 480 }}
          >
            <SearchInput
              width={340}
              placeholder={t("putaway.overview.searchPlaceholder")}
              aria-label={t("putaway.overview.searchAria")}
              value={keyword}
              onChange={setKeyword}
              slotProps={{ htmlInput: { id: SEARCH_ID } }}
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
          {hasActiveFilter ? (
            <ActionButton
              kind="clear"
              label={t("putaway.overview.clearFilters")}
              onClick={clearFilters}
            />
          ) : null}
        </div>

        <div className="hn-tray-filterbar">
          <div
            role="group"
            aria-label={t("putaway.overview.legendAria")}
            className="hn-tray-chips"
          >
            {CHIP_ORDER.map((key) => {
              const active = bucketFilter === key;
              const label =
                key === "ALL"
                  ? t("putaway.overview.chipAll")
                  : bucketLabel(t, key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`hn-tray-chip hn-tray-chip--${key.toLowerCase()}`}
                  aria-pressed={active}
                  data-status={key === "ALL" ? "all" : key}
                  onClick={() => setBucketFilter(active ? "ALL" : key)}
                >
                  <span className="hn-tray-chip-dot" aria-hidden="true" />
                  <span className="hn-tray-chip-text">
                    {label}{" "}
                    <span
                      className="hn-tray-chip-count"
                      data-testid="ptw-legend-count"
                    >
                      {countsReady ? counts[key] : "—"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {countsReady ? (
            <p
              className="hn-tray-result-count"
              role="status"
              aria-live="polite"
            >
              {t("putaway.overview.showingCount", {
                shown: filtered.length,
                total: trays.length,
              })}
            </p>
          ) : null}
        </div>

        <div className="hn-tray-topline">
          <span className="hn-tray-topline-left">
            <strong>{t("putaway.overview.toplineTitle")}</strong>
            <span>{t("putaway.overview.toplineMeta")}</span>
          </span>
          <span className="hn-tray-topline-right">
            {t("putaway.overview.toplineHint")}
          </span>
        </div>

        <div className="hn-tray-map-wrap">
          {traysQuery.isError && traysQuery.data ? (
            <Box sx={{ mb: 1.5, position: "relative", zIndex: 1 }}>
              <ApiErrorAlert
                error={traysQuery.error}
                title={t("putaway.overview.loadFailed")}
                onRetry={() => void traysQuery.refetch()}
              />
            </Box>
          ) : null}

          {traysQuery.isError && !traysQuery.data ? (
            <div className="hn-tray-state">
              <ApiErrorAlert
                error={traysQuery.error}
                title={t("putaway.overview.loadFailed")}
                onRetry={() => void traysQuery.refetch()}
              />
            </div>
          ) : traysQuery.isPending ? (
            <LoadingState tip={t("putaway.overview.loadingTip")} />
          ) : noTrays ? (
            <div className="hn-tray-state">
              <EmptyState
                title={t("putaway.overview.noTraysTitle")}
                description={t("putaway.overview.noTraysDescription")}
              />
            </div>
          ) : (
            <>
              <div
                className="hn-tray-viewport"
                ref={viewportRef}
                tabIndex={0}
                aria-label={t("putaway.overview.mapViewportAria")}
                style={{
                  maxHeight:
                    viewportWidth > 0
                      ? Math.round(Math.min(viewportWidth * layout.aspect, 720))
                      : undefined,
                }}
              >
                <div className="hn-tray-floor" aria-hidden="true" />
                <div
                  className="hn-tray-scene-zoom"
                  style={{ width: `${sceneWidth}px` }}
                >
                  <WarehouseMap
                    layout={layout}
                    dimmedIds={dimmedIds}
                    selectedId={selectedTray?.container_id ?? null}
                    onSelect={setSelectedTray}
                  />
                </div>
                {filtered.length === 0 ? (
                  <div className="hn-tray-no-results" role="status">
                    <strong>{t("putaway.overview.emptyTitle")}</strong>
                    <p>{t("putaway.overview.emptyDescription")}</p>
                    <ActionButton
                      kind="clear"
                      label={t("putaway.overview.clearFilters")}
                      onClick={clearFilters}
                    />
                  </div>
                ) : null}
              </div>
              <div
                className="hn-tray-zoom"
                role="group"
                aria-label={t("putaway.overview.zoomAria")}
              >
                <button
                  type="button"
                  aria-label={t("putaway.overview.zoomOut")}
                  disabled={zoom <= ZOOM_MIN}
                  onClick={() => zoomBy(-ZOOM_STEP)}
                >
                  <ZoomOutOutlined aria-hidden="true" />
                </button>
                <span className="hn-tray-zoom-level">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  aria-label={t("putaway.overview.zoomIn")}
                  disabled={zoom >= ZOOM_MAX}
                  onClick={() => zoomBy(ZOOM_STEP)}
                >
                  <ZoomInOutlined aria-hidden="true" />
                </button>
                <span className="hn-tray-zoom-divider" aria-hidden="true" />
                <button
                  type="button"
                  aria-label={t("putaway.overview.zoomFit")}
                  onClick={fitMap}
                >
                  <ShrinkOutlined aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>

        {unassigned.length > 0 ? (
          <div className="hn-tray-unassigned">
            <div className="hn-tray-unassigned-heading">
              <h3>{t("putaway.overview.zoneUnassigned")}</h3>
              <span>
                {t("putaway.overview.zoneTrayCount", {
                  count: unassigned.length,
                })}
              </span>
            </div>
            <div className="hn-tray-unassigned-list">
              {unassigned.map((tray) => {
                const bucket = bucketOfStatus(tray.status);
                const dimmed = !visibleIds.has(tray.container_id);
                return (
                  <button
                    key={tray.container_id}
                    type="button"
                    className="hn-tray-unassigned-record"
                    data-testid="ptw-unassigned-tray"
                    data-bucket={bucket}
                    aria-label={t("putaway.overview.unassignedRecordAria", {
                      code: tray.container_code,
                      status: bucketLabel(t, bucket),
                    })}
                    disabled={dimmed}
                    onClick={() => setSelectedTray(tray)}
                  >
                    <MiniTrayIcon
                      bucket={bucket}
                      className="hn-tray-unassigned-tray"
                    />
                    <span className="hn-tray-unassigned-text">
                      <strong>{tray.container_code}</strong>
                      <small>{tray.location_hint || "—"}</small>
                    </span>
                    <span
                      className="hn-tray-unassigned-badge"
                      data-bucket={bucket}
                    >
                      {bucketLabel(t, bucket)}
                    </span>
                    <RightOutlined
                      className="hn-tray-unassigned-chevron"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="hn-tray-foot">
          <span className="hn-tray-foot-hint">
            <svg
              className="hn-tray-foot-hint-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.3}
              aria-hidden="true"
            >
              <circle cx={10} cy={10} r={7} />
              <path d="M10 9v5m0-8v1" strokeLinecap="round" />
            </svg>
            {t("putaway.overview.footDisclaimer")}
          </span>
          <span>{t("putaway.overview.footUnassignedNote")}</span>
        </div>
      </section>

      <TrayDetailDialog
        tray={selectedTray}
        onClose={() => setSelectedTray(null)}
        onLocate={locateTray}
      />
    </Box>
  );
}
