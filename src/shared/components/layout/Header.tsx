import type { ReactNode } from 'react';
import { Layout } from 'antd';

export interface HeaderProps {
  /** Vùng bên trái (nút thu gọn, tiêu đề…). */
  left?: ReactNode;
  /** Vùng bên phải (chuông, menu người dùng…). */
  right?: ReactNode;
}

/** Thanh trên cùng: trái — phải, dùng cho layout admin. */
export function Header({ left, right }: HeaderProps) {
  return (
    <Layout.Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {left}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {right}
      </div>
    </Layout.Header>
  );
}
