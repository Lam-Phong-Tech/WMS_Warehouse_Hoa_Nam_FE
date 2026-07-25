import * as XLSX from 'xlsx';

/**
 * Xuất dữ liệu ra file Excel (.xlsx) với UTF-8, tự động fit cột.
 * @param headers  Tiêu đề các cột
 * @param rows     Dữ liệu (mỗi hàng là mảng string/number)
 * @param filename Tên file (không cần đuôi .xlsx)
 */
export function exportXlsx(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  filename: string,
): void {
  const data = [headers, ...rows.map((r) => r.map((v) => v ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-fit column widths dựa trên độ dài nội dung tối đa.
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[i] ?? '').length),
    );
    // Đặt độ rộng tối thiểu là 15 ký tự để cột không bị bó hẹp.
    // Cộng thêm 6 ký tự đệm để tránh bị che khuất chữ tiếng Việt có dấu / chữ in hoa đậm.
    // Giới hạn tối đa là 60 ký tự để tránh cột quá dài.
    const width = Math.max(15, Math.min(maxLen + 6, 60));
    return { wch: width };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
