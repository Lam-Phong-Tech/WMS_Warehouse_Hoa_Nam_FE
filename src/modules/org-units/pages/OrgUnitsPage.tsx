import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Drawer, Flex, Grid, Space, theme } from 'antd';
import { toast } from 'sonner';
import { PlusOutlined } from '@ant-design/icons';
import { EmptyState, FilteredEmptyState } from '@/shared/components';
import { PermissionGuard } from '@/shared/components';
import {
  usePermission,
  usePermissionState,
  canActionOnRow,
} from '@/shared/components/permission';
import { OrgUnitQueryStateSection } from '@/modules/org-units/components/OrgUnitQueryStateSection';
import { OrgUnitFormModal } from '@/modules/org-units/components/OrgUnitFormModal';
import { OrgUnitTree } from '@/modules/org-units/components/OrgUnitTree';
import { OrgUnitDetail } from '@/modules/org-units/components/OrgUnitDetail';
import { OrgUnitsTable } from '@/modules/org-units/components/OrgUnitsTable';
import { OrgUnitsToolbar } from '@/modules/org-units/components/OrgUnitsToolbar';
import { DeactivateOrgUnitModal } from '@/modules/org-units/components/DeactivateOrgUnitModal';
import { OrgUnitEmployeesModal } from '@/modules/org-units/components/OrgUnitEmployeesModal';
import type { OrgUnitFormValues } from '@/modules/org-units/schemas/org-unit.schema';
import {
  useOrgUnitsTree,
  useOrgUnitsTrashed,
  useCreateOrgUnit,
  useUpdateOrgUnit,
  useUploadOrgUnitLogo,
  useInactiveOrgUnit,
  useRestoreOrgUnit,
  useArchiveOrgUnit,
} from '@/modules/org-units/hooks/use-org-units';

import { useOrgUnitsFilter } from '@/modules/org-units/hooks/use-org-units-filter';
import {
  type OrgUnit,
  type OrgUnitTreeNode,
} from '@/modules/org-units/types/org-units.types';
import { useEmployees } from '@/modules/employees/hooks/use-employees';
import {
  flattenTree,
  countChildren,
  filterOrgUnitTree,
  mergeTrashedIntoTree,
  extractProvinceOptions,
  sortOrgUnitTree,
  excludeStatuses,
  HIDDEN_BY_DEFAULT_STATUSES,
  isBulkSelectable,
} from '@/modules/org-units/utils/org-units.helpers';
import {
  extractFieldErrors,
  getMutationErrorMessage,
} from '@/shared/api/api-error';

type ViewMode = 'tree' | 'table';

// Không dùng `TableContainer` (khác Employees/Departments) — đây là exception
// có chủ đích, đã ghi nhận, không phải thiếu sót: trang này toggle giữa Cây
// (không phải table) và Bảng, dùng chung 1 toolbar + loading/error state cho
// cả 2 view, nên không thể bọc gọn trong TableContainer (thiết kế cho 1 page =
// 1 table độc lập). Chi tiết:
// src/shared/components/data-display/TABLE_PATTERN.md#exception-đã-được-ghi-nhận-orgunitspage
export function OrgUnitsPage() {
  const { modal } = App.useApp();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  // Branch-mode: `/org-units?mode=branch` tái dùng nguyên màn Đơn vị tổ chức
  // làm màn "Quản lý chi nhánh" — mặc định lọc unitType=chi_nhanh, CTA/tiêu đề
  // đổi tên và form Thêm/Sửa khóa loại đơn vị về Chi nhánh (không tạo page mới).
  const [searchParams] = useSearchParams();
  const isBranchMode = searchParams.get('mode') === 'branch';

  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrgUnit | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Parse detail ID from URL search params (vd: điều hướng từ Sơ đồ tổ chức
  // sang Đơn vị tổ chức kèm ?id=... — tương tự DepartmentsPage).
  const selectedIdFromUrl = useMemo(() => {
    const idParam = searchParams.get('id');
    if (idParam == null) return null;
    const parsed = Number(idParam);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (selectedIdFromUrl != null && selectedIdFromUrl !== selectedId) {
      setSelectedId(selectedIdFromUrl);
    }
  }, [selectedIdFromUrl, selectedId]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [deactivateTarget, setDeactivateTarget] = useState<OrgUnit | null>(
    null,
  );
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [viewEmployeesTarget, setViewEmployeesTarget] =
    useState<OrgUnit | null>(null);
  const [formApiErrors, setFormApiErrors] = useState<Record<
    string,
    string
  > | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const {
    filters,
    setKeyword,
    setFilterUnitType,
    setFilterProvince,
    setFilterStatus,
    setFilterCompany,
    setPage,
    setPerPage,
    clientFilterParams,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    resetFilters,
  } = useOrgUnitsFilter({
    lockUnitType: isBranchMode ? 'chi_nhanh' : undefined,
  });

  // ── Shared logic (tree view + table view + detail) ───────────────────
  // Bảng dùng chung nguồn dữ liệu cây với chế độ Cây (xem `filteredTreeForTable`/
  // `sortedTreeForTable`/`pagedTreeForTable` bên dưới) thay vì gọi riêng API
  // phân trang `/org_units` — tránh 2 nguồn dữ liệu lệch nhau và có sẵn nút
  // sổ/thu công ty con, chi nhánh.
  const { data: employees = [] } = useEmployees({ include_assignments: true });

  const createMutation = useCreateOrgUnit();
  const updateMutation = useUpdateOrgUnit();
  const deactivateMutation = useInactiveOrgUnit();
  const restoreMutation = useRestoreOrgUnit();
  const archiveMutation = useArchiveOrgUnit();
  const logoMutation = useUploadOrgUnitLogo();

  // Create a map of employee ID to employee name for manager lookup
  const employeeMap = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((emp) => {
      map.set(emp.id, emp.fullName);
    });
    return map;
  }, [employees]);

  // ── Tree view queries (client-side) ──────────────────────────────────
  const {
    data: treeDataRaw,
    isLoading: isTreeLoading,
    error: treeError,
  } = useOrgUnitsTree();
  const rawTreeData = treeDataRaw as OrgUnitTreeNode[] | undefined;

  // `/org_units/tree` loại đơn vị đã xóa mềm/lưu trữ (soft-delete scope mặc
  // định của BE) — gọi thêm `/org_units/trashed` và merge vào cây để filter
  // "Đã xóa chờ khôi phục"/"Lưu trữ" có dữ liệu thật (xác minh qua API thật
  // 2026-07-08: tree trả 13/13 node đều active, trashed nằm ở endpoint riêng).
  const { data: trashedUnits } = useOrgUnitsTrashed();

  const treeData = useMemo(() => {
    if (!rawTreeData) return rawTreeData;
    if (!trashedUnits?.length) return rawTreeData;
    return mergeTrashedIntoTree(rawTreeData, trashedUnits);
  }, [rawTreeData, trashedUnits]);

  // Calculate employee count per org_unit from assignments
  // Chỉ đếm các assignment đang active (status === 1) để khớp với kết quả
  // từ API filter org_unit_id ở OrgUnitEmployeesModal.
  // Dùng Set để đếm unique employee (tránh đếm trùng nếu 1 employee có nhiều assignment
  // active tại cùng org_unit).
  const employeeCountByOrgUnit = useMemo(() => {
    const employeeIdsPerOrgUnit = new Map<number, Set<number>>();
    employees.forEach((emp) => {
      if (emp.assignments) {
        emp.assignments
          .filter((a) => a.status === 1)
          .forEach((assignment) => {
            if (!employeeIdsPerOrgUnit.has(assignment.org_unit_id)) {
              employeeIdsPerOrgUnit.set(assignment.org_unit_id, new Set());
            }
            employeeIdsPerOrgUnit.get(assignment.org_unit_id)!.add(emp.id);
          });
      }
    });
    const counts = new Map<number, number>();
    for (const [unitId, empIds] of employeeIdsPerOrgUnit) {
      counts.set(unitId, empIds.size);
    }
    return counts;
  }, [employees]);

  // ── Computed data for tree view ──────────────────────────────────────
  const allUnits = useMemo(
    () =>
      treeData
        ? flattenTree(treeData).map((unit) => ({
            ...unit,
            // If managerName is not set from API, try to get it from employeeMap
            managerName:
              unit.managerName ??
              (unit.managerId ? employeeMap.get(unit.managerId) : undefined),
            representativeName:
              unit.representativeName ??
              (unit.managerId ? employeeMap.get(unit.managerId) : undefined),
          }))
        : [],
    [treeData, employeeMap],
  );

  const nameById = useMemo(
    () => new Map(allUnits.map((u) => [u.id, u.name])),
    [allUnits],
  );

  const provinceOptions = useMemo(
    () => extractProvinceOptions(allUnits),
    [allUnits],
  );

  const selectedUnit = useMemo(
    () => allUnits.find((u) => u.id === selectedId) ?? null,
    [allUnits, selectedId],
  );

  const selectedStats = useMemo(() => {
    if (!selectedId || !treeData) return { companies: 0, branches: 0 };
    return countChildren(treeData, selectedId);
  }, [treeData, selectedId]);

  // Cây đầy đủ đã gắn managerName/representativeName, giữ nguyên children —
  // dùng làm nguồn dữ liệu cho tree view để hỗ trợ sổ/thu công ty con, chi nhánh.
  const enrichedTreeData = useMemo<OrgUnitTreeNode[]>(() => {
    if (!treeData) return [];
    const enrich = (nodes: OrgUnitTreeNode[]): OrgUnitTreeNode[] =>
      nodes.map((node) => ({
        ...node,
        managerName:
          node.managerName ??
          (node.managerId ? employeeMap.get(node.managerId) : undefined),
        representativeName:
          node.representativeName ??
          (node.managerId ? employeeMap.get(node.managerId) : undefined),
        children: node.children?.length ? enrich(node.children) : undefined,
      }));
    return enrich(treeData);
  }, [treeData, employeeMap]);

  // `clientFilterParams` dùng field `unit_type` (khớp OrgUnitListParams gửi lên
  // BE), còn `filterOrgUnits` (lọc client-side) đọc field `unitType` — map lại
  // để filter "Loại đơn vị" không bị bỏ qua một cách âm thầm.
  const clientHelperFilterParams = useMemo(
    () => ({
      keyword: clientFilterParams.keyword,
      unitType: clientFilterParams.unit_type,
      province: clientFilterParams.province,
      status: clientFilterParams.status,
      company: clientFilterParams.company,
    }),
    [clientFilterParams],
  );

  // Cây đã lọc, giữ nguyên cấu trúc cha-con — dùng chung cho cả Cây lẫn Bảng
  // (sổ/thu bằng dấu "+" ở dòng công ty mẹ/công ty con thay vì liệt kê phẳng
  // toàn bộ, kể cả ở chế độ Bảng).
  const filteredTreeForTable = useMemo(() => {
    // Ẩn đơn vị đã xóa mềm/lưu trữ khỏi Bảng theo mặc định — chỉ hiện khi
    // người dùng chủ động lọc đúng trạng thái đó (đồng bộ với Cây, xem
    // HIDDEN_BY_DEFAULT_STATUSES).
    const base =
      filters.status && HIDDEN_BY_DEFAULT_STATUSES.includes(filters.status)
        ? enrichedTreeData
        : excludeStatuses(enrichedTreeData, HIDDEN_BY_DEFAULT_STATUSES);
    const hasFilter = Boolean(
      clientHelperFilterParams.keyword ||
      clientHelperFilterParams.unitType ||
      clientHelperFilterParams.province ||
      clientHelperFilterParams.status ||
      clientHelperFilterParams.company,
    );
    if (!hasFilter) return base;
    return filterOrgUnitTree(base, clientHelperFilterParams);
  }, [enrichedTreeData, clientHelperFilterParams, filters.status]);

  // ⚠️ Client-side sort, KHÔNG phải server-side như Employees/Departments —
  // `sort_by`/`sort_order` không được gửi lên BE vì `/org_units/tree` không hỗ
  // trợ tham số sort (BE limitation, xem docs/tickets/BE_ORG_UNIT_SORT_TICKET.md
  // và mục "Exception: OrgUnits sort/pagination là client-side" trong
  // TABLE_PATTERN.md). Sort áp dụng trên toàn bộ dataset đã lọc (toàn bộ cây đã
  // tải 1 lần từ `/org_units/tree`) — TRƯỚC khi cắt trang, để tránh lỗi sort chỉ
  // đúng trong trang hiện tại.
  const sortedTreeForTable = useMemo(
    () => sortOrgUnitTree(filteredTreeForTable, sortBy, sortOrder, nameById),
    [filteredTreeForTable, sortBy, sortOrder, nameById],
  );

  // Phân trang client-side theo số đơn vị gốc (root) đã lọc — dùng chung cho
  // Cây lẫn Bảng.
  const pagedTreeForTable = useMemo(() => {
    const start = (filters.page - 1) * filters.perPage;
    return sortedTreeForTable.slice(start, start + filters.perPage);
  }, [sortedTreeForTable, filters.page, filters.perPage]);

  // Nếu trang hiện tại (>1) trả về rỗng (vượt quá tổng số trang thực tế),
  // tự động quay về trang 1 thay vì hiển thị EmptyState và mắc kẹt (mất luôn nút phân trang).
  useEffect(() => {
    if (
      !isTreeLoading &&
      !treeError &&
      filters.page > 1 &&
      pagedTreeForTable.length === 0
    ) {
      setPage(1);
    }
  }, [isTreeLoading, treeError, filters.page, pagedTreeForTable, setPage]);

  // BE xác nhận catalog chính thức không có ORG_VIEW_MANAGER/ORG_VIEW_PROVINCE
  // (field-level) — dùng chung ORG_VIEW để tránh ẩn cột với mọi user.
  const { can: canViewManager } = usePermission({
    module: 'org_units',
    action: 'view',
  });
  const { can: canViewProvince } = usePermission({
    module: 'org_units',
    action: 'view',
  });

  // P1 fix: detail panel phải row-level-safe như OrgUnitsTable — không chỉ
  // check permissionCode chung chung mà còn phải khớp scope (org_unit_id)
  // của record đang xem với context đang active.
  const { can: canEditPerm } = usePermission({
    module: 'org_units',
    action: 'edit',
  });
  const { can: canDeactivatePerm } = usePermission({
    module: 'org_units',
    action: 'delete',
  });
  const { can: canRestorePerm } = usePermission({
    module: 'org_units',
    action: 'restore',
  });
  const { can: canArchivePerm } = usePermission({
    module: 'org_units',
    action: 'delete',
    permissionCode: 'ORG_FORCE_DELETE',
  });
  const {
    isSuperAdmin,
    currentScopeType,
    currentOrgUnitId,
    currentDepartmentId,
  } = usePermissionState();
  const detailRowScopeContext = {
    scopeType: currentScopeType,
    orgUnitId: currentOrgUnitId,
    departmentId: currentDepartmentId,
  };
  function isDetailActionAllowed(
    hasModulePermission: boolean,
    record: OrgUnit,
    action: 'edit' | 'delete' | 'restore',
  ): boolean {
    return canActionOnRow(
      hasModulePermission,
      detailRowScopeContext,
      { orgUnitId: record.id },
      'org_units',
      action,
      isSuperAdmin,
    );
  }

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (unit: OrgUnit) => {
    if (isBranchMode && unit.unitType !== 'chi_nhanh') {
      toast.error('Màn Quản lý chi nhánh chỉ thao tác trên Chi nhánh');
      return;
    }
    setEditing(unit);
    setOpen(true);
  };

  const openDeactivate = (unit: OrgUnit) => {
    if (isBranchMode && unit.unitType !== 'chi_nhanh') {
      toast.error('Màn Quản lý chi nhánh chỉ thao tác trên Chi nhánh');
      return;
    }
    setDeactivateTarget(unit);
    setDeactivateOpen(true);
  };

  const handleDeactivate = () => {
    if (!deactivateTarget) return;
    deactivateMutation.mutate(
      {
        id: deactivateTarget.id,
      },
      {
        onSuccess: () => {
          toast.success('Đã thực hiện vô hiệu đơn vị');
          setDeactivateOpen(false);
          setDeactivateTarget(null);
          setSelectedId(null);
        },
        onError: (error) => toast.error(getMutationErrorMessage(error)),
      },
    );
  };

  const handleRestore = (unit: OrgUnit) => {
    if (isBranchMode && unit.unitType !== 'chi_nhanh') {
      toast.error('Màn Quản lý chi nhánh chỉ thao tác trên Chi nhánh');
      return;
    }
    modal.confirm({
      title: 'Khôi phục đơn vị tổ chức',
      content: `Bạn có chắc chắn muốn khôi phục đơn vị "${unit.name}"? Đơn vị sẽ quay lại trạng thái Hoạt động.`,
      okText: 'Khôi phục',
      cancelText: 'Hủy',
      onOk: () => {
        restoreMutation.mutate(unit.id, {
          onSuccess: () => {
            toast.success('Đã khôi phục đơn vị thành công');
          },
          onError: (error) => toast.error(getMutationErrorMessage(error)),
        });
      },
    });
  };

  const handleArchive = (unit: OrgUnit) => {
    if (isBranchMode && unit.unitType !== 'chi_nhanh') {
      toast.error('Màn Quản lý chi nhánh chỉ thao tác trên Chi nhánh');
      return;
    }
    modal.confirm({
      title: 'Lưu trữ đơn vị tổ chức',
      content: `Bạn có chắc chắn muốn lưu trữ vĩnh viễn đơn vị "${unit.name}"? Hành động này không thể hoàn tác.`,
      okText: 'Lưu trữ',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: () => {
        archiveMutation.mutate(unit.id, {
          onSuccess: () => {
            toast.success('Đã lưu trữ đơn vị thành công');
          },
          onError: (error) => toast.error(getMutationErrorMessage(error)),
        });
      },
    });
  };

  const handleBulkDeactivate = () => {
    // Lọc lại danh sách trước khi gọi API — chặn ở handler, không chỉ dựa
    // vào getCheckboxProps (P0.3): user không thể chọn ancestor/đơn vị không
    // active qua UI, nhưng selectedRowKeys có thể còn lưu ID cũ từ trước khi
    // đổi filter/mode, nên phải lọc lại ngay trước khi gửi request.
    const allowedIds = allUnits
      .filter(
        (u) =>
          selectedRowKeys.includes(u.id) && isBulkSelectable(u, isBranchMode),
      )
      .map((u) => u.id);

    if (allowedIds.length === 0) return;

    modal.confirm({
      title: 'Vô hiệu hóa đơn vị',
      content: `Bạn có chắc muốn vô hiệu hóa ${allowedIds.length} đơn vị đã chọn?`,
      okText: 'Vô hiệu hóa',
      okButtonProps: { danger: true },
      onOk: () => {
        let completed = 0;
        allowedIds.forEach((id) => {
          deactivateMutation.mutate(
            { id, reason: '' },
            {
              onSuccess: () => {
                completed++;
                if (completed === allowedIds.length) {
                  toast.success(`Đã vô hiệu hóa ${allowedIds.length} đơn vị`);
                  setSelectedRowKeys([]);
                }
              },
              onError: (err) => toast.error(getMutationErrorMessage(err)),
            },
          );
        });
      },
    });
  };

  const handleSubmit = (values: OrgUnitFormValues, logoFile?: File | null) => {
    setFormApiErrors(null);
    const onError = (error: unknown) => {
      const fieldErrors = extractFieldErrors(error);
      if (fieldErrors) setFormApiErrors(fieldErrors);
      else toast.error(getMutationErrorMessage(error));
    };

    const uploadLogoAfterSave = (id: number, isEdit: boolean) => {
      if (!logoFile) return;
      logoMutation.mutate(
        { id, file: logoFile },
        {
          onSuccess: () =>
            toast.success(
              isEdit
                ? 'Đã cập nhật đơn vị kèm logo mới'
                : 'Đã thêm đơn vị kèm logo',
            ),
          onError: (e) =>
            toast.warning(
              `Đã ${isEdit ? 'cập nhật' : 'thêm'} đơn vị nhưng lỗi tải logo: ${getMutationErrorMessage(e)}`,
            ),
        },
      );
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, payload: values },
        {
          onSuccess: () => {
            setOpen(false);
            if (logoFile) {
              uploadLogoAfterSave(editing.id, true);
            } else {
              toast.success('Đã cập nhật đơn vị');
            }
          },
          onError,
        },
      );
    } else {
      createMutation.mutate(values, {
        onSuccess: (created) => {
          setOpen(false);
          if (logoFile) {
            uploadLogoAfterSave(created.id, false);
          } else {
            toast.success('Đã thêm đơn vị');
          }
        },
        onError,
      });
    }
  };

  const isMutationPending =
    createMutation.isPending || updateMutation.isPending;

  const addButton = (
    <PermissionGuard module="org_units" action="create">
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
        {isBranchMode ? 'Thêm chi nhánh' : 'Thêm đơn vị'}
      </Button>
    </PermissionGuard>
  );
  const hasSelection = selectedRowKeys.length > 0;

  const detailPanel = selectedUnit ? (
    <OrgUnitDetail
      unit={selectedUnit}
      nameById={nameById}
      stats={selectedStats}
      employeeCount={employeeCountByOrgUnit.get(selectedUnit.id)}
      onEdit={() => openEdit(selectedUnit)}
      onDeactivate={() => openDeactivate(selectedUnit)}
      onRestore={() => handleRestore(selectedUnit)}
      onArchive={() => handleArchive(selectedUnit)}
      onViewEmployees={() => setViewEmployeesTarget(selectedUnit)}
      isDeactivating={
        deactivateMutation.isPending && deactivateTarget?.id === selectedUnit.id
      }
      isRestoring={
        restoreMutation.isPending &&
        restoreMutation.variables === selectedUnit.id
      }
      isArchiving={
        archiveMutation.isPending &&
        archiveMutation.variables === selectedUnit.id
      }
      readOnly={isBranchMode && selectedUnit.unitType !== 'chi_nhanh'}
      canEdit={isDetailActionAllowed(canEditPerm, selectedUnit, 'edit')}
      canDeactivate={isDetailActionAllowed(
        canDeactivatePerm,
        selectedUnit,
        'delete',
      )}
      canRestore={isDetailActionAllowed(
        canRestorePerm,
        selectedUnit,
        'restore',
      )}
      canArchive={isDetailActionAllowed(canArchivePerm, selectedUnit, 'delete')}
    />
  ) : null;

  const isFilterActive = Boolean(
    filters.keyword ||
    filters.unitType ||
    filters.province ||
    filters.status ||
    filters.company,
  );

  // Bảng dùng chung nguồn tải/lỗi với Cây (xem comment ở khai báo
  // filteredTreeForTable/sortedTreeForTable/pagedTreeForTable phía trên) —
  // không còn phụ thuộc `isTableLoading`/`tableError` (kết quả gọi API
  // `/org_units` riêng, chỉ dùng làm nguồn companyOptions/tableCompanyOptions).
  const isLoading = isTreeLoading;
  const dataError = treeError;

  // Lấy danh sách công ty (công ty mẹ + công ty con) để hiển thị trong dropdown
  // filter "Công ty cha" — chi nhánh có thể trực thuộc cả công ty mẹ lẫn công
  // ty con (xem form helper), nên dropdown phải cho chọn cả hai loại, không
  // chỉ công ty mẹ (P0/P1 fix).
  const companyOptions = useMemo(() => {
    return allUnits
      .filter(
        (u) => u.unitType === 'cong_ty_me' || u.unitType === 'cong_ty_con',
      )
      .map((u) => ({
        value: u.id,
        label:
          u.unitType === 'cong_ty_con' ? `${u.name} (Công ty con)` : u.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allUnits]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: token.colorBgContainer,
      }}
    >
      <div
        style={{
          padding: isMobile ? '8px 12px' : '10px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <OrgUnitsToolbar
          viewMode={viewMode}
          keyword={filters.keyword}
          hideUnitTypeFilter={isBranchMode}
          filterUnitType={filters.unitType}
          filterProvince={filters.province}
          filterStatus={filters.status}
          filterCompany={filters.company}
          provinceOptions={provinceOptions}
          companyOptions={companyOptions}
          loading={isLoading}
          onViewModeChange={(mode) => {
            setViewMode(mode);
            setSelectedId(null);
          }}
          onKeywordChange={setKeyword}
          onFilterUnitType={setFilterUnitType}
          onFilterProvince={setFilterProvince}
          onFilterStatus={setFilterStatus}
          onFilterCompany={setFilterCompany}
          actionSlot={
            <>
              {hasSelection && (
                <Space>
                  <PermissionGuard
                    module="org_units"
                    action="delete"
                    permissionCode="ORG_INACTIVE"
                  >
                    <Button size="small" danger onClick={handleBulkDeactivate}>
                      Vô hiệu hóa ({selectedRowKeys.length})
                    </Button>
                  </PermissionGuard>
                </Space>
              )}
              {addButton}
            </>
          }
        />
      </div>

      {viewMode === 'tree' ? (
        <OrgUnitQueryStateSection
          error={treeError}
          errorTitle="Không thể tải dữ liệu cơ cấu"
          isLoading={isTreeLoading && !treeData?.length}
          loadingLabel="Đang tải sơ đồ cơ cấu..."
          skeletonRows={5}
          isEmpty={!isTreeLoading && !treeError && !treeData?.length}
          emptyNode={
            <EmptyState
              title="Chưa có đơn vị tổ chức"
              description="Tạo mới đơn vị để bắt đầu quản lý hệ thống."
            >
              {addButton}
            </EmptyState>
          }
        >
          <Flex flex={1} style={{ minHeight: 0, overflow: 'hidden' }}>
            <div
              style={{
                width: isMobile ? '100%' : 340,
                minWidth: isMobile ? 'unset' : 300,
                borderRight: isMobile
                  ? 'none'
                  : `1px solid ${token.colorBorderSecondary}`,
                overflowY: 'auto',
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <OrgUnitTree
                treeData={treeData}
                keyword={filters.keyword}
                filterUnitType={filters.unitType}
                filterProvince={filters.province}
                filterStatus={filters.status}
                filterCompany={filters.company}
                loading={isTreeLoading}
                selectedId={selectedId}
                onSelect={setSelectedId}
                isBranchMode={isBranchMode}
              />
            </div>

            {!isMobile && (
              <div
                style={{
                  flex: 1,
                  padding: 24,
                  overflowY: 'auto',
                }}
              >
                {detailPanel ?? (
                  <Flex
                    align="center"
                    justify="center"
                    style={{ height: '100%' }}
                  >
                    <EmptyState
                      title="Chọn một đơn vị để xem chi tiết"
                      description="Nhấn vào một đơn vị ở khung bên trái để xem thông tin chi tiết."
                    />
                  </Flex>
                )}
              </div>
            )}
          </Flex>
        </OrgUnitQueryStateSection>
      ) : (
        <OrgUnitQueryStateSection
          error={dataError}
          errorTitle="Không thể tải danh sách đơn vị"
          isLoading={
            isTreeLoading &&
            sortedTreeForTable.length === 0 &&
            filters.page === 1
          }
          loadingLabel="Đang tải danh sách đơn vị..."
          skeletonRows={8}
          isEmpty={
            !isTreeLoading &&
            !dataError &&
            sortedTreeForTable.length === 0 &&
            filters.page === 1
          }
          emptyNode={
            isFilterActive ? (
              <FilteredEmptyState onClearFilters={resetFilters} />
            ) : (
              <EmptyState
                title="Chưa có đơn vị tổ chức"
                description="Tạo mới đơn vị để bắt đầu quản lý hệ thống."
              >
                {addButton}
              </EmptyState>
            )
          }
        >
          <div
            style={{
              padding: isMobile ? '4px 8px' : '8px 16px',
              flex: 1,
              overflow: 'auto',
            }}
          >
            <OrgUnitsTable
              data={pagedTreeForTable}
              loading={isTreeLoading}
              nameById={nameById}
              deactivatingId={
                deactivateMutation.isPending ? deactivateTarget?.id : undefined
              }
              restoringId={
                restoreMutation.isPending
                  ? restoreMutation.variables
                  : undefined
              }
              archivingId={
                archiveMutation.isPending
                  ? archiveMutation.variables
                  : undefined
              }
              onEdit={openEdit}
              onView={(unit) => setSelectedId(unit.id)}
              onDeactivate={openDeactivate}
              onRestore={handleRestore}
              onArchive={handleArchive}
              controlledPagination={{
                current: filters.page,
                pageSize: filters.perPage,
                total: sortedTreeForTable.length,
                onChange: (page: number, pageSize: number) => {
                  setPage(page);
                  if (pageSize !== filters.perPage) {
                    setPerPage(pageSize);
                  }
                },
              }}
              permissions={{
                canViewManager,
                canViewProvince,
              }}
              onAddChild={(parent) => {
                setEditing(parent);
                setOpen(true);
              }}
              onSortChange={(field, order) => {
                setSortBy(field);
                setSortOrder(order);
                // Sort client-side nên không cần reset page
              }}
              isBranchMode={isBranchMode}
              selectedRowKeys={selectedRowKeys}
              onSelectionChange={(keys) =>
                setSelectedRowKeys(keys as React.Key[])
              }
            />
          </div>
        </OrgUnitQueryStateSection>
      )}

      {isMobile && viewMode === 'tree' && (
        <Drawer
          open={Boolean(selectedUnit)}
          onClose={() => setSelectedId(null)}
          title={selectedUnit?.name ?? ''}
          placement="bottom"
          size="85vh"
          styles={{ body: { padding: 16, overflowY: 'auto' } }}
        >
          {detailPanel}
        </Drawer>
      )}

      {/* Table view không có split-panel như Cây — "Xem chi tiết" mở Drawer
          riêng (cả desktop lẫn mobile) thay vì chỉ set selectedId ngầm. */}
      {viewMode === 'table' && (
        <Drawer
          open={Boolean(selectedUnit)}
          onClose={() => setSelectedId(null)}
          title={selectedUnit?.name ?? ''}
          placement={isMobile ? 'bottom' : 'right'}
          size={isMobile ? '85vh' : 480}
          styles={{ body: { padding: 16, overflowY: 'auto' } }}
        >
          {detailPanel}
        </Drawer>
      )}

      <OrgUnitFormModal
        open={open}
        editing={editing}
        allUnits={allUnits}
        onCancel={() => {
          setOpen(false);
          setFormApiErrors(null);
        }}
        onSubmit={handleSubmit}
        isPending={isMutationPending}
        apiErrors={formApiErrors}
        lockedUnitType={isBranchMode ? 'chi_nhanh' : undefined}
      />

      <DeactivateOrgUnitModal
        open={deactivateOpen}
        unit={deactivateTarget}
        loading={deactivateMutation.isPending}
        onCancel={() => {
          setDeactivateOpen(false);
          setDeactivateTarget(null);
        }}
        onConfirm={handleDeactivate}
      />

      <OrgUnitEmployeesModal
        open={viewEmployeesTarget !== null}
        unit={viewEmployeesTarget}
        onClose={() => setViewEmployeesTarget(null)}
      />
    </div>
  );
}
