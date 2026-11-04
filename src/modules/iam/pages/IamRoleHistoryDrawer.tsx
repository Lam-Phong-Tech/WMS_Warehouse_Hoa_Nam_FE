import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  UiDrawer,
  UiPagination,
  UiStatusBadge,
  UiTextField,
} from "@/shared/ui";
import { ActionIconButton } from "@/shared/components/actions";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useT } from "@/shared/i18n/useT";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { formatDateTime } from "@/shared/utils/format-date";
import { auditLogService } from "@/modules/audit-logs/services/audit-logs.service";
import {
  auditActionLabel,
  auditDataChanges,
  auditReasonText,
  auditResultLabel,
  auditResultTone,
} from "@/modules/audit-logs/constants/audit-log-labels";
import type { IamPermission, IamRole } from "../types/iam.types";

function permissionIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];
}

export function IamRoleHistoryDrawer({
  role,
  permissions,
  allowed,
  onClose,
}: {
  role: IamRole;
  permissions: IamPermission[];
  allowed: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const dialog = useDialogExit(onClose);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filters = {
    q: role.role_id,
    page,
    limit: 10,
    date_from: from || undefined,
    date_to: to || undefined,
  };
  const query = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => auditLogService.getAuditLogs(filters),
    enabled: allowed,
  });
  const rows = (query.data?.data ?? []).filter(
    (row) =>
      row.object_id === role.role_id &&
      row.object_type.toLowerCase() === "role",
  );
  const total = Number(query.data?.meta?.total ?? rows.length);
  const name = (id: string) =>
    permissions.find((permission) => permission.permission_id === id)
      ?.permission_name ?? t("iam.role.fallbackModule");
  return (
    <UiDrawer
      {...dialog.dialogProps}
      width={800}
      className="hn-iam-dialog hn-iam-role-drawer"
      title={
        <span className="hn-iam-role-drawer-title">
          <span>{t("iam.roleUi.historyTitle")}</span>
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={dialog.close}
          />
        </span>
      }
    >
      <div className="hn-iam-role-drawer-body">
        <div className="hn-iam-role-context">
          <strong>{role.role_name}</strong>
          <code>{role.role_code}</code>
        </div>
        {!allowed ? (
          <p role="status">{t("iam.roleUi.historyDenied")}</p>
        ) : (
          <>
            <div className="hn-iam-role-history-filters">
              <UiTextField
                label={t("shared.datePicker.fromDate")}
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <UiTextField
                label={t("shared.datePicker.toDate")}
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </div>
            {query.isError ? (
              <ApiErrorAlert
                error={query.error}
                title={t("iam.roleUi.historyLoadError")}
                onRetry={() => void query.refetch()}
              />
            ) : query.isLoading ? (
              <p role="status">{t("common.loadingData")}</p>
            ) : rows.length ? (
              <ol className="hn-iam-role-history-list">
                {rows.map((row) => {
                  const before = permissionIds(row.before_data?.permission_ids);
                  const after = permissionIds(row.after_data?.permission_ids);
                  const added = after.filter((id) => !before.includes(id));
                  const removed = before.filter((id) => !after.includes(id));
                  const metadataFields = [
                    "role_code",
                    "role_name",
                    "scope_type",
                    "status",
                  ];
                  const metadataChanges = auditDataChanges({
                    before_data: Object.fromEntries(
                      Object.entries(row.before_data ?? {}).filter(([key]) =>
                        metadataFields.includes(key),
                      ),
                    ),
                    after_data: Object.fromEntries(
                      Object.entries(row.after_data ?? {}).filter(([key]) =>
                        metadataFields.includes(key),
                      ),
                    ),
                  }).filter((change) => change.changed);
                  return (
                    <li key={row.id}>
                      <div className="hn-iam-role-history-heading">
                        <time>{formatDateTime(row.created_at)}</time>
                        {row.result ? (
                          <UiStatusBadge
                            tone={auditResultTone(row.result)}
                            label={auditResultLabel(row.result)}
                          />
                        ) : null}
                      </div>
                      <p>
                        {row.actor?.display_name ||
                          row.actor?.username ||
                          t("iam.roleUi.historyUnknownActor")}
                      </p>
                      <strong>{auditActionLabel(row.action)}</strong>
                      {auditReasonText(row.reason) ? (
                        <p>{auditReasonText(row.reason)}</p>
                      ) : null}
                      <details>
                        <summary>{t("iam.roleUi.historyDetails")}</summary>
                        {added.length || removed.length ? (
                          <>
                            <ul>
                              {added.map((id) => (
                                <li key={`add-${id}`}>+ {name(id)}</li>
                              ))}
                            </ul>
                            <ul>
                              {removed.map((id) => (
                                <li key={`remove-${id}`}>− {name(id)}</li>
                              ))}
                            </ul>
                          </>
                        ) : metadataChanges.length ? (
                          <dl className="hn-iam-role-history-metadata">
                            {metadataChanges.map((change) => (
                              <div key={change.key}>
                                <dt>{change.label}</dt>
                                <dd>
                                  <span>{change.before}</span>
                                  <span aria-hidden="true"> → </span>
                                  <strong>{change.after}</strong>
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p>{t("iam.roleUi.historyNoDiff")}</p>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="hn-iam-role-empty">
                {t("iam.roleUi.historyEmpty")}
              </p>
            )}
            {total > 10 ? (
              <UiPagination
                page={page}
                pageSize={10}
                total={total}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </div>
    </UiDrawer>
  );
}
