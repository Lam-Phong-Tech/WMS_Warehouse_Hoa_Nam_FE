import { useQuery } from "@tanstack/react-query";
import {
  fetchInventoryBalances,
  fetchStockMovements,
  fetchStockMovement,
  traceStockMovementSource,
  traceByPhysicalCode,
  fetchBalanceSubledger,
  fetchBoxReadProjection,
  fetchContainerRegisterDetail,
  type InventoryBalanceFilters,
  type StockMovementFilters,
  type PagedResult,
  type InventoryBalanceRow,
  type StockMovementRow,
  type SubledgerResult,
  type BoxReadProjection,
  type ContainerRegisterDetail,
} from "../services/inventoryService";

export const inventoryKeys = {
  all: ["inventory"] as const,
  balances: (params: InventoryBalanceFilters) =>
    [...inventoryKeys.all, "balances", params] as const,
  movements: (params: StockMovementFilters) =>
    [...inventoryKeys.all, "movements", params] as const,
  movement: (id: string) => [...inventoryKeys.all, "movement", id] as const,
  trace: (id: string) => [...inventoryKeys.all, "trace", id] as const,
  traceByCode: (code: string) =>
    [...inventoryKeys.all, "traceByCode", code] as const,
  subledger: (balanceId: string) =>
    [...inventoryKeys.all, "subledger", balanceId] as const,
  box: (containerId: string, warehouseId: string) =>
    [...inventoryKeys.all, "box", containerId, warehouseId] as const,
  container: (containerId: string) =>
    [...inventoryKeys.all, "container", containerId] as const,
};

export function useInventoryBalances(params: InventoryBalanceFilters) {
  return useQuery<PagedResult<InventoryBalanceRow>>({
    queryKey: inventoryKeys.balances(params),
    queryFn: () => fetchInventoryBalances(params),
  });
}

export function useStockMovements(params: StockMovementFilters) {
  return useQuery<PagedResult<StockMovementRow>>({
    queryKey: inventoryKeys.movements(params),
    queryFn: () => fetchStockMovements(params),
  });
}

export function useStockMovement(id: string | null | undefined) {
  return useQuery({
    queryKey: inventoryKeys.movement(id ?? ""),
    queryFn: () => fetchStockMovement(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useStockMovementTrace(id: string | null | undefined) {
  return useQuery({
    queryKey: inventoryKeys.trace(id ?? ""),
    queryFn: () => traceStockMovementSource(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useBalanceSubledger(balanceId: string | null | undefined) {
  return useQuery<SubledgerResult>({
    queryKey: inventoryKeys.subledger(balanceId ?? ""),
    queryFn: () => fetchBalanceSubledger(balanceId ?? ""),
    enabled: Boolean(balanceId),
  });
}

export function useBoxReadProjection(
  containerId: string | null | undefined,
  warehouseId: string | null | undefined,
) {
  return useQuery<BoxReadProjection>({
    queryKey: inventoryKeys.box(containerId ?? "", warehouseId ?? ""),
    queryFn: () => fetchBoxReadProjection(containerId ?? "", warehouseId ?? ""),
    enabled: Boolean(containerId && warehouseId),
  });
}

export function useContainerRegisterDetail(containerId: string | null | undefined) {
  return useQuery<ContainerRegisterDetail>({
    queryKey: inventoryKeys.container(containerId ?? ""),
    queryFn: () => fetchContainerRegisterDetail(containerId ?? ""),
    enabled: Boolean(containerId),
  });
}

export function usePhysicalCodeTrace(code: string | null | undefined) {
  return useQuery({
    queryKey: inventoryKeys.traceByCode(code ?? ""),
    queryFn: () => traceByPhysicalCode(code ?? ""),
    enabled: Boolean(code && code.trim().length > 0),
  });
}
