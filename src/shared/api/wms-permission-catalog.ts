import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { WmsContractError } from "@/shared/api/wms-contract";
import {
  WMS_CANONICAL_PERMISSION_CODES,
  WMS_PERMISSION_ALIASES,
  canonicalizeWmsPermission,
} from "@/shared/constants/wms-permissions";

type RawPermission = string | Record<string, unknown>;

export interface RuntimePermissionCatalogResult {
  runtimeCodes: string[];
  canonicalRuntimeCodes: string[];
  missingCanonicalCodes: string[];
  aliasesObserved: Array<{ runtime: string; canonical: string }>;
}

function codeOf(value: RawPermission): string {
  if (typeof value === "string") return value.trim();
  const candidate = value.code ?? value.permission_code ?? value.name;
  return typeof candidate === "string" ? candidate.trim() : "";
}

function rowsOf(value: unknown): RawPermission[] {
  if (Array.isArray(value)) return value as RawPermission[];
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  for (const candidate of [row.data, row.items, row.rows, row.permissions]) {
    if (Array.isArray(candidate)) return candidate as RawPermission[];
  }
  return [];
}

export function reconcileRuntimePermissionCatalog(
  value: unknown,
): RuntimePermissionCatalogResult {
  const runtimeCodes = [...new Set(rowsOf(value).map(codeOf).filter(Boolean))];
  if (runtimeCodes.length === 0) {
    throw new WmsContractError(
      "WMS_FE_INVALID_PERMISSION_CATALOG",
      "Runtime /permissions response does not contain permission codes",
    );
  }

  const canonicalRuntimeCodes: string[] = [
    ...new Set<string>(
      runtimeCodes.map((code) => canonicalizeWmsPermission(code)),
    ),
  ];
  const runtimeSet = new Set(canonicalRuntimeCodes);
  const missingCanonicalCodes = WMS_CANONICAL_PERMISSION_CODES.filter(
    (code) => !runtimeSet.has(code),
  );
  const aliasesObserved = runtimeCodes
    .filter((code) => WMS_PERMISSION_ALIASES[code] !== undefined)
    .map((runtime) => ({
      runtime,
      canonical: WMS_PERMISSION_ALIASES[runtime],
    }));

  return {
    runtimeCodes,
    canonicalRuntimeCodes,
    missingCanonicalCodes,
    aliasesObserved,
  };
}

export async function fetchAndReconcileRuntimePermissionCatalog(): Promise<RuntimePermissionCatalogResult> {
  const result = await http.get<unknown>(API_ENDPOINTS.PERMISSIONS, {
    params: { per_page: 500, status: "active" },
  });
  return reconcileRuntimePermissionCatalog(result);
}
