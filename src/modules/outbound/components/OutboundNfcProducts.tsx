import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UiPagination } from "@/shared/ui";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useAuthStore } from "@/shared/store/auth.store";
import { useT } from "@/shared/i18n/useT";
import {
  fetchOutboundNfcItems,
  type OutboundNfcItem,
  type OutboundNfcStatus,
} from "@/modules/outbound/services/outboundNfcService";
import { OutboundNfcProductDetail } from "./OutboundNfcProductDetail";
import "./outbound-nfc.css";

interface Props {
  documentId?: string;
  onOpenDocument?: (id: string) => void;
}

export function OutboundNfcProducts({ documentId, onOpenDocument }: Props) {
  const t = useT();
  const context = useAuthStore((state) => state.currentContext);
  const [draft, setDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [nfcStatus, setNfcStatus] = useState<"ALL" | OutboundNfcStatus>("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OutboundNfcItem | null>(null);
  const query = useQuery({
    queryKey: ["outbound-nfc", context, documentId, keyword, nfcStatus, page],
    queryFn: ({ signal }) =>
      fetchOutboundNfcItems(
        { documentId, keyword: keyword || undefined, nfcStatus, page, perPage: 10 },
        signal,
      ),
  });
  const rows = query.data?.data ?? [];
  const totals = query.data?.meta.tab_totals;
  const loadFailed = query.isError && !query.data;
  const nfcUnknown = query.isError && !!query.data;
  const statusButtons: Array<{ key: "ALL" | OutboundNfcStatus; label: string }> = [
    { key: "ALL", label: t("nfc.outboundAll") },
    { key: "ASSIGNED", label: t("nfc.outboundAssigned") },
    { key: "UNASSIGNED", label: t("nfc.outboundUnassigned") },
  ];

  return (
    <section className="hn-outbound-nfc" aria-label={t("nfc.outboundProductsTitle")}>
      <div className="hn-outbound-nfc-heading">
        <div>
          <h2>{documentId ? t("nfc.outboundInDocument") : t("nfc.outboundProductsTitle")}</h2>
          <p>{t("nfc.outboundHelp")}</p>
        </div>
        <button type="button" className="hn-outbound-nfc-refresh" onClick={() => void query.refetch()}>
          {t("nfc.refresh")}
        </button>
      </div>
      <div className="hn-outbound-nfc-stats" role="group" aria-label={t("nfc.chipStatus")}>
        {statusButtons.map(({ key, label }) => (
          <button
            type="button"
            key={key}
            className="hn-outbound-nfc-stat"
            aria-pressed={nfcStatus === key}
            onClick={() => { setNfcStatus(key); setPage(1); }}
          >
            <span>{label}</span>
            <strong>{totals ? totals[key] : "—"}</strong>
          </button>
        ))}
      </div>
      <form className="hn-outbound-nfc-search" onSubmit={(event) => {
        event.preventDefault();
        setKeyword(draft.trim());
        setPage(1);
      }}>
        <label htmlFor="outbound-nfc-keyword">{t("nfc.outboundSearch")}</label>
        <div>
          <input
            id="outbound-nfc-keyword"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("nfc.outboundSearchPlaceholder")}
          />
          <button type="submit">{t("nfc.apply")}</button>
          {keyword ? <button type="button" onClick={() => { setDraft(""); setKeyword(""); setPage(1); }}>
            {t("nfc.outboundClear")}
          </button> : null}
        </div>
      </form>
      {query.isLoading ? <div className="hn-outbound-nfc-state" role="status">{t("common.loadingData")}</div> : null}
      {query.isError ? (
        <ApiErrorAlert
          error={query.error}
          title={nfcUnknown ? t("nfc.outboundUnknown") : t("nfc.outboundLoadError")}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {!query.isLoading && !loadFailed && rows.length === 0 ? (
        <div className="hn-outbound-nfc-state">
          <strong>{keyword || nfcStatus !== "ALL" ? t("nfc.outboundNoResults") : t("nfc.outboundEmpty")}</strong>
          <p>{documentId ? t("nfc.outboundDocumentEmptyHelp") : t("nfc.outboundGlobalEmptyHelp")}</p>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div className="hn-outbound-nfc-table-wrap">
          <table className="hn-outbound-nfc-table">
            <thead><tr>
              <th>{t("nfc.item")}</th><th>{t("nfc.product")}</th>
              {!documentId ? <th>{t("nfc.outboundDocument")}</th> : null}
              <th>{t("nfc.uid")}</th><th>{t("nfc.chipStatus")}</th><th>{t("outbound.detail.colAction")}</th>
            </tr></thead>
            <tbody>{rows.map((item) => (
              <tr key={`${item.document_id}:${item.item_id}`}>
                <td data-field="item" data-label={t("nfc.item")}><strong>{item.item_code || item.serial_number || item.item_id}</strong>
                  {item.item_code && item.serial_number ? <small>{item.serial_number}</small> : null}</td>
                <td data-field="product" data-label={t("nfc.product")}><strong>{item.sku_code}</strong><small>{item.sku_name}</small></td>
                {!documentId ? <td data-field="document" data-label={t("nfc.outboundDocument")}>
                  {onOpenDocument ? <button type="button" className="hn-outbound-nfc-link" onClick={() => onOpenDocument(item.document_id)}>{item.document_no}</button> : item.document_no}
                </td> : null}
                <td data-field="uid" data-label={t("nfc.uid")}>{nfcUnknown ? t("nfc.outboundUnknown") : item.nfc?.hardware_uid ? <span className="hn-outbound-nfc-uid">
                  <code>{item.nfc.hardware_uid}</code>
                  <button type="button" aria-label={t("nfc.outboundCopyUid")} onClick={() => void navigator.clipboard?.writeText(item.nfc!.hardware_uid!)}>{t("nfc.outboundCopy")}</button>
                </span> : "—"}</td>
                <td data-field="status" data-label={t("nfc.chipStatus")}><span className="hn-outbound-nfc-badge" data-status={nfcUnknown ? "UNKNOWN" : item.nfc_status}>
                  {nfcUnknown ? t("nfc.outboundUnknown") : item.nfc_status === "ASSIGNED" ? t("nfc.outboundAssigned") : t("nfc.outboundUnassigned")}
                </span></td>
                <td data-field="action" data-label={t("outbound.detail.colAction")}><button type="button" className="hn-outbound-nfc-view" onClick={() => setSelected(item)}>{t("nfc.details")}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      {query.data && (query.data.meta.total ?? 0) > 10 ? <div className="hn-outbound-nfc-pages">
        <UiPagination total={query.data.meta.total ?? 0} page={page} pageSize={10} showTotal={false} onPageChange={setPage} disabled={query.isFetching} />
      </div> : null}
      {selected ? <OutboundNfcProductDetail item={selected} nfcUnknown={nfcUnknown} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}
