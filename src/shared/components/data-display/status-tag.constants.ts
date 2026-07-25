/** Map màu Tag cho employee status (0–4). Phải đồng bộ với EMPLOYEE_STATUS_COLORS trong employees.types.ts. */
export const EMPLOYEE_STATUS_COLOR_MAP: Record<number, string> = {
  0: 'blue', // TTS
  1: 'cyan', // Thử việc
  2: 'green', // Chính thức
  3: 'gold', // Tạm ngưng
  4: 'red', // Nghỉ việc
};

/** Map nhãn cho employee status (0–4). Phải đồng bộ với EMPLOYEE_STATUS_LABELS trong employees.types.ts. */
export const EMPLOYEE_STATUS_LABEL_MAP: Record<number, string> = {
  0: 'Thực tập sinh',
  1: 'Thử việc',
  2: 'Chính thức',
  3: 'Tạm ngưng',
  4: 'Nghỉ việc',
};
