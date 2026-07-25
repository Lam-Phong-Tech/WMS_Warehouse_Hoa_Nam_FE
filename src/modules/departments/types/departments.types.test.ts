import { describe, it, expect } from 'vitest';
import { getDepartmentStatus } from './departments.types';

describe('getDepartmentStatus', () => {
  it('should return "archived" if archivedAt is present', () => {
    const dept = {
      active: false,
      deletedAt: 'some-date',
      archivedAt: 'some-date',
    };
    expect(getDepartmentStatus(dept)).toBe('archived');
  });

  it('should return "soft_deleted" if deletedAt is present and archivedAt is not', () => {
    const dept = { active: false, deletedAt: 'some-date', archivedAt: null };
    expect(getDepartmentStatus(dept)).toBe('soft_deleted');
  });

  it('should return "active" if active is true and no deletion/archival dates are present', () => {
    const dept = { active: true, deletedAt: null, archivedAt: null };
    expect(getDepartmentStatus(dept)).toBe('active');
  });

  it('should return "inactive" if active is false and no deletion/archival dates are present', () => {
    const dept = { active: false, deletedAt: null, archivedAt: null };
    expect(getDepartmentStatus(dept)).toBe('inactive');
  });

  it('should prioritize "archived" over "deletedAt"', () => {
    const dept = {
      active: true,
      deletedAt: 'some-date',
      archivedAt: 'another-date',
    };
    expect(getDepartmentStatus(dept)).toBe('archived');
  });

  it('should prioritize "soft_deleted" over "active"', () => {
    const dept = { active: true, deletedAt: 'some-date', archivedAt: null };
    expect(getDepartmentStatus(dept)).toBe('soft_deleted');
  });
});
