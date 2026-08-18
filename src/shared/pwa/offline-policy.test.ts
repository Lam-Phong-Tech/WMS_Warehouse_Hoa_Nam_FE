import { describe, expect, it } from "vitest";
import {
  isOfflineMutationBlocked,
  OFFLINE_MUTATION_CODE,
  OFFLINE_MUTATION_MESSAGE,
} from "./offline-policy";

describe("WWHN-325 offline mutation policy", () => {
  it.each(["post", "PUT", "Patch", "delete"])(
    "blocks %s while offline",
    (method) => {
      expect(isOfflineMutationBlocked(method, false)).toBe(true);
    },
  );

  it.each(["get", "head", "options"])(
    "does not block read-only %s while offline",
    (method) => {
      expect(isOfflineMutationBlocked(method, false)).toBe(false);
    },
  );

  it("does not block mutations while online", () => {
    expect(isOfflineMutationBlocked("post", true)).toBe(false);
  });

  it("exposes stable error semantics for UI and QA evidence", () => {
    expect(OFFLINE_MUTATION_CODE).toBe("OFFLINE_MUTATION_BLOCKED");
    expect(OFFLINE_MUTATION_MESSAGE).toContain("không xếp hàng");
  });
});
