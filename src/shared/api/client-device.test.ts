import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserInstallationId,
  browserInstallationMetadata,
} from "./client-device";
afterEach(() => {
  localStorage.removeItem("hn-browser-installation-v1");
  vi.restoreAllMocks();
});
describe("declared browser installation", () => {
  it("uses ASCII wire-safe header metadata", () => {
    const metadata = browserInstallationMetadata();
    expect(metadata.label).toMatch(/^[\x20-\x7e]+$/);
    expect(metadata.platform).toMatch(/^[\x20-\x7e]+$/);
  });
  it("reuses a valid browser installation across requests without including identity or credentials", () => {
    const id = browserInstallationId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(browserInstallationId()).toBe(id);
  });
  it("replaces malformed storage values instead of treating them as authoritative device identities", () => {
    localStorage.setItem("hn-browser-installation-v1", "someone@else.example");
    expect(browserInstallationId()).toMatch(/^[0-9a-f-]{36}$/i);
  });
  it("retains an ephemeral installation when browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(browserInstallationId()).toBe(browserInstallationId());
  });
});
