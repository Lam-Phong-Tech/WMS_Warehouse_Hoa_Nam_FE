/**
 * Format date string to Vietnamese locale (dd/mm/yyyy)
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/**
 * Format datetime string to Vietnamese locale (dd/mm/yyyy HH:mm:ss)
 * @param dateString - ISO date string
 * @returns Formatted datetime string
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
