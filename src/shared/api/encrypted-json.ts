import type { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import { decodeBase64 as fromBase64 } from "./base64";

type EncryptedBody = {
  v: number;
  alg: string;
  key: string;
  iv: string;
  tag: string;
  data: string;
};

let keyPairPromise: Promise<CryptoKeyPair> | undefined;

function keyPair(): Promise<CryptoKeyPair> {
  if (!globalThis.crypto?.subtle) {
    return Promise.reject(
      new Error("Encrypted API requires Web Crypto and a secure context"),
    );
  }
  keyPairPromise ??= crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-1",
    },
    false,
    ["encrypt", "decrypt"],
  ) as Promise<CryptoKeyPair>;
  return keyPairPromise;
}

function toBase64(value: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(value)));
}

export async function responsePublicKey(): Promise<string> {
  const keys = await keyPair();
  return toBase64(await crypto.subtle.exportKey("spki", keys.publicKey));
}

export async function decryptResponse(body: unknown): Promise<unknown> {
  const packet = body as Partial<EncryptedBody> | null;
  if (
    !packet ||
    packet.v !== 1 ||
    packet.alg !== "RSA-OAEP-SHA1+A256GCM" ||
    !packet.key ||
    !packet.iv ||
    !packet.tag ||
    typeof packet.data !== "string"
  ) {
    throw new Error("Invalid encrypted API response");
  }
  const keys = await keyPair();
  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    keys.privateKey,
    fromBase64(packet.key),
  );
  const aesKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const ciphertext = fromBase64(packet.data);
  const tag = fromBase64(packet.tag);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(packet.iv) },
    aesKey,
    combined,
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function isEncrypted(headers: {
  get?: (key: string) => unknown;
  [key: string]: unknown;
}): boolean {
  return (
    (headers.get?.("x-wms-encrypted") ?? headers["x-wms-encrypted"]) === "v1"
  );
}

async function decodeAxiosResponse(
  response: AxiosResponse,
): Promise<AxiosResponse> {
  if (!isEncrypted(response.headers)) return response;
  const isBlob = response.data instanceof Blob;
  const body = isBlob
    ? JSON.parse(await (response.data as Blob).text())
    : response.data;
  const decoded = await decryptResponse(body);
  response.data = isBlob
    ? new Blob([JSON.stringify(decoded)], { type: "application/json" })
    : decoded;
  return response;
}

/** Install before auth/error handlers so they see the original API contract. */
export function installEncryptedApiJson(client: AxiosInstance): void {
  client.interceptors.request.use(async (config) => {
    config.headers.set("X-WMS-Response-Key", await responsePublicKey());
    return config;
  });
  client.interceptors.response.use(
    decodeAxiosResponse,
    async (error: AxiosError) => {
      if (error.response) await decodeAxiosResponse(error.response);
      return Promise.reject(error);
    },
  );
}
