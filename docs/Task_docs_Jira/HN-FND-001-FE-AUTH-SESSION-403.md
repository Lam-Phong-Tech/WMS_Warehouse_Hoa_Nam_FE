# HN-FND-001 — FE auth/session/403 compatibility evidence pointer

Nguồn canonical:

- `docs/Task_docs_Jira/WWHN-165.md`
- `docs/evidence/wwhn-165/QA1_SECURITY_RBAC_AUDIT_MATRIX.md`
- `docs/evidence/wwhn-165/QA2_UI_ROLE_NAVIGATION_MATRIX.md`
- `docs/evidence/wwhn-156/WWHN-156_CLOSURE_REGISTER.json`

## Security boundary

FE route guard và action visibility chỉ là UX control. **Backend authorization** mới là security authority và phải trả **403** cho direct API request không đủ quyền hoặc ngoài data scope.

Permission catalog cần được BE/RBAC owner phê duyệt và QA xác minh độc lập. FE không suy diễn quyền từ role name và không coi UI disabled/redirect là bằng chứng authorization backend.

## Independent evidence required

- Direct API 403 với token/role fixture được định danh.
- Permission deny và data-scope deny trên exact backend build/environment.
- Error code, request ID và audit trace.
- QA pass/fail độc lập; không dùng controlled browser mock thay cho bằng chứng BE2/BE/RBAC.
