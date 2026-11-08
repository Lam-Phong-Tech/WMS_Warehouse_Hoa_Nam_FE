import type { ProfileDevice } from "../../types/profile.types";

/** Infer a display label from stored session metadata, without changing device identity. */
export function desktopChromePlatform(device: ProfileDevice): string | null {
  if (device.client_type === "app") return null;
  for (const session of device.sessions) {
    const ua = session.user_agent || "";
    const metadata = `${device.platform || ""} ${session.platform || ""} ${ua}`;
    if (
      session.client_type === "app" ||
      !/Chrome\//i.test(ua) ||
      /Edg\/?|OPR\//i.test(ua) ||
      /Android|iPhone|iPad|iPod|Mobile|\biOS\b/i.test(metadata)
    )
      continue;
    if (/Windows/i.test(metadata)) return "Windows";
    if (/Macintosh|macOS|Mac OS/i.test(metadata)) return "macOS";
    if (/CrOS|ChromeOS/i.test(metadata)) return "ChromeOS";
    if (/Linux|X11/i.test(metadata)) return "Linux";
  }
  return null;
}
