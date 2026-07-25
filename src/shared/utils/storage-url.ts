/**
 * Dựng URL công khai cho file lưu ở storage từ path tương đối API trả về.
 *
 *   storageUrl('org-units/3/abc.png')
 *   → `${VITE_STORAGE_URL}/org-units/3/abc.png`
 *
 * - Path falsy → undefined (để component bỏ qua, không render ảnh hỏng).
 * - Path đã là URL tuyệt đối (http/https) → trả nguyên.
 */
export function storageUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta.env.VITE_STORAGE_URL ?? '').replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
