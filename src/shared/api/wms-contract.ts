export class WmsContractError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "WmsContractError";
  }
}

export function requireNonEmptyString(
  value: unknown,
  field: string,
  code = "WMS_FE_INVALID_PAYLOAD",
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new WmsContractError(code, `${field} is required`);
  }
  return value.trim();
}

export function requirePositiveNumber(
  value: unknown,
  field: string,
  code = "WMS_FE_INVALID_PAYLOAD",
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new WmsContractError(code, `${field} must be a positive number`);
  }
  return value;
}

export function requirePositiveInteger(
  value: unknown,
  field: string,
  code = "WMS_FE_INVALID_PAYLOAD",
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new WmsContractError(code, `${field} must be a positive integer`);
  }
  return value;
}

export function requireNonNegativeNumber(
  value: unknown,
  field: string,
  code = "WMS_FE_INVALID_PAYLOAD",
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new WmsContractError(code, `${field} must be a non-negative number`);
  }
  return value;
}

export function requireArray<T>(
  value: T[] | undefined,
  field: string,
  code = "WMS_FE_INVALID_PAYLOAD",
): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new WmsContractError(code, `${field} must contain at least one item`);
  }
  return value;
}

export function requireUniqueStrings(
  values: readonly string[],
  field: string,
  code = "WMS_FE_DUPLICATE_VALUE",
): string[] {
  const normalized = values.map((value, index) =>
    requireNonEmptyString(value, `${field}.${index}`),
  );
  const seen = new Set<string>();
  for (const value of normalized) {
    if (seen.has(value)) {
      throw new WmsContractError(
        code,
        `${field} contains duplicate value: ${value}`,
      );
    }
    seen.add(value);
  }
  return normalized;
}

/**
 * Canonical WWHN-180 stock-changing actions require an Idempotency-Key with
 * 8..100 characters. This helper deliberately does not invent or require an
 * optimistic-lock header: each endpoint must model its actual CAS contract.
 */
export function requireIdempotencyKeyHeader(
  value: unknown,
  field = "idempotencyKey",
  maxLength = 100,
) {
  const idempotencyKey = requireNonEmptyString(
    value,
    field,
    "WMS_FE_IDEMPOTENCY_KEY_REQUIRED",
  );
  if (idempotencyKey.length < 8 || idempotencyKey.length > maxLength) {
    throw new WmsContractError(
      "WMS_FE_INVALID_IDEMPOTENCY_KEY",
      `${field} must contain 8 to ${maxLength} characters`,
    );
  }
  return { "Idempotency-Key": idempotencyKey };
}

/**
 * Compatibility helper for contracts that genuinely require both headers.
 * post-receipt/post-issue/apply-adjustment DO require If-Match (BE:
 * CurrentBaselineStockFlowController::expectedVersion aborts 428
 * PRECONDITION_REQUIRED when missing, 412 STALE_VERSION on mismatch); their
 * services (shippingService.mutationHeaders, mvpOutboundService.headers) send
 * it directly rather than through this helper.
 */
export function requireIdempotencyHeaders(input: {
  idempotencyKey?: string;
  ifMatch?: string | number;
}) {
  return {
    ...requireIdempotencyKeyHeader(input.idempotencyKey, "idempotencyKey", 128),
    "If-Match": requireNonEmptyString(
      input.ifMatch === undefined ? undefined : String(input.ifMatch),
      "ifMatch",
      "WMS_FE_IF_MATCH_REQUIRED",
    ),
  };
}
