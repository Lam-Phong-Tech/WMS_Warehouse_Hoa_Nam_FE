import { UiDrawer } from "@/shared/ui";
import { ActionIconButton } from "@/shared/components/actions";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { useT } from "@/shared/i18n/useT";
import { fmt, fmtDateTime, pct } from "../operations/report-format";
import type { ImportMatchBatch } from "./import-match-model";
import { ImportQualityIssuePanel } from "./ImportQualityIssuePanel";
import "./import-quality-batch-drawer.css";

export function ImportQualityBatchDrawer({
  batch,
  onClose,
}: {
  batch: ImportMatchBatch;
  onClose: () => void;
}) {
  const t = useT();
  const drawer = useDialogExit(onClose);
  const metrics = [
    {
      label: t("updatedUi.text_fe86ff7f56fe"),
      value: batch.total,
      tone: "neutral",
    },
    {
      label: t("reports.inventoryFlowReport.matched"),
      value: batch.success,
      tone: "success",
    },
    {
      label: t("inventory.balance.colVariance"),
      value: batch.duplicate,
      tone: "warning",
    },
    {
      label: t("updatedUi.text_e557e75b43a7"),
      value: batch.failed,
      tone: "error",
    },
  ];
  return (
    <UiDrawer
      {...drawer.dialogProps}
      width={820}
      className="rpt04-batch-drawer"
      title={
        <span className="rpt04-batch-heading">
          <span className="rpt04-batch-title">
            {t("updatedUi.text_ecd76b3f0e22", {
              value0: batch.batchNo || t("updatedUi.text_3c28fe9f81e1"),
            })}
          </span>
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={drawer.close}
            className="rpt04-batch-close"
          />
        </span>
      }
    >
      <dl className="rpt04-batch-context">
        <div>
          <dt>{t("audit.colObject")}</dt>
          <dd>{batch.caption || batch.sourceFile || "—"}</dd>
        </div>
        <div>
          <dt>{t("updatedUi.text_5293d03c5908")}</dt>
          <dd>{batch.at ? fmtDateTime(batch.at) : "—"}</dd>
        </div>
      </dl>
      <dl className="rpt04-batch-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} data-tone={metric.tone}>
            <dt>{metric.label}</dt>
            <dd>{fmt(metric.value)}</dd>
          </div>
        ))}
      </dl>
      <div className="rpt04-batch-rate">
        <span>{t("updatedUi.text_0a3f7deb0656")}</span>
        <strong>{pct(batch.success, batch.total)}</strong>
      </div>
      <progress
        className="rpt04-batch-progress"
        aria-label={t("updatedUi.text_0a3f7deb0656")}
        value={Math.max(0, batch.success)}
        max={Math.max(1, batch.total)}
      />
      {batch.id ? (
        <ImportQualityIssuePanel
          key={batch.id}
          batchId={batch.id}
          sourceFile={batch.sourceFile}
        />
      ) : null}
      <p className="rpt04-batch-note">{t("updatedUi.text_8227ce3f3753")}</p>
    </UiDrawer>
  );
}
