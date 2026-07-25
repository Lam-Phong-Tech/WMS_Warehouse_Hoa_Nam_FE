import { useMemo, useState } from 'react';
import { useTablePattern } from '@/shared/hooks/useTablePattern';
import { App, Button, Card, Space } from 'antd';
import { toast } from 'sonner';
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import {
  PageHeader,
  ApiErrorAlert,
  EmptyState,
  LoadingState,
} from '@/shared/components';
import { getMutationErrorMessage } from '@/shared/api/api-error';
import { PermissionGuard } from '@/shared/components';
import { PositionFormModal } from '@/modules/positions/components/PositionFormModal';
import { PositionsFilter } from '@/modules/positions/components/PositionsFilter';
import { PositionsTable } from '@/modules/positions/components/PositionsTable';
import type { PositionFormValues } from '@/modules/positions/schemas/position.schema';
import { type Position } from '@/modules/positions/types/positions.types';
import {
  usePositions,
  usePositionsPaged,
  usePositionsTrashedPaged,
  usePositionById,
  useCreatePosition,
  useUpdatePosition,
  useInactivePosition,
  useRestorePosition,
} from '@/modules/positions/hooks/use-positions';
import { PositionDetailDrawer } from '@/modules/positions/components/PositionDetailDrawer';
import {
  positionsService,
  type PositionListParams,
} from '@/modules/positions/services/positions.service';
import { exportXlsx } from '@/shared/utils/export-xlsx';

export function PositionsPage() {
  const { modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const {
    search: keyword,
    setSearch: setKeyword,
    filters,
    setFilter,
    page,
    setPage,
    pageSize: perPage,
    setPageSize: setPerPage,
    getApiParams,
  } = useTablePattern({ initialPageSize: 15 });
  const gradeFilter = (filters.gradeFilter as string) ?? 'all';
  const statusFilter = (filters.statusFilter as string) ?? 'all';
  const debouncedKeyword = getApiParams().search;
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [sortBy, setSortBy] = useState<string>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>();

  // Vẫn lấy all để trích xuất gradeOptions
  const { data: allPositions = [] } = usePositions();

  const positionListParams: PositionListParams = useMemo(
    () => ({
      page,
      per_page: perPage,
      keyword: debouncedKeyword,
      // Service sẽ tự map 'active' -> '1', 'inactive' -> '0'
      status: statusFilter === 'all' ? undefined : statusFilter,
      grade: gradeFilter === 'all' ? undefined : gradeFilter,
      sort_by: sortBy,
      sort_order: sortOrder,
    }),
    [
      page,
      perPage,
      debouncedKeyword,
      statusFilter,
      gradeFilter,
      sortBy,
      sortOrder,
    ],
  );

  const isTrashedView = statusFilter === 'inactive';

  const {
    data: pagedData,
    isLoading: isPagedLoading,
    isError,
    error,
    refetch: refetchPaged,
  } = usePositionsPaged(positionListParams, !isTrashedView);

  // GET /positions luôn loại trừ bản ghi đã xóa mềm (deleted_at khác null),
  // kể cả khi truyền status=0 — phải gọi endpoint riêng /positions/trashed
  // để hiển thị và khôi phục được các chức vụ này qua UI.
  const {
    data: trashedData,
    isLoading: isTrashedLoading,
    refetch: refetchTrashed,
  } = usePositionsTrashedPaged(
    {
      page,
      per_page: perPage,
      keyword: debouncedKeyword || undefined,
      grade: gradeFilter === 'all' ? undefined : gradeFilter,
      sort_by: sortBy,
      sort_order: sortOrder,
    },
    isTrashedView,
  );

  const isLoading = isTrashedView ? isTrashedLoading : isPagedLoading;
  const refetch = isTrashedView ? refetchTrashed : refetchPaged;
  const activeData = isTrashedView ? trashedData : pagedData;
  // API trả status=1 (active) ngay cả cho bản ghi đã xóa mềm — ép về
  // active=false ở view "Vô hiệu" để bảng hiện đúng badge + nút Khôi phục.
  const positions = (activeData?.data ?? []).map((p) =>
    isTrashedView ? { ...p, active: false } : p,
  );
  const total = activeData?.meta?.total ?? 0;

  const { data: detail, isLoading: detailLoading } = usePositionById(
    detailId ?? 0,
  );
  const createMutation = useCreatePosition();
  const updateMutation = useUpdatePosition();
  const inactiveMutation = useInactivePosition();
  const restoreMutation = useRestorePosition();

  // Options cấp bậc lấy từ dữ liệu thật (tránh đoán enum).
  const gradeOptions = useMemo(() => {
    const grades = [
      ...new Set(allPositions.map((p) => p.grade).filter(Boolean)),
    ] as string[];
    return grades.map((g) => ({ value: g, label: g }));
  }, [allPositions]);

  const exportMutation = useMutation({
    mutationFn: (params: PositionListParams) =>
      positionsService.exportXlsx(params),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chuc-vu-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Xuất file Excel thành công');
    },
    onError: (err) => toast.error(getMutationErrorMessage(err)),
  });

  const exportPdfMutation = useMutation({
    mutationFn: (params: PositionListParams) =>
      positionsService.exportPdf(params),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chuc-vu-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Xuất file PDF thành công');
    },
    onError: (err) => toast.error(getMutationErrorMessage(err)),
  });

  // BE /positions/export-excel và /positions/export-pdf không có tham số
  // để lọc theo deleted_at (bản ghi trashed) — nếu gọi thẳng khi đang ở view
  // "Vô hiệu" thì file xuất ra sẽ không khớp danh sách trên UI. Ở view này,
  // xuất Excel client-side từ đúng dữ liệu đang hiển thị; PDF chưa có lib
  // client-side nên tạm chặn và báo rõ lý do thay vì xuất sai dữ liệu.
  const handleExportExcel = () => {
    if (isTrashedView) {
      modal.confirm({
        title: 'Xuất dữ liệu chức vụ (Vô hiệu)',
        content:
          'Xuất danh sách chức vụ đã vô hiệu đang hiển thị ra file Excel (.xlsx)?',
        okText: 'Xuất',
        cancelText: 'Hủy',
        onOk: () => {
          exportXlsx(
            ['Mã chức vụ', 'Tên chức vụ', 'Cấp bậc', 'Số nhân sự'],
            positions.map((p) => [
              p.code,
              p.name,
              p.grade ?? '',
              p.employeeCount ?? 0,
            ]),
            `chuc-vu-vo-hieu-${new Date().toISOString().slice(0, 10)}`,
          );
          toast.success('Xuất file Excel thành công');
        },
      });
      return;
    }
    modal.confirm({
      title: 'Xuất dữ liệu chức vụ',
      content: 'Xuất toàn bộ danh sách chức vụ hiện tại ra file Excel (.xlsx)?',
      okText: 'Xuất',
      cancelText: 'Hủy',
      onOk: () => {
        exportMutation.mutate({
          keyword: debouncedKeyword,
          // Service sẽ tự map 'active' -> '1', 'inactive' -> '0'
          status: statusFilter === 'all' ? undefined : statusFilter,
          grade: gradeFilter === 'all' ? undefined : gradeFilter,
        });
      },
    });
  };

  const handleExportPdf = () => {
    if (isTrashedView) {
      modal.confirm({
        title: 'Chưa hỗ trợ xuất PDF cho view "Vô hiệu"',
        content:
          'Hệ thống chưa có endpoint xuất PDF riêng cho danh sách chức vụ đã vô hiệu. Vui lòng dùng "Xuất Excel" ở view này, hoặc liên hệ đội BE để bổ sung.',
        okText: 'Đã hiểu',
        cancelButtonProps: { style: { display: 'none' } },
      });
      return;
    }
    modal.confirm({
      title: 'Xuất dữ liệu chức vụ',
      content: 'Xuất toàn bộ danh sách chức vụ hiện tại ra file PDF (.pdf)?',
      okText: 'Xuất',
      cancelText: 'Hủy',
      onOk: () => {
        exportPdfMutation.mutate({
          keyword: debouncedKeyword,
          // Service sẽ tự map 'active' -> '1', 'inactive' -> '0'
          status: statusFilter === 'all' ? undefined : statusFilter,
          grade: gradeFilter === 'all' ? undefined : gradeFilter,
        });
      },
    });
  };

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (position: Position) => {
    setEditing(position);
    setOpen(true);
  };

  const handleInactive = (id: number) => {
    const target = positions.find((p) => p.id === id);
    const employeeCount = target?.employeeCount ?? 0;
    modal.confirm({
      title: 'Vô hiệu hóa chức vụ',
      content:
        employeeCount > 0
          ? `Chức vụ này đang được gán cho ${employeeCount} nhân sự. Vô hiệu hóa sẽ ảnh hưởng đến các nhân sự đang giữ chức vụ này. Bạn có chắc muốn tiếp tục?`
          : 'Bạn có chắc muốn vô hiệu hóa chức vụ này?',
      okText: 'Vô hiệu hóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: () => {
        inactiveMutation.mutate(id, {
          onSuccess: () => {
            toast.success('Đã vô hiệu hóa chức vụ');
            refetch();
          },
          onError: (err: unknown) => toast.error(getMutationErrorMessage(err)),
        });
      },
    });
  };

  const handleRestore = (id: number) => {
    restoreMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Đã khôi phục chức vụ');
        refetch();
      },
      onError: (err: unknown) => toast.error(getMutationErrorMessage(err)),
    });
  };

  const handleBulkInactive = () => {
    if (selectedRowKeys.length === 0) return;
    const selectedPositions = positions.filter((p) =>
      selectedRowKeys.includes(p.id),
    );
    const affectedCount = selectedPositions.filter(
      (p) => (p.employeeCount ?? 0) > 0,
    ).length;
    const totalEmployees = selectedPositions.reduce(
      (sum, p) => sum + (p.employeeCount ?? 0),
      0,
    );
    modal.confirm({
      title: 'Vô hiệu hóa chức vụ',
      content:
        affectedCount > 0
          ? `Có ${affectedCount} chức vụ đang được gán cho tổng cộng ${totalEmployees} nhân sự. Vô hiệu hóa sẽ ảnh hưởng đến các nhân sự đang giữ những chức vụ này. Bạn có chắc muốn vô hiệu hóa ${selectedRowKeys.length} chức vụ đã chọn?`
          : `Bạn có chắc muốn vô hiệu hóa ${selectedRowKeys.length} chức vụ đã chọn?`,
      okText: 'Vô hiệu hóa',
      okButtonProps: { danger: true },
      onOk: () => {
        let completed = 0;
        selectedRowKeys.forEach((id) => {
          inactiveMutation.mutate(id as number, {
            onSuccess: () => {
              completed++;
              if (completed === selectedRowKeys.length) {
                toast.success(
                  `Đã vô hiệu hóa ${selectedRowKeys.length} chức vụ`,
                );
                setSelectedRowKeys([]);
              }
            },
            onError: (err) => toast.error(getMutationErrorMessage(err)),
          });
        });
      },
    });
  };

  const handleSubmit = (values: PositionFormValues) => {
    const onSuccess = () => {
      toast.success(editing ? 'Đã cập nhật chức vụ' : 'Đã thêm chức vụ');
      setOpen(false);
      refetch();
    };
    const onError = (err: unknown) => toast.error(getMutationErrorMessage(err));

    if (editing) {
      updateMutation.mutate({ id: editing.id, values }, { onSuccess, onError });
    } else {
      createMutation.mutate(values, { onSuccess, onError });
    }
  };

  return (
    <div>
      <PageHeader
        title="Chức vụ"
        subtitle="Danh mục chức vụ dùng cho phân công nhân sự."
      />

      {isError && (
        <ApiErrorAlert
          error={error}
          title="Không tải được danh sách chức vụ"
          onRetry={refetch}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card variant="borderless">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <PositionsFilter
            keyword={keyword}
            onKeywordChange={setKeyword}
            gradeFilter={gradeFilter}
            onGradeFilterChange={(val) => setFilter('gradeFilter', val)}
            gradeOptions={gradeOptions}
            statusFilter={statusFilter}
            onStatusFilterChange={(val) => setFilter('statusFilter', val)}
          />
          <Space wrap>
            {selectedRowKeys.length > 0 && (
              <>
                <PermissionGuard module="positions" action="delete">
                  <Button size="small" danger onClick={handleBulkInactive}>
                    Vô hiệu hóa ({selectedRowKeys.length})
                  </Button>
                </PermissionGuard>
              </>
            )}
            <PermissionGuard module="positions" action="export">
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportExcel}
                loading={exportMutation.isPending}
                disabled={exportPdfMutation.isPending}
              >
                Xuất Excel
              </Button>
            </PermissionGuard>
            <PermissionGuard module="positions" action="export">
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportPdf}
                loading={exportPdfMutation.isPending}
                disabled={exportMutation.isPending}
              >
                Xuất PDF
              </Button>
            </PermissionGuard>
            <PermissionGuard module="positions" action="create">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                Thêm chức vụ
              </Button>
            </PermissionGuard>
          </Space>
        </div>

        {isLoading && positions.length === 0 ? (
          <LoadingState tip="Đang tải dữ liệu..." minHeight={320} />
        ) : !isLoading && positions.length === 0 ? (
          <EmptyState
            title="Chưa có chức vụ"
            description="Tạo mới chức vụ để bắt đầu phân quyền nhân sự."
          >
            <PermissionGuard module="positions" action="create">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                Thêm chức vụ
              </Button>
            </PermissionGuard>
          </EmptyState>
        ) : (
          <PositionsTable
            data={positions}
            loading={isLoading}
            inactivatingId={
              inactiveMutation.isPending
                ? (inactiveMutation.variables as number)
                : undefined
            }
            restoringId={
              restoreMutation.isPending
                ? (restoreMutation.variables as number)
                : undefined
            }
            onView={(p) => setDetailId(p.id)}
            onEdit={openEdit}
            onInactive={handleInactive}
            onRestore={handleRestore}
            page={page}
            perPage={perPage}
            total={total}
            onPaginationChange={(p, ps) => {
              setPage(p);
              setPerPage(ps);
            }}
            onSortChange={(field, order) => {
              setSortBy(field);
              setSortOrder(order);
              setPage(1);
            }}
            selectedRowKeys={selectedRowKeys}
            onSelectionChange={(keys) =>
              setSelectedRowKeys(keys as React.Key[])
            }
          />
        )}
      </Card>

      <PositionFormModal
        open={open}
        editing={editing}
        isPending={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setOpen(false)}
        onSubmit={handleSubmit}
      />

      <PositionDetailDrawer
        open={detailId != null}
        position={detail ?? null}
        loading={detailLoading}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          if (detail) {
            setDetailId(null);
            openEdit(detail);
          }
        }}
      />
    </div>
  );
}
