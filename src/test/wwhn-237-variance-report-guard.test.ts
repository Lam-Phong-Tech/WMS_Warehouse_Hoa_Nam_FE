import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WWHN-237 / DISP-STK-237 — nửa FE của disposition "Variance query/report DEFERRED".
 *
 * `wwhn-230-stocktake-scope-guard.test.ts` đã khoá route/permission/endpoint/menu.
 * File này khoá thứ 230 không chạm tới và là chỗ lỗi thật của WWHN-237: **hợp đồng
 * FE**. `docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json` từng khai criticalFlow
 * `APPLY_ADJUSTMENT` (permission `stocktake.adjust`, disposition "IMPLEMENTED…") và
 * liệt `STOCKTAKE` trong enum `SCAN_CLASSIFY.context` — hai tuyên bố mà REQ-SRS-037
 * cấm và runtime BE không phục vụ. Không guard nào bắt được vì chúng nằm trong file
 * hợp đồng chứ không nằm trong source runtime.
 *
 * Nửa BE: tests/Feature/Wwhn237VarianceReportDeferredGateTest.php.
 */

/** `variance` trần cố ý KHÔNG nằm đây: variance của reconciliation là hợp lệ. */
const FORBIDDEN_FRAGMENTS = [
  "stocktake",
  "stock-take",
  "apply-adjustment",
  "variance_line",
  "stocktake_variance",
  "discrepancy",
];

/** Enum context đúng theo runtime BE `ScanController@classify`. */
const RUNTIME_SCAN_CONTEXTS = [
  "INBOUND",
  "OUTBOUND",
  "INVENTORY",
  "TRACE",
  "WARRANTY_RECEIVE",
  "WARRANTY_TEMP_ONLY",
];

/** 9 report code MVP theo `OperationalReportController` (§13.10 + Annex C). */
const CANONICAL_REPORT_CODES = [
  "document-history",
  "import-match",
  "inventory-balance",
  "inventory-ledger",
  "inventory-xnt",
  "label-log",
  "movement-trace",
  "outbound-by-agency",
  "warranty-defects",
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as T;
}

function readText(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("WWHN-237 — hợp đồng FE không khai capability variance/kiểm kê", () => {
  it("không còn criticalFlow nào mang bề mặt kiểm kê", () => {
    const baseline = readJson<{
      criticalFlows?: Array<Record<string, unknown>>;
    }>("docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json");
    const flows = baseline.criticalFlows ?? [];
    expect(flows.length).toBeGreaterThan(0);

    for (const flow of flows) {
      const blob = JSON.stringify(flow).toLowerCase();
      for (const fragment of FORBIDDEN_FRAGMENTS) {
        expect(
          blob.includes(fragment),
          `criticalFlow ${String(flow.id)} còn bề mặt [${fragment}]`,
        ).toBe(false);
      }
    }
  });

  it("SCAN_CLASSIFY.context khớp đúng enum runtime và không có STOCKTAKE", () => {
    const baseline = readJson<{
      criticalFlows?: Array<{
        id?: string;
        requestConstraints?: { context?: string[] };
      }>;
    }>("docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json");

    const scan = (baseline.criticalFlows ?? []).find(
      (flow) => flow.id === "SCAN_CLASSIFY",
    );
    expect(scan, "thiếu criticalFlow SCAN_CLASSIFY").toBeDefined();
    expect(scan?.requestConstraints?.context).toEqual(RUNTIME_SCAN_CONTEXTS);
  });

  it("hợp đồng FE ghi rõ khối removedFromMvp để không ai suy diễn lại từ artifact cũ", () => {
    const baseline = readJson<{
      removedFromMvp?: {
        requirement?: string;
        task?: string;
        removedPermissions?: string[];
      };
    }>("docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json");

    expect(baseline.removedFromMvp?.requirement).toBe("REQ-SRS-037");
    expect(baseline.removedFromMvp?.task).toBe("WWHN-237");
    expect(baseline.removedFromMvp?.removedPermissions).toContain(
      "stocktake.adjust",
    );
  });

  it("register governance ghi disposition Option A mà không tuyên bố approval WWHN-25 chưa cấp", () => {
    const governance = readJson<{
      scopeDisposition?: {
        task?: string;
        resolution?: string;
        reintroductionGate?: string;
      };
      decisionRecordGate?: {
        approvedStandaloneDecisionId?: string | null;
        approvedArtifactHash?: string | null;
        status?: string;
      };
    }>("docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json");

    expect(governance.scopeDisposition?.task).toBe("WWHN-237");
    expect(governance.scopeDisposition?.resolution).toBe(
      "OPTION_A_NO_CODE_REMOVAL_CLOSURE",
    );
    expect(governance.scopeDisposition?.reintroductionGate).toContain(
      "WWHN-25",
    );

    const gate = governance.decisionRecordGate ?? {};
    if (gate.approvedStandaloneDecisionId) {
      expect(
        gate.approvedArtifactHash,
        "không được ghi approved Decision ID mà thiếu artifact hash",
      ).toBeTruthy();
    }
  });

  it("trang báo cáo chỉ dùng report code nằm trong registry MVP", () => {
    const source = readText("src/modules/reports/pages/AlignedReportsPage.tsx");
    const declared = [
      ...new Set(
        (source.match(/reportCode:\s*"([a-z-]+)"/gu) ?? []).map(
          (m) => m.split('"')[1],
        ),
      ),
    ];

    expect(declared.length).toBeGreaterThan(0);
    for (const code of declared) {
      expect(CANONICAL_REPORT_CODES, `report code lạ: ${code}`).toContain(code);
    }
    for (const fragment of FORBIDDEN_FRAGMENTS) {
      expect(source.toLowerCase().includes(fragment)).toBe(false);
    }
  });

  it("guard chỉ tồn tại chừng nào REQ-SRS-037 còn phát biểu điều nó enforce", () => {
    const srs = readText("docs/HN_SRS_FRD_v1.12_FULL.md");
    expect(srs).toContain("REQ-SRS-037");
    expect(srs).toContain("Không expose Stocktake/Variance");
    expect(readText("docs/HoaNam_ERD_Moi_Nhat.md")).toMatch(/Variance_Line/u);
  });
});

/**
 * Vòng R2 — `DEV237-P1-02R2`. Lỗi thật: `FE_CLOSURE_IDENTITY.json` và BE
 * `SOURCE_REGISTER.json` đều ghi `git rev-parse HEAD` tại thời điểm chạy, hai repo chạy
 * lệch giờ nên khai **hai cặp SHA khác nhau** — bốn SHA cho một cặp. Nay định danh đọc
 * từ `CANDIDATE_PAIR.json`, và hai bản sao BE/FE phải byte-identical.
 */
describe("WWHN-237 — cặp SHA đóng băng (DEV237-P1-02R2)", () => {
  const PAIR_PATH = "docs/evidence/WWHN-237/CANDIDATE_PAIR.json";

  interface CandidatePair {
    pair: {
      backend: { commit_sha: string; artifact_scope: string[] };
      frontend: { commit_sha: string; artifact_scope: string[] };
    };
    excluded_from_scope: string[];
    branch_supersession: {
      superseded_branch: string;
      canonical_branch: string;
      is_pure_ancestor: boolean;
      m1_be_2_commits_ahead_of_m1: number;
    };
  }

  it("khai đúng một cặp SHA đầy đủ, không phải HEAD trôi", () => {
    const pin = readJson<CandidatePair>(PAIR_PATH);
    expect(pin.pair.backend.commit_sha).toMatch(/^[0-9a-f]{40}$/u);
    expect(pin.pair.frontend.commit_sha).toMatch(/^[0-9a-f]{40}$/u);
  });

  it("scope FE không bị co lại và không trỏ file không tồn tại", () => {
    const pin = readJson<CandidatePair>(PAIR_PATH);
    for (const mandatory of [
      "scripts/verify-wwhn-237-closure.mjs",
      "src/test/wwhn-237-variance-report-guard.test.ts",
    ]) {
      expect(pin.pair.frontend.artifact_scope).toContain(mandatory);
    }
    for (const rel of pin.pair.frontend.artifact_scope) {
      expect(existsSync(join(process.cwd(), rel))).toBe(true);
    }
  });

  it("file pin nằm ngoài tập nó pin — cắt vòng gà-trứng", () => {
    const pin = readJson<CandidatePair>(PAIR_PATH);
    expect(pin.excluded_from_scope).toContain("docs/evidence/WWHN-237/**");
  });

  it("m1-be-2 được chứng minh là ancestor thuần của m1, không phải nguồn thay thế", () => {
    const pin = readJson<CandidatePair>(PAIR_PATH);
    expect(pin.branch_supersession.superseded_branch).toBe("m1-be-2");
    expect(pin.branch_supersession.canonical_branch).toBe("m1");
    expect(pin.branch_supersession.is_pure_ancestor).toBe(true);
    expect(pin.branch_supersession.m1_be_2_commits_ahead_of_m1).toBe(0);
  });

  it("bản sao BE byte-identical — reviewer diff hai repo là ra ngay", () => {
    const beCopy = join(process.cwd(), "../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE", PAIR_PATH);
    if (!existsSync(beCopy)) return;
    expect(readFileSync(beCopy, "utf8")).toBe(readText(PAIR_PATH));
  });

  it("FE_CLOSURE_IDENTITY lấy định danh từ bản pin chứ không từ HEAD", () => {
    const identity = readJson<{
      identity_source?: string;
      fe: { commit_sha: string | null };
      be: { commit_sha: string | null };
    }>("docs/evidence/WWHN-237/FE_CLOSURE_IDENTITY.json");
    const pin = readJson<CandidatePair>(PAIR_PATH);

    expect(identity.identity_source).toContain("CANDIDATE_PAIR.json");
    expect(identity.fe.commit_sha).toBe(pin.pair.frontend.commit_sha);
    expect(identity.be.commit_sha).toBe(pin.pair.backend.commit_sha);
  });
});
