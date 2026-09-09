import { useCallback, useRef } from "react";

/**
 * Key constants to scope form draft storage in localStorage.
 */
const DRAFT_PREFIX = "erp_form_draft";

/**
 * Validate that stored JSON still looks like a valid non-null object
 * (prevents legacy garbage or format mismatches from crashing JSON.parse).
 */
function isValidDraft(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a stable localStorage key for a given form identifier.
 * The `identifier` should be unique per form instance, e.g. `org-unit-create`.
 */
function draftKey(identifier: string): string {
  return `${DRAFT_PREFIX}:${identifier}`;
}

/**
 * Xoá toàn bộ draft của mọi form khỏi localStorage. Gọi khi logout: máy trong
 * kho dùng chung giữa các ca, draft (có thể chứa SĐT/địa chỉ khách) không được
 * sống sang phiên của người khác.
 */
export function clearAllFormDrafts(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith(`${DRAFT_PREFIX}:`)) doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * useFormDraft — persist & restore form values to localStorage.
 *
 * Designed for forms where the user may accidentally close the modal
 * or navigate away before saving. On next open, the previously entered
 * values are automatically restored.
 *
 * @example
 * ```tsx
 * const draft = useFormDraft('org-unit-create');
 *
 * // When modal opens for create (not edit):
 * useEffect(() => {
 *   if (open && !editing) {
 *     const saved = draft.restore();
 *     if (saved) reset({ ...DEFAULTS, ...saved });
 *   }
 * }, [open, editing]);
 *
 * // When user closes modal without saving:
 * const handleCancel = () => {
 *   const current = getValues();
 *   draft.save(current);
 *   onCancel();
 * };
 *
 * // After successful submission:
 * draft.clear();
 * ```
 */
export function useFormDraft<T extends Record<string, unknown>>(
  identifier: string,
) {
  const key = draftKey(identifier);
  const lastSavedRef = useRef<string | null>(null);

  /**
   * Save current form values as draft.
   */
  const save = useCallback(
    (values: Partial<T>) => {
      try {
        const json = JSON.stringify(values);
        localStorage.setItem(key, json);
        lastSavedRef.current = json;
      } catch {
        // localStorage quota exceeded or unavailable — silently ignore
      }
    },
    [key],
  );

  /**
   * Restore saved draft values. Returns `null` if no draft exists.
   */
  const restore = useCallback((): Partial<T> | null => {
    const raw = localStorage.getItem(key);
    const parsed = isValidDraft(raw);
    if (parsed === null) return null;
    lastSavedRef.current = raw;
    return parsed as Partial<T>;
  }, [key]);

  /**
   * Check if a draft exists in localStorage.
   */
  const hasDraft = useCallback((): boolean => {
    return isValidDraft(localStorage.getItem(key)) !== null;
  }, [key]);

  /**
   * Remove the draft from localStorage.
   */
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
      lastSavedRef.current = null;
    } catch {
      // silently ignore
    }
  }, [key]);

  /**
   * Check whether the current in-memory values differ from the last saved draft.
   * Useful to avoid overwriting with the same data.
   */
  const isSameAsLastSaved = useCallback((values: Partial<T>): boolean => {
    if (lastSavedRef.current === null) return false;
    try {
      return JSON.stringify(values) === lastSavedRef.current;
    } catch {
      return false;
    }
  }, []);

  return { save, restore, hasDraft, clear, isSameAsLastSaved };
}
