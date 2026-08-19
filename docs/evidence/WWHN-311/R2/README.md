# WWHN-311 R2 evidence pack (register comment 15621)

Local reproducible execution identity thay cho CI-run identity (pattern da nghiem thu o WWHN-292 FE292-P1-04; khong dung GitHub Actions theo quota policy).

- `run-identity.txt` — exact candidate/evidence SHA, range invariant, BE re-verify SHA, BE contract pin, node/npm/os/env.
- `gate-*.log` — raw log tung gate; `gate-outcomes.txt` — exit code tung gate (7/7 = 0).
- `gate-test.log` — vitest 769/769 PASS (96 files), bao gom RBAC regression `src/app/router/access.test.ts`.
- `build-manifest.json` + `health.json` — artifact identity cua production build tai evidence SHA. `sourceSha=local-uncommitted` la do `swagger-api.json` (BE OpenAPI da pin, gitignored theo thiet ke WWHN-296/309) duoc materialize trong worktree truoc khi build; exact SHA authoritative nam o `run-identity.txt`.
- `SHA256SUMS` — checksum toan bo file trong pack (tru chinh no).

Evidence pack nay dung ngoai tap artifact duoc pin cua WWHN-311 de tranh pin tu tham chieu.
