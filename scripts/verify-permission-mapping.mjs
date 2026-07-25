// Standalone verification of PERMISSION_RULES mapping (no antd/vitest needed).
// Replicates the logic in src/shared/types/permission.ts to confirm the
// resolved codes match the authoritative BE catalog.
const PERMISSION_RULES = {
  departments: { view: 'DEPT_VIEW', create: 'DEPT_CREATE', edit: 'DEPT_EDIT', delete: 'DEPT_INACTIVE', approve: 'DEPT_EDIT', export: 'DEPT_EXPORT', import: 'DEPT_EXPORT' },
  employees: { view: 'EMP_VIEW', create: 'EMP_CREATE', edit: 'EMP_EDIT', delete: 'EMP_INACTIVE', approve: 'EMP_EDIT', export: 'EMP_EXPORT', import: 'EMP_IMPORT' },
  positions: { view: 'POS_VIEW', create: 'POS_CREATE', edit: 'POS_EDIT', delete: 'POS_INACTIVE', approve: 'POS_EDIT', export: 'POS_EXPORT' },
  roles: { view: 'ROLE_VIEW', create: 'ROLE_MANAGE', edit: 'ROLE_MANAGE', delete: 'ROLE_MANAGE', approve: 'ROLE_MANAGE', export: 'ROLE_MANAGE' },
  employee_status: { view: 'EMP_VIEW', create: 'EMP_STATUS', edit: 'EMP_STATUS', delete: 'EMP_STATUS', approve: 'EMP_STATUS', export: 'EMP_EXPORT' },
  warehouses: { view: 'WAREHOUSE_VIEW', create: 'WAREHOUSE_CREATE', edit: 'WAREHOUSE_EDIT', delete: 'WAREHOUSE_INACTIVE', approve: 'WAREHOUSE_EDIT', export: 'WAREHOUSE_VIEW' },
};
function getPermissionCode(action, module, customCode) {
  if (customCode) return customCode;
  const m = PERMISSION_RULES[module];
  if (m && m[action]) return m[action];
  return `${module.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${action.toUpperCase()}`;
}
const checks = [
  ['delete', 'departments', 'DEPT_INACTIVE'],
  ['delete', 'employees', 'EMP_INACTIVE'],
  ['delete', 'positions', 'POS_INACTIVE'],
  ['create', 'roles', 'ROLE_MANAGE'],
  ['edit', 'roles', 'ROLE_MANAGE'],
  ['delete', 'roles', 'ROLE_MANAGE'],
  ['export', 'roles', 'ROLE_MANAGE'],
  ['create', 'employee_status', 'EMP_STATUS'],
  ['delete', 'warehouses', 'WAREHOUSE_INACTIVE'],
];
let ok = true;
for (const [a, m, expected] of checks) {
  const got = getPermissionCode(a, m);
  const pass = got === expected;
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${m}.${a} -> ${got} (expected ${expected})`);
}
const forbidden = ['DEPT_DELETE','EMP_DELETE','POS_DELETE','ROLE_CREATE','ROLE_EDIT','ROLE_DELETE','ROLE_EXPORT','WAREHOUSE_DELETE','WAREHOUSE_APPROVE'];
const all = Object.values(PERMISSION_RULES).flatMap(m => Object.values(m));
for (const bad of forbidden) {
  const has = all.includes(bad);
  if (has) ok = false;
  console.log(`${has ? 'FAIL' : 'PASS'}  catalog must NOT contain ${bad}`);
}
console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);