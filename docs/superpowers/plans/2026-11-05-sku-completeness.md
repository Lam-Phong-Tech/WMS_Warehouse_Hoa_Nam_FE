# SKU Completeness Implementation Plan

> **For agentic workers:** Use executing-plans for inline execution and a final independent code review.

**Goal:** Separate usage status from completeness and return complete paginated results.
**Architecture:** Backend information_status filter before pagination; frontend independent selectors and missing-field indicators. Dashboard uses the same backend predicate for active SKUs.
**Tech Stack:** Laravel, React, TypeScript, PHPUnit, Vitest.
**Spec:** docs/superpowers/specs/2026-11-05-sku-completeness-design.md

## Global Constraints
- Pending means at least one missing brand/category/model; complete means all present.
- Do not change inbound validation or unrelated work in original checkouts.
- Push only these changes to both dev branches, backend first.

## Review Focus
- Partial and fully missing information; inactive pending SKUs.
- Group OR conditions so keyword/type/brand/status remain effective.
- Match Dashboard active pending count and deep link.
- Correct totals beyond 100/500 SKUs and on subsequent pages.
- Filter reset, accessible selectors, light/dark and narrow layouts.

## Task 1: Backend filter and dashboard
- [x] Add failing endpoint tests for completeness matrix, combined filters, pagination and Dashboard.
- [x] Add shared completeness query predicate, validate information_status, expose API documentation.
- [x] Run focused PHPUnit and backend checks.

## Task 2: SKU UI
- [x] Add failing UI tests for independent selectors, missing fields, deep link and reset.
- [x] Send information_status to backend; remove client scan and checkbox; retain server pagination.
- [x] Add badges and responsive filter sizing; verify tests, typecheck, lint and build.

## Task 3: Review and delivery
- [x] Independent review, resolve material findings, run full suites and record limits.
- [x] Commit only scoped changes, fetch/reconcile dev, push backend then frontend and verify remote SHAs.
