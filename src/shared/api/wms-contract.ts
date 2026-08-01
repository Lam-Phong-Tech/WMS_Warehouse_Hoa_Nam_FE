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

export function requireIdempotencyHeaders(input: {
  idempotencyKey?: string;
  ifMatch?: string | number;
}) {
  return {
    "Idempotency-Key": requireNonEmptyString(
      input.idempotencyKey,
      "idempotencyKey",
      "WMS_FE_IDEMPOTENCY_KEY_REQUIRED",
    ),
    "If-Match": requireNonEmptyString(
      input.ifMatch === undefined ? undefined : String(input.ifMatch),
      "ifMatch",
      "WMS_FE_IF_MATCH_REQUIRED",
    ),
  };
}
