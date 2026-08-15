# WWHN-224 — FE SKU Import Contract Handoff

Version: 1.0.0  
Target: FE `m1`  
Related: WWHN-224 / WWHN-225 / WWHN-226

## Scope lock

The current WWHN-224 endpoint is **SKU-only**. FE must not infer generic master/item import from the broad WWHN-56 parent title. Any master/item expansion requires the approved mapping/disposition on WWHN-225 before code changes.

## Canonical endpoints

| Purpose | FE constant | Route | Permission |
|---|---|---|---|
| Download SKU template | `SKU_IMPORT_TEMPLATE` | `/skus/import-template` | `sku.manage` |
| Import/dry-run SKU Excel | `SKU_IMPORT_EXCEL` | `/skus/import-excel` | `sku.manage` |
| List import reports | `SKU_IMPORT_REPORTS` | `/skus/import-reports` | `sku.manage` |
| Import report detail | `SKU_IMPORT_REPORT` | `/skus/import-reports/:id` | `sku.manage` |

`/import-batches` is **not** the WWHN-224 SKU import endpoint and must not be used for this flow.

## Response contract

- Valid dry-run: HTTP 200, `dry_run=true`, `committed=false`, `partial_write=false`, non-null `import_report_id`.
- Valid commit: HTTP 200, `committed=true`, `partial_write=false`, non-null `import_report_id`.
- Row validation rejection: HTTP 422 with exact row/code/field/message/value and rejected report ID.
- Missing permission: HTTP 403 / `ACCESS_DENIED`; canonical permission is `sku.manage`.
- Report persistence failure: HTTP 503 / `SKU_IMPORT_REPORT_PERSISTENCE_FAILED`, `committed=false`, `partial_write=false`, `import_report_id=null`, `retryable=true`. FE may offer retry because BE guarantees rollback/no partial write.

## FE verification

`src/shared/api/endpoints.wwhn224.test.ts` locks the endpoint family and prevents regression back to `/import-batches`.

This handoff aligns with the BE focused OpenAPI/Postman artifacts. BA/Data Owner approval for broader mapping remains a governance gate on WWHN-225; QA2 independent runtime reconciliation remains on WWHN-226.
