import { type ReactNode } from "react";
import { useT } from "@/shared/i18n/useT";
import { UiDrawer, UiIcon, UiStatusBadge } from "@/shared/ui";
import { ActionIconButton } from "@/shared/components/actions";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import type { AuditLog } from "../types/audit-logs.types";
import { formatDateTime } from "@/shared/utils/format-date";
import { AUDIT_MODULE_LABELS } from "@/shared/constants/business-labels";
import {
  auditActionLabel,
  auditDataChanges,
  auditObjectCode,
  auditObjectTypeLabel,
  auditResultLabel,
  auditResultTone,
  describeAuditLog,
} from "../constants/audit-log-labels";
import "../pages/audit-logs.css";

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="hn-audit-detail-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export interface AuditLogDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  auditLog: AuditLog | null;
}

export function AuditLogDetailDrawer({
  open,
  onClose,
  auditLog,
}: AuditLogDetailDrawerProps) {
  const t = useT();
  if (!auditLog) return null;
  const objectCode = auditObjectCode(auditLog);
  const changes = auditDataChanges(auditLog);
  return (
    <UiDrawer
      className="hn-settings-dialog hn-audit-drawer"
      open={open}
      onClose={onClose}
      width={800}
      title={
        <span className="hn-audit-drawer-title">
          <span>{t("audit.detailTitle")}</span>
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={onClose}
          />
        </span>
      }
    >
      <div className="hn-audit-detail-content">
        <section className="hn-audit-event-heading">
          <div>
            <span className="hn-audit-eyebrow">
              {AUDIT_MODULE_LABELS[auditLog.module] || t("audit.moduleOther")}
            </span>
            <h3>{auditActionLabel(auditLog.action)}</h3>
          </div>
          <UiStatusBadge
            className="hn-audit-result"
            tone={auditResultTone(auditLog.result)}
            data-settings-tone={auditResultTone(auditLog.result)}
            label={
              auditResultLabel(auditLog.result) || t("audit.resultUnknown")
            }
          />
        </section>
        <section
          className="hn-audit-detail-section"
          aria-labelledby="audit-event-summary"
        >
          <h3 id="audit-event-summary">{t("audit.eventSummary")}</h3>
          <dl className="hn-audit-detail-grid">
            <DetailField
              label={t("audit.colActor")}
              value={
                <>
                  <strong>
                    {auditLog.actor?.display_name ||
                      auditLog.actor?.email ||
                      t("audit.system")}
                  </strong>
                  {auditLog.actor?.display_name && auditLog.actor.email ? (
                    <span className="hn-audit-secondary">
                      {auditLog.actor.email}
                    </span>
                  ) : null}
                </>
              }
            />
            <DetailField
              label={t("audit.colTime")}
              value={
                <time dateTime={auditLog.created_at}>
                  {formatDateTime(auditLog.created_at)}
                </time>
              }
            />
            <DetailField
              label={t("audit.colObject")}
              value={
                <>
                  <span title={auditLog.object_type}>
                    {auditObjectTypeLabel(auditLog.object_type)}
                  </span>
                  {objectCode ? (
                    <strong className="hn-audit-block">{objectCode}</strong>
                  ) : auditLog.object_id ? (
                    <CopyableId value={auditLog.object_id} />
                  ) : null}
                </>
              }
            />
            <DetailField
              label={t("audit.colModule")}
              value={
                AUDIT_MODULE_LABELS[auditLog.module] || t("audit.moduleOther")
              }
            />
            <div className="hn-audit-detail-full">
              <DetailField
                label={t("audit.colDescription")}
                value={describeAuditLog(auditLog)}
              />
            </div>
          </dl>
        </section>
        <section
          className="hn-audit-detail-section"
          aria-labelledby="audit-event-changes"
        >
          <h3 id="audit-event-changes">{t("audit.changeContent")}</h3>
          {changes.length ? (
            <div
              className="hn-audit-changes"
              role="table"
              aria-label={t("audit.changeContent")}
            >
              <div className="hn-audit-change-header" role="row">
                <span role="columnheader">{t("audit.changeField")}</span>
                <span role="columnheader">{t("audit.beforeData")}</span>
                <span role="columnheader">{t("audit.afterData")}</span>
              </div>
              {changes.map((change) => (
                <div
                  key={change.key}
                  className="hn-audit-change"
                  role="row"
                  data-changed={change.changed}
                >
                  <strong className="hn-audit-change-name" role="rowheader">
                    {change.label}
                  </strong>
                  <div
                    className="hn-audit-change-before"
                    role="cell"
                    data-label={t("audit.beforeData")}
                  >
                    <span>{change.before ?? t("audit.notRecorded")}</span>
                  </div>
                  <div
                    className="hn-audit-change-after"
                    role="cell"
                    data-label={t("audit.afterData")}
                  >
                    <span>{change.after ?? t("audit.notRecorded")}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="hn-audit-secondary">{t("audit.noChanges")}</p>
          )}
        </section>
        <section
          className="hn-audit-detail-section"
          aria-labelledby="audit-technical-details"
        >
          <h3 id="audit-technical-details">{t("audit.technicalDetails")}</h3>
          <dl className="hn-audit-detail-grid">
            <DetailField
              label={t("audit.colIp")}
              value={auditLog.ip_address || t("audit.notRecorded")}
            />
            <DetailField
              label={t("audit.requestId")}
              value={
                auditLog.request_id ? (
                  <span title={auditLog.request_id}>
                    <CopyableId value={auditLog.request_id} />
                  </span>
                ) : (
                  t("audit.notRecorded")
                )
              }
            />
            <DetailField
              label={t("audit.fieldRecordId")}
              value={<CopyableId value={auditLog.id} />}
            />
            <DetailField
              label={t("audit.errorCode")}
              value={auditLog.error_code || t("audit.notRecorded")}
            />
          </dl>
        </section>
        <p className="hn-audit-readonly-note">
          <UiIcon name="info" size="sm" />
          <span>{t("audit.readOnlyNotice")}</span>
        </p>
      </div>
    </UiDrawer>
  );
}
