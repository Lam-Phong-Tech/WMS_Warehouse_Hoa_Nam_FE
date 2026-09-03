import { tStatic } from "@/shared/i18n/useT";

/** Map màu Tag cho employee status (0–4). Phải đồng bộ với EMPLOYEE_STATUS_COLORS trong employees.types.ts. */
export const EMPLOYEE_STATUS_COLOR_MAP: Record<number, string> = {
  0: "blue", // TTS
  1: "cyan", // Thử việc
  2: "green", // Chính thức
  3: "gold", // Tạm ngưng
  4: "red", // Nghỉ việc
};

/**
 * Map nhãn cho employee status (0–4). Phải đồng bộ với EMPLOYEE_STATUS_LABELS
 * trong employees.types.ts. Dùng getter để nhãn đọc theo ngôn ngữ HIỆN TẠI mỗi
 * lần truy cập (public API Record<number, string> giữ nguyên cho caller cũ).
 */
export const EMPLOYEE_STATUS_LABEL_MAP: Record<number, string> = {
  get 0() {
    return tStatic("shared.status.employeeIntern");
  },
  get 1() {
    return tStatic("shared.status.employeeProbation");
  },
  get 2() {
    return tStatic("shared.status.employeeOfficial");
  },
  get 3() {
    return tStatic("shared.status.employeeSuspended");
  },
  get 4() {
    return tStatic("shared.status.employeeResigned");
  },
};
