import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http } from '@/shared/api/http';

vi.mock('@/shared/api/http', () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const { userRoleScopesService } =
  await import('@/modules/roles/services/user-role-scopes.service');

// P1: BE thật (test trực tiếp 2026-07-04) KHÔNG nhận `scope_id` chung cho
// POST /user-data-scopes — bắt buộc đúng field theo scope_type
// (org_unit_id/department_id/warehouse_id), gửi `scope_id` luôn bị từ chối
// 400 VALIDATION_FAILED. Đây là bug thật (tính năng "Thêm phạm vi dữ liệu"
// luôn lỗi trên BE thật), không chỉ là thiếu evidence — test này khoá lại
// hành vi đã sửa.
describe('userRoleScopesService.addDataScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scope_type=warehouse → gửi warehouse_id, không gửi scope_id', async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: 1,
      user_id: 2,
      scope_type: 'kho',
      warehouse_id: 5,
      org_unit_id: null,
      department_id: null,
      allow: true,
      effect: 'allow',
      status: 1,
    });

    await userRoleScopesService.addDataScope({
      user_id: 2,
      scope_type: 'warehouse',
      scope_id: 5,
      allow: true,
      reason: 'Test',
    });

    expect(http.post).toHaveBeenCalledWith(
      '/user-data-scopes',
      expect.objectContaining({ warehouse_id: 5, scope_type: 'kho' }),
    );
    const [, body] = vi.mocked(http.post).mock.calls[0];
    expect(body).not.toHaveProperty('scope_id');
  });

  it('scope_type=department → gửi department_id, không gửi scope_id', async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: 2,
      user_id: 2,
      scope_type: 'phong_ban',
      department_id: 3,
      org_unit_id: null,
      warehouse_id: null,
      allow: true,
      effect: 'allow',
      status: 1,
    });

    await userRoleScopesService.addDataScope({
      user_id: 2,
      scope_type: 'department',
      scope_id: 3,
      allow: true,
    });

    expect(http.post).toHaveBeenCalledWith(
      '/user-data-scopes',
      expect.objectContaining({ department_id: 3, scope_type: 'phong_ban' }),
    );
    const [, body] = vi.mocked(http.post).mock.calls[0];
    expect(body).not.toHaveProperty('scope_id');
  });

  it('scope_type=org_unit → gửi org_unit_id, không gửi scope_id', async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: 3,
      user_id: 2,
      scope_type: 'chi_nhanh',
      org_unit_id: 7,
      department_id: null,
      warehouse_id: null,
      allow: true,
      effect: 'allow',
      status: 1,
    });

    await userRoleScopesService.addDataScope({
      user_id: 2,
      scope_type: 'org_unit',
      scope_id: 7,
      allow: true,
    });

    const [, body] = vi.mocked(http.post).mock.calls[0];
    expect(body).toMatchObject({ org_unit_id: 7, scope_type: 'chi_nhanh' });
    expect(body).not.toHaveProperty('scope_id');
  });

  it('scope_type=company → gửi org_unit_id (BE dùng chung field với org_unit)', async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: 4,
      user_id: 2,
      scope_type: 'cong_ty',
      org_unit_id: 1,
      department_id: null,
      warehouse_id: null,
      allow: true,
      effect: 'allow',
      status: 1,
    });

    await userRoleScopesService.addDataScope({
      user_id: 2,
      scope_type: 'company',
      scope_id: 1,
      allow: true,
    });

    const [, body] = vi.mocked(http.post).mock.calls[0];
    expect(body).toMatchObject({ org_unit_id: 1, scope_type: 'cong_ty' });
  });

  it('response trả về được chuẩn hoá lại thành scope_id cho UI dùng chung', async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: 5,
      user_id: 2,
      scope_type: 'kho',
      warehouse_id: 9,
      org_unit_id: null,
      department_id: null,
      allow: true,
      effect: 'allow',
      status: 1,
    });

    const result = await userRoleScopesService.addDataScope({
      user_id: 2,
      scope_type: 'warehouse',
      scope_id: 9,
      allow: true,
    });

    expect(result.scope_id).toBe(9);
    expect(result.scope_type).toBe('warehouse');
  });
});

describe('userRoleScopesService.getUserDataScopes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chuẩn hoá org_unit_id/department_id/warehouse_id (BE trả riêng) về scope_id chung', async () => {
    vi.mocked(http.get).mockResolvedValue([
      {
        id: 1,
        user_id: 2,
        scope_type: 'kho',
        warehouse_id: 5,
        org_unit_id: null,
        department_id: null,
        allow: true,
        status: 1,
      },
      {
        id: 2,
        user_id: 2,
        scope_type: 'phong_ban',
        department_id: 3,
        org_unit_id: null,
        warehouse_id: null,
        allow: true,
        status: 1,
      },
    ]);

    const result = await userRoleScopesService.getUserDataScopes(2);

    expect(result[0]).toMatchObject({ scope_type: 'warehouse', scope_id: 5 });
    expect(result[1]).toMatchObject({ scope_type: 'department', scope_id: 3 });
  });
});

// P1: DELETE /user-role-scopes/{id} và DELETE /user-data-scopes/{id} —
// test trực tiếp trên BE (2026-07-04) xác nhận response thật là
// `{ data: null }`, KHÔNG phải bản ghi kèm revoked_by/revoked_at/status:0
// như docs từng ghi trước đây. Response type ở service là `unknown` — FE
// không dựa vào response mà tự refetch lại danh sách, nên không cần thay đổi
// code, chỉ cần khoá lại kỳ vọng gọi đúng endpoint.
describe('userRoleScopesService.revokeRoleFromUser / revokeDataScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokeRoleFromUser gọi DELETE /user-role-scopes/{id}', async () => {
    vi.mocked(http.delete).mockResolvedValue(null);
    await userRoleScopesService.revokeRoleFromUser(15);
    expect(http.delete).toHaveBeenCalledWith('/user-role-scopes/15');
  });

  it('revokeDataScope gọi DELETE /user-data-scopes/{id}', async () => {
    vi.mocked(http.delete).mockResolvedValue(null);
    await userRoleScopesService.revokeDataScope(42);
    expect(http.delete).toHaveBeenCalledWith('/user-data-scopes/42');
  });

  // Thu hồi vai trò kèm lý do (AC yêu cầu audit): reason phải được gửi
  // trong `data.reason` của request DELETE, không phải body trần.
  it('revokeRoleFromUser có reason → gửi kèm { data: { reason } }', async () => {
    vi.mocked(http.delete).mockResolvedValue(null);
    await userRoleScopesService.revokeRoleFromUser(15, 'Nghỉ việc');
    expect(http.delete).toHaveBeenCalledWith('/user-role-scopes/15', {
      data: { reason: 'Nghỉ việc' },
    });
  });

  it('revokeDataScope có reason → gửi kèm { data: { reason } }', async () => {
    vi.mocked(http.delete).mockResolvedValue(null);
    await userRoleScopesService.revokeDataScope(42, 'Chuyển kho');
    expect(http.delete).toHaveBeenCalledWith('/user-data-scopes/42', {
      data: { reason: 'Chuyển kho' },
    });
  });
});

// P1: gán vai trò theo phạm vi kho — payload PUT /users/{user_id}/role-scopes
// phải map đúng scope_type='kho' + warehouse_id, không lẫn với org_unit/department.
describe('userRoleScopesService.assignRoleToUser — phạm vi kho', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gán role kèm warehouse_id → grants gửi scope_type=kho, warehouse_id đúng', async () => {
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });
    vi.mocked(http.put).mockResolvedValue({});

    await userRoleScopesService.assignRoleToUser({
      user_id: 2,
      role_id: 9,
      scope_type: 'warehouse',
      warehouse_id: 5,
    });

    expect(http.put).toHaveBeenCalledWith('/users/2/role-scopes', {
      grants: [
        expect.objectContaining({
          role_id: 9,
          scope_type: 'kho',
          warehouse_id: 5,
          org_unit_id: null,
          department_id: null,
        }),
      ],
    });
  });

  it('giữ nguyên các grant hiện có (chưa thu hồi) khi thêm grant kho mới', async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: 1,
          user_id: 2,
          role_id: 3,
          scope_type: 'department',
          department_id: 4,
          org_unit_id: null,
          warehouse_id: null,
        },
      ],
      meta: {},
    });
    vi.mocked(http.put).mockResolvedValue({});

    await userRoleScopesService.assignRoleToUser({
      user_id: 2,
      role_id: 9,
      scope_type: 'warehouse',
      warehouse_id: 5,
    });

    const [, body] = vi.mocked(http.put).mock.calls[0];
    expect((body as { grants: unknown[] }).grants).toHaveLength(2);
    expect((body as { grants: unknown[] }).grants[0]).toMatchObject({
      role_id: 3,
      scope_type: 'phong_ban',
      department_id: 4,
    });
  });
});

// P1: direct deny theo kho — addDataScope với allow=false phải gửi
// effect='deny' và warehouse_id đúng field, phản ánh đúng ý nghĩa "cấm truy cập kho X".
describe('userRoleScopesService.addDataScope — direct deny theo kho', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allow=false, scope_type=warehouse → gửi effect=deny, warehouse_id', async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: 6,
      user_id: 2,
      scope_type: 'kho',
      warehouse_id: 8,
      org_unit_id: null,
      department_id: null,
      allow: false,
      effect: 'deny',
      status: 1,
    });

    await userRoleScopesService.addDataScope({
      user_id: 2,
      scope_type: 'warehouse',
      scope_id: 8,
      allow: false,
      reason: 'Cấm truy cập kho tạm ngưng hoạt động',
    });

    expect(http.post).toHaveBeenCalledWith(
      '/user-data-scopes',
      expect.objectContaining({
        warehouse_id: 8,
        scope_type: 'kho',
        effect: 'deny',
      }),
    );
  });
});

// P1: hết hạn direct scope — getUserDataScopes chỉ chuẩn hoá dữ liệu, UI dựa
// vào effective_to để hiển thị hết hạn; test khoá lại là effective_to được
// truyền qua nguyên vẹn (không bị service làm rơi field khi map response).
describe('userRoleScopesService.getUserDataScopes — hết hạn direct scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('giữ nguyên effective_to đã qua hạn để UI tự đánh giá hết hạn', async () => {
    vi.mocked(http.get).mockResolvedValue([
      {
        id: 7,
        user_id: 2,
        scope_type: 'kho',
        warehouse_id: 5,
        org_unit_id: null,
        department_id: null,
        allow: true,
        status: 1,
        effective_from: '2025-01-01',
        effective_to: '2025-06-30',
      },
    ]);

    const result = await userRoleScopesService.getUserDataScopes(2);

    expect(result[0]).toMatchObject({
      effective_from: '2025-01-01',
      effective_to: '2025-06-30',
    });
  });
});
