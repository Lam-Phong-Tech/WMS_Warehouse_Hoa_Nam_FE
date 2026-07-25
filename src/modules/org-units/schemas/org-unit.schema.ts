import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Allowed unit types */
export const UNIT_TYPES = ['cong_ty_me', 'cong_ty_con', 'chi_nhanh'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

/** Maximum depth of org unit hierarchy (parent → child → branch = 3 levels) */
export const MAX_HIERARCHY_DEPTH = 3;

/** Code format: 2-20 chars, A-Z, 0-9, -, _ */
export const CODE_REGEX = /^[A-Z0-9_-]{2,20}$/;

/** MST format: 10-13 digits */
export const TAX_CODE_REGEX = /^\d{10,13}$/;

/** TMP code format: TMP- followed by at least 4 alphanumeric chars */
export const TMP_CODE_REGEX = /^TMP-[A-Z0-9]{4,}$/;

/** Phone format: fix cứng SĐT di động 10 chữ số, đầu số 03/05/07/08/09 */
export const PHONE_REGEX = /^(03|05|07|08|09)[0-9]{8}$/;
export const PHONE_MAX_LENGTH = 10;

/** Email format: chỉ chấp nhận địa chỉ @gmail.com */
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Chuẩn hoá mã: uppercase + strip ký tự không hợp lệ. */
export function normalizeOrgUnitCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

/**
 * Tính độ sâu của một đơn vị trong hệ thống phân cấp.
 * Cấp 1 = Công ty mẹ (root, không có parent)
 * Cấp 2 = Công ty con (parent là Công ty mẹ)
 * Cấp 3 = Chi nhánh (parent là Công ty mẹ hoặc Công ty con)
 *
 * @param unitId ID của đơn vị cần tính độ sâu
 * @param allUnits Danh sách tất cả đơn vị (để truy ngược parent chain)
 * @param maxDepth Độ sâu tối đa cho phép (mặc định: 3)
 * @returns Độ sâu của đơn vị (1-based), hoặc 0 nếu không tìm thấy
 */
export function getUnitDepth(
  unitId: number | null | undefined,
  allUnits: Array<{ id: number; parentId: number | null }>,
  maxDepth: number = MAX_HIERARCHY_DEPTH,
): number {
  if (unitId == null) return 0;

  let depth = 0;
  let currentId: number | null = unitId;
  const visited = new Set<number>();

  while (currentId != null) {
    if (visited.has(currentId)) break; // Prevent infinite loop
    visited.add(currentId);

    const unit = allUnits.find((u) => u.id === currentId);
    if (!unit) break;

    depth++;
    currentId = unit.parentId;
    if (depth > maxDepth) break;
  }

  return depth;
}

/**
 * Kiểm tra xem parentId có hợp lệ theo unit type và hierarchy depth không.
 * Trả về error message nếu không hợp lệ, null nếu OK.
 */
export function validateParentId(
  unitType: string,
  parentId: number | null | undefined,
  allUnits: Array<{ id: number; parentId: number | null; unitType: string }>,
  editingId?: number | null,
): string | null {
  // Công ty mẹ không được có parent
  if (unitType === 'cong_ty_me') {
    if (parentId != null) {
      return 'Công ty mẹ không được phép chọn đơn vị cha';
    }
    return null;
  }

  // Công ty con và Chi nhánh bắt buộc phải có parent
  if (!parentId) {
    return 'Vui lòng chọn đơn vị cha';
  }

  // Tìm parent unit
  const parentUnit = allUnits.find((u) => u.id === parentId);
  if (!parentUnit) {
    return 'Đơn vị cha không tồn tại trong hệ thống';
  }

  // Validate parent type
  if (unitType === 'cong_ty_con' && parentUnit.unitType !== 'cong_ty_me') {
    return 'Công ty con chỉ có thể trực thuộc Công ty mẹ';
  }
  if (
    unitType === 'chi_nhanh' &&
    parentUnit.unitType !== 'cong_ty_me' &&
    parentUnit.unitType !== 'cong_ty_con'
  ) {
    return 'Chi nhánh chỉ có thể trực thuộc Công ty mẹ hoặc Công ty con';
  }

  // Validate hierarchy depth (max 3 levels)
  const parentDepth = getUnitDepth(parentId, allUnits);
  if (parentDepth >= MAX_HIERARCHY_DEPTH) {
    return `Hệ thống phân cấp chỉ cho phép tối đa ${MAX_HIERARCHY_DEPTH} cấp (Mẹ → Con → Chi nhánh)`;
  }

  // Prevent self-reference
  if (editingId != null && parentId === editingId) {
    return 'Không thể chọn chính đơn vị này làm đơn vị cha';
  }

  // Prevent circular reference (parent is child/grandchild of editing unit)
  if (editingId != null) {
    const isCircular = checkCircularReference(editingId, parentId, allUnits);
    if (isCircular) {
      return 'Không thể chọn đơn vị này (hoặc đơn vị con/cháu) làm đơn vị cha - sẽ tạo vòng lặp';
    }
  }

  return null;
}

/**
 * Kiểm tra xem có circular reference không (parentId là con/cháu của editingId).
 * @param editingId ID của đơn vị đang sửa
 * @param parentId ID của đơn vị cha muốn chọn
 * @param allUnits Danh sách tất cả đơn vị
 * @returns true nếu có circular reference
 */
export function checkCircularReference(
  editingId: number,
  parentId: number,
  allUnits: Array<{ id: number; parentId: number | null }>,
): boolean {
  // Kiểm tra xem parentId có phải là con/cháu của editingId không
  let currentId: number | null = parentId;
  const visited = new Set<number>();

  while (currentId != null) {
    if (visited.has(currentId)) break; // Prevent infinite loop
    visited.add(currentId);

    // Nếu gặp editingId → circular reference
    if (currentId === editingId) {
      return true;
    }

    const unit = allUnits.find((u) => u.id === currentId);
    if (!unit) break;

    currentId = unit.parentId;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const orgUnitSchema = z
  .object({
    /**
     * Mã đơn vị: theo Wireframe P0 (BA Wireframe P0 - 01 Org Unit), mã được
     * TỰ SINH theo tiền tố cấu hình (CTY-/CN-) qua API generate-code, chỉ xem
     * (không cho nhập tay). 2–20 ký tự, chỉ A-Z, 0-9, _ và -.
     *
     * Optional ở layer schema vì mã được sinh bất đồng bộ từ BE khi mở form
     * tạo mới. Nếu API generate-code thất bại, button Lưu sẽ bị disabled để
     * chặn submit thiếu mã. Khi edit, mã luôn có sẵn từ editing data.
     * Validation format được thực hiện qua refine (bỏ qua nếu empty).
     */
    code: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true; // Cho phép empty khi đang chờ generate code
        return CODE_REGEX.test(val);
      }, 'Mã chỉ gồm chữ in hoa (A-Z), số (0-9), dấu - hoặc _, dài 2–20 ký tự'),
    name: z
      .string()
      .min(1, 'Vui lòng nhập tên đơn vị')
      .max(200, 'Tên đơn vị tối đa 200 ký tự'),
    unitType: z.enum(UNIT_TYPES, {
      message: 'Vui lòng chọn loại đơn vị hợp lệ',
    }),
    /**
     * MST: 10–13 chữ số (chuẩn Việt Nam) hoặc mã tạm dạng TMP-[A-Z0-9]{4,}.
     * Bắt buộc với Công ty mẹ / Công ty con (pháp nhân); optional với Chi nhánh.
     * Validation bắt buộc được enforce trong superRefine theo unitType.
     */
    taxCode: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        // Real MST: 10-13 digits only
        if (TAX_CODE_REGEX.test(val)) return true;
        // TMP: must be generated from server, validated by tmpCodeLocked flag
        // Format check only - actual TMP validation happens in superRefine
        if (TMP_CODE_REGEX.test(val)) return true;
        return false;
      }, 'MST phải là 10–13 chữ số hoặc định dạng TMP-XXXXXX (ít nhất 4 ký tự sau TMP-)'),
    /** Trạng thái MST: 'pending' | 'active' | 'inactive' | null */
    taxCodeStatus: z.string().optional().nullable(),
    /** Hạn cập nhật MST (ISO date string) */
    taxCodeDueDate: z.string().optional().nullable(),
    /** Khoá mã tạm TMP (không cho phép sửa) */
    tmpCodeLocked: z.boolean().optional().nullable(),
    /** Người quản lý (áp dụng cho tất cả các loại đơn vị) */
    managerId: z.number().nullable().optional(),
    email: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        return EMAIL_REGEX.test(val);
      }, 'Email không hợp lệ, chỉ chấp nhận địa chỉ @gmail.com'),
    phone: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        return val.replace(/[\s-]/g, '').length <= PHONE_MAX_LENGTH;
      }, `Số điện thoại không được vượt quá ${PHONE_MAX_LENGTH} ký tự`)
      .refine((val) => {
        if (!val) return true;
        return PHONE_REGEX.test(val.replace(/[\s-]/g, ''));
      }, 'Số điện thoại không hợp lệ (định dạng: 0xxxxxxxxx, đầu số 03/05/07/08/09)'),
    /** Địa chỉ cụ thể (số nhà, tên đường...) — BE field `address`, bắt buộc. */
    address: z.string().min(1, 'Vui lòng nhập địa chỉ cụ thể'),
    /**
     * P1.4: Tỉnh/Thành phố & Phường/Xã bắt buộc với Chi nhánh (gắn với một địa điểm cụ thể);
     * optional với Công ty mẹ/con (pháp nhân, không nhất thiết gắn 1 tỉnh/phường cụ thể).
     * Validation bắt buộc theo unitType được enforce trong superRefine.
     *
     * Sau sáp nhập 07/2025, Việt Nam không còn cấp Quận/Huyện — chỉ còn
     * Tỉnh/Thành phố và Phường/Xã. `ward` map thẳng sang field `ward` của BE.
     * BE field `district` không còn được FE thu thập/gửi lên (chỉ dùng tạm
     * trong UI tra cứu "biết địa chỉ cũ" để thu hẹp danh sách phường/xã cũ,
     * xem OrgUnitFormModal.tsx).
     */
    province: z.string().optional(),
    ward: z.string().optional(),
    /**
     * Chế độ nhập địa chỉ trên UI (không gửi lên BE, xem toPayload):
     * 'legacy' = đang tra cứu địa chỉ cũ (trước sáp nhập) — 2 ô Tỉnh/Thành
     * phố và Phường/Xã bị khoá, không cho gõ tay, chỉ điền qua bước tra cứu.
     * Vì vậy không bắt buộc phải có giá trị ở chế độ này (xem superRefine).
     */
    addressMode: z.enum(['current', 'legacy']).optional(),
    parentId: z.number().nullable().optional(),
    active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // ── Parent validation ──
    // Công ty mẹ không được có đơn vị cha
    if (data.unitType === 'cong_ty_me' && data.parentId != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['parentId'],
        message: 'Công ty mẹ không được phép chọn đơn vị cha',
      });
    }

    // Công ty con và Chi nhánh bắt buộc phải có đơn vị cha
    if (data.unitType !== 'cong_ty_me' && !data.parentId) {
      ctx.addIssue({
        code: 'custom',
        path: ['parentId'],
        message: 'Vui lòng chọn đơn vị cha',
      });
    }

    // P1.4: Chi nhánh bắt buộc chọn Tỉnh/Thành phố và Phường/Xã — bỏ qua khi
    // đang ở chế độ tra cứu địa chỉ cũ vì 2 ô này bị khoá, không cho gõ tay.
    if (data.unitType === 'chi_nhanh' && data.addressMode !== 'legacy') {
      if (!data.province) {
        ctx.addIssue({
          code: 'custom',
          path: ['province'],
          message: 'Chi nhánh bắt buộc chọn Tỉnh/Thành phố',
        });
      }
      if (!data.ward) {
        ctx.addIssue({
          code: 'custom',
          path: ['ward'],
          message: 'Chi nhánh bắt buộc chọn Phường/Xã',
        });
      }
    }

    // MST bắt buộc với pháp nhân (Công ty mẹ / Công ty con)
    if (
      (data.unitType === 'cong_ty_me' || data.unitType === 'cong_ty_con') &&
      !data.taxCode
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['taxCode'],
        message: 'Công ty mẹ / con bắt buộc nhập MST hoặc mã tạm TMP-XXXXXX',
      });
    }

    // MST format validation: nếu có giá trị, phải đúng format
    if (data.taxCode && data.taxCode.length > 0) {
      // Real MST: must be exactly 10-13 digits
      if (
        !data.taxCode.startsWith('TMP-') &&
        !TAX_CODE_REGEX.test(data.taxCode)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['taxCode'],
          message: 'MST phải gồm 10–13 chữ số',
        });
      }
    }

    // Mã tạm TMP bắt buộc có status, due date và locked (P0.2)
    if (data.taxCode && data.taxCode.startsWith('TMP-')) {
      // TMP must have tmpCodeLocked=true (server-generated only)
      if (data.tmpCodeLocked !== true) {
        ctx.addIssue({
          code: 'custom',
          path: ['taxCode'],
          message:
            'Mã TMP chỉ hợp lệ nếu được sinh từ server (tmpCodeLocked=true)',
        });
      }
      // TMP must have pending status
      if (data.taxCodeStatus !== 'pending') {
        ctx.addIssue({
          code: 'custom',
          path: ['taxCodeStatus'],
          message: 'Mã tạm TMP bắt buộc trạng thái là Chờ cập nhật (pending)',
        });
      }
      // TMP must have due date
      if (!data.taxCodeDueDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['taxCodeDueDate'],
          message: 'Mã tạm TMP bắt buộc phải có hạn cập nhật',
        });
      }
    }
  })
  .refine(
    (data) => {
      // Tax code format validation: 10-13 digits or TMP-XXXX
      if (!data.taxCode || data.taxCode.trim() === '') {
        return true; // Optional for branches
      }
      return (
        TAX_CODE_REGEX.test(data.taxCode) || TMP_CODE_REGEX.test(data.taxCode)
      );
    },
    {
      message:
        'MST phải là 10–13 chữ số hoặc định dạng TMP-XXXXXX (ít nhất 4 ký tự sau TMP-)',
      path: ['taxCode'],
    },
  );

export type OrgUnitFormValues = z.infer<typeof orgUnitSchema>;
