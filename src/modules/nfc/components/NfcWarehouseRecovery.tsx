import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Stack, UiButton, UiSelect, UiText, UiStateSurface } from "@/shared/ui";
import { http } from "@/shared/api/http";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useSwitchContext } from "@/modules/auth/hooks/use-switch-context";
import { useAuthStore } from "@/shared/store/auth.store";
import { useT } from "@/shared/i18n/useT";

interface WarehouseSession {
  available_warehouses: {
    warehouse_id: string;
    code: string;
    name: string;
    status: string;
  }[];
}

/** Scope options are not confirmation, even when there is only one warehouse. */
export function NfcWarehouseRecovery() {
  const t = useT();
  const [selected, setSelected] = useState("");
  const current = useAuthStore((state) => state.currentContext);
  const switchContext = useSwitchContext();
  const session = useQuery({
    queryKey: ["nfc", current, "warehouse-recovery"],
    queryFn: ({ signal }) => http.get<WarehouseSession>("/auth/me", { signal }),
  });
  const options = (session.data?.available_warehouses ?? []).filter(
    (row) => row.status === "ACTIVE",
  );
  return (
    <Stack spacing={2}>
      <UiText variant="cardTitle">{t("nfc.confirmWarehouseTitle")}</UiText>
      <UiText>{t("nfc.confirmWarehouseHelp")}</UiText>
      {session.isPending ? (
        <UiStateSurface kind="loading" />
      ) : session.isError ? (
        <ApiErrorAlert
          error={session.error}
          onRetry={() => void session.refetch()}
        />
      ) : (
        <>
          <UiSelect
            label={t("nfc.workWarehouse")}
            value={selected}
            onChange={setSelected}
            disabled={switchContext.isPending}
            options={options.map((row) => ({
              value: row.warehouse_id,
              label: `${row.code} · ${row.name}`,
            }))}
            fullWidth
          />
          {!options.length && <UiText>{t("nfc.noWarehouses")}</UiText>}
          <UiButton
            disabled={!options.some((row) => row.warehouse_id === selected)}
            loading={switchContext.isPending}
            onClick={async () => {
              try {
                await switchContext.mutateAsync({
                  context_type: "WAREHOUSE",
                  context_id: selected,
                  scope_ref: selected,
                });
                const warehouse = options.find(
                  (row) => row.warehouse_id === selected,
                )!;
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
                  warehouse_name: warehouse.name,
                  scope_type: base?.scope_type ?? "he_thong",
                  context_type: "WAREHOUSE",
                  context_id: selected,
                  scope_ref: selected,
                });
              } catch {
                /* The mutation error is rendered below. */
              }
            }}
          >
            {t("nfc.confirmWarehouse")}
          </UiButton>
          {switchContext.isError && (
            <ApiErrorAlert error={switchContext.error} />
          )}
        </>
      )}
    </Stack>
  );
}
