import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTablePattern } from '@/shared/hooks/useTablePattern';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Space } from 'antd';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import {
  DownloadOutlined,
  FileExcelOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { ROUTES } from '@/shared/constants/routes';
import { PageHeader, TableContainer } from '@/shared/components';
import { confirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { PermissionGuard } from '@/shared/components';
import { EmployeeFormModal } from '@/modules/employees/components/EmployeeFormModal';
import { EmployeeDetailDrawer } from '@/modules/employees/components/EmployeeDetailDrawer';
import { CreateAccountModal } from '@/modules/employees/components/CreateAccountModal';
import { ImportEmployeesModal } from '@/modules/employees/components/ImportEmployeesModal';
import { EmployeeStatusModal } from '@/modules/employees/components/EmployeeStatusModal';
import { useEmployeeStatusHistories } from '@/modules/employee-status/hooks/use-employee-status';
import { EmployeesFilter } from '@/modules/employees/components/EmployeesFilter';
import { EmployeesTable } from '@/modules/employees/components/EmployeesTable';
import type { EmployeeFormValues } from '@/modules/employees/schemas/employee.schema';
import {
  useEmployees,
  useEmployeeList,
  useEmployeeTrashedList,
  useCreateEmployee,
  useUpdateEmployee,
  useChangeEmployeeStatus,
  useCreateEmployeeAccount,
  useDeleteEmployee,
  useRestoreEmployee,
} from '@/modules/employees/hooks/use-employees';
import { toEmployeePayload } from '@/modules/employees/services/employee.mapper';
import {
  exportEmployeesExcel,
  downloadEmployeeImportTemplate,
  exportEmployeesPdf,
} from '@/modules/employees/schemas/employees.export';
import { useOrgUnits } from '@/modules/org-units/hooks/use-org-units';
import { useDepartments } from '@/modules/departments/hooks/use-departments';
import { usePositions } from '@/modules/positions/hooks/use-positions';
import { usersService } from '@/modules/users/services/users.service';
import { userRoleScopesService } from '@/modules/roles/services/user-role-scopes.service';
import { useCreateAssignment } from '@/modules/employee-assignments/hooks/use-employee-assignments';
import {
  extractFieldErrors,
  getMutationErrorMessage,
} from '@/shared/api/api-error';
import {
  EmployeeStatus,
  type Employee,
  type EmployeeStatusChangePayload,
  type CreateAccountResult,
} from '../types/employees.types';
import type { EmployeeStatusPayload } from '../components/EmployeeStatusModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toOptions = (refs: { id: number; code: string; name: string }[]) =>
  refs.map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }));

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ----- Filter/pagination state (chuẩn hóa qua useTablePattern) -----
  const {
    search: keyword,
    setSearch: setKeyword,
    filters,
    setFilter,
    page,
    setPage,
    pageSize: perPage,
    setPageSize: setPerPage,
    getApiParams,
    resetFilters,
  } = useTablePattern({ initialPageSize: 15 });
  const orgFilter = (filters.orgFilter as number | 'all') ?? 'all';
  const deptFilter = (filters.deptFilter as number | 'all') ?? 'all';
  const positionFilter = (filters.positionFilter as number | 'all') ?? 'all';
  const statusFilter = (filters.statusFilter as string) ?? 'all';
  const accountStatusFilter = (filters.accountStatusFilter as string) ?? 'all';
  const debouncedKeyword = getApiParams().search;
  const handleKeywordChange = setKeyword;
  const [sortBy, setSortBy] = useState<string>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>();

  // Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleDownloadImportTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await downloadEmployeeImportTemplate();
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // ----- Data: bảng nhân sự (server-side paginated) -----
  const listParams = useMemo(
    () => ({
      page,
      per_page: perPage,
      keyword: debouncedKeyword || undefined,
      org_unit_id: orgFilter !== 'all' ? orgFilter : undefined,
      department_id: deptFilter !== 'all' ? deptFilter : undefined,
      position_id: positionFilter !== 'all' ? positionFilter : undefined,
      employee_status: statusFilter !== 'all' ? statusFilter : undefined,
      // Serialize sang query key `status` (xem employees.service.ts) — BE
      // không có `account_status`.
      account_status:
        accountStatusFilter !== 'all' ? accountStatusFilter : undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    }),
    [
      page,
      perPage,
      debouncedKeyword,
      orgFilter,
      deptFilter,
      positionFilter,
      statusFilter,
      accountStatusFilter,
      sortBy,
      sortOrder,
    ],
  );

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await exportEmployeesExcel(listParams);
    } finally {
      setExportingExcel(false);
    }
  };

  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportEmployeesPdf(listParams);
    } finally {
      setExportingPdf(false);
    }
  };

  const {
    data: pagedResult,
    isLoading,
    isError,
    error,
    refetch,
  } = useEmployeeList(listParams);

  const tableData = useMemo(() => pagedResult?.data ?? [], [pagedResult?.data]);
  const total = pagedResult?.meta?.total ?? 0;

  // ----- Trash view state -----
  const [showTrashed] = useState(false);
  const trashedListParams = useMemo(
    () => ({
      page,
      per_page: perPage,
    }),
    [page, perPage],
  );
  const {
    data: trashedResult,
    isLoading: isLoadingTrashed,
    refetch: refetchTrashed,
  } = useEmployeeTrashedList(trashedListParams);
  const trashedTableData = useMemo(
    () => trashedResult?.data ?? [],
    [trashedResult?.data],
  );
  const trashedTotal = trashedResult?.meta?.total ?? 0;

  // ----- Data: dropdown options (toàn bộ, không phân trang) -----
  const { data: allEmployees = [] } = useEmployees({
    include_assignments: true,
  });
  const { data: orgUnits = [] } = useOrgUnits({ enabled: true });
  const { data: departments = [] } = useDepartments();
  const { data: positions = [] } = usePositions();
  const orgUnitOptions = useMemo(() => toOptions(orgUnits), [orgUnits]);

  // P1: Lọc department options theo orgFilter đã chọn để tránh UX khó hiểu
  const departmentOptions = useMemo(() => {
    const allDeptOptions = toOptions(departments);
    if (orgFilter === 'all') return allDeptOptions;
    // Chỉ hiển thị departments thuộc org unit đã chọn
    return allDeptOptions.filter((dept) => {
      const deptData = departments.find((d) => d.id === dept.value);
      return deptData?.orgUnitId === orgFilter;
    });
  }, [departments, orgFilter]);

  const positionOptions = useMemo(() => toOptions(positions), [positions]);

  // ----- Mutations -----
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const changeStatusMutation = useChangeEmployeeStatus();
  const deleteEmployee = useDeleteEmployee();
  const restoreEmployee = useRestoreEmployee();

  // ----- Modal/drawer state -----
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formApiErrors, setFormApiErrors] = useState<Record<
    string,
    string
  > | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusChangingEmployee, setStatusChangingEmployee] =
    useState<Employee | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [pendingAccountEmployee, setPendingAccountEmployee] =
    useState<Employee | null>(null);
  const [accountResult, setAccountResult] =
    useState<CreateAccountResult | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const detailEmployee = useMemo(
    () => tableData.find((e) => e.id === detailId) ?? null,
    [tableData, detailId],
  );

  // Ngày hiệu lực gần nhất của nhân sự đang đổi trạng thái, để chặn đảo ngược
  // mốc thời gian giống rule ở EmployeeStatusPage.
  const { data: statusChangingHistoryResult } = useEmployeeStatusHistories(
    { employee_id: statusChangingEmployee?.id, limit: 100 },
    { enabled: statusModalOpen && !!statusChangingEmployee },
  );
  const statusChangingLastEffectiveDate = useMemo(() => {
    const items = statusChangingHistoryResult?.data ?? [];
    if (items.length === 0) return null;
    return items.reduce((latest, item) =>
      dayjs(item.effective_date).isAfter(dayjs(latest.effective_date))
        ? item
        : latest,
    ).effective_date;
  }, [statusChangingHistoryResult]);

  // ----- Handlers -----
  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setOpen(true);
  };

  const openChangeStatus = (emp: Employee) => {
    setStatusChangingEmployee(emp);
    setStatusModalOpen(true);
  };

  const openCreateAccount = (emp: Employee) => {
    setPendingAccountEmployee(emp);
    setAccountModalOpen(true);
  };

  const createAccountMutation = useCreateEmployeeAccount();
  const createAssignmentMutation = useCreateAssignment();

  const handleChangeStatus = (payload: EmployeeStatusPayload) => {
    if (!statusChangingEmployee) return;
    const apiPayload: EmployeeStatusChangePayload = {
      employee_status: payload.employeeStatus as EmployeeStatus,
      effective_date: payload.effectiveDate,
      note: payload.note ?? null,
    };
    changeStatusMutation.mutate(
      { id: statusChangingEmployee.id, ...apiPayload },
      {
        onSuccess: async () => {
          toast.success('Cập nhật trạng thái thành công');
          setStatusModalOpen(false);

          // P0.3: Vô hiệu hóa tài khoản liên kết (M9) khi chuyển sang Tạm ngưng / Nghỉ việc
          const isDeactivating =
            apiPayload.employee_status === EmployeeStatus.SUSPENDED ||
            apiPayload.employee_status === EmployeeStatus.RESIGNED;

          if (isDeactivating) {
            if (
              statusChangingEmployee.user_id &&
              statusChangingEmployee.accountStatus === 1
            ) {
              try {
                await usersService.inactive(statusChangingEmployee.user_id, {
                  reason:
                    apiPayload.note ??
                    'Thay đổi trạng thái nhân sự sang Tạm ngưng/Nghỉ việc',
                  effective_date: apiPayload.effective_date || undefined,
                });
                toast.success('Đồng thời đã vô hiệu hóa tài khoản liên kết');
              } catch (err) {
                toast.error(
                  'Lỗi khi vô hiệu hóa tài khoản liên kết: ' +
                    getMutationErrorMessage(err),
                );
              }
            }

            // Thu hồi vai trò và quyền hạn
            if (statusChangingEmployee.user_id) {
              try {
                const userId = statusChangingEmployee.user_id;
                const [roleScopesResult, dataScopes] = await Promise.all([
                  userRoleScopesService.getUserRoles({
                    user_id: userId,
                    per_page: 100,
                  }),
                  userRoleScopesService.getUserDataScopes(userId),
                ]);
                const activeRoleScopes = roleScopesResult.data.filter(
                  (r) => !r.revoked_at,
                );
                const activeDataScopes = dataScopes.filter(
                  (d) => !d.revoked_at,
                );

                const autoRevokeReason = 'Nhân viên bị vô hiệu hóa';
                await Promise.all([
                  ...activeRoleScopes.map((r) =>
                    userRoleScopesService.revokeRoleFromUser(
                      r.id,
                      autoRevokeReason,
                    ),
                  ),
                  ...activeDataScopes.map((d) =>
                    userRoleScopesService.revokeDataScope(
                      d.id,
                      autoRevokeReason,
                    ),
                  ),
                ]);

                if (activeRoleScopes.length || activeDataScopes.length) {
                  toast.success(
                    `Đã thu hồi ${activeRoleScopes.length} vai trò và ${activeDataScopes.length} phạm vi dữ liệu liên kết`,
                  );
                  queryClient.invalidateQueries({
                    queryKey: ['user-role-scopes'],
                  });
                  queryClient.invalidateQueries({ queryKey: ['data-scopes'] });
                }
              } catch (err) {
                toast.error(
                  'Lỗi khi thu hồi vai trò/quyền hạn: ' +
                    getMutationErrorMessage(err),
                );
              }
            }
          } else {
            // Tái kích hoạt tài khoản liên kết (M9) khi quay lại hoạt động
            if (
              statusChangingEmployee.user_id &&
              statusChangingEmployee.accountStatus === 0
            ) {
              try {
                await usersService.restore(statusChangingEmployee.user_id);
                toast.success('Đồng thời đã tái kích hoạt tài khoản liên kết');
              } catch (err) {
                toast.error(
                  'Lỗi khi tái kích hoạt tài khoản liên kết: ' +
                    getMutationErrorMessage(err),
                );
              }
            }
          }
        },
        onError: (e: unknown) => toast.error(getMutationErrorMessage(e)),
      },
    );
  };

  const confirmAndDelete = (emp: Employee) => {
    confirmDialog({
      title: 'Xóa nhân sự',
      content: `Bạn có chắc chắn muốn xóa nhân sự "${emp.fullName}"? Đây là xóa mềm (dữ liệu vẫn được lưu, không xóa vĩnh viễn) — có thể khôi phục lại sau.`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      danger: true,
      onOk: () => {
        deleteEmployee.mutate(emp.id, {
          onSuccess: () => {
            toast.success('Xóa nhân sự thành công');
          },
          onError: (e: unknown) => toast.error(getMutationErrorMessage(e)),
        });
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) return;
    confirmDialog({
      title: 'Xóa nhân sự',
      content: `Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} nhân sự đã chọn? Đây là xóa mềm (dữ liệu vẫn được lưu, không xóa vĩnh viễn) — có thể khôi phục lại sau.`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      danger: true,
      onOk: () => {
        let completed = 0;
        selectedRowKeys.forEach((id) => {
          deleteEmployee.mutate(id as number, {
            onSuccess: () => {
              completed++;
              if (completed === selectedRowKeys.length) {
                toast.success(`Đã xóa ${selectedRowKeys.length} nhân sự`);
                setSelectedRowKeys([]);
              }
            },
            onError: (e: unknown) => toast.error(getMutationErrorMessage(e)),
          });
        });
      },
    });
  };

  const handleSubmit = async (values: EmployeeFormValues) => {
    const payload = toEmployeePayload(values);
    setFormApiErrors(null);

    const onError = (e: unknown) => {
      const fieldErrors = extractFieldErrors(e);
      if (fieldErrors) setFormApiErrors(fieldErrors);
      else toast.error(getMutationErrorMessage(e));
    };

    if (editing) {
      updateEmployee.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            toast.success('Đã cập nhật nhân sự');
            setOpen(false);
          },
          onError,
        },
      );
      return;
    }

    // ----- P0 FIX: Atomic create employee + assignment -----
    // BE bỏ qua org_unit_id/department_id/position_id trong payload /employees
    // (xác minh thật 2026-07-05) — phải tạo phân công chính qua API riêng
    // /employee-assignments. Dùng mutateAsync để đảm bảo cả 2 request đều thành
    // công trước khi đóng modal / toast success.
    let newEmp;
    try {
      newEmp = await createEmployee.mutateAsync(payload);
    } catch (e) {
      // Employee tạo thất bại → extractFieldErrors hiển thị lỗi field, giữ modal mở.
      onError(e);
      return;
    }

    if (!(values.orgUnitId && values.departmentId && values.positionId)) {
      setOpen(false);
      toast.success(
        payload.password
          ? 'Đã thêm nhân sự và cấp tài khoản đăng nhập'
          : 'Đã thêm nhân sự',
      );
      return;
    }

    try {
      await createAssignmentMutation.mutateAsync({
        employee_id: newEmp.id,
        org_unit_id: values.orgUnitId,
        department_id: values.departmentId,
        position_id: values.positionId,
        is_primary: true,
        start_date: values.hireDate
          ? values.hireDate.format('YYYY-MM-DD')
          : dayjs().format('YYYY-MM-DD'),
        status: true,
      });

      // Cả employee + assignment đều thành công → mới đóng modal + toast
      setOpen(false);
      toast.success(
        payload.password
          ? 'Đã thêm nhân sự và cấp tài khoản đăng nhập'
          : 'Đã thêm nhân sự',
      );
    } catch (e) {
      // Employee đã tạo thành công (đã có id) nhưng gán phân công thất bại →
      // KHÔNG toast success, KHÔNG đóng modal ở trạng thái "coi như xong".
      // Tự động rollback (soft-delete) employee vừa tạo để tránh để lại bản
      // ghi "mồ côi" không có phân công.
      setOpen(false);
      // Compensating rollback ở tầng FE, không phải DB transaction thật (xem
      // docs/tickets/BE_EMPLOYEE_CREATE_ASSIGNMENT_TRANSACTION_TICKET.md) —
      // retry vài lần trước khi coi là rollback thất bại, để giảm khả năng
      // rollback tự fail do lỗi mạng thoáng qua.
      const ROLLBACK_MAX_ATTEMPTS = 3;
      let rollbackSucceeded = false;
      for (let attempt = 1; attempt <= ROLLBACK_MAX_ATTEMPTS; attempt++) {
        try {
          await deleteEmployee.mutateAsync(newEmp.id);
          rollbackSucceeded = true;
          break;
        } catch {
          if (attempt < ROLLBACK_MAX_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }
        }
      }
      if (rollbackSucceeded) {
        toast.error(
          `Tạo nhân sự "${newEmp.fullName}" (${newEmp.code}) thất bại vì gán đơn vị/phòng ban/chức vụ lỗi: ${getMutationErrorMessage(e)}. Đã tự động hoàn tác (xóa nhân sự vừa tạo).`,
          { duration: 10000 },
        );
      } else {
        toast.error(
          `Đã tạo nhân sự "${newEmp.fullName}" (${newEmp.code}) nhưng gán đơn vị/phòng ban/chức vụ thất bại: ${getMutationErrorMessage(e)}. Hoàn tác tự động cũng thất bại.`,
          {
            duration: 15000,
            action: {
              label: 'Điều chuyển ngay',
              onClick: () => {
                navigate(
                  `${ROUTES.EMPLOYEE_ASSIGNMENTS}?employee_id=${newEmp.id}`,
                );
              },
            },
          },
        );
      }
    }
  };

  const handleConfirmCreateAccount = () => {
    if (!pendingAccountEmployee) return;
    createAccountMutation.mutate(
      { id: pendingAccountEmployee.id },
      {
        onSuccess: (result) => {
          toast.success('Cấp tài khoản thành công');
          // Giữ modal mở để hiển thị mật khẩu tạm (chỉ trả về đúng 1 lần) —
          // đóng hẳn khi người dùng bấm "Đã lưu, đóng".
          setAccountResult(result);
        },
        onError: (err) => {
          toast.error('Lỗi khi cấp tài khoản: ' + getMutationErrorMessage(err));
        },
      },
    );
  };

  const handleCloseCreateAccount = () => {
    setAccountModalOpen(false);
    setPendingAccountEmployee(null);
    setAccountResult(null);
  };

  const handleTransfer = (emp: Employee) => {
    navigate(`${ROUTES.EMPLOYEE_ASSIGNMENTS}?employee_id=${emp.id}`);
  };

  const handleRestore = (emp: Employee) => {
    confirmDialog({
      title: 'Khôi phục nhân sự',
      content: `Bạn có chắc chắn muốn khôi phục nhân sự "${emp.fullName}" khỏi thùng rác? Trạng thái làm việc/tài khoản sẽ không tự đổi; nếu cần, hãy dùng chức năng Đổi trạng thái sau khi khôi phục.`,
      okText: 'Khôi phục',
      cancelText: 'Hủy',
      onOk: () => {
        restoreEmployee.mutate(emp.id, {
          onSuccess: () => {
            toast.success('Khôi phục nhân sự thành công');
            // Làm mới cả 2 view (active + trashed)
            refetch();
            refetchTrashed();
          },
          onError: (e: unknown) => toast.error(getMutationErrorMessage(e)),
        });
      },
    });
  };

  // P1: Reset deptFilter khi orgFilter thay đổi nếu dept hiện tại không thuộc org mới
  const previousOrgFilterRef = useRef<(number | 'all') | null>(null);
  useEffect(() => {
    const previousOrgFilter = previousOrgFilterRef.current;
    const currentOrgFilter = orgFilter;

    if (previousOrgFilter != null && previousOrgFilter !== currentOrgFilter) {
      if (deptFilter !== 'all') {
        const deptData = departments.find((d) => d.id === deptFilter);
        if (deptData && deptData.orgUnitId !== currentOrgFilter) {
          setFilter('deptFilter', 'all');
        }
      }
    }

    previousOrgFilterRef.current = currentOrgFilter;
  }, [orgFilter, deptFilter, departments, setFilter]);

  const isFiltering =
    debouncedKeyword !== '' ||
    orgFilter !== 'all' ||
    deptFilter !== 'all' ||
    positionFilter !== 'all' ||
    statusFilter !== 'all' ||
    accountStatusFilter !== 'all';
  const hasSelection = selectedRowKeys.length > 0;

  // Determine which data to display based on trash view
  const currentTableData = showTrashed ? trashedTableData : tableData;
  const currentTotal = showTrashed ? trashedTotal : total;
  const currentIsLoading = showTrashed ? isLoadingTrashed : isLoading;

  return (
    <div>
      <PageHeader
        title="Nhân sự"
        subtitle="Danh sách nhân sự theo đơn vị, phòng ban và chức vụ."
      />

      <TableContainer
        title={undefined}
        toolbar={
          <EmployeesFilter
            keyword={keyword}
            onKeywordChange={handleKeywordChange}
            orgFilter={orgFilter}
            onOrgFilterChange={(v) => setFilter('orgFilter', v)}
            deptFilter={deptFilter}
            onDeptFilterChange={(v) => setFilter('deptFilter', v)}
            positionFilter={positionFilter}
            onPositionFilterChange={(v) => setFilter('positionFilter', v)}
            orgOptions={orgUnitOptions}
            deptOptions={departmentOptions}
            positionOptions={positionOptions}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => setFilter('statusFilter', v)}
            accountStatusFilter={accountStatusFilter}
            onAccountStatusFilterChange={(v: string) =>
              setFilter('accountStatusFilter', v)
            }
            actions={
              <>
                {hasSelection && !showTrashed && (
                  <Space>
                    <PermissionGuard module="employees" action="delete">
                      <Button size="small" danger onClick={handleBulkDelete}>
                        Xóa ({selectedRowKeys.length})
                      </Button>
                    </PermissionGuard>
                  </Space>
                )}
                <PermissionGuard module="employees" action="export">
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportExcel}
                    loading={exportingExcel}
                    disabled={exportingPdf}
                  >
                    Xuất Excel
                  </Button>
                </PermissionGuard>
                <PermissionGuard module="employees" action="export">
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportPdf}
                    loading={exportingPdf}
                    disabled={exportingExcel}
                  >
                    Xuất PDF
                  </Button>
                </PermissionGuard>
                <PermissionGuard module="employees" action="import">
                  <Button
                    icon={<UploadOutlined />}
                    onClick={() => setImportModalOpen(true)}
                  >
                    Nhập Excel
                  </Button>
                </PermissionGuard>
                <PermissionGuard module="employees" action="import">
                  <Button
                    icon={<FileExcelOutlined />}
                    onClick={handleDownloadImportTemplate}
                    loading={downloadingTemplate}
                  >
                    Tải mẫu
                  </Button>
                </PermissionGuard>
                {!showTrashed && (
                  <PermissionGuard module="employees" action="create">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openCreate}
                    >
                      Thêm nhân sự
                    </Button>
                  </PermissionGuard>
                )}
              </>
            }
          />
        }
        loading={currentIsLoading && currentTableData.length === 0}
        error={isError ? error : null}
        errorTitle={
          showTrashed
            ? 'Không tải được danh sách nhân sự đã xóa'
            : 'Không tải được danh sách nhân sự'
        }
        onRetry={showTrashed ? refetchTrashed : refetch}
        isEmpty={currentTableData.length === 0}
        isFilterActive={isFiltering}
        onClearFilters={resetFilters}
        emptyState={{
          title: showTrashed
            ? 'Chưa có nhân sự đã xóa'
            : isFiltering
              ? 'Chưa có nhân sự khớp bộ lọc'
              : 'Chưa có nhân sự',
          description: showTrashed
            ? 'Danh sách trống.'
            : isFiltering
              ? 'Thử xóa bộ lọc để xem toàn bộ.'
              : 'Tạo mới nhân sự để bắt đầu.',
          action: !showTrashed && !isFiltering && (
            <PermissionGuard module="employees" action="create">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                Thêm nhân sự
              </Button>
            </PermissionGuard>
          ),
        }}
      >
        <EmployeesTable
          data={currentTableData}
          loading={currentIsLoading}
          isChangingStatus={changeStatusMutation.isPending}
          isDeleting={deleteEmployee.isPending}
          serverPagination={{
            current: page,
            pageSize: perPage,
            total: currentTotal,
            onChange: (p, ps) => {
              setPage(p);
              setPerPage(ps);
            },
          }}
          onSortChange={(field, order) => {
            setSortBy(field);
            setSortOrder(order);
            setPage(1);
          }}
          onView={(emp) => setDetailId(emp.id)}
          onEdit={showTrashed ? undefined : openEdit}
          onTransfer={showTrashed ? undefined : handleTransfer}
          onChangeStatus={showTrashed ? undefined : openChangeStatus}
          onDelete={showTrashed ? undefined : confirmAndDelete}
          onCreateAccount={showTrashed ? undefined : openCreateAccount}
          onRestore={showTrashed ? handleRestore : undefined}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={(keys) => setSelectedRowKeys(keys as React.Key[])}
        />
      </TableContainer>

      <EmployeeFormModal
        open={open}
        editing={editing}
        submitting={
          createEmployee.isPending ||
          updateEmployee.isPending ||
          createAssignmentMutation.isPending
        }
        orgUnitOptions={orgUnitOptions}
        departments={departments}
        positionOptions={positionOptions}
        employees={allEmployees}
        onCancel={() => {
          setOpen(false);
          setFormApiErrors(null);
        }}
        onSubmit={handleSubmit}
        apiErrors={formApiErrors}
      />

      <EmployeeDetailDrawer
        open={detailId !== null}
        employee={detailEmployee}
        onClose={() => setDetailId(null)}
      />

      <EmployeeStatusModal
        open={statusModalOpen}
        employee={statusChangingEmployee}
        lastEffectiveDate={statusChangingLastEffectiveDate}
        loading={changeStatusMutation.isPending}
        onCancel={() => setStatusModalOpen(false)}
        onConfirm={handleChangeStatus}
      />

      <CreateAccountModal
        open={accountModalOpen}
        employee={pendingAccountEmployee}
        loading={createAccountMutation.isPending}
        result={accountResult}
        onCancel={() => {
          if (
            !accountResult &&
            pendingAccountEmployee &&
            !pendingAccountEmployee.user_id
          ) {
            toast.warning(
              'Nhân sự chưa có tài khoản đăng nhập. Bạn có thể cấp tài khoản sau bằng thao tác "Cấp tài khoản" trong danh sách.',
            );
          }
          handleCloseCreateAccount();
        }}
        onConfirm={handleConfirmCreateAccount}
      />

      <ImportEmployeesModal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
      />
    </div>
  );
}
