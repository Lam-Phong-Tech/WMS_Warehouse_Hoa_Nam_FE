import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Switch,
  Alert,
  Space,
  Card,
  Button,
} from 'antd';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { confirmDialog } from '@/shared/components';
import { useFormDraft } from '@/shared/hooks/useFormDraft';
import {
  useCreateAssignment,
  useUpdateAssignment,
  type AssignmentPayload,
  type EmployeeAssignment,
} from '../hooks/use-employee-assignments';
import type { Employee } from '@/modules/employees/types/employees.types';
import type { OrgUnit } from '@/modules/org-units/types/org-units.types';
import type { Department } from '@/modules/departments/types/departments.types';
import type { Position } from '@/modules/positions/types/positions.types';
import {
  extractFieldErrorsRaw,
  getMutationErrorMessage,
} from '@/shared/api/api-error';
import { useEmployeeAssignments } from '../hooks/use-employee-assignments';
import {
  getCurrentAssignment,
  getDeptOptionsForOrgUnit,
  validateAssignmentDateRange,
} from './transfer-form.helpers';

/**
 * Convert một giá trị Dayjs/string/undefined/null thành chuỗi ISO 'YYYY-MM-DD'
 * an toàn. Trả về null nếu giá trị rỗng hoặc không hợp lệ.
 *
 * Fix lỗi "Cannot read properties of undefined (reading 'format')" xảy ra khi
 * DatePicker trả về null, hoặc khi restore draft lưu dạng string.
 */
function toISODate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'format' in value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (value as any).format('YYYY-MM-DD');
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = dayjs(value);
    if (parsed.isValid()) return parsed.format('YYYY-MM-DD');
  }
  return null;
}

/**
 * Format giá trị ngày thành 'DD/MM/YYYY' để hiển thị, an toàn với undefined/null.
 */
function toDisplayDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'object' && value !== null && 'format' in value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (value as any).format('DD/MM/YYYY');
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = dayjs(value);
    if (parsed.isValid()) return parsed.format('DD/MM/YYYY');
  }
  return '—';
}

interface TransferFormModalProps {
  open: boolean;
  editing?: EmployeeAssignment | null;
  onCancel: () => void;
  onSubmit: () => void;
  employees: Employee[];
  orgUnits: OrgUnit[];
  departments: Department[];
  positions: Position[];
}

type FormStep = 'form' | 'confirm';

export function TransferFormModal({
  open,
  editing,
  onCancel,
  onSubmit,
  employees,
  orgUnits,
  departments,
  positions,
}: TransferFormModalProps) {
  const [form] = Form.useForm();
  const draft = useFormDraft<Record<string, unknown>>(
    'employee-assignment-create',
  );
  const create = useCreateAssignment();
  const update = useUpdateAssignment();
  const submittedRef = useRef(false);
  const isEditing = Boolean(editing);
  const isPending = create.isPending || update.isPending;
  const [step, setStep] = useState<FormStep>('form');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<number | null>(
    null,
  );
  /**
   * Snapshot form values khi chuyển sang step confirm.
   * Rất quan trọng: khi step === 'confirm', Form bị unmount (do render có điều kiện
   * `{step === 'confirm' ? ... : <Form>...}`), nên form.getFieldsValue() sẽ trả {}
   * → payload rỗng → API 422 VALIDATION_FAILED.
   *
   * Lưu snapshot ngay khi validate form thành công ở step 1, dùng để:
   * - Hiển thị preview ở confirm step
   * - Submit ở handleOk (step confirm)
   */
  const [confirmedValues, setConfirmedValues] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Query current assignments của employee đang chọn
  // BR-20: Lấy TẤT CẢ assignments active, sau đó sort FE theo start_date DESC
  // và ưu tiên is_primary=true. Không dùng limit=1 vì BE có thể không sort đúng.
  const { data: assignmentsResponse } = useEmployeeAssignments(
    selectedEmployeeId
      ? { employee_id: selectedEmployeeId, status: '1' }
      : { status: '1' },
    { enabled: !!selectedEmployeeId && step === 'form' },
  );

  // Lấy assignment hiện tại theo BR-20 (xem transfer-form.helpers.ts)
  const currentAssignment = useMemo(
    () => getCurrentAssignment(assignmentsResponse?.data ?? []),
    [assignmentsResponse],
  );

  const orgOptions = useMemo(
    () => orgUnits.map((o) => ({ value: o.id, label: o.name })),
    [orgUnits],
  );
  const deptOptions = useMemo(
    () => getDeptOptionsForOrgUnit(departments, selectedOrgUnitId),
    [departments, selectedOrgUnitId],
  );
  const posOptions = useMemo(
    () => positions.map((p) => ({ value: p.id, label: p.name })),
    [positions],
  );
  const empOptions = useMemo(
    () =>
      employees.map((e) => ({
        value: e.id,
        label: `${e.code} — ${e.fullName}`,
      })),
    [employees],
  );

  // Helper lấy tên org unit / department / position
  const getOrgName = (id?: number) =>
    orgUnits.find((o) => o.id === id)?.name ?? '—';
  const getDeptName = (id?: number) =>
    departments.find((d) => d.id === id)?.name ?? '—';
  const getPosName = (id?: number) =>
    positions.find((p) => p.id === id)?.name ?? '—';

  useEffect(() => {
    if (!open) return;
    submittedRef.current = false;
    if (editing) {
      form.setFieldsValue({
        employee_id: editing.employee_id,
        org_unit_id: editing.org_unit_id,
        department_id: editing.department_id,
        position_id: editing.position_id,
        is_primary: editing.is_primary,
        start_date: editing.start_date ? dayjs(editing.start_date) : null,
        end_date: editing.end_date ? dayjs(editing.end_date) : null,
        status: editing.status,
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local selection from the `editing` prop when the modal opens
      setSelectedEmployeeId(editing.employee_id);

      setSelectedOrgUnitId(editing.org_unit_id ?? null);
    } else {
      form.resetFields();
      form.setFieldsValue({ is_primary: true, status: true });
      setSelectedEmployeeId(null);
      setSelectedOrgUnitId(null);

      const saved = draft.restore();
      if (saved) {
        const restored = {
          ...saved,
          start_date: saved.start_date
            ? dayjs(saved.start_date as string)
            : null,
          end_date: saved.end_date ? dayjs(saved.end_date as string) : null,
        };
        form.setFieldsValue(restored);
        if (typeof saved.employee_id === 'number') {
          setSelectedEmployeeId(saved.employee_id);
        }
        if (typeof saved.org_unit_id === 'number') {
          setSelectedOrgUnitId(saved.org_unit_id);
        }
      }
    }
    setStep('form');
    setConfirmedValues(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, form]);

  const saveDraftFromForm = () => {
    const values = form.getFieldsValue();
    draft.save({
      ...values,
      start_date: toISODate(values.start_date),
      end_date: toISODate(values.end_date),
    });
  };

  // Save draft on unmount if modal is open (user navigates away to another page)
  useEffect(() => {
    return () => {
      if (open && !isEditing && !submittedRef.current) {
        saveDraftFromForm();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditing]);

  // Autosave draft liên tục khi người dùng gõ (debounce) — đảm bảo dữ liệu
  // không mất khi điều hướng sang trang khác trước khi effect unmount ở trên
  // kịp chạy (ví dụ route chuyển trang bằng SPA navigation).
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleValuesChange = () => {
    if (isEditing) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(saveDraftFromForm, 400);
  };

  /**
   * Kiểm tra department có thuộc org_unit đã chọn không.
   * Error message khớp với BE: "Phòng ban được chọn phải thuộc đơn vị tổ chức tương ứng"
   */
  const validateDeptBelongsToOrg = (
    orgUnitId: number | undefined,
    deptId: number | undefined,
  ): string | null => {
    if (!orgUnitId || !deptId) return null;
    const dept = departments.find((d) => d.id === deptId);
    if (!dept) return 'Phòng ban không tồn tại';
    if (dept.orgUnitId !== orgUnitId) {
      return 'Phòng ban được chọn phải thuộc đơn vị tổ chức tương ứng';
    }
    return null;
  };

  const handleOk = async () => {
    if (step === 'confirm') {
      // Submit thật — dùng confirmedValues snapshot thay vì form.getFieldsValue()
      // vì Form đã bị unmount ở step confirm (render có điều kiện).
      // validatedFields kiểm tra department thuộc org_unit
      try {
        if (!confirmedValues) {
          toast.error('Dữ liệu không hợp lệ, vui lòng thử lại');
          setStep('form');
          return;
        }

        // Extra validation: department phải thuộc org_unit
        const deptError = validateDeptBelongsToOrg(
          confirmedValues.org_unit_id as number | undefined,
          confirmedValues.department_id as number | undefined,
        );
        if (deptError) {
          toast.error(deptError);
          setStep('form');
          return;
        }

        const payload: AssignmentPayload = {
          employee_id: confirmedValues.employee_id as number,
          org_unit_id: confirmedValues.org_unit_id as number,
          department_id: confirmedValues.department_id as number,
          position_id: confirmedValues.position_id as number,
          is_primary: (confirmedValues.is_primary as boolean) ?? true,
          start_date:
            toISODate(confirmedValues.start_date) ??
            dayjs().format('YYYY-MM-DD'),
          end_date: toISODate(confirmedValues.end_date),
          status: (confirmedValues.status as boolean) ?? true,
        };

        if (isEditing && editing) {
          await update.mutateAsync({ id: editing.id, payload });
          toast.success('Đã cập nhật phân công nhân sự');
        } else {
          await create.mutateAsync(payload);
          toast.success('Đã tạo phân công nhân sự');
        }
        submittedRef.current = true;
        form.resetFields();
        setStep('form');
        setConfirmedValues(null);
        draft.clear();
        onSubmit();
      } catch (err) {
        if (err instanceof Error && !('errorFields' in err)) {
          const fieldErrors = extractFieldErrorsRaw(err);
          if (fieldErrors) {
            form.setFields(
              Object.entries(fieldErrors).map(([name, error]) => ({
                name,
                errors: [error],
              })),
            );
          }
          toast.error(getMutationErrorMessage(err));
        }
        setStep('form');
      }
      return;
    }

    // Step 1: Validate và hiển thị confirm
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      // Lưu snapshot trước khi Form unmount (render confirm step ẩn Form)
      setConfirmedValues(values);
      setStep('confirm');
    } catch {
      // Validation failed, Ant Design sẽ hiển thị errors
    }
  };

  const handleCancel = () => {
    if (!isEditing && form.isFieldsTouched()) {
      confirmDialog({
        title: 'Xác nhận hủy',
        content: 'Bạn có chắc chắn muốn hủy? Dữ liệu đã nhập sẽ bị xóa.',
        okText: 'Đồng ý',
        cancelText: 'Tiếp tục nhập',
        danger: true,
        onOk: () => {
          draft.clear();
          setStep('form');
          setConfirmedValues(null);
          onCancel();
        },
      });
      return;
    }
    setStep('form');
    setConfirmedValues(null);
    onCancel();
  };

  // Bấm ra ngoài modal / phím Esc / nút X — không hỏi xác nhận, chỉ lưu tạm
  // để mở lại vẫn còn dữ liệu vừa nhập.
  const handleDismiss = () => {
    if (!isEditing) {
      const values = form.getFieldsValue();
      draft.save({
        ...values,
        start_date: toISODate(values.start_date),
        end_date: toISODate(values.end_date),
      });
    }
    setStep('form');
    setConfirmedValues(null);
    onCancel();
  };

  // Preview thông tin trong step confirm
  const previewValues = step === 'confirm' ? confirmedValues : null;
  const isChangingOrgUnit =
    previewValues &&
    currentAssignment &&
    previewValues.org_unit_id !== currentAssignment.org_unit_id;

  return (
    <Modal
      title={
        <span
          style={{
            fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          {isEditing
            ? 'Cập nhật phân công nhân sự'
            : 'Điều chuyển / phân công nhân sự'}
        </span>
      }
      open={open}
      onCancel={handleDismiss}
      footer={
        <>
          <Button onClick={handleCancel}>Hủy</Button>
          <Button type="primary" loading={isPending} onClick={handleOk}>
            {step === 'confirm'
              ? 'Xác nhận'
              : isEditing
                ? 'Lưu thay đổi'
                : 'Tạo mới'}
          </Button>
        </>
      }
      width={step === 'confirm' ? 720 : 720}
      destroyOnClose
    >
      {step === 'confirm' && previewValues ? (
        // Confirm step
        <div style={{ marginTop: 14 }}>
          <Alert
            type="warning"
            showIcon
            message="Xác nhận điều chuyển / phân công"
            description={
              <div style={{ marginTop: 8 }}>
                <p>Bạn có chắc muốn tạo phân công mới cho nhân sự này?</p>
                {isChangingOrgUnit && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 8 }}
                    message="Thay đổi đơn vị"
                    description="Việc thay đổi đơn vị/phòng ban có thể ảnh hưởng đến quyền hạn và phạm vi dữ liệu của nhân sự này."
                  />
                )}
              </div>
            }
            style={{ marginBottom: 16 }}
          />

          {/* Current assignment */}
          {currentAssignment && (
            <Card
              size="small"
              title="Phân công hiện tại"
              style={{ marginBottom: 16 }}
            >
              <Space direction="vertical" size={2}>
                <div>
                  <strong>Đơn vị:</strong>{' '}
                  {getOrgName(currentAssignment.org_unit_id)}
                </div>
                <div>
                  <strong>Phòng ban:</strong>{' '}
                  {getDeptName(currentAssignment.department_id)}
                </div>
                <div>
                  <strong>Chức vụ:</strong>{' '}
                  {getPosName(currentAssignment.position_id)}
                </div>
                <div>
                  <strong>Từ ngày:</strong>{' '}
                  {currentAssignment.start_date
                    ? dayjs(currentAssignment.start_date).format('DD/MM/YYYY')
                    : '—'}
                </div>
                {currentAssignment.end_date && (
                  <div>
                    <strong>Đến ngày:</strong>{' '}
                    {dayjs(currentAssignment.end_date).format('DD/MM/YYYY')}
                  </div>
                )}
              </Space>
            </Card>
          )}

          {/* New assignment preview */}
          <Card size="small" title="Phân công mới">
            <Space direction="vertical" size={2}>
              <div>
                <strong>Nhân sự:</strong>{' '}
                {employees.find((e) => e.id === previewValues.employee_id)
                  ?.fullName ?? '—'}
              </div>
              <div>
                <strong>Đơn vị:</strong>{' '}
                {getOrgName(previewValues.org_unit_id as number | undefined)}
              </div>
              <div>
                <strong>Phòng ban:</strong>{' '}
                {getDeptName(previewValues.department_id as number | undefined)}
              </div>
              <div>
                <strong>Chức vụ:</strong>{' '}
                {getPosName(previewValues.position_id as number | undefined)}
              </div>
              <div>
                <strong>Ngày bắt đầu:</strong>{' '}
                {toDisplayDate(previewValues.start_date)}
              </div>
              {!!previewValues.end_date && (
                <div>
                  <strong>Ngày kết thúc:</strong>{' '}
                  {toDisplayDate(previewValues.end_date)}
                </div>
              )}
              <div>
                <strong>Phân công chính:</strong>{' '}
                {previewValues.is_primary ? 'Có' : 'Không'}
              </div>
              <div>
                <strong>Hiệu lực:</strong>{' '}
                {previewValues.status ? 'Đang hiệu lực' : 'Ngưng hiệu lực'}
              </div>
            </Space>
          </Card>
        </div>
      ) : (
        // Form step
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 14 }}
          onValuesChange={handleValuesChange}
        >
          {/* Current assignment display */}
          {currentAssignment && !isEditing && (
            <Alert
              type="info"
              showIcon
              message="Phân công hiện tại"
              description={
                <Space direction="vertical" size={0}>
                  <div>
                    {getOrgName(currentAssignment.org_unit_id)} ·{' '}
                    {getDeptName(currentAssignment.department_id)} ·{' '}
                    {getPosName(currentAssignment.position_id)}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c887e' }}>
                    Từ{' '}
                    {currentAssignment.start_date
                      ? dayjs(currentAssignment.start_date).format('DD/MM/YYYY')
                      : '—'}
                    {currentAssignment.end_date &&
                      ` đến ${dayjs(currentAssignment.end_date).format('DD/MM/YYYY')}`}
                  </div>
                </Space>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            name="employee_id"
            label="Nhân sự"
            rules={[{ required: true, message: 'Vui lòng chọn nhân sự' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn nhân sự"
              options={empOptions}
              style={{ height: 36 }}
              onChange={(val) => setSelectedEmployeeId(val)}
            />
          </Form.Item>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <Form.Item
              name="org_unit_id"
              label="Đơn vị"
              rules={[{ required: true, message: 'Vui lòng chọn đơn vị' }]}
            >
              <Select
                placeholder="Chọn đơn vị"
                options={orgOptions}
                style={{ height: 36 }}
                onChange={(val) => {
                  setSelectedOrgUnitId(val);
                  form.setFieldValue('department_id', undefined);
                }}
              />
            </Form.Item>
            <Form.Item
              name="department_id"
              label="Phòng ban"
              dependencies={['org_unit_id']}
              rules={[
                { required: true, message: 'Vui lòng chọn phòng ban' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const orgUnitId = form.getFieldValue('org_unit_id');
                    const dept = departments.find(
                      (d) => d.id === value && d.orgUnitId === orgUnitId,
                    );
                    if (!dept) {
                      return Promise.reject(
                        new Error(
                          'Phòng ban được chọn phải thuộc đơn vị tổ chức tương ứng',
                        ),
                      );
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Select
                placeholder={
                  selectedOrgUnitId
                    ? 'Chọn phòng ban'
                    : 'Vui lòng chọn đơn vị trước'
                }
                disabled={!selectedOrgUnitId}
                notFoundContent="Đơn vị này chưa có phòng ban"
                options={deptOptions}
                style={{ height: 36 }}
              />
            </Form.Item>
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <Form.Item
              name="position_id"
              label="Chức vụ"
              rules={[{ required: true, message: 'Vui lòng chọn chức vụ' }]}
            >
              <Select
                placeholder="Chọn chức vụ"
                options={posOptions}
                style={{ height: 36 }}
              />
            </Form.Item>
            <Form.Item
              name="is_primary"
              label="Phân công chính"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <Form.Item
              name="start_date"
              label="Ngày bắt đầu"
              dependencies={['end_date']}
              rules={[
                { required: true, message: 'Vui lòng chọn ngày bắt đầu' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const endDate = form.getFieldValue('end_date');
                    const error = validateAssignmentDateRange(value, endDate);
                    if (error) return Promise.reject(error);
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <DatePicker
                style={{ width: '100%', height: 36 }}
                format="DD/MM/YYYY"
                placeholder="dd/mm/yyyy"
                onChange={() => form.validateFields(['end_date'])}
              />
            </Form.Item>
            <Form.Item
              name="end_date"
              label="Ngày kết thúc"
              dependencies={['start_date']}
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const startDate = form.getFieldValue('start_date');
                    const error = validateAssignmentDateRange(startDate, value);
                    if (error) return Promise.reject(error);
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <DatePicker
                style={{ width: '100%', height: 36 }}
                format="DD/MM/YYYY"
                placeholder="dd/mm/yyyy"
                allowClear
                disabledDate={(current) => {
                  const startDate = form.getFieldValue('start_date');
                  return !!(
                    startDate &&
                    current &&
                    current.isBefore(startDate, 'day')
                  );
                }}
                onChange={() => form.validateFields(['start_date'])}
              />
            </Form.Item>
          </div>
          <Form.Item name="status" label="Hiệu lực" valuePropName="checked">
            <Switch checkedChildren="Đang hiệu lực" unCheckedChildren="Ngưng" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
