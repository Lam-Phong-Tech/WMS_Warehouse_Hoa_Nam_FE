import { useState, type ReactNode } from "react";
import {
  Box,
  Checkbox,
  Grid,
  Menu,
  MenuItem,
  UiButton,
  UiDialog,
  UiPagination,
} from "@/shared/ui";
import { DownOutlined } from "@/shared/components/icons";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { ActionIconButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { text, type Raw, type SelectOption } from "./report-format";
import { flattenReportColumns, type ReportColumn } from "./report-columns";

export type ReportPaginationBarProps = {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function ReportPaginationBar({
  page,
  perPage,
  total,
  onPageChange,
  onPageSizeChange,
}: ReportPaginationBarProps) {
  return (
    <Box sx={{ mt: 1.5 }}>
      <UiPagination
        page={page}
        pageSize={perPage}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[10, 15, 25, 50, 100]}
      />
    </Box>
  );
}

/** Modal chi tiết một dòng báo cáo — dựng field từ chính bộ cột của bảng. */
export function ReportRowDetailModal({
  title,
  columns,
  row,
  rowIndex,
  onClose,
  extra,
}: {
  title: string;
  columns: ReportColumn[];
  row: Raw;
  rowIndex: number;
  onClose: () => void;
  /** Khối nội dung phụ dưới lưới field (tầng dòng, movement, timeline...). */
  extra?: ReactNode;
}) {
  const dialog = useDialogExit(onClose);
  const fields = flattenReportColumns(columns).filter(
    ({ column }) => column.key !== "__stt",
  );

  return (
    <UiDialog
      {...dialog.dialogProps}
      maxWidth="md"
      fullWidth
      title={
        <Box sx={{ position: "relative", pr: 6 }}>
          {title}
          <ActionIconButton
            kind="close"
            onClick={dialog.close}
            sx={{ position: "absolute", right: -8, top: -4 }}
          />
        </Box>
      }
    >
      <Grid container spacing={2}>
        {fields.map(({ title: label, column }) => {
          const dataIndex = column.dataIndex;
          const value = dataIndex ? row[dataIndex] : undefined;
          const rendered = column.render
            ? column.render(value, row, rowIndex)
            : text(value, EMPTY_TEXT);
          return (
            <Grid
              key={String(column.key ?? dataIndex ?? label)}
              size={{ xs: 12, sm: 6 }}
            >
              <Box
                sx={{
                  typography: "caption",
                  color: "text.secondary",
                  display: "block",
                }}
              >
                {label}
              </Box>
              <Box sx={{ typography: "body2", wordBreak: "break-word" }}>
                {rendered === "" || rendered === null || rendered === undefined
                  ? EMPTY_TEXT
                  : rendered}
              </Box>
            </Grid>
          );
        })}
      </Grid>
      {extra ? <Box sx={{ mt: 2 }}>{extra}</Box> : null}
    </UiDialog>
  );
}

/** Select nhiều lựa chọn cho toolbar báo cáo (bệnh/lỗi, nơi nhận, SKU...). */
export function MultiSelectFilter({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  minWidth = 210,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: SelectOption[];
  placeholder: string;
  ariaLabel: string;
  minWidth?: number;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const selected = options.filter((option) => value.includes(option.value));
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].label
        : `Đã chọn ${selected.length} mục`;

  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    );
  };

  return (
    <>
      <UiButton
        appearance="outlined"
        color="secondary"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        endIcon={<DownOutlined style={{ fontSize: 12 }} />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          minWidth,
          justifyContent: "space-between",
          fontWeight: 400,
          textAlign: "left",
          color: selected.length === 0 ? "text.disabled" : "text.primary",
        }}
      >
        {summary}
      </UiButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {options.length === 0 ? (
          <MenuItem disabled>Không có lựa chọn</MenuItem>
        ) : (
          options.map((option) => (
            <MenuItem
              key={option.value}
              dense
              onClick={() => toggle(option.value)}
            >
              <Checkbox
                size="small"
                checked={value.includes(option.value)}
                tabIndex={-1}
                sx={{ p: 0.5, mr: 1 }}
              />
              {option.label}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}
