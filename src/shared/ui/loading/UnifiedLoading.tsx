import type { ReactNode } from "react";
import { useT } from "@/shared/i18n/useT";
import { UiSpinner } from "../components/UiSpinner";
import "./coordinated-loading.css";
export interface UnifiedLoadingProps { label?: ReactNode; minHeight?: number; testId?: string; }
/** The same visual for route chunks, pages, cards and overlay bodies. */
export function UnifiedLoading({ label, minHeight = 160, testId }: UnifiedLoadingProps) {
  const t = useT();
  return (
    <div className="hn-unified-loading" data-testid={testId ?? "unified-loading"}
      data-ui-state="loading" role="status" aria-busy="true" aria-live="polite" aria-atomic="true" style={{ minHeight }}>
      <span aria-hidden="true"><UiSpinner size={28} label={null} /></span>
      <span className="hn-unified-loading__label">{label ?? t("shared.states.loadingData")}</span>
    </div>
  );
}
