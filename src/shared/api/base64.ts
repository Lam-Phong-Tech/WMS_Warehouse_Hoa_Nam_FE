/** Decode binary API fields without changing their contents. */
export function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const bytes = Uint8Array as typeof Uint8Array & {
    fromBase64?: (input: string) => Uint8Array<ArrayBuffer>;
  };
  if (typeof bytes.fromBase64 === "function") return bytes.fromBase64(value);

  const binary = atob(value);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
  return result;
}
