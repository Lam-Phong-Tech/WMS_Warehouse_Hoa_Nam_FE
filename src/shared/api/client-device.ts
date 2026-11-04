const DEVICE_STORAGE_KEY = "hn-browser-installation-v1";
let ephemeralDeviceId: string | null = null;
/** Declared browser installation, not a physical-hardware fingerprint. Never contains credentials. */
export function browserInstallationId(): string | null {
  if (typeof window === "undefined" || !globalThis.crypto?.randomUUID)
    return null;
  try {
    const saved = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (
      saved &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        saved,
      )
    )
      return saved;
    const value = ephemeralDeviceId ?? globalThis.crypto.randomUUID();
    window.localStorage.setItem(DEVICE_STORAGE_KEY, value);
    ephemeralDeviceId = value;
    return value;
  } catch {
    return (
      ephemeralDeviceId ?? (ephemeralDeviceId = globalThis.crypto.randomUUID())
    );
  }
}

export function browserInstallationMetadata(
  agent = typeof navigator !== "undefined" ? navigator.userAgent : "",
) {
  const browser = /Edg\//i.test(agent)
    ? "Edge"
    : /Firefox\//i.test(agent)
      ? "Firefox"
      : /Chrome\/|CriOS\//i.test(agent)
        ? "Chrome"
        : /Safari\//i.test(agent)
          ? "Safari"
          : "Web";
  const platform = /Android/i.test(agent)
    ? "Android"
    : /iPhone|iPad/i.test(agent)
      ? "iOS"
      : /Windows/i.test(agent)
        ? "Windows"
        : /Macintosh|Mac OS/i.test(agent)
          ? "macOS"
          : /Linux/i.test(agent)
            ? "Linux"
            : "Other";
  return { platform, label: `${platform} - ${browser}` };
}
