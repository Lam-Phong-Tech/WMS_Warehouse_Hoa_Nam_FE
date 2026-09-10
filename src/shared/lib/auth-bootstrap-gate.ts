/**
 * CỔNG CHỜ KHỞI ĐỘNG PHIÊN (10/09/2026).
 *
 * `/login` render ngay, KHÔNG chờ `bootstrapAuth`. Khi trình duyệt còn dấu vết
 * phiên cũ (cookie `erp-auth`), bootstrap đang gọi `/auth/refresh` đúng lúc người
 * dùng gõ mật khẩu. Hai thao tác cùng ĐỔI PHIÊN mà chạy song song thì:
 *  - refresh trả 401 SAU khi đăng nhập xong → `logout()` xoá luôn phiên vừa tạo,
 *    người dùng bị đá về /login mà không có thông báo nào;
 *  - refresh lỗi mạng SAU khi đăng nhập xong → `bootstrapError` đè lên phiên mới,
 *    ProtectedRoute dựng thẻ "không khôi phục được phiên" dù đã đăng nhập.
 *
 * Nên đăng nhập tay (và bước 2 MFA) chờ lượt bootstrap đang chạy xong HẲN rồi mới
 * gửi mật khẩu. Máy sạch không có gì phải chờ: bootstrap bỏ qua refresh trên trang
 * công khai và xong gần như tức thì.
 *
 * Tách khỏi `app/bootstrap-auth.ts` để hook đăng nhập không phải kéo cả chuỗi import
 * của bootstrap (auth.service, query-client) chỉ để chờ một promise.
 */
let pending: Promise<unknown> | null = null;

/** `bootstrapAuth` gọi mỗi khi mở một lượt khởi động phiên. */
export function trackAuthBootstrap(run: Promise<unknown>): void {
  pending = run;
  const release = () => {
    if (pending === run) pending = null;
  };
  run.then(release, release);
}

/**
 * Chờ mọi lượt khởi động phiên đang chạy xong. Không bao giờ ném lỗi: kết quả của
 * bootstrap (401, lỗi mạng...) do chính bootstrap xử lý và phản ánh vào store.
 */
export async function waitForAuthBootstrap(): Promise<void> {
  // Lặp chứ không chờ một lần: trong lúc chờ có thể có lượt mới được mở (nút "Thử
  // lại", chế độ máy quét tự thử lại).
  while (pending) {
    await pending.then(
      () => undefined,
      () => undefined,
    );
  }
}
