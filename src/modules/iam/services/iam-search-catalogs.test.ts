import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api/http";
import * as service from "./iam.service";

vi.mock("@/shared/api/http", () => ({ http: { getPage: vi.fn() } }));

describe("complete IAM searchable choices", () => {
  beforeEach(() => vi.mocked(http.getPage).mockReset());

  it.each([
    ["getAllIamRoles", "role_id"],
    ["getAllIamDepartments", "department_id"],
  ] as const)(
    "%s includes later pages while preserving active filters",
    async (loader, identity) => {
      vi.mocked(http.getPage).mockImplementation(async (_url, options) => {
        const page = Number(options?.params?.page ?? 1);
        return {
          data: [{ [identity]: `record-${page}` }],
          meta: { current_page: page, last_page: 2, total: 2 },
        } as never;
      });
      expect(await service[loader]({ status: "ACTIVE" })).toEqual({
        data: [{ [identity]: "record-1" }, { [identity]: "record-2" }],
        meta: { total: 2 },
      });
      expect(http.getPage).toHaveBeenLastCalledWith(expect.any(String), {
        params: { status: "ACTIVE", page: 2, per_page: 100 },
      });
    },
  );
});
