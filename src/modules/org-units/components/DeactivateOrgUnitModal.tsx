import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Checkbox, Typography, theme } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import { FormModal } from '@/shared/components';
import { FormField } from '@/shared/components/forms';
import type { OrgUnit } from '@/modules/org-units/types/org-units.types';

const { Text } = Typography;

/**
 * BE hiện tại chỉ hỗ trợ DELETE /org_units/{id}/soft-delete — không nhận body
 * (không có reason, effectiveDate). Các field reason/effectiveDate đã được
 * loại bỏ khỏi UI để tránh hiển thị như dữ liệu sẽ được lưu.
 * Nếu sau này BE hỗ trợ body/audit reason, cần bổ sung lại.
 */
/** Chỉ gửi id, BE tự xử lý soft-delete */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DeactivateOrgUnitPayload {}

export interface DeactivateOrgUnitModalProps {
  open: boolean;
  unit: OrgUnit | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (payload: DeactivateOrgUnitPayload) => void;
}

export function DeactivateOrgUnitModal({
  open,
  unit,
  loading,
  onCancel,
  onConfirm,
}: DeactivateOrgUnitModalProps) {
  const { token } = theme.useToken();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      confirm14DayRule: false,
    },
  });

  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  const handleAfterClose = () => {
    reset();
  };

  const handleConfirm = handleSubmit(() => {
    onConfirm({});
  });

  const isConfirmDisabled = !isValid;

  return (
    <FormModal
      open={open}
      afterClose={handleAfterClose}
      title={
        <span>
          <ExclamationCircleFilled
            style={{ color: '#faad14', marginRight: 8 }}
          />
          Vô hiệu hóa đơn vị tổ chức
        </span>
      }
      onCancel={onCancel}
      onOk={handleConfirm}
      okText="Xác nhận vô hiệu"
      okButtonProps={{
        danger: true,
        disabled: isConfirmDisabled,
        loading,
      }}
    >
      <p style={{ marginTop: 8 }}>
        Bạn sắp vô hiệu hóa đơn vị <Text strong>{unit?.name}</Text> và các cấp
        dưới trực thuộc.
      </p>

      {/* Quy định BRD */}
      <Alert
        message={<Text strong>Quy định xóa mềm đơn vị (14 ngày):</Text>}
        description={
          <ul
            style={{
              paddingLeft: 16,
              margin: '4px 0 0 0',
              fontSize: 13,
              color: token.colorText,
            }}
          >
            <li>
              Toàn bộ nhân sự đang hoạt động thuộc đơn vị này và đơn vị con sẽ
              bị tự động chuyển sang trạng thái <strong>Ngừng hoạt động</strong>{' '}
              (Inactive).
            </li>
            <li>
              Đơn vị sẽ được chuyển sang trạng thái{' '}
              <strong>Đã xóa chờ khôi phục</strong> trong vòng 14 ngày. Bạn có
              thể khôi phục lại đơn vị bất kỳ lúc nào trong thời gian này.
            </li>
            <li>
              Sau 14 ngày, đơn vị sẽ bị <strong>Xóa vĩnh viễn</strong> (Hard
              delete) nếu không còn ràng buộc dữ liệu khác, hoặc{' '}
              <strong>Lưu trữ</strong> (Archive) nếu còn ràng buộc dữ liệu.
            </li>
          </ul>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* Checkbox xác nhận quy định 14 ngày */}
      <FormField control={control} name="confirm14DayRule" label="">
        {(field) => (
          <Checkbox
            checked={field.value as boolean}
            onChange={field.onChange}
            style={{ marginTop: 8 }}
          >
            Tôi đã đọc và hiểu quy định xóa mềm 14 ngày: restore trong 14 ngày,
            hết hạn sẽ hard delete hoặc archive.
          </Checkbox>
        )}
      </FormField>
    </FormModal>
  );
}
