import { useMemo, useState } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { Box, Stack, Tooltip, UiStatusBadge } from "@/shared/ui";
import { PALETTE, TYPOGRAPHY, type ThemeModeName } from "@/shared/ui/tokens";
import { useThemeStore } from "@/shared/ui/theme/theme.store";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import type { TrayOption } from "@/modules/putaway/services/putawayService";
import { ActionIconButton } from "@/shared/components/actions";
import { useT, type TranslateFn } from "@/shared/i18n/useT";

export interface TraySelectionGridProps {
  trays: TrayOption[];
  selectedTrayId: string;
  onSelect: (tray: TrayOption) => void;
  loading?: boolean;
  disabled?: boolean;
  onRefresh?: () => void;
  /** Số lượng của box/item đang xếp khay (từ PutawayTask.quantity) — hiển thị ở
   * panel "Khay đã chọn" cho khớp wireframe. Không phải sức chứa của khay. */
  pendingQuantity?: number;
}

const UNGROUPED = "";

/** Giá trị số cho ô heatmap — chỉ 4 mức, tương ứng đúng dữ liệu thật (không suy diễn). */
const CELL_GAP = 0;
const CELL_EMPTY = 1;
const CELL_USED = 2;
const CELL_SELECTED = 3;

/** Kích thước ô nhỏ nhất (px) — theo tỉ lệ landscape của wireframe (~106x82). */
const CELL_MIN_WIDTH = 106;
const CELL_HEIGHT = 88;

/**
 * ApexCharts luôn chừa margin cố định quanh vùng vẽ (chỗ cho trục/nhãn) dù đã
 * ẩn hết label qua xaxis/yaxis.labels.show=false — đo thực tế trên chart 1
 * hàng: khoảng vẽ thật bắt đầu ở (14, 30) và còn ~15px lề dưới. Nếu không bù
 * phần này, khi ít hàng/cột (đúng trường hợp thật hiện tại chỉ 1-2 khay) ô sẽ
 * bị co lại còn ~một nửa CELL_HEIGHT mong muốn — cần cộng thêm hằng số này
 * thay vì suy ra kích thước sai.
 */
const CHART_WIDTH_PADDING = 24;
const CHART_HEIGHT_PADDING = 48;

/**
 * Container/TRAY đã có sẵn trạng thái chiếm dụng EMPTY/PARTIAL (xem
 * putawayService.test.ts) — đây là dữ liệu THẬT trả về từ chính API container
 * list đang tái sử dụng, khác với "capacity/fullness" mà Dev Guide §5 nói
 * KHÔNG cần bổ sung cho endpoint mới. Nên lấy đúng field này để tô màu ô thay
 * vì suy diễn số lượng box (không có trong response).
 */
function trayStatusLabel(t: TranslateFn, status: string): string {
  if (status === "EMPTY") return t("putaway.trayStatus.empty");
  if (status === "PARTIAL") return t("putaway.trayStatus.partial");
  return status;
}

function isOccupied(status: string): boolean {
  return status === "PARTIAL";
}

/** PTW-GRID-03: sort natural theo tray_code (A01, A02, ... A10) thay vì sort chuỗi thuần. */
function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/**
 * Pha màu về trắng ra MÀU ĐẶC (cùng công thức `lighten()` của MUI) — thay cho
 * import `@mui/material/styles` sau khi file chuyển sang đọc token trực tiếp
 * (Part 4 Vuexy sync, biên giới import @/shared/ui).
 */
function lighten(hexColor: string, coefficient: number): string {
  const hex = hexColor.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : hex;
  const num = Number.parseInt(full, 16);
  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * coefficient);
  return `rgb(${mix((num >> 16) & 0xff)}, ${mix((num >> 8) & 0xff)}, ${mix(num & 0xff)})`;
}

// Màu pastel nhạt (nền) + chữ đậm màu — đúng tinh thần 3 tầng màu của
// wireframe (bg nhạt/border đậm/text đậm), thay vì đổ nguyên khối màu bão
// hoà `info.light`/`success.light` mặc định của MUI (khá đậm, không phải
// pastel) trông thô và không đồng bộ phần còn lại của giao diện. Dùng
// `lighten()` (pha trắng ra màu đặc) chứ KHÔNG dùng `alpha()` (rgba trong
// suốt) — đã verify trên browser thật: khi đổi trạng thái ô (chọn khay),
// ApexCharts tween màu rgba bị lỗi hiển thị (fill không đúng ngay sau khi
// đổi), còn màu đặc (kể cả pastel) luôn cập nhật đúng.
/**
 * Lưới khay là heatmap ApexCharts nên cần MÀU THẬT theo chế độ đang hiển thị —
 * mặt tiền `var(--wms-…)` không dùng được ở đây (Apex ghi thẳng vào thuộc tính
 * `fill` của SVG, không phân giải `var()`), và `lighten()` cũng cần hex để pha.
 *
 * Chế độ tối pha về NỀN TỐI thay vì về trắng, nếu không ô đã dùng/đang chọn sẽ
 * loá lên như đèn pin giữa bảng tối.
 */
function trayColorsFor(mode: ThemeModeName) {
  const P = PALETTE[mode];
  const toward = mode === "dark" ? 0.72 : 0.82;
  const blend = mode === "dark" ? darken : lighten;
  return {
    empty: P.bgSurface,
    used: blend(P.info, toward),
    selected: blend(P.success, toward),
    text: P.textHigh,
  };
}

/** Pha màu về đen — bản đối xứng của `lighten()` cho nền tối. */
function darken(hexColor: string, coefficient: number): string {
  const hex = hexColor.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : hex;
  const num = Number.parseInt(full, 16);
  const mix = (channel: number) => Math.round(channel * (1 - coefficient));
  return `rgb(${mix((num >> 16) & 0xff)}, ${mix((num >> 8) & 0xff)}, ${mix(num & 0xff)})`;
}

interface TrayCellPoint {
  x: string;
  y: number;
  code: string;
  trayId: string | null;
  statusLabel: string;
  meta: string;
}

/**
 * Đọc lại data point gốc (kèm code/trayId/statusLabel tự khai) từ
 * `chartContext.w` mà ApexCharts truyền vào events/formatters. Định nghĩa
 * type chính thức của `apexcharts` không khai báo hết field runtime thật
 * (vd `series[i]` có thể là number[] cho chart khác, nhưng heatmap của ta
 * luôn là mảng object) — nên nhận `unknown` rồi tự ép kiểu ở đây thay vì để
 * lỗi type lan ra các chỗ gọi.
 */
function readPoint(
  w: unknown,
  seriesIndex: number | undefined,
  dataPointIndex: number | undefined,
): TrayCellPoint | undefined {
  if (seriesIndex == null || dataPointIndex == null) return undefined;
  const series = (w as { config?: { series?: unknown[] } } | undefined)?.config
    ?.series?.[seriesIndex] as { data?: TrayCellPoint[] } | undefined;
  return series?.data?.[dataPointIndex];
}

/**
 * PTW-GRID-01/03/05 — lưới chọn khay thay cho Autocomplete dạng danh sách sổ
 * xuống, dựng theo HN_Putaway_Tray_Grid_Wireframe_v1.0 và vẽ bằng ApexCharts
 * (heatmap) theo yêu cầu bổ sung 27/08 — trước đó dùng lưới nút MUI thuần.
 * Cell tô màu theo status EMPTY/PARTIAL THẬT của container (không suy diễn số
 * box/sức chứa — API không trả số đó). Click chỉ cập nhật local selection,
 * không gọi API — write thật diễn ra ở bước Confirm.
 *
 * Theo yêu cầu BA (27/08): nhóm các ô theo `zone_code` thành nhiều "hàng"
 * (mỗi hàng = 1 series của heatmap) cho giống bố cục A/B/C/D của wireframe.
 * Đây CHỈ là cách trình bày trực quan dựa trên zone_code thật đã có — KHÔNG
 * suy diễn số cột/vị trí vật lý mới (trục X ẩn nhãn vì số thứ tự cột chỉ là
 * chỉ số sắp xếp, không phải toạ độ kho thật) vì docx khóa rõ "Không biến
 * lưới thành sơ đồ kho authoritative". Khi dữ liệu không có zone_code (như
 * seed hiện tại), tự động rơi về đúng 1 hàng không nhãn.
 *
 * Lưu ý a11y: heatmap SVG không tự có phím Tab/aria-option như nút HTML
 * trước đây. Đường "Quét mã khay" (ScanInput) ở trên vẫn là lối vào chính
 * bằng bàn phím; lưới ở đây là lối chọn bổ sung bằng chuột/chạm, đúng tinh
 * thần Dev Guide (scan HOẶC chọn lưới).
 */
export function TraySelectionGrid({
  trays,
  selectedTrayId,
  onSelect,
  loading = false,
  disabled = false,
  onRefresh,
  pendingQuantity,
}: TraySelectionGridProps) {
  const t = useT();
  const [search, setSearch] = useState("");
  const themeMode = useThemeStore((state) => state.mode);
  const {
    empty: EMPTY_COLOR,
    used: USED_COLOR,
    selected: SELECTED_COLOR,
    text: TEXT_COLOR,
  } = trayColorsFor(themeMode);

  const sortedTrays = useMemo(
    () =>
      [...trays].sort((a, b) =>
        naturalCompare(a.container_code, b.container_code),
      ),
    [trays],
  );

  const filteredTrays = useMemo(() => {
    const term = search.trim().toUpperCase();
    if (!term) return sortedTrays;
    return sortedTrays.filter((tray) =>
      tray.container_code.toUpperCase().includes(term),
    );
  }, [sortedTrays, search]);

  const groups = useMemo(() => {
    const byZone = new Map<string, TrayOption[]>();
    for (const tray of filteredTrays) {
      const key = tray.zone_code ?? UNGROUPED;
      const bucket = byZone.get(key);
      if (bucket) bucket.push(tray);
      else byZone.set(key, [tray]);
    }
    const keys = Array.from(byZone.keys()).sort((a, b) => {
      if (a === UNGROUPED) return 1;
      if (b === UNGROUPED) return -1;
      return naturalCompare(a, b);
    });
    return keys.map((key) => ({ zone: key || null, trays: byZone.get(key)! }));
  }, [filteredTrays]);

  const showRowLabels = groups.length > 1 || groups[0]?.zone !== null;
  const maxCols = Math.max(1, ...groups.map((group) => group.trays.length));

  const chartSeries = useMemo(
    () =>
      groups.map((group) => ({
        name: showRowLabels
          ? (group.zone ?? t("putaway.grid.zoneUnzoned"))
          : "",
        data: Array.from({ length: maxCols }, (_, colIndex) => {
          const tray = group.trays[colIndex];
          if (!tray) {
            return {
              x: String(colIndex + 1),
              y: CELL_GAP,
              code: "",
              trayId: null,
              statusLabel: "",
              meta: "",
            } satisfies TrayCellPoint;
          }
          const isSelected = tray.container_id === selectedTrayId;
          const occupied = !isSelected && isOccupied(tray.status);
          return {
            x: String(colIndex + 1),
            y: isSelected ? CELL_SELECTED : occupied ? CELL_USED : CELL_EMPTY,
            code: tray.container_code,
            trayId: tray.container_id,
            statusLabel: isSelected
              ? t("putaway.trayStatus.selected")
              : trayStatusLabel(t, tray.status),
            meta: tray.location_hint ?? "",
          } satisfies TrayCellPoint;
        }),
      })),
    [groups, maxCols, showRowLabels, selectedTrayId, t],
  );

  const chartOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "heatmap",
        toolbar: { show: false },
        fontFamily: TYPOGRAPHY.fontFamily,
        selection: { enabled: false },
        // options/series được tính lại (useMemo) mỗi khi trays/onSelect đổi
        // tham chiếu, khiến ApexCharts gọi updateOptions liên tục — animation
        // mặc định (~800ms) bị restart giữa chừng, kẹt ở khung hình đầu
        // (width/height=0, ô vô hình dù data đúng). Tắt hẳn animation
        // (enabled:false) lại gây lỗi khác: fill không áp dụng lại khi đổi
        // trạng thái (logic set fill nằm trong chính animation pipeline của
        // Apex). Dùng speed cực nhanh (1ms) thay vì tắt hẳn — animation vẫn
        // "chạy" nên fill/kích thước luôn được set đúng, nhưng nhanh tới mức
        // mắt thường thấy tức thời, và nếu bị re-render chồng lên vẫn tự
        // chạy lại thay vì kẹt vĩnh viễn ở frame đầu.
        animations: {
          enabled: true,
          speed: 1,
          dynamicAnimation: { enabled: true, speed: 1 },
        },
        events: {
          click: (_event, chartContext, config) => {
            if (disabled) return;
            const point = readPoint(
              (chartContext as { w?: unknown } | undefined)?.w,
              config?.seriesIndex,
              config?.dataPointIndex,
            );
            if (!point?.trayId) return;
            const tray = trays.find(
              (item) => item.container_id === point.trayId,
            );
            if (tray) onSelect(tray);
          },
        },
      },
      plotOptions: {
        heatmap: {
          radius: 12,
          distributed: false,
          enableShades: false,
          colorScale: {
            ranges: [
              { from: CELL_GAP, to: CELL_GAP, color: "transparent", name: "" },
              {
                from: CELL_EMPTY,
                to: CELL_EMPTY,
                color: EMPTY_COLOR,
                name: t("putaway.trayStatus.empty"),
              },
              {
                from: CELL_USED,
                to: CELL_USED,
                color: USED_COLOR,
                name: t("putaway.trayStatus.partial"),
              },
              {
                from: CELL_SELECTED,
                to: CELL_SELECTED,
                color: SELECTED_COLOR,
                name: t("putaway.trayStatus.selected"),
              },
            ],
          },
        },
      },
      /* ApexCharts heatmap không có option "gap" riêng — giả lập khoảng cách
       * giữa các ô (giống gap của CSS grid trong wireframe) bằng viền dày
       * cùng màu nền khung chứa (bgCanvas), thay vì viền mảnh màu divider.
       * Nếu để mảnh, 2 ô liền kề cùng trạng thái (vd cùng "Đang chứa") sẽ
       * dính liền thành một khối, không phân biệt được từng khay. */
      stroke: { width: 6, colors: [PALETTE[themeMode].bgCanvas] },
      dataLabels: {
        enabled: true,
        // fontWeight 700 (không phải 800) vì Arial không có mặt chữ đậm hơn
        // "bold" thật — weight nặng hơn buộc trình duyệt tự "giả đậm" (synthetic
        // bold), dễ làm dấu tiếng Việt bị méo/lệch trong SVG text.
        style: { fontSize: "13px", fontWeight: 700, colors: [TEXT_COLOR] },
        formatter: (_value, opts) =>
          readPoint(opts?.w, opts?.seriesIndex, opts?.dataPointIndex)?.code ??
          "",
      },
      xaxis: {
        labels: { show: false },
        axisTicks: { show: false },
        axisBorder: { show: false },
      },
      yaxis: {
        labels: {
          show: showRowLabels,
          style: { fontWeight: 700, colors: PALETTE[themeMode].textMedium },
        },
      },
      grid: { show: false, padding: { left: 4, right: 4 } },
      legend: { show: false },
      tooltip: {
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const point = readPoint(w, seriesIndex, dataPointIndex);
          if (!point?.code) return "";
          const detail = [point.statusLabel, point.meta]
            .filter(Boolean)
            .map(escapeHtml)
            .join(" · ");
          return `<div style="padding:8px 10px;font-size:12px;line-height:1.4;font-family:${escapeHtml(TYPOGRAPHY.fontFamily)};">
            <strong>${escapeHtml(point.code)}</strong><br/>${detail}
          </div>`;
        },
      },
    }),
    // Bảng màu heatmap dựng từ `themeMode`, nên đổi sáng/tối phải tính lại
    // options — thiếu deps này thì lưới giữ nguyên màu của giao diện cũ.
    [
      disabled,
      trays,
      onSelect,
      showRowLabels,
      themeMode,
      EMPTY_COLOR,
      USED_COLOR,
      SELECTED_COLOR,
      TEXT_COLOR,
      t,
    ],
  );

  const selectedTray =
    trays.find((tray) => tray.container_id === selectedTrayId) ?? null;

  // Chart tự co giãn lấp đầy bề ngang bằng width="100%" (ApexCharts tự nghe
  // resize, không cần đo JS) — chỉ đặt minWidth (px) cho khung bọc ngoài
  // giống hệt kiểu minmax(106px,1fr) của CSS grid trong wireframe: đủ chỗ
  // thì Chart giãn ra lấp đầy; chật thì khung giữ nguyên min và khung ngoài
  // (overflow:auto) tự hiện thanh cuộn ngang, không bóp méo ô.
  const chartMinWidth = maxCols * CELL_MIN_WIDTH + CHART_WIDTH_PADDING;
  const chartHeight =
    Math.max(groups.length, 1) * CELL_HEIGHT + CHART_HEIGHT_PADDING;

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <SearchInput
          width="100%"
          value={search}
          placeholder={t("putaway.grid.searchPlaceholder")}
          slotProps={{
            htmlInput: { "aria-label": t("putaway.grid.searchAria") },
          }}
          disabled={disabled}
          onChange={setSearch}
        />
        {onRefresh ? (
          <Tooltip title={t("putaway.grid.refresh")}>
            <span>
              <ActionIconButton
                kind="refresh"
                label={t("putaway.grid.refresh")}
                onClick={onRefresh}
                disabled={disabled || loading}
              />
            </span>
          </Tooltip>
        ) : null}
      </Stack>

      <Box
        aria-label={t("putaway.grid.gridAria")}
        sx={{
          maxHeight: 360,
          overflow: "auto",
          p: 1,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.default",
        }}
      >
        {filteredTrays.length > 0 ? (
          <Box
            sx={{
              minWidth: chartMinWidth,
              opacity: disabled ? 0.6 : 1,
              pointerEvents: disabled ? "none" : "auto",
            }}
          >
            <Chart
              options={chartOptions}
              series={chartSeries}
              type="heatmap"
              height={chartHeight}
              width="100%"
            />
          </Box>
        ) : !loading ? (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <Box sx={{ typography: "body2", color: "text.secondary" }}>
              {search ? t("putaway.grid.noMatch") : t("putaway.grid.noTrays")}
            </Box>
          </Box>
        ) : null}
      </Box>

      {showRowLabels ? (
        <Box
          sx={{
            typography: "caption",
            color: "text.secondary",
            mt: 0.75,
            fontStyle: "italic",
          }}
        >
          {t("putaway.grid.zoneNote")}
        </Box>
      ) : null}

      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 1, px: 0.5, flexWrap: "wrap" }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: 0.75,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          />
          <Box sx={{ typography: "caption", color: "text.secondary" }}>
            {t("putaway.trayStatus.empty")}
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: 0.75,
              border: "1px solid",
              borderColor: "info.main",
              bgcolor: USED_COLOR,
            }}
          />
          <Box sx={{ typography: "caption", color: "text.secondary" }}>
            {t("putaway.grid.legendUsed")}
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: 0.75,
              border: "1px solid",
              borderColor: "success.main",
              bgcolor: SELECTED_COLOR,
            }}
          />
          <Box sx={{ typography: "caption", color: "text.secondary" }}>
            {t("putaway.trayStatus.selected")}
          </Box>
        </Stack>
      </Stack>

      <Box
        sx={{
          mt: 1.5,
          border: "1px solid",
          borderColor: selectedTray ? "success.main" : "divider",
          bgcolor: selectedTray ? "success.light" : "background.default",
          borderRadius: 2,
          px: 1.5,
          py: 1.25,
        }}
      >
        <Box sx={{ typography: "caption", color: "text.secondary" }}>
          {t("putaway.grid.selectedPanelTitle")}
        </Box>
        <Box
          sx={{
            typography: "subtitle1",
            fontWeight: 700,
            lineHeight: 1.3,
            mb: selectedTray ? 1 : 0,
            color: selectedTray ? "success.dark" : "text.disabled",
          }}
        >
          {selectedTray
            ? selectedTray.container_code
            : t("putaway.grid.noneSelected")}
        </Box>
        {selectedTray ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <UiStatusBadge
              label={trayStatusLabel(t, selectedTray.status)}
              tone={isOccupied(selectedTray.status) ? "info" : "success"}
            />
            {typeof pendingQuantity === "number" ? (
              <UiStatusBadge
                tone="neutral"
                label={t("putaway.grid.pendingQty", { qty: pendingQuantity })}
              />
            ) : null}
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
