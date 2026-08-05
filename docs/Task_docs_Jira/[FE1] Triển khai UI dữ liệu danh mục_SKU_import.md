# Compatibility evidence pointer — WWHN-178

Nguồn evidence chính: `docs/Task_docs_Jira/WWHN-178.md`.

File này tồn tại để giữ tương thích với `scripts/verify-master-sku-closure.mjs` trong khi Jira đã chuẩn hóa tên file theo issue key.

## Required closure tokens

- WWHN-179
- HN-MC-001
- Backend authorization / bằng chứng 403/data-scope
- Trace PR / CI
- Checklist thực thi QA2
- FE không thể tự nhận QA2 sign-off.
- FE không tự nhận hoặc coi backend evidence là BE sign-off khi chưa có live direct API artifact.

Chi tiết đầy đủ, commands, ownership và sign-off boundary nằm trong `WWHN-178.md`.
