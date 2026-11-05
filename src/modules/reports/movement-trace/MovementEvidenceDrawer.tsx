import type { ReactNode } from "react";
import {
  UiButton,
  UiDrawer,
  UiStatusBadge,
  type UiStatusTone,
} from "@/shared/ui";
import { ActionIconButton } from "@/shared/components/actions";
import {
  FileTextOutlined,
  InboxOutlined,
  SearchOutlined,
} from "@/shared/components/icons";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import type { MovementTraceRow } from "./movement-trace-api";
import "./movement-evidence-drawer.css";

interface Props {
  row: MovementTraceRow;
  movementLabel: string;
  occurredAtLabel: string;
  sourceDocument: string;
  reversalChain: string;
  currentStatus: { tone: UiStatusTone; label: string };
  onClose: () => void;
  onTrace: () => void;
}

function EvidenceField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="movement-evidence-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function MovementEvidenceDrawer({
  row,
  movementLabel,
  occurredAtLabel,
  sourceDocument,
  reversalChain,
  currentStatus,
  onClose,
  onTrace,
}: Props) {
  const t = useT();
  const deltaTone =
    row.qtyDelta > 0 ? "increase" : row.qtyDelta < 0 ? "decrease" : "neutral";
  return (
    <UiDrawer
      open
      width={640}
      onClose={onClose}
      className="movement-evidence-drawer"
      title={
        <span className="movement-evidence-heading">
          <span className="movement-evidence-eyebrow">
            {t("reports.movementTrace.drawerEyebrow")}
          </span>
          <span className="movement-evidence-title">
            {t("reports.movementTrace.drawerTitle")}
          </span>
          <span className="movement-evidence-number">
            {row.movementNo || EMPTY_TEXT}
          </span>
          <span className="movement-evidence-caption">
            {movementLabel} · {occurredAtLabel}
          </span>
          <ActionIconButton
            kind="close"
            label={t("reports.movementTrace.drawerClose")}
            onClick={onClose}
            className="movement-evidence-close"
          />
        </span>
      }
      actions={
        row.physicalCode ? (
          <UiButton
            fullWidth
            onClick={onTrace}
            startIcon={<SearchOutlined />}
            className="movement-evidence-trace-action"
          >
            {t("reports.movementTrace.tracePhysicalCode")}
          </UiButton>
        ) : undefined
      }
    >
      <section className="movement-evidence-summary" aria-label="SKU">
        <div className="movement-evidence-product">
          <span className="movement-evidence-product-icon" aria-hidden="true">
            <InboxOutlined />
          </span>
          <div>
            <span className="movement-evidence-label">SKU</span>
            <strong>{row.productCode || EMPTY_TEXT}</strong>
            {row.productName ? <p>{row.productName}</p> : null}
          </div>
        </div>
        <div className="movement-evidence-delta" data-delta-tone={deltaTone}>
          <span className="movement-evidence-label">
            {t("reports.movementTrace.colQtyDelta")}
          </span>
          <strong>
            {row.qtyDelta > 0 ? "+" : ""}
            {String(row.qtyDelta)}
          </strong>
        </div>
        <dl className="movement-evidence-stock">
          <EvidenceField label={t("reports.traceability.colCurrentStatus")}>
            <UiStatusBadge
              tone={currentStatus.tone}
              label={currentStatus.label}
            />
          </EvidenceField>
          <EvidenceField label={t("reports.traceability.colLocation")}>
            {row.warehouseCode || t("reports.traceability.warehouseName")}
          </EvidenceField>
        </dl>
      </section>
      <section
        className="movement-evidence-details"
        aria-labelledby="movement-evidence-details-title"
      >
        <h3 id="movement-evidence-details-title">
          <FileTextOutlined aria-hidden="true" />
          {t("reports.movementTrace.evidenceDetails")}
        </h3>
        <dl>
          <EvidenceField label={t("reports.traceability.colTraceCode")}>
            {row.physicalCode || row.containerId || row.itemId || EMPTY_TEXT}
          </EvidenceField>
          <EvidenceField label={t("reports.movementTrace.fieldSourceDoc")}>
            {sourceDocument}
          </EvidenceField>
          <EvidenceField label={t("reports.movementTrace.actor")}>
            {row.actor || EMPTY_TEXT}
          </EvidenceField>
          <EvidenceField label={t("reports.movementTrace.fieldReversalChain")}>
            {reversalChain}
          </EvidenceField>
        </dl>
      </section>
      <p className="movement-evidence-note">
        <span>{t("reports.movementTrace.readonlyNote")}</span>
      </p>
    </UiDrawer>
  );
}
