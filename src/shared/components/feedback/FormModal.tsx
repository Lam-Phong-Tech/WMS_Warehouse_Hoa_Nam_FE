import type { ReactNode } from 'react';
import type { ButtonProps } from 'antd';
import { Button, Form, Modal } from 'antd';

export interface FormModalProps {
  open: boolean;
  /** Tiêu đề (caller tự đổi theo chế độ thêm/sửa). */
  title: ReactNode;
  /** Handler nút Lưu — thường là `handleSubmit(onSubmit)` của react-hook-form. */
  onOk: () => void;
  /**
   * Đóng modal khi bấm nút "Huỷ" — nơi caller thường hỏi xác nhận
   * nếu form đã có dữ liệu.
   */
  onCancel: () => void;
  /**
   * Đóng modal khi bấm ra ngoài (mask), bấm nút X, hoặc nhấn Esc — không
   * hỏi xác nhận, chỉ âm thầm lưu draft để lần sau mở lại vẫn còn dữ liệu.
   * Mặc định dùng chung `onCancel` nếu không truyền riêng.
   */
  onDismiss?: () => void;
  /** Khoá nút Lưu khi đang gửi request. */
  loading?: boolean;
  okText?: string;
  cancelText?: string;
  width?: number;
  /** Gọi sau khi modal đóng hẳn (hết animation) — tiện reset state nội bộ. */
  afterClose?: () => void;
  children: ReactNode;
  /** Custom props for the OK button */
  okButtonProps?: ButtonProps;
}

/**
 * Khung Modal + Form (layout dọc) dùng chung cho các form thêm/sửa.
 * Gom phần chrome lặp ở mọi `<Module>FormModal` (open/title/nút Lưu-Huỷ/loading)
 * để page chỉ truyền tiêu đề + các FormField bên trong.
 *
 *   <FormModal open={open} title={editing ? 'Sửa' : 'Thêm'}
 *     onOk={handleSubmit(onSubmit)} onCancel={onCancel} loading={isPending}>
 *     <FormInput control={control} name="code" label="Mã" />
 *   </FormModal>
 */
export function FormModal({
  open,
  title,
  onOk,
  onCancel,
  onDismiss,
  loading,
  okText = 'Lưu',
  cancelText = 'Huỷ',
  width,
  afterClose,
  children,
  okButtonProps,
}: FormModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onDismiss ?? onCancel}
      confirmLoading={loading}
      width={width}
      afterClose={afterClose}
      destroyOnHidden
      footer={
        <>
          <Button onClick={onCancel}>{cancelText}</Button>
          <Button
            type="primary"
            loading={loading}
            onClick={onOk}
            {...okButtonProps}
          >
            {okText}
          </Button>
        </>
      }
    >
      <Form layout="vertical">{children}</Form>
    </Modal>
  );
}
