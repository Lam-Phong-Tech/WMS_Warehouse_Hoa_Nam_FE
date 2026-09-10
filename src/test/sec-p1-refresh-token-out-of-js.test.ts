import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, refreshSession } from "@/shared/api/axios";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { memoryStorage } from "@/shared/lib/memory-storage";
import { useAuthStore } from "@/shared/store/auth.store";
import { authService } from "@/modules/auth/services/auth.service";

// src/test/setup.ts mock toàn cục module `axios` bằng instance giả có post/get trả
// undefined. File này cần ĐƯỜNG ĐI THẬT của request — axios thật, interceptor thật,
// chỉ tầng mạng được thay bằng adapter — nên bỏ mock đó cho riêng file này.
vi.unmock("axios");

/**
 * P1 bảo mật 10/09/2026 — refresh token KHÔNG được tồn tại trong JavaScript.
 *
 * Trước đây FE nhận refresh token (14 ngày) trong JSON của login/refresh/MFA verify,
 * giữ nó trong `memoryStorage` và gửi lại trong body `/auth/refresh` — XSS đọc được
 * biến đó. Nay BE chỉ đặt nó trong cookie HttpOnly. Bộ test này khoá hai phía của FE:
 *  1. quét tĩnh `src/`: không còn API, biến hay trường nào lưu/gửi refresh token;
 *  2. chạy thật qua axios (adapter giả lập mạng): kể cả BE cũ còn trả refresh token
 *     trong JSON, giá trị đó không lọt vào kết quả, store, storage hay cookie đọc được
 *     bằng JS, và request refresh/logout không mang nó.
 */

const SRC_ROOT = join(process.cwd(), "src");
const LEAK = "LEAK-refresh-token-must-never-reach-javascript";

const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: "hàm lưu/đọc refresh token", pattern: /\b(?:set|get|remove|clear)RefreshToken\b/ },
  { label: "biến refreshToken", pattern: /\brefreshToken\b/ },
  { label: "trường refresh_token trong object/kiểu", pattern: /\brefresh_token\b\s*\??\s*:/ },
  { label: "gửi refresh_token trong body", pattern: /\{\s*refresh_token\b/ },
];

/**
 * Chỉ nhãn hiển thị cho `object_type = refresh_token` của Nhật ký hệ thống — là
 * chữ tiếng Việt/Anh, không phải giá trị token.
 */
const ALLOWED: Record<string, RegExp[]> = {
  "src/modules/audit-logs/constants/audit-log-labels.ts": [/\brefresh_token\b\s*\??\s*:/],
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "test" || entry === "__preview__" ? [] : sourceFiles(full);
    }
    const isSource = /\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry);
    return isSource ? [full] : [];
  });
}

const LOGIN_USER = {
  user_id: "user-p1",
  username: "p1",
  email: "p1@example.com",
  display_name: "P1",
  roles: [],
  permissions: ["inventory.view"],
  warehouse_scope_ids: [],
};

describe("P1 — refresh token không tồn tại trong JavaScript", () => {
  describe("quét tĩnh src/", () => {
    it("không file nguồn nào lưu, đọc hay gửi refresh token", () => {
      const offenders: string[] = [];

      for (const file of sourceFiles(SRC_ROOT)) {
        const rel = relative(process.cwd(), file).split(sep).join("/");
        const content = readFileSync(file, "utf8");

        for (const { label, pattern } of FORBIDDEN) {
          if (!pattern.test(content)) continue;
          const allowed = (ALLOWED[rel] ?? []).some((allow) => allow.source === pattern.source);
          if (!allowed) offenders.push(`${rel}: ${label}`);
        }
      }

      expect(offenders).toEqual([]);
    });

    it("memoryStorage chỉ còn API cho access token", () => {
      expect(Object.keys(memoryStorage).sort()).toEqual(
        ["clear", "getItem", "getToken", "removeItem", "setItem"].sort(),
      );
    });
  });

  describe("luồng chạy thật qua axios", () => {
    let mock: MockAdapter;

    beforeEach(() => {
      mock = new MockAdapter(api);
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    afterEach(() => {
      mock.restore();
      useAuthStore.getState().logout();
      vi.unstubAllGlobals();
    });

    function expectNoLeakAnywhere(...values: unknown[]) {
      for (const value of values) {
        expect(JSON.stringify(value ?? null)).not.toContain(LEAK);
      }
      expect(JSON.stringify(useAuthStore.getState())).not.toContain(LEAK);
      expect(memoryStorage.getToken() ?? "").not.toContain(LEAK);
      expect(document.cookie).not.toContain(LEAK);
      expect(JSON.stringify({ ...window.localStorage })).not.toContain(LEAK);
      expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(LEAK);
    }

    it("login: refresh token BE cũ còn trả trong JSON không vào kết quả, store hay storage", async () => {
      mock.onPost(API_ENDPOINTS.LOGIN).reply(200, {
        success: true,
        data: {
          access_token: "access-p1",
          refresh_token: LEAK,
          token_type: "bearer",
          expires_in: 3600,
          user: LOGIN_USER,
        },
      });

      const result = await authService.login({ email: "p1@example.com", password: "<irrelevant>" });
      if (result.kind !== "authenticated") throw new Error("expected authenticated login");

      useAuthStore.getState().setAuth({
        token: result.access_token,
        user: result.user,
        contexts: result.available_contexts,
      });

      expect(result).not.toHaveProperty("refresh_token");
      expectNoLeakAnywhere(result);
    });

    it("MFA verify: cùng bất biến với login", async () => {
      mock.onPost(API_ENDPOINTS.MFA_VERIFY).reply(200, {
        success: true,
        data: {
          access_token: "access-mfa",
          refresh_token: LEAK,
          token_type: "bearer",
          expires_in: 3600,
          user: LOGIN_USER,
        },
      });

      const result = await authService.verifyMfa("challenge", "123456");

      expect(result).not.toHaveProperty("refresh_token");
      expectNoLeakAnywhere(result);
    });

    it("refresh: body không mang refresh token, gửi kèm credentials, và bỏ token BE cũ trả về", async () => {
      let sent: { data?: unknown; withCredentials?: boolean } | undefined;
      mock.onPost(API_ENDPOINTS.REFRESH).reply((config) => {
        sent = config;
        return [
          200,
          {
            success: true,
            data: { access_token: "access-next", refresh_token: LEAK, token_type: "bearer", expires_in: 3600 },
          },
        ];
      });

      const result = await authService.refresh();

      expect(sent?.withCredentials).toBe(true);
      expect(String(sent?.data ?? "")).not.toContain("refresh_token");
      expect(result).not.toHaveProperty("refresh_token");
      expect(result.access_token).toBe("access-next");
      expectNoLeakAnywhere(result);
    });

    it("interceptor 401: làm mới bằng cookie rồi thử lại, không gửi refresh token", async () => {
      const refreshBodies: string[] = [];
      mock.onPost(API_ENDPOINTS.REFRESH).reply((config) => {
        refreshBodies.push(String(config.data ?? ""));
        return [200, { success: true, data: { access_token: "access-retry", token_type: "bearer", expires_in: 900 } }];
      });
      mock.onGet("/p1-protected").replyOnce(401).onGet("/p1-protected").reply(200, { success: true, data: "ok" });

      const response = await api.get("/p1-protected");

      expect(response.status).toBe(200);
      expect(refreshBodies).toHaveLength(1);
      expect(refreshBodies[0]).not.toContain("refresh_token");
      expect(memoryStorage.getToken()).toBe("access-retry");
    });

    it("logout: body rỗng, gửi kèm credentials để BE đọc cookie", async () => {
      let sent: { data?: unknown; withCredentials?: boolean } | undefined;
      mock.onPost(API_ENDPOINTS.LOGOUT).reply((config) => {
        sent = config;
        return [200, { success: true, data: null }];
      });

      await authService.logout();

      expect(sent?.withCredentials).toBe(true);
      expect(String(sent?.data ?? "")).not.toContain("refresh_token");
    });

    it("refresh xếp hàng giữa các tab bằng Web Locks khi trình duyệt hỗ trợ", async () => {
      const request = vi.fn((_name: string, _options: LockOptions, callback: () => Promise<unknown>) =>
        callback(),
      );
      // Gắn `locks` lên navigator THẬT của jsdom. Thay cả object bằng bản spread sẽ làm mất
      // các getter nằm trên prototype (như `onLine`), và axios.ts coi như đang ngoại tuyến.
      Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
      mock.onPost(API_ENDPOINTS.REFRESH).reply(200, {
        success: true,
        data: { access_token: "access-locked", token_type: "bearer", expires_in: 900 },
      });

      try {
        const payload = await refreshSession();

        expect(payload.access_token).toBe("access-locked");
        expect(request).toHaveBeenCalledTimes(1);
        expect(request.mock.calls[0]?.[0]).toBe("wms-auth-refresh");
        expect(request.mock.calls[0]?.[1]).toEqual({ mode: "exclusive" });
      } finally {
        Reflect.deleteProperty(navigator, "locks");
      }
    });
  });
});
