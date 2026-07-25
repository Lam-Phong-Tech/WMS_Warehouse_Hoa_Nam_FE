import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TasksPage } from './TasksPage';
import type { Task } from '@/modules/tasks/services/tasks.service';

// Mock hooks
vi.mock('@/modules/tasks/hooks/use-tasks');
vi.mock('@/modules/tasks/pages/task-permissions.helpers');
vi.mock('@/modules/departments/hooks/use-departments');
vi.mock('@/modules/employees/hooks/use-employees');
vi.mock('@/shared/store/auth.store');
vi.mock('@/shared/hooks/useFormDraft');

const mockUseTaskPermissions = vi.fn();

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithQuery = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

const mockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  code: 'TSK-001',
  type: 'task',
  title: 'Test task',
  description: 'Test description',
  priority: 'P2',
  status: 'pending_approval',
  due_date: '2026-12-31T23:59:59',
  creator_id: 10,
  creator_name: 'Người giao',
  assignee_id: 20,
  assignee_name: 'Người nhận',
  assignee_dept_id: 4,
  assignee_dept_name: 'Phòng ban A',
  approver_id: 30,
  approver_name: 'Người duyệt',
  created_at: '2026-07-01T00:00:00',
  updated_at: '2026-07-01T00:00:00',
  is_overdue: false,
  ...overrides,
});

describe('TasksPage - Approve/Reject Visibility (TASK_APPROVE)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hiển thị nút Duyệt/Từ chối khi có TASK_APPROVE và đúng business rule', async () => {
    const user = userEvent.setup();
    mockUseTaskPermissions.mockReturnValue({
      canCreate: false,
      canEdit: false,
      canApprove: true,
      canExport: false,
    });

    const task = mockTask({
      status: 'pending_approval',
      assignee_id: 20,
      approver_id: 30,
    });

    // Mock useTasks
    const mockUseTasks = vi.mocked(await import('@/modules/tasks/hooks/use-tasks'));
    mockUseTasks.useTasks.mockReturnValue({
      data: { data: [task], meta: { total: 1, page: 1, per_page: 15 } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseTasks.useTask.mockReturnValue({
      data: task,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    mockUseTasks.useApproveTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    mockUseTasks.useRejectTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    renderWithQuery(<TasksPage />);

    // Mở drawer
    const viewButton = await screen.findByRole('button', { name: '' });
    await user.click(viewButton);

    // Verify approve/reject buttons are visible
    await waitFor(() => {
      expect(screen.getByText('Duyệt')).toBeInTheDocument();
      expect(screen.getByText('Từ chối')).toBeInTheDocument();
    });
  });

  it('KHÔNG hiển thị nút Duyệt/Từ chối khi không có TASK_APPROVE', async () => {
    const user = userEvent.setup();
    mockUseTaskPermissions.mockReturnValue({
      canCreate: false,
      canEdit: false,
      canApprove: false, // Không có quyền
      canExport: false,
    });

    const task = mockTask({
      status: 'pending_approval',
      assignee_id: 20,
      approver_id: 30,
    });

    const mockUseTasks = vi.mocked(await import('@/modules/tasks/hooks/use-tasks'));
    mockUseTasks.useTasks.mockReturnValue({
      data: { data: [task], meta: { total: 1, page: 1, per_page: 15 } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseTasks.useTask.mockReturnValue({
      data: task,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);

    renderWithQuery(<TasksPage />);

    const viewButton = await screen.findByRole('button', { name: '' });
    await user.click(viewButton);

    await waitFor(() => {
      expect(screen.queryByText('Duyệt')).not.toBeInTheDocument();
      expect(screen.queryByText('Từ chối')).not.toBeInTheDocument();
    });
  });

  it('KHÔNG hiển thị nút Duyệt/Từ chối khi status không phải pending_approval', async () => {
    const user = userEvent.setup();
    mockUseTaskPermissions.mockReturnValue({
      canCreate: false,
      canEdit: false,
      canApprove: true,
      canExport: false,
    });

    const task = mockTask({
      status: 'processing', // Không phải pending_approval
      assignee_id: 20,
      approver_id: 30,
    });

    const mockUseTasks = vi.mocked(await import('@/modules/tasks/hooks/use-tasks'));
    mockUseTasks.useTasks.mockReturnValue({
      data: { data: [task], meta: { total: 1, page: 1, per_page: 15 } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseTasks.useTask.mockReturnValue({
      data: task,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);

    renderWithQuery(<TasksPage />);

    const viewButton = await screen.findByRole('button', { name: '' });
    await user.click(viewButton);

    await waitFor(() => {
      expect(screen.queryByText('Duyệt')).not.toBeInTheDocument();
      expect(screen.queryByText('Từ chối')).not.toBeInTheDocument();
    });
  });

  it('KHÔNG hiển thị nút Duyệt/Từ chối khi người nhận tự duyệt việc của mình', async () => {
    const user = userEvent.setup();
    mockUseTaskPermissions.mockReturnValue({
      canCreate: false,
      canEdit: false,
      canApprove: true,
      canExport: false,
    });

    // Người nhận cũng là người duyệt (trùng assignee_id và approver_id)
    const task = mockTask({
      status: 'pending_approval',
      assignee_id: 30,
      approver_id: 30,
    });

    const mockUseTasks = vi.mocked(await import('@/modules/tasks/hooks/use-tasks'));
    mockUseTasks.useTasks.mockReturnValue({
      data: { data: [task], meta: { total: 1, page: 1, per_page: 15 } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    mockUseTasks.useTask.mockReturnValue({
      data: task,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);

    renderWithQuery(<TasksPage />);

    const viewButton = await screen.findByRole('button', { name: '' });
    await user.click(viewButton);

    await waitFor(() => {
      expect(screen.queryByText('Duyệt')).not.toBeInTheDocument();
      expect(screen.queryByText('Từ chối')).not.toBeInTheDocument();
    });
  });
});