/**
 * Cuốn hết các trang của một endpoint mà KHÔNG xếp hàng nối tiếp.
 *
 * VẤN ĐỀ NÓ SỬA: nhiều màn báo cáo cần toàn bộ dòng của một kỳ, nên chúng chạy
 * `for (page...) { await fetchPage(page) }`. Vòng lặp đó khiến trang sau chờ
 * trang trước xong mới đi. Đo thật trên máy này:
 *   - danh mục SKU (818 dòng, trần 100/trang) = 9 vòng mạng nối tiếp ≈ 2,1 giây;
 *   - `outbound-by-recipient` = 4 vòng nối tiếp ≈ 0,76 giây.
 * Đó là thời gian chờ thuần tuý, không phải thời gian máy chủ tính toán.
 *
 * CÁCH LÀM: chỉ trang 1 là tuần tự — phải đọc nó mới biết có bao nhiêu trang —
 * còn lại đi song song. 9 vòng nối tiếp trở thành 1 vòng + 1 đợt song song.
 *
 * GIỚI HẠN SONG SONG: cố ý KHÔNG bắn hết một lúc. Với vài nghìn người cùng mở
 * báo cáo, một đợt 20 request đồng thời mỗi người là một cú dội vào VPS. Sáu là
 * đúng trần kết nối mà trình duyệt cho phép trên HTTP/1.1, nên vượt qua cũng
 * không nhanh hơn mà chỉ làm hàng đợi dài thêm.
 */
const MAX_CONCURRENT_PAGES = 6;

async function mapWithConcurrency<TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  worker: (item: TIn) => Promise<TOut>,
): Promise<TOut[]> {
  const results: TOut[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    },
  );

  await Promise.all(runners);
  return results;
}

/**
 * @param fetchPage  Tải đúng một trang (số trang bắt đầu từ 1).
 * @param lastPageOf Đọc tổng số trang từ payload trang đầu.
 * @param maxPages   Trần an toàn: không bao giờ tải quá số này, kể cả khi máy
 *                   chủ báo nhiều hơn. Chặn việc một bộ lọc quá rộng kéo về
 *                   hàng trăm trang.
 * @returns Các trang theo ĐÚNG thứ tự 1..n — người gọi ghép dòng lại là ra thứ
 *          tự y hệt vòng lặp tuần tự cũ.
 */
export async function fetchAllPages<TPage>(
  fetchPage: (page: number) => Promise<TPage>,
  lastPageOf: (page: TPage) => number,
  maxPages: number,
): Promise<TPage[]> {
  const first = await fetchPage(1);
  const lastPage = Math.min(Math.max(lastPageOf(first), 1), maxPages);
  if (lastPage <= 1) return [first];

  const remaining = Array.from(
    { length: lastPage - 1 },
    (_, index) => index + 2,
  );
  const rest = await mapWithConcurrency(
    remaining,
    MAX_CONCURRENT_PAGES,
    fetchPage,
  );

  return [first, ...rest];
}
