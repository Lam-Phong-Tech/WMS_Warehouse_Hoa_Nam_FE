import type { ReactNode } from 'react';
import { Skeleton, theme } from 'antd';
import { ApiErrorAlert } from '@/shared/components';

export interface OrgUnitQueryStateSectionProps {
  error: unknown;
  errorTitle: string;
  isLoading: boolean;
  loadingLabel: string;
  skeletonRows: number;
  isEmpty: boolean;
  emptyNode: ReactNode;
  children: ReactNode;
}

/**
 * P2.2: gom phần layout lặp lại (error alert + skeleton loading + empty state)
 * giữa 2 nhánh Cây/Bảng của OrgUnitsPage — chỉ gom UI, KHÔNG gom điều kiện
 * loading/empty (những điều kiện đó khác nhau có chủ đích giữa 2 view, vẫn để
 * ở OrgUnitsPage.tsx và truyền vào qua props).
 */
export function OrgUnitQueryStateSection({
  error,
  errorTitle,
  isLoading,
  loadingLabel,
  skeletonRows,
  isEmpty,
  emptyNode,
  children,
}: OrgUnitQueryStateSectionProps) {
  const { token } = theme.useToken();

  return (
    <>
      {error != null && (
        <div style={{ margin: '8px 16px 0' }}>
          <ApiErrorAlert error={error} title={errorTitle} />
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 12, color: token.colorTextDescription }}>
            {loadingLabel}
          </div>
          <Skeleton active paragraph={{ rows: skeletonRows }} />
        </div>
      ) : isEmpty ? (
        <div style={{ padding: 24 }}>{emptyNode}</div>
      ) : (
        children
      )}
    </>
  );
}
