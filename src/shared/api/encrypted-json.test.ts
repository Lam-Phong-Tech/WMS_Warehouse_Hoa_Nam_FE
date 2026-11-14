import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.unmock("axios");
import { webcrypto } from "node:crypto";
import { Blob as NodeBlob } from "node:buffer";
import axios, { AxiosError, AxiosHeaders } from "axios";
import {
  decryptResponse,
  installEncryptedApiJson,
  responsePublicKey,
} from "./encrypted-json";

function base64(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
  ).toString("base64");
}

async function encryptPacket(plaintext: unknown) {
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
  const encrypted = new Uint8Array(
    await webcrypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      new TextEncoder().encode(JSON.stringify(plaintext)),
    ),
  );
  return {
    v: 1,
    alg: "RSA-OAEP-SHA1+A256GCM",
    key: base64(
      await webcrypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawKey),
    ),
    iv: base64(iv),
    tag: base64(encrypted.slice(-16)),
    data: base64(encrypted.slice(0, -16)),
  };
}

describe("encrypted JSON API response", () => {
  beforeAll(() => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("Blob", NodeBlob);
  });
  afterAll(() => vi.unstubAllGlobals());

  it("decrypts the PHP-compatible RSA-OAEP/AES-GCM packet and rejects tampering", async () => {
    const plaintext = {
      success: true,
      data: {
        name: "Hoa Nam – Tiếng Việt 中文 🔐",
        rows: Array.from({ length: 12000 }, (_, i) => ({
          sku: `SKU-${i}`,
          quantity: i - 6000,
          price: i / 100,
          min: i % 2 ? null : 0,
          active: i % 3 === 0,
        })),
      },
    };
    const packet = await encryptPacket(plaintext);

    await expect(decryptResponse(packet)).resolves.toEqual(plaintext);
    await expect(
      decryptResponse({ ...packet, tag: base64(new Uint8Array(16)) }),
    ).rejects.toThrow();
    for (const field of ["key", "iv", "tag", "data"] as const) {
      const changed = Buffer.from(packet[field], "base64");
      changed[0] ^= 1;
      await expect(
        decryptResponse({ ...packet, [field]: changed.toString("base64") }),
      ).rejects.toThrow();
      await expect(
        decryptResponse({ ...packet, [field]: "$invalid" }),
      ).rejects.toThrow();
    }
    await expect(decryptResponse({ ...packet, v: 2 })).rejects.toThrow(
      "Invalid encrypted API response",
    );
    await expect(decryptResponse({ ...packet, alg: "none" })).rejects.toThrow(
      "Invalid encrypted API response",
    );
  });

  it.each(["json", "blob", "error"])(
    "preserves the Axios %s response contract",
    async (mode) => {
      const plaintext =
        mode === "error"
          ? {
              success: false,
              error_code: "ACCESS_DENIED",
              message: "Không có quyền",
            }
          : {
              success: true,
              data: {
                quantity: -12.5,
                threshold: 0,
                optional: null,
                name: "Hoa Nam 🔐",
              },
            };
      const packet = await encryptPacket(plaintext);
      const client = axios.create({
        adapter: async (config) => {
          expect(config.headers.get("X-WMS-Response-Key")).toBe(
            await responsePublicKey(),
          );
          const response = {
            data:
              mode === "blob"
                ? new Blob([JSON.stringify(packet)], {
                    type: "application/json",
                  })
                : packet,
            status: mode === "error" ? 403 : 200,
            statusText: mode === "error" ? "Forbidden" : "OK",
            headers: new AxiosHeaders({ "X-WMS-Encrypted": "v1" }),
            config,
          };
          if (mode === "error")
            throw new AxiosError(
              "Forbidden",
              "ERR_BAD_REQUEST",
              config,
              undefined,
              response,
            );
          return response;
        },
      });
      installEncryptedApiJson(client);
      if (mode === "error") {
        await expect(client.get("/test")).rejects.toMatchObject({
          response: { status: 403, data: plaintext },
        });
      } else {
        const response = await client.get("/test");
        expect(
          mode === "blob"
            ? JSON.parse(await response.data.text())
            : response.data,
        ).toEqual(plaintext);
        if (mode === "blob")
          expect(response.data.type).toBe("application/json");
      }
    },
  );
});
