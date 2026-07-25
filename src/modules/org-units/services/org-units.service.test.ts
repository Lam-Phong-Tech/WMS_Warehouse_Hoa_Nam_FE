import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/shared/api/http');

import { http } from '@/shared/api/http';
import { orgUnitsService } from './org-units.service';

describe('orgUnitsService.inactive', () => {
  beforeEach(() => {
    vi.mocked(http.delete).mockResolvedValue(undefined);
  });

  // Trước đây gọi PATCH /status, nhưng endpoint đó không set deleted_at nên
  // PATCH /restore sau đó luôn 404 (xem docs/api-evidence/org_units.md mục 4/4b).
  it('gửi DELETE /org_units/{id}/soft-delete kèm force_soft_delete_confirm=true', async () => {
    await orgUnitsService.inactive({ id: 5 });

    expect(vi.mocked(http.delete)).toHaveBeenCalledWith(
      '/org_units/5/soft-delete',
      { data: { force_soft_delete_confirm: true } },
    );
  });

  // BE trả 409 CONFIRM_REQUIRED nếu đơn vị còn đơn vị con/phòng ban/nhân sự
  // active và request không kèm force_soft_delete_confirm=true (xác minh qua
  // api-docs.json + test thật 2026-07-15) — FE luôn gửi flag này vì
  // DeactivateOrgUnitModal đã bắt tick xác nhận cascade trước khi submit.
  it('gửi kèm reason khi có truyền', async () => {
    await orgUnitsService.inactive({ id: 5, reason: 'Tái cấu trúc' });

    expect(vi.mocked(http.delete)).toHaveBeenCalledWith(
      '/org_units/5/soft-delete',
      { data: { force_soft_delete_confirm: true, reason: 'Tái cấu trúc' } },
    );
  });
});

describe('orgUnitsService.restore và archive', () => {
  beforeEach(() => {
    vi.mocked(http.delete).mockResolvedValue(undefined);
    vi.mocked(http.patch).mockResolvedValue(undefined);
  });

  // P1.6: restore dùng PATCH theo đúng Postman contract (ERP API Contract - M0 M1 (P0+P1)_V2)
  it('restore gửi PATCH /org_units/{id}/restore', async () => {
    await orgUnitsService.restore(12);
    expect(vi.mocked(http.patch)).toHaveBeenCalledWith('/org_units/12/restore');
  });

  // /org_units/{id}/archive không tồn tại (404); "archive" (xóa vĩnh viễn sau
  // 14 ngày) thực chất đi qua DELETE .../force-delete.
  it('archive gửi DELETE /org_units/{id}/force-delete', async () => {
    await orgUnitsService.archive(15);
    expect(vi.mocked(http.delete)).toHaveBeenCalledWith(
      '/org_units/15/force-delete',
    );
  });
});

describe('orgUnitsService: đường dẫn endpoint', () => {
  it('list gọi GET /org_units', async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await orgUnitsService.list();
    expect(vi.mocked(http.get)).toHaveBeenCalledWith('/org_units');
  });

  it('create gọi POST /org_units', async () => {
    vi.mocked(http.post).mockResolvedValue({ id: 1 });
    await orgUnitsService.create({
      name: 'Test',
      code: 'T01',
      unitType: 'cong_ty_me',
    } as Parameters<typeof orgUnitsService.create>[0]);
    expect(vi.mocked(http.post)).toHaveBeenCalledWith(
      '/org_units',
      expect.any(Object),
    );
  });

  // Xác minh thật qua API 2026-07-08: GET /org_units/tree và GET /org_units
  // đều loại bản ghi soft-delete/archived (Laravel soft-delete scope mặc
  // định) — chỉ endpoint riêng này mới trả về chúng, xem
  // mergeTrashedIntoTree (org-units.helpers.ts) cho phần merge ở FE.
  it('trashed gọi GET /org_units/trashed', async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await orgUnitsService.trashed();
    expect(vi.mocked(http.get)).toHaveBeenCalledWith('/org_units/trashed');
  });
});

describe('orgUnitsService.listPaged', () => {
  beforeEach(() => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, per_page: 20 },
    });
  });

  // BE thật (swagger /org_units GET) chỉ nhận page/limit/q — unit_type/province/status
  // không được BE hỗ trợ nên FE lọc phía client (xem comment listPaged trong service).
  it('gọi GET /org_units với query params đúng (map per_page->limit, keyword->q)', async () => {
    await orgUnitsService.listPaged({
      page: 2,
      per_page: 50,
      keyword: 'test',
      unit_type: 'chi_nhanh',
      province: 'Hà Nội',
      status: 'active',
    });

    expect(vi.mocked(http.getPage)).toHaveBeenCalledWith(
      '/org_units?page=2&limit=50&q=test&unit_type=chi_nhanh&status=1',
    );
  });

  it('gọi GET /org_units không có query params khi không có filter', async () => {
    await orgUnitsService.listPaged({});
    expect(vi.mocked(http.getPage)).toHaveBeenCalledWith('/org_units');
  });

  it('chỉ gửi các params đã được cung cấp', async () => {
    await orgUnitsService.listPaged({
      page: 1,
      keyword: 'search',
    });

    expect(vi.mocked(http.getPage)).toHaveBeenCalledWith(
      '/org_units?page=1&q=search',
    );
  });

  it('không gửi status lên BE (status chỉ lọc phía client)', async () => {
    await orgUnitsService.listPaged({ status: 'soft_deleted' });
    expect(vi.mocked(http.getPage)).toHaveBeenCalledWith('/org_units');
  });

  it('không gửi status lên BE khi status: archived', async () => {
    await orgUnitsService.listPaged({ status: 'archived' });
    expect(vi.mocked(http.getPage)).toHaveBeenCalledWith('/org_units');
  });
});
