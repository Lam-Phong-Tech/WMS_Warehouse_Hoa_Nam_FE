/** Bản ghi người dùng (domain) — `joinedAt` là chuỗi ISO để serialize an toàn trong cache. */
export interface User {
  id: number;
  code: string;
  name: string;
  email: string;
  role: string;
  salary: number;
  joinedAt: string | null;
  note?: string;
  active: boolean;
}
