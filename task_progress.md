# Task Progress - M1 Demo Path & QA Handoff Cleanup

## P0 - Cần sửa gấp
- [ ] **1. Re-run baseline tại đúng HEAD 420bfe5**: chạy unit/component test, RBAC E2E, CRUD smoke, cập nhật docs/QA_BASELINE.md với SHA mới
- [ ] **2. Fix 175 test failures** (33 test files failed) để có CI xanh
- [ ] **3. BE chặn DELETE /roles/{id}/soft-delete với role is_super_admin=true** (tạo FE ticket/document evidence)
- [ ] **4. Có sign-off thật từ QA/PM/Tech Lead** trên Jira hoặc tài liệu handoff
- [ ] **5. Cập nhật Jira với evidence trực tiếp**: commit SHA, CI/test run, screenshot index, API logs, known issues

## P1 - Cần sửa
- [ ] **6. BE bổ sung TASK_APPROVE vào permission catalog** và gán cho role nghiệp vụ duyệt
- [ ] **7. Chụp lại approve/reject bằng đúng actor nghiệp vụ**, không dùng Super Admin bypass
- [ ] **8. BE implement hoặc chính thức out-of-scope GET /tasks/{id}/histories**
- [ ] **9. Dọn stale docs**: M1_QA_EVIDENCE.md, M1_DEMO_HANDOFF_SUMMARY.md, TASK_BLOCKERS.md, evidence READMEs
- [ ] **10. PM/BA xác nhận 10_Employee_Account.png là N/A** do UI đã đổi sang tạo account atomic

## P2 - Cải thiện
- [ ] **11. Gom handoff về một entrypoint duy nhất** (docs/QA_BASELINE.md)
- [ ] **12. Bổ sung coverage baseline có SHA** nếu muốn quality gate rõ hơn
- [ ] **13. Làm checklist demo executable**: mỗi AC có link screenshot/API/test log tương ứng
- [ ] **14. Tách PR/review package riêng cho M1 Demo Path**