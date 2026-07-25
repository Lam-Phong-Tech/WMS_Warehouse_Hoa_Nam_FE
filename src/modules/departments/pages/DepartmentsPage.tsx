import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  App,
  Button,
  Card,
  Flex,
  Segmented,
  Skeleton,
  Space,
  theme,
} from 'antd';
import { toast } from 'sonner';
import {
  ApartmentOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  PageHeader,
  ApiErrorAlert,
  EmptyState,
  TableContainer,
} from '@/shared/components';
import {
  extractFieldErrors,
  getMutationErrorMessage,
} from '@/shared/api/api-error';
import { PermissionGuard } from '@/shared/components';
import { usePermission } from '@/shared/components/permission';
import { DepartmentFormModal } from '@/modules/departments/components/DepartmentFormModal';
import { DepartmentsFilter } from '@/modules/departments/components/DepartmentsFilter';
import { DepartmentsTable } from '@/modules/departments/components/DepartmentsTable';
import { DepartmentDetailDrawer } from '@/modules/departments/components/DepartmentDetailDrawer';
import { DepartmentTree } from '@/modules/departments/components/DepartmentTree';
import { DeactivateDepartmentModal } from '@/modules/departments/components/DeactivateDepartmentModal';
import type { DepartmentFormValues } from '@/modules/departments/schemas/department.schema';
import type {
  Department,
  DepartmentTreeNode,
} from '@/modules/departments/types/departments.types';
import { getPrimaryAssignment } from '@/modules/employees/types/employees.types';
import { useTablePattern } from '@/shared/hooks/useTablePattern';
import { useEmployees } from '@/modules/employees/hooks/use-employees';
import { useOrgUnits } from '@/modules/org-units/hooks/use-org-units';
import {
  useCreateDepartment,
  useDepartment,
  useDepartmentList,
  useDepartmentsTree,
  useInactiveDepartment,
  useActivateDepartment,
  useUpdateDepartment,
  useRestoreDepartment,
  useSoftDeleteDepartment,
} from '@/modules/departments/hooks/use-departments';
import {
  exportDepartmentsExcel,
  exportDepartmentsPdf,
} from '@/modules/departments/components/departments.export';

type ViewMode = 'tree' | 'table';

export function DepartmentsPage() {
  const { modal } = App.useApp();
  const { token } = theme.useToken();
  // Export yêu cầu CẢ quyền xem lẫn xuất, và mỗi quyền đều phải đạt scope
  // requirement riêng (usePermission tự kiểm tra scope theo module+action) —
  // không dùng useCanAll() vì hook đó chỉ so permission code, bỏ qua scope.
  const { can: canViewDept } = usePermission({
    module: 'departments',
    action: 'view',
  });
  const { can: canExportDept } = usePermission({
    module: 'departments',
    action: 'export',
  });
  const canExport = canViewDept && canExportDept;

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [subgroupParent, setSubgroupParent] = useState<Department | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [searchParams] = useSearchParams();

  // Parse detail ID from URL search params
  const detailIdFromUrl = useMemo(() => {
    const idParam = searchParams.get('id');
    if (idParam == null) return null;
    const parsed = Number(idParam);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  // Mở drawer chi tiết trực tiếp khi vào trang kèm ?id=...
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (detailIdFromUrl != null && detailIdFromUrl !== detailId) {
      setDetailId(detailIdFromUrl);
    }
  }, [detailIdFromUrl, detailId]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [softDeletingDept, setSoftDeletingDept] =
    useState<DepartmentTreeNode | null>(null);
  const [formApiErrors, setFormApiErrors] = useState<Record<
    string,
    string
  > | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const handleGeneratingCodeChange = useCallback((generating: boolean) => {
    setIsGeneratingCode(generating);
  }, []);

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
  const statusFilter = (filters.statusFilter as string) ?? 'all';
  const debouncedKeyword = getApiParams().search;
  const handleKeywordChange = setKeyword;
  const [sortBy, setSortBy] = useState<string>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>();

  // ----- Tree data (used in tree view) -----
  const {
    data: treeDataRaw,
    isLoading: isTreeLoading,
    error: treeError,
  } = useDepartmentsTree();
  const treeData = treeDataRaw as DepartmentTreeNode[] | undefined;

  // ----- Server-side list (bảng chính, used in table view) -----
  const listParams = useMemo(
    () => ({
      page,
      per_page: perPage,
      keyword: debouncedKeyword || undefined,
      org_unit_id: orgFilter !== 'all' ? orgFilter : undefined,
      status:
        statusFilter === 'active'
          ? 1
          : statusFilter === 'inactive'
            ? 0
            : undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    }),
    [
      page,
      perPage,
      debouncedKeyword,
      orgFilter,
      statusFilter,
      sortBy,
      sortOrder,
    ],
  );

  const {
    data: pagedResult,
    isLoading,
    error,
  } = useDepartmentList(viewMode === 'table' ? listParams : undefined);

  const tableData = (pagedResult?.data ?? []) as DepartmentTreeNode[];
  const total = pagedResult?.meta?.total ?? 0;

  // ----- Reference data (dropdown options) -----
  const {
    data: orgUnits = [],
    isLoading: orgUnitsLoading,
    isError: orgUnitsError,
  } = useOrgUnits({ enabled: true });
  const {
    data: employees = [],
    isLoading: employeesLoading,
    isError: employeesError,
  } = useEmployees({ include_assignments: true });

  const orgUnitOptions = useMemo(
    () => orgUnits.map((o) => ({ value: o.id, label: `${o.name}` })),
    [orgUnits],
  );

  // Flatten tree data for detail panel lookup and filtering
  const allDepts = useMemo(() => {
    if (!treeData) return [];
    const flat: DepartmentTreeNode[] = [];
    function walk(nodes: DepartmentTreeNode[]) {
      for (const n of nodes) {
        flat.push(n);
        if (n.children?.length) walk(n.children);
      }
    }
    walk(treeData);
    return flat;
  }, [treeData]);

  // ----- Mutations -----
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const inactiveMutation = useInactiveDepartment();
  const activateMutation = useActivateDepartment();
  const softDeleteMutation = useSoftDeleteDepartment();
  const restoreMutation = useRestoreDepartment();
  const { data: detail, isLoading: detailLoading } = useDepartment(detailId);

  const detailMembers = useMemo(
    () =>
      detailId == null
        ? []
        : employees.filter(
            (e) => getPrimaryAssignment(e)?.department_id === detailId,
          ),
    [employees, detailId],
  );

  // Selected department for detail drawer (from tree or table)
  const selectedDeptFromTree = useMemo(
    () => allDepts.find((d) => d.id === detailId) ?? null,
    [allDepts, detailId],
  );
  const selectedDept =
    viewMode === 'tree' ? selectedDeptFromTree : (detail ?? null);

  // ----- Handlers -----
  const openCreate = () => {
    setEditing(null);
    setSubgroupParent(null);
    setOpen(true);
  };
  const openEdit = (dept: Department) => {
    setEditing(dept);
    setSubgroupParent(null);
    setOpen(true);
  };
  const openCreateSubgroup = (parent: Department) => {
    setEditing(null);
    setSubgroupParent(parent);
    setOpen(true);
  };
  // Vô hiệu hóa (active → inactive): PUT /departments/{id} status=0
  const handleInactive = (dept: DepartmentTreeNode) => {
    modal.confirm({
      title: 'Vô hiệu hóa phòng ban',
      content: `Phòng ban "${dept.name}" sẽ chuyển sang trạng thái "Ngừng hoạt động": bị ẩn khỏi danh sách chọn nhưng vẫn tra cứu được. Không vào thùng rác — khác với xóa (xóa mềm sẽ đổi trạng thái thành "Đã xóa chờ khôi phục" và có hạn 14 ngày).`,
      okButtonProps: { danger: true },
      onOk: () =>
        inactiveMutation.mutate(dept, {
          onSuccess: () => {
            toast.success(`Đã vô hiệu hóa phòng ban "${dept.name}".`);
            if (detailId === dept.id) setDetailId(null);
          },
          onError: (err) => toast.error(getMutationErrorMessage(err)),
        }),
    });
  };

  // Kích hoạt lại (inactive → active): PUT /departments/{id} status=1.
  const handleActivate = (dept: DepartmentTreeNode) => {
    modal.confirm({
      title: 'Kích hoạt lại phòng ban',
      content: `Phòng ban "${dept.name}" sẽ hoạt động trở lại và hiện trong danh sách chọn.`,
      onOk: () =>
        activateMutation.mutate(dept, {
          onSuccess: () =>
            toast.success(`Đã kích hoạt lại phòng ban "${dept.name}".`),
          onError: (err) => toast.error(getMutationErrorMessage(err)),
        }),
    });
  };

  // Xóa mềm (active/inactive → soft_deleted): mở modal xác nhận riêng (khung F).
  const handleSoftDelete = (dept: DepartmentTreeNode) => {
    setSoftDeletingDept(dept);
  };

  const handleConfirmSoftDelete = () => {
    if (!softDeletingDept) return;

    softDeleteMutation.mutate(softDeletingDept.id, {
      onSuccess: () => {
        toast.success('Đã xóa phòng ban. Khôi phục được trong 14 ngày.');
        if (detailId === softDeletingDept.id) setDetailId(null);
        setSoftDeletingDept(null);
      },
      onError: (err) => toast.error(getMutationErrorMessage(err)),
    });
  };

  const handleBulkSoftDelete = () => {
    if (selectedRowKeys.length === 0) return;
    modal.confirm({
      title: 'Xóa phòng ban',
      content: `Bạn có chắc muốn xóa ${selectedRowKeys.length} phòng ban đã chọn?`,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      onOk: () => {
        let completed = 0;
        selectedRowKeys.forEach((id) => {
          softDeleteMutation.mutate(id as number, {
            onSuccess: () => {
              completed++;
              if (completed === selectedRowKeys.length) {
                toast.success(`Đã xóa ${selectedRowKeys.length} phòng ban`);
                setSelectedRowKeys([]);
              }
            },
            onError: (err) => toast.error(getMutationErrorMessage(err)),
          });
        });
      },
    });
  };

  const handleDeactivateDept = (dept: Department) =>
    handleInactive({ ...dept, children: undefined });

  const handleSubmit = (values: DepartmentFormValues) => {
    setFormApiErrors(null);
    const onError = (err: unknown) => {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) setFormApiErrors(fieldErrors);
      else toast.error(getMutationErrorMessage(err));
    };
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            toast.success('Đã cập nhật phòng ban');
            setOpen(false);
          },
          onError,
        },
      );
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          toast.success('Đã thêm phòng ban');
          setOpen(false);
          setSubgroupParent(null);
        },
        onError,
      });
    }
  };

  const isMutationPending =
    createMutation.isPending || updateMutation.isPending || isGeneratingCode;
  const isFiltering =
    debouncedKeyword !== '' || orgFilter !== 'all' || statusFilter !== 'all';
  const hasSelection = selectedRowKeys.length > 0;
  const displayData: DepartmentTreeNode[] = tableData;

  const handleViewModeChange = (v: ViewMode) => {
    setViewMode(v);
    setDetailId(null);
  };

  const handleExportExcel = async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    try {
      await exportDepartmentsExcel(listParams);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await exportDepartmentsPdf(listParams);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const addButton = (
    <PermissionGuard module="departments" action="create">
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
        Thêm phòng ban
      </Button>
    </PermissionGuard>
  );

  const viewModeToggle = (
    <Segmented
      value={viewMode}
      onChange={(v) => handleViewModeChange(v as ViewMode)}
      options={[
        {
          value: 'tree',
          icon: <ApartmentOutlined />,
          label: 'Dạng cây',
        },
        {
          value: 'table',
          icon: <UnorderedListOutlined />,
          label: 'Danh sách',
        },
      ]}
    />
  );

  // Auto-navigate back to page 1 if current page is empty
  useEffect(() => {
    if (
      viewMode === 'table' &&
      !isLoading &&
      !error &&
      page > 1 &&
      pagedResult?.data?.length === 0
    ) {
      const timer = setTimeout(() => setPage(1), 0);
      return () => clearTimeout(timer);
    }
  }, [viewMode, isLoading, error, page, pagedResult, setPage]);

  return (
    <div>
      <PageHeader
        title="Phòng ban"
        subtitle="Danh sách phòng ban trực thuộc các đơn vị tổ chức."
      />

      {viewMode === 'tree' ? (
        <Card variant="borderless">
          <DepartmentsFilter
            keyword={keyword}
            onKeywordChange={handleKeywordChange}
            orgFilter={orgFilter}
            onOrgFilterChange={(v) => setFilter('orgFilter', v)}
            orgOptions={orgUnitOptions}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => setFilter('statusFilter', v)}
            actions={
              <>
                {viewModeToggle}
                {addButton}
              </>
            }
          />
          {treeError && (
            <ApiErrorAlert
              error={treeError}
              title="Không thể tải dữ liệu cơ cấu phòng ban"
              style={{ marginBottom: 16 }}
            />
          )}

          {isTreeLoading && !treeData?.length ? (
            <div style={{ padding: 24 }}>
              <div
                style={{
                  marginBottom: 12,
                  color: token.colorTextDescription,
                }}
              >
                Đang tải sơ đồ cơ cấu phòng ban...
              </div>
              <Skeleton active paragraph={{ rows: 5 }} />
            </div>
          ) : !isTreeLoading && !treeError && !treeData?.length ? (
            <EmptyState
              title="Chưa có phòng ban nào"
              description="Tạo mới phòng ban để bắt đầu."
            >
              <PermissionGuard module="departments" action="create">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreate}
                >
                  Thêm phòng ban
                </Button>
              </PermissionGuard>
            </EmptyState>
          ) : (
            <Flex flex={1} style={{ minHeight: 0, overflow: 'hidden' }}>
              <div
                style={{
                  width: '100%',
                  overflowY: 'auto',
                  padding: '10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <DepartmentTree
                  treeData={treeData}
                  keyword={debouncedKeyword || keyword}
                  orgFilter={orgFilter}
                  statusFilter={statusFilter}
                  loading={isTreeLoading}
                  selectedId={detailId}
                  onSelect={(id) => setDetailId(id)}
                />
              </div>
            </Flex>
          )}
        </Card>
      ) : (
        <TableContainer
          title={undefined}
          toolbar={
            <DepartmentsFilter
              keyword={keyword}
              onKeywordChange={handleKeywordChange}
              orgFilter={orgFilter}
              onOrgFilterChange={(v) => setFilter('orgFilter', v)}
              orgOptions={orgUnitOptions}
              statusFilter={statusFilter}
              onStatusFilterChange={(v) => setFilter('statusFilter', v)}
              actions={
                <>
                  {hasSelection && (
                    <Space>
                      <PermissionGuard module="departments" action="delete">
                        <Button
                          size="small"
                          danger
                          onClick={handleBulkSoftDelete}
                        >
                          Xóa ({selectedRowKeys.length})
                        </Button>
                      </PermissionGuard>
                    </Space>
                  )}
                  {canExport && (
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={handleExportExcel}
                      loading={isExportingExcel}
                      disabled={tableData.length === 0 || isExportingPdf}
                    >
                      Xuất Excel
                    </Button>
                  )}
                  {canExport && (
                    <Button
                      icon={<FilePdfOutlined />}
                      onClick={handleExportPdf}
                      loading={isExportingPdf}
                      disabled={tableData.length === 0 || isExportingExcel}
                    >
                      Xuất PDF
                    </Button>
                  )}
                  {viewModeToggle}
                  {addButton}
                </>
              }
            />
          }
          loading={isLoading && displayData.length === 0}
          error={error}
          errorTitle="Không thể tải dữ liệu"
          isEmpty={displayData.length === 0}
          isFilterActive={isFiltering}
          onClearFilters={resetFilters}
          emptyState={{
            title: isFiltering
              ? 'Chưa có phòng ban nào khớp bộ lọc'
              : 'Chưa có phòng ban nào',
            description: isFiltering
              ? 'Thử xóa bộ lọc để xem toàn bộ.'
              : 'Tạo mới phòng ban để bắt đầu.',
            action: !isFiltering ? (
              <PermissionGuard module="departments" action="create">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreate}
                >
                  Thêm phòng ban
                </Button>
              </PermissionGuard>
            ) : undefined,
          }}
        >
          <DepartmentsTable
            data={displayData}
            loading={isLoading}
            inactivatingId={
              inactiveMutation.isPending
                ? inactiveMutation.variables?.id
                : undefined
            }
            activatingId={
              activateMutation.isPending
                ? activateMutation.variables?.id
                : undefined
            }
            softDeletingId={
              softDeleteMutation.isPending
                ? softDeleteMutation.variables
                : undefined
            }
            restoringId={
              restoreMutation.isPending ? restoreMutation.variables : undefined
            }
            serverPagination={{
              current: page,
              pageSize: perPage,
              total,
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
            onView={(d) => setDetailId(d.id)}
            onEdit={openEdit}
            onInactive={handleInactive}
            onActivate={handleActivate}
            onSoftDelete={handleSoftDelete}
            onCreateSubgroup={openCreateSubgroup}
            onRestore={(dept) => {
              modal.confirm({
                title: 'Khôi phục phòng ban',
                content: `Bạn có chắc muốn khôi phục phòng ban "${dept.name}"?`,
                onOk: () =>
                  restoreMutation.mutate(dept.id, {
                    onSuccess: () =>
                      toast.success('Khôi phục phòng ban thành công'),
                    onError: (e) => toast.error(getMutationErrorMessage(e)),
                  }),
              });
            }}
            selectedRowKeys={selectedRowKeys}
            onSelectionChange={(keys) =>
              setSelectedRowKeys(keys as React.Key[])
            }
          />
        </TableContainer>
      )}

      <DepartmentFormModal
        open={open}
        editing={editing}
        allDepartments={allDepts}
        initialValues={
          subgroupParent
            ? {
                orgUnitId: subgroupParent.orgUnitId,
                departmentType: 'nhom_to',
                parentId: subgroupParent.id,
              }
            : undefined
        }
        orgUnitOptions={orgUnitOptions}
        orgUnitsLoading={orgUnitsLoading}
        orgUnitsError={orgUnitsError}
        employees={employees}
        employeesLoading={employeesLoading}
        employeesError={employeesError}
        isPending={isMutationPending}
        onCancel={() => {
          setOpen(false);
          setSubgroupParent(null);
          setFormApiErrors(null);
        }}
        onSubmit={handleSubmit}
        apiErrors={formApiErrors}
        onGeneratingCode={handleGeneratingCodeChange}
      />

      <DeactivateDepartmentModal
        open={softDeletingDept !== null}
        department={softDeletingDept}
        loading={softDeleteMutation.isPending}
        onCancel={() => setSoftDeletingDept(null)}
        onConfirm={handleConfirmSoftDelete}
      />

      <DepartmentDetailDrawer
        open={detailId != null}
        department={selectedDept}
        loading={detailLoading}
        members={detailMembers}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          if (detail) {
            setDetailId(null);
            openEdit(detail);
          }
        }}
        onDeactivate={() => detail && handleDeactivateDept(detail)}
        onActivate={() =>
          detail && handleActivate({ ...detail, children: undefined })
        }
        onSoftDelete={() =>
          detail && handleSoftDelete({ ...detail, children: undefined })
        }
        onRestore={() => {
          if (!detail) return;
          modal.confirm({
            title: 'Khôi phục phòng ban',
            content: `Bạn có chắc muốn khôi phục phòng ban "${detail.name}"?`,
            onOk: () =>
              restoreMutation.mutate(detail.id, {
                onSuccess: () =>
                  toast.success('Khôi phục phòng ban thành công'),
                onError: (e) => toast.error(getMutationErrorMessage(e)),
              }),
          });
        }}
        onAddMember={() => toast.info('Chức năng thêm nhân sự đang cập nhật')}
        onCreateSubgroup={() => {
          if (detail) {
            setDetailId(null);
            openCreateSubgroup(detail);
          }
        }}
      />
    </div>
  );
}
