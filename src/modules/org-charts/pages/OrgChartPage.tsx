import { useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Select,
  Button,
  Tooltip,
  Tag,
  Avatar,
  Typography,
  Space,
  Input,
  Result,
} from 'antd';
import {
  ExpandAltOutlined,
  ShrinkOutlined,
  ExportOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  AimOutlined,
  TeamOutlined,
  BankOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  UserOutlined,
  ApartmentOutlined,
  SearchOutlined,
  EyeOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  PageHeader,
  ApiErrorAlert,
  EmptyState,
  LoadingState,
} from '@/shared/components';
import { DataTable } from '@/shared/components/data-display/DataTable';
import { Can } from '@/shared/components/permission';
import { useAuthStore } from '@/shared/store/auth.store';
import { useOrgUnits } from '@/modules/org-units/hooks/use-org-units';
import { useDepartments } from '@/modules/departments/hooks/use-departments';
import { useEmployees } from '@/modules/employees/hooks/use-employees';
import { orgUnitsExportService } from '@/modules/org-units/services/org-units-export.service';
import { toast } from 'sonner';
import axios from 'axios';
import { getApiErrorMessage } from '@/shared/api/api-error';
import type { OrgUnit } from '@/modules/org-units/types/org-units.types';
import {
  getDepartmentStatus,
  DEPARTMENT_STATUS_LABELS,
  type Department,
} from '@/modules/departments/types/departments.types';
import {
  EMPLOYEE_STATUS_LABELS,
  EmployeeStatus,
  type Employee,
  type EmployeeAssignment,
} from '@/modules/employees/types/employees.types';
import { EmployeeDetailDrawer } from '@/modules/employees/components/EmployeeDetailDrawer';

const { Text } = Typography;

/* ─────────────────────────────────────────────
   Màu sắc theo loại đơn vị
   ───────────────────────────────────────────── */
const UNIT_COLORS: Record<
  string,
  { border: string; bg: string; tag: string; accent: string }
> = {
  cong_ty_me: {
    border: '#c0392b',
    bg: '#fef5f3',
    tag: 'red',
    accent: '#e74c3c',
  },
  cong_ty_con: {
    border: '#2980b9',
    bg: '#f0f7fe',
    tag: 'blue',
    accent: '#3498db',
  },
  chi_nhanh: {
    border: '#27ae60',
    bg: '#f0faf4',
    tag: 'green',
    accent: '#2ecc71',
  },
  default: {
    border: '#7f8c8d',
    bg: '#fafafa',
    tag: 'default',
    accent: '#95a5a6',
  },
};

const UNIT_ICONS: Record<string, React.ReactNode> = {
  cong_ty_me: <BankOutlined style={{ fontSize: 16 }} />,
  cong_ty_con: <HomeOutlined style={{ fontSize: 16 }} />,
  chi_nhanh: <EnvironmentOutlined style={{ fontSize: 16 }} />,
  default: <ApartmentOutlined style={{ fontSize: 16 }} />,
};

const UNIT_TYPE_LABEL: Record<string, string> = {
  cong_ty_me: 'Công ty mẹ',
  cong_ty_con: 'Công ty con',
  chi_nhanh: 'Chi nhánh',
  default: 'Đơn vị',
};

const SCOPE_TYPE_LABEL: Record<string, string> = {
  he_thong: 'Toàn hệ thống',
  co_so: 'Cơ sở',
  phong_ban: 'Phòng ban',
  kho: 'Kho',
};

const EMPLOYEE_STATUS_TAG_COLOR: Record<EmployeeStatus, string> = {
  [EmployeeStatus.INTERN]: 'default',
  [EmployeeStatus.PROBATION]: 'gold',
  [EmployeeStatus.OFFICIAL]: 'green',
  [EmployeeStatus.SUSPENDED]: 'orange',
  [EmployeeStatus.RESIGNED]: 'red',
  [EmployeeStatus.ARCHIVED]: 'default',
};

const getUnitColor = (unitType: string) =>
  UNIT_COLORS[unitType] ?? UNIT_COLORS.default;
const getUnitIcon = (unitType: string) =>
  UNIT_ICONS[unitType] ?? UNIT_ICONS.default;
const getUnitTypeLabel = (unitType: string) =>
  UNIT_TYPE_LABEL[unitType] ?? UNIT_TYPE_LABEL.default;

/* ─────────────────────────────────────────────
   Helper: lấy assignment chính
   ───────────────────────────────────────────── */
const getPrimaryAssignment = (e: Employee): EmployeeAssignment | undefined =>
  e.assignments?.find((a) => a.is_primary) ?? e.assignments?.[0];

/* ═══════════════════════════════════════════════
   NODE DETAIL PANEL (inline, không phải Drawer)
   Hiển thị khi click vào node trên sơ đồ cây
   ═══════════════════════════════════════════════ */
interface OrgUnitDetailPanelProps {
  orgUnit: OrgUnit;
  childDepartments: Department[];
  orgEmployees: Employee[];
  getOrgManager: (orgUnitId: number) => Employee | undefined;
  onNavigateToOrgUnit: () => void;
  onClose: () => void;
}

function OrgUnitDetailPanel({
  orgUnit,
  childDepartments,
  orgEmployees,
  getOrgManager,
  onNavigateToOrgUnit,
  onClose,
}: OrgUnitDetailPanelProps) {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeePageSize, setEmployeePageSize] = useState(15);

  const color = getUnitColor(orgUnit.unitType);
  const manager = getOrgManager(orgUnit.id);
  const activeEmployeeCount = orgEmployees.filter(
    (e) => e.employeeStatus === 2,
  ).length;

  const filteredEmployees = useMemo(() => {
    const kw = employeeSearch.trim().toLowerCase();
    if (!kw) return orgEmployees;
    return orgEmployees.filter((e) =>
      [e.code, e.fullName, e.email, e.phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(kw)),
    );
  }, [orgEmployees, employeeSearch]);

  const pagedEmployees = useMemo(() => {
    const start = (employeePage - 1) * employeePageSize;
    return filteredEmployees.slice(start, start + employeePageSize);
  }, [filteredEmployees, employeePage, employeePageSize]);

  const columns: ColumnsType<Employee> = [
    { title: 'Mã NV', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 180,
      ellipsis: { showTitle: false },
      render: (email?: string | null) =>
        email ? (
          <Tooltip title={email}>
            <span>
              {email.length > 20 ? `${email.slice(0, 17)}...` : email}
            </span>
          </Tooltip>
        ) : (
          '—'
        ),
    },
    { title: 'Điện thoại', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Đơn vị',
      key: 'orgUnit',
      render: (_, e) => getPrimaryAssignment(e)?.org_unit?.name ?? '—',
    },
    {
      title: 'Phòng ban',
      key: 'department',
      render: (_, e) => getPrimaryAssignment(e)?.department?.name ?? '—',
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, e) =>
        e.employeeStatus != null ? (
          <Tag color={EMPLOYEE_STATUS_TAG_COLOR[e.employeeStatus]}>
            {EMPLOYEE_STATUS_LABELS[e.employeeStatus]}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, e) => (
        <Tooltip title="Xem chi tiết">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailEmployee(e)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Card style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
      {/* Header info */}
      <div
        style={{
          background: color.bg,
          padding: '20px 24px',
          borderRadius: '8px 8px 0 0',
          position: 'relative',
        }}
      >
        <Tooltip title="Đóng">
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            style={{ position: 'absolute', top: 12, right: 12 }}
          />
        </Tooltip>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              color: color.accent,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {getUnitIcon(orgUnit.unitType)}
          </span>
          <Tag color={color.tag} style={{ margin: 0 }}>
            {getUnitTypeLabel(orgUnit.unitType)}
          </Tag>
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>
          {orgUnit.name}
        </div>
        <div style={{ fontSize: 12.5, color: '#5b6b7e', marginTop: 2 }}>
          Mã: {orgUnit.code}
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Manager */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <Avatar
            size={36}
            icon={<UserOutlined />}
            style={{ background: color.accent, flex: 'none' }}
          />
          <div style={{ fontSize: 13.5 }}>
            <b>{manager ? manager.fullName : 'Chưa phân công'}</b>
            <div style={{ fontSize: 11.5, color: '#8c887e' }}>
              {manager ? 'Người đứng đầu đơn vị' : 'Chưa có người phụ trách'}
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 24px',
            marginBottom: 16,
            fontSize: 12.5,
          }}
        >
          {orgUnit.email && (
            <div>
              <span style={{ color: '#999' }}>Email:</span>{' '}
              <span style={{ color: '#555' }}>{orgUnit.email}</span>
            </div>
          )}
          {orgUnit.phone && (
            <div>
              <span style={{ color: '#999' }}>Điện thoại:</span>{' '}
              <span style={{ color: '#555' }}>{orgUnit.phone}</span>
            </div>
          )}
          {orgUnit.address && (
            <div>
              <span style={{ color: '#999' }}>Địa chỉ:</span>{' '}
              <span style={{ color: '#555' }}>{orgUnit.address}</span>
            </div>
          )}
          {orgUnit.taxCode && (
            <div>
              <span style={{ color: '#999' }}>MST:</span>{' '}
              <span style={{ color: '#555' }}>{orgUnit.taxCode}</span>
            </div>
          )}
        </div>

        {/* Stats cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              flex: 1,
              border: '1.5px solid #e3e0d8',
              borderRadius: 6,
              padding: 14,
              textAlign: 'center',
              background: '#fafaf8',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 22, color: color.accent }}>
              {childDepartments.length}
            </div>
            <div style={{ fontSize: 11.5, color: '#8c887e' }}>Phòng ban</div>
          </div>
          <div
            style={{
              flex: 1,
              border: '1.5px solid #e3e0d8',
              borderRadius: 6,
              padding: 14,
              textAlign: 'center',
              background: '#fafaf8',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 22, color: color.accent }}>
              {activeEmployeeCount}
            </div>
            <div style={{ fontSize: 11.5, color: '#8c887e' }}>
              NV chính thức
            </div>
          </div>
          <div
            style={{
              flex: 1,
              border: '1.5px solid #e3e0d8',
              borderRadius: 6,
              padding: 14,
              textAlign: 'center',
              background: '#fafaf8',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 22, color: color.accent }}>
              {orgEmployees.length}
            </div>
            <div style={{ fontSize: 11.5, color: '#8c887e' }}>Tổng NV</div>
          </div>
        </div>

        {/* Departments list */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#444',
              marginBottom: 8,
            }}
          >
            Phòng ban trực thuộc
            <span style={{ fontWeight: 400, color: '#999', marginLeft: 4 }}>
              ({childDepartments.length})
            </span>
          </div>
          {childDepartments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {childDepartments.map((dept) => (
                <div
                  key={dept.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid #ece9e1',
                    borderRadius: 5,
                    padding: '8px 12px',
                    fontSize: 13,
                    background: '#fcfcfb',
                  }}
                >
                  <ApartmentOutlined
                    style={{ color: '#7f8c8d', fontSize: 13 }}
                  />
                  {dept.name}
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                fontSize: 13,
                color: '#8c887e',
                padding: '10px 12px',
                border: '1px solid #e3e0d8',
                borderRadius: 6,
                background: '#fafaf8',
              }}
            >
              Chưa có phòng ban trực thuộc
            </div>
          )}
        </div>

        <Button type="primary" onClick={onNavigateToOrgUnit}>
          Mở trang đơn vị →
        </Button>
      </div>

      {/* Employee list */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
          Danh sách nhân viên
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Tìm kiếm theo mã, tên, email, điện thoại..."
            value={employeeSearch}
            onChange={(e) => {
              setEmployeeSearch(e.target.value);
              setEmployeePage(1);
            }}
            style={{ maxWidth: 340 }}
          />
        </div>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={pagedEmployees}
          showTopPagination
          topPaginationPlacement="bottom"
          topPaginationConfig={{
            total: filteredEmployees.length,
            current: employeePage,
            pageSize: employeePageSize,
            unitName: 'nhân viên',
            pageSizeOptions: [15, 20, 50, 100],
            onChange: (page, pageSize) => {
              setEmployeePage(page);
              setEmployeePageSize(pageSize);
            },
          }}
        />
      </div>
      <EmployeeDetailDrawer
        open={!!detailEmployee}
        employee={detailEmployee}
        onClose={() => setDetailEmployee(null)}
      />
    </Card>
  );
}

/* ═══════════════════════════════════════════════
   DEPARTMENT DETAIL PANEL (inline, không phải Drawer)
   Hiển thị khi click vào node phòng ban trên sơ đồ cây
   ═══════════════════════════════════════════════ */
interface DepartmentDetailPanelProps {
  department: Department;
  deptEmployees: Employee[];
  onNavigateToDepartment: () => void;
  onClose: () => void;
}

function DepartmentDetailPanel({
  department,
  deptEmployees,
  onNavigateToDepartment,
  onClose,
}: DepartmentDetailPanelProps) {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeePageSize, setEmployeePageSize] = useState(15);

  const activeEmployeeCount = deptEmployees.filter(
    (e) => e.employeeStatus === 2,
  ).length;

  const filteredEmployees = useMemo(() => {
    const kw = employeeSearch.trim().toLowerCase();
    if (!kw) return deptEmployees;
    return deptEmployees.filter((e) =>
      [e.code, e.fullName, e.email, e.phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(kw)),
    );
  }, [deptEmployees, employeeSearch]);

  const pagedEmployees = useMemo(() => {
    const start = (employeePage - 1) * employeePageSize;
    return filteredEmployees.slice(start, start + employeePageSize);
  }, [filteredEmployees, employeePage, employeePageSize]);

  const columns: ColumnsType<Employee> = [
    { title: 'Mã NV', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 180,
      ellipsis: { showTitle: false },
      render: (email?: string | null) =>
        email ? (
          <Tooltip title={email}>
            <span>
              {email.length > 20 ? `${email.slice(0, 17)}...` : email}
            </span>
          </Tooltip>
        ) : (
          '—'
        ),
    },
    { title: 'Điện thoại', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, e) =>
        e.employeeStatus != null ? (
          <Tag color={EMPLOYEE_STATUS_TAG_COLOR[e.employeeStatus]}>
            {EMPLOYEE_STATUS_LABELS[e.employeeStatus]}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, e) => (
        <Tooltip title="Xem chi tiết">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailEmployee(e)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Card style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
      {/* Header info */}
      <div
        style={{
          background: '#fafaf8',
          padding: '20px 24px',
          borderRadius: '8px 8px 0 0',
          position: 'relative',
        }}
      >
        <Tooltip title="Đóng">
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            style={{ position: 'absolute', top: 12, right: 12 }}
          />
        </Tooltip>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#7f8c8d', display: 'flex' }}>
            <ApartmentOutlined style={{ fontSize: 16 }} />
          </span>
          <Tag color="default" style={{ margin: 0 }}>
            {department.departmentType === 'nhom_to' ? 'Nhóm/Tổ' : 'Phòng ban'}
          </Tag>
          <Tag
            color={
              getDepartmentStatus(department) === 'active' ? 'green' : 'default'
            }
            style={{ margin: 0 }}
          >
            {DEPARTMENT_STATUS_LABELS[getDepartmentStatus(department)]}
          </Tag>
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, marginTop: 6 }}>
          {department.name}
        </div>
        <div style={{ fontSize: 12.5, color: '#5b6b7e', marginTop: 2 }}>
          Mã: {department.code}
          {department.orgUnitName ? ` · ${department.orgUnitName}` : ''}
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Manager */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <Avatar
            size={36}
            icon={<UserOutlined />}
            style={{ background: '#95a5a6', flex: 'none' }}
          />
          <div style={{ fontSize: 13.5 }}>
            <b>{department.managerName ?? 'Chưa phân công'}</b>
            <div style={{ fontSize: 11.5, color: '#8c887e' }}>
              {department.managerName
                ? 'Trưởng phòng ban'
                : 'Chưa có người phụ trách'}
            </div>
          </div>
        </div>

        {/* Note */}
        {department.note && (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              background: '#fafaf8',
              border: '1px solid #ece9e1',
              borderRadius: 6,
              fontSize: 12.5,
              color: '#555',
              whiteSpace: 'pre-wrap',
            }}
          >
            {department.note}
          </div>
        )}

        {/* Stats cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              flex: 1,
              border: '1.5px solid #e3e0d8',
              borderRadius: 6,
              padding: 14,
              textAlign: 'center',
              background: '#fafaf8',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 22, color: '#95a5a6' }}>
              {activeEmployeeCount}
            </div>
            <div style={{ fontSize: 11.5, color: '#8c887e' }}>
              NV chính thức
            </div>
          </div>
          <div
            style={{
              flex: 1,
              border: '1.5px solid #e3e0d8',
              borderRadius: 6,
              padding: 14,
              textAlign: 'center',
              background: '#fafaf8',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 22, color: '#95a5a6' }}>
              {deptEmployees.length}
            </div>
            <div style={{ fontSize: 11.5, color: '#8c887e' }}>Tổng NV</div>
          </div>
        </div>

        <Button type="primary" onClick={onNavigateToDepartment}>
          Mở trang phòng ban →
        </Button>
      </div>

      {/* Employee list */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
          Danh sách nhân viên
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Tìm kiếm theo mã, tên, email, điện thoại..."
            value={employeeSearch}
            onChange={(e) => {
              setEmployeeSearch(e.target.value);
              setEmployeePage(1);
            }}
            style={{ maxWidth: 340 }}
          />
        </div>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={pagedEmployees}
          showTopPagination
          topPaginationPlacement="bottom"
          topPaginationConfig={{
            total: filteredEmployees.length,
            current: employeePage,
            pageSize: employeePageSize,
            unitName: 'nhân viên',
            pageSizeOptions: [15, 20, 50, 100],
            onChange: (page, pageSize) => {
              setEmployeePage(page);
              setEmployeePageSize(pageSize);
            },
          }}
        />
      </div>
      <EmployeeDetailDrawer
        open={!!detailEmployee}
        employee={detailEmployee}
        onClose={() => setDetailEmployee(null)}
      />
    </Card>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════ */
export function OrgChartPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    number | null
  >(null);
  const [filterOrgId, setFilterOrgId] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [scale, setScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const treeWrapperRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const currentContext = useAuthStore((s) => s.currentContext);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  const dataScopeLabel = isSuperAdmin
    ? 'Đang xem toàn bộ doanh nghiệp'
    : currentContext
      ? `Đang xem phạm vi: ${SCOPE_TYPE_LABEL[currentContext.scope_type] ?? currentContext.scope_type}` +
        (currentContext.org_unit_name
          ? ` · ${currentContext.org_unit_name}`
          : '') +
        (currentContext.department_name
          ? ` · ${currentContext.department_name}`
          : '')
      : 'Chưa xác định phạm vi dữ liệu';

  const roleLabel = isSuperAdmin
    ? 'Super Admin'
    : (currentContext?.role_name ?? '—');

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const blob = await orgUnitsExportService.exportChartPdf(filterOrgId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `so-do-to-chuc-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Xuất sơ đồ tổ chức thành công');
    } catch (err) {
      toast.error(
        getApiErrorMessage(
          err,
          'Xuất sơ đồ tổ chức thất bại. Vui lòng thử lại.',
        ),
      );
    } finally {
      setIsExporting(false);
    }
  };

  /* ── Data fetching ── */
  const {
    data: orgUnits = [],
    isLoading: orgLoading,
    error: orgError,
    refetch: refetchOrgUnits,
  } = useOrgUnits({ enabled: true });
  const {
    data: departments = [],
    isLoading: departmentsLoading,
    error: departmentsError,
    refetch: refetchDepartments,
  } = useDepartments();
  const {
    data: employees = [],
    isLoading: employeesLoading,
    error: employeesError,
    refetch: refetchEmployees,
  } = useEmployees({ include_assignments: true });

  const isForbidden = (err: unknown) =>
    axios.isAxiosError(err) && err.response?.status === 403;

  const orgForbidden =
    isForbidden(orgError) ||
    isForbidden(departmentsError) ||
    isForbidden(employeesError);
  /* Danh sách quyền còn thiếu để hiển thị đúng nguyên nhân 403, thay vì luôn
     quy về ORG_VIEW dù lỗi thực tế có thể đến từ API departments/employees. */
  const missingPermissions = [
    isForbidden(orgError) ? 'ORG_VIEW' : null,
    isForbidden(departmentsError) ? 'DEPT_VIEW' : null,
    isForbidden(employeesError) ? 'EMP_VIEW' : null,
  ].filter((p): p is string => p != null);
  const isLoading = orgLoading || departmentsLoading || employeesLoading;
  /* Lỗi không phải 403 để hiển thị ApiErrorAlert (403 có màn Result riêng bên dưới) */
  const nonForbiddenError = orgForbidden
    ? null
    : (orgError ?? departmentsError ?? employeesError ?? null);
  const handleRetryAll = () => {
    refetchOrgUnits();
    refetchDepartments();
    refetchEmployees();
  };

  const orgUnitOptions = useMemo(
    () => orgUnits.map((o) => ({ value: o.id, label: o.name })),
    [orgUnits],
  );

  const selectedOrgUnit = selectedNodeId
    ? (orgUnits.find((o) => o.id === selectedNodeId) ?? null)
    : null;

  const selectedDepartment = selectedDepartmentId
    ? (departments.find((d) => d.id === selectedDepartmentId) ?? null)
    : null;

  const selectedDeptEmployees = useMemo(() => {
    if (!selectedDepartmentId) return [];
    return employees.filter(
      (e) => getPrimaryAssignment(e)?.department_id === selectedDepartmentId,
    );
  }, [employees, selectedDepartmentId]);

  const childDepartments = useMemo(
    () => departments.filter((d) => d.orgUnitId === selectedNodeId),
    [departments, selectedNodeId],
  );

  /* ── Nhân viên toàn bộ tổ chức (bao gồm đơn vị con) ── */
  const getDescendantOrgUnitIds = useCallback(
    (rootId: number): number[] => {
      const ids: number[] = [rootId];
      const collect = (parentId: number) => {
        orgUnits
          .filter((o) => o.parentId === parentId)
          .forEach((child) => {
            ids.push(child.id);
            collect(child.id);
          });
      };
      collect(rootId);
      return ids;
    },
    [orgUnits],
  );

  const orgEmployees = useMemo(() => {
    if (!selectedNodeId) return [];
    const ids = new Set(getDescendantOrgUnitIds(selectedNodeId));
    return employees.filter((e) => {
      const pa = getPrimaryAssignment(e);
      return pa && ids.has(pa.org_unit_id);
    });
  }, [employees, selectedNodeId, getDescendantOrgUnitIds]);

  const toggleNode = (nodeId: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const expandAll = () => setExpandedNodes(new Set(orgUnits.map((o) => o.id)));
  const collapseAll = () => setExpandedNodes(new Set());

  /* ── Zoom controls ── */
  const zoomIn = () => setScale((s) => Math.min(s + 0.15, 2.0));
  const zoomOut = () => setScale((s) => Math.max(s - 0.15, 0.4));
  const zoomReset = () => setScale(1);

  /* ── Filter helpers ── */
  const getEmployeesForOrgUnit = useCallback(
    (orgUnitId: number) =>
      employees.filter((e) => {
        const pa = getPrimaryAssignment(e);
        return pa?.org_unit_id === orgUnitId && e.employeeStatus === 2;
      }),
    [employees],
  );

  const getEmployeesForDept = useCallback(
    (deptId: number) =>
      employees.filter((e) => {
        const pa = getPrimaryAssignment(e);
        return pa?.department_id === deptId && e.employeeStatus === 2;
      }),
    [employees],
  );

  const getOrgManager = useCallback(
    (orgUnitId: number): Employee | undefined => {
      const targetUnit = orgUnits.find((u) => u.id === orgUnitId);
      if (!targetUnit) return undefined;
      if (targetUnit.managerId) {
        return employees.find((e) => e.id === targetUnit.managerId);
      }
      return undefined;
    },
    [orgUnits, employees],
  );

  /* ── Handle node click: select node ── */
  const handleNodeSelect = useCallback((nodeId: number) => {
    setSelectedNodeId(nodeId);
    setSelectedDepartmentId(null);
  }, []);

  const handleDepartmentSelect = useCallback((deptId: number) => {
    setSelectedDepartmentId(deptId);
    setSelectedNodeId(null);
  }, []);

  const handleNodeToggle = useCallback((nodeId: number) => {
    toggleNode(nodeId);
  }, []);

  /* ── Render the tree ── */
  const renderOrgTree = () => {
    const rootUnits = filterOrgId
      ? orgUnits.filter((o) => o.id === filterOrgId)
      : orgUnits.filter((o) => !o.parentId);

    if (rootUnits.length === 0) {
      return (
        <EmptyState
          title={filterOrgId ? 'Không tìm thấy đơn vị' : 'Chưa có dữ liệu cây'}
          description={
            filterOrgId
              ? 'Đơn vị đã chọn không còn tồn tại. Thử chọn lại bộ lọc.'
              : 'Chưa có đơn vị trong phạm vi.'
          }
        />
      );
    }

    return (
      <div
        ref={treeWrapperRef}
        style={{
          padding: '24px 20px 30px',
          overflow: 'auto',
          background: '#fafaf8',
          minHeight: 220,
          maxHeight: 600,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 20,
            minWidth: '100%',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            transition: 'transform 0.2s ease',
          }}
        >
          {rootUnits.map((root) => (
            <OrgTreeNode
              key={root.id}
              node={root}
              orgUnits={orgUnits}
              departments={departments}
              employees={employees}
              expandedNodes={expandedNodes}
              selectedNodeId={selectedNodeId}
              selectedDepartmentId={selectedDepartmentId}
              onSelect={handleNodeSelect}
              onSelectDepartment={handleDepartmentSelect}
              onToggle={handleNodeToggle}
              level={0}
              getOrgManager={getOrgManager}
              getEmployeesForOrgUnit={getEmployeesForOrgUnit}
              getEmployeesForDept={getEmployeesForDept}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #org-chart-card, #org-chart-card * { visibility: visible; }
          #org-chart-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          .no-print, .no-print * { display: none !important; }
        }
      `}</style>

      <PageHeader
        title="Sơ đồ tổ chức"
        subtitle="Xem cấu trúc tổ chức toàn doanh nghiệp."
      />

      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          fontSize: 12.5,
          color: '#6b675e',
        }}
      >
        <Avatar size={20} icon={<UserOutlined />} />
        <span>
          <b>{user?.name ?? user?.email ?? '—'}</b> · {roleLabel}
        </span>
        <Tag color={isSuperAdmin ? 'gold' : 'default'} style={{ margin: 0 }}>
          {dataScopeLabel}
        </Tag>
      </div>

      <Card id="org-chart-card" variant="borderless">
        {/* ── Toolbar ── */}
        <div
          className="no-print"
          style={{
            marginBottom: 16,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {/* Filter by org unit */}
          <Select
            showSearch
            placeholder="Tất cả đơn vị"
            options={[{ value: 0, label: 'Tất cả đơn vị' }, ...orgUnitOptions]}
            value={filterOrgId ?? 0}
            onChange={(val) => {
              const nextVal = val === 0 ? null : val;
              setFilterOrgId(nextVal);
              setSelectedNodeId(nextVal);
              setSelectedDepartmentId(null);
              if (nextVal != null) {
                setExpandedNodes((prev) => new Set(prev).add(nextVal));
              }
            }}
            style={{ width: 220 }}
            filterOption={(input, option) =>
              (option?.label as string)
                ?.toLowerCase()
                .includes(input.toLowerCase()) ?? false
            }
          />

          {/* Expand/Collapse */}
          <Space size={4}>
            <Button icon={<ShrinkOutlined />} onClick={collapseAll}>
              Thu gọn
            </Button>
            <Button icon={<ExpandAltOutlined />} onClick={expandAll}>
              Mở rộng
            </Button>
          </Space>

          {/* Zoom controls */}
          <Space size={4}>
            <Tooltip title="Thu nhỏ">
              <Button icon={<ZoomOutOutlined />} onClick={zoomOut} />
            </Tooltip>
            <Text
              style={{
                width: 44,
                textAlign: 'center',
                fontSize: 13,
                color: '#555',
                userSelect: 'none',
              }}
            >
              {Math.round(scale * 100)}%
            </Text>
            <Tooltip title="Phóng to">
              <Button icon={<ZoomInOutlined />} onClick={zoomIn} />
            </Tooltip>
            <Tooltip title="Khôi phục kích thước">
              <Button icon={<AimOutlined />} onClick={zoomReset} />
            </Tooltip>
          </Space>

          <div style={{ flex: 1 }} />

          {/* Export PDF */}
          <Can permission="ORG_EXPORT">
            <Button
              icon={<ExportOutlined />}
              onClick={handleExportPdf}
              loading={isExporting}
            >
              Xuất PDF
            </Button>
          </Can>
        </div>

        {/* ── Error (không phải 403, đã có màn Result riêng bên dưới) ── */}
        {nonForbiddenError && (
          <ApiErrorAlert
            error={nonForbiddenError}
            title="Không tải được dữ liệu sơ đồ tổ chức"
            onRetry={handleRetryAll}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* ── Permission Denied (P0) ── */}
        {orgForbidden && (
          <div style={{ padding: '40px 20px' }}>
            <Result
              status="error"
              icon={
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: '#fbe7e6',
                    border: '2px solid #d8a9a6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: 28,
                    color: '#b94a48',
                  }}
                >
                  ⊘
                </div>
              }
              title="Không có quyền xem sơ đồ tổ chức"
              subTitle={
                <div style={{ maxWidth: 480, margin: '0 auto' }}>
                  <p>
                    Bạn thiếu quyền xem{' '}
                    {missingPermissions
                      .map((p) => {
                        switch (p) {
                          case 'ORG_VIEW':
                            return 'dữ liệu tổ chức';
                          case 'DEPT_VIEW':
                            return 'dữ liệu phòng ban';
                          case 'EMP_VIEW':
                            return 'dữ liệu nhân sự';
                          default:
                            return p;
                        }
                      })
                      .join(', ')}{' '}
                    (
                    {missingPermissions.map((p, i) => (
                      <span key={p}>
                        {i > 0 && ', '}
                        <b>{p}</b>
                      </span>
                    ))}
                    ) để truy cập trang này.
                  </p>
                  <p style={{ color: '#8c887e', fontSize: 13 }}>
                    Nếu bạn có quyền nhưng không thấy dữ liệu, có thể bạn đang ở
                    ngoài phạm vi dữ liệu được cấp. Vui lòng liên hệ quản trị
                    viên để được hỗ trợ.
                  </p>
                </div>
              }
              extra={
                <Button
                  type="primary"
                  onClick={() => navigate(-1)}
                  style={{ background: '#356fa3' }}
                >
                  Quay lại
                </Button>
              }
            />
          </div>
        )}

        {/* ── Loading ── */}
        {isLoading ? (
          <LoadingState tip="Đang tải sơ đồ tổ chức…" minHeight={320} />
        ) : !orgForbidden ? (
          renderOrgTree()
        ) : null}

        {/* ── Legend ── */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '11px 16px',
            borderTop: '1px solid #ece9e1',
            fontSize: 12.5,
            color: '#6b675e',
            flexWrap: 'wrap',
          }}
        >
          <Tag color="red" style={{ marginRight: 0 }}>
            Cty mẹ
          </Tag>
          <Tag color="blue" style={{ marginRight: 0 }}>
            Cty con
          </Tag>
          <Tag color="green" style={{ marginRight: 0 }}>
            Chi nhánh
          </Tag>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 14,
                height: 11,
                border: '2px solid #356fa3',
                borderRadius: 2,
                background: '#eaf1f8',
              }}
            />
            Node đang chọn
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 14,
                height: 11,
                border: '1.5px dashed #8c887e',
                borderRadius: 2,
                background: '#fff',
              }}
            />
            Phòng ban
          </span>
          <span style={{ marginLeft: 'auto', color: '#999' }}>
            Click node → xem chi tiết · Lọc theo data scope
          </span>
        </div>
      </Card>

      {/* ── Node Detail Panel (inline) ── */}
      {selectedOrgUnit && (
        <OrgUnitDetailPanel
          orgUnit={selectedOrgUnit}
          childDepartments={childDepartments}
          orgEmployees={orgEmployees}
          getOrgManager={getOrgManager}
          onNavigateToOrgUnit={() => {
            navigate(`/org-units?id=${selectedOrgUnit.id}`);
          }}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {/* ── Department Detail Panel (inline) ── */}
      {selectedDepartment && (
        <DepartmentDetailPanel
          department={selectedDepartment}
          deptEmployees={selectedDeptEmployees}
          onNavigateToDepartment={() => {
            navigate(`/departments?id=${selectedDepartment.id}`);
          }}
          onClose={() => setSelectedDepartmentId(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ORG TREE NODE
   ═══════════════════════════════════════════════ */
interface OrgTreeNodeProps {
  node: OrgUnit;
  orgUnits: OrgUnit[];
  departments: Department[];
  employees: Employee[];
  expandedNodes: Set<number>;
  selectedNodeId: number | null;
  selectedDepartmentId: number | null;
  onSelect: (id: number) => void;
  onSelectDepartment: (id: number) => void;
  onToggle: (id: number) => void;
  level: number;
  getOrgManager: (id: number) => Employee | undefined;
  getEmployeesForOrgUnit: (id: number) => Employee[];
  getEmployeesForDept: (id: number) => Employee[];
}

function OrgTreeNode({
  node,
  orgUnits,
  departments,
  employees,
  expandedNodes,
  selectedNodeId,
  selectedDepartmentId,
  onSelect,
  onSelectDepartment,
  onToggle,
  level,
  getOrgManager,
  getEmployeesForOrgUnit,
  getEmployeesForDept,
}: OrgTreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const children = orgUnits.filter((o) => o.parentId === node.id);
  const activeCount = getEmployeesForOrgUnit(node.id).length;
  const manager = getOrgManager(node.id);
  const color = getUnitColor(node.unitType);
  // `childDepts`: TẤT CẢ phòng ban/nhóm-tổ thuộc đơn vị này (mọi cấp, phẳng)
  // — dùng để đếm tổng (tooltip, badge). `rootDepts`: chỉ phòng ban gốc
  // (parentId null) — nhóm/tổ con (parentId trỏ vào phòng ban cha) được
  // render lồng bên trong chip của phòng ban cha qua <DeptChip> đệ quy thay
  // vì liệt kê phẳng ngang hàng (P2 fix — hỗ trợ nhóm/tổ nhiều cấp).
  const childDepts = departments.filter((d) => d.orgUnitId === node.id);
  const rootDepts = childDepts.filter((d) => d.parentId == null);
  const DEPT_PREVIEW_COUNT = 4;
  const [showAllDepts, setShowAllDepts] = useState(false);
  const visibleRootDepts = showAllDepts
    ? rootDepts
    : rootDepts.slice(0, DEPT_PREVIEW_COUNT);

  const CHILDREN_PREVIEW_COUNT = 8;
  const [showAllChildren, setShowAllChildren] = useState(false);
  const visibleChildren =
    showAllChildren || children.length <= CHILDREN_PREVIEW_COUNT
      ? children
      : children.slice(0, CHILDREN_PREVIEW_COUNT);
  const hiddenChildrenCount = children.length - visibleChildren.length;

  const handleClick = () => {
    onSelect(node.id);
    // Toggle cả khi node chỉ có phòng ban (không có đơn vị con) — trước đây
    // chỉ toggle khi children.length > 0 nên các đơn vị lá (vd: chi nhánh
    // không có chi nhánh con, chỉ có phòng ban) không bao giờ mở rộng được
    // bằng cách click trực tiếp, khiến danh sách phòng ban/nút "xem tất cả
    // phòng ban" không bao giờ hiện ra khi bấm node (P0 fix).
    if (children.length > 0 || childDepts.length > 0) onToggle(node.id);
  };

  const tooltipContent = (
    <div style={{ fontSize: 12, maxWidth: 220 }}>
      <div>
        <b>{node.name}</b>
      </div>
      <div style={{ color: '#aaa', marginTop: 2 }}>Mã: {node.code}</div>
      <div style={{ marginTop: 2 }}>
        Loại: {getUnitTypeLabel(node.unitType)}
      </div>
      {manager && (
        <div style={{ marginTop: 2 }}>Quản lý: {manager.fullName}</div>
      )}
      <div style={{ marginTop: 2 }}>
        NV: {activeCount} · Phòng ban: {childDepts.length}
      </div>
      {children.length > 0 && <div>ĐV con: {children.length}</div>}
    </div>
  );

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {/* ── Node Card ── */}
      <Tooltip title={tooltipContent} color="#2c3e50" placement="right">
        <div
          style={{
            width: 180,
            background: isSelected ? color.bg : '#ffffff',
            border: `1.5px solid ${isSelected ? color.border : '#e3e0d8'}`,
            borderRadius: 8,
            padding: '10px 12px',
            boxShadow: isSelected
              ? `0 4px 12px rgba(0,0,0,0.10)`
              : '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
          onClick={handleClick}
          onMouseEnter={(e) => {
            if (!isSelected) {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 4px 12px rgba(0,0,0,0.08)';
              (e.currentTarget as HTMLElement).style.borderColor = color.accent;
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 1px 3px rgba(0,0,0,0.04)';
              (e.currentTarget as HTMLElement).style.borderColor = '#e3e0d8';
            }
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
            }}
          >
            <span style={{ color: color.accent, display: 'flex' }}>
              {getUnitIcon(node.unitType)}
            </span>
            <Tag
              color={color.tag}
              style={{ margin: 0, fontSize: 10, lineHeight: '18px' }}
            >
              {getUnitTypeLabel(node.unitType)}
            </Tag>
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              lineHeight: 1.3,
              color: '#222',
            }}
          >
            {node.name}
          </div>
          <div style={{ fontSize: 10.5, color: '#999', marginTop: 1 }}>
            Mã: {node.code}
          </div>

          {/* Quản lý */}
          {manager && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 5,
              }}
            >
              <Avatar
                size={18}
                icon={<UserOutlined />}
                style={{ background: color.accent, fontSize: 10 }}
              />
              <Text
                style={{ fontSize: 11, color: '#555' }}
                ellipsis={{ tooltip: manager.fullName }}
              >
                {manager.fullName}
              </Text>
            </div>
          )}

          {/* Thống kê */}
          <div
            style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}
          >
            <span
              style={{
                fontSize: 10.5,
                background: '#f0f0ee',
                padding: '1px 7px',
                borderRadius: 10,
                color: '#5a6573',
              }}
            >
              <TeamOutlined style={{ fontSize: 10, marginRight: 2 }} />
              {activeCount} NV
            </span>
            {children.length > 0 && (
              <span
                style={{
                  fontSize: 10.5,
                  background: isExpanded ? '#e8eef5' : '#f0f0ee',
                  padding: '1px 7px',
                  borderRadius: 10,
                  color: '#5a6573',
                  border: '1px solid #cdd2da',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(node.id);
                }}
              >
                {isExpanded ? '▾' : '▸'} {children.length} ĐV
              </span>
            )}
          </div>
        </div>
      </Tooltip>

      {/* ── Children connectors ── */}
      {children.length > 0 && isExpanded && (
        <>
          {/* Vertical line from parent */}
          <div
            style={{
              width: 2,
              height: 20,
              background: color.accent,
              opacity: 0.6,
            }}
          />
          {/* Children container — no gap, spacing done via child padding so
              each child's horizontal connector segment is part of a
              continuous line instead of breaking across the flex gap */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              paddingTop: 0,
              position: 'relative',
            }}
          >
            {visibleChildren.map((child, index) => {
              const isFirst = index === 0;
              const isLast = index === visibleChildren.length - 1;
              return (
                <div
                  key={child.id}
                  style={{
                    position: 'relative',
                    padding: '20px 9px 0',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  {/* Horizontal connector segment (meets neighbors at the
                      shared box edge, so the line stays unbroken) */}
                  {visibleChildren.length > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        display: 'flex',
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          background: isFirst ? 'transparent' : color.accent,
                          opacity: 0.4,
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          background: isLast ? 'transparent' : color.accent,
                          opacity: 0.4,
                        }}
                      />
                    </div>
                  )}
                  {/* Vertical connector from horizontal bar */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      width: 2,
                      height: 20,
                      background: color.accent,
                      opacity: 0.6,
                    }}
                  />
                  <OrgTreeNode
                    node={child}
                    orgUnits={orgUnits}
                    departments={departments}
                    employees={employees}
                    expandedNodes={expandedNodes}
                    selectedNodeId={selectedNodeId}
                    selectedDepartmentId={selectedDepartmentId}
                    onSelect={onSelect}
                    onSelectDepartment={onSelectDepartment}
                    onToggle={onToggle}
                    level={level + 1}
                    getOrgManager={getOrgManager}
                    getEmployeesForOrgUnit={getEmployeesForOrgUnit}
                    getEmployeesForDept={getEmployeesForDept}
                  />
                </div>
              );
            })}
            {hiddenChildrenCount > 0 && (
              <div
                style={{
                  position: 'relative',
                  padding: '20px 9px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: color.accent,
                    opacity: 0.4,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    width: 2,
                    height: 20,
                    background: color.accent,
                    opacity: 0.6,
                  }}
                />
                <div
                  style={{
                    width: 150,
                    marginTop: 20,
                    border: `1.5px dashed ${color.accent}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    background: '#fff',
                    fontSize: 12,
                    color: color.accent,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllChildren(true);
                  }}
                >
                  +{hiddenChildrenCount} đơn vị khác — xem tất cả
                </div>
              </div>
            )}
            {showAllChildren && children.length > CHILDREN_PREVIEW_COUNT && (
              <div
                style={{
                  width: '100%',
                  textAlign: 'center',
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    color: '#356fa3',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllChildren(false);
                  }}
                >
                  Thu gọn
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Department leaf nodes ── */}
      {childDepts.length > 0 && isExpanded && (
        <>
          <div style={{ width: 2, height: 16, background: '#b9b6ad' }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              gap: 10,
              flexWrap: 'wrap',
              paddingTop: 6,
            }}
          >
            {visibleRootDepts.map((dept) => (
              <DeptChip
                key={dept.id}
                dept={dept}
                allDeptsInUnit={childDepts}
                selectedDepartmentId={selectedDepartmentId}
                onSelectDepartment={onSelectDepartment}
                getEmployeesForDept={getEmployeesForDept}
              />
            ))}
            {rootDepts.length > DEPT_PREVIEW_COUNT && (
              <div
                style={{
                  fontSize: 10.5,
                  color: '#356fa3',
                  padding: '5px 0',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllDepts((prev) => !prev);
                }}
              >
                {showAllDepts
                  ? 'Thu gọn'
                  : `+${rootDepts.length - DEPT_PREVIEW_COUNT} phòng ban khác — xem tất cả`}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DEPT CHIP (đệ quy) — render 1 phòng ban/nhóm-tổ, lồng nhóm/tổ con
   (parentId trỏ về phòng ban này) thụt lề bên dưới thay vì liệt kê phẳng.
   ═══════════════════════════════════════════════ */
interface DeptChipProps {
  dept: Department;
  allDeptsInUnit: Department[];
  selectedDepartmentId: number | null;
  onSelectDepartment: (id: number) => void;
  getEmployeesForDept: (id: number) => Employee[];
}

function DeptChip({
  dept,
  allDeptsInUnit,
  selectedDepartmentId,
  onSelectDepartment,
  getEmployeesForDept,
}: DeptChipProps) {
  const children = allDeptsInUnit.filter((d) => d.parentId === dept.id);
  const deptEmpCount = getEmployeesForDept(dept.id).length;
  const isDeptSelected = selectedDepartmentId === dept.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Tooltip
        title={`${dept.name} · ${deptEmpCount} nhân viên`}
        color="#2c3e50"
      >
        <div
          style={{
            border: `1.5px dashed ${isDeptSelected ? '#356fa3' : '#b9b6ad'}`,
            borderRadius: 6,
            padding: '5px 10px',
            background: isDeptSelected ? '#eaf1f8' : '#fff',
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectDepartment(dept.id);
          }}
        >
          <ApartmentOutlined style={{ fontSize: 11, color: '#7f8c8d' }} />
          <span>{dept.name}</span>
          <span style={{ color: '#999', marginLeft: 2 }}>({deptEmpCount})</span>
        </div>
      </Tooltip>

      {children.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginTop: 6,
            marginLeft: 14,
            paddingLeft: 8,
            borderLeft: '1.5px dotted #b9b6ad',
          }}
        >
          {children.map((child) => (
            <DeptChip
              key={child.id}
              dept={child}
              allDeptsInUnit={allDeptsInUnit}
              selectedDepartmentId={selectedDepartmentId}
              onSelectDepartment={onSelectDepartment}
              getEmployeesForDept={getEmployeesForDept}
            />
          ))}
        </div>
      )}
    </div>
  );
}
