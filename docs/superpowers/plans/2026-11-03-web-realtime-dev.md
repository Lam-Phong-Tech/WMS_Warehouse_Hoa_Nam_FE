# DEV Web Realtime Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show existing business notifications in the DEV web bell as they occur.

**Architecture:** Laravel's queued notification listeners keep writing notification rows, then broadcast `notification.created` through Reverb. The web connects to a same-origin WSS route through host Nginx. A repository variable supplies the public key to the tested FE build; the server secret remains in the VPS environment.

**Tech Stack:** Laravel Reverb, Redis queue, Nginx, React, Laravel Echo, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-03-web-realtime-dev.md`

## Global Constraints

- Keep the current notification event scope and recipient rules.
- Preserve the user's unrelated working-tree edits.
- Do not expose the Reverb secret or a public unencrypted WebSocket port.
- Back up VPS configuration before updating it.

## Review Focus

- Reverb must remain up after its 60-second maintenance tick.
- TLS proxy must return a WebSocket `101` handshake on the FE domain.
- A user cannot subscribe to another user's private channel.
- Reconnect must recover missed notification counts from REST.
- A failed broadcast must leave the persisted notification accessible.

---

### Task 1: Reverb and TLS proxy on DEV VPS

**Files:** VPS `/opt/wms-hoanam/shared/app.env`, `/opt/wms-hoanam/compose.json`, `/etc/nginx/sites-available/khohoanamfe.lptech.info.vn`.

**Interfaces:** Provides `wss://khohoanamfe.lptech.info.vn/app/{publicKey}` to the FE; backend and queue use the same Reverb credentials.

- [ ] Record failing baseline: broadcaster is `log`, Reverb app ID/key empty, restart count grows, and FE `/app` does not upgrade.
- [ ] Back up the three configuration files with owner-only access.
- [ ] Configure Reverb credentials and `BROADCAST_CONNECTION=reverb`; bind Reverb to a localhost Docker port; proxy `/app/` with Upgrade and Connection headers.
- [ ] Run `nginx -t`, recreate the affected containers, and verify configuration and restart count after 70 seconds.
- [ ] Verify an unauthenticated WebSocket handshake reaches Reverb and private-channel auth remains JWT protected.

### Task 2: Deployable FE build configuration

**Files:** `.github/workflows/dev-ci-deploy.yml`, `docs/superpowers/specs/2026-11-03-web-realtime-dev.md`.

**Interfaces:** Consumes repository variable `DEV_REVERB_APP_KEY`, FE origin host, TLS port 443, and HTTPS scheme.

- [ ] Demonstrate that the current workflow supplies an empty Reverb key.
- [ ] Set the public repository variable and update the build workflow to require it and build for the WSS endpoint.
- [ ] Validate the workflow and build output; commit only the files in the isolated worktree.
- [ ] Push the tested change to `dev`, wait for CI deployment, and verify the served asset contains the configured public key.

### Task 3: End-to-end notification

**Files:** No application behavior changes unless the live check reveals a separate defect.

**Interfaces:** The existing `notification.created` private-channel payload and `GET /api/v1/notifications` history.

- [ ] Subscribe with a DEV test user and validate JWT channel authorization.
- [ ] Trigger an existing business notification with a safe test action and confirm the web socket receives it, the bell count updates, and the REST history contains the same ID.
- [ ] Check that Reverb and queue remain healthy, record evidence, and remove temporary probes.
