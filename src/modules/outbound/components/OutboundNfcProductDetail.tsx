import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UiDrawer, UiPagination, UiTabs } from "@/shared/ui";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import "./outbound-nfc.css";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useAuthStore } from "@/shared/store/auth.store";
import { useT } from "@/shared/i18n/useT";
import {
  fetchOutboundItemNfcHistory,
  type OutboundNfcItem,
} from "@/modules/outbound/services/outboundNfcService";

interface Props {
  item: OutboundNfcItem;
  onClose: () => void;
  nfcUnknown?: boolean;
  embedded?: boolean;
}

export function OutboundNfcProductDetail({
  item,
  onClose,
  nfcUnknown = false,
  embedded = false,
}: Props) {
  const t = useT();
  const context = useAuthStore((state) => state.currentContext);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("overview");
  const history = useQuery({
    queryKey: [
      "outbound-nfc",
      context,
      "history",
      item.document_id,
      item.item_id,
      page,
    ],
    enabled: tab === "history",
    retry: false,
    queryFn: ({ signal }) =>
      fetchOutboundItemNfcHistory(item.document_id, item.item_id, page, signal),
  });
  const uid = item.nfc?.hardware_uid;

  const content = (
    <div className="hn-outbound-nfc-detail">
      <div className="hn-outbound-nfc-identity">
        <strong>{item.item_code || item.serial_number || item.item_id}</strong>
        <span>
          {item.sku_code} · {item.sku_name}
        </span>
      </div>
      <UiTabs
        value={tab}
        onChange={setTab}
        aria-label={t("nfc.outboundProductDetail")}
        items={[
          { key: "overview", label: t("nfc.outboundOverviewTab") },
          { key: "history", label: t("nfc.outboundHistoryTitle") },
        ]}
      />
      {tab === "overview" ? (
        <div className="hn-outbound-nfc-detail-grid">
          <div>
            <span>{t("nfc.outboundDocument")}</span>
            <strong>{item.document_no}</strong>
          </div>
          <div>
            <span>{t("nfc.chipStatus")}</span>
            <strong>
              {nfcUnknown
                ? t("nfc.outboundUnknown")
                : item.nfc_status === "ASSIGNED"
                  ? t("nfc.outboundAssigned")
                  : t("nfc.outboundUnassigned")}
            </strong>
          </div>
          <div>
            <span>{t("nfc.uid")}</span>
            <strong>{nfcUnknown ? "—" : uid || "—"}</strong>
          </div>
          <div>
            <span>{t("nfc.assignedAt")}</span>
            <strong>
              {item.nfc?.assigned_at
                ? new Date(item.nfc.assigned_at).toLocaleString("vi-VN")
                : "—"}
            </strong>
          </div>
          <div>
            <span>{t("nfc.linkedBy")}</span>
            <strong>{item.nfc?.actor_name || "—"}</strong>
          </div>
        </div>
      ) : null}
      {tab === "overview" ? (
        <p className="hn-outbound-nfc-note">{t("nfc.outboundHelp")}</p>
      ) : null}
      {tab === "history" ? (
        <section
          className="hn-outbound-nfc-history-section"
          aria-label={t("nfc.outboundHistoryTitle")}
        >
          {history.isLoading ? (
            <p role="status">{t("common.loadingData")}</p>
          ) : null}
          {history.isError ? (
            <ApiErrorAlert
              error={history.error}
              title={t("nfc.outboundHistoryError")}
              onRetry={() => void history.refetch()}
            />
          ) : null}
          {history.data?.data.length === 0 ? (
            <p>{t("nfc.outboundNoHistory")}</p>
          ) : null}
          {history.data?.data.length ? (
            <ol className="hn-outbound-nfc-history">
              {history.data.data.map((event) => (
                <li key={event.id}>
                  <strong>
                    {event.action === "ASSIGN_ITEM_NFC"
                      ? t("nfc.outboundLinked")
                      : t("nfc.outboundRevoked")}
                  </strong>
                  <span>
                    {event.created_at
                      ? new Date(event.created_at).toLocaleString("vi-VN")
                      : "—"}
                  </span>
                  <span>
                    {event.hardware_uid || "—"} ·{" "}
                    {event.actor_name || t("nfc.actorNotRecorded")}
                  </span>
                  {event.reason ? <small>{event.reason}</small> : null}
                </li>
              ))}
            </ol>
          ) : null}
          {history.data && (history.data.meta.total ?? 0) > 10 ? (
            <UiPagination
              total={history.data.meta.total ?? 0}
              page={page}
              pageSize={10}
              showTotal={false}
              onPageChange={setPage}
              disabled={history.isFetching}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
  if (embedded)
    return (
      <section className="hn-outbound-nfc-embedded">
        <ActionButton kind="back" onClick={onClose}>
          {t("shared.actions.goBack")}
        </ActionButton>
        {content}
      </section>
    );
  return (
    <UiDrawer
      open
      onClose={onClose}
      width={640}
      className="hn-outbound-nfc-drawer"
      title={
        <span className="hn-outbound-nfc-drawer-title">
          {t("nfc.outboundProductDetail")}
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={onClose}
          />
        </span>
      }
    >
      {content}
    </UiDrawer>
  );
}
