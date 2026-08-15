/**
 * Token giả dùng chung cho mọi e2e spec có mock auth (/auth/refresh, /auth/login).
 *
 * QUY ƯỚC BẮT BUỘC: pre-commit secret scanner (.husky/pre-commit) chặn mọi literal
 * dạng `access_token: "chuỗi-dài-hơn-16-ký-tự"`. Chỉ hai dạng sau được phép:
 *   1) đọc từ process.env  2) placeholder trong ngoặc nhọn: "<TEN_PLACEHOLDER>"
 * Spec mới phải import token từ file này thay vì tự đặt literal riêng.
 * Giá trị token không ảnh hưởng hành vi test — FE chỉ lưu và gửi lại nguyên văn.
 */
export const MOCK_ACCESS_TOKEN =
  process.env.E2E_MOCK_ACCESS_TOKEN ?? "<E2E_MOCK_ACCESS_TOKEN>";
export const MOCK_REFRESH_TOKEN =
  process.env.E2E_MOCK_REFRESH_TOKEN ?? "<E2E_MOCK_REFRESH_TOKEN>";
