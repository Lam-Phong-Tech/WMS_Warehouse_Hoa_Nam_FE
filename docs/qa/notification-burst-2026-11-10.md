# Notification Burst Baseline — 2026-11-10

## Environment

- VPS: 4 vCPU, 15.6 GB RAM; DEV and production blue/green stacks share the host.
- DEV stack: Laravel 13, PostgreSQL 16, Valkey, Redis queue, one Reverb container.
- Queue worker: one `queue:work --tries=3 --timeout=90 --memory=768` process.
- Reverb: single instance, scaling disabled.

## Live data at measurement time

| Metric | Value |
|---|---:|
| Accounts | 83 (74 ACTIVE) |
| Notifications | 1,016 |
| Notification recipients | 42,892 |
| Unread recipients | 41,308 |
| Average fan-out | ~42 recipients/notification |
| Max fan-out | 55 recipients/notification |
| Queue pending / failed | 0 / 0 |
| Active FCM bindings | 2 |

## Microbenchmarks on DEV

| Operation | Observed |
|---|---:|
| Reverb publish, 50 events | 90–180 ms |
| `notify()` to 50 recipients | ~155 ms |
| `notify()` to 74 recipients | ~167 ms |
| 50 audience resolutions | ~2,327 ms (~46 ms each) |
| 50 single-recipient notifications | ~1,205 ms (~16 ms each) |
| Unread-count SQL for 941 unread rows | ~1.5 ms |

## Derived serial estimates (one queue worker)

- One event to 50 recipients: ~350 ms.
- 50 events to 50 distinct users: ~3.2 s.
- 50 events, each to 50 recipients: ~15–18 s.

## Frontend amplification measured in isolation

A React Query observer on `["notifications", "unread-count"]` refetched exactly
50 times for 50 synchronous invalidations of `["notifications"]`. The same
result held when invalidations were staggered by 2 ms and 20 ms.

## Current gaps

- Every socket event creates a toast, increments the badge, and invalidates the
  notification root key.
- `["notifications"]` also matches `["notifications", "unread-count"]`, so each
  event triggers an unread-count HTTP request.
- Sonner displays at most four toasts but still mounts and times every toast.
- Hidden tabs still fetch; multiple tabs multiply the traffic.
- The single default queue also runs report exports, so notifications can wait
  behind a long job.

## Repeatable command

```bash
cd WMS_Warehouse_Hoa_Nam_FE
pnpm exec vitest run \
  src/modules/notifications/utils/notification-burst.test.ts \
  src/modules/notifications/utils/notification-toast.test.ts \
  src/modules/notifications/hooks/useNotificationSocket.session-replaced.test.tsx \
  --maxWorkers=1
```

## P0 result (implemented)

- A realtime burst is buffered for 400 ms and flushed once.
- 50 socket events produce one `incrementBy(50)` and one list invalidation; the
  unread-count query is no longer invalidated per event.
- At most three individual toasts are shown; the remainder becomes one summary
  toast.
- Hidden tabs update the badge and mark the list stale, but do not create
  toasts; visibility return reconciles list and badge once.
- Focused frontend suite: 37 tests passed, including the 50-event hook test.

## P1 backend result (implemented, queue split gated)

- `ProfilePreferences::readMany()` reads all recipient preferences in one query.
- Notification recipient fan-out uses one bulk insert instead of N inserts.
- Audience lookup is cached for 5 seconds per permission/warehouse.
- FCM outbox binding lookup is one grouped query instead of one per recipient.
- Notifications for one event now broadcast to up to 100 private channels in one
  Reverb/Pusher HTTP publish; >100 recipients are chunked. This removes the
  2,500-publish case for 50 notifications × 50 recipients.
- Exact duplicate payloads for the same event/subject/audience/title/body are
  coalesced for 30 seconds via cache (`NOTIFICATION_COALESCE_SECONDS`).
- Optional in-app delivery is capped per user/minute
  (`NOTIFICATION_MAX_IN_APP_PER_MINUTE`, default 60); account/security events bypass
  the cap.
- Reverb HTTP publish is bounded to 2s (connect 1s) so a slow socket server cannot
  hold a queue worker for the framework default timeout.
- `notifications:monitor` emits queue depth, recent notification/recipient counts,
  failed-job count and pending delivery count as JSON; it logs a warning when the
  queue or failed-job threshold is crossed and is scheduled every minute.
- One browser tab is elected leader with `navigator.locks`; it owns the single Echo
  connection and relays notification batches to other tabs over `BroadcastChannel`.
  If leader election is unsupported, the old per-tab connection remains as fallback.
- DEV VPS queue container runs two isolated processes: one consumes only
  `notifications`, one consumes only `default`; a long export cannot block
  notification delivery. `NOTIFICATION_QUEUE=notifications` routes listeners to the
  dedicated process.
- Live probe on the deployed backend: one event to 50 private channels took 75.9ms;
  50 separate single-channel events took 108.4ms. The former is one HTTP publish
  instead of 50.
- Deployed DEV SHAs: frontend `753b6b18`, backend `9b1cc40c`.
- `NotificationFcmTransportTest` still cannot run in this checkout because the
  optional `Google\Auth\Credentials\ServiceAccountCredentials` class is absent;
  this is an existing dependency issue, not caused by the burst changes.

## Queue-split activation prerequisite

Do not point listeners at a dedicated `notifications` queue until a worker is
running `php artisan queue:work --queue=notifications` in the deployed stack.
Changing the queue name without the consumer makes realtime notifications queue
forever while REST history remains available.
