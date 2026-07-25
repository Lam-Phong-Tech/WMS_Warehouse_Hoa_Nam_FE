import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PageHeader,
  EmptyState,
  StatusBadge,
  StatCard,
} from '@/shared/components';

describe('PageHeader', () => {
  it('hiển thị tiêu đề, mô tả và vùng thao tác', () => {
    render(
      <PageHeader
        title="Người dùng"
        subtitle="Danh sách tài khoản"
        extra={<button>Thêm mới</button>}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /người dùng/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/danh sách tài khoản/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /thêm mới/i }),
    ).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('hiển thị mô tả mặc định khi rỗng', () => {
    render(<EmptyState />);
    expect(screen.getByText(/không có dữ liệu/i)).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('hiển thị nhãn theo trạng thái active', () => {
    const { rerender } = render(<StatusBadge active />);
    expect(screen.getByText(/hoạt động/i)).toBeInTheDocument();
    rerender(<StatusBadge active={false} />);
    expect(screen.getByText(/ngừng/i)).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('hiển thị tiêu đề và số liệu (định dạng vi-VN)', () => {
    render(
      <StatCard
        title="Nhân viên"
        value={1234}
        icon={<span>i</span>}
        color="#000"
      />,
    );
    expect(screen.getByText(/nhân viên/i)).toBeInTheDocument();
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });
});
