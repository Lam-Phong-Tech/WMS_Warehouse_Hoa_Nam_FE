import { useEffect, useRef, useState } from "react";
import {
  UiDialog,
  UiPagination,
  UiStatusBadge,
  UiTextField,
  type UiStatusTone,
} from "@/shared/ui";
import {
  ActionButton,
  ActionIconButton,
  RowActionButton,
} from "@/shared/components/actions";
import { useHasPermission } from "@/shared/components/permission";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import {
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
  WARRANTY_TERMINAL_STATUSES,
  warrantyPiiText,
} from "@/modules/warranty/constants";
import { useWarrantyCases } from "@/modules/warranty/hooks/use-warranty";
import type { WarrantyCase } from "@/modules/warranty/types";
import { tStatic as tUi } from "@/shared/i18n/useT";

interface ComponentIssueCasePickerProps {
  onClose: () => void;
  onSelect: (caseInfo: WarrantyCase) => void;
}

const STATUS_TONES: Record<string, UiStatusTone> = {
  success: "success",
  error: "error",
  warning: "warning",
  processing: "info",
  blue: "info",
};

/** WAR-04 starts the existing issue flow with a real, active warranty case. */
export function ComponentIssueCasePicker({
  onClose,
  onSelect,
}: ComponentIssueCasePickerProps) {
  const t = useT();
  const can = useHasPermission();
  const canViewPii = can("warranty.pii.view");
  const canIssue = can("warranty.component_issue");
  const selectedRef = useRef<WarrantyCase | null>(null);
  const dialog = useDialogExit(() => {
    if (selectedRef.current) onSelect(selectedRef.current);
    else onClose();
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useWarrantyCases({
    search: search || undefined,
    page,
    per_page: 10,
  });
  const rows = query.data?.data ?? [];
  const pagination = resolveApiPagination(query.data?.meta, {
    page,
    pageSize: 10,
    rowCount: rows.length,
  });

  const selectCase = (row: WarrantyCase) => {
    if (
      !canIssue ||
      !dialog.open ||
      selectedRef.current ||
      WARRANTY_TERMINAL_STATUSES.includes(row.status)
    )
      return;
    selectedRef.current = row;
    dialog.close();
  };

  return (
    <UiDialog
      {...dialog.dialogProps}
      className="hn-war04-dialog hn-war04-case-picker"
      maxWidth="md"
      title={
        <span className="hn-war04-case-picker__header">
          <span>{tUi("updatedUi.text_011a7faf1f18")}</span>
          <ActionIconButton kind="close" onClick={dialog.close} />
        </span>
      }
      actions={<ActionButton kind="close" onClick={dialog.close} />}
    >
      <div className="hn-war04-case-picker__body">
        <p className="hn-war04-case-picker__description">
          {tUi("updatedUi.text_0b5d83c18230")}
        </p>
        <UiTextField
          className="hn-war04-case-picker__search"
          autoFocus
          fullWidth
          value={searchInput}
          label={t("warranty.list.searchAria")}
          placeholder={t(
            canViewPii
              ? "warranty.list.searchPlaceholder"
              : "warranty.list.searchPlaceholderNoPii",
          )}
          onChange={(event) => setSearchInput(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 255 } }}
        />
        <TableLoadingBanner loading={query.isFetching} />
        {query.isError ? (
          <ApiErrorAlert
            error={query.error}
            title={t("warranty.list.loadError")}
            onRetry={() => void query.refetch()}
          />
        ) : !query.isLoading && rows.length === 0 ? (
          <div className="hn-war04-case-picker__empty">
            {tableEmptyText(null, t("warranty.list.empty"))}
          </div>
        ) : (
          <ul
            className="hn-war04-case-picker__list"
            aria-busy={query.isFetching}
          >
            {rows.map((row) => {
              const inactive = WARRANTY_TERMINAL_STATUSES.includes(row.status);
              return (
                <li className="hn-war04-case-picker__row" key={row.id}>
                  <div className="hn-war04-case-picker__identity">
                    <strong>{row.case_code || row.id}</strong>
                    <span>{row.sku_name || row.sku || EMPTY_TEXT}</span>
                    <span className="hn-war04-case-picker__meta">
                      {warrantyPiiText(
                        row.customer_name,
                        canViewPii && !row.pii_masked,
                        "name",
                      ) || EMPTY_TEXT}
                    </span>
                  </div>
                  <UiStatusBadge
                    tone={
                      STATUS_TONES[WARRANTY_STATUS_COLORS[row.status]] ??
                      "neutral"
                    }
                    label={WARRANTY_STATUS_LABELS[row.status] ?? row.status}
                  />
                  <RowActionButton
                    kind="next"
                    disabled={inactive || !canIssue || !dialog.open}
                    title={
                      inactive
                        ? t("warranty.componentIssue.caseInactive")
                        : undefined
                    }
                    aria-label={`${t("shared.table.selectRow")} ${row.case_code || row.id}`}
                    onClick={() => selectCase(row)}
                  >
                    {t("shared.table.selectRow")}
                  </RowActionButton>
                </li>
              );
            })}
          </ul>
        )}
        <div className="hn-war04-case-picker__pagination">
          <UiPagination
            page={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            disabled={query.isFetching || query.isError}
            onPageChange={setPage}
          />
        </div>
      </div>
    </UiDialog>
  );
}
