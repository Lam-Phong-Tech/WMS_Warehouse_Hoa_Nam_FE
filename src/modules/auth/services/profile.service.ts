import { http } from "@/shared/api/http";
import { normalizeMeResponse, type BackendMeResponse } from "./auth.service";
import type {
  ProfileChanges,
  ProfilePreferenceChanges,
  ProfilePreferences,
  ProfileDevice,
  ProfileDevicesResponse,
  ProfileLoginHistoryEntry,
  ProfileLoginHistoryResponse,
  TrustedDevice,
} from "../types/profile.types";
const versionHeaders = (version?: number) =>
  version === undefined
    ? undefined
    : { headers: { "If-Match": String(version) } };
export const profileService = {
  async getDeviceHistory(page = 1, perPage = 6): Promise<ProfileLoginHistoryResponse> {
    const result = await http.getPage<ProfileLoginHistoryEntry[]>(
      "/auth/device-history",
      {
        params: { page, per_page: perPage },
      },
    );
    return {
      data: result.data,
      meta: result.meta as ProfileLoginHistoryResponse["meta"],
    };
  },
  async getDevices(): Promise<ProfileDevicesResponse> {
    const result = await http.getPage<ProfileDevice[]>("/auth/devices");
    return {
      data: result.data,
      meta: result.meta as ProfileDevicesResponse["meta"],
    };
  },
  async getTrustedDevices(): Promise<{ data: TrustedDevice[] }> {
    const result = await http.getPage<TrustedDevice[]>("/auth/trusted-devices");
    return {
      data: Array.isArray(result?.data) ? result.data : [],
    };
  },
  revokeTrustedDevice(id: string) {
    return http.delete<{
      revoked: boolean;
      was_current: boolean;
      revoked_session_count: number;
    }>(`/auth/trusted-devices/${encodeURIComponent(id)}`);
  },
  revokeSession(id: string) {
    return http.delete<{ revoked: boolean; revoked_session_count?: number }>(
      `/auth/sessions/${encodeURIComponent(id)}`,
    );
  },
  revokeDevice(id: string) {
    return http.delete<{ revoked: boolean; revoked_session_count: number }>(
      `/auth/devices/${encodeURIComponent(id)}`,
    );
  },
  revokeOthers() {
    return http.post<{ revoked: boolean; revoked_session_count: number }>(
      "/auth/sessions/revoke-others",
      {},
    );
  },
  async getMe() {
    return normalizeMeResponse(await http.get<BackendMeResponse>("/auth/me"));
  },
  async updateMe(changes: ProfileChanges, version?: number) {
    return normalizeMeResponse(
      await http.patch<BackendMeResponse>(
        "/auth/me",
        changes,
        versionHeaders(version),
      ),
    );
  },
  getPreferences() {
    return http.get<ProfilePreferences>("/auth/preferences");
  },
  updatePreferences(changes: ProfilePreferenceChanges, version: number) {
    return http.patch<ProfilePreferences>(
      "/auth/preferences",
      changes,
      versionHeaders(version),
    );
  },
  getAvatar() {
    return http.downloadBlob("/auth/me/avatar");
  },
  async uploadAvatar(file: File, version?: number, changes?: ProfileChanges) {
    const body = new FormData();
    body.append("avatar", file);
    if (changes)
      Object.entries(changes).forEach(([key, value]) => {
        if (value !== undefined) body.append(key, value ?? "");
      });
    return normalizeMeResponse(
      await http.post<BackendMeResponse>(
        "/auth/me/avatar",
        body,
        versionHeaders(version),
      ),
    );
  },
  async removeAvatar(version?: number) {
    return normalizeMeResponse(
      await http.delete<BackendMeResponse>(
        "/auth/me/avatar",
        versionHeaders(version),
      ),
    );
  },
};
