# Realtime notifications on the DEV web UI

The existing business notifications should appear in the WMS web bell without refreshing the page. The existing notification audience, event keys, and REST history remain authoritative. This change does not introduce notifications for every Mini App write API.

The DEV backend and queue will broadcast through Laravel Reverb using one shared app ID, public key, and secret. Reverb must stay running beyond its 60-second maintenance timer. The DEV web build will include the public key and connect through `wss://khohoanamfe.lptech.info.vn/app/...` on port 443. Host Nginx will terminate TLS and forward WebSocket upgrades to Reverb on a localhost-only Docker port. The Reverb secret stays on the VPS and is never included in the web build.

Verification requires a successful WebSocket handshake, a private-channel subscription with JWT authorization, a received `.notification.created` event from an existing business notification, a matching REST notification, and stable Reverb restart count. Existing writes and user data must be preserved.
