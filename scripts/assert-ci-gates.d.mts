/** Type declarations cho assert-ci-gates.mjs — dùng bởi src/test/ci-hard-gates.test.ts. */
export declare const REQUIRED_GATE_JOBS: readonly string[];
export declare function evaluateGateJobs(
  needs: unknown,
  required?: readonly string[],
): string[];
