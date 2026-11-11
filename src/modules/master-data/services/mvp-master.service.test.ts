import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api/http";
import { updateMvpAgency, updateMvpDefect } from "./mvp-master.service";

vi.mock("@/shared/api/http", () => ({
  http: { getPage: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const agency = {
  agency_id: "agency-1",
  agency_code: "AG-HN-001",
  agency_name: "Đại lý Minh Anh",
  status: "ACTIVE",
};

const agencyPayload = {
  agency_code: "AG-HN-001",
  agency_name: "Đại lý Minh Anh",
  status: "ACTIVE" as const,
};

const defect = {
  defect_id: "defect-1",
  defect_code: "DF-MOTOR-01",
  defect_name: "Không chạy motor",
  status: "ACTIVE",
};

const defectPayload = {
  defect_code: "DF-MOTOR-01",
  defect_name: "Không chạy motor",
  status: "ACTIVE" as const,
};

describe("agency/defect transport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("omits If-Match for legacy records whose version is still 0", async () => {
    vi.mocked(http.patch).mockResolvedValue(agency as never);
    await updateMvpAgency("agency-1", agencyPayload, 0);
    expect(http.patch).toHaveBeenCalledWith(
      "/agencies/agency-1",
      agencyPayload,
      undefined,
    );
  });

  it("sends the real version in If-Match when the record has one", async () => {
    vi.mocked(http.patch).mockResolvedValue(agency as never);
    await updateMvpAgency("agency-1", agencyPayload, 3);
    expect(http.patch).toHaveBeenCalledWith(
      "/agencies/agency-1",
      agencyPayload,
      {
        headers: { "If-Match": "3" },
      },
    );
  });

  it("treats a missing version as the optional header, not an error", async () => {
    vi.mocked(http.patch).mockResolvedValue(agency as never);
    await updateMvpAgency("agency-1", agencyPayload, null);
    expect(http.patch).toHaveBeenCalledWith(
      "/agencies/agency-1",
      agencyPayload,
      undefined,
    );
  });

  it("keeps the same legacy-version rule for defect catalogues", async () => {
    vi.mocked(http.patch).mockResolvedValue(defect as never);
    await updateMvpDefect("defect-1", defectPayload, 0);
    expect(http.patch).toHaveBeenCalledWith(
      "/defects/defect-1",
      defectPayload,
      undefined,
    );
  });
});
