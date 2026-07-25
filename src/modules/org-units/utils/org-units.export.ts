import {
  UNIT_TYPE_LABELS,
  ORG_UNIT_STATUS_LABELS,
  getOrgUnitStatus,
  type OrgUnit,
} from '@/modules/org-units/types/org-units.types';
import { exportXlsx } from '@/shared/utils/export-xlsx';

export interface ExportOrgUnitPermissions {
  canViewManager: boolean;
  canViewProvince: boolean;
}

const BASE_HEADERS = ['Mã', 'Tên đơn vị', 'Loại', 'Đơn vị cha', 'Trạng thái'];

const MANAGER_HEADER = 'Người phụ trách';
const PROVINCE_HEADER = 'Tỉnh/TP';

function buildHeaders(permissions: ExportOrgUnitPermissions): string[] {
  const headers = [...BASE_HEADERS];
  if (permissions.canViewProvince) {
    headers.splice(4, 0, PROVINCE_HEADER);
  }
  if (permissions.canViewManager) {
    headers.push(MANAGER_HEADER);
  }
  return headers;
}

// P1.2: BE phải enforce column security độc lập.
// FE truyền canViewManager/canViewProvince dựa trên quyền ORG_VIEW,
// nhưng BE phải validate theo token/permission và lọc columns ở server-side.
// Người dùng có thể sửa request để export cột không được phép nếu BE không enforce.
export function exportOrgUnits(
  units: OrgUnit[],
  nameById: Map<number, string>,
  permissions: ExportOrgUnitPermissions,
): void {
  const headers = buildHeaders(permissions);

  const rows = units.map((u) => {
    const row: (string | number | null)[] = [
      u.code,
      u.name,
      UNIT_TYPE_LABELS[u.unitType] ?? u.unitType,
      u.parent?.name ??
        (u.parentId != null ? (nameById.get(u.parentId) ?? '') : '(gốc)'),
    ];

    if (permissions.canViewProvince) {
      row.push(u.province ?? '');
    }

    row.push(ORG_UNIT_STATUS_LABELS[getOrgUnitStatus(u)]);

    if (permissions.canViewManager) {
      row.push(u.manager?.full_name ?? u.managerName ?? '');
    }

    return row;
  });

  exportXlsx(
    headers,
    rows,
    `don-vi-to-chuc-${new Date().toISOString().slice(0, 10)}`,
  );
}
