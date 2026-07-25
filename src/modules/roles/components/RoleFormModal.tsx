import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormModal, confirmDialog } from '@/shared/components';
import {
  FormInput,
  FormTextarea,
  FormSelect,
  FormSwitch,
} from '@/shared/components/forms';
import { useFormDraft } from '@/shared/hooks/useFormDraft';

import { roleSchema, type RoleFormValues } from '../schemas/role.schema';
import type { Role } from '../types/roles.types';

const ROLE_TYPE_OPTIONS = [
  { value: 'co_dinh', label: 'Cố định' },
  { value: 'linh_hoat', label: 'Linh hoạt' },
];

const DEFAULTS: RoleFormValues = {
  code: '',
  name: '',
  description: '',
  type: 'co_dinh',
  status: 1,
};

export interface RoleFormModalProps {
  open: boolean;
  /** Role đang sửa (edit mode). undefined/người dùng tạo mới. */
  editingRole?: Role | null;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (values: RoleFormValues) => void;
}

export function RoleFormModal({
  open,
  editingRole,
  isPending,
  onCancel,
  onSubmit,
}: RoleFormModalProps) {
  const { control, handleSubmit, reset, getValues, watch } =
    useForm<RoleFormValues>({
      resolver: zodResolver(roleSchema),
      defaultValues: DEFAULTS,
      mode: 'onChange', // Kích hoạt validation real-time khi người dùng nhập
    });

  // Draft saving for create mode
  const draft = useFormDraft<Partial<RoleFormValues>>('role-create');
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    // Prefill khi sửa (PUT /roles/{id}), reset về mặc định khi tạo mới.
    if (editingRole) {
      reset({
        code: editingRole.code,
        name: editingRole.name,
        description: editingRole.description ?? '',
        type: editingRole.type ?? 'co_dinh',
        status: editingRole.status ?? 1,
      });
    } else {
      reset(DEFAULTS);
    }
  }, [open, editingRole, reset]);

  // Restore draft when modal opens for create mode
  useEffect(() => {
    if (!open || editingRole) return;
    const timer = setTimeout(() => {
      const saved = draft.restore();
      if (saved) {
        reset((prev) => ({ ...prev, ...saved }));
      }
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRole]);

  // Save draft when modal closes (unless it was just submitted)
  useEffect(() => {
    if (open === false && !editingRole && !submittedRef.current) {
      const current = getValues();
      draft.save(current as Partial<RoleFormValues>);
    }
    if (open === false) {
      submittedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRole]);

  // Save draft on unmount if modal is open (user navigates away to another page)
  useEffect(() => {
    return () => {
      if (open && !editingRole && !submittedRef.current) {
        const current = getValues();
        draft.save(current as Partial<RoleFormValues>);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRole]);

  // Autosave draft liên tục khi người dùng gõ (debounce) — đảm bảo dữ liệu
  // không mất khi điều hướng sang trang khác trước khi effect unmount ở trên
  // kịp chạy (ví dụ route chuyển trang bằng SPA navigation).
  useEffect(() => {
    if (!open || editingRole) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = watch((values) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        draft.save(values as Partial<RoleFormValues>);
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRole]);

  const isEdit = !!editingRole;

  const handleFormSubmit = () =>
    handleSubmit((values) => {
      submittedRef.current = true;
      draft.clear();
      onSubmit(values);
    })();

  const handleCancelClick = () => {
    if (!editingRole) {
      const current = getValues();
      const hasData = Object.values(current).some((val) => {
        if (val === null || val === undefined || val === '') return false;
        if (typeof val === 'boolean') return false;
        return true;
      });
      if (hasData) {
        confirmDialog({
          title: 'Xác nhận hủy',
          content: 'Bạn có chắc chắn muốn hủy? Dữ liệu đã nhập sẽ bị xóa.',
          okText: 'Đồng ý',
          cancelText: 'Tiếp tục nhập',
          danger: true,
          onOk: () => {
            draft.clear();
            onCancel();
          },
        });
        return;
      }
    }
    draft.clear();
    onCancel();
  };

  // Bấm ra ngoài modal / phím Esc / nút X — không hỏi xác nhận, chỉ lưu tạm
  // để mở lại vẫn còn dữ liệu vừa nhập.
  const handleDismiss = () => {
    if (!editingRole) {
      const current = getValues();
      draft.save(current as Partial<RoleFormValues>);
    }
    onCancel();
  };

  return (
    <FormModal
      open={open}
      title={isEdit ? 'Sửa vai trò' : 'Thêm vai trò'}
      onOk={handleFormSubmit}
      onCancel={handleCancelClick}
      onDismiss={handleDismiss}
      loading={isPending}
    >
      <FormInput
        control={control}
        name="code"
        label="Mã vai trò"
        placeholder="Ví dụ: ADMIN, HR_MANAGER, SALE_STAFF"
        maxLength={50}
      />
      <FormInput
        control={control}
        name="name"
        label="Tên vai trò"
        placeholder="Ví dụ: Quản trị hệ thống, Trưởng phòng nhân sự, Nhân viên kinh doanh"
        maxLength={100}
      />
      <FormSelect
        control={control}
        name="type"
        label="Loại vai trò"
        options={ROLE_TYPE_OPTIONS}
      />
      <FormSwitch control={control} name="status" label="Trạng thái" />
      <FormTextarea
        control={control}
        name="description"
        label="Mô tả"
        rows={3}
        placeholder="Ví dụ: Có toàn quyền quản trị hệ thống, cấu hình và phân bổ tài nguyên"
      />
    </FormModal>
  );
}
