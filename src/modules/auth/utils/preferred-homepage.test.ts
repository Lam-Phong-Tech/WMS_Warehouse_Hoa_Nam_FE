import { describe, expect, it } from "vitest";
import { resolvePreferredHomepage } from "./preferred-homepage";
import { DASHBOARD_CANONICAL, ROUTES } from "@/shared/constants/routes";
describe("preferred landing page", () => {
  it("opens a saved destination when the user has its real route permission", () =>
    expect(resolvePreferredHomepage("inbound", ["inbound.view"], false)).toBe(
      ROUTES.INBOUND,
    ));
  it("does not grant access to a saved destination after role permissions changed", () =>
    expect(resolvePreferredHomepage("outbound", [], false)).not.toBe(
      ROUTES.OUTBOUND,
    ));
  it("rejects unknown and external redirect values", () => {
    expect(resolvePreferredHomepage("//evil.example/profile", [], true)).toBe(
      DASHBOARD_CANONICAL,
    );
    expect(resolvePreferredHomepage("https://evil.example", [], true)).toBe(
      DASHBOARD_CANONICAL,
    );
  });
});
