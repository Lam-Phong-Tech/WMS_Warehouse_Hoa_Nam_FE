# WWHN-175 Architecture Disposition

Status: `PROPOSED_FOR_FORMAL_ACCEPTANCE`  
Decision owner: BA + Tech Lead  
Implementation owner: FE1  
Related: WWHN-38, WWHN-175

## Conflict

Jira parent/story uses the phrase **Next.js shell**. The repository and `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` use a client-side React + TypeScript + Vite architecture.

## Proposed decision

Adopt **React/Vite SPA shell** as the authoritative implementation for WWHN-38/WWHN-175.

Rationale:

1. It matches the architecture guide's framework family.
2. The repository already has Vite bootstrap, React Router, provider composition, session bootstrap, RBAC guards, layouts and shared components.
3. Re-platforming to Next.js would be a separate architectural migration, not a defect fix, and would add routing, SSR/hydration, deployment and security risk without an approved business requirement.
4. The acceptance criteria concern shell/session/components/responsive/accessibility/pipeline; none requires SSR, SSG or Next.js-specific capability.

## Exact dependency-version drift

The guide is older than the current lockfile. Current implementation includes newer major versions such as React 19, Vite 8, React Router 7 and Ant Design 6. This disposition does **not** silently ratify every major-version deviation and does not force a risky downgrade during evidence closure.

Required Tech Lead action:

- ratify the current exact version matrix after CI/regression; or
- raise a separate, planned compatibility migration with impact analysis.

## Rejected options

### Silent rewrite to Next.js

Rejected because it changes architecture and deployment model inside an evidence-remediation task.

### Blind dependency downgrade

Rejected because it can introduce broad runtime/regression defects and is not supported by a migration plan.

### Leave Jira and implementation contradictory

Rejected because reviewers cannot determine the authoritative baseline.

## Approval record

Final status must remain `PROPOSED_FOR_FORMAL_ACCEPTANCE` until BA/Tech Lead records approval on Jira. After approval, the Jira parent/story wording should be updated from “Next.js shell” to “React/Vite SPA shell” and include the approved exact dependency matrix or a linked ADR.
