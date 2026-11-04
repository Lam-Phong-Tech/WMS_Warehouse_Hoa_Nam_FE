import { describe, expect, it, vi, afterEach } from "vitest";
import { http } from "@/shared/api/http";
import { profileService } from "./profile.service";
import { profileFixture } from "../pages/profile.fixture";
vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    downloadBlob: vi.fn(),
    getPage: vi.fn(),
  },
}));
afterEach(() => vi.clearAllMocks());
describe("private profile transport", () => {
  it("sends the captured preference version and accepts only canonical server results", async () => {
    const response = { version: 7, theme: "dark" };
    vi.mocked(http.patch).mockResolvedValue(response);
    expect(await profileService.updatePreferences({ theme: "dark" }, 6)).toBe(
      response,
    );
    expect(http.patch).toHaveBeenCalledWith(
      "/auth/preferences",
      { theme: "dark" },
      { headers: { "If-Match": "6" } },
    );
  });
  it("uploads avatar and changed email atomically with the opening profile version", async () => {
    vi.mocked(http.post).mockResolvedValue(profileFixture);
    const file = new File(["photo"], "avatar.jpg", { type: "image/jpeg" });
    await profileService.uploadAvatar(file, 3, {
      display_name: "Name",
      phone: null,
      email: "new@example.test",
      current_password: "private",
    });
    const [path, body, config] = vi.mocked(http.post).mock.calls[0];
    expect(path).toBe("/auth/me/avatar");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("avatar")).toBe(file);
    expect((body as FormData).get("email")).toBe("new@example.test");
    expect(config).toEqual({ headers: { "If-Match": "3" } });
  });
  it("loads the avatar using authenticated binary transport and preserves devices metadata", async () => {
    const blob = new Blob(["photo"], { type: "image/png" });
    vi.mocked(http.downloadBlob).mockResolvedValue(blob);
    expect(await profileService.getAvatar()).toBe(blob);
    expect(http.downloadBlob).toHaveBeenCalledWith("/auth/me/avatar");
    vi.mocked(http.getPage).mockResolvedValue({
      data: [],
      meta: {
        current_session_id: "family",
        device_policy: { limits_configured: false },
      },
    });
    expect(await profileService.getDevices()).toEqual({
      data: [],
      meta: {
        current_session_id: "family",
        device_policy: { limits_configured: false },
      },
    });
  });
});
