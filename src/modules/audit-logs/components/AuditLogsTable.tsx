import { useState } from "react";
import { useT } from "@/shared/i18n/useT";
import { UiIcon, UiStatusBadge } from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import type { ClientSortState } from "@/shared/components/data-display/useClientSort";
import { tableEmptyText } from "@/shared/components/feedback/BusinessState";
import type { RowSelectionState } from "@/shared/hooks/useRowSelection";
import type { AuditLog } from "../types/audit-logs.types";
import { formatDateTime } from "@/shared/utils/format-date";
import { AUDIT_MODULE_LABELS } from "@/shared/constants/business-labels";
import {
  auditActionLabel,
  auditObjectCode,
  auditObjectTypeLabel,
  auditResultLabel,
  auditResultTone,
} from "../constants/audit-log-labels";
import { RowActionButton } from "@/shared/components/actions";
import { MvpSelectionCheckbox } from "@/shared/components/mvp/MvpSelectionCell";

export interface AuditLogsTableProps {
  data: AuditLog[];
  loading?: boolean;
  error?: unknown;
  page: number;
  perPage: number;
  selection: RowSelectionState;
  onView?: (auditLog: AuditLog) => void;
  onSortChange?: (field?: string, order?: "asc" | "desc") => void;
}

export function AuditLogsTable({
  data,
  loading,
  error,
  selection,
  onView,
  onSortChange,
}: AuditLogsTableProps) {
  const t = useT();
  const [sortState, setSortState] = useState<ClientSortState>({
    direction: undefined,
  });
  // Every column has a share: an unbounded action/object column absorbs
  // spare space and squeezes the actor and module despite their content.
  const columns: ResponsiveTableColumn<AuditLog>[] = [
    {
      key: "select",
      width: "4%",
      align: "center",
      mobileLabel: t("shared.table.selectRow"),
      header: (
        <MvpSelectionCheckbox
          checked={selection.isAllSelected}
          indeterminate={selection.isIndeterminate}
          onChange={selection.toggleAll}
          ariaLabel={t("audit.selectAllAria")}
        />
      ),
      render: (row) => (
        <span onClick={(event) => event.stopPropagation()}>
          <MvpSelectionCheckbox
            checked={selection.isSelected(row.id)}
            onChange={(checked) => selection.toggleOne(row.id, checked)}
            ariaLabel={t("audit.selectRowAria", {
              time: formatDateTime(row.created_at),
            })}
          />
        </span>
      ),
    },
    {
      key: "created_at",
      header: t("audit.colTime"),
      width: "16%",
      sortable: true,
      sortType: "value",
      render: (row) => (
        <time dateTime={row.created_at}>{formatDateTime(row.created_at)}</time>
      ),
    },
    {
      key: "actor_email",
      header: t("audit.colActor"),
      width: "22%",
      render: (row) => (
        <div className="hn-audit-actor">
          <span className="hn-audit-actor-icon">
            <UiIcon name="user" size="sm" />
          </span>
          <div className="hn-audit-cell-lines">
            <strong
              title={
                row.actor?.display_name || row.actor?.email || t("audit.system")
              }
            >
              {row.actor?.display_name || row.actor?.email || t("audit.system")}
            </strong>
            {row.actor?.email && row.actor.display_name ? (
              <span title={row.actor.email}>{row.actor.email}</span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "action",
      header: t("audit.actionObject"),
      width: "22%",
      sortable: true,
      render: (row) => (
        <div className="hn-audit-cell-lines">
          <strong>{auditActionLabel(row.action)}</strong>
          <span title={row.object_type}>
            {auditObjectTypeLabel(row.object_type)}
          </span>
          {auditObjectCode(row) ? (
            <span
              className="hn-audit-object-code"
              title={auditObjectCode(row) || undefined}
            >
              {auditObjectCode(row)}
            </span>
          ) : row.object_id ? (
            <span title={row.object_id}>
              #
              {row.object_id.length > 14
                ? `${row.object_id.slice(0, 8)}…${row.object_id.slice(-4)}`
                : row.object_id}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "module",
      header: t("audit.colModule"),
      width: "18%",
      sortable: true,
      render: (row) => (
        <span
          className="hn-audit-module"
          title={AUDIT_MODULE_LABELS[row.module] || t("audit.moduleOther")}
        >
          {AUDIT_MODULE_LABELS[row.module] || t("audit.moduleOther")}
        </span>
      ),
    },
    {
      key: "result",
      header: t("audit.colResult"),
      width: "12%",
      render: (row) => (
        <UiStatusBadge
          className="hn-audit-result"
          data-audit-result={row.result || "UNKNOWN"}
          data-settings-tone={auditResultTone(row.result)}
          tone={auditResultTone(row.result)}
          label={auditResultLabel(row.result) || t("audit.resultUnknown")}
        />
      ),
    },
  ];
  return (
    <ResponsiveDataTable
      headerCellStyle={{
        backgroundColor: "var(--ops-table-header)",
        color: "var(--ops-heading)",
        fontSize: 16,
        fontWeight: 800,
        lineHeight: "24px",
        textTransform: "uppercase",
      }}
      columns={columns}
      rows={data}
      rowKey={(row) => row.id}
      loading={loading}
      emptyText={tableEmptyText(error ?? null, t("audit.empty"))}
      sortState={onSortChange ? sortState : undefined}
      onSortChange={
        onSortChange
          ? (key) => {
              const direction =
                sortState.key !== key || !sortState.direction
                  ? "asc"
                  : sortState.direction === "asc"
                    ? "desc"
                    : undefined;
              setSortState({ key: direction ? key : undefined, direction });
              onSortChange(direction ? key : undefined, direction);
            }
          : undefined
      }
      onRowClick={onView}
      actionColumnWidth="6%"
      renderRowActions={
        onView
          ? (row) => (
              <RowActionButton
                kind="view"
                aria-label={t("audit.rowDetailAria")}
                onClick={() => onView(row)}
              />
            )
          : undefined
      }
    />
  );
}
