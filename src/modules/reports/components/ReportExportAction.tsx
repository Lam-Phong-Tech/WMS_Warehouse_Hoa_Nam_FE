import { useId, useRef, useState, type ReactNode } from "react";
import { UiDrawer, UiButton } from "@/shared/ui";
import { DownloadOutlined, CloseOutlined } from "@/shared/components/icons";
import { useT } from "@/shared/i18n/useT";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
} from "@/shared/constants/wms-permissions";
import { getApiErrorMessage } from "@/shared/api/api-error";
import type { ReportExportChoice, ExportScope } from "./report-export-workbook";
import "./report-export.css";

export type ExportSection = {
  id: string;
  label: string;
  description?: string;
  selected?: boolean;
};
export type ExportScopeOption = {
  id: ExportScope;
  label: string;
  description?: string;
  count: number;
};
export type ReportExportDrawerProps = {
  title: string;
  fileStem: string;
  sections: ExportSection[];
  scopes: ExportScopeOption[];
  context?: [string, string][];
  formats?: ("xlsx" | "pdf")[];
  summaries?: (scope: ExportScope) => { label: string; value: ReactNode }[];
  unavailable?: boolean;
  unavailableReason?: string;
  onClose: () => void;
  onExport: (choice: ReportExportChoice) => Promise<unknown> | unknown;
};

export function ReportExportButton({
  onClick,
  disabled,
  loading = false,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
}) {
  const t = useT();
  const allowed = useAuthStore((s) =>
    hasAnyWmsPermission(
      s.permissionCodes,
      WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
      s.isSuperAdmin,
    ),
  );
  return (
    <UiButton
      className="hn-report-export-button"
      appearance="filled"
      color="primary"
      startIcon={<DownloadOutlined />}
      loading={loading}
      disabled={disabled || !allowed}
      title={
        title || (!allowed ? t("reports.filters.exportTooltip") : undefined)
      }
      onClick={onClick}
    >
      {loading ? t("reportExport.busy") : t("reportExport.title")}
    </UiButton>
  );
}

export function ReportExportDrawer({
  title,
  fileStem,
  sections,
  scopes,
  context = [],
  formats = ["xlsx"],
  summaries,
  onClose,
  onExport,
  unavailable = false,
  unavailableReason,
}: ReportExportDrawerProps) {
  const t = useT();
  const radioName = useId();
  const warehouse = useAuthStore((s) =>
    s.currentContext?.warehouse_name?.trim(),
  );
  const [scope, setScope] = useState<ExportScope>(scopes[0]?.id ?? "all");
  const [format, setFormat] = useState<"xlsx" | "pdf">(formats[0] ?? "xlsx");
  const [filename, setFilename] = useState(fileStem + ".xlsx");
  const [selected, setSelected] = useState(() =>
    sections.filter((s) => s.selected !== false).map((s) => s.id),
  );
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const activeScope =
    format === "pdf"
      ? scopes.find((s) => s.id === "all")
      : scopes.find((s) => s.id === scope);
  const sectionIds = format === "pdf" ? ["detail"] : selected;
  const invalid =
    unavailable ||
    !filename
      .trim()
      .replace(/(?:\.(?:xlsx|pdf))+$/gi, "")
      .trim() ||
    !sectionIds.length ||
    !activeScope?.count;
  const close = () => {
    if (!pending.current) onClose();
  };
  const submit = async () => {
    const auth = useAuthStore.getState();
    if (
      !hasAnyWmsPermission(
        auth.permissionCodes,
        WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
        auth.isSuperAdmin,
      )
    ) {
      setError(t("reports.filters.exportTooltip"));
      return;
    }
    if (invalid || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await onExport({
        filename,
        sectionIds,
        scope: format === "pdf" ? "all" : scope,
        format,
      });
      if (result !== false) onClose();
      else setError(t("reportExport.failed"));
    } catch (cause) {
      setError(getApiErrorMessage(cause, t("reportExport.failed")));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <UiDrawer
      open
      width={560}
      className="hn-report-export-drawer"
      onClose={close}
      slotProps={{ paper: { role: "dialog", "aria-modal": true } }}
      title={
        <span className="hn-report-export-heading">
          <span>{title}</span>
          <button
            type="button"
            className="hn-report-export-close"
            aria-label={t("reportExport.close")}
            onClick={close}
            disabled={busy}
          >
            <CloseOutlined />
          </button>
        </span>
      }
      actions={
        <div className="hn-report-export-actions">
          <UiButton appearance="outlined" onClick={close} disabled={busy}>
            {t("reportExport.cancel")}
          </UiButton>
          <UiButton
            className="hn-report-export-button"
            appearance="filled"
            startIcon={<DownloadOutlined />}
            onClick={() => void submit()}
            disabled={Boolean(invalid)}
            loading={busy}
          >
            {busy
              ? t("reportExport.busy")
              : t(
                  format === "pdf"
                    ? "reportExport.submitPdf"
                    : "reportExport.submit",
                )}
          </UiButton>
        </div>
      }
    >
      <div className="hn-report-export-body" aria-busy={busy}>
        <dl className="hn-report-export-context">
          {warehouse ? (
            <div>
              <dt>{t("reportExport.warehouse")}</dt>
              <dd>{warehouse}</dd>
            </div>
          ) : null}
          {context.map(([label, value], i) => (
            <div key={i}>
              <dt>{label}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <fieldset disabled={busy || format === "pdf"}>
          <legend>{t("reportExport.scope")}</legend>
          <div className="hn-report-export-options">
            {scopes.map((option) => (
              <label key={option.id} className="hn-report-export-option">
                <input
                  type="radio"
                  name={radioName}
                  value={option.id}
                  checked={(format === "pdf" ? "all" : scope) === option.id}
                  disabled={!option.count}
                  onChange={() => setScope(option.id)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={busy || format === "pdf"}>
          <legend>{t("reportExport.content")}</legend>
          <div className="hn-report-export-options hn-report-export-options--grid">
            {sections.map((section) => (
              <label key={section.id} className="hn-report-export-option">
                <input
                  type="checkbox"
                  checked={sectionIds.includes(section.id)}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(section.id)
                        ? current.filter((id) => id !== section.id)
                        : [...current, section.id],
                    )
                  }
                />
                <span>
                  <strong>{section.label}</strong>
                  <small>{section.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {format === "pdf" ? (
          <p className="hn-report-export-hint">{t("reportExport.pdfHint")}</p>
        ) : null}
        <section aria-label={t("reportExport.dataSummary")}>
          <h3>{t("reportExport.dataSummary")}</h3>
          <div className="hn-report-export-summary">
            <div>
              <strong>{activeScope?.count ?? 0}</strong>
              <small>{t("reportExport.records")}</small>
            </div>
            <div>
              <strong>{sectionIds.length}</strong>
              <small>{t("reportExport.sheets")}</small>
            </div>
            {summaries?.(scope).map((item, i) => (
              <div key={i}>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </section>
        <div className="hn-report-export-file">
          <label>
            <span>{t("reportExport.filename")}</span>
            <input
              autoComplete="off"
              value={filename}
              disabled={busy}
              onChange={(e) => setFilename(e.target.value)}
            />
          </label>
          <label>
            <span>{t("reportExport.format")}</span>
            <select
              value={format}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value as "xlsx" | "pdf";
                setFormat(next);
                setFilename(
                  (current) =>
                    current.replace(/\.(xlsx|pdf)$/i, "") + "." + next,
                );
              }}
            >
              {formats.map((f) => (
                <option value={f} key={f}>
                  {t(f === "pdf" ? "reportExport.pdf" : "reportExport.excel")}
                </option>
              ))}
            </select>
          </label>
        </div>
        {invalid ? (
          <p className="hn-report-export-hint">
            {unavailable
              ? unavailableReason || t("reportExport.unavailable")
              : activeScope?.count
                ? t("reportExport.invalid")
                : t("reportExport.empty")}
          </p>
        ) : null}
        {busy ? (
          <p role="status" className="hn-report-export-hint">
            {t("reportExport.loadingHint")}
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="hn-report-export-error">
            {error}
          </div>
        ) : null}
      </div>
    </UiDrawer>
  );
}

export type ReportExportActionProps = Omit<
  ReportExportDrawerProps,
  "scopes" | "onClose"
> & {
  total: number;
  currentCount?: number;
  disabled?: boolean;
  loading?: boolean;
  disabledReason?: string;
};
export function ReportExportAction({
  total,
  currentCount,
  disabled,
  loading,
  disabledReason,
  ...props
}: ReportExportActionProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const scopes: ExportScopeOption[] = [
    {
      id: "all",
      label: t("reportExport.all", { count: total }),
      description: t("reportExport.allHint"),
      count: total,
    },
  ];
  if (currentCount !== undefined)
    scopes.push({
      id: "page",
      label: t("reportExport.page", { count: currentCount }),
      description: t("reportExport.pageHint"),
      count: currentCount,
    });
  return (
    <>
      <ReportExportButton
        disabled={disabled || total === 0}
        loading={loading}
        title={disabledReason}
        onClick={() => setOpen(true)}
      />
      {open ? (
        <ReportExportDrawer
          {...props}
          scopes={scopes}
          unavailable={disabled || loading || total === 0}
          unavailableReason={disabledReason}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
