# Bằng chứng Ánh xạ API M1

Trạng thái: Bản giữ chỗ bằng chứng WWHN-29 shell/RBAC/UI dùng chung
Phạm vi: app shell, bảo vệ điều hướng, UX 403, đường cơ sở component dùng chung

Nhiệm vụ này không thêm hoặc thay đổi các ràng buộc endpoint backend cụ thể. Bề mặt FE
được đề cập ở đây là kiểm soát route/menu/action và hành vi UI dùng chung. Ánh xạ
cấp endpoint vẫn thuộc về các nhiệm vụ triển khai module kết nối các dịch vụ API thực tế.

| Màn hình | Hành động UI | Phương thức | Đường dẫn | Quyền | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| App shell | Bảo vệ route/menu đã xác thực | N/A | N/A | bản đồ quyền route | Không thay đổi endpoint |
| UX 403 | Chặn route trái phép trực tiếp | N/A | N/A | `RequirePermission` | Không thay đổi endpoint |
| Đường cơ sở scan dùng chung | Chuẩn hóa/kiểm tra trùng lặp đầu vào scan | N/A | N/A | bảo vệ action thuộc page | Không thay đổi endpoint |