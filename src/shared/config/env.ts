type RuntimeEnvName = "local" | "dev" | "uat" | "prod" | "test";

export interface RuntimeConfig {
  readonly appTitle: string;
  readonly appVersion: string;
  readonly envName: RuntimeEnvName;
  readonly apiBaseUrl: string;
  readonly apiHealthPath: string;
  readonly apiTimeoutMs: number;
  readonly apiWithCredentials: boolean;
  readonly storageUrl?: string;
  readonly enableAnalytics: boolean;
  readonly enableDebug: boolean;
  readonly enablePerfMonitor: boolean;
}

const DEFAULT_API_TIMEOUT_MS = 10000;
const DEFAULT_HEALTH_PATH = "/health";
const CANONICAL_API_BASE_PATH = "/api/v1";

function readEnv(key: string): string | undefined {
  const value = import.meta.env[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function normalizeUrl(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(
      `[env] Missing required ${key}. Copy .env.example to .env and set ${key}.`,
    );
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("URL must use http or https");
    }
    if (parsed.username || parsed.password) {
      throw new Error("URL must not embed credentials");
    }
    return parsed.toString().replace(/\/$/, "");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid URL";
    throw new Error(`[env] ${key} is invalid: ${message}`, { cause: error });
  }
}

function normalizeApiBaseUrl(value: string | undefined): string {
  const normalized = normalizeUrl(value, "VITE_API_BASE_URL");
  const parsed = new URL(normalized);
  if (parsed.search || parsed.hash) {
    throw new Error(
      "[env] VITE_API_BASE_URL must not contain query/hash fragments.",
    );
  }
  if (parsed.pathname.replace(/\/+$/, "") !== CANONICAL_API_BASE_PATH) {
    throw new Error(
      `[env] VITE_API_BASE_URL must end at ${CANONICAL_API_BASE_PATH}.`,
    );
  }
  return normalized;
}

function optionalUrl(
  value: string | undefined,
  key: string,
): string | undefined {
  if (!value) return undefined;
  return normalizeUrl(value, key);
}

function normalizeEnvName(value: string | undefined): RuntimeEnvName {
  const normalized = (value || "local").toLowerCase();
  if (["local", "dev", "uat", "prod", "test"].includes(normalized)) {
    return normalized as RuntimeEnvName;
  }
  throw new Error(
    "[env] VITE_APP_ENV must be one of local, dev, uat, prod, test.",
  );
}

function boolEnv(value: string | undefined, key: string): boolean {
  if (!value || value === "false" || value === "0") return false;
  if (value === "true" || value === "1") return true;
  throw new Error(`[env] ${key} must be true, false, 1, or 0.`);
}

function numberEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("[env] VITE_API_TIMEOUT_MS must be a positive number.");
  }
  return parsed;
}

function pathEnv(value: string | undefined): string {
  const raw = value || DEFAULT_HEALTH_PATH;
  if (/[?#]/.test(raw)) {
    throw new Error(
      "[env] VITE_API_HEALTH_PATH must not contain query/hash fragments.",
    );
  }
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

export function resolveApiUrl(baseUrl: string, relativePath: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${relativePath.replace(
    /^\/+|\/+$/g,
    "",
  )}`;
}

export const runtimeConfig: RuntimeConfig = {
  appTitle: readEnv("VITE_APP_TITLE") || "WMS Hoa Nam",
  appVersion: readEnv("VITE_APP_VERSION") || "0.0.0",
  envName: normalizeEnvName(readEnv("VITE_APP_ENV")),
  apiBaseUrl: normalizeApiBaseUrl(readEnv("VITE_API_BASE_URL")),
  apiHealthPath: pathEnv(readEnv("VITE_API_HEALTH_PATH")),
  apiTimeoutMs: numberEnv(
    readEnv("VITE_API_TIMEOUT_MS"),
    DEFAULT_API_TIMEOUT_MS,
  ),
  // Auth bootstrap depends on the BE HttpOnly refresh cookie after F5. Keep
  // credentialed requests on by default; deployments may explicitly opt out only
  // if they replace the browser-session transport end to end.
  apiWithCredentials: boolEnv(
    readEnv("VITE_API_WITH_CREDENTIALS") ?? "true",
    "VITE_API_WITH_CREDENTIALS",
  ),
  storageUrl: optionalUrl(readEnv("VITE_STORAGE_URL"), "VITE_STORAGE_URL"),
  enableAnalytics: boolEnv(
    readEnv("VITE_ENABLE_ANALYTICS"),
    "VITE_ENABLE_ANALYTICS",
  ),
  enableDebug: boolEnv(readEnv("VITE_ENABLE_DEBUG"), "VITE_ENABLE_DEBUG"),
  enablePerfMonitor: boolEnv(
    readEnv("VITE_ENABLE_PERF_MONITOR"),
    "VITE_ENABLE_PERF_MONITOR",
  ),
};

export const apiHealthUrl = resolveApiUrl(
  runtimeConfig.apiBaseUrl,
  runtimeConfig.apiHealthPath,
);
