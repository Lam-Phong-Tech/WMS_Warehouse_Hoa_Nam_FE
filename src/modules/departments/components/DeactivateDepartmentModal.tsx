import { useState } from 'react';
import { Alert, Button, Checkbox, Modal, Space, Typography } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import type { Department } from '@/modules/departments/types/departments.types';

const { Text } = Typography;

export interface DeactivateDepartmentModalProps {
  open: boolean;
  department: Department | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Xác nhận Xóa mềm phòng ban. API thật (DELETE /departments/{id}/soft-delete)
 * không nhận body — không có mode/transfer/reason/effective_date như thiết kế
 * cũ. Số nhân sự lấy trực tiếp từ Department.employeeCount đã có sẵn ở client.
 *
 * Không gọi thêm API impact-stats (child departments/task bindings/business
 * constraints) — đã xác nhận DỨT ĐIỂM là BE không có endpoint này, tra trực
 * tiếp toàn bộ OpenAPI spec thật (https://astrodev.test8.io.vn/docs?api-docs.json,
 * 194 endpoints, kiểm tra 2026-07-03): endpoint thật của /departments chỉ gồm
 * GET/POST /departments, GET /departments/trashed, GET/PUT /departments/{id},
 * PATCH /departments/{id}/restore, DELETE /departments/{id}/soft-delete,
 * GET /departments/tree, DELETE /departments/{id}/force-delete,
 * POST /departments/generate-code, GET /departments/export-excel — không có
 * impact-stats. Đây là giới hạn của BE, không phải FE thiếu sót; chi tiết xem
 * docs/CHANGELOG.md mục "impact-stats — xác nhận BE không có endpoint này".
 */

export function DeactivateDepartmentModal({
  open,
  department,
  loading,
  onCancel,
  onConfirm,
}: DeactivateDepartmentModalProps) {
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirm14DayRule, setConfirm14DayRule] = useState(false);

  const handleAfterClose = () => {
    setConfirmDeactivate(false);
    setConfirm14DayRule(false);
  };

  const employeeCount = department?.employeeCount ?? 0;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      afterClose={handleAfterClose}
      destroyOnHidden
      footer={null}
      title={
        <Space>
          <ExclamationCircleFilled style={{ color: '#faad14' }} />
          Xóa phòng ban
        </Space>
      }
    >
      <p style={{ marginTop: 8 }}>
        Phòng ban <Text strong>{department?.name}</Text>
        {employeeCount > 0 ? (
          <>
            {' '}
            đang có <Text strong>{employeeCount} nhân sự</Text>.
          </>
        ) : (
          '.'
        )}
      </p>

      <Alert
        message={<Text strong>Xóa ≠ Vô hiệu hóa:</Text>}
        description={
          <ul
            style={{
              paddingLeft: 16,
              margin: '4px 0 0 0',
              fontSize: 13,
              color: '#434343',
            }}
          >
            <li>
              Phòng ban sẽ chuyển sang trạng thái{' '}
              <strong>Đã xóa chờ khôi phục</strong>, vào thùng rác trong vòng{' '}
              <strong>14 ngày</strong>. Có thể khôi phục bất kỳ lúc nào trong
              thời gian này.
            </li>
            <li>
              Sau 14 ngày mà còn ràng buộc dữ liệu (nhân sự / công việc), hệ
              thống sẽ tự động <strong>lưu trữ</strong> (read-only).
            </li>
          </ul>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {employeeCount > 0 && (
        <Checkbox
          checked={confirmDeactivate}
          onChange={(e) => setConfirmDeactivate(e.target.checked)}
          style={{ marginTop: 8 }}
        >
          Tôi hiểu rằng phòng ban này đang có{' '}
          <Text strong>{employeeCount} nhân sự</Text>.
        </Checkbox>
      )}
      <Checkbox
        checked={confirm14DayRule}
        onChange={(e) => setConfirm14DayRule(e.target.checked)}
        style={{ marginTop: 8 }}
      >
        Tôi đã đọc và hiểu quy định xóa 14 ngày.
      </Checkbox>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 24,
        }}
      >
        <Button onClick={onCancel}>Hủy</Button>
        <Button
          danger
          type="primary"
          loading={loading}
          onClick={() => onConfirm()}
          disabled={
            !confirm14DayRule || (employeeCount > 0 && !confirmDeactivate)
          }
        >
          Xóa
        </Button>
      </div>
    </Modal>
  );
}
