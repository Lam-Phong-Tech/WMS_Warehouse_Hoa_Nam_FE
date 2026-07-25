import type { CSSProperties } from 'react';
import {
  AppstoreOutlined,
  TeamOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  InboxOutlined,
  ImportOutlined,
  ExportOutlined,
  SwapOutlined,
  FileSearchOutlined,
  SyncOutlined,
  CarOutlined,
} from '@ant-design/icons';

/**
 * Icon minh họa theo tên nhóm quyền (`object`) — match theo từ khóa tiếng
 * Việt vì danh sách nhóm do BE trả về động, không có catalog cố định ở FE
 * (xem role-permissions.helpers.ts). Fallback AppstoreOutlined nếu không
 * khớp từ khóa nào.
 */
export function getGroupIcon(object: string, style: CSSProperties) {
  const name = object.toLowerCase();
  if (name.includes('nhân sự') || name.includes('nhân viên')) {
    return <TeamOutlined style={style} />;
  }
  if (name.includes('phòng ban')) {
    return <ApartmentOutlined style={style} />;
  }
  if (name.includes('đơn vị') || name.includes('tổ chức')) {
    return <ClusterOutlined style={style} />;
  }
  if (name.includes('chức vụ')) {
    return <IdcardOutlined style={style} />;
  }
  if (name.includes('vai trò') || name.includes('quyền')) {
    return <SafetyCertificateOutlined style={style} />;
  }
  if (name.includes('phân công') || name.includes('công tác')) {
    return <SolutionOutlined style={style} />;
  }
  if (name.includes('nhập')) {
    return <ImportOutlined style={style} />;
  }
  if (name.includes('xuất') || name.includes('giao nhận')) {
    return <ExportOutlined style={style} />;
  }
  if (name.includes('điều chuyển') || name.includes('chuyển')) {
    return <SwapOutlined style={style} />;
  }
  if (name.includes('audit') || name.includes('nhật ký')) {
    return <FileSearchOutlined style={style} />;
  }
  if (name.includes('vòng đời') || name.includes('trạng thái')) {
    return <SyncOutlined style={style} />;
  }
  if (name.includes('kho')) {
    return <InboxOutlined style={style} />;
  }
  if (name.includes('vận chuyển') || name.includes('giao hàng')) {
    return <CarOutlined style={style} />;
  }
  return <AppstoreOutlined style={style} />;
}
