import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Button, Col, Input, Radio, Row, Typography } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { ROUTES } from '@/shared/constants/routes';

import { FormModal, confirmDialog } from '@/shared/components';
import { useApiFormErrors } from '@/shared/hooks/useApiFormErrors';
import { useFormDraft } from '@/shared/hooks/useFormDraft';
import {
  FormAutocomplete,
  FormDatePicker,
  FormField,
  FormInput,
  FormSelect,
} from '@/shared/components/forms';
import {
  employeeSchema,
  type EmployeeFormValues,
} from '@/modules/employees/schemas/employee.schema';
import {
  EMPLOYEE_STATUS_LABELS,
  EmployeeStatus,
  GENDER_LABELS,
  getPrimaryAssignment,
} from '@/modules/employees/types/employees.types';
import type { Employee } from '@/modules/employees/types/employees.types';
import type { Department } from '@/modules/departments/types/departments.types';
import dayjs from 'dayjs';

const { Text } = Typography;

const GENDER_OPTIONS = Object.entries(GENDER_LABELS).map(([value, label]) => ({
  value: Number(value),
  label,
}));

const STATUS_OPTIONS = Object.entries(EMPLOYEE_STATUS_LABELS).map(
  ([value, label]) => ({
    value: Number(value),
    label,
  }),
);

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: '700',
  color: '#356fa3',
  borderBottom: '1.5px solid #e3e0d8',
  paddingBottom: '8px',
  marginBottom: '16px',
  marginTop: '20px',
};
const firstSectionHeaderStyle: React.CSSProperties = {
  ...sectionHeaderStyle,
  marginTop: 0,
};
const fieldLabelStyle: React.CSSProperties = {
  marginBottom: 6,
  fontWeight: 500,
};
const scrollAreaStyle: React.CSSProperties = {
  maxHeight: 'calc(100vh - 280px)',
  overflowY: 'auto',
  paddingRight: '12px',
};
const taxCodeLabelStyle: React.CSSProperties = { marginBottom: 8 };
const assignmentNoticeStyle: React.CSSProperties = {
  background: '#fffbe6',
  border: '1px solid #ffe58f',
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 13,
  color: '#614700',
  marginBottom: 12,
};
const linkedAccountBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  background: '#f5f5f5',
  border: '1px dashed #d9d9d9',
  borderRadius: '6px',
  padding: '12px',
  fontSize: '13px',
  color: '#555',
  marginTop: '8px',
};
const linkedAccountDotStyle: React.CSSProperties = {
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  background: '#1677ff',
  opacity: 0.15,
  flex: 'none',
};
const linkedAccountTextStyle: React.CSSProperties = { flex: 1 };
const fieldErrorStyle: React.CSSProperties = {
  color: '#ff4d4f',
  fontSize: 12,
  marginTop: 4,
};
const passwordHintStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#888',
  marginTop: 4,
};

const DEFAULTS: EmployeeFormValues = {
  code: '',
  fullName: '',
  email: '',
  phone: '',
  gender: null,
  birthday: null,
  address: '',
  cccd: '',
  personalTaxCode: '',
  orgUnitId: null,
  departmentId: null,
  positionId: null,
  managerId: null,
  hireDate: null,
  active: true,
  employeeStatus: null,
};

export interface EmployeeFormModalProps {
  open: boolean;
  editing: Employee | null;
  submitting: boolean;
  orgUnitOptions: { value: number; label: string }[];
  departments: Department[];
  positionOptions: { value: number; label: string }[];
  employees: Employee[];
  onCancel: () => void;
  onSubmit: (values: EmployeeFormValues) => void;
  apiErrors?: Record<string, string> | null;
}

export function EmployeeFormModal({
  open,
  editing,
  submitting,
  orgUnitOptions,
  departments,
  positionOptions,
  employees,
  onCancel,
  onSubmit,
  apiErrors,
}: EmployeeFormModalProps) {
  const { control, handleSubmit, reset, setError, setValue, getValues, watch } =
    useForm<EmployeeFormValues>({
      resolver: zodResolver(employeeSchema),
      defaultValues: DEFAULTS,
      mode: 'onChange', // Kích hoạt validation real-time khi người dùng nhập
    });

  const orgUnitId = useWatch({ control, name: 'orgUnitId' });
  const departmentId = useWatch({ control, name: 'departmentId' });

  // Mật khẩu cấp tài khoản đăng nhập — chỉ hỏi khi tạo mới (POST /employees
  // tạo nhân sự + tài khoản atomic khi có password, xác minh thật 2026-07-05).
  // Không quản lý qua RHF/zod vì chỉ bắt buộc lúc tạo mới, giữ cùng cách
  // validate cục bộ như CreateAccountModal trước đây.
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Draft saving for create mode
  const draft = useFormDraft<Partial<EmployeeFormValues>>('employee-create');
  const submittedRef = useRef(false);
  const passwordError =
    password.length > 0 && password.length < 8
      ? 'Mật khẩu phải có ít nhất 8 ký tự'
      : null;
  const confirmPasswordError =
    confirmPassword.length > 0 && confirmPassword !== password
      ? 'Mật khẩu xác nhận không khớp'
      : null;
  const isPasswordValid =
    !!editing || (password.length >= 8 && password === confirmPassword);

  // Nguồn của mã số thuế cá nhân: 'own' = nhập MST riêng, 'cccd' = chưa có MST (gửi null)
  const [taxCodeSource, setTaxCodeSource] = useState<'own' | 'cccd'>('cccd');

  // P1.6: Lọc phòng ban theo đơn vị trực thuộc (orgUnitId)
  const filteredDepartmentOptions = useMemo(() => {
    if (!orgUnitId) return [];
    const currentDeptId = editing
      ? getPrimaryAssignment(editing)?.department_id
      : null;
    return departments
      .filter(
        (d) =>
          d.orgUnitId === orgUnitId && (d.active || d.id === currentDeptId),
      )
      .map((d) => ({
        value: d.id,
        label: d.active
          ? `${d.code} — ${d.name}`
          : `${d.code} — ${d.name} (inactive)`,
      }));
  }, [departments, orgUnitId, editing]);

  // P1.7: Lọc manager theo đơn vị/phòng ban và loại bỏ suspended/resigned
  const managerOptions = useMemo(() => {
    return employees
      .filter((e) => {
        if (editing && e.id === editing.id) return false;
        if (!e.status) return false;

        // Loại bỏ nhân sự tạm ngưng (3) hoặc nghỉ việc (4)
        if (
          e.employeeStatus === EmployeeStatus.SUSPENDED ||
          e.employeeStatus === EmployeeStatus.RESIGNED
        ) {
          return false;
        }

        const assignment = getPrimaryAssignment(e);
        if (departmentId) {
          return assignment?.department_id === departmentId;
        }
        if (orgUnitId) {
          return assignment?.org_unit_id === orgUnitId;
        }
        return false;
      })
      .map((e) => ({ value: e.id, label: `${e.code} — ${e.fullName}` }));
  }, [employees, editing, orgUnitId, departmentId]);

  // Tự động xóa phòng ban và quản lý nếu đổi đơn vị
  useEffect(() => {
    if (!orgUnitId) {
      setValue('departmentId', null);
      setValue('managerId', null);
      return;
    }
    if (departmentId) {
      const isStillValid = filteredDepartmentOptions.some(
        (opt) => opt.value === departmentId,
      );
      if (!isStillValid) {
        setValue('departmentId', null);
        setValue('managerId', null);
      }
    }
  }, [orgUnitId, departmentId, filteredDepartmentOptions, setValue]);

  // Nạp dữ liệu khi mở modal
  useEffect(() => {
    if (open) {
      if (editing) {
        const assignment = getPrimaryAssignment(editing);
        reset({
          code: editing.code,
          fullName: editing.fullName,
          email: editing.email,
          phone: editing.phone ?? '',
          gender: editing.gender ?? null,
          birthday: editing.birthday ? dayjs(editing.birthday) : null,
          address: editing.address ?? '',
          cccd: editing.cccd ?? '',
          personalTaxCode: editing.personalTaxCode ?? '',
          orgUnitId: assignment?.org_unit_id ?? null,
          departmentId: assignment?.department_id ?? null,
          positionId: assignment?.position_id ?? null,
          managerId: assignment?.manager_id ?? null,
          hireDate: editing.hireDate ? dayjs(editing.hireDate) : null,
          active: !!editing.status,
          employeeStatus:
            editing.employeeStatus != null
              ? (Number(editing.employeeStatus) as EmployeeStatus)
              : null,
        });
        // Nếu personalTaxCode có giá trị → đã có MST riêng, không so sánh với CCCD
        const hasOwnTaxCode = !!editing.personalTaxCode;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTaxCodeSource(hasOwnTaxCode ? 'own' : 'cccd');
      } else {
        reset(DEFAULTS);

        setTaxCodeSource('cccd');
      }

      setPassword('');

      setConfirmPassword('');

      setPasswordTouched(false);
    }
  }, [open, editing, reset]);

  // Restore draft when modal opens for create mode
  useEffect(() => {
    if (!open || editing) return;
    const timer = setTimeout(() => {
      const saved = draft.restore();
      if (saved) {
        reset((prev) => ({ ...prev, ...saved }));
      }
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Save draft when modal closes (unless it was just submitted)
  useEffect(() => {
    if (open === false && !editing && !submittedRef.current) {
      const current = getValues();
      draft.save(current as Partial<EmployeeFormValues>);
    }
    if (open === false) {
      submittedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Save draft on unmount if modal is open (user navigates away to another page)
  useEffect(() => {
    return () => {
      if (open && !editing && !submittedRef.current) {
        const current = getValues();
        draft.save(current as Partial<EmployeeFormValues>);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Autosave draft liên tục khi người dùng gõ (debounce) — đảm bảo dữ liệu
  // không mất khi điều hướng sang trang khác trước khi effect unmount ở trên
  // kịp chạy (ví dụ route chuyển trang bằng SPA navigation).
  useEffect(() => {
    if (!open || editing) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = watch((values) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        draft.save(values as Partial<EmployeeFormValues>);
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Key phải là tên field SAU KHI `extractFieldErrors()` (api-error.ts) đã tự
  // snake_case → camelCase — không phải tên field gốc từ BE (xem cảnh báo trong
  // useApiFormErrors.ts). Toàn bộ entry dưới đây là no-op vì tên sau chuyển đổi
  // đã trùng sẵn với tên field form; giữ lại chỉ để tài liệu hoá tường minh.
  const SNAKE_TO_CAMEL = useMemo<Record<string, keyof EmployeeFormValues>>(
    () => ({
      fullName: 'fullName',
      personalTaxCode: 'personalTaxCode',
      orgUnitId: 'orgUnitId',
      departmentId: 'departmentId',
      positionId: 'positionId',
      managerId: 'managerId',
      hireDate: 'hireDate',
      employeeStatus: 'employeeStatus',
    }),
    [],
  );

  // Map lỗi validation từ BE xuống từng field trong form (chuẩn hóa qua useApiFormErrors).
  useApiFormErrors(apiErrors, setError, SNAKE_TO_CAMEL);

  // Khi chọn "Chưa có MST riêng", xóa personalTaxCode (gửi null lên BE)
  useEffect(() => {
    if (taxCodeSource !== 'cccd') return;
    setValue('personalTaxCode', '', { shouldValidate: true });
  }, [taxCodeSource, setValue]);

  const navigate = useNavigate();

  const handleNavigateToTransfer = () => {
    if (!editing) return;
    onCancel();
    navigate(`${ROUTES.EMPLOYEE_ASSIGNMENTS}?employee_id=${editing.id}`);
  };

  const onFormSubmit = () =>
    handleSubmit((values) => {
      if (!editing) {
        setPasswordTouched(true);
        if (!isPasswordValid) return;
      }
      submittedRef.current = true;
      draft.clear();
      onSubmit({ ...values, password: editing ? undefined : password });
    })();

  const handleCancelClick = () => {
    if (!editing) {
      const current = getValues();
      const hasData = Object.values(current).some((val) => {
        if (val === null || val === undefined || val === '') return false;
        if (typeof val === 'boolean') return false;
        return true;
      });
      if (hasData) {
        confirmDialog({
          title: 'Xác nhận hủy',
          content: 'Bạn có chắc chắn muốn hủy? Dữ liệu đã nhập sẽ bị xóa.',
          okText: 'Đồng ý',
          cancelText: 'Tiếp tục nhập',
          danger: true,
          onOk: () => {
            draft.clear();
            onCancel();
          },
        });
        return;
      }
    }
    draft.clear();
    onCancel();
  };

  // Bấm ra ngoài modal / phím Esc / nút X — không hỏi xác nhận, chỉ lưu tạm
  // để mở lại vẫn còn dữ liệu vừa nhập.
  const handleDismiss = () => {
    if (!editing) {
      const current = getValues();
      draft.save(current as Partial<EmployeeFormValues>);
    }
    onCancel();
  };

  return (
    <FormModal
      open={open}
      title={editing ? 'Sửa nhân sự' : 'Thêm nhân sự'}
      onOk={onFormSubmit}
      onCancel={handleCancelClick}
      onDismiss={handleDismiss}
      loading={submitting}
      width={900}
    >
      <div style={scrollAreaStyle}>
        {/* 1 · Thông tin cơ bản */}
        <div style={firstSectionHeaderStyle}>1 · Thông tin cơ bản</div>
        <Row gutter={16}>
          <Col span={8}>
            <FormInput
              control={control}
              name="code"
              label="Mã NV"
              disabled={true}
              placeholder={editing ? undefined : '[Tự động sinh]'}
            />
          </Col>
          <Col span={16}>
            <FormInput
              control={control}
              name="fullName"
              label="Họ và tên"
              placeholder="Ví dụ: Nguyễn Văn A"
              required
              alphabeticOnly
              maxLength={100}
            />
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <FormField
              control={control}
              name="gender"
              label="Giới tính"
              required
            >
              {(field) => <Radio.Group {...field} options={GENDER_OPTIONS} />}
            </FormField>
          </Col>
          <Col span={12}>
            <FormDatePicker
              control={control}
              name="birthday"
              label="Ngày sinh"
              required
            />
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <FormInput
              control={control}
              name="cccd"
              label="Số CCCD / CMND"
              placeholder="Ví dụ: 001090012345"
              required
              numericOnly
              maxLength={12}
            />
          </Col>
          <Col span={12}>
            <FormInput
              control={control}
              name="phone"
              label="Số điện thoại"
              placeholder="Ví dụ: 0912345678"
              required
              numericOnly
              maxLength={10}
            />
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <FormInput
              control={control}
              name="email"
              label="Email"
              placeholder="Ví dụ: nguyenvana@gmail.com"
              required
            />
          </Col>
          <Col span={12}>
            <FormInput
              control={control}
              name="address"
              label="Địa chỉ"
              placeholder="Ví dụ: Số 123 Nguyễn Trãi, Thanh Xuân, Hà Nội"
              required
              maxLength={200}
            />
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <div style={taxCodeLabelStyle}>Mã số thuế cá nhân</div>
            <Radio.Group
              value={taxCodeSource}
              onChange={(e) => setTaxCodeSource(e.target.value)}
              options={[
                { value: 'cccd', label: 'Chưa có mã số thuế' },
                { value: 'own', label: 'Đã có mã số thuế riêng' },
              ]}
            />
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <FormInput
              control={control}
              name="personalTaxCode"
              label="Mã số thuế cá nhân"
              placeholder="Ví dụ: 0102030405"
              numericOnly
              maxLength={10}
              disabled={taxCodeSource === 'cccd'}
            />
          </Col>
        </Row>

        {/* 2 · Công tác */}
        <div style={sectionHeaderStyle}>2 · Công tác</div>
        {editing && (
          <div style={assignmentNoticeStyle}>
            <div style={{ marginBottom: 8 }}>
              Đơn vị/Phòng ban/Chức vụ chỉ hiển thị theo phân công hiện tại — để
              thay đổi, vui lòng dùng chức năng{' '}
              <strong>Điều chuyển công tác</strong> (đảm bảo đóng phân công
              cũ/mở phân công mới theo ngày hiệu lực).
            </div>
            <Button
              type="primary"
              icon={<SwapOutlined />}
              size="small"
              onClick={handleNavigateToTransfer}
            >
              Điều chuyển công tác
            </Button>
          </div>
        )}
        <Row gutter={16}>
          <Col span={12}>
            <FormSelect
              control={control}
              name="orgUnitId"
              label="Chi nhánh / Đơn vị"
              placeholder="Chọn chi nhánh / đơn vị..."
              options={orgUnitOptions}
              disabled={!!editing}
              required
            />
          </Col>
          <Col span={12}>
            <FormSelect
              control={control}
              name="departmentId"
              label="Phòng ban"
              placeholder="Chọn phòng ban..."
              options={filteredDepartmentOptions}
              disabled={!!editing || !orgUnitId}
              required
            />
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <FormSelect
              control={control}
              name="positionId"
              label="Chức vụ"
              placeholder="Chọn chức vụ..."
              options={positionOptions}
              disabled={!!editing}
              required
            />
          </Col>
          <Col span={12}>
            <FormAutocomplete
              control={control}
              name="managerId"
              label="Người quản lý"
              placeholder="Gõ tên/mã NV để tìm..."
              disabled={!orgUnitId}
              required
              autocompleteOptions={{
                staticOptions: managerOptions.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                })),
                minSearchLength: 1,
              }}
            />
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <FormDatePicker
              control={control}
              name="hireDate"
              label="Ngày vào làm"
            />
          </Col>
          <Col span={12}>
            <FormSelect
              control={control}
              name="employeeStatus"
              label="Trạng thái"
              placeholder="Chọn trạng thái..."
              options={STATUS_OPTIONS}
              required
            />
          </Col>
        </Row>

        {/* 4 · Tài khoản */}
        <div style={sectionHeaderStyle}>3 · Tài khoản</div>
        {editing ? (
          <div style={linkedAccountBoxStyle}>
            <span style={linkedAccountDotStyle} />
            <div style={linkedAccountTextStyle}>
              <strong>Trạng thái tài khoản liên kết:</strong>{' '}
              {editing.accountStatus != null
                ? editing.accountStatus === 1
                  ? 'Đang hoạt động'
                  : 'Đang bị khóa'
                : 'Chưa được cấp tài khoản — dùng thao tác "Cấp tài khoản" trong danh sách để cấp.'}
            </div>
          </div>
        ) : (
          <Row gutter={16}>
            <Col span={12}>
              <div style={fieldLabelStyle}>
                Mật khẩu <Text type="danger">*</Text>
              </div>
              <Input.Password
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                maxLength={50}
                status={passwordTouched && passwordError ? 'error' : ''}
              />
              {passwordTouched && passwordError && (
                <div style={fieldErrorStyle}>{passwordError}</div>
              )}
            </Col>
            <Col span={12}>
              <div style={fieldLabelStyle}>
                Xác nhận mật khẩu <Text type="danger">*</Text>
              </div>
              <Input.Password
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                maxLength={50}
                status={passwordTouched && confirmPasswordError ? 'error' : ''}
              />
              {passwordTouched && confirmPasswordError && (
                <div style={fieldErrorStyle}>{confirmPasswordError}</div>
              )}
            </Col>
            <Col span={24}>
              <div style={passwordHintStyle}>
                Tài khoản đăng nhập sẽ được cấp ngay cùng lúc tạo nhân sự (email
                đăng nhập = email nhân sự).
              </div>
            </Col>
          </Row>
        )}
      </div>
    </FormModal>
  );
}
