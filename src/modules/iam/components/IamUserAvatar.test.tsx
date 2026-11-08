import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { http } from "@/shared/api/http";
import { IamUserAvatar } from "./IamUserAvatar";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("IAM user avatar", () => {
  it("shows initials without making an image request when no avatar exists", () => {
    const download = vi.spyOn(http, "downloadBlob");
    renderWithProviders(
      <IamUserAvatar
        user={{ user_id: "one", display_name: "Nguyễn Văn Kho" }}
      />,
    );
    expect(screen.getByText("VK")).toBeInTheDocument();
    expect(download).not.toHaveBeenCalled();
  });
  it("loads the correct user's private photo and falls back when the image fails", async () => {
    const blob = new Blob(["photo"], { type: "image/png" });
    const download = vi.spyOn(http, "downloadBlob").mockResolvedValue(blob);
    const create = vi.fn().mockReturnValue("blob:user-photo"),
      revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const { unmount } = renderWithProviders(
      <IamUserAvatar
        user={{
          user_id: "one",
          display_name: "Nguyễn Văn Kho",
          avatar: {
            url: "/api/v1/users/one/avatar",
            mime_type: "image/png",
            size: 5,
            updated_at: "2026-11-06T00:00:00Z",
          },
        }}
      />,
    );
    await waitFor(() =>
      expect(document.querySelector(".hn-iam-avatar img")).toHaveAttribute(
        "src",
        "blob:user-photo",
      ),
    );
    expect(download).toHaveBeenCalledWith("/users/one/avatar");
    fireEvent.error(document.querySelector(".hn-iam-avatar img")!);
    expect(screen.getByText("VK")).toBeInTheDocument();
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:user-photo");
  });
});
