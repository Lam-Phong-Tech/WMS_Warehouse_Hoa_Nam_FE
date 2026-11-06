# Operational Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh operational Web WMS tables after successful Mini App writes without F5.

**Architecture:** A preference-independent backend broadcast follows committed stock read-cache invalidation. A shell-level frontend subscriber batches refreshes of safe React Query reads, with visible/online catchup and a 30-second fallback; local read snapshots follow refreshed rows while edit snapshots stay intact.

**Tech Stack:** Laravel/Reverb, React 19 Activity, Laravel Echo, TanStack Query, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-operational-realtime.md`

## Global Constraints

- Channel `warehouse-data`; event `.warehouse.data.changed`; payload `{domain: "warehouse"}` only.
- No notification-preference or actor-exclusion dependency; existing API scopes remain authoritative.
- Preserve filters, pages, tabs and drafts. Do not write test records to the live database.
- Keep query refresh authenticated, batched, single-flight and visible/online; exclude unsafe editor hydration queries.

## Review Focus

- A business signal during an older request must still obtain a post-commit response.
- Late callbacks from previous accounts/scopes must not refetch the new account's queries.
- Hidden/offline pages must not generate periodic reads; resumed pages must catch up.
- Cached row snapshots and manually fetched tables must update with query-backed lists.
- Remote refresh must preserve unsaved fields and captured optimistic-lock versions.

## Tasks

### 1. Backend data signal and authorization

- [ ] Add and reproduce tests for independent actor delivery, preferences disabled, commit/rollback, failures and channel permissions.
- [ ] Emit a generic cache-namespace invalidation event, bridge warehouse stock changes to a metadata-only private broadcast and cover putaway create/cancel gaps.
- [ ] Run focused Laravel tests/Pint/PHP syntax checks; include the new database feature test in PostgreSQL CI where appropriate.

### 2. Safe operational query coverage and local tables

- [ ] Add `src/shared/realtime/operational-queries.ts` with `isOperationalReadQueryKey(QueryKey): boolean` and selector/observer tests.
- [ ] Register routed NFC query roots, convert physical-code tables to Query and connect read-only selected rows to refreshed list data.
- [ ] Verify current filters/pages and editable draft/version snapshots remain unchanged.

### 3. Frontend scheduler and authenticated subscriber

- [ ] Test burst coalescing, active/inactive reads, in-flight requests, visibility/network changes and disposal using real Query observers.
- [ ] Add a refresh controller and `useWarehouseRealtime` mounted once in `MainLayout`.
- [ ] Subscribe independently of notifications, reconcile on subscription/reconnect and resume, and run a 30-second foreground fallback.
- [ ] Test owner/scope changes, channel permissions and late callbacks without changing auth-session replacement behavior.

### 4. Integration and deployment

- [ ] Review all changes; run focused regressions, typecheck, lint and browser fixtures representing remote app changes.
- [ ] Push backend first, verify CI/deployment, then push frontend and verify its CI/deployment and public source SHA.
- [ ] Report verified screens and any remaining coverage limits.
