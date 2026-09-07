# Phục vụ bản build FE trên môi trường thật

Thư mục này chỉ có **cấu hình mẫu**, không có gì được nạp tự động.

## Vì sao cần

Toàn bộ phần tối ưu phía mã nguồn chỉ có tác dụng nếu máy chủ tĩnh làm đúng ba
việc. Đo ngày 07/09/2026 trên `vite preview` (máy chủ dùng để đo hiệu năng):

| Việc | `vite preview` | Cần ở môi trường thật |
|---|---|---|
| Nén | **không nén** | gzip/brotli (1,3 MB → ~410 KB) |
| Cache file có hash | `Cache-Control: no-cache` | `immutable, max-age=1 năm` |
| Giao thức | HTTP/1.1 | HTTP/2 |

Với `no-cache`, mỗi lần F5 trình duyệt phát **33 request điều kiện** cho những
file mà nội dung không bao giờ đổi (tên đã mang hash). Trên mạng văn phòng RTT
30–60 ms, riêng khoản đó đã vượt ngân sách 1,5 giây — bất kể FE nhanh cỡ nào.

## Dùng thế nào

1. Chép `nginx/frontend.conf.example` sang máy chủ, ví dụ
   `/etc/nginx/conf.d/wms-fe.conf`.
2. Sửa `server_name`, `root` (trỏ vào nội dung `dist/`), đường dẫn chứng chỉ.
3. `nginx -t && nginx -s reload`.

## Nên bật thêm: API cùng origin

Khối `location /api/` trong file mẫu (đang chú thích) proxy API qua chính domain
của FE. Đổi lại phải build với `VITE_API_BASE_URL="https://<domain FE>/api/v1"`.

Lợi ích đo được: trình duyệt **không phát request preflight `OPTIONS` nào nữa**.
Hiện mỗi đường dẫn API mới trong một phiên tốn một preflight đi trọn vòng Laravel
(140–430 ms), và một lần F5 màn Tổng quan chạm 7 đường dẫn khác nhau.

## Kiểm chứng sau khi triển khai

```bash
# 1) File có hash phải immutable và được nén
curl -sI -H 'Accept-Encoding: gzip' https://<domain>/assets/<file>.js \
  | grep -iE 'cache-control|content-encoding'
# mong đợi: cache-control: public, max-age=31536000, immutable
#           content-encoding: gzip

# 2) index.html và service worker KHÔNG được cache
curl -sI https://<domain>/index.html        | grep -i cache-control
curl -sI https://<domain>/service-worker.js | grep -i cache-control
# mong đợi: no-cache

# 3) Nếu đã bật API cùng origin: không còn preflight
#    (mở DevTools → Network → lọc "OPTIONS", phải trống)
```

Đo lại thời gian F5 thật bằng bộ đo có sẵn trong repo:

```bash
BASE_URL=https://<domain> RELOADS=5 node scripts/perf/measure-reload.mjs
```
