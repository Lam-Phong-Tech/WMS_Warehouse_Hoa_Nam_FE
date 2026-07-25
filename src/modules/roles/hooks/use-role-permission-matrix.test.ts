/**
 * Unit test cho hook useRolePermissionMatrix.
 *
 * Độ phủ: save payload path, save error path, validation path (invalid groups),
 * permission toggle cascade rule, reset matrix, loading state (empty catalog
 * hợp lệ không bị coi là loading), dirty tracking.
 *
 * Chạy: npx vitest run src/modules/roles/hooks/use-role-permission-matrix.test.ts --no-coverage
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRolePermissionMatrix } from './use-role-permission-matrix';
import type { Permission } from '@/shared/types/permission';
import type { Role } from '../types/roles.types';

// --- Mock dependencies ---

// Mock ConfirmDialog để tự động gọi onOk
vi.mock('@/shared/components/feedback/ConfirmDialog', () => ({
  confirmDialog: ({ onOk }: { onOk: () => void }) => {
    onOk();
  },
}));

// Mock usePermission để trả về can: true (override setup.ts mock)
vi.mock('@/shared/hooks/usePermission', () => ({
  usePermission: () => ({ can: true, loading: false }),
  useCanAll: () => true,
  useCanAny: () => true,
}));

// Mock usePermissions
const mockPermissions: Permission[] = [
  {
    id: 1,
    code: 'ORG_VIEW',
    name: 'Xem',
    object: 'Đơn vị/tổ chức',
    action: 'xem',
    description: null,
  },
  {
    id: 2,
    code: 'ORG_CREATE',
    name: 'Thêm',
    object: 'Đơn vị/tổ chức',
    action: 'them',
    description: null,
  },
  {
    id: 3,
    code: 'TASK_VIEW',
    name: 'Xem',
    object: 'Nhiệm vụ',
    action: 'xem',
    description: null,
  },
  {
    id: 4,
    code: 'TASK_CREATE',
    name: 'Tạo',
    object: 'Nhiệm vụ',
    action: 'tao',
    description: null,
  },
];
let mockPermissionsLoading = false;
vi.mock('@/modules/permissions/hooks/use-permissions', () => ({
  usePermissions: () => ({
    data: mockPermissionsLoading ? undefined : mockPermissions,
    isLoading: mockPermissionsLoading,
  }),
  PERMISSIONS_QUERY_KEY: ['permissions'],
}));

// Mock useRole + useSyncRolePermissions
const mockRole: Role = {
  id: 1,
  code: 'SALES_STAFF',
  name: 'Nhân viên kinh doanh',
  description: null,
  type: 'co_dinh',
  status: 1,
  is_super_admin: false,
  created_at: '',
  updated_at: '',
  permissions: [
    {
      id: 1,
      code: 'ORG_VIEW',
      name: 'Xem',
      object: 'Đơn vị/tổ chức',
      action: 'xem',
      description: null,
    },
  ],
};
let mockRoleDetail: Role | undefined = mockRole;
let mockRoleLoading = false;
let mockMutationError: unknown = null;
let mockMutationSuccess = true;
const mockMutate = vi.fn(
  (
    _payload: unknown,
    options: { onSuccess?: () => void; onError?: (err: unknown) => void },
  ) => {
    if (mockMutationSuccess) options.onSuccess?.();
    else options.onError?.(mockMutationError);
  },
);
vi.mock('./use-roles', () => ({
  useRole: () => ({ data: mockRoleDetail, isLoading: mockRoleLoading }),
  useSyncRolePermissions: () => ({ mutate: mockMutate, isPending: false }),
}));

describe('useRolePermissionMatrix', () => {
  beforeEach(() => {
    mockPermissionsLoading = false;
    mockRoleDetail = mockRole;
    mockRoleLoading = false;
    mockMutationError = null;
    mockMutationSuccess = true;
    mockMutate.mockClear();
  });

  describe('isLoading', () => {
    it('trả về false khi đã load xong và permissions rỗng (valid empty catalog)', () => {
      mockRoleLoading = false;
      mockPermissionsLoading = false;
      const original = [...mockPermissions];
      mockPermissions.length = 0;
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      expect(result.current.isLoading).toBe(false);
      mockPermissions.length = 0;
      mockPermissions.push(...original);
    });

    it('trả về true khi đang loading role detail', () => {
      mockRoleLoading = true;
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      expect(result.current.isLoading).toBe(true);
    });

    it('trả về true khi đang loading permissions catalog', () => {
      mockPermissionsLoading = true;
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      expect(result.current.isLoading).toBe(true);
    });

    it('trả về false khi cả 2 đã load xong', () => {
      mockRoleLoading = false;
      mockPermissionsLoading = false;
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('handleSaveMatrix — payload path', () => {
    it('gọi mutation với đúng payload permissions_id khi không có lỗi validation', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      act(() => {
        result.current.handleSaveMatrix();
      });
      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(mockMutate).toHaveBeenCalledWith(
        { id: 1, payload: { permissions_id: [1] } },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });

    it('gửi toàn bộ selectedPermissionIds (đã tick) trong payload', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      act(() => {
        result.current.handlePermissionToggle(
          {
            id: 4,
            code: 'TASK_CREATE',
            name: 'Tạo',
            object: 'Nhiệm vụ',
            action: 'tao',
            description: null,
          },
          [
            {
              id: 3,
              code: 'TASK_VIEW',
              name: 'Xem',
              object: 'Nhiệm vụ',
              action: 'xem',
              description: null,
            },
            {
              id: 4,
              code: 'TASK_CREATE',
              name: 'Tạo',
              object: 'Nhiệm vụ',
              action: 'tao',
              description: null,
            },
          ],
          true,
        );
      });
      act(() => {
        result.current.handleSaveMatrix();
      });
      expect(mockMutate).toHaveBeenCalledWith(
        {
          id: 1,
          payload: { permissions_id: expect.arrayContaining([1, 3, 4]) },
        },
        expect.any(Object),
      );
    });
  });

  describe('handleSaveMatrix — validation path', () => {
    it('không gọi mutation khi có invalid group (có action nhưng thiếu quyền Xem)', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      const taskGroup = [
        {
          id: 3,
          code: 'TASK_VIEW',
          name: 'Xem',
          object: 'Nhiệm vụ',
          action: 'xem',
          description: null,
        },
        {
          id: 4,
          code: 'TASK_CREATE',
          name: 'Tạo',
          object: 'Nhiệm vụ',
          action: 'tao',
          description: null,
        },
      ];
      act(() => {
        result.current.handlePermissionToggle(taskGroup[1], taskGroup, true);
      });
      act(() => {
        result.current.handlePermissionToggle(taskGroup[0], taskGroup, false);
      });
      act(() => {
        result.current.handleSaveMatrix();
      });
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('gọi mutation khi tất cả nhóm đều hợp lệ', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      act(() => {
        result.current.handleSaveMatrix();
      });
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleSaveMatrix — error path', () => {
    it('set error state và clear error khi mutation thành công', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      act(() => {
        result.current.handleSaveMatrix();
      });
      expect(result.current.error).toBeNull();
    });

    it('set error state khi mutation thất bại', () => {
      mockMutationSuccess = false;
      mockMutationError = new Error(
        'ROLE_PERMISSIONS_LOCKED: vai trò đã bị khóa',
      );
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      act(() => {
        result.current.handleSaveMatrix();
      });
      expect(result.current.error).toBe(
        'ROLE_PERMISSIONS_LOCKED: vai trò đã bị khóa',
      );
    });
  });

  describe('handlePermissionToggle — cascade rule', () => {
    const orgGroup = [
      {
        id: 1,
        code: 'ORG_VIEW',
        name: 'Xem',
        object: 'Đơn vị/tổ chức',
        action: 'xem',
        description: null,
      },
      {
        id: 2,
        code: 'ORG_CREATE',
        name: 'Thêm',
        object: 'Đơn vị/tổ chức',
        action: 'them',
        description: null,
      },
    ];

    it('tick action khác xem tự động tick xem trong cùng nhóm', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      act(() => {
        result.current.handlePermissionToggle(orgGroup[1], orgGroup, true);
      });
      expect(result.current.selectedPermissionIds.has(1)).toBe(true);
      expect(result.current.selectedPermissionIds.has(2)).toBe(true);
    });

    it('untick xem xóa hết action khác trong cùng nhóm', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      act(() => {
        result.current.handlePermissionToggle(orgGroup[1], orgGroup, true);
      });
      act(() => {
        result.current.handlePermissionToggle(orgGroup[0], orgGroup, false);
      });
      expect(result.current.selectedPermissionIds.has(1)).toBe(false);
      expect(result.current.selectedPermissionIds.has(2)).toBe(false);
    });
  });

  describe('handleResetMatrix', () => {
    it('reset selectedPermissionIds về trạng thái ban đầu của role', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      const orgGroup = [
        {
          id: 1,
          code: 'ORG_VIEW',
          name: 'Xem',
          object: 'Đơn vị/tổ chức',
          action: 'xem',
          description: null,
        },
        {
          id: 2,
          code: 'ORG_CREATE',
          name: 'Thêm',
          object: 'Đơn vị/tổ chức',
          action: 'them',
          description: null,
        },
      ];
      act(() => {
        result.current.handlePermissionToggle(orgGroup[1], orgGroup, true);
      });
      expect(result.current.selectedPermissionIds.has(2)).toBe(true);
      act(() => {
        result.current.handleResetMatrix();
      });
      expect(result.current.selectedPermissionIds.has(1)).toBe(true);
      expect(result.current.selectedPermissionIds.has(2)).toBe(false);
    });
  });

  describe('matrixDirty', () => {
    it('trả về false khi chưa có thay đổi', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      expect(result.current.matrixDirty).toBe(false);
    });

    it('trả về true khi có thay đổi so với role ban đầu', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      const orgGroup = [
        {
          id: 1,
          code: 'ORG_VIEW',
          name: 'Xem',
          object: 'Đơn vị/tổ chức',
          action: 'xem',
          description: null,
        },
        {
          id: 2,
          code: 'ORG_CREATE',
          name: 'Thêm',
          object: 'Đơn vị/tổ chức',
          action: 'them',
          description: null,
        },
      ];
      act(() => {
        result.current.handlePermissionToggle(orgGroup[1], orgGroup, true);
      });
      expect(result.current.matrixDirty).toBe(true);
    });
  });

  describe('group check/indeterminate helpers', () => {
    const orgGroup = [
      {
        id: 1,
        code: 'ORG_VIEW',
        name: 'Xem',
        object: 'Đơn vị/tổ chức',
        action: 'xem',
        description: null,
      },
      {
        id: 2,
        code: 'ORG_CREATE',
        name: 'Thêm',
        object: 'Đơn vị/tổ chức',
        action: 'them',
        description: null,
      },
    ];

    it('isGroupAllChecked trả về true khi tất cả permission trong nhóm được chọn', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      act(() => {
        result.current.handlePermissionToggle(orgGroup[1], orgGroup, true);
      });
      expect(result.current.isGroupAllChecked(orgGroup)).toBe(true);
    });

    it('isGroupIndeterminate trả về true khi chỉ một phần permission được chọn', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      expect(result.current.isGroupIndeterminate(orgGroup)).toBe(true);
      expect(result.current.isGroupAllChecked(orgGroup)).toBe(false);
    });
  });

  describe('handleGroupAllChange', () => {
    const orgGroup = [
      {
        id: 1,
        code: 'ORG_VIEW',
        name: 'Xem',
        object: 'Đơn vị/tổ chức',
        action: 'xem',
        description: null,
      },
      {
        id: 2,
        code: 'ORG_CREATE',
        name: 'Thêm',
        object: 'Đơn vị/tổ chức',
        action: 'them',
        description: null,
      },
    ];

    it('check tất cả permission trong nhóm khi checked=true', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      act(() => {
        result.current.handleGroupAllChange(orgGroup, true);
      });
      expect(result.current.selectedPermissionIds.has(1)).toBe(true);
      expect(result.current.selectedPermissionIds.has(2)).toBe(true);
    });

    it('uncheck tất cả permission trong nhóm khi checked=false', () => {
      const { result } = renderHook(() => useRolePermissionMatrix(1));
      act(() => {
        result.current.handleGroupAllChange(orgGroup, true);
      });
      act(() => {
        result.current.handleGroupAllChange(orgGroup, false);
      });
      expect(result.current.selectedPermissionIds.has(1)).toBe(false);
      expect(result.current.selectedPermissionIds.has(2)).toBe(false);
    });
  });
});
