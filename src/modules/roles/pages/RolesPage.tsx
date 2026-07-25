import { useEffect, useState } from 'react';
import { Col, Row } from 'antd';
import { toast } from 'sonner';
import { PageHeader, ApiErrorAlert } from '@/shared/components';
import { getMutationErrorMessage } from '@/shared/api/api-error';
import {
  useCreateRole,
  useDeleteRole,
  useRoles,
  useRoleUserCounts,
  useUpdateRole,
} from '../hooks/use-roles';
import { RoleFormModal } from '../components/RoleFormModal';
import { RoleListSidebar } from '../components/RoleListSidebar';
import { RolePermissionMatrixPanel } from '../components/RolePermissionMatrixPanel';
import type { RoleFormValues } from '../schemas/role.schema';
import type { Role } from '../types/roles.types';

const DEFAULT_PER_PAGE = 15;

export function RolesPage() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  /** Role đang sửa (edit mode). null = tạo mới. */
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Role đang được chọn để cấu hình ma trận quyền.
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  const {
    data: rolesResult,
    isLoading,
    isError,
    error,
    refetch,
  } = useRoles({
    page,
    per_page: perPage,
    search: searchQuery || undefined,
  });
  const roles = rolesResult?.data ?? [];
  const rolesTotal = rolesResult?.meta?.total ?? 0;

  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const deleteMutation = useDeleteRole();

  // Số nhân viên (distinct user) được gán cho TỪNG vai trò — dữ liệu thật từ
  // bảng `user_role_scopes` (thay thế mock `getMockUsersCount` cũ, bị đánh giá
  // P0.1). `undefined` khi đang tải/lỗi để UI hiển thị placeholder thay số ảo.
  const { data: roleUserCounts } = useRoleUserCounts();
  const getUserCount = (roleId: number): number | undefined =>
    roleUserCounts?.[roleId];

  // Chọn role đầu tiên làm mặc định khi danh sách vừa tải xong.
  const firstRoleId = roles[0]?.id;
  useEffect(() => {
    if (firstRoleId !== undefined && selectedRoleId === null) {
      setSelectedRoleId(firstRoleId); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [firstRoleId, selectedRoleId]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const openCreate = () => {
    setEditingRole(null);
    setOpen(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setOpen(true);
  };

  const handleDelete = (id: number) => {
    const target = roles.find((r) => r.id === id);
    if (target?.is_super_admin) {
      toast.error('Vai trò hệ thống không được phép vô hiệu hóa');
      return;
    }
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Đã vô hiệu hóa vai trò');
        if (selectedRoleId === id) {
          const remaining = roles.filter((r) => r.id !== id);
          setSelectedRoleId(remaining.length > 0 ? remaining[0].id : null);
        }
      },
      onError: (err: unknown) => toast.error(getMutationErrorMessage(err)),
    });
  };

  const handleSubmit = (values: RoleFormValues) => {
    const handleSuccess = (res: { id?: number }) => {
      if (editingRole) {
        toast.success('Đã cập nhật vai trò');
      } else {
        toast.success('Đã thêm vai trò');
      }
      setOpen(false);
      setEditingRole(null);
      if (res?.id) {
        setSelectedRoleId(res.id);
      }
    };

    const handleError = (err: unknown) =>
      toast.error(getMutationErrorMessage(err));

    if (editingRole) {
      updateMutation.mutate(
        { id: editingRole.id, payload: values },
        { onSuccess: handleSuccess, onError: handleError },
      );
    } else {
      createMutation.mutate(values, {
        onSuccess: handleSuccess,
        onError: handleError,
      });
    }
  };

  const isMutationPending =
    createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <PageHeader
        title="Vai trò & Quyền"
        subtitle="Quản lý vai trò người dùng và phân bổ ma trận quyền hạn chức năng hệ thống."
      />

      {isError && (
        <ApiErrorAlert
          error={error}
          title="Không tải được danh sách vai trò"
          onRetry={refetch}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={7}>
          <RoleListSidebar
            roles={roles}
            rolesTotal={rolesTotal}
            isLoading={isLoading}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            page={page}
            perPage={perPage}
            onPageChange={(nextPage, nextPageSize) => {
              setPage(nextPage);
              if (nextPageSize !== perPage) setPerPage(nextPageSize);
            }}
            selectedRoleId={selectedRoleId}
            onSelectRole={setSelectedRoleId}
            getUserCount={getUserCount}
            onCreate={openCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            deletePendingId={
              deleteMutation.isPending
                ? (deleteMutation.variables as number | undefined)
                : undefined
            }
          />
        </Col>

        <Col xs={24} md={17} style={{ display: 'flex' }}>
          <RolePermissionMatrixPanel selectedRoleId={selectedRoleId} />
        </Col>
      </Row>

      <RoleFormModal
        open={open}
        editingRole={editingRole}
        isPending={isMutationPending}
        onCancel={() => {
          setOpen(false);
          setEditingRole(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
