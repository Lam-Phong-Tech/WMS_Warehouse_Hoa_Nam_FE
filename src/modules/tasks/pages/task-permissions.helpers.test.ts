import { describe, it, expect } from 'vitest';

function canCancelTask(status: string, hasEdit: boolean): boolean {
  if (!hasEdit) return false;
  return status !== 'completed' && status !== 'cancel';
}

describe('canCancelTask', () => {
  it('allows cancel for new with TASK_EDIT', () => {
    expect(canCancelTask('new', true)).toBe(true);
  });
  it('allows cancel for processing with TASK_EDIT', () => {
    expect(canCancelTask('processing', true)).toBe(true);
  });
  it('allows cancel for pending_approval with TASK_EDIT', () => {
    expect(canCancelTask('pending_approval', true)).toBe(true);
  });
  it('allows cancel for rejected with TASK_EDIT', () => {
    expect(canCancelTask('rejected', true)).toBe(true);
  });
  it('blocks cancel for completed', () => {
    expect(canCancelTask('completed', true)).toBe(false);
  });
  it('blocks cancel for cancel', () => {
    expect(canCancelTask('cancel', true)).toBe(false);
  });
  it('blocks cancel without TASK_EDIT', () => {
    expect(canCancelTask('new', false)).toBe(false);
    expect(canCancelTask('processing', false)).toBe(false);
  });
});