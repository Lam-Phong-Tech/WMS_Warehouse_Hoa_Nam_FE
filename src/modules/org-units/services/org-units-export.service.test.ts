import { vi, describe, it, expect, beforeEach } from 'vitest';
import { http } from '@/shared/api/http';
import { orgUnitsExportService } from '@/modules/org-units/services/org-units-export.service';

vi.mock('@/shared/api/http', () => ({
  http: {
    downloadBlob: vi.fn(),
  },
}));

describe('orgUnitsExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exportXlsx gửi GET /org_units/export-excel với đúng query params', async () => {
    const mockBlob = new Blob(['excel-data'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    vi.mocked(http.downloadBlob).mockResolvedValue(mockBlob);

    const params = {
      keyword: 'Công ty',
      unit_type: 'cong_ty_con',
      status: 'active' as const,
    };

    const result = await orgUnitsExportService.exportXlsx(params);

    expect(vi.mocked(http.downloadBlob)).toHaveBeenCalledWith(
      '/org_units/export-excel?q=C%C3%B4ng+ty&unit_type=cong_ty_con&status=1',
    );
    expect(result).toBe(mockBlob);
  });

  it('exportXlsx map status inactive thành 0', async () => {
    const mockBlob = new Blob(['excel-data']);
    vi.mocked(http.downloadBlob).mockResolvedValue(mockBlob);

    await orgUnitsExportService.exportXlsx({ status: 'inactive' });

    expect(vi.mocked(http.downloadBlob)).toHaveBeenCalledWith(
      '/org_units/export-excel?status=0',
    );
  });

  it('exportXlsx truyền tham số province vào query', async () => {
    const mockBlob = new Blob(['excel-data']);
    vi.mocked(http.downloadBlob).mockResolvedValue(mockBlob);

    await orgUnitsExportService.exportXlsx({
      keyword: 'Hà Nội',
      province: 'Hà Nội',
      unit_type: 'cong_ty_me',
      status: 'active',
    });

    expect(vi.mocked(http.downloadBlob)).toHaveBeenCalledWith(
      '/org_units/export-excel?q=H%C3%A0+N%E1%BB%99i&unit_type=cong_ty_me&status=1',
    );
  });

  it('exportXlsx không truyền query khi không có filter', async () => {
    const mockBlob = new Blob(['excel-data']);
    vi.mocked(http.downloadBlob).mockResolvedValue(mockBlob);

    await orgUnitsExportService.exportXlsx();

    expect(vi.mocked(http.downloadBlob)).toHaveBeenCalledWith(
      '/org_units/export-excel',
    );
  });
});
