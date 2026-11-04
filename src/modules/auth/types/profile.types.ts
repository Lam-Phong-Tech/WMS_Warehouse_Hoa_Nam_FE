import type { MeResponse } from "./me.types";

export interface ProfileAvatar {
  mime_type: string;
  size: number;
  updated_at: string;
  url: string;
}
export type PersonalProfile = MeResponse;
export interface ProfileChanges {
  display_name: string;
  phone: string | null;
  email?: string;
  current_password?: string;
}
export interface ProfileNotificationPreference {
  in_app: boolean;
  email: boolean;
}
export interface ProfilePreferences {
  version: number;
  locale: "vi" | "en" | "zh";
  timezone: string;
  date_format: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  default_homepage: string;
  theme: "light" | "dark" | "system";
  accent: "ocean" | "teal" | "indigo" | "graphite";
  font_size: "small" | "medium" | "large";
  density: "comfortable" | "compact";
  reduced_motion: boolean;
  notifications: Record<string, ProfileNotificationPreference>;
}
export type ProfilePreferenceChanges = Partial<
  Omit<ProfilePreferences, "version">
>;
export const profileKeys = {
  preferences: (userId: string) => ["auth", "preferences", userId] as const,
  devices: (userId: string) => ["auth", "devices", userId] as const,
  deviceHistory: (userId: string) =>
    ["auth", "device-history", userId] as const,
  avatar: (userId: string, updatedAt?: string) =>
    ["auth", "avatar", userId, updatedAt] as const,
};

export interface ProfileSession {
  id: string;
  auth_session_id: string;
  session_id: string;
  is_current: boolean;
  can_revoke: boolean;
  device_label: string | null;
  user_agent: string | null;
  ip_address: string | null;
  device_id?: string | null;
  client_type?: "web" | "app" | null;
  platform?: string | null;
  metadata_source: string;
  last_active_at: string | null;
  last_active_semantics: string;
  started_at?: string | null;
  expires_at: string | null;
}
export interface ProfileDevice {
  device_id: string | null;
  group_key: string;
  device_label: string | null;
  client_type: "web" | "app" | null;
  platform: string | null;
  metadata_source:
    | "CLIENT_DECLARED_INSTALLATION_NOT_VERIFIED_PHYSICAL_DEVICE"
    | "UNKNOWN_LEGACY_INSTALLATION";
  first_seen_at: string | null;
  last_active_at: string | null;
  last_active_semantics: string;
  is_current: boolean;
  can_revoke: boolean;
  session_count: number;
  sessions: ProfileSession[];
}
export interface ProfileLoginHistoryEntry extends ProfileSession {
  status: "SIGNED_OUT" | "EXPIRED";
  ended_at: string;
}
export interface ProfileLoginHistoryResponse {
  data: ProfileLoginHistoryEntry[];
  meta: { current_page: number; last_page: number; total: number };
}
export interface ProfileDevicesMeta {
  current_session_id?: string;
  active_device_count?: number;
  unknown_device_group_count?: number;
  active_session_count?: number;
  other_session_count?: number;
  account_session_policy?: { enabled?: boolean; version?: string };
  device_policy?: {
    identity?: string;
    max_devices?: number | null;
    max_sessions_per_device?: number | null;
    limits_configured?: boolean;
  };
}
export interface ProfileDevicesResponse {
  data: ProfileDevice[];
  meta: ProfileDevicesMeta;
}
