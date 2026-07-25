/** Chức vụ (danh mục) — đã qua remap ở service. */
export interface Position {
  id: number;
  code: string;
  name: string;
  management_level: number;
  description?: string | null;
  grade: string | null;
  active: boolean;
  /** Số nhân sự đang giữ chức vụ này (BE trả kèm ở chi tiết). */
  employeeCount?: number;
  created_at?: string;
  updated_at?: string;
}

/** Payload tạo/sửa chức vụ gửi lên API (snake_case). */
export interface PositionPayload {
  code: string;
  name: string;
  management_level: number;
  description?: string;
  grade?: string;
  status: number; // 1: active, 0: inactive
}
