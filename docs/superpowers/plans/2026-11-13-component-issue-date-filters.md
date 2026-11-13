# Component issue date filters implementation plan

> **For agentic workers:** Use executing-plans to implement these steps in this session.

**Goal:** Add SKU-style expandable filters with inclusive document-date bounds and move sorting into that panel on WAR-04.

**Architecture:** Send optional `date_from`/`date_to` as YYYY-MM-DD to the component issue list API. Apply validated bounds to `document_date` before SQL pagination; forward the same bounds through every tracking-list request and cache key. Reuse `UiVuexyDateField` and existing translated filter/date labels.

**Tech stack:** React, TanStack Query, Dayjs, shared UI controls, Laravel query builder and PHPUnit.

**Spec:** User screenshot and request in this chat; canonical UI guide section 5 and SKU filter specification.

- [ ] Add focused backend regressions for inclusive/one-sided ranges, pagination/filter intersection and invalid/inverted input. Implement the list filter extension and API parameter docs.
- [ ] Add service/UI regressions; forward bounds in normal/tracking queries, reset paging on changes and clear all bounds on reset.
- [ ] Keep search/status/tracking on the main row, toggle the date/sort panel without discarding active values, and check responsive layout.
- [ ] Run only scoped tests, lint/type checks, preserve existing generated backend artifacts, and commit/push both changed repos to dev.
