import { afterEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./auth.store";
import { captureAuthOwner } from "./auth-owner";
const token = (sid: string, n: number) =>
  `header.${btoa(JSON.stringify({ sid, exp: n }))}.signature`;
const user = (id: string) => ({
  id,
  user_id: id,
  name: "User",
  email: "user@example.com",
  code: id,
});
afterEach(() =>
  useAuthStore.setState({
    user: null,
    profile: null,
    token: null,
    isAuthenticated: false,
  }),
);
describe("captured asynchronous auth owner", () => {
  it("keeps a completed operation valid after access refresh within the same auth session", () => {
    useAuthStore.setState({
      user: user("u1"),
      profile: null,
      token: token("session-a", 1),
    });
    const current = captureAuthOwner();
    useAuthStore.getState().setToken(token("rotated-refresh-row", 2));
    expect(current()).toBe(true);
  });
  it("rejects responses from a previous login even for the same account", () => {
    useAuthStore.setState({
      user: user("u1"),
      profile: null,
      token: token("session-a", 1),
    });
    const current = captureAuthOwner();
    useAuthStore
      .getState()
      .setAuth({ token: token("session-b", 2), user: user("u1") });
    expect(current()).toBe(false);
  });
  it("rejects another account and sign-out boundaries", () => {
    useAuthStore.setState({
      user: user("u1"),
      profile: null,
      token: "token-a",
    });
    const current = captureAuthOwner();
    useAuthStore.setState({ user: user("u2"), token: "token-b" });
    expect(current()).toBe(false);
    useAuthStore.setState({ user: null, token: null });
    expect(current()).toBe(false);
  });
});
