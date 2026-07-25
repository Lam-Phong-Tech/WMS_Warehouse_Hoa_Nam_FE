import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useWatch } from 'react-hook-form';
import { Input, Radio } from 'antd';

import { FormModal, confirmDialog } from '@/shared/components';
import { FormField, FormSelect, FormTextarea } from '@/shared/components/forms';
import { getPrimaryAssignment } from '@/modules/employees/types/employees.types';
import { useApiFormErrors } from '@/shared/hooks/useApiFormErrors';
import { useFormPattern } from '@/shared/hooks/useFormPattern';
import { useFormDraft } from '@/shared/hooks/useFormDraft';

import {
  departmentSchema,
  type DepartmentFormValues,
} from '@/modules/departments/schemas/department.schema';

import type { Department } from '@/modules/departments/types/departments.types';
import type { Employee } from '@/modules/employees/types/employees.types';
import { departmentsService } from '@/modules/departments/services/departments.service';

const DEFAULTS: DepartmentFormValues = {
  code: '',
  name: '',
  orgUnitId: null,
  departmentType: 'phong_ban',
  parentId: null,
  managerId: null,
  note: '',
  active: true,
};

const radioGroupStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  width: '100%',
};

const radioCardStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  margin: 0,
  padding: '6px 10px',
  border: `1px solid ${active ? '#1677ff' : '#d9d9d9'}`,
  borderRadius: 8,
  background: active ? '#e6f4ff' : '#fff',
  display: 'flex',
  alignItems: 'center',
  transition: 'all .2s',
});

// Key phải là tên field SAU KHI `extractFieldErrors()` (api-error.ts) đã tự
// snake_case → camelCase — không phải tên field gốc (snake_case) từ BE. Chỉ cần
// khai báo entry khi tên sau chuyển đổi khác tên field thật trên form (vd BE trả
// `manager_employee_id` → tự động thành `managerEmployeeId`, nhưng field trên
// form tên là `managerId`). Field trùng tên sẵn (code, name) không cần khai báo.
const DEPT_FIELD_MAP: Partial<Record<string, keyof DepartmentFormValues>> = {
  managerEmployeeId: 'managerId',
  description: 'note',
};

export interface DepartmentFormModalProps {
  open: boolean;
  /** Bản ghi đang sửa; null = thêm mới. */
  editing: Department | null;
  /** Danh sách phẳng toàn bộ phòng ban, dùng để lọc dropdown "Phòng ban cha". */
  allDepartments?: Department[];
  /**
   * Giá trị khởi tạo khi thêm mới (vd: mở form từ hành động "Tạo nhóm/tổ con"
   * để prefill sẵn orgUnitId/parentId/departmentType). Bỏ qua khi đang sửa.
   */
  initialValues?: Partial<DepartmentFormValues>;

  /** Toàn bộ nhân viên để lọc cho dropdown trưởng phòng. */
  employees: Employee[];
  employeesLoading?: boolean;
  employeesError?: boolean;

  /** Đơn vị tổ chức để chọn làm đơn vị chủ quản. */
  orgUnitOptions: { value: number; label: string }[];
  orgUnitsLoading?: boolean;
  orgUnitsError?: boolean;

  isPending: boolean;
  onCancel: () => void;
  onSubmit: (values: DepartmentFormValues) => void;
  /** Lỗi validation field từ BE (snake_case). Modal tự map và gọi setError. */
  apiErrors?: Record<string, string> | null;
  /** Callback khi đang tạo mã phòng ban từ BE */
  onGeneratingCode?: (generating: boolean) => void;
}

export function DepartmentFormModal({
  open,
  editing,
  allDepartments = [],
  initialValues,
  employees,
  employeesLoading,
  employeesError,
  orgUnitOptions,
  orgUnitsLoading,
  orgUnitsError,
  isPending,
  onCancel,
  onSubmit,
  apiErrors,
  onGeneratingCode,
}: DepartmentFormModalProps) {
  // Pattern chuẩn (xem src/shared/hooks/__examples__/FORM_PATTERN_GUIDE.md):
  // useFormPattern gói useForm + zodResolver + validateOnChange, tránh lặp lại
  // boilerplate ở từng FormModal. `resetForm()` đưa form về DEFAULTS, `setValues()`
  // ghi đè các field cần nạp (edit/prefill) — tương đương `reset({...DEFAULTS, ...values})`.
  const {
    control,
    submitForm,
    setError,
    setValue,
    resetForm,
    setValues,
    getValues,
    watch,
  } = useFormPattern<DepartmentFormValues>({
    schema: departmentSchema,
    defaultValues: DEFAULTS,
    onSubmit,
  });

  const orgUnitId = useWatch({ control, name: 'orgUnitId' });
  const managerId = useWatch({ control, name: 'managerId' });
  const departmentType = useWatch({ control, name: 'departmentType' });
  const parentId = useWatch({ control, name: 'parentId' });

  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeGenerationFailed, setCodeGenerationFailed] = useState(false);
  const [shouldGenerateCode, setShouldGenerateCode] = useState(false);

  // Draft saving for create mode
  const draft =
    useFormDraft<Partial<DepartmentFormValues>>('department-create');
  const submittedRef = useRef(false);

  // Phòng ban cha hợp lệ: cùng đơn vị trực thuộc, là "phòng ban" đang hoạt động
  // (không phải nhóm/tổ — WF-03 chỉ cho nhóm/tổ lồng 1 cấp dưới phòng ban), khác chính nó.
  // BE tự enforce rule này (verify 2026-07-15, xem docs/api-evidence/departments.md): tạo
  // nhom_to với parent_id là nhom_to khác → 422 BUSINESS_RULE_ERROR "Nhóm/tổ không được lồng
  // trong Nhóm/tổ khác." — không phải giả định cứng riêng của FE.
  const parentOptions = useMemo(() => {
    if (!orgUnitId) return [];
    return allDepartments
      .filter(
        (d) =>
          d.orgUnitId === orgUnitId &&
          d.departmentType === 'phong_ban' &&
          d.active &&
          d.id !== editing?.id,
      )
      .map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }));
  }, [allDepartments, orgUnitId, editing]);

  // Auto-generate code from backend when creating new department
  const generateCode = useCallback(async () => {
    setIsGeneratingCode(true);
    setCodeGenerationFailed(false);
    onGeneratingCode?.(true);
    try {
      const code = await departmentsService.generateCode(departmentType);
      setValue('code', code);
    } catch (error) {
      console.error('Failed to generate department code:', error);
      setValue('code', '');
      setCodeGenerationFailed(true);
    } finally {
      setIsGeneratingCode(false);
      onGeneratingCode?.(false);
    }
  }, [departmentType, onGeneratingCode, setValue]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    if (editing) return;
    setShouldGenerateCode(true);
  }, [open, editing, departmentType]);

  useEffect(() => {
    if (shouldGenerateCode) {
      setShouldGenerateCode(false);
      generateCode();
    }
  }, [shouldGenerateCode, generateCode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Tự động xóa "Phòng ban cha" nếu đổi đơn vị/loại và giá trị cũ không còn hợp lệ.
  useEffect(() => {
    if (departmentType !== 'nhom_to') {
      if (parentId != null) setValue('parentId', null);
      return;
    }
    if (parentId != null && !parentOptions.some((o) => o.value === parentId)) {
      setValue('parentId', null);
    }
  }, [departmentType, parentId, parentOptions, setValue]);

  // P1.2: Lọc trưởng phòng theo nhân sự active, thuộc đúng org unit/phòng ban hợp lệ
  const employeeOptions = useMemo(() => {
    if (!orgUnitId) {
      return [];
    }
    return employees
      .filter((e) => {
        // Trạng thái nhân sự phải hoạt động (status) và không tạm ngưng (3)/nghỉ việc (4)
        const isStatusActive = !!e.status;
        const isNotSuspendedOrResigned =
          e.employeeStatus !== 3 && e.employeeStatus !== 4;
        if (!isStatusActive || !isNotSuspendedOrResigned) return false;

        const assignment = getPrimaryAssignment(e);
        if (!assignment || Number(assignment.org_unit_id) !== Number(orgUnitId))
          return false;

        return true;
      })
      .map((e) => ({ value: e.id, label: e.fullName }));
  }, [employees, orgUnitId]);

  // Tự động xóa trưởng phòng nếu đổi đơn vị và giá trị cũ không còn hợp lệ
  useEffect(() => {
    if (!orgUnitId) {
      setValue('managerId', null);
      return;
    }

    if (managerId) {
      const managerStillValid = employeeOptions.some(
        (opt) => opt.value === managerId,
      );
      if (!managerStillValid) {
        setValue('managerId', null);
      }
    }
  }, [orgUnitId, managerId, employeeOptions, setValue]);

  // Map lỗi validation từ BE xuống từng field trong form (chuẩn hóa qua useApiFormErrors).
  useApiFormErrors(apiErrors, setError, DEPT_FIELD_MAP);

  // Nạp dữ liệu khi mở modal.
  useEffect(() => {
    if (!open) return;
    resetForm();
    if (editing) {
      const {
        id: _id,
        orgUnitName: _orgUnitName,
        managerName: _managerName,
        ...values
      } = editing;
      void _id;
      void _orgUnitName;
      void _managerName;
      setValues(values);
    } else if (initialValues) {
      setValues(initialValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, initialValues]);

  // Restore draft when modal opens for create mode
  useEffect(() => {
    if (!open || editing) return;
    const timer = setTimeout(() => {
      const saved = draft.restore();
      if (saved) {
        setValues(saved);
      }
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Save draft when modal closes (unless it was just submitted)
  useEffect(() => {
    if (open === false && !editing && !submittedRef.current) {
      const current = getValues();
      draft.save(current as Partial<DepartmentFormValues>);
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
        draft.save(current as Partial<DepartmentFormValues>);
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
        draft.save(values as Partial<DepartmentFormValues>);
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

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
      draft.save(current as Partial<DepartmentFormValues>);
    }
    onCancel();
  };

  const handleFormSubmit = () => {
    submittedRef.current = true;
    draft.clear();
    submitForm();
  };

  return (
    <>
      <FormModal
        open={open}
        title={editing ? 'Sửa phòng ban' : 'Thêm phòng ban'}
        onOk={handleFormSubmit}
        onCancel={handleCancelClick}
        onDismiss={handleDismiss}
        loading={isPending}
      >
        <FormField control={control} name="code" label="Mã phòng ban" required>
          {(field) => (
            <>
              <Input
                value={field.value as string}
                onChange={
                  codeGenerationFailed
                    ? (e) => field.onChange(e.target.value)
                    : undefined
                }
                placeholder={
                  isGeneratingCode ? 'Đang tạo mã...' : 'Mã sẽ được tự động tạo'
                }
                maxLength={20}
                disabled={isGeneratingCode || !codeGenerationFailed}
                size="middle"
                suffix={
                  isGeneratingCode ? (
                    <span className="text-blue-500">...</span>
                  ) : codeGenerationFailed ? (
                    <a onClick={() => generateCode()}>Thử lại</a>
                  ) : undefined
                }
              />
              {codeGenerationFailed && (
                <div style={{ fontSize: 12, color: '#faad14', marginTop: 4 }}>
                  Không tạo được mã tự động. Nhập mã thủ công hoặc thử lại.
                </div>
              )}
            </>
          )}
        </FormField>

        <FormField control={control} name="name" label="Tên phòng ban" required>
          {(field) => (
            <Input
              value={field.value as string}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder="Ví dụ: Phòng Kế toán"
              maxLength={200}
              showCount
              size="middle"
            />
          )}
        </FormField>

        <FormField
          control={control}
          name="departmentType"
          label="Loại đơn vị"
          required
        >
          {(field) => (
            <Radio.Group
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              style={radioGroupStyle}
            >
              <Radio
                value="phong_ban"
                style={radioCardStyle(field.value === 'phong_ban')}
              >
                Phòng ban
              </Radio>
              <Radio
                value="nhom_to"
                style={radioCardStyle(field.value === 'nhom_to')}
              >
                Nhóm/tổ
              </Radio>
            </Radio.Group>
          )}
        </FormField>

        {departmentType === 'nhom_to' && (
          <FormSelect
            control={control}
            name="parentId"
            label="Phòng ban cha"
            placeholder={
              orgUnitId
                ? 'Chọn phòng ban cha...'
                : 'Chọn đơn vị trực thuộc trước'
            }
            options={parentOptions}
            required
            disabled={!orgUnitId}
            showSearch
            notFoundContent="Không có phòng ban nào trong đơn vị này"
            filterOption={(input, option) =>
              String(option?.label ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            size="middle"
          />
        )}

        <FormSelect
          control={control}
          name="orgUnitId"
          label="Đơn vị trực thuộc (công ty / chi nhánh)"
          placeholder="Chọn đơn vị..."
          options={orgUnitOptions}
          required
          allowClear={false}
          loading={orgUnitsLoading}
          notFoundContent={
            orgUnitsLoading
              ? 'Đang tải danh sách...'
              : orgUnitsError
                ? 'Lỗi tải danh sách đơn vị'
                : 'Không tìm thấy'
          }
          showSearch
          filterOption={(input, option) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
          size="middle"
        />

        <FormSelect
          control={control}
          name="managerId"
          label="Trưởng phòng"
          placeholder={orgUnitId ? 'Tìm nhân sự...' : 'Chọn đơn vị trước'}
          options={employeeOptions}
          disabled={!orgUnitId}
          allowClear
          showSearch
          loading={employeesLoading}
          notFoundContent={
            employeesLoading
              ? 'Đang tải danh sách...'
              : employeesError
                ? 'Lỗi tải danh sách nhân viên'
                : 'Không tìm thấy'
          }
          filterOption={(input, option) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
          size="middle"
        />

        <FormTextarea
          control={control}
          name="note"
          label="Mô tả"
          placeholder="Ví dụ: Chịu trách nhiệm quản lý dòng tiền và báo cáo tài chính"
          rows={3}
          maxLength={200}
          showCount
        />

        <FormField control={control} name="active" label="Trạng thái">
          {(field) => (
            <Radio.Group
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              style={radioGroupStyle}
            >
              <Radio value={true} style={radioCardStyle(field.value === true)}>
                Đang hoạt động
              </Radio>
              <Radio
                value={false}
                style={radioCardStyle(field.value === false)}
              >
                Ngừng hoạt động
              </Radio>
            </Radio.Group>
          )}
        </FormField>
      </FormModal>
    </>
  );
}
