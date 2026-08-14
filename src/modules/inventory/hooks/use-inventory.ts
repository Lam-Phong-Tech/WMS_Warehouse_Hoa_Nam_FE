import { useQuery } from "@tanstack/react-query";
import {
  fetchInventoryBalances,
  fetchStockMovements,
  fetchStockMovement,
  traceStockMovementSource,
  type InventoryBalanceFilters,
  type StockMovementFilters,
} from "../services/inventoryService";

export const inventoryKeys = {
  all: ["inventory"] as const,
  balances: (params: InventoryBalanceFilters) =>
    [...inventoryKeys.all, "balances", params] as const,
  movements: (params: StockMovementFilters) =>
    [...inventoryKeys.all, "movements", params] as const,
  movement: (id: string) =>
    [...inventoryKeys.all, "movement", id] as const,
  trace: (id: string) => [...inventoryKeys.all, "trace", id] as const,
};

export function useInventoryBalances(params: InventoryBalanceFilters) {
  return useQuery({
    queryKey: inventoryKeys.balances(params),
    queryFn: () => fetchInventoryBalances(params),
  });
}

export function useStockMovements(params: StockMovementFilters) {
  return useQuery({
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
