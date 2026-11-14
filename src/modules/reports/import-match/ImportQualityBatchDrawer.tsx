import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UiAlert, UiButton, UiDrawer } from "@/shared/ui";
import { DownloadOutlined } from "@/shared/components/icons";
import { ActionIconButton } from "@/shared/components/actions";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { getDisplayTimezone } from "@/shared/utils/date-time";
import { useT } from "@/shared/i18n/useT";
import { fmt, fmtDateTime, pct, type Raw } from "../operations/report-format";
import {
  buildImportBatches,
  type ImportMatchBatch,
} from "./import-match-model";
import {
  downloadImportQualityFile,
  recheckImportQuality,
  useImportQualityVersions,
} from "./import-quality-api";
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
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState(batch.id);
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const drawer = useDialogExit(onClose);
  const history = useImportQualityVersions(batch.id);
  const versions = buildImportBatches(history.data ?? [], () => "");
  const active = versions.find((version) => version.id === selectedId) ?? batch;
  const details = active.importDetails;
  const unknown = t("importResult.unknown");
  const number = (value: number | null | undefined) =>
    value == null ? unknown : fmt(value);
  const date = (value: string | undefined) =>
    value ? fmtDateTime(value) : unknown;
  const mode = (value: string | undefined) =>
    value === "DRY_RUN"
      ? t("importResult.dryRun")
      : value === "COMMIT"
        ? t("importResult.commit")
        : unknown;
  const status = (value: string) => {
    switch (value) {
      case "VALID":
        return t("importResult.valid");
      case "REJECTED":
      case "INVALID":
        return t("importResult.rejected");
      case "COMMITTED":
        return t("importResult.committed");
      case "PROCESSING":
      case "PENDING":
        return t("importResult.processing");
      case "FAILED":
        return t("importResult.failed");
      default:
        return value || unknown;
    }
  };
  const versionLabel = (item: ImportMatchBatch) =>
    item.importDetails?.version == null
      ? t("importResult.unknownVersion")
      : t("importResult.version", { version: item.importDetails.version });
  const metrics = [
    {
      label: t("importResult.totalRows"),
      value: active.total,
      tone: "neutral",
    },
    {
      label: t("importResult.validRows"),
      value: active.success,
      tone: "success",
    },
    {
      label: t("importResult.duplicateRows"),
      value: active.duplicate,
      tone: "warning",
    },
    { label: t("importResult.errorRows"), value: active.failed, tone: "error" },
  ];
  const sourceReason = details?.sourceAvailable
    ? t("importResult.retained")
    : details?.sourceStatus === "MISSING"
      ? t("importResult.sourceMissing")
      : t("importResult.notRetained");
  const errorReason =
    active.errorFileAvailable && details?.errorExpiresAt
      ? t("importResult.errorExpires", { at: date(details.errorExpiresAt) })
      : details?.errorStatus === "EXPIRED"
        ? t("importResult.errorExpired")
        : t("importResult.noErrorFile");

  async function perform(
    kind: "source-file" | "result-file" | "error-file" | "recheck",
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    setError("");
    try {
      if (kind === "recheck") {
        const result = await recheckImportQuality(active.id);
        await client.cancelQueries({
          queryKey: ["rpt-04", "sku-import-versions", batch.id],
        });
        client.setQueryData<Raw[]>(
          ["rpt-04", "sku-import-versions", batch.id],
          (old) => [
            result,
            ...(old ?? []).filter(
              (item) => item.import_report_id !== result.import_report_id,
            ),
          ],
        );
        setSelectedId(String(result.import_report_id));
        void client.invalidateQueries({
          queryKey: ["rpt-04", "sku-import-batches"],
        });
      } else await downloadImportQualityFile(active.id, kind);
    } catch (cause) {
      setError(getApiErrorMessage(cause, t("importResult.actionError")));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }
  async function copyId() {
    try {
      await navigator.clipboard.writeText(active.id);
      setCopied(true);
    } catch {
      setError(t("importResult.copyFailed"));
    }
  }

  return (
    <UiDrawer
      {...drawer.dialogProps}
      onClose={busy ? undefined : drawer.dialogProps.onClose}
      width={820}
      className="rpt04-batch-drawer"
      title={
        <span className="rpt04-batch-heading">
          <span className="rpt04-batch-title">
            {t("updatedUi.text_ecd76b3f0e22", {
              value0: active.sourceFile || active.batchNo || unknown,
            })}
          </span>
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={drawer.close}
            disabled={Boolean(busy)}
            className="rpt04-batch-close"
          />
        </span>
      }
    >
      <section
        aria-label={t("importResult.source")}
        className="rpt04-batch-section"
      >
        <h3>{t("importResult.source")}</h3>
        <p className="rpt04-batch-note">
          {t("reports.importQuality.sourceSkuImport")}
        </p>
        <dl className="rpt04-batch-context">
          <div className="rpt04-batch-full">
            <dt>{t("importResult.file")}</dt>
            <dd>{active.sourceFile || unknown}</dd>
          </div>
          <div>
            <dt>{t("importResult.uploadBy")}</dt>
            <dd>{details?.uploader || unknown}</dd>
          </div>
          <div>
            <dt>{t("importResult.account")}</dt>
            <dd>{details?.uploaderAccount || unknown}</dd>
          </div>
          <div>
            <dt>{t("importResult.uploadAt")}</dt>
            <dd>{date(details?.uploadedAt)}</dd>
          </div>
          <div>
            <dt>{t("importResult.size")}</dt>
            <dd>
              {details?.size == null
                ? unknown
                : details.size < 1024
                  ? `${fmt(details.size)} B`
                  : details.size < 1024 * 1024
                    ? `${fmt(details.size / 1024)} KB`
                    : `${fmt(details.size / (1024 * 1024))} MB`}
            </dd>
          </div>
          <div>
            <dt>{t("importResult.sheet")}</dt>
            <dd>{details?.sheet || unknown}</dd>
          </div>
          <div>
            <dt>{t("importResult.template")}</dt>
            <dd>{active.sourceVersion || unknown}</dd>
          </div>
        </dl>
        <details className="rpt04-batch-checksum">
          <summary>{t("importResult.checksum")}</summary>
          <p>{active.checksum || unknown}</p>
        </details>
        <p className="rpt04-batch-note">
          {t("importResult.timezone", { zone: getDisplayTimezone() })}
        </p>
      </section>
      <section
        aria-label={t("importResult.history")}
        className="rpt04-batch-section"
      >
        <h3>{t("importResult.history")}</h3>
        {history.isLoading ? (
          <p role="status">{t("importResult.historyLoading")}</p>
        ) : null}
        {history.error ? (
          <UiAlert tone="error">
            {t("importResult.historyError")}{" "}
            <UiButton appearance="text" onClick={() => void history.refetch()}>
              {t("importResult.retry")}
            </UiButton>
          </UiAlert>
        ) : null}
        <div className="rpt04-batch-history">
          {(versions.length ? versions : [batch]).map((item) => (
            <UiButton
              key={item.id}
              appearance={item.id === active.id ? "tonal" : "outlined"}
              aria-pressed={item.id === active.id}
              disabled={Boolean(busy)}
              onClick={() => {
                setSelectedId(item.id);
                setError("");
                setCopied(false);
              }}
            >
              <span>
                <strong>{versionLabel(item)}</strong>
                <span>
                  {mode(item.importDetails?.mode)} · {status(item.status)}
                </span>
                <span>
                  {date(item.at)} · {item.actor || unknown}
                </span>
              </span>
            </UiButton>
          ))}
        </div>
        {!history.isLoading && !history.error && versions.length <= 1 ? (
          <p className="rpt04-batch-note">{t("importResult.historyEmpty")}</p>
        ) : null}
      </section>
      <section
        aria-label={t("importResult.result")}
        className="rpt04-batch-section"
      >
        <h3>
          {t("importResult.result")} · {versionLabel(active)}
        </h3>
        <dl className="rpt04-batch-context">
          <div className="rpt04-batch-full">
            <dt>{t("importResult.id")}</dt>
            <dd className="rpt04-batch-id">
              <span>{active.id || unknown}</span>
              <UiButton
                appearance="text"
                disabled={!active.id}
                onClick={() => void copyId()}
              >
                {t("importResult.copyId")}
              </UiButton>
            </dd>
          </div>
          <div>
            <dt>{t("importResult.checker")}</dt>
            <dd>
              {active.actor || unknown}
              {details?.actorAccount ? (
                <small>{details.actorAccount}</small>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>{t("importResult.resultAt")}</dt>
            <dd>{date(active.at)}</dd>
          </div>
          <div>
            <dt>{t("importResult.mode")}</dt>
            <dd>{mode(details?.mode)}</dd>
          </div>
          <div>
            <dt>{t("importResult.status")}</dt>
            <dd>{status(active.status)}</dd>
          </div>
          <div>
            <dt>{t("importResult.startedAt")}</dt>
            <dd>{date(details?.startedAt)}</dd>
          </div>
          <div>
            <dt>{t("importResult.completedAt")}</dt>
            <dd>{date(details?.completedAt)}</dd>
          </div>
          <div>
            <dt>{t("importResult.duration")}</dt>
            <dd>
              {details?.durationMs == null
                ? unknown
                : t("importResult.seconds", {
                    seconds: fmt(details.durationMs / 1000),
                  })}
            </dd>
          </div>
          <div>
            <dt>{t("importResult.updateExisting")}</dt>
            <dd>
              {details?.updateExisting == null
                ? unknown
                : details.updateExisting
                  ? t("importResult.yes")
                  : t("importResult.no")}
            </dd>
          </div>
        </dl>
        {copied ? <p role="status">{t("importResult.copied")}</p> : null}
        <dl className="rpt04-batch-metrics">
          {metrics.map((metric) => (
            <div key={metric.label} data-tone={metric.tone}>
              <dt>{metric.label}</dt>
              <dd>{fmt(metric.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="rpt04-batch-note">{t("importResult.rowNote")}</p>
        <div className="rpt04-batch-rate">
          <span>{t("importResult.validRate")}</span>
          <strong>{pct(active.success, active.total)}</strong>
        </div>
        <progress
          className="rpt04-batch-progress"
          aria-label={t("importResult.validRate")}
          value={Math.max(0, active.success)}
          max={Math.max(1, active.total)}
        />
      </section>
      <section
        aria-label={t("importResult.writes")}
        className="rpt04-batch-section"
      >
        <h3>{t("importResult.writes")}</h3>
        <dl className="rpt04-batch-metrics rpt04-batch-writes">
          <div>
            <dt>{t("importResult.inserted")}</dt>
            <dd>{number(details?.inserted)}</dd>
          </div>
          <div>
            <dt>{t("importResult.updated")}</dt>
            <dd>{number(details?.updated)}</dd>
          </div>
          <div>
            <dt>{t("importResult.notWritten")}</dt>
            <dd>{number(details?.notWritten)}</dd>
          </div>
        </dl>
        {details?.mode === "DRY_RUN" ? (
          <p className="rpt04-batch-note">
            {t("importResult.projection", {
              inserted: number(details.plannedInserted),
              updated: number(details.plannedUpdated),
            })}
          </p>
        ) : null}
      </section>
      <section className="rpt04-batch-section">
        <div className="rpt04-batch-actions">
          <UiButton
            appearance="outlined"
            startIcon={<DownloadOutlined />}
            disabled={Boolean(busy) || !details?.sourceAvailable}
            loading={busy === "source-file"}
            onClick={() => void perform("source-file")}
          >
            {t("importResult.originalDownload")}
          </UiButton>
          <UiButton
            appearance="outlined"
            startIcon={<DownloadOutlined />}
            disabled={Boolean(busy) || !active.id}
            loading={busy === "result-file"}
            onClick={() => void perform("result-file")}
          >
            {t("importResult.resultDownload")}
          </UiButton>
          <UiButton
            appearance="outlined"
            startIcon={<DownloadOutlined />}
            disabled={Boolean(busy) || !active.errorFileAvailable}
            loading={busy === "error-file"}
            onClick={() => void perform("error-file")}
          >
            {t("importResult.errorDownload")}
          </UiButton>
          <UiButton
            disabled={
              Boolean(busy) ||
              !details?.sourceAvailable ||
              details.updateExisting == null
            }
            loading={busy === "recheck"}
            onClick={() => void perform("recheck")}
          >
            {busy === "recheck"
              ? t("importResult.rechecking")
              : t("importResult.recheck")}
          </UiButton>
        </div>
        <p className="rpt04-batch-note">{sourceReason}</p>
        <p className="rpt04-batch-note">{errorReason}</p>
        <p className="rpt04-batch-note">
          {details?.sourceAvailable && details.updateExisting == null
            ? t("importResult.optionUnknown")
            : t("importResult.recheckHint")}
        </p>
        {error ? <UiAlert tone="error">{error}</UiAlert> : null}
      </section>
      {active.id ? (
        <ImportQualityIssuePanel
          key={active.id}
          batchId={active.id}
          sourceFile={active.sourceFile}
        />
      ) : null}
      <p className="rpt04-batch-note">{t("importResult.snapshot")}</p>
    </UiDrawer>
  );
}
