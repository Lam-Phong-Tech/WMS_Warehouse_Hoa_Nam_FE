import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  tasksService,
  mapTaskFromApi,
  type TaskFromApi,
} from './tasks.service';
import type { Department } from '@/modules/departments/types/departments.types';

vi.mock('@/shared/api/http');

describe('tasks.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('list', () => {
    it('gọi GET /tasks với params đúng', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.getPage).mockResolvedValue({
        data: [
          {
            id: 1,
            code: 'TASK-001',
            title: 'Test task',
            status: 'new',
            priority: 'P1',
            due_date: '2026-07-10',
            created_at: '2026-07-06',
            updated_at: '2026-07-06',
          },
        ],
        meta: { total: 1, page: 1, per_page: 15 },
      } as never);

      const result = await tasksService.list({ page: 1, per_page: 15 });

      expect(http.getPage).toHaveBeenCalledWith('/tasks?page=1&per_page=15');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(1);
      expect(result.meta.total).toBe(1);
    });

    it('gọi GET /tasks không có params khi không truyền', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, per_page: 15 },
      } as never);

      await tasksService.list();

      expect(http.getPage).toHaveBeenCalledWith('/tasks');
    });

    it('map relation object creator/assignee/approver/assignee_dept', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.getPage).mockResolvedValue({
        data: [
          {
            id: 1,
            code: 'TASK-001',
            title: 'Test',
            status: 'assigned',
            priority: 'P0',
            due_date: '2026-07-10',
            created_at: '2026-07-06',
            updated_at: '2026-07-06',
            creator: { id: 10, email: 'creator@example.com' },
            assignee: { id: 20, full_name: 'Nguyễn Văn A' },
            approver: { id: 30, email: 'approver@example.com' },
            assignee_dept: { id: 4, name: 'Phòng Kỹ thuật' },
          },
        ],
        meta: { total: 1, page: 1, per_page: 15 },
      } as never);

      const result = await tasksService.list();

      expect(result.data[0].creator_name).toBe('creator@example.com');
      expect(result.data[0].assignee_name).toBe('Nguyễn Văn A');
      expect(result.data[0].approver_name).toBe('approver@example.com');
      expect(result.data[0].assignee_dept_name).toBe('Phòng Kỹ thuật');
    });

    it('gửi keyword param khi có', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, per_page: 15 },
      } as never);

      await tasksService.list({ keyword: 'báo cáo' });

      // URLSearchParams encode dấu cách thành "+", không phải "%20"
      expect(http.getPage).toHaveBeenCalledWith(
        expect.stringContaining('keyword=b%C3%A1o+c%C3%A1o'),
      );
    });

    it('gửi assignee_dept_id param khi có (verify hoạt động thật trên BE)', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, per_page: 15 },
      } as never);

      await tasksService.list({ assignee_dept_id: 4 });

      expect(http.getPage).toHaveBeenCalledWith(
        expect.stringContaining('assignee_dept_id=4'),
      );
    });
  });

  describe('create', () => {
    it('gọi POST /tasks với payload đúng', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.post).mockResolvedValue({
        id: 1,
        code: 'TASK-001',
        type: 'task',
        title: 'New task',
        priority: 'P1',
        status: 'new',
        due_date: '2026-07-10',
        created_at: '2026-07-06',
        updated_at: '2026-07-06',
      } as never);

      const payload = {
        type: 'task' as const,
        title: 'New task',
        priority: 'P1' as const,
        due_date: '2026-07-10',
      };
      const result = await tasksService.create(payload);

      expect(http.post).toHaveBeenCalledWith('/tasks', payload);
      expect(result.id).toBe(1);
    });
  });

  describe('approve', () => {
    it('gọi POST /tasks/{id}/approve', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.post).mockResolvedValue({
        id: 1,
        code: 'TASK-001',
        status: 'completed',
        created_at: '2026-07-06',
        updated_at: '2026-07-06',
      } as never);

      const result = await tasksService.approve(1);

      expect(http.post).toHaveBeenCalledWith('/tasks/1/approve');
      expect(result.status).toBe('completed');
    });
  });

  describe('reject', () => {
    it('gọi POST /tasks/{id}/reject với note', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.post).mockResolvedValue({
        id: 1,
        code: 'TASK-001',
        status: 'rejected',
        reject_reason: 'Không đủ yêu cầu',
        created_at: '2026-07-06',
        updated_at: '2026-07-06',
      } as never);

      const result = await tasksService.reject(1, 'Không đủ yêu cầu');

      expect(http.post).toHaveBeenCalledWith('/tasks/1/reject', {
        note: 'Không đủ yêu cầu',
      });
      expect(result.status).toBe('rejected');
    });

    it('ném lỗi và KHÔNG gọi API nếu không có note (lý do từ chối bắt buộc)', async () => {
      const { http } = await import('@/shared/api/http');

      await expect(tasksService.reject(1)).rejects.toThrow(
        'Lý do từ chối là bắt buộc',
      );
      expect(http.post).not.toHaveBeenCalled();
    });

    it('ném lỗi nếu note chỉ toàn khoảng trắng', async () => {
      const { http } = await import('@/shared/api/http');

      await expect(tasksService.reject(1, '   ')).rejects.toThrow(
        'Lý do từ chối là bắt buộc',
      );
      expect(http.post).not.toHaveBeenCalled();
    });

    it('trim khoảng trắng thừa trước khi gửi note', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.post).mockResolvedValue({
        id: 1,
        code: 'TASK-001',
        status: 'rejected',
        reject_reason: 'Không đủ yêu cầu',
        created_at: '2026-07-06',
        updated_at: '2026-07-06',
      } as never);

      await tasksService.reject(1, '  Không đủ yêu cầu  ');

      expect(http.post).toHaveBeenCalledWith('/tasks/1/reject', {
        note: 'Không đủ yêu cầu',
      });
    });
  });

  describe('start', () => {
    it('gọi POST /tasks/{id}/start', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.post).mockResolvedValue({
        id: 1,
        code: 'TASK-001',
        status: 'processing',
        created_at: '2026-07-06',
        updated_at: '2026-07-06',
      } as never);

      const result = await tasksService.start(1);

      expect(http.post).toHaveBeenCalledWith('/tasks/1/start');
      expect(result.status).toBe('processing');
    });
  });

  describe('submitForReview', () => {
    it('gọi POST /tasks/{id}/submit', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.post).mockResolvedValue({
        id: 1,
        code: 'TASK-001',
        status: 'pending_approval',
        created_at: '2026-07-06',
        updated_at: '2026-07-06',
      } as never);

      const result = await tasksService.submitForReview(1);

      expect(http.post).toHaveBeenCalledWith('/tasks/1/submit');
      expect(result.status).toBe('pending_approval');
    });
  });

  describe('cancel', () => {
    it('gọi POST /tasks/{id}/cancel', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.post).mockResolvedValue({
        id: 1,
        code: 'TASK-001',
        status: 'cancel',
        created_at: '2026-07-06',
        updated_at: '2026-07-06',
      } as never);

      const result = await tasksService.cancel(1);

      expect(http.post).toHaveBeenCalledWith('/tasks/1/cancel', undefined);
      expect(result.status).toBe('cancel');
    });

    it('gọi POST /tasks/{id}/cancel với note', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.post).mockResolvedValue({
        id: 1,
        code: 'TASK-001',
        status: 'cancel',
        created_at: '2026-07-06',
        updated_at: '2026-07-06',
      } as never);

      await tasksService.cancel(1, 'Hết hạn');

      expect(http.post).toHaveBeenCalledWith('/tasks/1/cancel', {
        note: 'Hết hạn',
      });
    });
  });

  describe('getHistory', () => {
    it('gọi GET /tasks/{id}/histories', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.get).mockResolvedValue([
        {
          id: 1,
          task_id: 1,
          from_status: 'new',
          to_status: 'assigned',
          created_at: '2026-07-06T10:00:00Z',
        },
      ] as never);

      const result = await tasksService.getHistory(1);

      expect(http.get).toHaveBeenCalledWith('/tasks/1/histories');
      expect(result).toHaveLength(1);
      expect(result[0].to_status).toBe('assigned');
    });
  });

  describe('getById', () => {
    it('gọi GET /tasks/{id} và map response', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.get).mockImplementation((url: string) => {
        if (url === '/tasks/1') {
          return Promise.resolve({
            id: 1,
            code: 'TASK-001',
            title: 'Detail task',
            status: 'processing',
            priority: 'P1',
            due_date: '2026-07-10',
            created_at: '2026-07-06',
            updated_at: '2026-07-06',
            creator: { id: 10, email: 'creator@example.com' },
          } as never);
        }
        return Promise.resolve([] as never);
      });

      const result = await tasksService.getById(1);

      expect(http.get).toHaveBeenCalledWith('/tasks/1');
      expect(result.creator_name).toBe('creator@example.com');
    });
  });

  describe('update', () => {
    it('gọi PUT /tasks/{id} với payload', async () => {
      const { http } = await import('@/shared/api/http');
      vi.mocked(http.put).mockResolvedValue({
        id: 1,
        code: 'TASK-001',
        title: 'Updated',
        status: 'new',
        priority: 'P1',
        due_date: '2026-07-10',
        created_at: '2026-07-06',
        updated_at: '2026-07-06',
      } as never);

      const result = await tasksService.update(1, { title: 'Updated' });

      expect(http.put).toHaveBeenCalledWith('/tasks/1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });
});

describe('mapTaskFromApi', () => {
  it('ưu tiên relation object BE trả kèm', () => {
    const task: TaskFromApi = {
      id: 1,
      code: 'TASK-001',
      title: 'Test',
      status: 'assigned',
      priority: 'P1',
      due_date: '2026-07-10',
      created_at: '2026-07-06',
      updated_at: '2026-07-06',
      creator: { id: 10, email: 'creator@example.com' },
      assignee: { id: 20, full_name: 'Nguyễn Văn A' },
      approver: { id: 30, email: 'approver@example.com' },
      assignee_dept: { id: 4, name: 'Phòng Kỹ thuật' },
    };

    const result = mapTaskFromApi(task);

    expect(result.creator_name).toBe('creator@example.com');
    expect(result.assignee_name).toBe('Nguyễn Văn A');
    expect(result.approver_name).toBe('approver@example.com');
    expect(result.assignee_dept_name).toBe('Phòng Kỹ thuật');
  });

  it('fallback sang users/departments khi API không kèm relation', () => {
    const task: TaskFromApi = {
      id: 1,
      code: 'TASK-001',
      title: 'Test',
      status: 'assigned',
      priority: 'P1',
      due_date: '2026-07-10',
      created_at: '2026-07-06',
      updated_at: '2026-07-06',
      creator_id: 10,
      assignee_id: 20,
      approver_id: 30,
      assignee_dept_id: 4,
    };

    const users = [
      {
        id: 10,
        code: 'U001',
        name: 'Creator User',
        email: 'creator@old.com',
        role: 'user',
        salary: 1000,
        joinedAt: '2020-01-01',
        active: true,
      },
      {
        id: 20,
        code: 'U002',
        name: 'Assignee User',
        email: 'assignee@old.com',
        role: 'user',
        salary: 2000,
        joinedAt: '2020-02-01',
        active: true,
      },
      {
        id: 30,
        code: 'U003',
        name: 'Approver User',
        email: 'approver@old.com',
        role: 'manager',
        salary: 3000,
        joinedAt: '2020-03-01',
        active: true,
      },
    ];
    const departments: Department[] = [
      {
        id: 4,
        code: 'D001',
        name: 'Phòng Kỹ thuật',
        departmentType: 'phong_ban',
        orgUnitId: 1,
        orgUnitName: 'Công ty',
        parentId: null,
        managerId: 20,
        managerName: 'Manager',
        active: true,
      },
    ];

    const result = mapTaskFromApi(task, users, departments);

    expect(result.creator_name).toBe('Creator User');
    expect(result.assignee_name).toBe('Assignee User');
    expect(result.approver_name).toBe('Approver User');
    expect(result.assignee_dept_name).toBe('Phòng Kỹ thuật');
  });

  it('fallback sang User #id/Dept #id khi không có relation và không có fallback data', () => {
    const task: TaskFromApi = {
      id: 1,
      code: 'TASK-001',
      title: 'Test',
      status: 'assigned',
      priority: 'P1',
      due_date: '2026-07-10',
      created_at: '2026-07-06',
      updated_at: '2026-07-06',
      creator_id: 10,
      assignee_id: 20,
      assignee_dept_id: 4,
    };

    const result = mapTaskFromApi(task);

    expect(result.creator_name).toBe('User #10');
    expect(result.assignee_name).toBe('User #20');
    expect(result.assignee_dept_name).toBe('Dept #4');
  });

  it('giữ nguyên các field khác', () => {
    const task: TaskFromApi = {
      id: 1,
      code: 'TASK-001',
      type: 'coordination',
      title: 'Test',
      description: 'Description',
      priority: 'P0',
      status: 'pending_approval',
      due_date: '2026-07-10',
      creator_id: 10,
      assignee_id: 20,
      assignee_dept_id: 4,
      approver_id: 30,
      actual_done_date: '2026-07-06',
      reject_reason: 'Lý do',
      result_file_url: 'http://example.com/file.pdf',
      deleted_at: null,
      created_at: '2026-07-06',
      updated_at: '2026-07-06',
    };

    const result = mapTaskFromApi(task);

    expect(result.id).toBe(1);
    expect(result.type).toBe('coordination');
    expect(result.description).toBe('Description');
    expect(result.priority).toBe('P0');
    expect(result.actual_done_date).toBe('2026-07-06');
    expect(result.reject_reason).toBe('Lý do');
    expect(result.result_file_url).toBe('http://example.com/file.pdf');
    expect(result.deleted_at).toBeNull();
  });

  describe('is_overdue computed', () => {
    it('trả về true khi due_date trong quá khứ và status chưa kết thúc', () => {
      const task: TaskFromApi = {
        id: 1,
        code: 'TASK-001',
        title: 'Overdue task',
        status: 'processing',
        priority: 'P1',
        due_date: '2025-01-01',
        created_at: '2024-12-01',
        updated_at: '2025-01-02',
      };

      const result = mapTaskFromApi(task);
      expect(result.is_overdue).toBe(true);
    });

    it('trả về false khi status là completed', () => {
      const task: TaskFromApi = {
        id: 1,
        code: 'TASK-001',
        title: 'Done task',
        status: 'completed',
        priority: 'P1',
        due_date: '2025-01-01',
        created_at: '2024-12-01',
        updated_at: '2025-01-02',
      };

      const result = mapTaskFromApi(task);
      expect(result.is_overdue).toBe(false);
    });

    it('trả về false khi status là cancel', () => {
      const task: TaskFromApi = {
        id: 1,
        code: 'TASK-001',
        title: 'Cancelled task',
        status: 'cancel',
        priority: 'P1',
        due_date: '2025-01-01',
        created_at: '2024-12-01',
        updated_at: '2025-01-02',
      };

      const result = mapTaskFromApi(task);
      expect(result.is_overdue).toBe(false);
    });

    it('trả về false khi không có due_date', () => {
      const task: TaskFromApi = {
        id: 1,
        code: 'TASK-001',
        title: 'No due date',
        status: 'processing',
        priority: 'P1',
        due_date: '',
        created_at: '2024-12-01',
        updated_at: '2025-01-02',
      };

      const result = mapTaskFromApi(task);
      expect(result.is_overdue).toBe(false);
    });
  });
});
