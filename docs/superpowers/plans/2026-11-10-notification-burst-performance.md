# Notification Burst Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Keep realtime notifications usable and cheap when dozens of events arrive at once.

**Architecture:** Coalesce socket events in a 400ms frontend buffer, update the unread badge once per batch, invalidate only the notification list once, and replace a toast storm with at most three individual toasts plus one summary. On the backend, batch preference reads, bulk-insert recipients, cache audience resolution for a short TTL, and bound Reverb publish time.

**Tech Stack:** React 19, TanStack Query 5, Sonner 2, Zustand, Vitest; Laravel 13, Redis/Valkey, Reverb, PHPUnit.

**Spec:** This plan implements the P0/P1/P2 performance findings agreed in the session on 2026-11-10. No separate design file exists.

## Global Constraints

- Preserve all unrelated working-tree edits.
- Do not change the default queue name in this pass; realtime must keep working with the currently deployed single worker.
- No browser/OS notifications; only the global Sonner Toaster.
- All user-facing strings go through i18n.
- Keep existing notification API contracts and database schema unchanged.

## Review Focus

- A burst while the tab is hidden must update the badge but not create pending toasts.
- A burst on `/notifications` must not duplicate the list the user is already viewing.
- Duplicate socket events must not inflate the badge or produce duplicate toasts.
- Reconnect after missed events must still reconcile the badge/list from REST.
- Backend fan-out must never create orphan notification rows or skip a recipient when preferences are missing.

---

### Task 1: Frontend burst buffer and summary toast

**Files:**
- Create: `src/modules/notifications/utils/notification-burst.ts`
- Create: `src/modules/notifications/utils/notification-burst.test.ts`
- Modify: `src/modules/notifications/utils/notification-toast.ts`
- Modify: `src/modules/notifications/utils/notification-toast.test.ts`
- Modify: `src/modules/notifications/hooks/useNotificationSocket.ts`
- Modify: `src/shared/store/notification.store.ts`
- Modify: `src/modules/notifications/hooks/useNotifications.ts`
- Modify: `src/modules/notifications/hooks/useNotificationSocket.session-replaced.test.tsx`
- Modify: `src/shared/i18n/messages.ts`, `messages.en.ts`, `messages.zh.ts`

**Interfaces:**
- `createNotificationBurst(onFlush, windowMs?) -> { push, flush, dispose }`
- `takeUndeliveredNotifications(items) -> NotificationItem[]`
- `showNotificationToasts(items) -> void`
- `isNotificationEnabled(item, preferences?) -> boolean`
- `NOTIFICATION_KEYS.list` and `NOTIFICATION_KEYS.unreadCount`

- [ ] **Step 1: Write failing tests** for 50-event coalescing, dedupe, hidden-tab suppression, and at most 3 individual toasts + 1 summary.
- [ ] **Step 2: Run Vitest and confirm the tests fail for missing behavior.**
- [ ] **Step 3: Implement the buffer, toast grouping, `incrementBy`, and list-only invalidation.**
- [ ] **Step 4: Run the focused notification/profile suite and typecheck.**
- [ ] **Step 5: Commit P0.**

### Task 2: Backend fan-out efficiency

**Files:**
- Modify: `Modules/Auth/app/Support/ProfilePreferences.php`
- Modify: `Modules/Notification/app/Services/NotificationService.php`
- Modify: `Modules/Notification/app/Services/NotificationAudienceResolver.php`
- Modify: `Modules/Notification/app/Delivery/NotificationOutbox.php`
- Modify: `config/broadcasting.php`
- Test: `tests/Feature/ProfileNotificationDeliveryTest.php`, `tests/Feature/P13NotificationContractTest.php`

**Interfaces:**
- `ProfilePreferences::readMany(array $userIds): array<string, array>`
- Audience cache key `notification:audience:<sha1(permission|warehouse)>`, TTL 5s.
- Reverb client timeout 2s, connect timeout 1s.

- [ ] **Step 1: Write failing tests** for batched preference reads preserving defaults and for one-query recipient creation/outbox binding lookup.
- [ ] **Step 2: Run PHPUnit and confirm the failures.**
- [ ] **Step 3: Implement readMany, cache audience, bulk recipient insert, outbox binding map, and Reverb timeouts.**
- [ ] **Step 4: Run focused PHPUnit tests.**
- [ ] **Step 5: Commit P1.**

### Task 3: Burst load harness and report

**Files:**
- Create: `docs/qa/notification-burst-2026-11-10.md`

- [ ] **Step 1: Record the measured VPS baseline and the post-change frontend test evidence.**
- [ ] **Step 2: Add a repeatable local test command for 50 events / 50 users.**
- [ ] **Step 3: Document the queue-split activation prerequisite (worker must consume `notifications` before `NOTIFICATION_QUEUE` is changed).**
- [ ] **Step 4: Commit P2 documentation.**
