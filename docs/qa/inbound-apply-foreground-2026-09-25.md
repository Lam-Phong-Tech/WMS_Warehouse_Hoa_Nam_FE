# IN-01 Apply button foreground

Base: `2048c72227d79f4a43b4512177051fe229235a1f` (`dev`).

The neutral `.hn-inbound-list .MuiButton-root:not(.hn-row-action)` rule has
higher specificity than `.hn-inbound-list .hn-inbound-apply`. Its dark text
therefore wins even though the button has a solid ocean-blue background.

Add one scoped foreground declaration for the enabled Apply button using
`--wms-on-primary`. It stays white in default, hover, pressed and keyboard-focus
states. Native disabled and MUI-disabled controls are explicitly excluded:
their existing appearance and lock behavior are unchanged. No JS handlers,
API mapping, loading coordination, dimensions, other actions or pages change.

Executed `node scripts/verify-inbound-apply-color.mjs --chromium /usr/bin/chromium`:
12 isolated Chromium scenarios passed (1581/800/375px, light/dark, both modeled
MUI injection orders). Each reproduces the old color conflict, checks the white
enabled foreground, preserves geometry/background and unrelated controls, and
checks native mouse/Enter submits plus disabled/loading locks.

The complete inbound CSS and operation tokens were hash-verified against blobs
`252e251bbe9134845901317b754cbcdfe3034c73` and
`ef6633ce4714b0a40f54b18f7330afd8d21f6fd5` before testing. The harness models MUI
button rules; it does not mount React/ActionButton or load the full application.
No full-app build, authenticated API test or deployed-screen result is claimed.
