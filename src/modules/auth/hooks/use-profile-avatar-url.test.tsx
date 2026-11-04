import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  oldBlob: null as Blob | null,
  newBlob: null as Blob | null,
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[2] === "old" ? state.oldBlob : state.newBlob,
    isSuccess: true,
  }),
}));
import { useProfileAvatarUrl } from "./use-profile-avatar-url";
describe("private avatar object URL ownership", () => {
  it("never renders a prior user's photo while the next cached avatar is being applied", () => {
    state.oldBlob = new Blob(["old"], { type: "image/png" });
    state.newBlob = new Blob(["new"], { type: "image/png" });
    const create = vi.fn((blob: Blob) =>
      blob === state.oldBlob ? "blob:old" : "blob:new",
    );
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const seen: { user: string; url: string }[] = [];
    function View({ user }: { user: string }) {
      const url = useProfileAvatarUrl(user, {
        mime_type: "image/png",
        size: 3,
        updated_at: "1",
        url: "/api/v1/auth/me/avatar",
      });
      seen.push({ user, url });
      return <span>{url}</span>;
    }
    const { rerender, unmount } = render(<View user="old" />);
    rerender(<View user="new" />);
    expect(
      seen
        .filter((item) => item.user === "new")
        .some((item) => item.url === "blob:old"),
    ).toBe(false);
    expect(seen.at(-1)?.url).toBe("blob:new");
    expect(revoke).toHaveBeenCalledWith("blob:old");
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:new");
    vi.unstubAllGlobals();
  });
});
