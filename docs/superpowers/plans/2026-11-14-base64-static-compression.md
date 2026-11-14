# Base64 and static JS/CSS compression

User authorized implementation after the explanation of both changes. Preserve API encryption, authentication, numbers, file contents, cache policy and existing application behavior.

## Implementation

- Add a shared Base64 decoder: feature-detect native Uint8Array.fromBase64; fallback to atob plus a preallocated indexed byte loop, avoiding the per-character Uint8Array.from callback.
- Test all byte values, large payloads, Unicode JSON, accepted padding/whitespace and malformed inputs. Exercise real Web Crypto decryption and rejection of modified key/IV/tag/ciphertext; cover Axios normal/error/blob handling.
- Benchmark actual Chrome native and fallback paths against the current decoder, asserting byte equality and comparing malformed-input acceptance.
- Enable gzip for public frontend JS/CSS assets on khohoanamfe.lptech.info.vn only. Inspect effective config, preserve proxies/security headers/cache, save a rollback copy, run nginx -t before graceful reload.
- Verify identity versus gzip decoded SHA-256 equality, compression headers, Vary, cache/security headers and unauthenticated API behavior. No API compression policy change.
- Run tests/lint/production build. Keep frontend source changes local unless released through the existing tested-SHA deployment pipeline; do not deploy the unrelated pending dashboard/backend edits.

The native decoder is conditional, so browsers without the newer API retain compatible behavior. No change to RSA-OAEP, AES-GCM, key handling or integrity verification. Compression is transport-only for public static assets.

## Results

Completed: 45 unit/integration tests, production build, final typecheck, ESLint,
formatting and diff checks passed. Chrome tested 30,952 legacy/native inputs;
native/fallback real Web Crypto tests preserved 12,000 records and rejected all
tampered packets. Median decode of 3 MiB + 1 byte: 688.2 ms legacy, 7.6 ms native,
32.2 ms fallback (local microbenchmark, not whole-page performance).

Gzip applied and verified live on DEV: 32 initial JS/CSS assets transferred
1,810,043 bytes before and 544,123 after (69.94% reduction), exact decoded hashes,
unchanged security/cache headers and valid 304 conditional requests. Backup:
`/var/backups/hoanam-static-compression-20261114T103515Z/vhost.before`.
Frontend bundle remains local pending the normal tested-SHA release pipeline.
