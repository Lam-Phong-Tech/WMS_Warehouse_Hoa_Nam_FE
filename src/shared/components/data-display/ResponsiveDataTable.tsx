import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useCallback, useRef, type ReactNode, type CSSProperties } from "react";
import { MvpSelectionCheckbox } from "@/shared/components/mvp/MvpSelectionCell";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { UiSpinner } from "@/shared/ui";
import type { RowSelectionState } from "@/shared/hooks/useRowSelection";
import { SortableTh } from "./SortableTh";
import { useClientSort } from "./useClientSort";
import { useRenderWindow } from "./useRenderWindow";
import { useVirtualRows } from "./useVirtualRows";
import { WindowedMore } from "./WindowedMore";
import type { ClientSortState, SortAccessor } from "./useClientSort";
import type { SortWordingType } from "./useClientSort";
import { ActionButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import { TruncatedText } from "./TruncatedText";

/** Trần bề ngang của ô khi cột không tự khai `width` (px). */
const DEFAULT_CELL_MAX_WIDTH = 280;

export interface ResponsiveTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Nhãn hiển thị trên card ở mobile — mặc định dùng `header` nếu không truyền. */
  mobileLabel?: ReactNode;
  align?: "left" | "right" | "center";
  width?: string | number;
  /** Có prop này thì cột này bấm được để sắp xếp CLIENT-SIDE (toàn bộ `rows` đang có trong tay). */
  sortAccessor?: SortAccessor<T>;
  /** Cột bấm được để sắp xếp nhưng việc sort xảy ra ở nơi khác (vd gọi lại API) —
   * dùng cùng `sortState`/`onSortChange` ở mức bảng thay vì `sortAccessor`. */
  sortable?: boolean;
  sortType?: SortWordingType;
  /** Ẩn hẳn cột này ở mobile (bảng lẫn card) — dùng cho cột phụ ít quan trọng, giữ card gọn. */
  hideOnMobile?: boolean;
  /**
   * Số dòng tối đa của ô trước khi cắt bằng "…" (chỉ ở bảng desktop; card
   * mobile luôn hiện đủ chữ).
   *
   * MẶC ĐỊNH 1: không ô nào trong danh sách được phép xuống dòng — chữ dài cắt
   * bằng "…" và hiện đủ ở tooltip. Ô dựng sẵn nhiều dòng xếp chồng (mã + tên)
   * vẫn giữ đủ số dòng đó, mỗi dòng tự cắt riêng (xem .hn-truncate > * trong
   * index.css). Đặt `truncate: 2` khi muốn cho phép chữ tràn sang dòng thứ hai,
   * `truncate: 0` để tắt hẳn.
   */
  truncate?: number;
}

export interface ResponsiveDataTableProps<T> {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyText?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Khối nút hành động cho từng dòng (Xem/Sửa/Xoá...) — hiển thị ở cả bảng lẫn card. */
  renderRowActions?: (row: T) => ReactNode;
  /**
   * Bề rộng cột Thao tác (px), mặc định 96 — đủ cho MỘT nút "Xem"/"Sửa".
   * Màn đặt HAI nút có nhãn (vd IN-01: "Tiếp tục quét" + "Sửa thông tin")
   * phải nới cột này, nếu không chữ tràn khỏi mép cột vì ô Thao tác cố ý
   * không có lớp cắt "…" (UAT TC_UI_07).
   */
  actionColumnWidth?: number;
  /** Breakpoint chuyển sang card list, mặc định `md` (768px, khớp mui-theme.ts). */
  mobileBreakpoint?: "sm" | "md" | "lg";
  /**
   * Sort CÓ KIỂM SOÁT từ ngoài (vd sort server-side qua API): truyền cùng lúc
   * `sortState` + `onSortChange` để bảng KHÔNG tự sort nội bộ nữa — `rows` coi
   * như đã được sắp xếp sẵn từ nơi gọi, bấm cột chỉ phát sự kiện ra ngoài.
   * Cột muốn bấm được để sort kiểu này khai `sortable: true` (không phải
   * `sortAccessor`). Bỏ trống 2 prop này thì mọi cột có `sortAccessor` vẫn
   * sort nội bộ (client-side) như trước.
   */
  sortState?: ClientSortState;
  onSortChange?: (key: string) => void;
  /**
   * Bật cột chọn nhiều dòng (checkbox) — truyền thẳng giá trị của
   * `useRowSelection(rows, rowKey)`. Lựa chọn chỉ tính trong trang hiện tại,
   * đúng như các bảng đã có checkbox (IamUserScreen, ApiMasterScreens).
   */
  rowSelection?: RowSelectionState;
  /** Nhãn a11y cho checkbox từng dòng — mặc định "Chọn dòng <rowKey>". */
  selectionLabel?: (row: T) => string;
  /**
   * Trần chiều cao của KHUNG bảng (desktop). Có giá trị ⇒ bảng dài tự cuộn dọc
   * trong khung và `thead` được ghim lại, thay vì kéo trang thành một dải rất
   * dài. Bỏ trống ⇒ giữ nguyên hành vi cũ (bảng cao bao nhiêu hiện bấy nhiêu).
   *
   * Đây là `max-height` nên bảng ngắn KHÔNG bị độn thêm khoảng trắng. Ở mobile
   * bảng đã chuyển sang danh sách card nên prop này không áp dụng — trang mobile
   * vốn cuộn dọc tự nhiên, lồng thêm một khung cuộn nữa chỉ gây kẹt cử chỉ.
   */
  maxBodyHeight?: number | string;
  /** Optional screen presentation; omitted keeps the shared table unchanged. */
  headerCellStyle?: CSSProperties;
}

/**
 * Bảng dữ liệu dùng chung: HTML `<table>` + `SortableTh` trên desktop (cùng
 * baseline đã dùng ở IamUserScreen/ApiMasterScreens), tự chuyển sang danh sách
 * card trên mobile/tablet hẹp thay vì bắt cuộn ngang một bảng nhiều cột bị bóp
 * nhỏ. Không phụ thuộc CSS toàn cục (`.table-wrap`/`.hn-data-table` chỉ có tác
 * dụng trong wrapper `.hn-mvp-source-screen` khi vào qua `?screen=` — xem
 * gotcha responsive cũ) — style tự đủ qua `sx` để hiển thị đúng ở mọi route.
 */
export function ResponsiveDataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyText,
  onRowClick,
  renderRowActions,
  actionColumnWidth = 96,
  mobileBreakpoint = "md",
  sortState: controlledSortState,
  onSortChange: controlledOnSortChange,
  rowSelection,
  selectionLabel,
  maxBodyHeight,
  headerCellStyle: headerCellOverrides,
}: ResponsiveDataTableProps<T>) {
  const t = useT();
  const theme = useTheme();

  /**
   * Nền của ô tiêu đề. `action.hover` là màu BÁN TRONG SUỐT (rgba ~4%), nên khi
   * `maxBodyHeight` ghim `thead` lại thì các dòng cuộn qua bên dưới ÁNH XUYÊN
   * lên chữ tiêu đề — hai lớp chữ chồng nhau, không đọc được cột nào ra cột nào.
   * Trải đúng sắc đó thành một lớp `background-image` phủ trên nền ĐỤC của thẻ:
   * màu hiển thị y hệt trước, nhưng ô tiêu đề không còn trong suốt.
   */
  const headerBackground = {
    backgroundColor: theme.palette.background.paper,
    backgroundImage: `linear-gradient(${theme.palette.action.hover}, ${theme.palette.action.hover})`,
  } as const;
  const isMobile = useMediaQuery(theme.breakpoints.down(mobileBreakpoint));

  const isControlledSort =
    controlledSortState !== undefined && controlledOnSortChange !== undefined;

  const sortAccessors = Object.fromEntries(
    columns
      .filter((column) => column.sortAccessor)
      .map((column) => [column.key, column.sortAccessor!]),
  );
  const internalSort = useClientSort(rows, sortAccessors);

  // Sort có kiểm soát (server-side): KHÔNG sort lại `rows` — coi như nơi gọi
  // đã sắp xếp sẵn. Bấm cột chỉ phát `onSortChange(key)` ra ngoài.
  const sortedRows = isControlledSort ? rows : internalSort.sortedRows;
  const sortState = isControlledSort
    ? controlledSortState
    : internalSort.sortState;
  const requestSort = isControlledSort
    ? controlledOnSortChange
    : internalSort.requestSort;

  /**
   * Bảng nhận trọn tập đã lọc (báo cáo truy vết: 5.956 dòng) trước đây đổ hết
   * vào DOM và khoá luồng chính hàng chục giây. Vẽ dần thay vì vẽ hết — xem
   * useRenderWindow. Bảng dưới ngưỡng đi đúng đường cũ, không đổi gì.
   */
  const renderWindow = useRenderWindow(sortedRows);
  const visibleRows = renderWindow.visible;

  const moreRowsFooter = <WindowedMore window={renderWindow} />;

  /**
   * CUỘN ẢO cho bảng desktop có KHUNG CUỘN RIÊNG.
   *
   * `maxBodyHeight` là điều kiện bắt buộc vì đó chính là lúc `WindowedMore`
   * hỏng: sentinel của nó nằm NGOÀI hộp cuộn nên cuộn trong bảng không bao giờ
   * nới thêm dòng (xem phần đầu useVirtualRows). Bảng cuộn theo cả trang giữ
   * nguyên đường `useRenderWindow` — ở đó sentinel vẫn đúng.
   *
   * Ở mobile bảng đã chuyển sang danh sách card và không có khung cuộn riêng
   * nên cũng giữ nguyên đường cũ.
   */
  const scrollerRef = useRef<HTMLElement | null>(null);
  const getScroller = useCallback(() => scrollerRef.current, []);
  const virtual = useVirtualRows(
    sortedRows,
    getScroller,
    !isMobile && maxBodyHeight !== undefined,
  );
  const { enabled: virtualEnabled, measureRow } = virtual;

  /**
   * Ô bảng desktop: chữ thuần được cắt bằng CSS (mặc định 2 dòng) và mang
   * tooltip `title` để đọc đủ khi rê chuột. Ô tự dựng JSX giữ nguyên — trừ khi
   * cột khai `truncate` thì bọc thêm một lớp cắt.
   */
  const renderCell = (column: ResponsiveTableColumn<T>, row: T) => {
    const content = column.render(row);
    const lines = column.truncate ?? 1;
    if (lines <= 0) return content;
    // Trần bề ngang phải nằm trên khối BÊN TRONG ô: `max-width` đặt lên <td>
    // bị bỏ qua ở table-layout auto (CSS 2.1 §17.5.2), nên "…" sẽ không bao
    // giờ xuất hiện nếu chỉ chặn ở ô.
    //
    // Nhưng `width` khai bằng `%` thì KHÔNG được chép sang khối đó: phần trăm
    // ấy là của BẢNG (đã vào `<col>`), còn `max-width` của khối con lại tính
    // trên chính ô — cột bị bóp hai lần. Đo ở RPT-07 (11/09/2026): cột "Xuất
    // thuần" 10% rộng 127px mà khối cắt chỉ còn 10px (chip số lượng ló ra một
    // mẩu), cột người nhận 23% rộng 291px còn 61px. Ô đã bị `<col>` chặn bề
    // ngang rồi, nên khối cắt chỉ cần lấp đầy ô.
    const clampWidth =
      typeof column.width === "string" && column.width.includes("%")
        ? "100%"
        : // Cột không khai `width` vẫn phải có trần, nếu không ô cứ nở theo
          // chuỗi dài nhất và đẩy bảng ra ngoài khung thay vì cắt bằng "…".
          (column.width ?? DEFAULT_CELL_MAX_WIDTH);
    return (
      <TruncatedText lines={lines} maxWidth={clampWidth}>
        {content}
      </TruncatedText>
    );
  };

  const rowSelectionLabel = (row: T) =>
    selectionLabel?.(row) ??
    t("shared.table.selectRowAria", { row: String(rowKey(row)) });

  // Thanh tóm tắt: lựa chọn có thể trôi khỏi tầm nhìn khi cuộn/đổi bộ lọc nên
  // luôn nói rõ đang chọn bao nhiêu dòng và cho bỏ chọn nhanh.
  const selectionSummary =
    rowSelection && rowSelection.selectedCount > 0 ? (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 1.5,
          px: 1.5,
          py: 1,
          borderRadius: "var(--ops-radius-card)",
          bgcolor: "action.hover",
          border: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="body2">
          {t("shared.table.selectedCount", {
            count: rowSelection.selectedCount,
          })}
        </Typography>
        <ActionButton kind="clear" onClick={rowSelection.clear} />
      </Box>
    ) : null;

  if (loading) {
    // WWHN-268: hợp đồng ui-state — branch loading tự phát data-ui-state +
    // testid ổn định (cùng bộ selector với TableLoadingBanner) để bằng chứng
    // QA2 không phải dò theo chuỗi "Đang tải...".
    return (
      <Box
        {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-table")}
        aria-busy="true"
        sx={{
          py: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          color: "text.secondary",
        }}
      >
        {/* label=null: đã có chữ "Đang tải..." ngay bên cạnh, không lặp a11y name. */}
        <UiSpinner size={16} label={null} />
        {t("shared.table.loading")}
      </Box>
    );
  }

  if (!sortedRows.length) {
    // `emptyText` không truyền → câu mặc định theo ngôn ngữ đang chọn (đọc qua
    // `t()` trong render, không để làm giá trị mặc định của tham số vì tham số
    // mặc định bị đóng băng theo ngôn ngữ lúc module được nạp).
    const emptyContent = emptyText ?? t("shared.table.empty");
    // Chỉ tự phát hook trạng thái khi emptyText là chuỗi mặc định/thuần —
    // ReactNode do nơi gọi truyền (vd tableEmptyText của BusinessState) đã
    // tự mang data-ui-state riêng, bọc thêm sẽ thành double-wrap sai hợp đồng.
    const emptyHooks =
      typeof emptyContent === "string"
        ? uiStateProps(UI_STATE.EMPTY, "ui-state-empty-table")
        : {};
    return (
      <Box
        {...emptyHooks}
        sx={{ py: 6, textAlign: "center", color: "text.secondary" }}
      >
        {emptyContent}
      </Box>
    );
  }

  if (isMobile) {
    const cardColumns = columns.filter((column) => !column.hideOnMobile);
    return (
      <>
        {selectionSummary}
        <Stack spacing={1.5}>
          {visibleRows.map((row) => (
            <Card
              key={rowKey(row)}
              variant="outlined"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={onRowClick ? { cursor: "pointer" } : undefined}
            >
              <CardContent
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  "&:last-child": { pb: 2 },
                }}
              >
                {rowSelection && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      ml: -0.5,
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MvpSelectionCheckbox
                      checked={rowSelection.isSelected(rowKey(row))}
                      onChange={(checked) =>
                        rowSelection.toggleOne(rowKey(row), checked)
                      }
                      ariaLabel={rowSelectionLabel(row)}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t("shared.table.selectRow")}
                    </Typography>
                  </Box>
                )}
                {cardColumns.map((column) => (
                  <Box
                    key={column.key}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 2,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ flexShrink: 0, pt: "2px" }}
                    >
                      {column.mobileLabel ?? column.header}
                    </Typography>
                    <Box sx={{ textAlign: "right", minWidth: 0 }}>
                      {column.render(row)}
                    </Box>
                  </Box>
                ))}
                {renderRowActions && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 1,
                      mt: 1,
                      pt: 1,
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderRowActions(row)}
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
        {moreRowsFooter}
      </>
    );
  }

  const selectionCellStyle = {
    width: 44,
    padding: "10px 4px 10px 12px",
    textAlign: "center" as const,
  };

  // Bảng nhiều cột (vd dòng điều chỉnh 11 cột): `width: "100%"` một mình sẽ
  // ép browser bóp MỌI cột vừa khít container, và td có `overflowWrap:
  // "anywhere"` cho phép bóp tới mức 1 ký tự/dòng (chữ dọc, rất khó đọc) thay
  // vì thật sự cuộn ngang. Cộng dồn `column.width` khai báo thành `minWidth`
  // cho table thì bảng mới tràn ra đúng độ rộng dự kiến, và wrapper
  // `overflowX: "auto"` bên ngoài mới thật sự phát huy tác dụng cuộn ngang.
  const declaredColumnsWidth = columns.reduce(
    (sum, column) =>
      sum + (typeof column.width === "number" ? column.width : 0),
    0,
  );
  const tableMinWidth =
    declaredColumnsWidth > 0
      ? declaredColumnsWidth +
        (rowSelection ? 44 : 0) +
        (renderRowActions ? actionColumnWidth : 0)
      : undefined;

  /**
   * `column.width` KHAI MỘT LẦN CHO CẢ CỘT qua `<colgroup>`.
   *
   * Trước đây bề rộng chỉ được gắn vào ô `<th>`; ô `<td>` không nhận gì. Với
   * `table-layout: auto` (mặc định), bề rộng trên MỘT ô chỉ là ĐỀ NGHỊ — trình
   * duyệt vẫn thương lượng lại theo nội dung các ô còn lại trong cột. Hệ quả:
   * cột khai 80px vẫn phình theo dữ liệu, cột chữ dài lại bị bóp, và tiêu đề
   * không nằm trên đúng dải dữ liệu của nó. `<col>` gắn bề rộng cho TOÀN cột
   * nên tiêu đề và dữ liệu không thể lệch nhau nữa.
   */
  const columnWidths = [
    ...(rowSelection ? [44] : []),
    ...columns.map((column) => column.width),
    ...(renderRowActions ? [actionColumnWidth] : []),
  ];

  /** Dòng đệm của cuộn ảo phải phủ đúng số ô của một dòng thật. */
  const spacerColSpan = columnWidths.length;

  /**
   * SX DỰNG SẴN — một lần cho mỗi lượt render, thay vì một lần cho mỗi Ô.
   *
   * Trước đây mỗi `<Box component="td">` và mỗi `<Box component="tr">` nhận một
   * OBJECT LITERAL MỚI. Với bảng 9 cột, một lượt dựng lại tạo 9 × số dòng object
   * style; `sx` của dòng còn là một HÀM `(theme) => theme.transitions.create(...)`
   * nên nó chạy lại cho TỪNG dòng. Emotion có cache theo chuỗi style đã tuần tự
   * hoá, nhưng chi phí TUẦN TỰ HOÁ thì vẫn phải trả đủ mỗi lần.
   *
   * Nội dung style KHÔNG đổi một pixel nào — chỉ đổi số lần dựng object.
   * `docs/perf/F5_INP_2026-09-07.md` §4.1 đã chỉ đích danh engine `sx` là phần
   * còn lại của thời gian dựng; đây là phần cắt được mà không đụng design system.
   */
  const rowSx = {
    cursor: onRowClick ? "pointer" : undefined,
    // Dòng đổi nền mượt khi rê chuột thay vì nhảy màu một phát — cùng nhịp với
    // `MuiTableRow` khai trong theme (mui-adapter).
    transition: theme.transitions.create("background-color", {
      duration: theme.transitions.duration.shortest,
    }),
    "&:hover": { bgcolor: "action.hover" },
    "&:not(:last-of-type)": { borderBottom: 1, borderColor: "divider" },
  } as const;

  const cellSxByKey = new Map(
    columns.map((column) => [
      column.key,
      {
        padding: "10px 12px",
        verticalAlign: "top",
        overflowWrap: "anywhere",
        // Chiều rộng cột chỉ là gợi ý cho trình duyệt; trần thật của phần chữ
        // nằm ở TruncatedText bên trong.
        ...(column.width !== undefined ? { maxWidth: column.width } : null),
      },
    ]),
  );

  const actionCellSx = {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
  } as const;

  const selectionBodyCellSx = {
    ...selectionCellStyle,
    verticalAlign: "top",
  } as const;

  /**
   * Chỉ khoá bố cục khi bảng khai bề rộng cho MỌI cột — lúc đó đây là một bản
   * thiết kế đầy đủ và phải được tôn trọng nguyên vẹn. Khai thiếu cột nào thì
   * giữ `auto`: bề rộng trong `<colgroup>` vẫn có tác dụng như đề nghị, còn
   * cột chưa khai vẫn co giãn theo nội dung thay vì bị chia đều máy móc.
   * `minWidth` + `overflowX` của wrapper lo phần tràn ngang.
   */
  const hasCompleteWidthPlan = columns.every(
    (column) => column.width !== undefined && column.width !== "",
  );

  return (
    <>
      {selectionSummary}
      <Box
        ref={scrollerRef}
        sx={{
          overflowX: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 2.5,
          ...(maxBodyHeight === undefined
            ? null
            : {
                maxHeight: maxBodyHeight,
                overflowY: "auto",
                // Cuộn dọc mà tiêu đề trôi mất thì người đọc không còn biết cột
                // nào là cột nào — ghim thead lại ngay trong khung cuộn.
                "& thead th": {
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                },
                scrollBehavior: "smooth",
                overscrollBehavior: "contain",
              }),
        }}
      >
        <Box
          component="table"
          sx={{
            width: "100%",
            minWidth: tableMinWidth,
            borderCollapse: "collapse",
            fontSize: 13.5,
            ...(hasCompleteWidthPlan ? { tableLayout: "fixed" } : null),
            /**
             * CĂN LỀ Ô KHAI Ở CẤP BẢNG, KHÔNG PHẢI TRÊN TỪNG Ô.
             *
             * `sx` của từng ô sinh ra một class emotion (độ đặc hiệu 0-1-0).
             * 17 màn của dự án còn bọc trong `.hn-mvp-source-screen`, mà lớp đó
             * có sẵn `.hn-mvp-source-screen td { text-align: left }` (0-1-1) —
             * cao hơn, nên nó ĐÈ căn lề của ô `<td>`. Riêng ô tiêu đề thoát vì
             * `SortableTh` dùng inline style (luôn thắng). Kết quả: tiêu đề căn
             * phải còn số liệu bị kéo về trái — đúng hiện tượng "cột không
             * thẳng hàng với dữ liệu" ở các cột số.
             *
             * Khai theo `[data-align]` từ cấp bảng cho độ đặc hiệu 0-2-3, cao
             * hơn mọi rule của trang bọc ngoài, nên bảng dùng chung tự quyết
             * định bố cục ô của nó ở mọi màn — không cần sửa 17 trang kia, và
             * cũng không phá các bảng cũ vẫn dựa vào rule toàn cục đó.
             */
            "& > thead > tr > [data-align='left'], & > tbody > tr > [data-align='left']":
              { textAlign: "left" },
            "& > thead > tr > [data-align='center'], & > tbody > tr > [data-align='center']":
              { textAlign: "center" },
            "& > thead > tr > [data-align='right'], & > tbody > tr > [data-align='right']":
              { textAlign: "right" },
            /**
             * .hn-truncate là display:block có max-width — text-align của ô
             * không dời được KHỐI đó khỏi mép trái, chỉ dời chữ bên trong nó.
             * Cột căn phải/giữa phải dồn cả khối bằng margin (UAT TC_UI_09).
             */
            "& > tbody > tr > [data-align='right'] > .hn-truncate, & > tbody > tr > [data-align='right'] > .hn-truncate-2":
              { marginLeft: "auto" },
            "& > tbody > tr > [data-align='center'] > .hn-truncate, & > tbody > tr > [data-align='center'] > .hn-truncate-2":
              { marginLeft: "auto", marginRight: "auto" },
            /**
             * WHITE-SPACE Ô DỮ LIỆU CŨNG KHAI Ở CẤP BẢNG — cùng lý do với
             * `text-align` phía trên. Trang bọc `.hn-mvp-source-screen` có sẵn
             * `.hn-mvp-source-screen td { white-space: nowrap }` (0-1-1) — cao
             * hơn `overflowWrap: "anywhere"` mà mỗi ô `<td>` tự khai qua `sx`
             * (0-1-0), nên nó VÔ HIỆU HOÁ việc xuống dòng: với `table-layout:
             * fixed` + cột hẹp (vd "Mã điều chỉnh" 170px), mã dài không ngắt
             * được sẽ TRÀN NGANG ra ngoài ô và ĐÈ lên dữ liệu cột kế bên (đúng
             * hiện tượng "Mã điều chỉnh" chồng "Chứng từ gốc").
             *
             * Khai theo `[data-align]` (chỉ ô dữ liệu có; ô chọn/thao tác không
             * có nên giữ nguyên `nowrap`) từ cấp bảng cho độ đặc hiệu 0-2-2,
             * cao hơn rule trang bọc ngoài — trả lại đúng ý đồ ngắt dòng của
             * component ở mọi màn mà không phải sửa CSS toàn cục.
             */
            "& > tbody > tr > [data-align]": {
              whiteSpace: "normal",
              overflowWrap: "anywhere",
            },
          }}
        >
          <colgroup>
            {columnWidths.map((width, index) => (
              <col
                key={index}
                style={width === undefined ? undefined : { width }}
              />
            ))}
          </colgroup>
          <Box component="thead">
            <Box component="tr">
              {rowSelection && (
                <Box
                  component="th"
                  sx={{
                    ...selectionCellStyle,
                    ...headerBackground,
                    borderBottom: 1,
                    borderColor: "divider",
                    ...headerCellOverrides,
                  }}
                >
                  <MvpSelectionCheckbox
                    checked={rowSelection.isAllSelected}
                    indeterminate={rowSelection.isIndeterminate}
                    onChange={rowSelection.toggleAll}
                    ariaLabel={t("shared.table.selectAllAria")}
                  />
                </Box>
              )}
              {columns.map((column) => {
                const isSortable = Boolean(
                  column.sortAccessor || column.sortable,
                );
                const headerCellStyle: React.CSSProperties = {
                  textAlign: column.align ?? "left",
                  width: column.width,
                  padding: "10px 12px",
                  fontWeight: 600,
                  fontSize: 13,
                  color: theme.palette.text.primary,
                  ...headerBackground,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  whiteSpace: "nowrap",
                  ...headerCellOverrides,
                };

                // SortableTh tự trả về nguyên 1 thẻ <th> — KHÔNG bọc thêm Box
                // component="th" ở ngoài (sẽ ra <th><th>...</th></th> vô hiệu
                // hoá HTML). Cột không sort thì bọc Box component="th" bình
                // thường để dùng được sx theo theme.
                return isSortable ? (
                  <SortableTh
                    key={column.key}
                    label={column.header}
                    sortKey={column.key}
                    sortState={sortState}
                    onSort={requestSort}
                    sortType={column.sortType}
                    style={headerCellStyle}
                    data-align={column.align ?? "left"}
                  />
                ) : (
                  <Box
                    component="th"
                    key={column.key}
                    sx={headerCellStyle}
                    data-align={column.align ?? "left"}
                  >
                    {column.header}
                  </Box>
                );
              })}
              {renderRowActions && (
                <Box
                  component="th"
                  sx={{
                    padding: "10px 12px",
                    fontWeight: 600,
                    fontSize: 13,
                    ...headerBackground,
                    borderBottom: 1,
                    borderColor: "divider",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    ...headerCellOverrides,
                  }}
                >
                  {t("shared.table.actions")}
                </Box>
              )}
            </Box>
          </Box>
          <Box component="tbody">
            {/**
             * Dòng ĐỆM của cuộn ảo: giữ đúng chiều cao của phần chưa vẽ để thanh
             * cuộn phản ánh CẢ tập ngay từ đầu. `aria-hidden` để nó không lọt vào
             * cây trợ năng — `getAllByRole("row")` của test vẫn chỉ đếm dòng thật.
             */}
            {virtualEnabled && virtual.paddingTop > 0 && (
              <tr aria-hidden="true" data-virtual-spacer="top">
                <td
                  colSpan={spacerColSpan}
                  style={{
                    height: virtual.paddingTop,
                    padding: 0,
                    border: 0,
                  }}
                />
              </tr>
            )}
            {(virtualEnabled
              ? virtual.items.map((item) => item.row)
              : visibleRows
            ).map((row, position) => (
              <Box
                component="tr"
                // role tường minh = role ngầm định của <tr>: các test contract
                // (vd WWHN-240) tìm dòng bằng closest('[role="row"]') — selector
                // thuộc tính không thấy implicit role của HTML table.
                role="row"
                key={rowKey(row)}
                // Cuộn ảo đo chiều cao THẬT của dòng sau khi vẽ (ô hai tầng,
                // badge, chữ xuống dòng đều cao khác nhau); `data-index` cho
                // virtualizer biết con số đo được thuộc về dòng nào.
                ref={virtualEnabled ? measureRow : undefined}
                data-index={
                  virtualEnabled ? virtual.items[position]?.index : undefined
                }
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={rowSx}
              >
                {rowSelection && (
                  <Box
                    component="td"
                    sx={selectionBodyCellSx}
                    // Ô checkbox nằm trong dòng có onRowClick (mở modal chi tiết) —
                    // chặn nổi bọt để tick chọn không mở luôn chi tiết.
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MvpSelectionCheckbox
                      checked={rowSelection.isSelected(rowKey(row))}
                      onChange={(checked) =>
                        rowSelection.toggleOne(rowKey(row), checked)
                      }
                      ariaLabel={rowSelectionLabel(row)}
                    />
                  </Box>
                )}
                {columns.map((column) => (
                  <Box
                    component="td"
                    key={column.key}
                    data-align={column.align ?? "left"}
                    sx={cellSxByKey.get(column.key)}
                  >
                    {renderCell(column, row)}
                  </Box>
                ))}
                {renderRowActions && (
                  <Box
                    component="td"
                    sx={actionCellSx}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderRowActions(row)}
                  </Box>
                )}
              </Box>
            ))}
            {virtualEnabled && virtual.paddingBottom > 0 && (
              <tr aria-hidden="true" data-virtual-spacer="bottom">
                <td
                  colSpan={spacerColSpan}
                  style={{
                    height: virtual.paddingBottom,
                    padding: 0,
                    border: 0,
                  }}
                />
              </tr>
            )}
          </Box>
        </Box>
      </Box>
      {/* Cuộn ảo đã cho tới được MỌI dòng bằng cách cuộn — nút "Hiện thêm" trở
          nên vô nghĩa (và chính nó là chỗ hỏng trước đây). */}
      {virtualEnabled ? null : moreRowsFooter}
    </>
  );
}
