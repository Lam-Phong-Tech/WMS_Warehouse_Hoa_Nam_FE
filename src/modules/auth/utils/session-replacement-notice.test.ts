import { beforeEach, describe, expect, it } from "vitest";
import { clearSessionReplacementNotice, readSessionReplacementNotice, rememberSessionReplacementNotice } from "./session-replacement-notice";

describe("session replacement notice", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps replacement until cleared without leaking raw user agent or IP", () => {
    rememberSessionReplacementNotice({
      device_label: "Chrome trên Android",
      signed_in_at: "2026-11-02T02:38:00Z",
      ip_hint: "127.0.0.xxx",
      ip_address: "127.0.0.1",
      user_agent: "private browser fingerprint",
    });

    expect(readSessionReplacementNotice()).toEqual({
      device_label: "Chrome trên Android",
      signed_in_at: "2026-11-02T02:38:00Z",
      ip_hint: "127.0.0.xxx",
    });
    expect(readSessionReplacementNotice()).not.toBeNull();
    clearSessionReplacementNotice();
    expect(readSessionReplacementNotice()).toBeNull();
    expect(sessionStorage.getItem("hn-wms.session-replaced")).toBeNull();
  });
});
