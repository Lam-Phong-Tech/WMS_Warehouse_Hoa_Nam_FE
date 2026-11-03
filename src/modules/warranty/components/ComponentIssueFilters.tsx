import { UiSelect, UiTextField } from "@/shared/ui";
import { useT, tStatic as tUi } from "@/shared/i18n/useT";
import type { ComponentIssueStatus } from "@/modules/warranty/services/componentIssueService";

type Tracking = "" | "SERIAL" | "QUANTITY";
type SortOrder = "asc" | "desc";

type ComponentIssueFiltersProps = {
  search: string;
  status: ComponentIssueStatus | "";
  tracking: Tracking;
  sortOrder: SortOrder;
  statusOptions: { value: string; label: string }[];
  hasFilters: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ComponentIssueStatus | "") => void;
  onTrackingChange: (value: Tracking) => void;
  onSortChange: (value: SortOrder) => void;
  onClear: () => void;
};

/** Inline, immediately applied controls shared by the issue list and its API query. */
export function ComponentIssueFilters({
  search,
  status,
  tracking,
  sortOrder,
  statusOptions,
  hasFilters,
  onSearchChange,
  onStatusChange,
  onTrackingChange,
  onSortChange,
  onClear,
}: ComponentIssueFiltersProps) {
  const t = useT();
  const allLabel = tUi("dashboard.operations.filterAll");
  const statusLabel = tUi("dashboard.composition.colStatus");
  const trackingLabel = tUi("dashboard.severity.p2");
  const sortLabel = t("warranty.list.sortAria");

  return (
    <div className="hn-war04-filters">
      <div className="hn-war04-field hn-war04-search">
        <UiTextField
          id="hn-war04-search"
          value={search}
          placeholder={tUi("reports.packingLabel.searchLabel")}
          slotProps={{
            htmlInput: { "aria-label": t("warranty.componentList.searchAria") },
          }}
          onChange={(event) => onSearchChange(event.target.value)}
          fullWidth
        />
      </div>
      <div className="hn-war04-field">
        <UiSelect
          id="hn-war04-status"
          value={status}
          aria-label={t("warranty.componentList.statusFilterAria")}
          displayEmpty
          fullWidth
          menuClassName="hn-war04-menu"
          options={[
            { value: "", label: `${statusLabel}: ${allLabel}` },
            ...statusOptions.map(({ value, label }) => ({
              value,
              label: `${statusLabel}: ${label}`,
            })),
          ]}
          onChange={(value) =>
            onStatusChange(value as ComponentIssueStatus | "")
          }
        />
      </div>
      <div className="hn-war04-field">
        <UiSelect
          id="hn-war04-tracking"
          value={tracking}
          aria-label={tUi("updatedUi.text_a9a7bcf8d30a")}
          displayEmpty
          fullWidth
          menuClassName="hn-war04-menu"
          options={[
            { value: "", label: `${trackingLabel}: ${allLabel}` },
            { value: "SERIAL", label: `${trackingLabel}: Serial` },
            { value: "QUANTITY", label: `${trackingLabel}: Box + SL` },
          ]}
          onChange={(value) => onTrackingChange(value as Tracking)}
        />
      </div>
      <div className="hn-war04-field">
        <UiSelect
          id="hn-war04-sort"
          value={sortOrder}
          aria-label={sortLabel}
          fullWidth
          menuClassName="hn-war04-menu"
          options={[
            {
              value: "desc",
              label: `${sortLabel}: ${t("warranty.list.sortNewest")}`,
            },
            {
              value: "asc",
              label: `${sortLabel}: ${t("warranty.list.sortOldest")}`,
            },
          ]}
          onChange={(value) => onSortChange(value === "asc" ? "asc" : "desc")}
        />
      </div>
      {hasFilters ? (
        <button
          type="button"
          className="hn-war04-clear-filters"
          onClick={onClear}
        >
          {t("inbound.list.clearFilters")}
        </button>
      ) : null}
    </div>
  );
}
