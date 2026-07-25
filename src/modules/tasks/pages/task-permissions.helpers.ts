import { useMemo } from 'react';
import type { Task } from '@/modules/tasks/services/tasks.service';
import type { Department } from '@/modules/departments/types/departments.types';
import { usePermissionState, hasPermission } from '@/modules/auth/utils/permission';

/**
 * Lưu ý ID: `dept.managerId` là **employee id** (map từ `manager_employee_id`
 * ở BE, xem `departments.mapper.ts`), còn `currentUser.id` là **user id**.
 * Hai không gian ID khác nhau — không được so sánh trực tiếp
 * `dept.managerId === currentUser.id` (bug đã xảy ra, xem docs/CHANGELOG.md).
 * Luôn quy đổi qua `currentEmployeeId` (tra trong `employees` theo
 * `e.user_id === currentUser.id`) trước khi so với `managerId`.
 */

/**
 * P0 Fix: Kết hợp RBAC + Business Rule
 * - Layer 1 (RBAC): Kiểm tra permission code trước (TASK_EDIT, TASK_APPROVE, etc.)
 * - Layer 2 (Business Rule): Kiểm tra điều kiện nghiệp vụ (status, assignee, etc.)
 *
 * Cả 2 layer phải đều pass thì mới cho phép thực hiện action.
 */

/**
 * Kiểm tra quyền bắt đầu task (combine RBAC + business rule)
 * RBAC: Cần TASK_EDIT
 * Business: status === 'new' | 'assigned' && (assignee_id === currentEmployeeId || assignee_dept_id trong phòng ban)
 *
 * `assignee_id` là **employee id** (xác nhận qua API thật `GET /tasks`:
 * `assignee: { id, code: "NV...", full_name, ... }` — shape Employee, không
 * phải User), nên phải so với `currentEmployeeId`, KHÔNG so với
 * `currentUserId` (2 không gian ID khác nhau, xem comment đầu file).
 */
export function canStartTask(
  item: Pick<Task, 'status' | 'assignee_id' | 'assignee_dept_id'>,
  currentEmployeeId: number | null | undefined,
  currentUserDeptIds: number[] = [],
  hasTaskEditPermission: boolean = false,
): boolean {
  // Layer 1: RBAC check
  if (!hasTaskEditPermission) {
    return false;
  }

  // Layer 2: Business rule check
  if (item.status !== 'new' && item.status !== 'assigned') return false;

  // assignee_id là employee id — so với currentEmployeeId
  if (item.assignee_id != null && item.assignee_id === currentEmployeeId) {
    return true;
  }

  // Task giao thẳng cho phòng ban (chưa chỉ định người nhận cụ thể): cho
  // phép bất kỳ thành viên nào của phòng ban đó tự nhận/bắt đầu việc, nhưng
  // vẫn chặn người ngoài phòng ban (item.assignee_dept_id không nằm trong
  // currentUserDeptIds).
  if (item.assignee_id == null && item.assignee_dept_id != null) {
    return currentUserDeptIds.includes(item.assignee_dept_id);
  }

  return false;
}

/**
 * Kiểm tra quyền gửi duyệt task (combine RBAC + business rule)
 * RBAC: Cần TASK_EDIT
 * Business: status === 'processing' && assignee_id === currentEmployeeId
 *   hoặc status === 'rejected' && assignee_id === currentEmployeeId
 *   (theo BA BF-06: nếu bị từ chối, công việc quay về Đang xử lý để người
 *   nhận sửa và gửi duyệt lại)
 *
 * Lưu ý: BE hiện dùng status 'rejected' và FE đã cho phép submit lại từ
 * rejected. Điều này khớp với BA BF-06 (quay về Đang xử lý) ở mức độ
 * nghiệp vụ: người nhận vẫn có thể sửa và gửi duyệt lại sau khi bị từ chối.
 *
 * `assignee_id` là employee id (xem ghi chú ở `canStartTask`) — so với
 * `currentEmployeeId`, không so với `currentUserId`.
 */
export function canSubmitTaskReview(
  item: Pick<Task, 'status' | 'assignee_id'>,
  currentEmployeeId: number | null | undefined,
  hasTaskEditPermission: boolean = false,
): boolean {
  // Layer 1: RBAC check
  if (!hasTaskEditPermission) {
    return false;
  }

  // Layer 2: Business rule check
  // Cho phép gửi duyệt lại nếu:
  // - Đang xử lý (processing): gửi duyệt lần đầu
  // - Bị từ chối (rejected): sửa và gửi duyệt lại (BA BF-06)
  //   Lưu ý: BE giữ status 'rejected', không tự động chuyển về 'processing'
  //   khi reject, nhưng FE vẫn cho phép người nhận sửa và gửi duyệt lại
  //   từ trạng thái rejected — đây là behavior đúng theo nghiệp vụ.
  if (item.status !== 'processing' && item.status !== 'rejected') {
    return false;
  }

  return item.assignee_id != null && item.assignee_id === currentEmployeeId;
}

/**
 * Kiểm tra quyền duyệt/từ chối task (combine RBAC + business rule)
 * RBAC: Cần TASK_APPROVE
 * Business — người duyệt theo đúng BA baseline, CHỈ 2 trường hợp:
 *   1. approver_id được chỉ định thủ công khi giao việc; hoặc
 *   2. Trưởng phòng ban nhận (assignee_dept_id → dept.managerId).
 *   - Người nhận không bao giờ được tự duyệt việc của mình.
 *   - KHÔNG có fallback cho người giao việc (creator) hay Super Admin khi
 *     phòng ban chưa có trưởng phòng — rule đó do FE tự bổ sung trước đây,
 *     chưa được BA xác nhận (P1.5) nên đã bỏ. Khi phòng ban chưa cấu hình
 *     trưởng phòng và task không có approver_id, task này COI NHƯ CHƯA CÓ
 *     người duyệt hợp lệ — phải chặn ngay từ bước tạo/giao việc (xem
 *     `TasksPage.handleCreate`), không tự động chuyển quyền duyệt.
 *
 * Không gian ID (xác nhận qua API thật `GET /tasks`, evidence 2026-07-14):
 *   - `assignee_id`, `approver_id` → **employee id** (relation trả về shape
 *     Employee: `{ id, code: "NV...", full_name, user_id, ... }`; có case
 *     thực tế approver có `user_id: null` — vẫn hợp lệ vì so sánh dựa trên
 *     employee id, không cần approver có tài khoản đăng nhập).
 *   Do đó `assignee_id`/`approver_id` phải so với `currentEmployeeId`,
 *   `managerId` (Department) cũng là employee id — không được so với
 *   `currentUserId`.
 */
export function canApproveRejectTask(
  item: Pick<
    Task,
    'status' | 'assignee_id' | 'approver_id' | 'assignee_dept_id'
  >,
  currentEmployeeId: number | null | undefined,
  departments: Pick<Department, 'id' | 'managerId'>[],
  hasTaskApprovePermission: boolean = false,
): boolean {
  // Layer 1: RBAC check
  if (!hasTaskApprovePermission) {
    return false;
  }

  // Layer 2: Business rule check
  if (item.status !== 'pending_approval') return false;

  // Chặn cứng: người nhận không được tự duyệt việc của mình
  // (assignee_id là employee id → so với currentEmployeeId)
  if (item.assignee_id != null && item.assignee_id === currentEmployeeId) {
    return false;
  }

  // 1. Nếu chỉ định người duyệt cụ thể (approver_id là employee id → so với
  // currentEmployeeId, KHÔNG so với currentUserId)
  if (item.approver_id != null) {
    return item.approver_id === currentEmployeeId;
  }

  // 2. Mặc định: trưởng phòng ban nhận (managerId là employee id → so với
  // currentEmployeeId, KHÔNG so với currentUserId)
  if (item.assignee_dept_id != null) {
    const dept = departments.find((d) => d.id === item.assignee_dept_id);
    if (dept && dept.managerId != null) {
      return dept.managerId === currentEmployeeId;
    }
  }

  // Không có approver_id và không xác định được trưởng phòng: KHÔNG fallback
  // cho creator/Super Admin (P1.5) — task này không có ai được duyệt.
  return false;
}

/**
 * Kiểm tra quyền hủy task (combine RBAC + business rule)
 * RBAC: Cần TASK_EDIT
 * Business: task chưa kết thúc (không phải completed/cancel)
 * Theo wireframe P0: người giao, trưởng phòng, quản lý chi nhánh đều có quyền hủy
 * (role nào có TASK_EDIT thì có thể hủy task chưa kết thúc)
 *
 * TODO (P2.5, chưa xử lý — cần BA chốt rule trước khi sửa): hiện tại BẤT KỲ
 * ai có quyền TASK_EDIT đều hủy được MỌI task đang mở trong scope của họ,
 * không kiểm tra người đó có phải người giao (creator_id), trưởng phòng của
 * assignee_dept, quản lý chi nhánh, hay designated owner hay không — phạm vi
 * đang rộng hơn ý định nghiệp vụ thật. KHÔNG tự thêm điều kiện thu hẹp ở đây
 * khi chưa có xác nhận cụ thể từ BA về việc ai được hủy — bài học từ P1.5
 * (rule fallback người duyệt do FE tự bổ sung, không khớp baseline BA).
 */
export function canCancelTask(
  item: Pick<Task, 'status'>,
  hasTaskEditPermission: boolean = false,
): boolean {
  // Layer 1: RBAC check
  if (!hasTaskEditPermission) return false;

  // Layer 2: Business rule - chỉ hủy task chưa kết thúc
  return item.status !== 'completed' && item.status !== 'cancel';
}

/**
 * Hook lấy task permissions một lần ở top-level (RBAC layer).
 * Dùng trong TasksPage để tránh gọi usePermissionState nhiều lần.
 *
 * Returns:
 * - canCreate: TASK_CREATE
 * - canEdit: TASK_EDIT
 * - canApprove: TASK_APPROVE
 * - canDelete: TASK_DELETE
 * - canExport: TASK_EXPORT
 */
export function useTaskPermissions() {
  const state = usePermissionState();

  return useMemo(
    () => ({
      canCreate: hasPermission('TASK_CREATE', state),
      canEdit: hasPermission('TASK_EDIT', state),
      canApprove: hasPermission('TASK_APPROVE', state),
      canDelete: hasPermission('TASK_DELETE', state),
      canExport: hasPermission('TASK_EXPORT', state),
    }),
    [state],
  );
}
