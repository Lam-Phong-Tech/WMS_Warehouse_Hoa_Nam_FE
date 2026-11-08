import { describe, expect, it } from "vitest";
import { desktopChromePlatform } from "./device-presentation";
import type { ProfileDevice } from "../../types/profile.types";

describe("desktop Chrome device presentation", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36",
      "Windows",
    ],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/130.0", "macOS"],
    ["Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0", "Linux"],
    ["Mozilla/5.0 (X11; CrOS x86_64) Chrome/130.0", "ChromeOS"],
    ["Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile", null],
    ["Mozilla/5.0 (iPhone) CriOS/130.0 Mobile", null],
    ["Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Edg/130.0", null],
    ["Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 OPR/100.0", null],
    ["Chrome/130.0", null],
  ])("recognizes the platform from %s", (user_agent, expected) => {
    const device = {
      client_type: null,
      platform: null,
      sessions: [{ user_agent }],
    } as ProfileDevice;
    expect(desktopChromePlatform(device)).toBe(expected);
  });
});
