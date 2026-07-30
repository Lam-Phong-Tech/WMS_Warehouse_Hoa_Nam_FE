import { describe, expect, it } from "vitest";
import { apiHealthUrl, runtimeConfig } from "@/shared/config/env";

describe("runtimeConfig", () => {
  it("normalizes required deploy-time config", () => {
    expect(runtimeConfig.apiBaseUrl).toMatch(/^https?:\/\//);
    expect(runtimeConfig.apiBaseUrl.endsWith("/")).toBe(false);
    expect(runtimeConfig.apiHealthPath.startsWith("/")).toBe(true);
    expect(runtimeConfig.apiTimeoutMs).toBeGreaterThan(0);
  });

  it("builds the approved backend health URL", () => {
    expect(apiHealthUrl).toBe(
      `${runtimeConfig.apiBaseUrl}${runtimeConfig.apiHealthPath}`,
    );
  });
});
