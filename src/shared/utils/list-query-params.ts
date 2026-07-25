/**
 * Adapter chuẩn cho query param của các danh sách phân trang (Table/List
 * Pattern). Lý do tồn tại file này: mỗi module BE dùng tên query param khác
 * nhau cho cùng một khái niệm (per_page/limit, keyword/q/search — xem
 * `docs/api-evidence/*.md` cho evidence cụ thể từng endpoint), nhưng UI/hook
 * phía FE luôn nên thao tác trên MỘT shape thống nhất (`page`, `per_page`,
 * `keyword`). `buildListSearchParams` là điểm map DUY NHẤT giữa 2 phía: UI
 * dùng field chuẩn, service truyền `keyMap` để dịch sang tên param BE thật
 * của endpoint đó.
 *
 * KHÔNG suy đoán tên param — mỗi `keyMap` truyền vào phải có evidence (test
 * API thật hoặc swagger) trong comment tại nơi gọi, xem ví dụ trong
 * `org-units.service.ts` / `employees.service.ts`.
 */

export interface BaseListParams {
  page?: number;
  per_page?: number;
  keyword?: string;
}

/**
 * Tên query param thật của BE cho từng field chuẩn. `undefined` = dùng tên
 * mặc định (trùng tên field chuẩn: `page`, `per_page`, `keyword`).
 */
export interface ListQueryKeyMap {
  page?: string;
  per_page?: string;
  keyword?: string;
}

/**
 * Build `URLSearchParams` cho `page`/`per_page`/`keyword` theo `keyMap` của
 * từng endpoint. Các param đặc thù của module (filter riêng, sort...) do
 * service tự `set` thêm sau khi gọi hàm này — xem các `listPaged`/`list`
 * trong `*.service.ts`.
 */
export function buildListSearchParams(
  params: BaseListParams,
  keyMap: ListQueryKeyMap = {},
): URLSearchParams {
  const sp = new URLSearchParams();
  if (params.page) sp.set(keyMap.page ?? 'page', String(params.page));
  if (params.per_page) {
    sp.set(keyMap.per_page ?? 'per_page', String(params.per_page));
  }
  if (params.keyword?.trim()) {
    sp.set(keyMap.keyword ?? 'keyword', params.keyword.trim());
  }
  return sp;
}
