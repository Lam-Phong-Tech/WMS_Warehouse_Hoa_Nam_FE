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
# 0) Máy chủ đang phục vụ ĐÚNG commit vừa deploy
curl -s https://<domain>/build-manifest.json | grep -i sourceSha

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

## Đăng nhập báo "Không kết nối được hệ thống"

Câu này chỉ hiện khi request đăng nhập KHÔNG nhận được HTTP response nào (sai mật
khẩu là 401, bị khoá tạm là 429 — đều có thông báo riêng).

Từ 10/09/2026 màn đăng nhập **tự chờ máy chủ** trước khi báo lỗi: request hỏng kiểu
"máy chủ chưa sẵn sàng" (gateway 502/503, hoặc `ERR_NETWORK` không response) thì nó
dò `GET /health` — tối đa 45 s nếu gateway còn trả lời, 15 s nếu chưa tới được máy
chủ — rồi gửi lại ĐÚNG MỘT LẦN. Trong lúc chờ màn hình ghi "Máy chủ chưa sẵn sàng (có
thể đang khởi động lại)…". Hết thời gian mới báo lỗi, câu chữ theo điều dò được: "đang
khởi động lại hoặc tạm gián đoạn" (gateway trả lời), "máy chủ chưa phản hồi" (không
tới được), "kiểm tra kết nối mạng" (trình duyệt báo offline). Mã nguồn:
`src/shared/api/backend-availability.ts`.

**Ca hay gặp nhất — backend vừa khởi động lại** (ticket 10/09/2026, mã
`ERR_NETWORK/network | 13ms | … | cross-origin`): nhật ký nginx của BE có
`OPTIONS /api/v1/auth/login … 502` kèm `backend could not be resolved` / `connect()
failed (111: Connection refused)` đúng lúc container `backend` đang tạo lại (entrypoint
chạy migrate + config:cache, ~10–25 s). Trang 502 do nginx tự sinh không có header
CORS nên trình duyệt chặn preflight, POST không hề được gửi. Repo BE nay trả JSON 503
có CORS (`docker/nginx/default.conf.template`, cần `docker compose up -d nginx`).

Dưới câu lỗi có một dòng `Mã chẩn đoán`, ví dụ:

```
ERR_NETWORK/network | 812ms | +1.4s | online | h2 | sw | probe:unreachable
HTTP 503 BACKEND_UNAVAILABLE | probe:unavailable
```

| Phần | Nghĩa |
|---|---|
| `ERR_NETWORK/network` | lỗi mạng, kết nối bị cắt hoặc CORS; `ECONNABORTED/timeout` = quá `VITE_API_TIMEOUT_MS`; `ECONNABORTED/aborted` = trình duyệt huỷ request (thường vì trang điều hướng) |
| `812ms` | từ lúc gửi tới lúc hỏng — gần 0 ms là bị chặn ngay (DNS, chứng chỉ, proxy, CORS) |
| `+1.4s` | tuổi của trang lúc hỏng — nhỏ nghĩa là đăng nhập ngay sau khi mở trang |
| `online` / `offline` | `navigator.onLine` |
| `http/1.1`, `h2`, `h3` | giao thức của trang — chỉ hỏng trên `h3` thì nghi QUIC/proxy |
| `sw`, `cross-origin`, `page-leaving`, `hidden` | có service worker điều khiển; API khác origin; trang đang rời đi/reload; tab bị ẩn |

20 lỗi gần nhất của tab (sống qua reload) nằm ở DevTools → Application → Session
Storage → `wms:transport-log`. Bản ghi không chứa email, mật khẩu, token, body hay
query.

Race lúc khởi động (service worker, bootstrap refresh, chế độ máy quét tự áp bản cập
nhật) có bộ kiểm riêng chạy trên bản build production với API giả lập cùng origin:
`scripts/perf/_check-login-cold-start.mjs` (cách build ghi ở đầu file).
