import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeBase64 } from "./base64";

const legacy = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const ctor = Uint8Array as typeof Uint8Array & {
  fromBase64?: (value: string) => Uint8Array<ArrayBuffer>;
};
const original = Object.getOwnPropertyDescriptor(Uint8Array, "fromBase64");
afterEach(() => {
  if (original) Object.defineProperty(Uint8Array, "fromBase64", original);
  else delete ctor.fromBase64;
  vi.restoreAllMocks();
});

describe("Base64 bytes", () => {
  it("uses the native decoder when available", () => {
    const native = vi.fn(legacy);
    Object.defineProperty(Uint8Array, "fromBase64", {
      configurable: true,
      value: native,
    });
    expect(decodeBase64("AAH+/w==")).toEqual(new Uint8Array([0, 1, 254, 255]));
    expect(native).toHaveBeenCalledWith("AAH+/w==");
  });

  it("fallback keeps every byte in a large payload without per-character iterator callbacks", () => {
    Object.defineProperty(Uint8Array, "fromBase64", {
      configurable: true,
      value: undefined,
    });
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 1);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    const expected = new Uint8Array(bytes);
    const iterator = vi.spyOn(Uint8Array, "from");
    const decoded = decodeBase64(bytes.toString("base64"));
    expect(iterator.mock.calls.length).toBe(0);
    expect(Buffer.compare(Buffer.from(decoded), Buffer.from(expected))).toBe(0);
    expect(decoded.buffer).toBeInstanceOf(ArrayBuffer);
  });

  it.each([
    "",
    "Zg",
    "Zg==",
    "Zm8",
    "Zm8=",
    "Zm9v",
    "Z h ==",
    "\tZg==\r\n",
    "Zh==",
  ])("preserves accepted legacy input %j", (value) => {
    Object.defineProperty(Uint8Array, "fromBase64", {
      configurable: true,
      value: undefined,
    });
    expect(decodeBase64(value)).toEqual(legacy(value));
  });

  it.each([
    "A",
    "A===",
    "AA=",
    "AA===",
    "AA==x",
    "=AAA",
    "Zg-_",
    "Zg\u000b==",
    "🔥",
    "AA$A",
  ])("rejects malformed legacy input %j", (value) => {
    Object.defineProperty(Uint8Array, "fromBase64", {
      configurable: true,
      value: undefined,
    });
    expect(() => legacy(value)).toThrow();
    expect(() => decodeBase64(value)).toThrow();
  });
});
