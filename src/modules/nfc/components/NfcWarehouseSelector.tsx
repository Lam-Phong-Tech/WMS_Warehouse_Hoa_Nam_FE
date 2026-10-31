import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Box, Menu, MenuItem, UiIcon } from "@/shared/ui";
import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { useSwitchContext } from "@/modules/auth/hooks/use-switch-context";
import { useT } from "@/shared/i18n/useT";
import "./nfc-warehouse-selector.css";

interface WarehouseSession {
  available_warehouses: {
    warehouse_id: string;
    code: string;
    name: string;
    status: string;
  }[];
}

/** Warehouse selection for NFC uses the same server-confirmed session as NFC recovery. */
export function NfcWarehouseSelector() {
  const t = useT();
  const current = useAuthStore((state) => state.currentContext);
  const switchContext = useSwitchContext();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const session = useQuery({
    queryKey: ["nfc", "warehouse-selector"],
    queryFn: ({ signal }) => http.get<WarehouseSession>("/auth/me", { signal }),
  });
  const warehouses = (session.data?.available_warehouses ?? []).filter(
    (row) => row.status === "ACTIVE",
  );
  const currentId =
    current?.context_type === "WAREHOUSE"
      ? (current.context_id ?? current.scope_ref)
      : null;
  const selected = warehouses.find((row) => row.warehouse_id === currentId);
  const name = selected?.name ?? (currentId ? current?.warehouse_name : null);

  const selectWarehouse = async (warehouseId: string) => {
    setAnchor(null);
    if (warehouseId === currentId || switchContext.isPending) return;
    try {
      const result = await switchContext.mutateAsync({
        context_type: "WAREHOUSE",
        context_id: warehouseId,
        scope_ref: warehouseId,
      });
      const confirmedId =
        result.active_context.context_type === "WAREHOUSE"
          ? (result.active_context.context_id ??
            result.active_context.scope_ref)
          : null;
      const confirmed = warehouses.find(
        (row) => row.warehouse_id === confirmedId,
      );
      if (confirmed) {
        const store = useAuthStore.getState();
        const base = store.currentContext ?? store.contexts[0];
        store.setCurrentContext({
          role_id: base?.role_id ?? "",
          role_name: base?.role_name ?? "",
          org_unit_id: base?.org_unit_id ?? null,
          org_unit_name: base?.org_unit_name ?? null,
          department_id: base?.department_id ?? null,
          department_name: base?.department_name ?? null,
          warehouse_id: null,
          warehouse_name: confirmed.name,
          scope_type: "kho",
          context_type: "WAREHOUSE",
          context_id: confirmed.warehouse_id,
          scope_ref: confirmed.warehouse_id,
        });
        toast.success(t("auth.context.switchSuccess"));
      }
    } catch {
      toast.error(t("auth.context.switchError"));
    }
  };

  return (
    <>
      <button
        type="button"
        className="hn-nfc-warehouse"
        aria-label={t("nfc.workWarehouse")}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        disabled={switchContext.isPending}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <UiIcon name="warehouse-alt" />
        <span className="hn-nfc-warehouse-label">
          <strong>{name ?? t("nfc.selectWarehouse")}</strong>
          <small className={selected ? "is-active" : undefined}>
            {selected ? <i /> : null}
            {selected
              ? t("dashboard.snapshot.warehouseActive")
              : t("nfc.workWarehouse")}
          </small>
        </span>
        <UiIcon name="angle-small-down" size="sm" />
      </button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        {session.isPending ? (
          <MenuItem disabled>{t("nfc.loadingWarehouses")}</MenuItem>
        ) : session.isError ? (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              void session.refetch();
            }}
          >
            {t("common.retry")}
          </MenuItem>
        ) : warehouses.length ? (
          warehouses.map((warehouse) => (
            <MenuItem
              key={warehouse.warehouse_id}
              selected={warehouse.warehouse_id === currentId}
              onClick={() => void selectWarehouse(warehouse.warehouse_id)}
            >
              <Box sx={{ display: "grid", gap: 0.25 }}>
                <strong>{warehouse.name}</strong>
                <small>{warehouse.code}</small>
              </Box>
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>{t("nfc.noWarehouses")}</MenuItem>
        )}
      </Menu>
    </>
  );
}
