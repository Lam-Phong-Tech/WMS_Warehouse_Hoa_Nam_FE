# WWHN-177 DevOps Build / DEV Delivery Handoff

Status: `PIPELINE_READY_FOR_DEVOPS_ACCEPTANCE`

## Pipeline controls

1. Quality gates run before delivery.
2. Production bundle is generated with immutable build manifest.
3. `wwhn-177:handoff` validates:
   - `dist/index.html`
   - `dist/health.json`
   - `dist/build-manifest.json`
4. SHA-256 is recorded for each required artifact.
5. CI uploads `wms-fe-closure-evidence-<SOURCE_SHA>`.
6. On push to `m1`, job `DEV delivery evidence` runs under GitHub Environment `DEV`.
7. The job publishes `wwhn-177-dev-environment-evidence-<SOURCE_SHA>`.

## Deployment-mode truth table

| Mode | Meaning | May DevOps mark live DEV deployed? |
| --- | --- | --- |
| `TARGET_CONFIGURED` | `DEV_APP_URL` exists and DevOps confirms target/runtime health | Yes, after smoke/health evidence |
| `NOT_CONFIGURED_ARTIFACT_ONLY` | Build and immutable delivery artifact exist, but no live target is configured | No |

## Required DevOps acceptance

DevOps must comment WWHN-177 with:

- exact source SHA and workflow run;
- build and DEV delivery artifact names;
- `DEV_APP_URL` or explicit approval of artifact-only mode;
- deployment timestamp;
- runtime health/smoke result if live target exists;
- rollback reference;
- PASS/FAIL.

This handoff does not invent credentials, target URLs or live deployment evidence.
