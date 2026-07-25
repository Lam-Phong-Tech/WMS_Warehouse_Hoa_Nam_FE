import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock http module - vitest 4.x compatible
vi.mock('@/shared/api/http', () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Xác minh thật qua Swagger + API 2026-07-08: GET /roles hỗ trợ page/limit/
// search và trả `meta` phân trang thật (current_page/per_page/last_page/
// total) — trước đây gọi `http.get` (bỏ `meta`) không kèm param nàu, chỉ
// "chạy đúng" vì số vai trò hiện có (12) nằm gọn trong per_page mặc định của
// BE (15); vượt quá sẽ bị cắt âm thầm. Test này khoá lại hành vi dùng
// `http.getPage` + param đúng tên BE nhận (`limit`, không phải `per_page`).
describe('rolesService.getRoles', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rolesService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let http: any;

  beforeAll(async () => {
    const httpMod = await import('@/shared/api/http');
    http = httpMod.http;
    const serviceMod = await import('@/modules/roles/services/roles.service');
    rolesService = serviceMod.rolesService;
  });

  it('gọi GET /roles không có query params khi không truyền params', async () => {
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });
    await rolesService.getRoles();
    expect(vi.mocked(http.getPage)).toHaveBeenCalledWith('/roles');
  });

  it('map page/per_page/search đúng tên param BE nhận (limit, search)', async () => {
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });
    await rolesService.getRoles({ page: 2, per_page: 20, search: 'admin' });
    expect(vi.mocked(http.getPage)).toHaveBeenCalledWith(
      '/roles?page=2&limit=20&search=admin',
    );
  });

  it('giữ nguyên meta phân trang trả về (không bỏ như http.get)', async () => {
    const meta = { current_page: 1, per_page: 15, last_page: 1, total: 12 };
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta });
    const result = await rolesService.getRoles();
    expect(result.meta).toEqual(meta);
  });
});
