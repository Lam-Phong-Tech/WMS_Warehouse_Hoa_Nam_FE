import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RowActionButton } from "@/shared/components/actions";
import { rowActivationProps } from "@/shared/components/data-display/row-activation";
import { UiPagination, UiSelect } from "@/shared/ui";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { MVP_PAGE_SIZE_OPTIONS } from "@/shared/components/mvp/mvp-pagination";
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
  const searchId = useId();
  const context = useAuthStore((state) => state.currentContext);
  const [draft, setDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [nfcStatus, setNfcStatus] = useState<"ALL" | OutboundNfcStatus>("ALL");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selected, setSelected] = useState<OutboundNfcItem | null>(null);
  useEffect(() => {
    const nextKeyword = draft.trim();
    if (nextKeyword === keyword) return;
    const timer = window.setTimeout(() => {
      setKeyword(nextKeyword);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, keyword]);
  const query = useQuery({
    queryKey: [
      "outbound-nfc",
      context,
      documentId,
      keyword,
      nfcStatus,
      page,
      perPage,
    ],
    queryFn: ({ signal }) =>
      fetchOutboundNfcItems(
        { documentId, keyword: keyword || undefined, nfcStatus, page, perPage },
        signal,
      ),
  });
  const rows = query.data?.data ?? [];
  const matchingSelectedItem = selected
    ? rows.find(
        (row) =>
          row.document_id === selected.document_id &&
          row.item_id === selected.item_id,
      )
    : undefined;
  const selectionMissing = Boolean(
    selected && query.isSuccess && !query.isFetching && !matchingSelectedItem,
  );
  const selectedItem = selectionMissing
    ? null
    : (matchingSelectedItem ?? selected);
  useEffect(() => {
    if (selectionMissing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- A settled filter result no longer contains this read-only item.
      setSelected(null);
    }
  }, [selectionMissing]);
  const totals = query.data?.meta.tab_totals;
  const loadFailed = query.isError && !query.data;
  const nfcUnknown = query.isError && !!query.data;
  const total = query.data?.meta.total ?? 0;
  const first = rows.length ? (page - 1) * perPage + 1 : 0;
  const last = rows.length ? Math.min(total, first + rows.length - 1) : 0;
  const statusOptions: Array<{
    key: "ALL" | OutboundNfcStatus;
    label: string;
  }> = [
    { key: "ALL", label: t("nfc.outboundAll") },
    { key: "ASSIGNED", label: t("nfc.outboundAssigned") },
    { key: "UNASSIGNED", label: t("nfc.outboundUnassigned") },
  ];

  if (selectedItem && documentId)
    return (
      <OutboundNfcProductDetail
        embedded
        item={selectedItem}
        nfcUnknown={nfcUnknown}
        onClose={() => setSelected(null)}
      />
    );

  return (
    <section
      className="hn-outbound-nfc"
      data-document-scoped={Boolean(documentId)}
      aria-label={t("nfc.outboundProductsTitle")}
    >
      <div className="hn-outbound-nfc-search">
        <label htmlFor={searchId}>{t("nfc.outboundSearch")}</label>
        <div className="hn-outbound-nfc-search-controls">
          <input
            id={searchId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("nfc.outboundSearchPlaceholder")}
          />
          <UiSelect
            value={nfcStatus}
            aria-label={t("nfc.chipStatus")}
            fullWidth
            options={statusOptions.map(({ key, label }) => ({
              value: key,
              label: `${t("nfc.chipStatus")}: ${label}${totals ? ` (${totals[key]})` : ""}`,
            }))}
            onChange={(value) => {
              setNfcStatus(value as "ALL" | OutboundNfcStatus);
              setPage(1);
            }}
          />
        </div>
      </div>
      {query.isLoading ? (
        <div className="hn-outbound-nfc-state" role="status">
          {t("common.loadingData")}
        </div>
      ) : null}
      {query.isError ? (
        <ApiErrorAlert
          error={query.error}
          title={
            nfcUnknown ? t("nfc.outboundUnknown") : t("nfc.outboundLoadError")
          }
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data ? (
        <div className="hn-outbound-nfc-list-card">
          {rows.length === 0 && !query.isLoading && !loadFailed ? (
            <div className="hn-outbound-nfc-state">
              <strong>
                {keyword || nfcStatus !== "ALL"
                  ? t("nfc.outboundNoResults")
                  : t("nfc.outboundEmpty")}
              </strong>
              <p>
                {documentId
                  ? t("nfc.outboundDocumentEmptyHelp")
                  : t("nfc.outboundGlobalEmptyHelp")}
              </p>
            </div>
          ) : null}
          {rows.length > 0 ? (
            <div className="hn-outbound-nfc-table-wrap">
              <table
                className="hn-outbound-nfc-table"
                data-document-scoped={Boolean(documentId)}
              >
                <thead>
                  <tr>
                    <th scope="col">{t("shared.table.rowNumber")}</th>
                    <th>{t("nfc.item")}</th>
                    <th>{t("nfc.product")}</th>
                    {!documentId ? <th>{t("nfc.outboundDocument")}</th> : null}
                    <th>{t("nfc.chipStatus")}</th>
                    <th
                      scope="col"
                      aria-label={t("outbound.detail.colAction")}
                    />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, index) => (
                    <tr
                      key={`${item.document_id}:${item.item_id}`}
                      {...rowActivationProps(() => setSelected(item))}
                    >
                      <td
                        data-field="ordinal"
                        data-label={t("shared.table.rowNumber")}
                      >
                        {first + index}
                      </td>
                      <td data-field="item" data-label={t("nfc.item")}>
                        <strong>
                          {item.item_code || item.serial_number || item.item_id}
                        </strong>
                        {item.item_code &&
                        item.serial_number &&
                        item.item_code !== item.serial_number ? (
                          <small>{item.serial_number}</small>
                        ) : null}
                      </td>
                      <td data-field="product" data-label={t("nfc.product")}>
                        <strong title={item.sku_code}>{item.sku_code}</strong>
                        <small title={item.sku_name ?? undefined}>
                          {item.sku_name}
                        </small>
                      </td>
                      {!documentId ? (
                        <td
                          data-field="document"
                          data-label={t("nfc.outboundDocument")}
                          title={item.document_no}
                        >
                          {onOpenDocument ? (
                            <button
                              type="button"
                              className="hn-outbound-nfc-link"
                              onClick={() => onOpenDocument(item.document_id)}
                            >
                              {item.document_no}
                            </button>
                          ) : (
                            item.document_no
                          )}
                        </td>
                      ) : null}
                      <td data-field="status" data-label={t("nfc.chipStatus")}>
                        <span
                          className="hn-outbound-nfc-badge"
                          data-status={nfcUnknown ? "UNKNOWN" : item.nfc_status}
                        >
                          {nfcUnknown
                            ? t("nfc.outboundUnknown")
                            : item.nfc_status === "ASSIGNED"
                              ? t("nfc.outboundAssigned")
                              : t("nfc.outboundUnassigned")}
                        </span>
                      </td>
                      <td data-field="action">
                        <RowActionButton
                          kind="view"
                          onClick={() => setSelected(item)}
                        >
                          {t("nfc.details")}
                        </RowActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="hn-outbound-nfc-pages">
            <div className="hn-outbound-nfc-page-info">
              <span aria-live="polite">
                {t("nfc.outboundShowing", { from: first, to: last, total })}
              </span>
              <UiSelect
                value={perPage}
                aria-label={t("outbound.list.pageSizeAria")}
                options={MVP_PAGE_SIZE_OPTIONS.map((size) => ({
                  value: size,
                  label: t("shared.table.perPage", { size }),
                }))}
                onChange={(value) => {
                  setPerPage(Number(value));
                  setPage(1);
                }}
              />
            </div>
            <UiPagination
              total={total}
              page={page}
              pageSize={perPage}
              showTotal={false}
              onPageChange={setPage}
              disabled={query.isFetching}
            />
          </div>
        </div>
      ) : null}
      {selectedItem ? (
        <OutboundNfcProductDetail
          item={selectedItem}
          nfcUnknown={nfcUnknown}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
