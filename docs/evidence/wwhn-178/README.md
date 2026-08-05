# WWHN-178 / WWHN-179 evidence directory

Không commit access token, refresh token, cookie, password hoặc dữ liệu cá nhân vào thư mục này.

## Controlled FE evidence

```bash
SOURCE_SHA="$(git rev-parse HEAD)" \
VITE_APP_ENV="QA" \
VITE_APP_VERSION="<build-id>" \
WWHN_178_EVIDENCE_DIR="test-results/wwhn-178/$(git rev-parse HEAD)" \
npx playwright test e2e/wwhn-178-master-sku-qa2.spec.ts --project=chromium
```

Expected scenarios:

- success/responsive: `1440x900`, `768x1024`, `375x812`
- loading + empty
- API 403 + error code + request ID
- validation + keyboard focus
- item/physical-code/import fail-closed
- route RBAC deny

## Direct backend authorization evidence

Contract-only:

```bash
node scripts/run-wwhn-178-direct-api-rbac.mjs --contract-only
```

Live:

```bash
WWHN_178_API_BASE_URL="https://<qa-api>/api/v1" \
WWHN_178_DENIED_TOKEN="<secret>" \
node scripts/run-wwhn-178-direct-api-rbac.mjs
```

Optional data-scope probe:

```bash
WWHN_178_SCOPE_DENIED_TOKEN="<secret>" \
WWHN_178_SCOPE_DENIED_PATH="/products?warehouse_id=<outside-scope>"
```

The runner writes redacted JSON under `docs/evidence/wwhn-178/generated/<SOURCE_SHA>` unless `WWHN_178_EVIDENCE_DIR` is supplied.

## Independent sign-off boundary

- FE artifacts do not replace WWHN-179 QA2 execution.
- Controlled browser mocks do not prove backend authorization.
- Direct API output does not prove token fixtures unless BE/QA identifies role, permission and scope for the named environment.
- HN-MC-001 and OpenAPI/Postman remain BA/BAS/BE-owned baselines.
