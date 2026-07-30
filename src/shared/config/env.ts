type RuntimeEnvName = "local" | "dev" | "uat" | "prod" | "test";

export interface RuntimeConfig {
  readonly appTitle: string;
  readonly appVersion: string;
  readonly envName: RuntimeEnvName;
  readonly apiBaseUrl: string;
  readonly apiHealthPath: string;
  readonly apiTimeoutMs: number;
  readonly storageUrl?: string;
  readonly enableAnalytics: boolean;
  readonly enableDebug: boolean;
  readonly enablePerfMonitor: boolean;
}

const DEFAULT_API_TIMEOUT_MS = 10000;
const DEFAULT_HEALTH_PATH = "/health";

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
    return parsed.toString().replace(/\/$/, "");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid URL";
    throw new Error(`[env] ${key} is invalid: ${message}`, { cause: error });
  }
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

function boolEnv(value: string | undefined): boolean {
  return value === "true" || value === "1";
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
  if (!value) return DEFAULT_HEALTH_PATH;
  return value.startsWith("/") ? value : `/${value}`;
}

export const runtimeConfig: RuntimeConfig = {
  appTitle: readEnv("VITE_APP_TITLE") || "WMS Hoa Nam",
  appVersion: readEnv("VITE_APP_VERSION") || "0.0.0",
  envName: normalizeEnvName(readEnv("VITE_APP_ENV")),
  apiBaseUrl: normalizeUrl(readEnv("VITE_API_BASE_URL"), "VITE_API_BASE_URL"),
  apiHealthPath: pathEnv(readEnv("VITE_API_HEALTH_PATH")),
  apiTimeoutMs: numberEnv(
    readEnv("VITE_API_TIMEOUT_MS"),
    DEFAULT_API_TIMEOUT_MS,
  ),
  storageUrl: optionalUrl(readEnv("VITE_STORAGE_URL"), "VITE_STORAGE_URL"),
  enableAnalytics: boolEnv(readEnv("VITE_ENABLE_ANALYTICS")),
  enableDebug: boolEnv(readEnv("VITE_ENABLE_DEBUG")),
  enablePerfMonitor: boolEnv(readEnv("VITE_ENABLE_PERF_MONITOR")),
};

export const apiHealthUrl = `${runtimeConfig.apiBaseUrl}${runtimeConfig.apiHealthPath}`;
