import { vi, describe, it, expect, beforeEach } from 'vitest';
import { exportOrgUnits } from './org-units.export';
import { exportXlsx } from '@/shared/utils/export-xlsx';
import type { OrgUnit } from '../types/org-units.types';

// Mock exportXlsx
vi.mock('@/shared/utils/export-xlsx', () => ({
  exportXlsx: vi.fn(),
}));

const MOCK_UNITS: OrgUnit[] = [
  {
    id: 1,
    code: 'CTY-ME',
    name: 'Công ty Mẹ',
    unitType: 'cong_ty_me',
    parentId: null,
    active: true,
    province: 'Hà Nội',
    managerName: 'Nguyễn Văn A',
  },
  {
    id: 2,
    code: 'CTY-CON',
    name: 'Công ty Con',
    unitType: 'cong_ty_con',
    parentId: 1,
    active: false,
    deletedAt: '2026-06-28T12:00:00Z',
    province: 'Hồ Chí Minh',
    manager: { id: 2, code: 'NV002', full_name: 'Trần Thị B' },
  },
];

const nameById = new Map<number, string>([
  [1, 'Công ty Mẹ'],
  [2, 'Công ty Con'],
]);

describe('Org Units Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportOrgUnits (Excel)', () => {
    it('calls exportXlsx with mapped headers and rows', () => {
      const mockConfirm = vi.fn().mockReturnValue(true);
      vi.stubGlobal('confirm', mockConfirm);

      const permissions = { canViewManager: true, canViewProvince: true };
      exportOrgUnits(MOCK_UNITS, nameById, permissions);

      expect(exportXlsx).toHaveBeenCalledOnce();
      const [headers, rows, fileName] = vi.mocked(exportXlsx).mock.calls[0];

      expect(headers).toEqual([
        'Mã',
        'Tên đơn vị',
        'Loại',
        'Đơn vị cha',
        'Tỉnh/TP',
        'Trạng thái',
        'Người phụ trách',
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual([
        'CTY-ME',
        'Công ty Mẹ',
        'Công ty mẹ',
        '(gốc)',
        'Hà Nội',
        'Hoạt động',
        'Nguyễn Văn A',
      ]);
      expect(rows[1]).toEqual([
        'CTY-CON',
        'Công ty Con',
        'Công ty con',
        'Công ty Mẹ',
        'Hồ Chí Minh',
        'Đã xóa chờ khôi phục',
        'Trần Thị B',
      ]);
      expect(fileName).toContain('don-vi-to-chuc-');
    });
  });
});
