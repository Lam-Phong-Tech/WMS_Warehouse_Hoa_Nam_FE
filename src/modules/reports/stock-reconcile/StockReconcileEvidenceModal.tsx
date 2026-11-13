import { useT } from "@/shared/i18n/useT";
import { Box, UiDialog, UiStatusBadge } from "@/shared/ui";
import { formatDateTime } from "@/shared/utils/format-date";
import { useDateTimePreferences } from "@/shared/store/interface-preferences.store";
import { checkLabelOf } from "./stock-reconcile-labels";
import { useSkuMovements } from "./stock-reconcile-api";

export type StockReconcileEvidence = {
  skuCode: string;
  skuName: string;
  warehouse: string;
  opening: number;
  inbound: number;
  productOutbound: number;
  componentOutbound: number;
  reversal: number;
  closing: number;
  actual: number;
  delta: number;
  checks: string[];
};

const quantity = (value: number) => value.toLocaleString("vi-VN");

/** Read-only evidence for the selected SKU. No serial-level comparison is implied. */
export function StockReconcileEvidenceModal({
  skuCode,
  skuName,
  warehouse,
  opening,
  inbound,
  productOutbound,
  componentOutbound,
  reversal,
  closing,
  actual,
  delta,
  checks,
  onClose,
}: StockReconcileEvidence & { onClose: () => void }) {
  const tUi = useT();
  useDateTimePreferences();
  const movements = useSkuMovements(skuCode);
  return (
    <UiDialog
      open
      onClose={onClose}
      title={tUi("uiAudit.evidenceTitle", { sku: skuCode })}
      maxWidth="lg"
      fullWidth
      className="rpt02-evidence-dialog"
      actions={
        <button
          type="button"
          className="rpt02-button rpt02-button--ghost"
          onClick={onClose}
        >
          {tUi("nfc.close")}{" "}
        </button>
      }
    >
      <Box className="rpt02-evidence">
        <div className="rpt02-evidence__identity">
          <div>
            <span>SKU</span>
            <strong>{skuCode}</strong>
          </div>
          <div>
            <span>{tUi("inventory.balance.colName")}</span>
            <strong>{skuName || "—"}</strong>
          </div>
          <div>
            <span>Kho</span>
            <strong>{warehouse || "—"}</strong>
          </div>
        </div>
        <div className="rpt02-evidence__metrics">
          <div>
            <span>{tUi("inventory.balance.colLedger")}</span>
            <strong>{quantity(closing)}</strong>
          </div>
          <div>
            <span>{tUi("reports.stockReconcileReport.colRecordedStock")}</span>
            <strong>{quantity(actual)}</strong>
          </div>
          <div>
            <span>{tUi("dashboardAudit.delta")}</span>
            <strong className={delta === 0 ? "" : "is-alert"}>
              {delta > 0 ? "+" : ""}
              {quantity(delta)}
            </strong>
          </div>
        </div>
        <section>
          <h3>{tUi("uiAudit.text_079e43a75d")}</h3>
          {checks.length ? (
            <div className="rpt02-evidence__checks">
              {checks.map((check) => (
                <UiStatusBadge
                  key={check}
                  tone="warning"
                  label={checkLabelOf(check)}
                />
              ))}
            </div>
          ) : (
            <p>{tUi("uiAudit.text_f168cec0bc")}</p>
          )}
          {checks.some(
            (check) => check.includes("serial") || check.includes("container"),
          ) ? (
            <p className="rpt02-evidence__note">
              {tUi("uiAudit.text_70ca059cd1")}{" "}
            </p>
          ) : null}
        </section>
        <section>
          <h3>{tUi("uiAudit.text_152f20960f")}</h3>
          <p className="rpt02-evidence__formula">
            {quantity(opening)} + {quantity(inbound)} −{" "}
            {quantity(productOutbound)} − {quantity(componentOutbound)} +{" "}
            {quantity(reversal)} = {quantity(closing)}
          </p>
          {movements.loading ? (
            <p role="status">{tUi("uiAudit.text_35fa0c67fe")}</p>
          ) : movements.events.length ? (
            <div className="rpt02-evidence__table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>{tUi("uiAudit.text_e70daaa5e7")}</th>
                    <th>{tUi("packingLabelReport.time")}</th>
                    <th>{tUi("dashboardSnapshot.type")}</th>
                    <th>Kho</th>
                    <th className="num">{tUi("uiAudit.text_2d141c1485")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.movement_no || "—"}</td>
                      <td>{formatDateTime(event.occurred_at)}</td>
                      <td>{event.movement_type}</td>
                      <td>{event.warehouse_code || "—"}</td>
                      <td className="num">
                        {event.qty_delta > 0 ? "+" : ""}
                        {quantity(event.qty_delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>{tUi("uiAudit.text_3f558b179d")}</p>
          )}
        </section>
      </Box>
    </UiDialog>
  );
}
