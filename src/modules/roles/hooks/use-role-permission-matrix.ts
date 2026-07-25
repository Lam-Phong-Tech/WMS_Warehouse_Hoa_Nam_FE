import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { confirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { getMutationErrorMessage } from '@/shared/api/api-error';
import { usePermission } from '@/shared/components/permission';
import { usePermissions } from '@/modules/permissions/hooks/use-permissions';
import { useRole, useSyncRolePermissions } from './use-roles';
import type { Permission } from '../types/roles.types';
import {
  applyPermissionToggle,
  findInvalidGroupsForSave,
  groupPermissionsByObject,
} from '../pages/role-permissions.helpers';

/**
 * Toàn bộ state & thao tác của ma trận quyền cho 1 role đang được chọn:
 * load quyền hiện có, tick/untick theo rule "Xem" kéo theo, validate và lưu.
 * Tách khỏi RolesPage để trang list/CRUD role không phải gánh logic này.
 */
export function useRolePermissionMatrix(selectedRoleId: number | null) {
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<
    Set<number>
  >(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data: allPermissions = [], isLoading: isPermissionsLoading } =
    usePermissions();
  const { data: selectedRoleDetail, isLoading: isRoleLoading } =
    useRole(selectedRoleId);
  const { can: canConfigMatrix } = usePermission({
    permissionCode: 'PERM_CONFIG',
  });
  const syncPermsMutation = useSyncRolePermissions();

  // Chỉ loading khi thực sự đang fetch — không phải khi /permissions trả []
  // (empty hợp lệ). Trước đây dùng `!allPermissions.length` làm điều kiện
  // loading → skeleton hiển thị mãi nếu BE trả empty catalog. Xem:
  // docs/evidence/role-permission-matrix/README.md (P2 loading-state fix).
  const isLoading = isRoleLoading || isPermissionsLoading;

  const permissionGroups = useMemo(
    () => groupPermissionsByObject(allPermissions),
    [allPermissions],
  );

  // Load lại quyền của role khi role được chọn thay đổi.
  useEffect(() => {
    if (selectedRoleDetail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedPermissionIds(
        new Set(selectedRoleDetail.permissions?.map((p) => p.id) ?? []),
      );
    } else {
      setSelectedPermissionIds(new Set());
    }
  }, [selectedRoleDetail]);

  const handlePermissionToggle = (
    perm: Permission,
    group: Permission[],
    checked: boolean,
  ) => {
    if (!canConfigMatrix) return;
    setSelectedPermissionIds((prev) =>
      applyPermissionToggle(prev, perm, group, checked),
    );
  };

  const isGroupAllChecked = (group: Permission[]) =>
    group.length > 0 && group.every((p) => selectedPermissionIds.has(p.id));

  const isGroupIndeterminate = (group: Permission[]) => {
    const checkedCount = group.filter((p) =>
      selectedPermissionIds.has(p.id),
    ).length;
    return checkedCount > 0 && checkedCount < group.length;
  };

  const handleGroupAllChange = (group: Permission[], checked: boolean) => {
    if (!canConfigMatrix) return;
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      group.forEach((p) => (checked ? next.add(p.id) : next.delete(p.id)));
      return next;
    });
  };

  const handleResetMatrix = () => {
    if (selectedRoleDetail) {
      setSelectedPermissionIds(
        new Set(selectedRoleDetail.permissions?.map((p) => p.id) ?? []),
      );
      toast.info('Đã hoàn tác các thay đổi trên ma trận quyền');
    }
  };

  const handleSaveMatrix = () => {
    if (!selectedRoleDetail) return;
    if (!canConfigMatrix) return;
    setError(null);

    // Validation: bỏ Xem mà giữ các quyền khác trong cùng nhóm -> báo lỗi
    const invalidGroups = findInvalidGroupsForSave(
      permissionGroups,
      selectedPermissionIds,
    );

    if (invalidGroups.length > 0) {
      toast.error(
        `Không thể lưu: Nhóm [${invalidGroups.join(', ')}] đang được gán quyền thao tác nhưng thiếu quyền Xem!`,
        { duration: 5000 },
      );
      return;
    }

    confirmDialog({
      title: 'Xác nhận lưu ma trận quyền',
      content: `Bạn có chắc chắn muốn cập nhật ma trận quyền cho vai trò "${selectedRoleDetail.name}"? Thay đổi sẽ ảnh hưởng đến quyền hạn của người dùng được gán vai trò này.`,
      okText: 'Lưu',
      cancelText: 'Hủy',
      onOk: () => {
        syncPermsMutation.mutate(
          {
            id: selectedRoleDetail.id,
            payload: { permissions_id: Array.from(selectedPermissionIds) },
          },
          {
            onSuccess: () => {
              setError(null);
              toast.success(
                `Đã cập nhật ma trận quyền cho vai trò "${selectedRoleDetail.name}"`,
              );
            },
            onError: (err: unknown) => {
              const message = getMutationErrorMessage(err);
              setError(message);
              toast.error(message);
            },
          },
        );
      },
    });
  };

  const selectedRoleTotal = permissionGroups.reduce(
    (sum, g) => sum + g.permissions.length,
    0,
  );
  const selectedRoleChecked = selectedRoleDetail
    ? selectedPermissionIds.size
    : 0;
  const matrixDirty =
    !!selectedRoleDetail &&
    JSON.stringify(
      [
        ...new Set(selectedRoleDetail.permissions?.map((p) => p.id) ?? []),
      ].sort(),
    ) !== JSON.stringify([...selectedPermissionIds].sort());

  return {
    selectedRoleDetail,
    selectedPermissionIds,
    permissionGroups,
    canConfigMatrix,
    syncPermsMutation,
    selectedRoleTotal,
    selectedRoleChecked,
    matrixDirty,
    handlePermissionToggle,
    isGroupAllChecked,
    isGroupIndeterminate,
    handleGroupAllChange,
    handleResetMatrix,
    handleSaveMatrix,
    isLoading,
    error,
  };
}
