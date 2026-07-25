import { useMemo } from 'react';
import { Spin, Tag, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  DEPARTMENT_STATUS_LABELS,
  getDepartmentStatus,
  type DepartmentTreeNode,
} from '@/modules/departments/types/departments.types';
import { ORG_UNIT_STATUS_COLORS } from '@/modules/org-units/types/org-units.types';

/**
 * Lọc cây đệ quy theo từ khoá + đơn vị tổ chức + trạng thái.
 * Một node bị loại nếu chính nó không khớp org/status, trừ khi có con cháu khớp
 * (giữ đường dẫn tới con khớp để không vỡ cấu trúc cây).
 */
function filterTree(
  nodes: DepartmentTreeNode[],
  kw: string,
  orgFilter: number | 'all',
  statusFilter: string,
): DepartmentTreeNode[] {
  return nodes.reduce<DepartmentTreeNode[]>((acc, node) => {
    const matchKeyword =
      !kw ||
      node.code?.toLowerCase().includes(kw) ||
      node.name?.toLowerCase().includes(kw);
    const matchOrg = orgFilter === 'all' || node.orgUnitId === orgFilter;
    const matchStatus =
      statusFilter === 'all' || getDepartmentStatus(node) === statusFilter;
    const match = matchKeyword && matchOrg && matchStatus;
    let filteredChildren: DepartmentTreeNode[] | undefined;
    if (node.children?.length) {
      filteredChildren = filterTree(node.children, kw, orgFilter, statusFilter);
    }
    if (match || (filteredChildren && filteredChildren.length > 0)) {
      acc.push({
        ...node,
        children:
          filteredChildren && filteredChildren.length > 0
            ? filteredChildren
            : undefined,
      });
    }
    return acc;
  }, []);
}

function nodeTitle(node: DepartmentTreeNode) {
  const status = getDepartmentStatus(node);
  const isNotActive = status !== 'active';
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
          {node.code} — {node.name}
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
            {DEPARTMENT_STATUS_LABELS[status]}
          </Tag>
        )}
      </span>
      {node.managerName && (
        <span
          style={{
            fontSize: 12,
            lineHeight: '18px',
            color: '#8c8c8c',
            paddingLeft: 2,
          }}
        >
          Trưởng phòng: {node.managerName}
        </span>
      )}
    </span>
  );
}

function toAntTreeData(nodes: DepartmentTreeNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.id,
    title: nodeTitle(node),
    isLeaf: !node.children?.length,
    children: node.children?.length ? toAntTreeData(node.children) : undefined,
  }));
}

export interface DepartmentTreeProps {
  treeData?: DepartmentTreeNode[];
  keyword: string;
  orgFilter?: number | 'all';
  statusFilter?: string;
  loading?: boolean;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

/**
 * Cây phòng ban (panel trái master-detail).
 * Không có bộ lọc nào → giữ cấu trúc cây; có từ khoá/đơn vị/trạng thái → lọc theo tất cả tiêu chí.
 */
export function DepartmentTree({
  treeData,
  keyword,
  orgFilter = 'all',
  statusFilter = 'all',
  loading,
  selectedId,
  onSelect,
}: DepartmentTreeProps) {
  const antTreeData = useMemo(() => {
    if (!treeData) return [];
    const kw = keyword.trim().toLowerCase();
    if (!kw && orgFilter === 'all' && statusFilter === 'all') {
      return toAntTreeData(treeData);
    }
    const filtered = filterTree(treeData, kw, orgFilter, statusFilter);
    return toAntTreeData(filtered);
  }, [treeData, keyword, orgFilter, statusFilter]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <Spin />
      </div>
    );
  }

  return (
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
  );
}
