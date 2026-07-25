import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Tag,
  DatePicker,
  Table,
} from 'antd';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  PlusOutlined,
  PlayCircleOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  PageHeader,
  ApiErrorAlert,
  EmptyState,
  ActionDropdown,
  useSortTooltipColumns,
  confirmDialog,
} from '@/shared/components';
import { useFormDraft } from '@/shared/hooks/useFormDraft';
import { PermissionGuard } from '@/shared/components/permission';
import { TopPagination } from '@/shared/components/data-display/TopPagination';
import { PageSizeSelector } from '@/shared/components/data-display/PageSizeSelector';
import type { ActionItem } from '@/shared/components';
import {
  useTasks,
  useTask,
  useCreateTask,
  useStartTask,
  useSubmitTaskForReview,
  useApproveTask,
  useRejectTask,
  useCancelTask,
} from '@/modules/tasks/hooks/use-tasks';
import { useDepartments } from '@/modules/departments/hooks/use-departments';
import { useEmployees } from '@/modules/employees/hooks/use-employees';
import { AccountStatus } from '@/modules/employees/types/employees.types';
import type { Employee } from '@/modules/employees/types/employees.types';
import { ROUTES } from '@/shared/constants/routes';
import { getMutationErrorMessage } from '@/shared/api/api-error';
import { useAuthStore } from '@/shared/store/auth.store';
import { formatDate } from '@/shared/utils/format-date';
import { TaskDetailDrawer } from '@/modules/tasks/components/TaskDetailDrawer';
import {
  canStartTask,
  canSubmitTaskReview,
  canApproveRejectTask,
  canCancelTask,
  useTaskPermissions,
} from '@/modules/tasks/pages/task-permissions.helpers';
import type {
  CreateTaskPayload,
  Task,
} from '@/modules/tasks/services/tasks.service';

const { TextArea } = Input;

const PRIORITY_OPTIONS = [
  { value: 'P2', label: 'Trung bình (P2)' },
  { value: 'P1', label: 'Cao (P1)' },
  { value: 'P0', label: 'Khẩn cấp (P0)' },
];

const getPriorityTag = (priority: string) => {
  const map: Record<string, { color: string; text: string }> = {
    high: { color: 'red', text: 'Cao' },
    medium: { color: 'orange', text: 'Trung bình' },
    low: { color: 'default', text: 'Thấp' },
    P0: { color: 'red', text: 'Khẩn cấp (P0)' },
    P1: { color: 'orange', text: 'Cao (P1)' },
    P2: { color: 'default', text: 'Trung bình (P2)' },
  };
  const p = map[priority] || { color: 'default', text: priority };
  return <Tag color={p.color}>{p.text}</Tag>;
};

const getStatusTag = (status: string, isOverdue?: boolean) => {
  const map: Record<string, { color: string; text: string }> = {
    new: { color: 'default', text: 'Mới tạo' },
    assigned: { color: 'processing', text: 'Đã giao' },
    processing: { color: 'blue', text: 'Đang xử lý' },
    pending_approval: { color: 'warning', text: 'Chờ duyệt' },
    completed: { color: 'success', text: 'Hoàn thành' },
    rejected: { color: 'error', text: 'Từ chối' },
    cancel: { color: 'default', text: 'Đã hủy' },
    overdue: { color: 'error', text: 'Quá hạn' },
  };
  // Quá hạn là trạng thái hiển thị (theo wireframe P0 section I)
  if (isOverdue && status !== 'completed' && status !== 'cancel') {
    return <Tag color="error">⏱ Quá hạn</Tag>;
  }
  const s = map[status] || map.new;
  return <Tag color={s.color}>{s.text}</Tag>;
};

export function TasksPage() {
  const { modal } = App.useApp();
  const [form] = Form.useForm();
  const assignTarget = Form.useWatch('assignTarget', form) || 'user';
  const [open, setOpen] = useState(false);
  const taskDraft = useFormDraft<Record<string, unknown>>('task-create');
  const taskSubmittedRef = useRef(false);
  const taskAutosaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [deptFilter, setDeptFilter] = useState<number | undefined>(undefined);
  const [assigneeFilter, setAssigneeFilter] = useState<number | undefined>(
    undefined,
  );
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingTaskId, setRejectingTaskId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelingTask, setCancelingTask] = useState<Task | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const currentUser = useAuthStore((s) => s.user);

  // P0: Lấy task permissions một lần ở top-level (RBAC layer)
  const taskPerms = useTaskPermissions();

  // BE không lưu "overdue" như một trạng thái cứng của task (status thực tế
  // chỉ gồm new/assigned/processing/pending_approval/completed/rejected/cancel).
  // "Quá hạn" là cờ tính toán phía FE dựa trên due_date + status chưa kết thúc
  // (xem is_overdue trong tasks.service.ts), nên không được gửi status=overdue
  // lên BE — phải lọc client-side theo is_overdue sau khi có dữ liệu.
  const isOverdueFilter = statusFilter === 'overdue';

  const {
    data: tasksResponse,
    isLoading,
    error,
    refetch,
  } = useTasks({
    page,
    per_page: perPage,
    status:
      isOverdueFilter || statusFilter === 'all' ? undefined : statusFilter,
    keyword: keyword || undefined,
    assignee_id: assigneeFilter,
    assignee_dept_id: deptFilter,
  });

  // Lấy chi tiết mới nhất từ BE khi drawer mở, tránh hiển thị dữ liệu
  // stale/thiếu field so với item lấy từ list response (xem handleViewDetail).
  const { data: taskDetail, isFetching: taskDetailLoading } = useTask(
    detailOpen && selectedTask ? selectedTask.id : null,
  );
  // taskDetail (GET /tasks/{id}) luôn mới/đầy đủ hơn dữ liệu list nên ưu tiên
  // hiển thị nó khi đã có, tránh phải setState trong effect (xem handleViewDetail).
  const displayedTask = taskDetail ?? selectedTask;

  const { data: departments = [] } = useDepartments();
  const { data: employees = [] } = useEmployees({ include_assignments: true });

  const createTaskMutation = useCreateTask();
  const startTaskMutation = useStartTask();
  const submitReviewMutation = useSubmitTaskForReview();
  const approveTaskMutation = useApproveTask();
  const rejectTaskMutation = useRejectTask();
  const cancelTaskMutation = useCancelTask();

  // Phòng ban và người nhận đều gửi lên BE lọc server-side (assignee_id đã
  // xác nhận qua Swagger; assignee_dept_id không có trong Swagger nhưng đã
  // verify hoạt động thật trên BE, xem TaskListParams). Chỉ "Quá hạn" là cờ
  // tính toán ở FE (is_overdue) nên buộc phải lọc client-side sau khi fetch —
  // xem comment isOverdueFilter phía trên.
  const tasks = useMemo(() => {
    const data = tasksResponse?.data ?? [];
    if (isOverdueFilter) {
      return data.filter((t) => t.is_overdue);
    }
    return data;
  }, [tasksResponse, isOverdueFilter]);
  // Khi lọc "Quá hạn", is_overdue chỉ được lọc trên trang dữ liệu hiện tại
  // (BE không có filter tương đương) nên total/phân trang không thể lấy từ
  // meta của BE trong trường hợp này.
  const total = isOverdueFilter
    ? tasks.length
    : (tasksResponse?.meta?.total ?? 0);

  // Xác nhận trực tiếp trên BE thật (astrodev.test8.io.vn, 2026-07-14): relation
  // `assignee`/`approver` trả kèm trong task response có shape Employee (code,
  // cccd, gender, employee_status, manager_id...), không phải User. Đã kiểm
  // chứng bằng task thật có approver_id trùng employee.id nhưng employee đó có
  // user_id = null (nhân viên không có tài khoản đăng nhập) — nếu approver_id
  // là user id thì trường hợp này không thể tồn tại. Vậy `to_user_id` (gửi lên
  // như assignee_id) và `approver_id` phải chọn từ danh sách employee, không
  // phải user, nếu không FE sẽ gửi sai ID-space lên BE.
  const employeeOptions = useMemo(
    () =>
      employees
        .filter(
          (e) =>
            e.status === 1 && e.employeeStatus !== 3 && e.employeeStatus !== 4,
        )
        .map((e) => ({
          value: e.id,
          label: `${e.fullName} (${e.code})`,
        })),
    [employees],
  );

  // P0.3: Nhân sự không có tài khoản (user_id null) hoặc tài khoản bị khóa
  // không thể đăng nhập để start/submit/approve — nếu vẫn cho chọn làm
  // "Người thực hiện"/"Người duyệt chỉ định", workflow sẽ treo vĩnh viễn.
  // Không loại hẳn khỏi danh sách (vẫn cần thấy để biết lý do) mà disable +
  // gắn nhãn rõ, kèm CTA sang trang Nhân sự để cấp tài khoản.
  const hasUsableAccount = (e: Employee) =>
    e.user_id != null && e.accountStatus === AccountStatus.ACTIVE;

  const assignableEmployeeOptions = useMemo(
    () =>
      employees
        .filter(
          (e) =>
            e.status === 1 && e.employeeStatus !== 3 && e.employeeStatus !== 4,
        )
        .map((e) => {
          const usable = hasUsableAccount(e);
          return {
            value: e.id,
            label: usable
              ? `${e.fullName} (${e.code})`
              : `${e.fullName} (${e.code}) — Chưa có tài khoản, không thể giao việc`,
            disabled: !usable,
          };
        }),
    [employees],
  );

  // Chỉ hiển thị phòng ban đang hoạt động (active) để tránh giao việc / lọc
  // theo phòng ban đã ngừng hoạt động.
  const departmentOptions = useMemo(
    () =>
      departments
        .filter((d) => d.active)
        .map((d) => ({
          value: d.id,
          label: `${d.code} — ${d.name}`,
        })),
    [departments],
  );

  // Employee tương ứng với currentUser (managerId của Department là employee id,
  // không phải user id, nên cần map qua employees để so sánh đúng)
  const currentEmployeeId = useMemo(() => {
    if (!currentUser) return null;
    return employees.find((e) => e.user_id === currentUser.id)?.id ?? null;
  }, [currentUser, employees]);

  // Danh sách phòng ban hiện tại của currentUser
  const myDepartments = useMemo(() => {
    if (!currentUser) return [];
    const emp = employees.find((e) => e.user_id === currentUser.id);
    if (!emp || !emp.assignments) return [];
    return emp.assignments
      .map((a) => {
        const dept = departments.find((d) => d.id === a.department_id);
        if (!dept) return null;
        return { value: dept.id, label: dept.name };
      })
      .filter(Boolean) as { value: number; label: string }[];
  }, [currentUser, employees, departments]);

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      const assignTarget =
        (values.assignTarget as 'user' | 'department') || 'user';
      const toUserId =
        assignTarget === 'user' ? (values.to_user_id as number) : undefined;
      const assigneeDeptId =
        assignTarget === 'department'
          ? (values.assignee_dept_id as number)
          : undefined;

      // Chặn cứng ở submit, không chỉ dựa vào dropdown đã lọc active — phòng
      // ban có thể bị deactivate giữa lúc mở form và lúc bấm submit.
      if (assigneeDeptId != null) {
        const dept = departments.find((d) => d.id === assigneeDeptId);
        if (!dept || !dept.active) {
          toast.error(
            'Phòng ban đã chọn không còn hoạt động, vui lòng chọn lại',
          );
          return;
        }
      }

      // P0.3: Chặn cứng ở submit, không chỉ dựa vào option disabled — nhân sự
      // không có tài khoản (hoặc tài khoản bị khóa) không thể start/submit/
      // approve, giao việc cho họ sẽ làm workflow treo vĩnh viễn.
      const approverId = values.approver_id as number | undefined;
      if (toUserId != null) {
        const emp = employees.find((e) => e.id === toUserId);
        if (!emp || !hasUsableAccount(emp)) {
          toast.error(
            'Nhân sự được chọn chưa có tài khoản đăng nhập, không thể giao việc. Vui lòng cấp tài khoản trước.',
          );
          return;
        }
      }
      if (approverId != null) {
        const approver = employees.find((e) => e.id === approverId);
        if (!approver || !hasUsableAccount(approver)) {
          toast.error(
            'Người duyệt được chọn chưa có tài khoản đăng nhập, không thể chỉ định duyệt.',
          );
          return;
        }
      }

      // P1.5: Rule người duyệt theo BA baseline:
      // 1. Nếu chọn approver thủ công → dùng approver_id
      // 2. Nếu không chọn → dùng trưởng phòng của phòng ban nhận
      // 3. Nếu phòng ban không có trưởng phòng → fallback về người giao việc
      //    (creator_id) theo đúng BA, không chặn tạo task.
      //    Lưu ý: creator_id là user id, không phải employee id, nên cần map
      //    qua employees để tìm employee id tương ứng để gửi lên BE.
      if (approverId == null) {
        const targetDeptId =
          assigneeDeptId ??
          (toUserId != null
            ? (employees
                .find((e) => e.id === toUserId)
                ?.assignments?.find((a) => a.is_primary)?.department_id ??
              employees.find((e) => e.id === toUserId)?.assignments?.[0]
                ?.department_id)
            : undefined);
        const targetDept =
          targetDeptId != null
            ? departments.find((d) => d.id === targetDeptId)
            : undefined;

        // Nếu phòng ban có trưởng phòng → dùng trưởng phòng
        if (targetDept && targetDept.managerId != null) {
          // OK - sẽ dùng managerId làm approver
        } else {
          // Phòng ban không có trưởng phòng → fallback về người giao
          // Tìm employee của currentUser (người giao) để gửi làm approver
          const creatorEmployee = employees.find(
            (e) => e.user_id === currentUser?.id,
          );
          if (!creatorEmployee) {
            toast.error(
              'Không xác định được người giao việc. Vui lòng chọn người duyệt thủ công.',
            );
            return;
          }
          // Ghi đè approverId thành creatorEmployee.id (fallback theo BA)
          // Không cần return, tiếp tục tạo task với approver = người giao
        }
      }

      // Tính approver_id cuối cùng theo rule BA:
      // - Nếu người dùng chọn thủ công → dùng approver_id từ form
      // - Nếu không chọn:
      //   + Phòng ban có trưởng phòng → dùng managerId
      //   + Phòng ban không có trưởng phòng → fallback về người giao (creator)
      let finalApproverId = approverId;
      if (finalApproverId == null) {
        const targetDeptId =
          assigneeDeptId ??
          (toUserId != null
            ? (employees
                .find((e) => e.id === toUserId)
                ?.assignments?.find((a) => a.is_primary)?.department_id ??
              employees.find((e) => e.id === toUserId)?.assignments?.[0]
                ?.department_id)
            : undefined);
        const targetDept =
          targetDeptId != null
            ? departments.find((d) => d.id === targetDeptId)
            : undefined;

        if (targetDept && targetDept.managerId != null) {
          // Dùng trưởng phòng
          finalApproverId = targetDept.managerId;
        } else {
          // Fallback về người giao (creator)
          const creatorEmployee = employees.find(
            (e) => e.user_id === currentUser?.id,
          );
          finalApproverId = creatorEmployee?.id ?? undefined;
        }
      }

      const payload: CreateTaskPayload = {
        type: (values.type as 'task' | 'coordination') || 'task',
        title: values.title as string,
        description: (values.description as string) || undefined,
        priority: values.priority as 'P0' | 'P1' | 'P2',
        assignee_id: toUserId,
        assignee_dept_id: assigneeDeptId,
        approver_id: finalApproverId,
        due_date: (values.due_date as dayjs.Dayjs).format(
          'YYYY-MM-DD HH:mm:ss',
        ),
      };
      await createTaskMutation.mutateAsync(payload);
      toast.success('Đã tạo công việc mới');
      taskSubmittedRef.current = true;
      taskDraft.clear();
      setOpen(false);
      form.resetFields();
    } catch (err: unknown) {
      toast.error(getMutationErrorMessage(err));
    }
  };

  const handleStart = (id: number) => {
    modal.confirm({
      title: 'Bắt đầu công việc?',
      content: 'Xác nhận bắt đầu xử lý công việc này?',
      okText: 'Bắt đầu',
      cancelText: 'Hủy',
      onOk: () =>
        startTaskMutation.mutate(id, {
          onSuccess: () => {
            toast.success('Đã bắt đầu xử lý công việc');
            refetch();
          },
          onError: (err) => toast.error(getMutationErrorMessage(err)),
        }),
    });
  };

  const handleSubmitReview = (id: number) => {
    modal.confirm({
      title: 'Gửi duyệt công việc?',
      content: 'Xác nhận đã hoàn thành xử lý và gửi công việc này để duyệt?',
      okText: 'Gửi duyệt',
      cancelText: 'Hủy',
      onOk: () =>
        submitReviewMutation.mutate(id, {
          onSuccess: () => {
            toast.success('Đã gửi yêu cầu duyệt');
            refetch();
          },
          onError: (err) => toast.error(getMutationErrorMessage(err)),
        }),
    });
  };

  const handleApprove = (id: number) => {
    modal.confirm({
      title: 'Duyệt công việc?',
      content: 'Xác nhận hoàn thành và duyệt công việc này?',
      okText: 'Duyệt',
      cancelText: 'Hủy',
      onOk: () =>
        approveTaskMutation.mutate(id, {
          onSuccess: () => {
            toast.success('Đã duyệt công việc');
            refetch();
          },
          onError: (err) => toast.error(getMutationErrorMessage(err)),
        }),
    });
  };

  const handleReject = () => {
    if (!rejectingTaskId) return;
    if (!rejectReason.trim()) return;
    rejectTaskMutation.mutate(
      { id: rejectingTaskId, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          toast.success('Đã từ chối công việc');
          setRejectModalOpen(false);
          setRejectingTaskId(null);
          setRejectReason('');
          refetch();
        },
        onError: (err) => toast.error(getMutationErrorMessage(err)),
      },
    );
  };

  const handleCancel = () => {
    if (!cancelingTask) return;
    cancelTaskMutation.mutate(
      { id: cancelingTask.id, note: cancelReason || undefined },
      {
        onSuccess: () => {
          toast.success('Đã hủy công việc');
          setCancelModalOpen(false);
          setCancelingTask(null);
          setCancelReason('');
          refetch();
        },
        onError: (err) => toast.error(getMutationErrorMessage(err)),
      },
    );
  };

  // Khôi phục dữ liệu đã nhập dở khi mở lại modal tạo công việc
  useEffect(() => {
    if (!open) return;
    taskSubmittedRef.current = false;
    const saved = taskDraft.restore();
    if (saved) {
      form.setFieldsValue({
        ...saved,
        due_date: saved.due_date ? dayjs(saved.due_date as string) : undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closeCreateModal = () => {
    if (taskAutosaveTimerRef.current)
      clearTimeout(taskAutosaveTimerRef.current);
    setOpen(false);
    form.resetFields();
  };

  const saveTaskDraftFromForm = () => {
    const values = form.getFieldsValue();
    taskDraft.save({
      ...values,
      due_date: values.due_date ? values.due_date.format() : undefined,
    });
  };

  // Save draft on unmount if modal is open (user navigates away to another page)
  useEffect(() => {
    return () => {
      if (open && !taskSubmittedRef.current) {
        saveTaskDraftFromForm();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Autosave draft liên tục khi người dùng gõ (debounce) — đảm bảo dữ liệu
  // không mất khi điều hướng sang trang khác trước khi effect unmount ở trên
  // kịp chạy (ví dụ route chuyển trang bằng SPA navigation).
  const handleCreateFormValuesChange = () => {
    if (taskAutosaveTimerRef.current)
      clearTimeout(taskAutosaveTimerRef.current);
    taskAutosaveTimerRef.current = setTimeout(saveTaskDraftFromForm, 400);
  };

  // Bấm nút "Hủy" — hỏi xác nhận nếu đã nhập dữ liệu, xóa draft khi đồng ý
  const handleCreateModalCancel = () => {
    if (form.isFieldsTouched()) {
      confirmDialog({
        title: 'Xác nhận hủy',
        content: 'Bạn có chắc chắn muốn hủy? Dữ liệu đã nhập sẽ bị xóa.',
        okText: 'Đồng ý',
        cancelText: 'Tiếp tục nhập',
        danger: true,
        onOk: () => {
          taskSubmittedRef.current = true;
          taskDraft.clear();
          closeCreateModal();
        },
      });
      return;
    }
    closeCreateModal();
  };

  // Bấm ra ngoài modal / phím Esc / nút X — không hỏi xác nhận, chỉ lưu tạm
  // để mở lại vẫn còn dữ liệu vừa nhập.
  const handleCreateModalDismiss = () => {
    const values = form.getFieldsValue();
    taskDraft.save({
      ...values,
      due_date: values.due_date ? values.due_date.format() : undefined,
    });
    closeCreateModal();
  };

  const handleViewDetail = (task: Task) => {
    // Set trước dữ liệu list để drawer mở ngay không giật, useTask bên dưới
    // sẽ gọi GET /tasks/{id} để lấy dữ liệu mới nhất/đầy đủ hơn và cập nhật
    // lại selectedTask khi có kết quả (tránh hiển thị dữ liệu stale/thiếu
    // field so với response detail thật).
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const handleBulkStart = () => {
    const eligibleIds = selectedTasks.filter(canStart).map((t) => t.id);
    if (eligibleIds.length === 0) return;
    modal.confirm({
      title: 'Bắt đầu công việc',
      content: `Bạn có chắc muốn bắt đầu ${eligibleIds.length} công việc hợp lệ đã chọn?`,
      okText: 'Bắt đầu',
      onOk: () => {
        let completed = 0;
        eligibleIds.forEach((id) => {
          startTaskMutation.mutate(id, {
            onSuccess: () => {
              completed++;
              if (completed === eligibleIds.length) {
                toast.success(`Đã bắt đầu ${eligibleIds.length} công việc`);
                setSelectedRowKeys([]);
                refetch();
              }
            },
            onError: (err) => toast.error(getMutationErrorMessage(err)),
          });
        });
      },
    });
  };

  const handleBulkSubmitReview = () => {
    const eligibleIds = selectedTasks.filter(canSubmitReview).map((t) => t.id);
    if (eligibleIds.length === 0) return;
    modal.confirm({
      title: 'Gửi duyệt công việc',
      content: `Bạn có chắc muốn gửi duyệt ${eligibleIds.length} công việc hợp lệ đã chọn?`,
      okText: 'Gửi duyệt',
      onOk: () => {
        let completed = 0;
        eligibleIds.forEach((id) => {
          submitReviewMutation.mutate(id, {
            onSuccess: () => {
              completed++;
              if (completed === eligibleIds.length) {
                toast.success(`Đã gửi duyệt ${eligibleIds.length} công việc`);
                setSelectedRowKeys([]);
                refetch();
              }
            },
            onError: (err) => toast.error(getMutationErrorMessage(err)),
          });
        });
      },
    });
  };

  // Rule theo Wireframe P0 (BA Wireframe P0 - 10 Task Assignment Approval):
  // "Người duyệt = TP người nhận (hoặc người được chỉ định)";
  // "Người nhận không được tự duyệt việc của mình" — không có fallback cho
  // người giao (from_user_id) tự duyệt. Logic chi tiết + test ở
  // `task-permissions.helpers.ts` (bao gồm lưu ý managerId là employee id).
  const myDepartmentIds = useMemo(
    () => myDepartments.map((d) => d.value),
    [myDepartments],
  );

  // P0: Combine RBAC (taskPerms) + Business Rule (canStartTask)
  // assignee_id là employee id nên truyền currentEmployeeId, không phải
  // currentUser?.id (xem ghi chú không gian ID trong task-permissions.helpers.ts)
  const canStart = (item: Task) =>
    canStartTask(item, currentEmployeeId, myDepartmentIds, taskPerms.canEdit);

  const canSubmitReview = (item: Task) =>
    canSubmitTaskReview(item, currentEmployeeId, taskPerms.canEdit);

  const canApproveReject = (item: Task) =>
    canApproveRejectTask(
      item,
      currentEmployeeId,
      departments,
      taskPerms.canApprove,
    );

  const canCancel = (item: Task) => canCancelTask(item, taskPerms.canEdit);

  const hasSelection = selectedRowKeys.length > 0;

  const selectedTasks = tasks.filter((t) => selectedRowKeys.includes(t.id));

  const columns = [
    {
      title: 'STT',
      key: 'stt_index',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: (typeof tasks)[number], index: number) =>
        (page - 1) * perPage + index + 1,
    },
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      sorter: (a: (typeof tasks)[number], b: (typeof tasks)[number]) =>
        a.code.localeCompare(b.code),
      render: (text: string) => (
        <span style={{ fontSize: 12, color: '#8c887e' }}>{text}</span>
      ),
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      sorter: (a: (typeof tasks)[number], b: (typeof tasks)[number]) =>
        a.title.localeCompare(b.title),
      render: (text: string, record: (typeof tasks)[number]) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {text}
            {record.type === 'coordination' && (
              <Tag color="purple" style={{ marginLeft: 6, fontSize: 10 }}>
                Phối hợp
              </Tag>
            )}
          </div>
          {record.description && (
            <div style={{ fontSize: 12, color: '#8c887e', marginTop: 2 }}>
              {record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Người giao',
      dataIndex: 'creator_name',
      key: 'creator_name',
      width: 160,
      sorter: (a: (typeof tasks)[number], b: (typeof tasks)[number]) =>
        (a.creator_name ?? '').localeCompare(b.creator_name ?? ''),
    },
    {
      title: 'Người nhận',
      dataIndex: 'assignee_name',
      key: 'assignee_name',
      width: 160,
      sorter: (a: (typeof tasks)[number], b: (typeof tasks)[number]) =>
        (a.assignee_name ?? '').localeCompare(b.assignee_name ?? ''),
    },
    {
      title: 'Ưu tiên',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      sorter: (a: (typeof tasks)[number], b: (typeof tasks)[number]) =>
        a.priority.localeCompare(b.priority),
      render: (priority: string) => getPriorityTag(priority),
    },
    {
      title: 'Hạn',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110,
      sortType: 'value' as const,
      sorter: (a: (typeof tasks)[number], b: (typeof tasks)[number]) =>
        new Date(a.due_date ?? 0).getTime() -
        new Date(b.due_date ?? 0).getTime(),
      render: (date: string) => (
        <span style={{ fontSize: 13 }}>{date ? formatDate(date) : '-'}</span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: (a: (typeof tasks)[number], b: (typeof tasks)[number]) =>
        a.status.localeCompare(b.status),
      render: (status: string, record: (typeof tasks)[number]) =>
        getStatusTag(status, record.is_overdue),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      render: (_: unknown, item: (typeof tasks)[number]) => {
        const actionItems: ActionItem[] = [];

        if (canStart(item)) {
          actionItems.push({
            key: 'start',
            icon: <PlayCircleOutlined />,
            label: 'Bắt đầu',
            module: 'tasks',
            action: 'edit',
            onClick: () => handleStart(item.id),
          });
        }

        if (canSubmitReview(item)) {
          actionItems.push({
            key: 'submitReview',
            icon: <SendOutlined />,
            label: 'Gửi duyệt',
            module: 'tasks',
            action: 'edit',
            onClick: () => handleSubmitReview(item.id),
          });
        }

        if (canApproveReject(item)) {
          actionItems.push({
            key: 'approve',
            icon: <CheckCircleOutlined />,
            label: 'Duyệt',
            module: 'tasks',
            action: 'approve',
            onClick: () => handleApprove(item.id),
          });
          actionItems.push({
            key: 'reject',
            icon: <CloseCircleOutlined />,
            label: 'Từ chối',
            danger: true,
            module: 'tasks',
            action: 'approve',
            onClick: () => {
              setRejectingTaskId(item.id);
              setRejectReason('');
              setRejectModalOpen(true);
            },
          });
        }

        if (canCancel(item)) {
          actionItems.push({
            key: 'cancel',
            icon: <StopOutlined />,
            label: 'Hủy',
            danger: true,
            module: 'tasks',
            action: 'edit',
            onClick: () => {
              setCancelingTask(item);
              setCancelReason('');
              setCancelModalOpen(true);
            },
          });
        }

        return (
          <Space size={4} wrap>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(item)}
            ></Button>
            {actionItems.length > 0 && <ActionDropdown items={actionItems} />}
          </Space>
        );
      },
    },
  ];

  const { columns: sortedColumns, onSorterChange } =
    useSortTooltipColumns(columns);

  return (
    <div>
      <PageHeader
        title="Giao việc & Phê duyệt"
        subtitle="Quản lý công việc: tạo, giao, xử lý, duyệt/từ chối."
      />

      <Card variant="borderless">
        {/* Toolbar: filters + actions */}
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space wrap>
            {/* Keyword search - wireframe A */}
            <Input
              placeholder="Tìm công việc..."
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              style={{ width: 220, height: 36 }}
              allowClear
            />
            {/* Status filter */}
            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              style={{ width: 180, height: 36 }}
              options={[
                { value: 'all', label: 'Trạng thái: Tất cả' },
                { value: 'new', label: 'Mới tạo' },
                { value: 'assigned', label: 'Đã giao' },
                { value: 'processing', label: 'Đang xử lý' },
                { value: 'pending_approval', label: 'Chờ duyệt' },
                { value: 'completed', label: 'Hoàn thành' },
                { value: 'rejected', label: 'Từ chối' },
                { value: 'overdue', label: 'Quá hạn' },
              ]}
            />
            {/* Department filter - wireframe A */}
            <Select
              placeholder="Phòng ban ▾"
              value={deptFilter}
              onChange={(val) => {
                setDeptFilter(val);
                setPage(1);
              }}
              style={{ width: 200, height: 36 }}
              allowClear
              options={departmentOptions}
            />
            {/* Assignee filter - wireframe A */}
            <Select
              placeholder="Người nhận ▾"
              value={assigneeFilter}
              onChange={(val) => {
                setAssigneeFilter(val);
                setPage(1);
              }}
              style={{ width: 200, height: 36 }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={employeeOptions}
            />
          </Space>
          <Space>
            {hasSelection && (
              <>
                <Button
                  size="small"
                  onClick={() => setSelectedRowKeys([])}
                  style={{ height: 36 }}
                >
                  Bỏ chọn ({selectedRowKeys.length})
                </Button>
                {/*
                  Lớp 1 - RBAC: user phải có TASK_EDIT mới thấy được bulk "Bắt đầu"
                  Lớp 2 - Business logic: chỉ filter ra task hợp lệ để start
                */}
                <PermissionGuard module="tasks" action="edit" mode="hide">
                  {selectedTasks.some((t) => canStart(t)) && (
                    <Button
                      size="small"
                      onClick={handleBulkStart}
                      style={{ height: 36 }}
                    >
                      Bắt đầu ({selectedTasks.filter((t) => canStart(t)).length}
                      /{selectedTasks.length})
                    </Button>
                  )}
                </PermissionGuard>
                {/*
                  Lớp 1 - RBAC: user phải có TASK_EDIT mới thấy được bulk "Gửi duyệt"
                  Lớp 2 - Business logic: chỉ filter ra task hợp lệ để submit review
                */}
                <PermissionGuard module="tasks" action="edit" mode="hide">
                  {selectedTasks.some((t) => canSubmitReview(t)) && (
                    <Button
                      size="small"
                      onClick={handleBulkSubmitReview}
                      style={{ height: 36 }}
                    >
                      Gửi duyệt (
                      {selectedTasks.filter((t) => canSubmitReview(t)).length}/
                      {selectedTasks.length})
                    </Button>
                  )}
                </PermissionGuard>
              </>
            )}
            {/*
              P0: RBAC check - user phải có TASK_CREATE mới thấy nút "Tạo công việc"
              Sử dụng taskPerms.canCreate từ hook useTaskPermissions()
            */}
            {taskPerms.canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setOpen(true)}
                style={{ height: 36 }}
              >
                Tạo công việc
              </Button>
            )}
          </Space>
        </div>

        {error && (
          <ApiErrorAlert
            error={error}
            title="Không tải được dữ liệu"
            onRetry={refetch}
            style={{ marginBottom: 16 }}
          />
        )}

        {!isLoading && tasks.length === 0 ? (
          <EmptyState
            title={
              statusFilter !== 'all' || keyword
                ? 'Không có công việc phù hợp'
                : 'Chưa có công việc nào'
            }
            description={
              statusFilter !== 'all' || keyword
                ? 'Thử bỏ bộ lọc để xem toàn bộ.'
                : 'Tạo công việc đầu tiên để bắt đầu.'
            }
          >
            {taskPerms.canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setOpen(true)}
              >
                Tạo công việc
              </Button>
            )}
          </EmptyState>
        ) : (
          <>
            {isOverdueFilter && (
              // P2.1: BE chưa hỗ trợ `GET /tasks?is_overdue=true`, filter
              // "Quá hạn" chỉ chạy được trên dữ liệu của trang hiện tại →
              // total/phân trang không phản ánh toàn bộ danh sách. Cảnh báo
              // rõ cho người dùng thay vì để họ hiểu nhầm số liệu là đầy đủ.
              <Alert
                type="warning"
                showIcon
                closable
                style={{ marginBottom: 12 }}
                message="Bộ lọc “Quá hạn” hiện chỉ tính trên trang dữ liệu đang xem, chưa phải tổng số toàn hệ thống (cần backend hỗ trợ tham số is_overdue)."
              />
            )}
            <div style={{ marginBottom: 12 }}>
              <PageSizeSelector
                current={page}
                pageSize={perPage}
                pageSizeOptions={[15, 20, 50, 100]}
                onChange={(p, ps) => {
                  setPage(p);
                  setPerPage(ps);
                }}
              />
            </div>
            <Table
              dataSource={tasks}
              columns={sortedColumns}
              rowKey="id"
              loading={isLoading}
              onChange={(_p, _f, sorter) => onSorterChange(sorter)}
              pagination={false}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as React.Key[]),
              }}
            />
            <TopPagination
              total={total}
              current={page}
              pageSize={perPage}
              unitName="bản ghi"
              pageSizeOptions={[15, 20, 50, 100]}
              onChange={(p, ps) => {
                setPage(p);
                setPerPage(ps);
              }}
              placement="bottom"
              showSizeChanger={false}
            />
          </>
        )}
      </Card>

      {/* Create Task Modal */}
      <Modal
        title="Tạo công việc mới"
        open={open}
        onCancel={handleCreateModalDismiss}
        footer={null}
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          onValuesChange={handleCreateFormValuesChange}
          style={{ marginTop: 14 }}
        >
          <Form.Item
            name="type"
            label="Loại công việc"
            rules={[
              { required: true, message: 'Vui lòng chọn loại công việc' },
            ]}
            initialValue="task"
          >
            <Select
              options={[
                { value: 'task', label: 'Công việc thường' },
                { value: 'coordination', label: 'Yêu cầu phối hợp' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="Tiêu đề"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input placeholder="Ví dụ: Lập báo cáo doanh thu quý 2" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <TextArea
              rows={3}
              placeholder="Ví dụ: Phân tích doanh số theo từng chi nhánh và đề xuất kế hoạch kinh doanh quý 3"
            />
          </Form.Item>
          <Form.Item name="assignTarget" label="Giao cho" initialValue="user">
            <Radio.Group
              options={[
                { value: 'user', label: 'Cá nhân' },
                { value: 'department', label: 'Phòng ban' },
              ]}
              onChange={() => {
                form.setFieldsValue({
                  to_user_id: undefined,
                  assignee_dept_id: undefined,
                });
              }}
            />
          </Form.Item>
          {assignTarget === 'department' ? (
            <Form.Item
              name="assignee_dept_id"
              label="Phòng ban nhận"
              rules={[
                { required: true, message: 'Vui lòng chọn phòng ban nhận' },
              ]}
            >
              <Select
                placeholder="Chọn phòng ban nhận"
                allowClear
                options={departmentOptions}
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="to_user_id"
              label="Người thực hiện"
              rules={[
                { required: true, message: 'Vui lòng chọn người thực hiện' },
              ]}
            >
              <Select
                showSearch
                placeholder="Chọn người thực hiện"
                optionFilterProp="label"
                options={assignableEmployeeOptions}
              />
            </Form.Item>
          )}
          <Form.Item
            name="approver_id"
            label="Người duyệt chỉ định"
            extra={
              <>
                Nhân sự chưa có tài khoản đăng nhập sẽ bị disable trong danh
                sách.{' '}
                <Link to={ROUTES.EMPLOYEES}>
                  Cấp tài khoản tại trang Nhân sự
                </Link>
              </>
            }
          >
            <Select
              showSearch
              placeholder="Chọn người duyệt chỉ định (mặc định trưởng phòng ban nhận)"
              allowClear
              optionFilterProp="label"
              options={assignableEmployeeOptions}
            />
          </Form.Item>
          <Form.Item
            name="priority"
            label="Mức ưu tiên"
            rules={[{ required: true, message: 'Vui lòng chọn mức ưu tiên' }]}
            initialValue="P2"
          >
            <Select options={PRIORITY_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="due_date"
            label="Hạn hoàn thành"
            rules={[
              { required: true, message: 'Vui lòng chọn hạn hoàn thành' },
            ]}
          >
            <DatePicker
              style={{ width: '100%', height: 36 }}
              showTime={{ format: 'HH:mm' }}
              format="DD/MM/YYYY HH:mm"
              placeholder="dd/mm/yyyy hh:mm"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
            >
              <Button onClick={handleCreateModalCancel}>Hủy</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createTaskMutation.isPending}
              >
                Tạo công việc
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        open={detailOpen}
        task={displayedTask}
        loading={taskDetailLoading}
        onClose={() => setDetailOpen(false)}
      />

      {/* Reject Reason Modal */}
      <Modal
        title="Từ chối công việc"
        open={rejectModalOpen}
        onCancel={() => {
          setRejectModalOpen(false);
          setRejectingTaskId(null);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText="Từ chối"
        okButtonProps={{
          danger: true,
          loading: rejectTaskMutation.isPending,
          disabled: !rejectReason.trim(),
        }}
        cancelText="Hủy"
      >
        <div style={{ marginBottom: 12 }}>
          Vui lòng nhập lý do từ chối công việc này:{' '}
          <span style={{ color: 'red' }}>*</span>
        </div>
        <TextArea
          rows={3}
          placeholder="Ví dụ: Báo cáo thiếu phụ lục chi tiết và chưa cập nhật số liệu ngày 30/06"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          status={!rejectReason.trim() ? 'error' : undefined}
        />
        {!rejectReason.trim() && (
          <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
            Lý do từ chối là bắt buộc
          </div>
        )}
      </Modal>

      {/* Cancel Task Modal */}
      <Modal
        title="Hủy công việc"
        open={cancelModalOpen}
        onCancel={() => {
          setCancelModalOpen(false);
          setCancelingTask(null);
          setCancelReason('');
        }}
        onOk={handleCancel}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true, loading: cancelTaskMutation.isPending }}
        cancelText="Đóng"
      >
        <div style={{ marginBottom: 12 }}>
          Bạn có chắc muốn hủy công việc <strong>{cancelingTask?.code}</strong>?
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
          Lý do hủy (không bắt buộc):
        </div>
        <TextArea
          rows={3}
          placeholder="Nhập lý do hủy (nếu có)..."
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
