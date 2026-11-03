# Thiết kế hộp thoại nhập SKU từ Excel

## Mục tiêu

Giúp người dùng nhập danh sách SKU theo thứ tự rõ ràng và loại bỏ vùng trống lớn trong hộp thoại hiện tại. Giữ nguyên quy tắc chỉ ghi dữ liệu khi toàn bộ tệp hợp lệ.

## Phạm vi và ràng buộc

- Bước 1: chọn tệp Excel, tải tệp mẫu, xem yêu cầu cột và chọn có cập nhật SKU đã tồn tại hay không.
- Bước 2: kiểm tra tệp, xem tổng hợp và từng dòng lỗi. Chỉ bật thao tác nhập khi kết quả kiểm tra còn hiệu lực và không có lỗi. Có thể quay lại bước 1 để thay tệp hoặc tùy chọn.
- Bước 3: hiển thị kết quả nhập, bao gồm trạng thái đã xử lý trước đó và tệp lỗi nếu có. Cho phép làm lại để nhập tệp khác.
- Hộp thoại vừa nội dung lúc chưa có kết quả; khi có nhiều dòng lỗi, phần nội dung cuộn trong giới hạn chiều cao màn hình. Bố cục dùng được trên màn hình nhỏ.
- Giữ kiểm tra định dạng, kích thước, SHA-256, kết quả kiểm tra hết hiệu lực khi đầu vào đổi, quyền nhập, xử lý lỗi API và bản dịch Việt/Anh/Trung hiện có.

## Các hướng đã cân nhắc

1. Gom mọi thao tác vào một màn hình và thu gọn chiều cao: ít thay đổi nhưng vẫn đặt nhiều trạng thái cùng chỗ.
2. Chia thành các bước chọn tệp, kiểm tra, nhập: người dùng chọn hướng này để thứ tự thao tác rõ ràng hơn.

## Quyết định triển khai

Dùng trạng thái bước ngay trong `SkuImportModal`, không thay API. Nút kiểm tra ở bước 1 chuyển sang bước 2 khi bắt đầu kiểm tra; bước 2 thể hiện đang xử lý, lỗi hoặc kết quả. Nút nhập ở bước 2 chỉ khả dụng theo điều kiện `canCommit` hiện có. Kết quả nhập chuyển sang bước 3. Khi quay lại và đổi đầu vào, kết quả cũ mất hiệu lực như hiện tại. Đóng hoặc Làm lại đặt lại toàn bộ trạng thái. Các nút điều hướng và nội dung bước có nhãn dễ hiểu cho bàn phím và trình đọc màn hình.

## Ngoài phạm vi

Không thay hợp đồng backend, cấu trúc tệp mẫu hoặc quy tắc nhập SKU.
