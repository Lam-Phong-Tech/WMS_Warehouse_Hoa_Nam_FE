import { useEffect, useRef, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Alert,
  Button,
  DatePicker,
  Input,
  Modal,
  Select,
  Space,
  Typography,
  Flex,
} from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import type { Employee } from '@/modules/employees/types/employees.types';
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TRANSITIONS,
  EmployeeStatus,
} from '@/modules/employees/types/employees.types';

const { Text } = Typography;

export interface EmployeeStatusPayload {
  employeeStatus: number;
  effectiveDate: string;
  note?: string;
}

export interface EmployeeStatusModalProps {
  open: boolean;
  employee: Employee | null;
  /** Ngày hiệu lực của bản ghi lịch sử gần nhất, dùng để chặn đảo ngược mốc thời gian */
  lastEffectiveDate?: string | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (payload: EmployeeStatusPayload) => void;
}

const fieldLabelStyle: React.CSSProperties = {
  marginBottom: 6,
  fontWeight: 500,
};
const fieldWrapperStyle: React.CSSProperties = { marginBottom: 16 };
const fullWidthStyle: React.CSSProperties = { width: '100%' };
const warningIconStyle: React.CSSProperties = { color: '#faad14' };
const introTextStyle: React.CSSProperties = { marginTop: 8 };
const alertStyle: React.CSSProperties = { marginBottom: 16 };
const alertDescriptionStyle: React.CSSProperties = { fontSize: 13 };
const alertParagraphStyle: React.CSSProperties = { margin: '4px 0' };
const alertListStyle: React.CSSProperties = {
  paddingLeft: 16,
  margin: '4px 0 0 0',
};
const alertListWithFontStyle: React.CSSProperties = {
  ...alertListStyle,
  fontSize: 13,
};
const footerActionsStyle: React.CSSProperties = { marginTop: 24 };
const fieldErrorStyle: React.CSSProperties = { fontSize: 12 };

export function EmployeeStatusModal({
  open,
  employee,
  lastEffectiveDate,
  loading,
  onCancel,
  onConfirm,
}: EmployeeStatusModalProps) {
  const currentStatus =
    employee?.employeeStatus != null
      ? (Number(employee.employeeStatus) as EmployeeStatus)
      : EmployeeStatus.INTERN;

  // P0.3: Lấy danh sách trạng thái hợp lệ từ EMPLOYEE_STATUS_TRANSITIONS
  const allowedTransitions = EMPLOYEE_STATUS_TRANSITIONS[currentStatus] ?? [];

  const STATUS_OPTIONS = allowedTransitions.map((s) => ({
    value: s,
    label: EMPLOYEE_STATUS_LABELS[s] ?? String(s),
  }));

  const [status, setStatus] = useState<EmployeeStatus>(
    allowedTransitions[0] ?? currentStatus,
  );
  const [effectiveDate, setEffectiveDate] = useState<Dayjs | null>(null);
  const [note, setNote] = useState('');
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const isDeactivating =
    status === EmployeeStatus.RESIGNED || status === EmployeeStatus.SUSPENDED;

  // Ngày hiệu lực: phải >= ngày vào làm, >= ngày hiệu lực gần nhất, không trùng ngày gần nhất
  const hireDate = employee?.hireDate ? dayjs(employee.hireDate) : null;
  const minDate = lastEffectiveDate ? dayjs(lastEffectiveDate) : hireDate;
  const dateError = (() => {
    if (!effectiveDate) return null;
    if (hireDate && effectiveDate.isBefore(hireDate, 'day')) {
      return 'Ngày hiệu lực phải sau hoặc bằng ngày vào làm';
    }
    if (lastEffectiveDate) {
      const last = dayjs(lastEffectiveDate);
      if (effectiveDate.isSame(last, 'day')) {
        return 'Ngày hiệu lực đã trùng với bản ghi trạng thái gần nhất';
      }
      if (effectiveDate.isBefore(last, 'day')) {
        return 'Ngày hiệu lực không được sớm hơn bản ghi trạng thái gần nhất';
      }
    }
    return null;
  })();
  const showEffectiveDateError =
    (confirmAttempted && !effectiveDate) || (!!effectiveDate && !!dateError);

  // Reset form when modal opens with a different employee
  const prevEmployeeIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open || !employee) return;
    if (prevEmployeeIdRef.current === employee.id) return;
    prevEmployeeIdRef.current = employee.id;

    const newCurrentStatus = (
      employee.employeeStatus != null
        ? Number(employee.employeeStatus)
        : EmployeeStatus.INTERN
    ) as EmployeeStatus;
    const newAllowed = EMPLOYEE_STATUS_TRANSITIONS[newCurrentStatus] ?? [];
    setStatus(newAllowed[0] ?? newCurrentStatus);
    setEffectiveDate(null);
    setNote('');
    setConfirmAttempted(false);
    setStep('form');
  }, [open, employee]);

  const handleAfterClose = () => {
    setStatus(allowedTransitions[0] ?? currentStatus);
    setEffectiveDate(null);
    setNote('');
    setConfirmAttempted(false);
    setStep('form');
  };

  const submitPayload = () => {
    if (!effectiveDate) return;
    onConfirm({
      employeeStatus: status,
      effectiveDate: effectiveDate.format('YYYY-MM-DD'),
      note: note || undefined,
    });
  };

  const handleConfirm = () => {
    if (!effectiveDate || dateError) {
      setConfirmAttempted(true);
      return;
    }
    if (isDeactivating && step === 'form') {
      setStep('confirm');
      return;
    }
    submitPayload();
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      afterClose={handleAfterClose}
      destroyOnHidden
      footer={null}
      title={
        <Space>
          <ExclamationCircleFilled style={warningIconStyle} />
          Cập nhật trạng thái nhân sự
        </Space>
      }
    >
      <p style={introTextStyle}>
        Cập nhật trạng thái cho nhân sự <Text strong>{employee?.fullName}</Text>
        . Trạng thái hiện tại:{' '}
        <Text strong>
          {EMPLOYEE_STATUS_LABELS[currentStatus] ?? String(currentStatus)}
        </Text>
      </p>

      {step === 'confirm' ? (
        <>
          <Alert
            type="warning"
            showIcon
            style={alertStyle}
            message={`Chuyển sang '${EMPLOYEE_STATUS_LABELS[status]}'?`}
            description={
              <div style={alertDescriptionStyle}>
                <p style={alertParagraphStyle}>
                  Nhân sự <Text strong>{employee?.fullName}</Text> sẽ chuyển từ{' '}
                  <Text strong>{EMPLOYEE_STATUS_LABELS[currentStatus]}</Text>{' '}
                  sang <Text strong>{EMPLOYEE_STATUS_LABELS[status]}</Text> kể
                  từ ngày{' '}
                  <Text strong>{effectiveDate?.format('DD/MM/YYYY')}</Text>.
                </p>
                <ul style={alertListStyle}>
                  <li>Tài khoản đăng nhập của nhân sự sẽ bị vô hiệu hóa.</li>
                  <li>Các vai trò và quyền hạn đang được gán sẽ bị thu hồi.</li>
                  <li>Không thể giao thêm việc mới cho nhân sự này.</li>
                  <li>
                    Dữ liệu liên quan sẽ được bảo toàn để phục vụ báo cáo.
                  </li>
                </ul>
              </div>
            }
          />
          <Flex justify="flex-end" gap={8} style={footerActionsStyle}>
            <Button onClick={() => setStep('form')}>Quay lại</Button>
            <Button
              danger
              type="primary"
              loading={loading}
              onClick={submitPayload}
            >
              Xác nhận
            </Button>
          </Flex>
        </>
      ) : (
        <>
          {/* P0.5: Cảnh báo nghiệp vụ khi cho nghỉ việc/tạm ngưng */}
          {isDeactivating && (
            <Alert
              type="warning"
              showIcon
              style={alertStyle}
              message="Hệ quả của việc thay đổi trạng thái"
              description={
                <ul style={alertListWithFontStyle}>
                  <li>Tài khoản đăng nhập của nhân sự sẽ bị vô hiệu hóa.</li>
                  <li>Các vai trò và quyền hạn đang được gán sẽ bị thu hồi.</li>
                  <li>
                    Dữ liệu liên quan sẽ được bảo toàn để phục vụ báo cáo.
                  </li>
                </ul>
              }
            />
          )}

          {/* Chọn trạng thái */}
          <div style={fieldWrapperStyle}>
            <div style={fieldLabelStyle}>Trạng thái mới</div>
            <Select
              value={status}
              onChange={(v) => setStatus(v)}
              options={STATUS_OPTIONS}
              style={fullWidthStyle}
            />
          </div>

          {/* Ngày hiệu lực */}
          <div style={fieldWrapperStyle}>
            <div style={fieldLabelStyle}>
              Ngày hiệu lực <Text type="danger">*</Text>
            </div>
            <DatePicker
              value={effectiveDate}
              onChange={(v) => {
                setEffectiveDate(v);
                setConfirmAttempted(false);
              }}
              format="DD/MM/YYYY"
              placeholder="dd/mm/yyyy"
              style={fullWidthStyle}
              minDate={minDate ?? undefined}
              status={showEffectiveDateError ? 'error' : undefined}
            />
            {confirmAttempted && !effectiveDate && (
              <Text type="danger" style={fieldErrorStyle}>
                Vui lòng chọn ngày hiệu lực
              </Text>
            )}
            {confirmAttempted && effectiveDate && dateError && (
              <Text type="danger" style={fieldErrorStyle}>
                {dateError}
              </Text>
            )}
          </div>

          {/* Lý do */}
          <div style={fieldWrapperStyle}>
            <div style={fieldLabelStyle}>
              Lý do
              {isDeactivating && <Text type="danger"> *</Text>}
            </div>
            <Input.TextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập lý do thay đổi trạng thái..."
              rows={3}
              autoComplete="off"
              status={isDeactivating && !note ? 'error' : undefined}
            />
            {isDeactivating && !note && (
              <Text type="danger" style={fieldErrorStyle}>
                Vui lòng nhập lý do khi tạm ngưng/nghỉ việc
              </Text>
            )}
          </div>

          {/* Nút thao tác */}
          <Flex justify="flex-end" gap={8} style={footerActionsStyle}>
            <Button onClick={onCancel}>Hủy</Button>
            <Button
              danger={isDeactivating}
              type="primary"
              loading={loading}
              onClick={handleConfirm}
              disabled={
                Number(employee?.employeeStatus) === status ||
                (isDeactivating && !note) ||
                (!!effectiveDate && !!dateError)
              }
            >
              {isDeactivating ? 'Tiếp tục' : 'Xác nhận'}
            </Button>
          </Flex>
        </>
      )}
    </Modal>
  );
}
