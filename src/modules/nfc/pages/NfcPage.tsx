import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  UiButton,
  UiCard,
  UiDescriptions,
  UiDialog,
  UiIcon,
  UiKpiCard,
  UiPagination,
  UiSelect,
  UiStateSurface,
  UiStatusBadge,
  UiTabs,
  UiText,
  UiTextField,
  UiTimeline,
  type UiStatusTone,
} from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useCan, useCanAny } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import {
  ITEM_STATUS_LABELS,
  enumLabelOrText,
} from "@/shared/constants/business-labels";
import { useAuthStore } from "@/shared/store/auth.store";
import { useT } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import { formatDateTime } from "@/shared/utils/format-date";
import { NfcInfo } from "../components/NfcInfo";
import { nfcService } from "../services/nfc.service";
import type {
  NfcItem,
  NfcItemFilters,
  NfcTag,
  NfcTagFilters,
  NfcTagStatus,
} from "../types";

const TAG_LABEL: Record<NfcTagStatus, MessageKey> = {
  ACTIVE: "nfc.active",
  INACTIVE: "nfc.inactive",
  LOST: "nfc.lost",
  DAMAGED: "nfc.damaged",
};
const TAG_TONE: Record<NfcTagStatus, UiStatusTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  LOST: "warning",
  DAMAGED: "error",
};
const display = (value?: string | null) => value || "—";

export default function NfcPage() {
  const t = useT();
  const canAssign = useCan(P.PHYSICAL_CODE_ASSIGN_RFID);
  const canItems = useCanAny([
    P.PHYSICAL_CODE_ASSIGN_RFID,
    P.ITEM_INSTANCE_VIEW,
    P.INVENTORY_VIEW,
  ]);
  const canTags = useCanAny([P.PHYSICAL_CODE_ASSIGN_RFID, P.INVENTORY_TRACE]);
  const context = useAuthStore((state) => state.currentContext);
  const [tab, setTab] = useState("items");
  // Permissions can change when switching context; never fetch a forbidden tab.
  const activeTab =
    tab === "items"
      ? canItems
        ? "items"
        : "tags"
      : canTags
        ? "tags"
        : "items";
  const [itemDraft, setItemDraft] = useState({
    keyword: "",
    nfc_status: "ALL",
    item_status: "IN_STOCK",
  });
  const [itemFilters, setItemFilters] = useState<NfcItemFilters>({
    nfc_status: "ALL",
    item_status: "IN_STOCK",
    page: 1,
    per_page: 20,
  });
  const [tagDraft, setTagDraft] = useState({ hardware_uid: "", status: "" });
  const [tagFilters, setTagFilters] = useState<NfcTagFilters>({
    page: 1,
    per_page: 20,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eventPage, setEventPage] = useState(1);
  const [appNotice, setAppNotice] = useState(false);
  const showAppNotice = () => setAppNotice(true);

  const items = useQuery({
    queryKey: ["nfc", context, "items", itemFilters],
    queryFn: ({ signal }) => nfcService.listItems(itemFilters, signal),
    enabled: canItems && activeTab === "items",
  });
  const tags = useQuery({
    queryKey: ["nfc", context, "tags", tagFilters],
    queryFn: ({ signal }) => nfcService.listTags(tagFilters, signal),
    enabled: canTags && activeTab === "tags",
  });
  const detail = useQuery({
    queryKey: ["nfc", context, "detail", selectedId],
    queryFn: ({ signal }) => nfcService.getTag(selectedId!, signal),
    enabled: canTags && selectedId !== null,
  });
  const events = useQuery({
    queryKey: ["nfc", context, "events", selectedId, eventPage],
    queryFn: ({ signal }) =>
      nfcService.listEvents(selectedId!, eventPage, signal),
    enabled: canTags && selectedId !== null,
  });
  const openTag = (id: string) => {
    setEventPage(1);
    setSelectedId(id);
  };
  const chipBadge = (tag: NfcTag) => (
    <UiStatusBadge
      label={t(TAG_LABEL[tag.status] ?? "nfc.chipStatus")}
      tone={TAG_TONE[tag.status] ?? "neutral"}
    />
  );
  const itemColumns: ResponsiveTableColumn<NfcItem>[] = [
    {
      key: "serial",
      header: t("nfc.item"),
      render: (row) => display(row.serial_number),
    },
    {
      key: "sku",
      header: t("nfc.product"),
      render: (row) => (
        <>
          <strong>{display(row.sku.sku_name)}</strong>
          <div>{row.sku.sku_code}</div>
        </>
      ),
    },
    {
      key: "status",
      header: t("nfc.itemStatus"),
      render: (row) => enumLabelOrText(ITEM_STATUS_LABELS, row.item_status),
    },
    {
      key: "nfc",
      header: t("nfc.chip"),
      render: (row) => (
        <UiStatusBadge
          tone={row.nfc_status === "ASSIGNED" ? "success" : "warning"}
          label={t(
            row.nfc_status === "ASSIGNED" ? "nfc.assigned" : "nfc.unassigned",
          )}
        />
      ),
    },
  ];
  const tagColumns: ResponsiveTableColumn<NfcTag>[] = [
    {
      key: "uid",
      header: t("nfc.uid"),
      render: (row) => display(row.hardware_uid),
    },
    {
      key: "item",
      header: t("nfc.item"),
      render: (row) => (
        <>
          <strong>{display(row.serial_number)}</strong>
          <div>
            {display(row.sku_name)} · {display(row.sku_code)}
          </div>
        </>
      ),
    },
    { key: "status", header: t("nfc.chipStatus"), render: chipBadge },
    {
      key: "date",
      header: t("nfc.assignedAt"),
      render: (row) => formatDateTime(row.assigned_at),
    },
  ];
  const itemRows = items.data?.data ?? [];
  const totals = items.data?.meta.tab_totals;
  const counts = totals ?? {
    ALL: itemRows.length,
    ASSIGNED: itemRows.filter((row) => row.nfc_status === "ASSIGNED").length,
    UNASSIGNED: itemRows.filter((row) => row.nfc_status === "UNASSIGNED")
      .length,
  };
  const itemHint = items.data
    ? t(totals ? "nfc.totalFiltered" : "nfc.inPage")
    : "—";
  const selected = detail.data;
  const query = activeTab === "items" ? items : tags;

  return (
    <Stack spacing={3} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          justifyContent: "flex-end",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <NfcInfo label={t("nfc.info")}>{t("nfc.help")}</NfcInfo>
        <UiButton
          appearance="outlined"
          color="info"
          startIcon={<UiIcon name="refresh" />}
          onClick={() => void query.refetch()}
          loading={query.isFetching}
        >
          {t("nfc.refresh")}
        </UiButton>
        <UiButton
          appearance="outlined"
          color="info"
          startIcon={<UiIcon name="mobile-button" />}
          onClick={showAppNotice}
        >
          {t("nfc.scan")}
        </UiButton>
        {canAssign && (
          <UiButton
            startIcon={<UiIcon name="microchip" />}
            onClick={showAppNotice}
          >
            {t("nfc.assign")}
          </UiButton>
        )}
      </Stack>

      {activeTab === "items" && canItems && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          <UiKpiCard
            label={
              <>
                {t("nfc.totalItems")}{" "}
                <NfcInfo label={t("nfc.totalItems")}>
                  {t("nfc.itemHelp")}
                </NfcInfo>
              </>
            }
            value={items.data && !items.isError ? counts.ALL : "—"}
            icon="box"
            hint={itemHint}
          />
          <UiKpiCard
            label={t("nfc.unassigned")}
            value={items.data && !items.isError ? counts.UNASSIGNED : "—"}
            icon="microchip"
            tone="warning"
            hint={itemHint}
          />
          <UiKpiCard
            label={t("nfc.assigned")}
            value={items.data && !items.isError ? counts.ASSIGNED : "—"}
            icon="shield-check"
            tone="success"
            hint={itemHint}
          />
        </Box>
      )}

      <UiCard disablePadding>
        <Box
          sx={{
            "& .MuiTab-root.Mui-selected": { color: "var(--wms-info-text)" },
            "& .MuiTabs-indicator": { backgroundColor: "var(--wms-info-text)" },
          }}
        >
          <UiTabs
            value={activeTab}
            onChange={setTab}
            aria-label={t("nfc.info")}
            items={[
              ...(canItems ? [{ key: "items", label: t("nfc.items") }] : []),
              ...(canTags ? [{ key: "tags", label: t("nfc.tags") }] : []),
            ]}
          />
        </Box>
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            if (activeTab === "items")
              setItemFilters({
                ...itemFilters,
                keyword: itemDraft.keyword.trim() || undefined,
                nfc_status:
                  itemDraft.nfc_status as NfcItemFilters["nfc_status"],
                item_status: itemDraft.item_status,
                page: 1,
              });
            else
              setTagFilters({
                ...tagFilters,
                hardware_uid:
                  tagDraft.hardware_uid.trim().toUpperCase() || undefined,
                status: (tagDraft.status ||
                  undefined) as NfcTagFilters["status"],
                page: 1,
              });
          }}
          sx={{
            p: 3,
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
            <UiTextField
              fullWidth
              label={t(activeTab === "items" ? "nfc.searchItems" : "nfc.uid")}
              placeholder={t(
                activeTab === "items"
                  ? "nfc.searchPlaceholder"
                  : "nfc.uidPlaceholder",
              )}
              value={
                activeTab === "items"
                  ? itemDraft.keyword
                  : tagDraft.hardware_uid
              }
              onChange={(event) =>
                activeTab === "items"
                  ? setItemDraft({ ...itemDraft, keyword: event.target.value })
                  : setTagDraft({
                      ...tagDraft,
                      hardware_uid: event.target.value,
                    })
              }
            />
          </Box>
          <UiSelect
            label={t("nfc.chipStatus")}
            value={
              activeTab === "items" ? itemDraft.nfc_status : tagDraft.status
            }
            onChange={(value) =>
              activeTab === "items"
                ? setItemDraft({ ...itemDraft, nfc_status: value })
                : setTagDraft({ ...tagDraft, status: value })
            }
            options={
              activeTab === "items"
                ? [
                    { value: "ALL", label: t("nfc.all") },
                    { value: "UNASSIGNED", label: t("nfc.unassigned") },
                    { value: "ASSIGNED", label: t("nfc.assigned") },
                  ]
                : [
                    { value: "", label: t("nfc.all") },
                    ...Object.entries(TAG_LABEL).map(([value, key]) => ({
                      value,
                      label: t(key),
                    })),
                  ]
            }
          />
          {activeTab === "items" && (
            <UiSelect
              label={t("nfc.itemStatus")}
              value={itemDraft.item_status}
              onChange={(value) =>
                setItemDraft({ ...itemDraft, item_status: value })
              }
              options={[
                { value: "ALL", label: t("nfc.all") },
                { value: "IN_STOCK", label: t("nfc.inStock") },
                { value: "ISSUED", label: t("nfc.exported") },
                { value: "IN_WARRANTY", label: t("nfc.inWarranty") },
              ]}
            />
          )}
          <UiButton type="submit">{t("nfc.apply")}</UiButton>
          {activeTab === "tags" && (
            <NfcInfo label={t("nfc.history")}>{t("nfc.historyHelp")}</NfcInfo>
          )}
        </Box>
        {query.isError ? (
          <Box sx={{ p: 3 }}>
            <ApiErrorAlert
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          </Box>
        ) : activeTab === "items" ? (
          <ResponsiveDataTable
            columns={itemColumns}
            rows={itemRows}
            rowKey={(row) => row.item_id}
            loading={items.isPending}
            maxBodyHeight="60vh"
            emptyText={
              <UiStateSurface
                kind="empty"
                title={t("nfc.emptyItems")}
                description={t("nfc.emptyHint")}
              />
            }
            renderRowActions={(row) =>
              row.nfc_status === "ASSIGNED" ? (
                canTags &&
                row.nfc?.physical_code_id &&
                row.nfc_details_available !== false ? (
                  <UiButton
                    appearance="text"
                    color="info"
                    onClick={() => openTag(row.nfc!.physical_code_id)}
                  >
                    {t("nfc.viewChip")}
                  </UiButton>
                ) : (
                  <UiText variant="caption">
                    {t("nfc.detailsUnavailable")}
                  </UiText>
                )
              ) : canAssign ? (
                <UiButton
                  appearance="text"
                  color="info"
                  onClick={showAppNotice}
                >
                  {t("nfc.assign")}
                </UiButton>
              ) : null
            }
            actionColumnWidth={180}
          />
        ) : (
          <ResponsiveDataTable
            columns={tagColumns}
            rows={tags.data?.data ?? []}
            rowKey={(row) => row.physical_code_id}
            loading={tags.isPending}
            maxBodyHeight="60vh"
            emptyText={
              <UiStateSurface
                kind="empty"
                title={t("nfc.emptyTags")}
                description={t("nfc.emptyHint")}
              />
            }
            renderRowActions={(row) => (
              <UiButton
                appearance="text"
                color="info"
                onClick={() => openTag(row.physical_code_id)}
              >
                {t("nfc.details")}
              </UiButton>
            )}
            actionColumnWidth={140}
          />
        )}
        <Box sx={{ p: 3 }}>
          <UiPagination
            page={activeTab === "items" ? itemFilters.page : tagFilters.page}
            pageSize={
              activeTab === "items" ? itemFilters.per_page : tagFilters.per_page
            }
            total={query.isError ? 0 : (query.data?.meta.total ?? 0)}
            disabled={query.isFetching || query.isError}
            onPageChange={(page) =>
              activeTab === "items"
                ? setItemFilters({ ...itemFilters, page })
                : setTagFilters({ ...tagFilters, page })
            }
            onPageSizeChange={(per_page) =>
              activeTab === "items"
                ? setItemFilters({ ...itemFilters, page: 1, per_page })
                : setTagFilters({ ...tagFilters, page: 1, per_page })
            }
          />
        </Box>
      </UiCard>

      <UiDialog
        open={selectedId !== null && canTags}
        onClose={() => setSelectedId(null)}
        maxWidth="md"
        title={t("nfc.detailTitle")}
        actions={
          <>
            <UiButton
              appearance="outlined"
              color="info"
              onClick={() => setSelectedId(null)}
            >
              {t("nfc.close")}
            </UiButton>
            {canAssign && selected?.status === "ACTIVE" && (
              <>
                <UiButton
                  appearance="outlined"
                  color="info"
                  onClick={showAppNotice}
                >
                  {t("nfc.revoke")}
                </UiButton>
                <UiButton onClick={showAppNotice}>{t("nfc.replace")}</UiButton>
              </>
            )}
          </>
        }
      >
        <Stack spacing={3}>
          {detail.isError ? (
            <ApiErrorAlert
              error={detail.error}
              onRetry={() => void detail.refetch()}
            />
          ) : detail.isPending ? (
            <UiStateSurface kind="loading" />
          ) : (
            selected && (
              <>
                <UiText variant="cardTitle">{t("nfc.chipAndItem")}</UiText>
                <UiDescriptions
                  columns={2}
                  items={[
                    {
                      label: t("nfc.uid"),
                      value: display(selected.hardware_uid),
                    },
                    { label: t("nfc.chipStatus"), value: chipBadge(selected) },
                    {
                      label: t("nfc.code"),
                      value: display(selected.code_value),
                    },
                    {
                      label: t("nfc.assignedAt"),
                      value: formatDateTime(selected.assigned_at),
                    },
                    {
                      label: t("nfc.serial"),
                      value: display(selected.serial_number),
                    },
                    {
                      label: t("nfc.itemStatus"),
                      value: selected.item_status
                        ? enumLabelOrText(
                            ITEM_STATUS_LABELS,
                            selected.item_status,
                          )
                        : "—",
                    },
                    {
                      label: t("nfc.product"),
                      value: `${display(selected.sku_name)} · ${display(selected.sku_code)}`,
                    },
                    {
                      label: t("nfc.linkedBy"),
                      value:
                        selected.linker?.display_name || t("nfc.notRecorded"),
                    },
                    {
                      label: t("nfc.warehouse"),
                      value:
                        selected.assigned_warehouse?.name ||
                        selected.assigned_warehouse?.code ||
                        t("nfc.notRecorded"),
                    },
                  ]}
                />
              </>
            )
          )}
          <UiText variant="cardTitle">
            {t("nfc.history")}{" "}
            <NfcInfo label={t("nfc.history")}>{t("nfc.historyHelp")}</NfcInfo>
          </UiText>
          {events.isError ? (
            <ApiErrorAlert
              error={events.error}
              onRetry={() => void events.refetch()}
            />
          ) : events.isPending ? (
            <UiStateSurface kind="loading" />
          ) : events.data?.data.length ? (
            <>
              <UiTimeline
                items={events.data.data.map((event) => ({
                  title: t(
                    event.action === "ASSIGN_ITEM_NFC"
                      ? "nfc.assignedEvent"
                      : event.action === "REVOKE_ITEM_NFC"
                        ? "nfc.revokedEvent"
                        : "nfc.unknownEvent",
                  ),
                  time: formatDateTime(event.created_at),
                  description: (
                    <>
                      {event.actor_name || t("nfc.actorNotRecorded")}
                      {event.reason && <div>{event.reason}</div>}
                      {event.result && (
                        <div>
                          {event.result === "SUCCESS"
                            ? t("nfc.success")
                            : event.result === "FAILURE"
                              ? t("nfc.failed")
                              : event.result}
                        </div>
                      )}
                    </>
                  ),
                }))}
              />
              <UiPagination
                page={eventPage}
                pageSize={10}
                total={events.data.meta.total ?? 0}
                onPageChange={setEventPage}
                disabled={events.isFetching}
              />
            </>
          ) : (
            <UiStateSurface kind="empty" title={t("nfc.noHistory")} />
          )}
        </Stack>
      </UiDialog>
      <UiDialog
        open={appNotice}
        onClose={() => setAppNotice(false)}
        title={t("nfc.info")}
        actions={
          <UiButton onClick={() => setAppNotice(false)} autoFocus>
            {t("nfc.understood")}
          </UiButton>
        }
      >
        <UiText>{t("nfc.appRequired")}</UiText>
      </UiDialog>
    </Stack>
  );
}
