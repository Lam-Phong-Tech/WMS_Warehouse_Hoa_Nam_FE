import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { useAuthStore } from "@/shared/store/auth.store";
import { useInterfacePreferenceShortcut } from "./use-interface-preference-shortcut";
import { profileService } from "../services/profile.service";
import type { ProfilePreferences } from "../types/profile.types";

vi.mock("../services/profile.service", () => ({
  profileService: { getPreferences: vi.fn(), updatePreferences: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const user = (id: string) => ({
  id,
  user_id: id,
  name: id,
  email: `${id}@example.com`,
  code: id,
});
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().setAuth({ token: "token-a", user: user("a") });
});

it("never sends a preference PATCH under a new account after an old account GET finishes", async () => {
  let resolvePreferences!: (preferences: ProfilePreferences) => void;
  vi.mocked(profileService.getPreferences).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolvePreferences = resolve;
      }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useInterfacePreferenceShortcut(), {
    wrapper,
  });
  act(() => result.current.mutate({ locale: "en" }));
  await waitFor(() =>
    expect(profileService.getPreferences).toHaveBeenCalledOnce(),
  );
  act(() =>
    useAuthStore.getState().setAuth({ token: "token-b", user: user("b") }),
  );
  await act(async () => {
    resolvePreferences({ version: 1 } as ProfilePreferences);
  });
  await waitFor(() => expect(result.current.isPending).toBe(false));
  expect(profileService.updatePreferences).not.toHaveBeenCalled();
  client.clear();
});
