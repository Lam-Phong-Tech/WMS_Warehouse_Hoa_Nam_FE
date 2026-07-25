import type { Permission } from '@/shared/types/permission';

/**
 * Nhóm danh sách permissions theo `object`, giữ nguyên thứ tự xuất hiện đầu tiên.
 */
export function groupPermissionsByObject(
  permissions: Permission[],
): Array<{ object: string; permissions: Permission[] }> {
  const map = new Map<string, Permission[]>();

  for (const perm of permissions) {
    const key = perm.object || 'Khác';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(perm);
  }

  return Array.from(map.entries()).map(([object, permissions]) => ({
    object,
    permissions,
  }));
}

/**
 * Tìm permission có action "xem" trong nhóm.
 */
export function findViewPermission(
  group: Permission[],
): Permission | undefined {
  return group.find((p) => p.action === 'xem');
}

/**
 * Rule tick/untick 1 permission trong ma trận:
 * - Tick quyền khác "Xem" -> tự động tick "Xem" trong cùng nhóm.
 * - Untick "Xem" -> untick toàn bộ quyền khác trong nhóm (tránh trạng thái
 *   không hợp lệ: có quyền thao tác nhưng thiếu quyền Xem).
 * Hàm thuần, không mutate `current`.
 */
export function applyPermissionToggle(
  current: Set<number>,
  perm: Permission,
  group: Permission[],
  checked: boolean,
): Set<number> {
  const next = new Set(current);
  if (checked) {
    next.add(perm.id);
    if (perm.action !== 'xem') {
      const viewPerm = findViewPermission(group);
      if (viewPerm) next.add(viewPerm.id);
    }
  } else {
    next.delete(perm.id);
    if (perm.action === 'xem') {
      group.forEach((p) => {
        if (p.action !== 'xem') next.delete(p.id);
      });
    }
  }
  return next;
}

/**
 * Trả về danh sách tên nhóm (object) đang ở trạng thái không hợp lệ để lưu:
 * có quyền thao tác được chọn nhưng thiếu quyền "Xem" trong cùng nhóm.
 */
export function findInvalidGroupsForSave(
  permissionGroups: Array<{ object: string; permissions: Permission[] }>,
  selectedPermissionIds: Set<number>,
): string[] {
  const invalidGroups: string[] = [];
  permissionGroups.forEach(({ object, permissions }) => {
    const viewPerm = findViewPermission(permissions);
    const hasView = viewPerm ? selectedPermissionIds.has(viewPerm.id) : false;
    const hasOthers = permissions.some(
      (p) => p.action !== 'xem' && selectedPermissionIds.has(p.id),
    );
    if (hasOthers && !hasView) {
      invalidGroups.push(object);
    }
  });
  return invalidGroups;
}

/**
 * Map action code → nhãn tiếng Việt hiển thị trên UI.
 */
const ACTION_LABELS: Record<string, string> = {
  xem: 'Xem',
  them: 'Thêm',
  sua: 'Sửa',
  xoa_mem: 'Xóa mềm',
  xoa: 'Xóa',
  khoi_phuc: 'Khôi phục',
  duyet: 'Duyệt',
  xuat: 'Xuất',
  nhap: 'Nhập',
  ghi_hao_hut: 'Ghi nhận hao hụt',
  dieu_chuyen: 'Điều chuyển',
  quan_ly: 'Quản lý',
  cap_pham_vi: 'Cấp phạm vi',
  gan_vai_tro: 'Gán vai trò',
  doi_trang_thai: 'Đổi trạng thái',
  xoa_vinh_vien: 'Xóa vĩnh viễn',
  cap_tai_khoan: 'Cấp tài khoản',
  xem_nhay_cam: 'Xem nhạy cảm',
  import: 'Nhập',
  export: 'Xuất',
  xuat_so_do: 'Xuất sơ đồ',
  gan: 'Gán',
  cau_hinh_quyen: 'Cấu hình quyền',
  cau_hinh_scope: 'Cấu hình phạm vi',
  phan_cong: 'Phân công',
  xac_nhan: 'Xác nhận',
  gui_duyet: 'Gửi duyệt',
  ghi_nhan: 'Ghi nhận',
  huy: 'Hủy',
  xuat_hang: 'Xuất hàng',
  nhan_hang: 'Nhận hàng',
  tra_lai: 'Trả lại',
  xem_toan_he_thong: 'Xem toàn hệ thống',
  tu_choi: 'Từ chối',
  chuyen_doi: 'Chuyển đổi',
};

export function actionLabel(action: string): string {
  return (
    ACTION_LABELS[action] ??
    action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
