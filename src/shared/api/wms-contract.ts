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
      throw new WmsContractError(code, `${field} contains duplicate value: ${value}`);
    }
    seen.add(value);
  }
  return normalized;
}

export function requireIdempotencyHeaders(input: {
  idempotencyKey?: string;
  ifMatch?: string | number;
}) {
  const idempotencyKey = requireNonEmptyString(
    input.idempotencyKey,
    "idempotencyKey",
    "WMS_FE_IDEMPOTENCY_KEY_REQUIRED",
  );
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    throw new WmsContractError(
      "WMS_FE_INVALID_IDEMPOTENCY_KEY",
      "idempotencyKey must contain 8 to 128 characters",
    );
  }

  return {
    "Idempotency-Key": idempotencyKey,
    "If-Match": requireNonEmptyString(
      input.ifMatch === undefined ? undefined : String(input.ifMatch),
      "ifMatch",
      "WMS_FE_IF_MATCH_REQUIRED",
    ),
  };
}
