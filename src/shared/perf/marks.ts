/**
 * MỐC ĐO TRÊN ĐƯỜNG TỚI HẠN F5 — `performance.mark("wms:<tên>")`.
 *
 * Vì sao cần: khi đo lại một lần F5, chỉ nhìn được TỔNG thời gian và các request
 * mạng. Khoảng trống giữa "refresh trả về" và "request dữ liệu đầu tiên bay đi"
 * từng là 325–400 ms mà không công cụ nào chỉ ra được nó gồm những gì — phải đoán
 * giữa mở IndexedDB, render shell, và cơ chế chặn commit của React. Vài mốc rẻ
 * tiền biến việc đó thành đọc số.
 *
 * Chi phí: `performance.mark` là một entry trong bộ đệm của trình duyệt, cỡ micro
 * giây, không I/O. Giữ cả ở bản production để đo được trên máy thật của kho — đây
 * cũng là móc để sau này gắn RUM (báo cáo Web Vitals thật) nếu cần.
 *
 * Quy ước tên: `wms:<chặng>`. Script `scripts/perf/measure-reload.mjs` thu mọi
 * entry có tiền tố `wms:` và in ra theo thứ tự thời gian.
 */
const PREFIX = "wms:";

/** Đặt một mốc. Gọi nhiều lần với cùng tên là vô hại (mốc đầu tiên được giữ). */
export function mark(name: string): void {
  if (typeof performance === "undefined" || !performance.mark) return;
  try {
    // Chỉ giữ lần ĐẦU: các mốc trên đường tới hạn phải là "lúc sớm nhất chạm
    // tới", không phải lần render lại thứ n.
    if (performance.getEntriesByName(PREFIX + name, "mark").length > 0) return;
    performance.mark(PREFIX + name);
  } catch {
    // Bộ đệm đầy hoặc API bị chặn — mốc đo không bao giờ được làm hỏng app.
  }
}
