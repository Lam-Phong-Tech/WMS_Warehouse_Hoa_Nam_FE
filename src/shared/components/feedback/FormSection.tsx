import { Divider, Typography } from "antd";

export interface FormSectionProps {
  /** Tiêu đề mục — theo §3 Typography: 15px/700, màu `accent`. */
  title: string;
}

/**
 * Divider chia nhóm trường trong form, theo §8 Layout patterns (Form view:
 * "các nhóm trường chia mục có tiêu đề accent"). Trích nguyên trạng từ
 * `SectionDivider` cục bộ từng bị lặp lại độc lập ở `OrgUnitFormModal` — dùng
 * chung cho form nào cần chia section (Drawer/Modal/Page).
 *
 * Lưu ý: style hiện tại (12px, màu secondary/muted) khác với §3 Typography
 * chính thức ("Tiêu đề mục trong form: 15px/700, màu accent"). Giữ nguyên style
 * cũ khi extract để không đổi giao diện form M1 đang chạy production mà không
 * qua QA — xem `docs/FORM_PATTERN_MIGRATION_CHECKLIST.md` cho việc căn chỉnh
 * lại theo đúng spec khi có QA.
 *
 * @example
 * ```tsx
 * <FormSection title="Thông tin liên hệ" />
 * <FormInput control={control} name="email" label="Email" />
 * ```
 */
export function FormSection({ title }: FormSectionProps) {
  return (
    <Divider plain style={{ marginTop: 8, marginBottom: 0 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {title}
      </Typography.Text>
    </Divider>
  );
}
