import type { ReactNode } from "react";
import {
  RETURN_CONDITION_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import { formatQuantity } from "@/shared/utils/format-number";
import type { ReversalLine } from "../types";
import { ReversalStatusTag } from "./ReversalStatusTag";

function LineField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** All eleven line fields remain visible at the drawer's actual width. */
export function ReversalLineCard({ line }: { line: ReversalLine }) {
  const t = useT();
  return (
    <article
      className="hn-reversal-detail-line"
      aria-label={`${line.line_no} · ${line.sku}`}
    >
      <header className="hn-reversal-detail-line-header">
        <div className="hn-reversal-detail-line-identity">
          <span
            className="hn-reversal-detail-line-number"
            aria-label={t("reverse.detail.colStt")}
          >
            {line.line_no}
          </span>
          <div>
            <strong>{line.sku}</strong>
            <p>{line.sku_name}</p>
          </div>
        </div>
        <ReversalStatusTag status={line.status} compact />
      </header>
      <dl className="hn-reversal-detail-line-info">
        <LineField label={t("reverse.detail.colOriginalMovement")}>
          {line.original_movement_code || EMPTY_TEXT}
        </LineField>
        <LineField label={t("reverse.detail.colSerial")}>
          {line.serial_number || line.item_code || EMPTY_TEXT}
        </LineField>
        <LineField label={t("reverse.detail.colReturnCondition")}>
          {line.return_condition
            ? businessLabel(
                RETURN_CONDITION_LABELS,
                line.return_condition,
                t("reverse.detail.conditionOther"),
              )
            : EMPTY_TEXT}
        </LineField>
      </dl>
      <dl className="hn-reversal-detail-line-quantities">
        <LineField label={t("reverse.columns.originalQty")}>
          {formatQuantity(line.original_qty)}
        </LineField>
        <LineField label={t("reverse.columns.reversalQty")}>
          {formatQuantity(line.reversal_qty)}
        </LineField>
        <LineField label={t("reverse.columns.reversedQty")}>
          {formatQuantity(line.reversed_qty)}
        </LineField>
        <LineField label={t("reverse.columns.reversibleQty")}>
          {formatQuantity(line.remaining_qty)}
        </LineField>
      </dl>
    </article>
  );
}
