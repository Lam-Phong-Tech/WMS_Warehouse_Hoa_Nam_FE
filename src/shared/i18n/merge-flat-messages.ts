/**
 * Ghép các bản dịch dạng đường dẫn phẳng (`a.b.c`) vào cây message lồng nhau.
 *
 * Bản tiếng Trung đã có sẵn một cây lớn; các màn mới bổ sung được khai theo
 * từng đường dẫn để không phải chèn tay vào đúng vị trí lồng nhau. Hàm này
 * clone cây gốc rồi ghi đè/ bổ sung từng lá, giữ nguyên mọi nhánh cũ.
 */
export function withFlatOverrides<T extends Record<string, unknown>>(
  base: T,
  overrides: Record<string, string>,
): T {
  const clone = JSON.parse(JSON.stringify(base)) as T;
  for (const [path, value] of Object.entries(overrides)) {
    const parts = path.split(".");
    let node = clone as Record<string, unknown>;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      const next = node[key];
      if (typeof next !== "object" || next === null) node[key] = {};
      node = node[key] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }
  return clone;
}
