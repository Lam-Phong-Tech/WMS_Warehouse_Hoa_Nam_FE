import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useEmployees } from './use-employees';
import { employeesService } from '../services/employees.service';
import type { Employee } from '../types/employees.types';

vi.mock('../services/employees.service', () => ({
  employeesService: {
    list: vi.fn(),
  },
}));

describe('useEmployees — dùng cho dropdown chọn quản lý (manager)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('gọi employeesService.list({ include_assignments: true }) khi được yêu cầu embed assignments', async () => {
    const mockEmployees: Employee[] = [
      {
        id: 1,
        code: 'NV001',
        fullName: 'Nguyễn Văn A',
        email: 'a@test.com',
        phone: null,
        status: 1,
      },
    ];
    vi.mocked(employeesService.list).mockResolvedValue(mockEmployees);

    const { result } = renderHook(
      () => useEmployees({ include_assignments: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(employeesService.list).toHaveBeenCalledWith({
      include_assignments: true,
    });
    expect(result.current.data).toEqual(mockEmployees);
  });

  it('không truyền include_assignments khi gọi useEmployees() không tham số', async () => {
    vi.mocked(employeesService.list).mockResolvedValue([]);

    const { result } = renderHook(() => useEmployees(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(employeesService.list).toHaveBeenCalledWith(undefined);
  });
});
