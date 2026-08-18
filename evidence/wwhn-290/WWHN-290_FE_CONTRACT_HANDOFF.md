# WWHN-290 — FE contract handoff

- Date: 2026-08-18 (revision 2 — resolves the FE revision contradiction flagged by the 66/100 review)
- Jira: `WWHN-290` — `[BE] Khắc phục lỗi dữ liệu/báo cáo/tính năng` (parent `WWHN-77`)
- Branch: `m1` only, on both repositories
- Authoritative pins: BE repo `docs/evidence/wwhn-290/WWHN-290_PINS.json`. This document quotes them, it does not invent them.

| Pin | Value |
|---|---|
| BE canonical repo / branch | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE` @ `m1` |
| BE candidate SHA (change-range final) | `f8942321f2a673137eb9e16c9fc86d013140f84a` |
| FE repo / branch | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` @ `m1` — **consumer evidence only** |
| FE consumer revision reviewed | `3ddce525e2e3b3af29723d1ec97e3fc9eff175b3` |
| BE OpenAPI target | `openapi 3.0.0` / `info.version` **`2.0.0`** |
| API namespace | `/api/v1` |

## 1. Correction carried by this revision

Revision 1 of this handoff quoted FE revision `6ffab3a7…` while the BE closure register quoted `9076cbd…`.
Two documents describing the same handoff named **two different FE revisions**, which is exactly the kind of
hand-copied pin drift the review penalised.

Both are superseded here by a single FE consumer revision, recorded once in the BE `WWHN-290_PINS.json` and
quoted identically by every artifact. The BE guard test `Wwhn290ClosureEvidenceTest` fails the build if any
document drifts from that single source again.

## 2. Disposition

WWHN-290 is a BE2 data/report/warranty remediation task whose defect-input gate was dispositioned
`NO CODE CHANGE / N/A` by BA/QA on the ticket: no concrete UAT defect with defect ID, repro and request-id/log
was ever assigned to it.

- Breaking payload / endpoint / enum change requiring FE adaptation: **NONE**.
- FE runtime change justified by WWHN-290: **NONE**. A speculative FE change would be unattributable work.
- API base stays `/api/v1`; there is no migration to the older `m1-be-2` `1.0.0` contract. `m1-be-2` is a strict
  ancestor of `m1`, so its `1.0.0` is a previous revision of the same contract, not a competing one.

## 3. Contract version, not blob, is what FE pins

The BE contract file is regenerated on the shared `m1` branch by other tickets (for example `WWHN-328` adding
dashboard data-scope fields), so its blob SHA moves several times a day while `info.version` stays `2.0.0`.

FE therefore pins the **approved target version `2.0.0` on `/api/v1`**, and treats a change of `info.version`
— not a change of blob hash — as the signal that a consumer review is required. If `info.version` ever moves,
FE re-verifies before consuming.

## 4. FE1 verification gate — status

FE1 has confirmed on the ticket, against the revisions above:

1. API base remains `/api/v1`; no consumer migration to an older `m1-be-2` contract is required.
2. Report and warranty screens need no payload/enum adaptation for the WWHN-290 candidate.
3. Any real contract mismatch found later must be logged as a concrete defect — endpoint, expected/actual,
   repro, evidence — before any FE code is changed.

Status: **FE1 CONSUMER COMPATIBILITY CONFIRMED** on the ticket for the pins above. This file remains a handoff
record; the authoritative signature is the FE1 comment on WWHN-290.

## 5. Reverification trigger

This handoff is void and FE1 must re-review if any of these change: `info.version` moves off `2.0.0`, the API
namespace moves off `/api/v1`, or a real defect attached to WWHN-290 introduces a contract delta.
