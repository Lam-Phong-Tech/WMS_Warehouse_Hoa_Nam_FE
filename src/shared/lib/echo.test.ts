import { afterEach, expect, it, vi } from "vitest";

const { postMock, getTokenMock, echoOptions } = vi.hoisted(() => ({
  postMock: vi.fn(),
  getTokenMock: vi.fn(() => "dev-access-token"),
  echoOptions: { current: null as null | Record<string, unknown> },
}));

vi.mock("@/shared/config/env", () => ({
  runtimeConfig: {
    reverb: {
      appKey: "dev-public-key",
      host: "khohoanamfe.lptech.info.vn",
      port: 443,
      scheme: "https",
    },
  },
}));
vi.mock("@/shared/api/axios", () => ({ api: { post: postMock } }));
vi.mock("@/shared/lib/memory-storage", () => ({
  memoryStorage: { getToken: getTokenMock },
}));
vi.mock("laravel-echo", () => ({
  default: class {
    constructor(options: Record<string, unknown>) {
      echoOptions.current = options;
    }
    disconnect() {}
  },
}));
vi.mock("pusher-js", () => ({ default: class {} }));

import { connectEcho, disconnectEcho } from "./echo";

afterEach(() => {
  disconnectEcho();
  vi.clearAllMocks();
  echoOptions.current = null;
});

it("passes the API envelope's channel signature to Pusher", async () => {
  postMock.mockResolvedValue({
    data: { success: true, data: { auth: "dev-public-key:signature" } },
  });
  await connectEcho();

  const authorizer = echoOptions.current?.authorizer as (
    channel: { name: string },
  ) => {
    authorize: (
      socketId: string,
      callback: (error: Error | null, result: unknown) => void,
    ) => void;
  };
  const callback = vi.fn();
  authorizer({ name: "private-user.account-1" }).authorize("123.456", callback);

  await vi.waitFor(() => expect(callback).toHaveBeenCalled());
  expect(postMock).toHaveBeenCalledWith("/broadcasting/auth", {
    socket_id: "123.456",
    channel_name: "private-user.account-1",
  });
  expect(callback).toHaveBeenCalledWith(null, {
    auth: "dev-public-key:signature",
  });
});
