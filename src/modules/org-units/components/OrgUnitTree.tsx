import { useMemo } from 'react';
import { Spin, Tag, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  UNIT_TYPE_LABELS,
  ORG_UNIT_STATUS_LABELS,
  ORG_UNIT_STATUS_COLORS,
  getOrgUnitStatus,
  type OrgUnit,
  type OrgUnitStatus,
  type OrgUnitTreeNode,
} from '@/modules/org-units/types/org-units.types';
import {
  filterOrgUnitTree,
  excludeStatuses,
  HIDDEN_BY_DEFAULT_STATUSES,
} from '@/modules/org-units/utils/org-units.helpers';

const UNIT_TYPE_COLORS: Record<string, string> = {
  cong_ty_me: 'geekblue',
  cong_ty_con: 'blue',
  chi_nhanh: 'cyan',
};

function nodeTitle(node: OrgUnit) {
  const status = getOrgUnitStatus(node);
  const isNotActive = status !== 'active';
  const representativeName = node.managerName ?? node.representativeName;
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            flex: 1,
            fontSize: 14,
            lineHeight: '22px',
            color: isNotActive ? '#8c8c8c' : 'inherit',
            textDecoration: status === 'soft_deleted' ? 'line-through' : 'none',
          }}
        >
          {node.name}
        </span>
        {isNotActive && (
          <Tag
            color={ORG_UNIT_STATUS_COLORS[status]}
            style={{
              fontSize: 10,
              padding: '0 4px',
              lineHeight: '16px',
              margin: 0,
            }}
          >
            {ORG_UNIT_STATUS_LABELS[status]}
          </Tag>
        )}
        <Tag
          color={UNIT_TYPE_COLORS[node.unitType]}
          style={{
            fontSize: 12,
            padding: '0 7px',
            lineHeight: '20px',
            margin: 0,
          }}
        >
          {UNIT_TYPE_LABELS[node.unitType] ?? node.unitType}
        </Tag>
      </span>
      {representativeName && (
        <span
          style={{
            fontSize: 12,
            lineHeight: '18px',
            color: '#8c8c8c',
            paddingLeft: 2,
          }}
        >
          Người đại diện: {representativeName}
        </span>
      )}
    </span>
  );
}

function toAntTreeData(
  nodes: OrgUnitTreeNode[],
  isBranchMode: boolean,
): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: nodeTitle(node),
    isLeaf: !node.children?.length,
    // P0.1: chế độ Chi nhánh giữ Công ty mẹ/con làm ancestor context của cây
    // nhưng không cho chọn — chỉ xem read-only.
    selectable: !isBranchMode || node.unitType === 'chi_nhanh',
    children: node.children?.length
      ? toAntTreeData(node.children, isBranchMode)
      : undefined,
  }));
}

export interface OrgUnitTreeProps {
  treeData?: OrgUnitTreeNode[];
  keyword: string;
  filterUnitType?: string;
  filterProvince?: string;
  filterStatus?: OrgUnitStatus;
  filterCompany?: number;
  loading?: boolean;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  /**
   * P0.1: chế độ "Quản lý chi nhánh" — Công ty mẹ/con vẫn hiển thị làm
   * ancestor context của cây nhưng không selectable (chỉ xem read-only).
   */
  isBranchMode?: boolean;
}

/**
 * Cây đơn vị tổ chức (panel trái master-detail).
 * Không có tiêu chí lọc nào → giữ cấu trúc cây; có tiêu chí → trải phẳng kết quả khớp.
 */
export function OrgUnitTree({
  treeData,
  keyword,
  filterUnitType,
  filterProvince,
  filterStatus,
  filterCompany,
  loading,
  selectedId,
  onSelect,
  isBranchMode = false,
}: OrgUnitTreeProps) {
  const antTreeData = useMemo(() => {
    if (!treeData) return [];
    // Chỉ giữ lại đơn vị đã xóa mềm/lưu trữ trong cây khi người dùng chủ động
    // lọc đúng trạng thái đó — mặc định ẩn để tránh rối cây (xem HIDDEN_BY_DEFAULT_STATUSES).
    const base =
      filterStatus && HIDDEN_BY_DEFAULT_STATUSES.includes(filterStatus)
        ? treeData
        : excludeStatuses(treeData, HIDDEN_BY_DEFAULT_STATUSES);
    const hasFilter =
      keyword.trim() ||
      filterUnitType ||
      filterProvince ||
      filterStatus ||
      filterCompany;
    if (!hasFilter) return toAntTreeData(base, isBranchMode);
    const filtered = filterOrgUnitTree(base, {
      keyword,
      unitType: filterUnitType,
      province: filterProvince,
      status: filterStatus,
      company: filterCompany,
    });
    return toAntTreeData(filtered, isBranchMode);
  }, [
    treeData,
    keyword,
    filterUnitType,
    filterProvince,
    filterStatus,
    filterCompany,
    isBranchMode,
  ]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <Spin />
      </div>
    );
  }

  return (
    <>
      <Tree
        treeData={antTreeData}
        defaultExpandAll
        blockNode
        style={{ fontSize: 14 }}
        selectedKeys={selectedId != null ? [selectedId] : []}
        onSelect={(keys) => {
          const key = keys[0];
          onSelect(key != null ? Number(key) : null);
        }}
      />
    </>
  );
}
