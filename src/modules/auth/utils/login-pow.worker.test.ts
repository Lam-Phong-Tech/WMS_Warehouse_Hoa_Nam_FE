import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  countLeadingZeroBits,
  sha256Bytes,
  solvePowChallenge,
} from "./login-pow.worker";

describe("login-pow.worker", () => {
  it("computes SHA-256 identical to Node crypto and finds a valid solution", () => {
    const sample = "0123456789abcdef0123456789abcdef:42";
    const expected = new Uint8Array(createHash("sha256").update(sample).digest());
    expect(sha256Bytes(sample)).toEqual(expected);

    const solution = solvePowChallenge("test-nonce-1234", 8);
    const verified = sha256Bytes(`test-nonce-1234:${solution}`);
    expect(countLeadingZeroBits(verified)).toBeGreaterThanOrEqual(8);
  });
});
