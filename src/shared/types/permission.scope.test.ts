import { describe, it, expect } from 'vitest';
import {
  meetsMinScope,
  getScopeRequirement,
  hasScopeForAction,
  isRecordInScopeById,
  canActionOnRow,
  canActionOnRowWithScope,
  canAction,
  getRecordScope,
} from './permission.scope';

describe('permission.scope', () => {
  describe('meetsMinScope', () => {
    it('should return true when actual scope >= required scope', () => {
      expect(meetsMinScope('co_so', 'co_so')).toBe(true);
      expect(meetsMinScope('he_thong', 'co_so')).toBe(true);
      expect(meetsMinScope('he_thong', 'phong_ban')).toBe(true);
    });

    it('should return false when actual scope < required scope', () => {
      expect(meetsMinScope('phong_ban', 'co_so')).toBe(false);
      expect(meetsMinScope('kho', 'phong_ban')).toBe(false);
      expect(meetsMinScope('kho', 'co_so')).toBe(false);
    });

    it('should return false for null/undefined scope', () => {
      expect(meetsMinScope(null, 'co_so')).toBe(false);
      expect(meetsMinScope(undefined, 'phong_ban')).toBe(false);
    });
  });

  describe('getScopeRequirement', () => {
    it('should return correct requirement for known module+action', () => {
      expect(getScopeRequirement('org_units', 'create')).toBe('co_so');
      expect(getScopeRequirement('departments', 'edit')).toBe('phong_ban');
      expect(getScopeRequirement('employees', 'delete')).toBe('phong_ban');
      expect(getScopeRequirement('roles', 'create')).toBe('he_thong');
    });

    it('should return none for unknown module or action', () => {
      expect(getScopeRequirement('unknown', 'create' as any)).toBe('none');
      expect(getScopeRequirement('org_units', 'unknown' as any)).toBe('none');
      expect(getScopeRequirement('org_units' as any)).toBe('none');
    });
  });

  describe('hasScopeForAction', () => {
    it('should bypass for super admin', () => {
      expect(hasScopeForAction('phong_ban', 'org_units', 'create', true)).toBe(true);
      expect(hasScopeForAction(null, 'org_units', 'create', true)).toBe(true);
    });

    it('should check scope for normal user', () => {
      expect(hasScopeForAction('co_so', 'org_units', 'create', false)).toBe(true);
      expect(hasScopeForAction('phong_ban', 'org_units', 'create', false)).toBe(false);
      expect(hasScopeForAction('he_thong', 'roles', 'create', false)).toBe(true);
    });
  });

  describe('isRecordInScopeById', () => {
    const context = {
      scopeType: 'co_so' as const,
      orgUnitId: 1,
      departmentId: null,
    };

    it('should match org unit for co_so scope', () => {
      expect(isRecordInScopeById(context, { orgUnitId: 1, departmentId: null })).toBe(true);
      expect(isRecordInScopeById(context, { orgUnitId: 2, departmentId: null })).toBe(false);
    });

    it('should match department for phong_ban scope', () => {
      const deptContext = {
        scopeType: 'phong_ban' as const,
        orgUnitId: 1,
        departmentId: 5,
      };
      expect(isRecordInScopeById(deptContext, { orgUnitId: 1, departmentId: 5 })).toBe(true);
      expect(isRecordInScopeById(deptContext, { orgUnitId: 1, departmentId: 6 })).toBe(false);
    });

    it('should return true for he_thong scope', () => {
      const sysContext = {
        scopeType: 'he_thong' as const,
        orgUnitId: null,
        departmentId: null,
      };
      expect(isRecordInScopeById(sysContext, { orgUnitId: 999, departmentId: 999 })).toBe(true);
    });

    it('should fail-safe when IDs missing', () => {
      expect(isRecordInScopeById(context, { orgUnitId: null, departmentId: null })).toBe(false);
      expect(isRecordInScopeById({ ...context, orgUnitId: null }, { orgUnitId: 1, departmentId: null })).toBe(false);
    });
  });

  describe('canActionOnRow', () => {
    it('should bypass for super admin', () => {
      const result = canActionOnRow(true, { scopeType: 'phong_ban', orgUnitId: 1, departmentId: 1 }, { orgUnitId: 2, departmentId: 2 }, 'org_units', 'edit', true);
      expect(result).toBe(true);
    });

    it('should return false when no module permission', () => {
      const result = canActionOnRow(false, { scopeType: 'co_so', orgUnitId: 1 }, { orgUnitId: 1 }, 'org_units', 'edit', false);
      expect(result).toBe(false);
    });

    it('should pass when requirement is none or he_thong', () => {
      expect(canActionOnRow(true, { scopeType: 'phong_ban', departmentId: 1 }, { departmentId: 1 }, 'employees', 'view', false)).toBe(true);
      expect(canActionOnRow(true, { scopeType: 'phong_ban', departmentId: 1 }, { departmentId: 1 }, 'audit_logs', 'view', false)).toBe(true);
    });

    it('should check ID scope for co_so/phong_ban', () => {
      const ctx = { scopeType: 'co_so' as const, orgUnitId: 1 };
      expect(canActionOnRow(true, ctx, { orgUnitId: 1 }, 'org_units', 'edit', false)).toBe(true);
      expect(canActionOnRow(true, ctx, { orgUnitId: 2 }, 'org_units', 'edit', false)).toBe(false);
    });
  });

  describe('canActionOnRowWithScope', () => {
    it('should prioritize record scope_type over ID matching', () => {
      const record = { id: 1, scope_type: 'he_thong' as const };
      const ctx = { scopeType: 'phong_ban' as const, orgUnitId: 1, departmentId: 1 };
      const target = { orgUnitId: 999, departmentId: 999 };

      // Even though IDs don't match, record scope is he_thong → should pass
      const result = canActionOnRowWithScope(true, ctx, record, target, 'org_units', 'edit', false);
      expect(result).toBe(true);
    });

    it('should fallback to ID matching when no record scope', () => {
      const record = { id: 1 }; // no scope_type
      const ctx = { scopeType: 'co_so' as const, orgUnitId: 1 };
      const target = { orgUnitId: 1 };

      expect(canActionOnRowWithScope(true, ctx, record, target, 'org_units', 'edit', false)).toBe(true);
      expect(canActionOnRowWithScope(true, ctx, record, { orgUnitId: 2 }, 'org_units', 'edit', false)).toBe(false);
    });

    it('should use record scope for allow/deny/union logic', () => {
      // Record scope is phong_ban, requirement is co_so → should deny
      const record = { id: 1, scope_type: 'phong_ban' as const };
      const ctx = { scopeType: 'co_so' as const, orgUnitId: 1 };
      const target = { orgUnitId: 1 };

      expect(canActionOnRowWithScope(true, ctx, record, target, 'org_units', 'edit', false)).toBe(false);
    });
  });

  describe('getRecordScope', () => {
    it('should return scope from record', () => {
      expect(getRecordScope({ scope: 'co_so' })).toBe('co_so');
      expect(getRecordScope({ scope_type: 'phong_ban' })).toBe('phong_ban');
      expect(getRecordScope({ scope: 'he_thong', scope_type: 'co_so' })).toBe('he_thong');
      expect(getRecordScope({})).toBeUndefined();
    });
  });

  describe('canAction', () => {
    it('should check permission code and record scope', () => {
      const record = { id: 1, scope_type: 'co_so' as const };
      const perms = ['ORG_EDIT'];

      expect(canAction(record, 'edit', 'org_units', perms, false)).toBe(true);
      expect(canAction(record, 'edit', 'org_units', [], false)).toBe(false);
    });

    it('should bypass for super admin', () => {
      const record = { id: 1 };
      expect(canAction(record, 'edit', 'org_units', [], true)).toBe(true);
    });

    it('should fail-safe when record scope missing', () => {
      const record = { id: 1 };
      const perms = ['ORG_EDIT'];
      expect(canAction(record, 'edit', 'org_units', perms, false)).toBe(false);
    });
  });
});