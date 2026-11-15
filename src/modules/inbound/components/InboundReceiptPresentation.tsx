import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { UiStatusBadge } from "@/shared/ui";
import {
  CheckOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ScanOutlined,
  UserOutlined,
} from "@/shared/components/icons";
import {
  INBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { inboundTime } from "./inbound-receipt-history";
import type {
  InboundDetail,
  InboundOperationEvent,
  InboundStatus,
} from "../types";

export function InboundReceiptNote({ note }: { note?: string }) {
  const t = useT();
  const id = useId();
  const textRef = useRef<HTMLDivElement>(null);
  const [disclosure, setDisclosure] = useState({ note, expanded: false });
  const expanded = disclosure.note === note && disclosure.expanded;
  const [overflow, setOverflow] = useState((note?.length ?? 0) > 180);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => {
      if (!el.getBoundingClientRect().width) return;
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      setOverflow(el.scrollHeight > lineHeight * 2 + 2);
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [note]);
  const canExpand = overflow;
  return (
    <div className="hn-inbound-note">
      <span>{t("updatedUi.text_9b223cea940b")}</span>
      <div className="hn-inbound-note__body">
        <div
          ref={textRef}
          id={id}
          className={`hn-inbound-note__text${expanded ? " is-expanded" : ""}`}
        >
          {note || EMPTY_TEXT}
        </div>
        {canExpand ? (
          <button
            type="button"
            className="hn-inbound-note__toggle"
            aria-controls={id}
            aria-expanded={expanded}
            onClick={() => setDisclosure({ note, expanded: !expanded })}
          >
            {t(
              expanded ? "inbound.detail.noteLess" : "inbound.detail.noteMore",
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function InboundReceiptProgress({ status }: { status: InboundStatus }) {
  const t = useT();
  const cancelled = status === "CANCELLED";
  const labels = cancelled
    ? [
        t("inbound.detail.progressCreated"),
        t("inbound.detail.progressCancelled"),
      ]
    : [
        t("inbound.detail.progressCreated"),
        t("inbound.detail.progressScan"),
        t("inbound.detail.progressPosted"),
      ];
  const active = cancelled ? 1 : status === "POSTED" ? 2 : 1;
  return (
    <ol
      className="hn-inbound-receipt-progress"
      aria-label={t("inbound.detail.progressLabel")}
    >
      {labels.map((label, index) => (
        <li
          key={label}
          className={`${index < active || status === "POSTED" ? "is-complete" : ""} ${index === active ? "is-current" : ""} ${cancelled && index === 1 ? "is-cancelled" : ""}`}
          aria-current={index === active ? "step" : undefined}
        >
          <span className="hn-inbound-receipt-progress__dot" aria-hidden="true">
            {cancelled && index === 1 ? (
              <CloseCircleOutlined />
            ) : index < active || status === "POSTED" ? (
              <CheckOutlined />
            ) : index === active ? (
              <ScanOutlined />
            ) : null}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function InboundSectionHeading({
  children,
  icon,
  count,
}: {
  children: ReactNode;
  icon?: ReactNode;
  count?: number;
}) {
  return (
    <div className="hn-inbound-section-heading">
      {icon}
      <h2>{children}</h2>
      {count !== undefined ? (
        <span className="hn-inbound-count">{count}</span>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`hn-inbound-field${wide ? " is-wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{children || EMPTY_TEXT}</dd>
    </div>
  );
}

export function InboundReceiptOverview({
  detail,
  warehouseName,
  events,
}: {
  detail: InboundDetail;
  warehouseName: string;
  events: InboundOperationEvent[];
}) {
  const t = useT();
  const cancel = [...events]
    .reverse()
    .find((event) => event.action === "CANCEL");
  return (
    <>
      <section className="hn-inbound-section">
        <InboundSectionHeading icon={<FileTextOutlined />}>
          {t("inbound.detail.infoTitle")}
        </InboundSectionHeading>
        <div className="hn-inbound-info-panel">
          <dl className="hn-inbound-info-grid">
            <Field label={t("inbound.detail.fieldSupplier")} wide>
              {detail.supplier ? (
                <>
                  <span className="hn-inbound-supplier-code">
                    {detail.supplier.code}
                  </span>
                  <strong>{detail.supplier.name}</strong>
                </>
              ) : (
                EMPTY_TEXT
              )}
            </Field>
            <Field label={t("inbound.detail.fieldWarehouse")}>
              {warehouseName}
            </Field>
            <Field label={t("inbound.detail.fieldSource")}>
              {detail.document.sourceReference ||
                (detail.document.source === "-" ? "" : detail.document.source)}
            </Field>
            <Field label={t("updatedUi.text_4572c8880b00")}>
              {inboundTime(detail.document.createdAt)}
            </Field>
            <Field label={t("reverse.detail.fieldCreatedBy")}>
              {detail.document.createdBy === "-"
                ? EMPTY_TEXT
                : detail.document.createdBy}
            </Field>
          </dl>
          <InboundReceiptNote note={detail.document.note} />
        </div>
      </section>
      {detail.document.status === "CANCELLED" ? (
        <section className="hn-inbound-section">
          <InboundSectionHeading icon={<CloseCircleOutlined />}>
            {t("inbound.detail.cancelInfo")}
          </InboundSectionHeading>
          <div className="hn-inbound-info-panel">
            <dl className="hn-inbound-info-grid">
              {detail.document.cancelledBy || cancel?.actorName ? (
                <Field label={t("inbound.detail.fieldCancelledBy")}>
                  {detail.document.cancelledBy || cancel?.actorName}
                </Field>
              ) : null}
              <Field label={t("inbound.detail.cancelledAt")}>
                {inboundTime(cancel?.occurredAt)}
              </Field>
              <Field label={t("inbound.detail.cancelReason")}>
                <span className="hn-inbound-history-note">
                  {cancel?.note || EMPTY_TEXT}
                </span>
              </Field>
            </dl>
          </div>
        </section>
      ) : null}
    </>
  );
}

function actionLabel(action: string, t: TranslateFn) {
  switch (action) {
    case "CREATE":
      return t("inbound.detail.actionCreate");
    case "SCAN_START":
      return t("inbound.detail.actionScanStart");
    case "SCAN":
      return t("inbound.detail.actionScan");
    case "REMOVE":
      return t("inbound.detail.actionRemove");
    case "EDIT":
      return t("inbound.detail.actionEdit");
    case "POST":
      return t("inbound.detail.actionPost");
    case "CANCEL":
      return t("inbound.detail.actionCancel");
    case "CARTON_COMPLETE":
      return t("inbound.detail.actionCarton");
    case "SKU_INFO":
      return t("inbound.detail.actionSkuInfo");
    default:
      return t("inbound.detail.actionStatus");
  }
}

export function InboundReceiptHistory({
  events,
}: {
  events: InboundOperationEvent[];
}) {
  const t = useT();
  const [limit, setLimit] = useState(20);
  return (
    <section className="hn-inbound-section">
      <InboundSectionHeading icon={<HistoryOutlined />} count={events.length}>
        {t("inbound.detail.historyTitle")}
      </InboundSectionHeading>
      <div className="hn-inbound-info-panel">
        {!events.length ? (
          <p className="hn-inbound-history-empty">
            {t("inbound.detail.historyEmpty")}
          </p>
        ) : (
          <ol className="hn-inbound-history">
            {events.slice(0, limit).map((event) => (
              <li key={event.id}>
                <span
                  className={`hn-inbound-history__marker ${event.action === "CANCEL" ? "is-cancelled" : event.action === "POST" ? "is-posted" : ""}`}
                  aria-hidden="true"
                >
                  {event.action === "CANCEL" ? (
                    <CloseCircleOutlined />
                  ) : event.action === "SCAN" ? (
                    <ScanOutlined />
                  ) : event.action === "POST" ? (
                    <CheckOutlined />
                  ) : (
                    <FileTextOutlined />
                  )}
                </span>
                <div className="hn-inbound-history__entry">
                  <div className="hn-inbound-history__title">
                    <strong>{actionLabel(event.action, t)}</strong>
                    <time dateTime={event.occurredAt}>
                      {inboundTime(event.occurredAt)}
                    </time>
                  </div>
                  <div className="hn-inbound-history__actor">
                    <UserOutlined />
                    {event.actorName || EMPTY_TEXT}
                  </div>
                  {event.note ? (
                    <p className="hn-inbound-history-note">{event.note}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
        {events.length > limit ? (
          <button
            type="button"
            className="hn-inbound-note__toggle"
            onClick={() => setLimit((value) => value + 20)}
          >
            {t("inbound.detail.historyMore")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function InboundReceiptStatus({ status }: { status: InboundStatus }) {
  const label = businessLabel(INBOUND_STATUS_LABELS, status);
  return (
    <UiStatusBadge
      tone={
        status === "POSTED"
          ? "success"
          : status === "CANCELLED"
            ? "error"
            : status === "SCANNING"
              ? "info"
              : "warning"
      }
      label={label}
    />
  );
}
