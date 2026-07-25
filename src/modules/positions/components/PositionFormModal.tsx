import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormModal, confirmDialog } from '@/shared/components';
import {
  FormInput,
  FormSelect,
  FormTextarea,
  FormSwitch,
} from '@/shared/components/forms';
import { useFormDraft } from '@/shared/hooks/useFormDraft';
import {
  positionSchema,
  PositionLevel,
  type PositionFormValues,
} from '@/modules/positions/schemas/position.schema';
import type { Position } from '@/modules/positions/types/positions.types';

const DEFAULTS: PositionFormValues = {
  code: '',
  name: '',
  management_level: 1,
  description: '',
  grade: undefined,
  active: true,
};

export interface PositionFormModalProps {
  open: boolean;
  /** Bản ghi đang sửa; null = thêm mới. */
  editing: Position | null;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (values: PositionFormValues) => void;
}

export function PositionFormModal({
  open,
  editing,
  isPending,
  onCancel,
  onSubmit,
}: PositionFormModalProps) {
  const { control, handleSubmit, reset, getValues, watch } =
    useForm<PositionFormValues>({
      resolver: zodResolver(positionSchema),
      defaultValues: DEFAULTS,
      mode: 'onChange', // Kích hoạt validation real-time khi người dùng nhập
    });

  // Draft saving for create mode
  const draft = useFormDraft<Partial<PositionFormValues>>('position-create');
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        code: editing.code,
        name: editing.name,
        management_level: editing.management_level ?? 1,
        description: editing.description ?? '',
        grade: editing.grade ? Number(editing.grade) : undefined,
        active: editing.active,
      });
    } else {
      reset(DEFAULTS);
    }
  }, [open, editing, reset]);

  // Restore draft when modal opens for create mode
  useEffect(() => {
    if (!open || editing) return;
    const timer = setTimeout(() => {
      const saved = draft.restore();
      if (saved) {
        reset((prev) => ({ ...prev, ...saved }));
      }
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Save draft when modal closes (unless it was just submitted)
  useEffect(() => {
    if (open === false && !editing && !submittedRef.current) {
      const current = getValues();
      draft.save(current as Partial<PositionFormValues>);
    }
    if (open === false) {
      submittedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Save draft on unmount if modal is open (user navigates away to another page)
  useEffect(() => {
    return () => {
      if (open && !editing && !submittedRef.current) {
        const current = getValues();
        draft.save(current as Partial<PositionFormValues>);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Autosave draft liên tục khi người dùng gõ (debounce) — đảm bảo dữ liệu
  // không mất khi điều hướng sang trang khác trước khi effect unmount ở trên
  // kịp chạy (ví dụ route chuyển trang bằng SPA navigation).
  useEffect(() => {
    if (!open || editing) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = watch((values) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        draft.save(values as Partial<PositionFormValues>);
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const handleFormSubmit = () =>
    handleSubmit((values) => {
      submittedRef.current = true;
      draft.clear();
      onSubmit(values);
    })();

  const handleCancelClick = () => {
    if (!editing) {
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
    if (!editing) {
      const current = getValues();
      draft.save(current as Partial<PositionFormValues>);
    }
    onCancel();
  };

  return (
    <FormModal
      open={open}
      title={editing ? 'Sửa chức vụ' : 'Thêm chức vụ'}
      onOk={handleFormSubmit}
      onCancel={handleCancelClick}
      onDismiss={handleDismiss}
      loading={isPending}
    >
      <FormInput
        control={control}
        name="code"
        label="Mã"
        placeholder="Ví dụ: GD, TP-NS, NV-KT"
        size="middle"
        maxLength={20}
      />
      <FormInput
        control={control}
        name="name"
        label="Tên"
        placeholder="Ví dụ: Giám đốc, Trưởng phòng Nhân sự, Nhân viên Kế toán"
        size="middle"
        maxLength={100}
      />
      <FormSelect
        control={control}
        name="management_level"
        label="Cấp quản lý"
        placeholder="Chọn cấp quản lý"
        size="middle"
        options={[
          { value: PositionLevel.LEVEL_1, label: 'Cấp 1' },
          { value: PositionLevel.LEVEL_2, label: 'Cấp 2' },
          { value: PositionLevel.TEAM_LEAD, label: 'Trưởng nhóm/Tổ' },
          { value: PositionLevel.DEPARTMENT_MANAGER, label: 'Trưởng phòng' },
          {
            value: PositionLevel.BRANCH_RESPONSIBLE,
            label: 'Phụ trách Chi nhánh',
          },
          {
            value: PositionLevel.COMPANY_REPRESENTATIVE,
            label: 'Đại diện Công ty',
          },
          { value: PositionLevel.LEVEL_7, label: 'Cấp 7' },
        ]}
      />
      <FormSelect
        control={control}
        name="grade"
        label="Cấp bậc/ngạch"
        placeholder="Chọn cấp bậc/ngạch"
        size="middle"
        allowClear
        options={[
          { value: 1, label: 'Cấp 1' },
          { value: 2, label: 'Cấp 2' },
          { value: 3, label: 'Cấp 3' },
          { value: 4, label: 'Cấp 4' },
          { value: 5, label: 'Cấp 5' },
          { value: 6, label: 'Cấp 6' },
          { value: 7, label: 'Cấp 7' },
        ]}
      />
      <FormTextarea
        control={control}
        name="description"
        label="Mô tả"
        placeholder="Ví dụ: Chịu trách nhiệm quản lý chung hoặc theo phân công của Ban Giám đốc"
        rows={3}
      />
      <FormSwitch control={control} name="active" label="Đang hoạt động" />
    </FormModal>
  );
}
