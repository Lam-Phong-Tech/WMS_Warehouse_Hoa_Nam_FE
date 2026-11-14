import type { Language } from "@/shared/i18n/language.store";

/** Only the safe, user-facing fields survive the redirect to the login page. */
export interface SessionReplacementNotice {
  device_label?: string;
  signed_in_at?: string;
  ip_hint?: string;
}

const KEY = "hn-wms.session-replaced";

/** Localize AccountSessionPolicy's generated labels at render time, preserving other names. */
export function localizeReplacementDeviceLabel(label: string, language: Language): string {
  const match = /^(?:(Chrome|Edge|Firefox|Safari) trên )?(iPhone|iPad|Android|Windows|macOS|Linux|Thiết bị khác)$/.exec(label);
  if (!match) return label;
  const browser = match[1];
  const device = match[2] === "Thiết bị khác"
    ? { vi: "Thiết bị khác", en: "Other device", zh: "其他设备" }[language]
    : match[2];
  if (!browser) return device;
  if (language === "en") return `${browser} on ${device}`;
  if (language === "zh") return `${device} 上的 ${browser}`;
  return label;
}

/** Controller errors use `replacement`; auth middleware errors use `data.replacement`. */
export function replacementDetailsFromResponse(body: unknown): unknown {
  if (!body || typeof body !== "object") return {};
  const value = body as Record<string, unknown>;
  if (value.replacement !== undefined) return value.replacement;
  if (value.data && typeof value.data === "object") {
    return (value.data as Record<string, unknown>).replacement ?? {};
  }
  return {};
}

export function rememberSessionReplacementNotice(value: unknown): void {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const notice: SessionReplacementNotice = {};
  if (typeof source.device_label === "string" && source.device_label.length <= 80) {
    notice.device_label = source.device_label;
  }
  if (typeof source.signed_in_at === "string" && !Number.isNaN(Date.parse(source.signed_in_at))) {
    notice.signed_in_at = source.signed_in_at;
  }
  if (typeof source.ip_hint === "string" && /^(?:\d{1,3}\.){3}xxx$/.test(source.ip_hint)) {
    notice.ip_hint = source.ip_hint;
  }
  try { window.sessionStorage.setItem(KEY, JSON.stringify(notice)); }
  catch { /* Storage is optional; the redirect must still work. */ }
}

export function readSessionReplacementNotice(): SessionReplacementNotice | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const source = value as Record<string, unknown>;
    return {
      ...(typeof source.device_label === "string" ? { device_label: source.device_label } : {}),
      ...(typeof source.signed_in_at === "string" && !Number.isNaN(Date.parse(source.signed_in_at))
        ? { signed_in_at: source.signed_in_at } : {}),
      ...(typeof source.ip_hint === "string" && /^(?:\d{1,3}\.){3}xxx$/.test(source.ip_hint)
        ? { ip_hint: source.ip_hint } : {}),
    };
  } catch { return null; }
}

export function clearSessionReplacementNotice(): void {
  try { window.sessionStorage.removeItem(KEY); }
  catch { /* Storage is optional. */ }
}
