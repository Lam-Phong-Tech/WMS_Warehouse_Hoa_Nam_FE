import { describe, expect, it } from "vitest";
import { classifyLoginFailure } from "./login-feedback";

describe("classifyLoginFailure", () => {
  it("maps a 428 response to pow-required, not service-unavailable", () => {
    const feedback = classifyLoginFailure({
      response: {
        status: 428,
        data: {
          error_code: "POW_REQUIRED",
          error: {
            details: {
              challenge: {
                challenge_id: "c1",
                nonce: "00112233",
                difficulty: 16,
                algorithm: "sha256-leading-zero-bits",
                expires_in: 120,
              },
            },
          },
        },
        headers: {},
      },
    });
    expect(feedback.kind).toBe("pow-required");
    expect(feedback.challenge?.challenge_id).toBe("c1");
  });

  it("maps step-up and device verification challenge payloads to their respective kinds", () => {
    expect(
      classifyLoginFailure({
        step_up_required: true,
        step_up_token: "s1",
      }).kind,
    ).toBe("step-up-required");

    expect(
      classifyLoginFailure({
        device_verification_required: true,
        device_token: "d1",
      }).kind,
    ).toBe("device-verification-required");
  });
});
