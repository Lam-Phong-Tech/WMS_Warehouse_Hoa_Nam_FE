import { vi, describe, it, expect, beforeEach } from 'vitest';
import { http } from '@/shared/api/http';
import { positionsService } from './positions.service';
import type { PositionFormValues } from '@/modules/positions/schemas/position.schema';

vi.mock('@/shared/api/http');

const MOCK_API_POSITION = {
  id: 1,
  code: 'NV',
  name: 'Nhân Viên',
  description: 'Thực thi nghiệp vụ chuyên môn',
  grade: 4,
  status: 1,
  employees_count: 2,
  deleted_at: null,
};

const MOCK_FORM_VALUES: PositionFormValues = {
  code: 'NV',
  name: 'Nhân Viên',
  description: 'Thực thi nghiệp vụ chuyên môn',
  grade: 4,
  active: true,
  management_level: 4,
};

describe('positions.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('remap (API -> Client)', () => {
    it('maps employees_count vào employeeCount', async () => {
      vi.mocked(http.get).mockResolvedValue(MOCK_API_POSITION);

      const result = await positionsService.getById(1);

      expect(result.employeeCount).toBe(2);
      expect(result.grade).toBe('C4');
      expect(result.active).toBe(true);
    });

    it('coi active=true khi không có status (vd trong assignment)', async () => {
      vi.mocked(http.get).mockResolvedValue({
        id: 2,
        code: 'TP',
        name: 'Trưởng phòng',
      });

      const result = await positionsService.getById(2);

      expect(result.active).toBe(true);
      expect(result.employeeCount).toBeUndefined();
    });

    it('map status=0 thành active=false', async () => {
      vi.mocked(http.get).mockResolvedValue({
        ...MOCK_API_POSITION,
        status: 0,
      });

      const result = await positionsService.getById(1);

      expect(result.active).toBe(false);
    });
  });

  describe('toPayload (Client -> API) - phải gửi grade', () => {
    it('create() gửi kèm grade trong payload', async () => {
      vi.mocked(http.post).mockResolvedValue(MOCK_API_POSITION);

      await positionsService.create(MOCK_FORM_VALUES);

      expect(http.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: 'NV',
          name: 'Nhân Viên',
          grade: 'C4',
          status: 1,
        }),
      );
    });

    it('update() gửi kèm grade trong payload', async () => {
      vi.mocked(http.put).mockResolvedValue(MOCK_API_POSITION);

      await positionsService.update(1, MOCK_FORM_VALUES);

      expect(http.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ grade: 'C4', status: 1 }),
      );
    });

    it('active=false map sang status=0', async () => {
      vi.mocked(http.post).mockResolvedValue(MOCK_API_POSITION);

      await positionsService.create({ ...MOCK_FORM_VALUES, active: false });

      expect(http.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 0 }),
      );
    });
  });

  describe('status filter mapping - list/export phải đồng bộ', () => {
    it('listPaged map status=active -> query status=1', async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [MOCK_API_POSITION],
        meta: { total: 1, current_page: 1, per_page: 15, last_page: 1 },
      });

      await positionsService.listPaged({ status: 'active' });

      const calledUrl = vi.mocked(http.getPage).mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=1');
    });

    it('listPaged map status=inactive -> query status=0', async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: { total: 0, current_page: 1, per_page: 15, last_page: 1 },
      });

      await positionsService.listPaged({ status: 'inactive' });

      const calledUrl = vi.mocked(http.getPage).mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=0');
    });

    it('exportXlsx dùng cùng mapping status với listPaged', async () => {
      vi.mocked(http.downloadBlob).mockResolvedValue(new Blob());

      await positionsService.exportXlsx({ status: 'inactive' });

      const calledUrl = vi.mocked(http.downloadBlob).mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=0');
    });

    it('exportPdf dùng cùng mapping status với listPaged', async () => {
      vi.mocked(http.downloadBlob).mockResolvedValue(new Blob());

      await positionsService.exportPdf({ status: 'active' });

      const calledUrl = vi.mocked(http.downloadBlob).mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=1');
    });
  });

  describe('inactive / restore', () => {
    it('inactive gửi DELETE /positions/{id}/soft-delete', async () => {
      vi.mocked(http.delete).mockResolvedValue(undefined);

      await positionsService.inactive(1);

      expect(http.delete).toHaveBeenCalledWith('/positions/1/soft-delete');
    });

    it('restore gửi PATCH /positions/{id}/restore', async () => {
      vi.mocked(http.patch).mockResolvedValue(MOCK_API_POSITION);

      await positionsService.restore(1);

      expect(http.patch).toHaveBeenCalledWith('/positions/1/restore');
    });
  });
});
