# DEV219 — Canonical Repository / Branch Provenance

- Date: 2026-08-15
- Jira: WWHN-219 / WWHN-220
- Canonical FE repository: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`
- Canonical FE target branch: `m1`
- FE baseline SHA before DEV219 provenance update: `46996b754eee45a833a3293d739aa61469826aa8`
- Canonical BE repository: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE`
- Canonical BE target branch: `m1`
- BE baseline SHA before DEV219 hardening: `ea30992dbedd0c980aa08dafe173eba93eed24a3`

Any DEV219 evidence that names `Hoa_Nam_Backend/m1` as the implementation source is **superseded**. Reviewers must use the canonical repositories/branches and exact SHAs above (and the final PR/CI SHA recorded in Jira/GitHub evidence after merge).

## Scope disposition

DEV219-P1-02/03/04/05/06 are BE/security/database/operations concerns. No FE runtime behavior is changed merely to create artificial churn.

The FE remains subject to the current architecture baseline: FE authorization is a UX gate only; BE remains the security boundary for RBAC/data-scope enforcement.

Baseline documents reviewed from the current `m1` source:

1. `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html`
2. `docs/HoaNam_ERD_Moi_Nhat.md`
3. `docs/HoaNam_Tai_lieu_tong_hop_Moi_Nhat.md`
4. `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`

This file exists to close FE-side provenance ambiguity without changing product UI/business behavior outside DEV219 scope.
