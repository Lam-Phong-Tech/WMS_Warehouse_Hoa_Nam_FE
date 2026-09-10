/** Type declarations cho pinned-openapi-contract.mjs — dùng bởi test trong src/test. */
export declare const REPO_ROOT: string;
export declare const PIN_RELATIVE_PATH: string;
export declare const HTTP_METHODS: readonly string[];

export declare class PinnedContractError extends Error {
  readonly problems: string[];
  constructor(problems: string[]);
}

export interface OperationIndex {
  source_spec_sha256: string;
  format: string;
  sha256: string;
  operations: string[];
}

export interface BeContractPin {
  be_repo: string;
  be_sha: string;
  spec_path: string;
  spec_sha256: string;
  openapi_version: string;
  openapi_paths: number;
  openapi_operations: number;
  operation_index: OperationIndex;
  [key: string]: unknown;
}

export interface PinnedContract {
  pin: BeContractPin;
  operations: string[];
  operationSet: Set<string>;
  paths: Set<string>;
}

export declare function sha256Hex(data: string | Uint8Array): string;
export declare function compareOperations(a: string, b: string): number;
export declare function deriveOperationIndex(spec: unknown): string[];
export declare function operationIndexDigest(operations: readonly string[]): string;
export declare function buildOperationIndex(
  specSha256: string,
  operations: string[],
): OperationIndex;
export declare function validatePin(pin: unknown): string[];
export declare function loadPinnedContract(root?: string): PinnedContract;
