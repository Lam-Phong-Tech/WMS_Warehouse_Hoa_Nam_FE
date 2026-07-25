import type {
  Department,
  DepartmentType,
  DepartmentTreeNode,
} from '@/modules/departments/types/departments.types';
import type { DepartmentFormValues } from '@/modules/departments/schemas/department.schema';

export type DepartmentFromApi = Omit<
  Department,
  | 'orgUnitId'
  | 'managerId'
  | 'orgUnitName'
  | 'managerName'
  | 'active'
  | 'parentId'
  | 'deletedAt'
  | 'restoreDeadline'
  | 'archivedAt'
  | 'employeeCount'
  | 'departmentType'
  | 'parentName'
  | 'createdAt'
  | 'updatedAt'
> & {
  org_unit?: { id: number; name: string } | null;
  org_unit_id?: number | null;
  parent_id?: number | null;
  parent?: { id?: number; name?: string } | null;
  department_type?: DepartmentType;
  description?: string | null;
  manager_name?: string | null;
  manager_employee_id?: number | null;
  manager?: { id?: number; full_name?: string; name?: string } | null;
  employees_count?: number | null;
  deleted_at?: string | null;
  archived_at?: string | null;
  restore_deadline?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status: number; // 1: active, 0: inactive
};

export type DepartmentTreeNodeFromApi = DepartmentFromApi & {
  children?: DepartmentTreeNodeFromApi[];
};

export function remap(dept: DepartmentFromApi): Department {
  const {
    org_unit,
    org_unit_id,
    parent_id,
    parent,
    department_type,
    description,
    manager_name,
    manager_employee_id,
    manager,
    status,
    deleted_at,
    archived_at,
    restore_deadline,
    employees_count,
    created_at,
    updated_at,
    ...rest
  } = dept;
  return {
    ...rest,
    orgUnitId: org_unit?.id ?? org_unit_id ?? 0,
    orgUnitName: org_unit?.name ?? '',
    departmentType: department_type ?? 'phong_ban',
    managerId: manager_employee_id ?? manager?.id ?? null,
    managerName:
      manager_name ?? manager?.full_name ?? manager?.name ?? undefined,
    note: description ?? undefined,
    active: status === 1,
    parentId: parent_id ?? null,
    parentName: parent?.name ?? undefined,
    deletedAt: deleted_at,
    restoreDeadline: restore_deadline,
    archivedAt: archived_at,
    employeeCount: employees_count ?? undefined,
    createdAt: created_at,
    updatedAt: updated_at,
  };
}

export function remapTree(
  nodes: DepartmentTreeNodeFromApi[],
): DepartmentTreeNode[] {
  return nodes.map((node) => ({
    ...remap(node),
    children: node.children?.length ? remapTree(node.children) : undefined,
  }));
}

export function toPayload(values: DepartmentFormValues) {
  return {
    code: values.code,
    name: values.name,
    department_type: values.departmentType,
    org_unit_id: values.orgUnitId,
    parent_id: values.parentId ?? null,
    manager_employee_id: values.managerId ?? null,
    description: values.note || null,
    status: values.active ? 1 : 0,
  };
}
