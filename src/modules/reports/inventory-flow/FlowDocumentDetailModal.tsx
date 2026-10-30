import { useQuery } from "@tanstack/react-query";
import { fetchInboundDetail } from "@/modules/inbound/services/inboundService";
import { fetchOutboundDetail } from "@/modules/outbound/services/mvpOutboundService";
import { useT } from "@/shared/i18n/useT";
import type { FlowDocument } from "./inventory-flow-api";
import { DrillDownModal, ModalCloseButton } from "./inventory-flow-overlays";

type DetailDocument = FlowDocument & { doc_type: "INBOUND" | "OUTBOUND" };

export function FlowDocumentDetailModal({
  document,
  onClose,
}: {
  document: DetailDocument;
  onClose: () => void;
}) {
  const t = useT();
  const detail = useQuery({
    queryKey: ["report-document-detail", document.doc_type, document.id],
    queryFn: async () =>
      document.doc_type === "INBOUND"
        ? { type: "INBOUND" as const, value: await fetchInboundDetail(document.id) }
        : { type: "OUTBOUND" as const, value: await fetchOutboundDetail(document.id) },
    retry: false,
  });
  const outbound = detail.data?.type === "OUTBOUND" ? detail.data.value : null;

  return (
    <DrillDownModal titleId="rpt01-document-detail-title" onClose={onClose} className="flow-document-modal">
      <div className="modal-head">
        <div>
          <span className="eyebrow">{document.doc_type === "INBOUND" ? t("reports.inventoryFlowReport.docInbound") : t("reports.inventoryFlowReport.docOutbound")}</span>
          <h2 id="rpt01-document-detail-title">{document.document_no}</h2>
          <span>{document.warehouse_code} · {document.status} · {document.counterpart}</span>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>
      <div className="flow-document-detail">
        {detail.isPending ? <p role="status">{t("reports.inventoryFlowReport.loadingData")}</p> : null}
        {detail.isError ? (
          <div role="alert">
            <p>{detail.error instanceof Error ? detail.error.message : String(detail.error)}</p>
            <button type="button" className="button" onClick={() => void detail.refetch()}>{t("common.retry")}</button>
          </div>
        ) : null}
        {detail.isError && document.reportLines && document.reportLines.length > 0 ? (
          <div className="flow-document-detail-lines">
            {document.reportLines.map((line) => (
              <article key={line.id}>
                <strong>{line.sku}</strong>
                <span>{line.name}</span>
                <span>{line.scanned}</span>
              </article>
            ))}
          </div>
        ) : null}
        {detail.data?.type === "INBOUND" ? (
          <>
            <div className="flow-document-detail-summary">
              <div><small>{t("reports.inventoryFlowReport.docInbound")}</small><strong>{detail.data.value.document.code}</strong></div>
              <div><small>{t("reports.inventoryFlowReport.detailStatus")}</small><strong>{detail.data.value.document.status}</strong></div>
              <div><small>{t("reports.inventoryFlowReport.colReceiptNet")}</small><strong>{detail.data.value.document.scanned}</strong></div>
            </div>
            <div className="flow-document-detail-lines">
              {detail.data.value.lines.length === 0 ? <p>{t("reports.inventoryFlowReport.detailNoLines")}</p> : null}
              {detail.data.value.lines.map((line) => (
                <article key={line.id}>
                  <strong>{line.sku}</strong>
                  <span>{line.skuName}</span>
                  <span>{line.scanned}</span>
                </article>
              ))}
            </div>
          </>
        ) : null}
        {outbound !== null ? (
          <>
            <div className="flow-document-detail-summary">
              <div><small>{t("reports.inventoryFlowReport.docOutbound")}</small><strong>{outbound.document.code}</strong></div>
              <div><small>{t("reports.inventoryFlowReport.detailStatus")}</small><strong>{outbound.document.status}</strong></div>
              <div><small>{t("reports.inventoryFlowReport.colIssueNet")}</small><strong>{outbound.document.scanned}</strong></div>
            </div>
            <div className="flow-document-detail-lines">
              {outbound.lines.length === 0 ? <p>{t("reports.inventoryFlowReport.detailNoLines")}</p> : null}
              {outbound.lines.map((line) => (
                <article key={line.id}>
                  <strong>{line.skuCode || line.productId}</strong>
                  <span>{line.skuName || "—"}</span>
                  <span>{line.scanned}</span>
                  {outbound.itemMatches.filter((match) => match.lineId === line.id).map((match) => (
                    <div className="flow-document-detail-match" key={match.id}>
                      <span>{match.serialNumber || match.itemCode || "—"}</span>
                      <span>{match.labelStatus || match.status}</span>
                    </div>
                  ))}
                </article>
              ))}
            </div>
            {outbound.statusHistory.length > 0 ? (
              <div className="flow-document-detail-history">
                <h3>{t("reports.inventoryFlowReport.detailHistory")}</h3>
                {outbound.statusHistory.map((entry) => (
                  <div key={entry.id}><strong>{entry.toStatus}</strong><span>{entry.changedAt || "—"}</span><span>{entry.changedBy || "—"}</span></div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </DrillDownModal>
  );
}
