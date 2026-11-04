import { http } from "@/shared/api/http";
import type { BackendMeResponse } from "@/modules/auth/services/auth.service";
import type {
  ProfileDevice,
  ProfilePreferences,
  ProfileSession,
} from "@/modules/auth/types/profile.types";
import type { MfaStatus } from "@/modules/auth/types/mfa.types";

import {
  PROFILE_NAME,
  PROFILE_PASSWORD,
  CURRENT_DEVICE_ID,
  OTHER_DEVICE_ID,
  CURRENT_SESSION_ID,
  SAME_DEVICE_SESSION_ID,
  OTHER_SESSION_ID,
  UNKNOWN_SESSION_ID,
  MFA_SECRET,
  RECOVERY_CODES,
} from "./profile-account-values";

type FixtureMe = BackendMeResponse & {
  version: number;
  avatar?: {
    mime_type: string;
    size: number;
    updated_at: string;
    url: string;
  } | null;
};
interface ProfileFixtureState {
  me: FixtureMe;
  preferences: ProfilePreferences;
  devices: ProfileDevice[];
  mfa: MfaStatus;
  multiple: boolean;
}
interface ProfileFixtureRequest {
  method: string;
  url: string;
  payload?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}
interface ProfileFixtureFault {
  method: string;
  url: string;
  status?: number;
  code?: string;
  afterCommit?: boolean;
}
declare global {
  interface Window {
    __profileRequests: ProfileFixtureRequest[];
    __profileState: ProfileFixtureState;
    __profileSeed?: ProfileFixtureState;
    __profileFaults: ProfileFixtureFault[];
    __profileDelays: { method: string; url: string; milliseconds: number }[];
    __profileDevicesUnavailable: boolean;
    __profileMfaUnavailable: boolean;
    __profileNotificationPermission?: NotificationPermission;
    __profileNotificationRequests?: number;
  }
}

const semantics = "LOGIN_OR_TOKEN_REFRESH_NOT_EACH_API_REQUEST";
function session(
  id: string,
  current: boolean,
  deviceId: string | null,
  platform: string | null,
  clientType: "web" | "app" | null,
): ProfileSession {
  return {
    id: `f${id.slice(1)}`,
    auth_session_id: id,
    session_id: id,
    is_current: current,
    can_revoke: !current,
    device_label:
      deviceId === CURRENT_DEVICE_ID
        ? "Máy tính văn phòng — Chrome và Edge"
        : deviceId
          ? "Máy quét kho Hoa Nam"
          : null,
    device_id: deviceId,
    platform,
    client_type: clientType,
    user_agent:
      deviceId === CURRENT_DEVICE_ID
        ? `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${current ? "Chrome/130.0" : "Edg/130.0"}`
        : deviceId
          ? "HoaNamScanner/2.0 (Android 14)"
          : null,
    ip_address: deviceId ? "192.168.1.100" : null,
    metadata_source: "STORED_REQUEST_HEADERS_NOT_VERIFIED_DEVICE_OR_LOCATION",
    last_active_at: "2026-11-04T09:40:00+07:00",
    last_active_semantics: semantics,
    started_at: "2026-11-03T08:30:00+07:00",
    expires_at: "2026-12-04T09:40:00+07:00",
  };
}
function device(id: string | null, sessions: ProfileSession[]): ProfileDevice {
  return {
    device_id: id,
    group_key: id ?? sessions[0].session_id,
    device_label: sessions[0].device_label,
    client_type: sessions[0].client_type ?? null,
    platform: sessions[0].platform ?? null,
    metadata_source: id
      ? "CLIENT_DECLARED_INSTALLATION_NOT_VERIFIED_PHYSICAL_DEVICE"
      : "UNKNOWN_LEGACY_INSTALLATION",
    first_seen_at: id ? "2026-11-01T08:00:00+07:00" : null,
    last_active_at: sessions[0].last_active_at,
    last_active_semantics: semantics,
    is_current: sessions.some((entry) => entry.is_current),
    can_revoke: Boolean(id) && !sessions.some((entry) => entry.is_current),
    session_count: sessions.length,
    sessions,
  };
}
function initialState(): ProfileFixtureState {
  const params = new URLSearchParams(location.search);
  const multiple = params.has("multiple");
  const current = session(
    CURRENT_SESSION_ID,
    true,
    CURRENT_DEVICE_ID,
    "Windows",
    "web",
  );
  return {
    me: {
      user_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      username: "minh.anh",
      display_name: PROFILE_NAME,
      email: "minh.anh.dieu.phoi.van.hanh.kho@example.com",
      phone: "0901234567",
      status: "ACTIVE",
      version: 7,
      roles: [
        {
          role_id: "role-warehouse",
          role_code: "WAREHOUSE_COORDINATOR",
          role_name: "Điều phối kho",
          scope_ref: "warehouse-main",
        },
      ],
      permissions: ["inventory.view", "outbound.view"],
      warehouse_scope_ids: ["warehouse-main"],
      department: {
        department_id: "department-operations",
        department_name: "Vận hành kho và kiểm soát dữ liệu",
      },
      last_login_at: "2026-11-04T09:40:00+07:00",
      avatar: null,
    } as FixtureMe,
    preferences: {
      version: 1,
      locale: "vi",
      timezone: "Asia/Ho_Chi_Minh",
      date_format: "DD/MM/YYYY",
      default_homepage: "dashboard",
      theme: params.get("theme") === "dark" ? "dark" : "system",
      accent: "ocean",
      font_size: "medium",
      density: "comfortable",
      reduced_motion: false,
      notifications: Object.fromEntries(
        ["stock_documents", "inventory", "warranty", "account"].map((key) => [
          key,
          { in_app: true, email: false },
        ]),
      ),
    },
    devices: multiple
      ? [
          device(CURRENT_DEVICE_ID, [
            current,
            session(
              SAME_DEVICE_SESSION_ID,
              false,
              CURRENT_DEVICE_ID,
              "Windows",
              "web",
            ),
          ]),
          device(OTHER_DEVICE_ID, [
            session(OTHER_SESSION_ID, false, OTHER_DEVICE_ID, "Android", "app"),
          ]),
          device(null, [session(UNKNOWN_SESSION_ID, false, null, null, null)]),
        ]
      : [device(CURRENT_DEVICE_ID, [current])],
    mfa: {
      enabled:
        params.get("mfa") === "enabled" || params.get("mfa") === "required",
      pending: params.get("mfa") === "pending",
      required_for_role: params.get("mfa") === "required",
      enforced: params.get("mfa") === "required",
      must_enroll_now: false,
      recovery_codes_remaining:
        params.get("mfa") === "enabled" || params.get("mfa") === "required"
          ? 8
          : 0,
    },
    multiple,
  };
}

function apiError(
  status: number,
  code: string,
  message: string,
  errors?: Record<string, string[]>,
) {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: {
      status,
      data: {
        message,
        code,
        error_code: code,
        error: { code, message, details: errors },
        errors,
      },
    },
    status,
  });
}
function requestBody(body: unknown): Record<string, unknown> {
  if (body instanceof FormData)
    return Object.fromEntries(
      [...body.entries()].map(([key, value]) => [
        key,
        value instanceof File
          ? { name: value.name, size: value.size, type: value.type }
          : value,
      ]),
    );
  return body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};
}
const clone = <T>(value: T): T => structuredClone(value);
function accountPolicy(enabled: boolean) {
  return {
    version: "auth-session-replacement-v1",
    enabled,
    scope: "ACCOUNT_ALL_CLIENTS",
    role_exemptions: [],
    replacement_boundary:
      "COMMITTED_COMPLETED_LOGIN_NOT_PASSWORD_OR_MFA_CHALLENGE",
    legacy_access_policy: enabled ? "RELOGIN_REQUIRED" : "EXISTING_POLICY",
    replacement_error: "AUTH_SESSION_REPLACED",
    idle_detection: "AUTHENTICATED_CHECK_ON_FOREGROUND_AND_BEFORE_COMMAND",
    push_disconnect_supported: false,
    recommended_foreground_check_interval_seconds: 60,
    server_detection_boundary: "NEXT_PROTECTED_REQUEST_NO_REVOCATION_CACHE",
    in_flight_request_cancellation: false,
    work_shift_ended: false,
    business_drafts_deleted: false,
  };
}
export function installProfileTransport() {
  window.__profileRequests = [];
  window.__profileFaults = [];
  window.__profileDelays = [];
  window.__profileDevicesUnavailable = new URLSearchParams(location.search).has(
    "devicesError",
  );
  window.__profileMfaUnavailable = new URLSearchParams(location.search).has(
    "mfaError",
  );
  window.__profileState = window.__profileSeed
    ? clone(window.__profileSeed)
    : initialState();
  let avatarBlob: Blob | null = null;
  const record = (
    method: string,
    url: string,
    body?: unknown,
    headers?: unknown,
  ) =>
    window.__profileRequests.push({
      method,
      url,
      payload: body === undefined ? undefined : requestBody(body),
      headers: headers as Record<string, unknown> | undefined,
    });
  const fault = (method: string, url: string, committed = false) => {
    const index = window.__profileFaults.findIndex(
      (entry) =>
        entry.method === method &&
        entry.url === url &&
        Boolean(entry.afterCommit) === committed,
    );
    if (index < 0) return;
    const entry = window.__profileFaults.splice(index, 1)[0];
    if (!entry.status)
      throw Object.assign(new Error("Kết nối bị gián đoạn"), {
        isAxiosError: true,
        code: "ERR_NETWORK",
      });
    throw apiError(
      entry.status,
      entry.code ?? "FIXTURE_ERROR",
      "Lỗi kiểm tra cục bộ",
    );
  };
  const version = (headers: unknown, expected: number) => {
    const value = String(
      (headers as Record<string, unknown> | undefined)?.["If-Match"] ?? "",
    );
    if (!value)
      throw apiError(428, "PRECONDITION_REQUIRED", "Thiếu phiên bản dữ liệu");
    if (Number(value) !== expected)
      throw apiError(412, "STALE_VERSION", "Thông tin đã thay đổi ở nơi khác");
  };
  const removeSessions = (ids: string[]) => {
    const state = window.__profileState;
    state.devices = state.devices
      .map((group) => ({
        ...group,
        sessions: group.sessions.filter(
          (entry) => !ids.includes(entry.id) && !ids.includes(entry.session_id),
        ),
      }))
      .filter((group) => group.sessions.length)
      .map((group) => ({ ...group, session_count: group.sessions.length }));
  };
  const updateProfile = (payload: Record<string, unknown>) => {
    if (
      Object.keys(payload).some(
        (key) =>
          !["display_name", "phone", "email", "current_password"].includes(key),
      )
    )
      throw apiError(
        422,
        "PROFILE_FIELD_NOT_EDITABLE",
        "Trường dữ liệu không được sửa",
      );
    const state = window.__profileState;
    if (
      payload.email &&
      payload.email !== state.me.email &&
      payload.current_password !== PROFILE_PASSWORD
    )
      throw apiError(
        422,
        "INVALID_CURRENT_PASSWORD",
        "Mật khẩu hiện tại không đúng",
        { current_password: ["Mật khẩu hiện tại không đúng"] },
      );
    for (const key of ["display_name", "phone", "email"])
      if (key in payload) Object.assign(state.me, { [key]: payload[key] });
    state.me.version += 1;
    return clone(state.me);
  };
  http.get = async (url) => {
    record("GET", url);
    fault("GET", url);
    const state = window.__profileState;
    if (url === "/auth/me") return clone(state.me) as never;
    if (url === "/auth/preferences") return clone(state.preferences) as never;
    if (url === "/auth/mfa/status") {
      if (window.__profileMfaUnavailable)
        throw apiError(503, "FIXTURE_UNAVAILABLE", "Chưa tải được trạng thái");
      return clone(state.mfa) as never;
    }
    throw new Error(`Unexpected profile GET ${url}`);
  };
  http.getPage = async (rawUrl) => {
    const url = new URL(rawUrl, location.origin);
    record("GET", url.pathname);
    fault("GET", url.pathname);
    const state = window.__profileState;
    if (url.pathname === "/warehouses")
      return {
        data: [
          {
            id: "warehouse-main",
            warehouse_id: "warehouse-main",
            warehouse_code: "KHO-TONG-HN",
            warehouse_name: "Kho tổng Hoa Nam",
            name: "Kho tổng Hoa Nam",
            status: "ACTIVE",
          },
        ],
        meta: { total: 1, current_page: 1, per_page: 200, last_page: 1 },
      } as never;
    if (url.pathname === "/auth/devices") {
      if (window.__profileDevicesUnavailable)
        throw apiError(
          503,
          "FIXTURE_UNAVAILABLE",
          "Chưa tải được danh sách thiết bị",
        );
      const sessions = state.devices.flatMap((group) => group.sessions);
      return {
        data: clone(state.devices),
        meta: {
          current_session_id: CURRENT_SESSION_ID,
          active_device_count: state.devices.filter((group) => group.device_id)
            .length,
          unknown_device_group_count: state.devices.filter(
            (group) => !group.device_id,
          ).length,
          active_session_count: sessions.length,
          other_session_count: sessions.filter((entry) => !entry.is_current)
            .length,
          account_session_policy: accountPolicy(!state.multiple),
          device_policy: {
            identity: "CLIENT_INSTALLATION_NOT_PHYSICAL_DEVICE",
            max_devices: null,
            max_sessions_per_device: null,
            limits_configured: false,
          },
          request_receipt_supported: false,
        },
      } as never;
    }
    if (url.pathname === "/audit-logs/me")
      return {
        data: [],
        meta: { total: 0, current_page: 1, per_page: 20, last_page: 1 },
      } as never;
    throw new Error(`Unexpected profile paginated GET ${rawUrl}`);
  };
  http.patch = async (url, body, config) => {
    record("PATCH", url, body, config?.headers);
    fault("PATCH", url);
    const state = window.__profileState;
    const payload = requestBody(body);
    if (url === "/auth/me") {
      version(config?.headers, state.me.version);
      return updateProfile(payload) as never;
    }
    if (url === "/auth/preferences") {
      version(config?.headers, state.preferences.version);
      if (
        (
          payload.notifications as
            Record<string, { in_app?: boolean }> | undefined
        )?.account?.in_app === false
      )
        throw apiError(
          422,
          "ACCOUNT_NOTIFICATION_REQUIRED",
          "Thông báo hoạt động tài khoản trong ứng dụng là bắt buộc",
        );
      const { notifications, ...changes } = payload;
      Object.assign(state.preferences, changes);
      if (notifications)
        for (const [key, value] of Object.entries(
          notifications as Record<string, Record<string, boolean>>,
        ))
          state.preferences.notifications[key] = {
            ...state.preferences.notifications[key],
            ...value,
          };
      state.preferences.version += 1;
      fault("PATCH", url, true);
      return clone(state.preferences) as never;
    }
    throw new Error(`Unexpected profile PATCH ${url}`);
  };
  http.post = async (url, body, config) => {
    record("POST", url, body, config?.headers);
    const delayIndex = window.__profileDelays.findIndex(
      (entry) => entry.method === "POST" && entry.url === url,
    );
    if (delayIndex >= 0) {
      const [delay] = window.__profileDelays.splice(delayIndex, 1);
      await new Promise((resolve) => setTimeout(resolve, delay.milliseconds));
    }
    fault("POST", url);
    const state = window.__profileState;
    const payload = requestBody(body);
    if (url === "/auth/me/avatar") {
      version(config?.headers, state.me.version);
      const form = body as FormData;
      const image = form.get("avatar");
      if (!(image instanceof File) || image.size > 2 * 1024 * 1024)
        throw apiError(422, "BUSINESS_RULE_ERROR", "Ảnh đại diện không hợp lệ");
      const changes = Object.fromEntries(
        [...form.entries()].filter(([key]) => key !== "avatar"),
      );
      updateProfile(changes);
      avatarBlob = image;
      state.me.avatar = {
        mime_type: image.type,
        size: image.size,
        updated_at: "2026-11-04T10:00:00+07:00",
        url: "/api/v1/auth/me/avatar",
      };
      return clone(state.me) as never;
    }
    if (url === "/auth/sessions/revoke-others") {
      const ids = state.devices
        .flatMap((group) => group.sessions)
        .filter((entry) => !entry.is_current)
        .map((entry) => entry.id);
      removeSessions(ids);
      fault("POST", url, true);
      return {
        revoked: true,
        revoked_session_count: ids.length,
        preserved_session_id: CURRENT_SESSION_ID,
        request_receipt_supported: false,
      } as never;
    }
    if (url === "/auth/change-password") {
      if (payload.current_password !== PROFILE_PASSWORD)
        throw apiError(
          422,
          "INVALID_CURRENT_PASSWORD",
          "Mật khẩu hiện tại không đúng",
          { current_password: ["Mật khẩu hiện tại không đúng"] },
        );
      state.devices = [];
      return {
        session_policy: "RELOGIN_ALL_REFRESH_FAMILIES_REVOKED",
        relogin_required: true,
        password_changed_at: "2026-11-04T10:00:00+07:00",
        password_policy_version: "p11-password-v1",
      } as never;
    }
    if (url === "/auth/logout") {
      state.devices = [];
      return {
        scope: "CURRENT_AUTH_SESSION_FAMILY",
        business_drafts_deleted: false,
        work_shift_ended: false,
      } as never;
    }
    if (url === "/auth/mfa/enroll") {
      state.mfa.pending = true;
      return {
        secret: MFA_SECRET,
        otpauth_uri: `otpauth://totp/HoaNam:${encodeURIComponent(String(state.me.email))}?secret=${MFA_SECRET}&issuer=HoaNam`,
        digits: 6,
        period: 30,
      } as never;
    }
    if (url === "/auth/mfa/confirm") {
      if (payload.code !== "123456")
        throw apiError(422, "MFA_INVALID_CODE", "Mã xác thực không đúng");
      state.mfa = {
        ...state.mfa,
        enabled: true,
        pending: false,
        recovery_codes_remaining: 8,
      };
      return { recovery_codes: RECOVERY_CODES } as never;
    }
    if (url === "/auth/mfa/disable") {
      if (state.mfa.enforced && state.mfa.required_for_role)
        throw apiError(
          403,
          "MFA_REQUIRED_FOR_ROLE",
          "Vai trò yêu cầu xác thực hai bước",
        );
      if (
        payload.password !== PROFILE_PASSWORD ||
        (payload.code !== "123456" &&
          !RECOVERY_CODES.includes(String(payload.code)))
      )
        throw apiError(
          422,
          "MFA_INVALID_CODE",
          "Thông tin xác thực không đúng",
        );
      state.mfa = {
        ...state.mfa,
        enabled: false,
        pending: false,
        recovery_codes_remaining: 0,
      };
      return null as never;
    }
    throw new Error(`Unexpected profile POST ${url}`);
  };
  http.delete = async (url, config) => {
    record("DELETE", url, undefined, config?.headers);
    fault("DELETE", url);
    const state = window.__profileState;
    if (url === "/auth/me/avatar") {
      version(config?.headers, state.me.version);
      state.me.avatar = null;
      state.me.version += 1;
      avatarBlob = null;
      return clone(state.me) as never;
    }
    if (url.startsWith("/auth/devices/")) {
      const id = decodeURIComponent(url.split("/").at(-1)!);
      const group = state.devices.find((entry) => entry.device_id === id);
      if (!group)
        throw apiError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy thiết bị");
      if (group.is_current)
        throw apiError(
          409,
          "CURRENT_DEVICE_PROTECTED",
          "Thiết bị hiện tại được giữ lại",
        );
      removeSessions(group.sessions.map((entry) => entry.id));
      fault("DELETE", url, true);
      return {
        device_id: id,
        revoked: true,
        revoked_session_count: group.sessions.length,
        already_revoked: false,
        was_current: false,
        request_receipt_supported: false,
      } as never;
    }
    if (url.startsWith("/auth/sessions/")) {
      const id = decodeURIComponent(url.split("/").at(-1)!);
      const entry = state.devices
        .flatMap((group) => group.sessions)
        .find((item) => item.id === id);
      if (!entry)
        throw apiError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy phiên");
      if (entry.is_current)
        throw apiError(
          409,
          "CURRENT_SESSION_PROTECTED",
          "Phiên hiện tại được giữ lại",
        );
      removeSessions([id]);
      fault("DELETE", url, true);
      return {
        id,
        auth_session_id: entry.auth_session_id,
        session_id: entry.session_id,
        revoked: true,
        already_revoked: false,
        was_current: false,
        revocation_scope: "AUTH_SESSION_FAMILY",
        request_receipt_supported: false,
      } as never;
    }
    throw new Error(`Unexpected profile DELETE ${url}`);
  };
  http.downloadBlob = async (url) => {
    record("GET", url);
    fault("GET", url);
    if (url !== "/auth/me/avatar" || !avatarBlob)
      throw apiError(404, "RESOURCE_NOT_FOUND", "Không có ảnh đại diện");
    return avatarBlob;
  };
  return clone(window.__profileState.me);
}
