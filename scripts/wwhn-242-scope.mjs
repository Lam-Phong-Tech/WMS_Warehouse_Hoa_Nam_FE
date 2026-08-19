/**
 * WWHN-242 — TẬP TỆP THUỘC PHẠM VI HOÀN ĐẢO (nguồn duy nhất).
 *
 * Nhánh `m1` luôn có nhiều phiên làm song song, nên "cây làm việc sạch" là điều
 * KHÔNG BAO GIỜ đúng và không thể dùng làm điều kiện đóng task. Cái đúng phải chứng
 * minh là: **đúng những tệp quyết định hành vi REV-00/REV-01 không đổi** giữa lúc
 * chụp bằng chứng và lúc review. Danh sách dưới đây là định nghĩa đó, dùng chung cho
 * cả script publish lẫn cổng verify để hai bên không thể lệch nhau.
 */
export const WWHN_242_SCOPE_PATHS = [
  "e2e/wwhn-242-reversal-qa2.spec.ts",
  "scripts/publish-wwhn-242-qa2-evidence.mjs",
  "scripts/run-wwhn-242-evidence.mjs",
  "scripts/verify-wwhn-242-closure.mjs",
  "scripts/wwhn-242-scope.mjs",
  "src/app/router/access.ts",
  "src/shared/api/endpoints.ts",
  "src/shared/constants/routes.ts",
  "src/shared/constants/wms-permissions.ts",
  "src/test/setup.ts",
];

/** Thư mục thuộc phạm vi — mọi tệp bên dưới đều tính. */
export const WWHN_242_SCOPE_DIRS = ["src/modules/reverse/"];

export function isScopePath(relativePath) {
  const normalized = relativePath.split(String.fromCharCode(92)).join("/");
  return (
    WWHN_242_SCOPE_PATHS.includes(normalized) ||
    WWHN_242_SCOPE_DIRS.some((dir) => normalized.startsWith(dir))
  );
}

/**
 * Ma trận QA2 (FE242-P1-01/P1-03/P2-01). Mỗi dòng là một ca kiểm thử phải có ảnh
 * thật, kèm neo tài liệu để QA2 đối chiếu chứ không phải tin lời FE.
 */
export const QA2_MATRIX = [
  {
    scenario: "rev00-list",
    perViewport: true,
    title: "REV-00 · danh sách hoàn đảo",
    anchor: "Annex D SCR-REV-01; NFR-SRS-006",
    expected:
      "Hiện reversal_code + chứng từ nguồn; không tràn ngang ở cả bốn khổ màn hình.",
  },
  {
    scenario: "rev01-detail",
    perViewport: true,
    title: "REV-01 · chi tiết hoàn đảo",
    anchor: "Annex D SCR-REV-01; SRS §5.5 BR-REV-01",
    expected:
      "Movement gốc read-only hiển thị đúng mã; không tràn ngang ở cả bốn khổ.",
  },
  {
    scenario: "rev01-confirm",
    perViewport: true,
    title: "REV-01 · hộp xác nhận trước khi Post",
    anchor:
      "Annex D SCR-REV-01 (confirmation shows stock effect); BR-REV-01/08",
    expected:
      "Hộp xác nhận nêu rõ append-only/không hoàn tác; bấm 'Kiểm tra lại' là no-write.",
  },
  {
    scenario: "list-error-403",
    perViewport: true,
    title: "REV-00 · lỗi 403 DATA_SCOPE_DENIED",
    anchor: "SRS §8.1 default deny; §8.2 bảng HTTP↔mã lỗi",
    expected:
      "Hiện NoPermissionState chuẩn hệ thống (không phải bảng trắng); không tràn ngang.",
  },
  {
    scenario: "role-readonly",
    perViewport: false,
    title: "RBAC · vai chỉ có inventory.view",
    anchor: "SRS §3 ma trận quyền; §8.1",
    expected:
      "Vào được REV-00 ở chế độ đọc, có ghi chú chỉ đọc, KHÔNG có nút tạo/Post/huỷ.",
  },
  {
    scenario: "role-writer",
    perViewport: false,
    title: "RBAC · vai có inventory.reversal.post",
    anchor: "SRS §3; BR-REV-02",
    expected: "Hiện hành động tạo hoàn đảo; không có ghi chú chỉ đọc.",
  },
  {
    scenario: "rev01-partial-and-guard",
    perViewport: false,
    title: "Partial 2/20 + dependency guard",
    anchor: "BR-REV-03/04/05",
    expected:
      "Movement có downstream hiện đúng mã guard của BE; đảo một phần 2/20 được chấp nhận.",
  },
  {
    scenario: "lifecycle-pending-return",
    perViewport: false,
    title: "§6 · bước CONFIRMED (hàng vật lý đã về)",
    anchor: "SRS §6 state model; BR-REV-06",
    expected:
      "PENDING_RETURN hiện bước xác nhận hàng về và khoá Post cho tới khi xác nhận.",
  },
  {
    scenario: "post-error-403",
    perViewport: false,
    title: "Post → 403 PERMISSION_DENIED",
    anchor: "SRS §8.2; TC-P1-027",
    expected:
      "Báo lỗi đúng, KHÔNG tự nạp lại (không phải xung đột version), no-write.",
  },
  {
    scenario: "post-error-409",
    perViewport: false,
    title: "Post → 409 DOWNSTREAM_DEPENDENCY_EXISTS",
    anchor: "BR-REV-04; TC-P1-028",
    expected: "Hiện cảnh báo lệch version + tự nạp lại phiếu; phiếu vẫn DRAFT.",
  },
  {
    scenario: "post-error-412",
    perViewport: false,
    title: "Post → 412 STALE_VERSION",
    anchor: "BR-REV-02 If-Match; TC-P1-031",
    expected: "Hiện cảnh báo lệch version + tự nạp lại phiếu; phiếu vẫn DRAFT.",
  },
  {
    scenario: "post-error-422",
    perViewport: false,
    title: "Post → 422 REVERSAL_QTY_EXCEEDS_REVERSIBLE",
    anchor: "BR-REV-05; TC-P1-026",
    expected: "Báo lỗi nghiệp vụ, KHÔNG tự nạp lại, no-write.",
  },
  {
    scenario: "post-error-428",
    perViewport: false,
    title: "Post → 428 PRECONDITION_REQUIRED",
    anchor: "BR-REV-02; SRS §8.2",
    expected: "Hiện cảnh báo lệch version + tự nạp lại phiếu; phiếu vẫn DRAFT.",
  },
];

/** Bốn khổ bắt buộc của FE242-P2-01 (khớp REQUIRED_VIEWPORTS trong spec e2e). */
export const QA2_VIEWPORTS = ["1440x900", "1366x768", "768x1024", "390x844"];
