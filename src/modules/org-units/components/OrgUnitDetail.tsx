import { useMemo } from 'react';
import {
  Avatar,
  Button,
  Descriptions,
  Flex,
  Space,
  Statistic,
  Tag,
  Typography,
  theme,
} from 'antd';
import {
  ApartmentOutlined,
  EditOutlined,
  StopOutlined,
  UndoOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { storageUrl } from '@/shared/utils/storage-url';
import {
  UNIT_TYPE_LABELS,
  ORG_UNIT_STATUS_LABELS,
  ORG_UNIT_STATUS_COLORS,
  getOrgUnitStatus,
  type OrgUnit,
} from '@/modules/org-units/types/org-units.types';

const { Title, Text } = Typography;

export interface OrgUnitDetailProps {
  unit: OrgUnit;
  nameById: Map<number, string>;
  stats: { companies: number; branches: number };
  employeeCount?: number;
  onEdit: () => void;
  onDeactivate: () => void;
  onRestore?: () => void;
  onArchive?: () => void;
  onViewEmployees?: () => void;
  isDeactivating: boolean;
  isRestoring?: boolean;
  isArchiving?: boolean;
  /**
   * P0.1: true khi xem một đơn vị không phải Chi nhánh trong chế độ Quản lý
   * chi nhánh (`?mode=branch`) — panel chỉ hiển thị read-only, ẩn toàn bộ
   * action Sửa/Vô hiệu/Khôi phục/Lưu trữ.
   */
  readOnly?: boolean;
  /**
   * Row-level-safe permission flags — tính bằng `canActionOnRow()` ở page
   * cha (giống OrgUnitsTable), đã kết hợp module permission + scope theo
   * chính `unit` đang xem, không chỉ permissionCode chung chung.
   */
  canEdit?: boolean;
  canDeactivate?: boolean;
  canRestore?: boolean;
  canArchive?: boolean;
}

/** Panel chi tiết một đơn vị tổ chức (master-detail bên phải). */
export function OrgUnitDetail({
  unit,
  nameById,
  stats,
  employeeCount,
  onEdit,
  onDeactivate,
  onRestore,
  onArchive,
  onViewEmployees,
  isDeactivating,
  isRestoring = false,
  isArchiving = false,
  readOnly = false,
  canEdit = false,
  canDeactivate = false,
  canRestore = false,
  canArchive = false,
}: OrgUnitDetailProps) {
  const { token } = theme.useToken();

  const parentName =
    unit.parent?.name ??
    (unit.parentId != null ? (nameById.get(unit.parentId) ?? '—') : '— (gốc)');

  const logoSrc = storageUrl(unit.logo ?? unit.org_unit?.logo);
  const orgUnitName = unit.org_unit?.name ?? unit.name;
  const orgUnitCode = unit.org_unit?.code ?? unit.code;
  const representativeLabel =
    unit.manager?.full_name ?? unit.representativeName ?? '—';
  const email = unit.email ?? unit.org_unit?.email;
  const phone = unit.phone ?? unit.org_unit?.phone;
  const province = unit.province ?? unit.org_unit?.province;
  const taxCodeStatusLabel =
    unit.taxCodeStatusLabel ?? unit.org_unit?.tax_code_status_label;

  const status = getOrgUnitStatus(unit);

  // P1.4: Calculate remaining days for restore window (14 days from deletedAt)
  const restoreDeadlineInfo = useMemo(() => {
    if (!unit.deletedAt || status !== 'soft_deleted') return null;
    const deletedDate = new Date(unit.deletedAt);
    const deadlineDate = new Date(deletedDate);
    deadlineDate.setDate(deadlineDate.getDate() + 14);
    const now = new Date();
    const remainingDays = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      remainingDays: Math.max(0, remainingDays),
      deadline: deadlineDate.toLocaleDateString('vi-VN'),
    };
  }, [unit.deletedAt, status]);

  const isRestoreDisabled =
    (restoreDeadlineInfo && restoreDeadlineInfo.remainingDays <= 0) ||
    unit.canRestore === false ||
    unit.can_restore === false;

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {/* Header: logo + tên + actions */}
      <Flex
        align="flex-start"
        gap={14}
        style={{
          paddingBottom: 16,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          marginBottom: 4,
        }}
      >
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={unit.name}
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              objectFit: 'contain',
              border: `1px solid ${token.colorBorderSecondary}`,
              flexShrink: 0,
              background: '#fff',
            }}
          />
        ) : (
          <Avatar
            shape="square"
            size={52}
            icon={<ApartmentOutlined />}
            style={{
              background: token.colorFillSecondary,
              color: token.colorTextTertiary,
              borderRadius: 8,
              flexShrink: 0,
            }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <Title level={4} style={{ margin: 0 }}>
            {unit.name}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Mã: {unit.code} · {UNIT_TYPE_LABELS[unit.unitType] ?? unit.unitType}
          </Text>
        </div>

        <Space>
          {!readOnly &&
            (status === 'active' ? (
              <>
                {canEdit && (
                  <Button icon={<EditOutlined />} onClick={onEdit}>
                    Sửa
                  </Button>
                )}
                {canDeactivate && (
                  <Button
                    danger
                    icon={<StopOutlined />}
                    loading={isDeactivating}
                    onClick={onDeactivate}
                  >
                    Vô hiệu hóa
                  </Button>
                )}
              </>
            ) : (
              (status === 'soft_deleted' || status === 'inactive') && (
                <>
                  {canRestore && (
                    <Button
                      type="primary"
                      icon={<UndoOutlined />}
                      loading={isRestoring}
                      disabled={isRestoreDisabled}
                      onClick={onRestore}
                    >
                      Khôi phục
                    </Button>
                  )}
                  {status === 'soft_deleted' && restoreDeadlineInfo && (
                    <Typography.Text
                      type={
                        restoreDeadlineInfo.remainingDays <= 3
                          ? 'danger'
                          : 'secondary'
                      }
                      style={{ fontSize: 12 }}
                    >
                      {restoreDeadlineInfo.remainingDays > 0
                        ? `Còn ${restoreDeadlineInfo.remainingDays} ngày để khôi phục (trước ${restoreDeadlineInfo.deadline})`
                        : 'Đã hết hạn khôi phục (14 ngày)'}
                    </Typography.Text>
                  )}
                  {canArchive && (
                    <Button
                      icon={<InboxOutlined />}
                      loading={isArchiving}
                      onClick={onArchive}
                    >
                      Lưu trữ
                    </Button>
                  )}
                </>
              )
            ))}
        </Space>
      </Flex>

      {/* Fields */}
      <Descriptions
        column={{ xs: 1, sm: 2 }}
        size="small"
        style={{ marginTop: 4 }}
      >
        <Descriptions.Item label="Mã số thuế (MST)">
          {unit.taxCode || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Người đại diện">
          {representativeLabel}
        </Descriptions.Item>

        <Descriptions.Item label="Đơn vị tổ chức">
          {`${orgUnitName} (${orgUnitCode})`}
        </Descriptions.Item>
        <Descriptions.Item label="Email">{email || '—'}</Descriptions.Item>

        <Descriptions.Item label="Số điện thoại">
          {phone || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Tỉnh/TP">{province || '—'}</Descriptions.Item>

        <Descriptions.Item label="Phường/Xã" span={2}>
          {unit.ward || '—'}
        </Descriptions.Item>

        <Descriptions.Item label="Địa chỉ" span={2}>
          {unit.address || '—'}
        </Descriptions.Item>

        <Descriptions.Item label="Đơn vị cha">{parentName}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái MST">
          {taxCodeStatusLabel || '—'}
        </Descriptions.Item>

        <Descriptions.Item label="Trạng thái">
          <Tag
            color={ORG_UNIT_STATUS_COLORS[status]}
            style={{ borderRadius: 20, padding: '1px 10px' }}
          >
            • {ORG_UNIT_STATUS_LABELS[status]}
          </Tag>
        </Descriptions.Item>

        {unit.note && (
          <Descriptions.Item label="Ghi chú" span={2}>
            {unit.note}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Stats */}
      <Flex
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          marginTop: 8,
        }}
      >
        {[
          { label: 'Công ty con', value: stats.companies },
          { label: 'Chi nhánh', value: stats.branches },
          {
            label: 'Nhân sự',
            value: employeeCount ?? unit.employeeCount ?? 0,
            onClick: onViewEmployees,
          },
        ].map((s, i, arr) => (
          <div
            key={s.label}
            onClick={s.onClick}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '16px 12px',
              borderRight:
                i < arr.length - 1
                  ? `1px solid ${token.colorBorderSecondary}`
                  : undefined,
              cursor: s.onClick ? 'pointer' : undefined,
            }}
          >
            <Statistic
              title={s.label}
              value={s.value}
              styles={
                s.onClick
                  ? { content: { color: token.colorPrimary } }
                  : undefined
              }
            />
          </div>
        ))}
      </Flex>
    </div>
  );
}
