import { describe, expect, it } from "vitest";
import {
  apiHealthUrl,
  resolveApiUrl,
  runtimeConfig,
} from "@/shared/config/env";

describe("runtimeConfig", () => {
  it("normalizes required deploy-time config", () => {
    expect(runtimeConfig.apiBaseUrl).toMatch(/^https?:\/\//);
    expect(runtimeConfig.apiBaseUrl.endsWith("/")).toBe(false);
    expect(runtimeConfig.apiHealthPath.startsWith("/")).toBe(true);
    expect(runtimeConfig.apiTimeoutMs).toBeGreaterThan(0);
  });

  it("always enables credentialed API requests for HttpOnly refresh cookies", () => {
    expect(runtimeConfig.apiWithCredentials).toBe(true);
  });

  it("builds the approved backend health URL", () => {
    expect(apiHealthUrl).toBe(
      resolveApiUrl(runtimeConfig.apiBaseUrl, runtimeConfig.apiHealthPath),
    );
  });

  it("resolves the versioned health contract without a double slash", () => {
    expect(resolveApiUrl("https://example.test/api/v1", "/health")).toBe(
      "https://example.test/api/v1/health",
    );
    expect(resolveApiUrl("https://example.test/api/v1/", "health/")).toBe(
      "https://example.test/api/v1/health",
    );
  });
});
