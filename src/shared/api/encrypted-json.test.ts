import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { decryptResponse, responsePublicKey } from "./encrypted-json";

function base64(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
  ).toString("base64");
}

describe("encrypted JSON API response", () => {
  beforeAll(() => vi.stubGlobal("crypto", webcrypto));
  afterAll(() => vi.unstubAllGlobals());

  it("decrypts the PHP-compatible RSA-OAEP/AES-GCM packet and rejects tampering", async () => {
    const spki = Buffer.from(await responsePublicKey(), "base64");
    const publicKey = await webcrypto.subtle.importKey(
      "spki",
      spki,
      { name: "RSA-OAEP", hash: "SHA-1" },
      false,
      ["encrypt"],
    );
    const rawKey = webcrypto.getRandomValues(new Uint8Array(32));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const aesKey = await webcrypto.subtle.importKey(
      "raw",
      rawKey,
      "AES-GCM",
      false,
      ["encrypt"],
    );
    const plaintext = { success: true, data: { name: "Hoa Nam" } };
    const encrypted = new Uint8Array(
      await webcrypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        new TextEncoder().encode(JSON.stringify(plaintext)),
      ),
    );
    const packet = {
      v: 1,
      alg: "RSA-OAEP-SHA1+A256GCM",
      key: base64(
        await webcrypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawKey),
      ),
      iv: base64(iv),
      tag: base64(encrypted.slice(-16)),
      data: base64(encrypted.slice(0, -16)),
    };

    await expect(decryptResponse(packet)).resolves.toEqual(plaintext);
    await expect(
      decryptResponse({ ...packet, tag: base64(new Uint8Array(16)) }),
    ).rejects.toThrow();
  });
});
