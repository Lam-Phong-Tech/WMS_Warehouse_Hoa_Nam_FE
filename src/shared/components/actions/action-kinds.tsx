import type { ComponentType } from "react";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BarcodeOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  DisconnectOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FilterOutlined,
  HistoryOutlined,
  ImportOutlined,
  KeyOutlined,
  LogoutOutlined,
  LockOutlined,
  MoreOutlined,
  PaperClipOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  ScanOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  SwapOutlined,
  SyncOutlined,
  ToolOutlined,
  UndoOutlined,
  UnlockOutlined,
  UploadOutlined,
  UserSwitchOutlined,
  WifiOutlined,
} from "@/shared/components/icons";
import {
  ACTION_ICON_COLORS,
  type ActionIconColorKey,
} from "@/shared/theme/actionIconColors";
import { useLanguageStore } from "@/shared/i18n/language.store";

/**
 * ĐĂNG KÝ HÀNH ĐỘNG CHUẨN — nguồn DUY NHẤT của toàn dự án.
 *
 * Mỗi hành động nghiệp vụ ứng với đúng 1 bộ (icon, tông màu, nhãn mặc định).
 * Màn nghiệp vụ KHÔNG được tự chọn icon/màu tại chỗ; chỉ khai `kind` rồi để
 * `<ActionButton kind="..." />` / `<ActionIconButton kind="..." />` dựng UI.
 *
 * Muốn thêm hành động mới: thêm 1 dòng vào đây, KHÔNG thêm icon rời ở màn.
 * Nhãn khai đủ HAI thứ tiếng qua `spec(icon, tone, vi, en)` — `label` là getter
 * đọc ngôn ngữ tại thời điểm render nên đổi ngôn ngữ là mọi nút mặc định đổi
 * theo (App remount theo `key={language}`).
 */
export type ActionKind =
  // — Đọc —
  | "view"
  | "detail"
  | "history"
  | "trace"
  | "search"
  | "filter"
  | "print"
  // — Ghi —
  | "create"
  | "edit"
  | "save"
  | "delete"
  | "remove"
  | "copy"
  | "settings"
  // — Kết thúc / hủy —
  | "close"
  | "cancel"
  | "reset"
  | "back"
  | "next"
  // — Phê duyệt / trạng thái —
  | "approve"
  | "confirm"
  | "complete"
  | "reject"
  | "activate"
  | "deactivate"
  | "lock"
  | "unlock"
  | "start"
  | "stop"
  // — Quét / đồng bộ —
  | "scan"
  | "camera"
  | "barcode"
  | "sync"
  | "refresh"
  | "undo"
  | "reverse"
  | "swap"
  | "assign"
  // — Dữ liệu vào/ra —
  | "upload"
  | "import"
  | "download"
  | "export"
  | "exportExcel"
  | "exportPdf"
  | "attach"
  | "publish"
  | "unpublish"
  | "send"
  | "report"
  | "repair"
  | "more"
  // — Tài khoản / phân quyền —
  | "login"
  | "logout"
  | "password"
  | "grant"
  | "revoke"
  | "clear"
  | "rfid";

export interface ActionKindSpec {
  /** Icon chuẩn của hành động (lấy từ shim Flaticon dùng chung). */
  icon: ComponentType<{ style?: React.CSSProperties; className?: string }>;
  /** Khóa tông màu trong ACTION_ICON_COLORS. */
  tone: ActionIconColorKey;
  /** Nhãn mặc định theo ngôn ngữ đang chọn. Màn có thể ghi đè bằng prop `label`. */
  readonly label: string;
}

type ActionIcon = ActionKindSpec["icon"];

/** Nhãn song ngữ dạng getter — đọc ngôn ngữ lúc truy cập, không đóng băng. */
function spec(
  icon: ActionIcon,
  tone: ActionIconColorKey,
  vi: string,
  en: string,
): ActionKindSpec {
  return {
    icon,
    tone,
    get label() {
      return useLanguageStore.getState().language === "en" ? en : vi;
    },
  };
}

export const ACTION_KINDS: Record<ActionKind, ActionKindSpec> = {
  // — Đọc —
  view: spec(EyeOutlined, "view", "Xem", "View"),
  detail: spec(FileTextOutlined, "view", "Chi tiết", "Details"),
  history: spec(HistoryOutlined, "view", "Lịch sử", "History"),
  trace: spec(SearchOutlined, "view", "Truy vết", "Trace"),
  search: spec(SearchOutlined, "view", "Tìm kiếm", "Search"),
  filter: spec(FilterOutlined, "view", "Lọc", "Filter"),
  print: spec(PrinterOutlined, "download", "In", "Print"),

  // — Ghi —
  create: spec(PlusOutlined, "primary", "Thêm mới", "Add new"),
  edit: spec(EditOutlined, "edit", "Sửa", "Edit"),
  save: spec(SaveOutlined, "primary", "Lưu", "Save"),
  delete: spec(DeleteOutlined, "delete", "Xóa", "Delete"),
  remove: spec(CloseCircleOutlined, "delete", "Gỡ", "Remove"),
  copy: spec(CopyOutlined, "neutral", "Sao chép", "Copy"),
  settings: spec(SettingOutlined, "neutral", "Cấu hình", "Settings"),

  // — Kết thúc / hủy —
  close: spec(CloseOutlined, "neutral", "Đóng", "Close"),
  cancel: spec(CloseOutlined, "neutral", "Hủy", "Cancel"),
  reset: spec(ReloadOutlined, "neutral", "Đặt lại", "Reset"),
  back: spec(ArrowLeftOutlined, "neutral", "Quay lại", "Back"),
  next: spec(ArrowRightOutlined, "neutral", "Tiếp tục", "Next"),

  // — Phê duyệt / trạng thái —
  approve: spec(CheckCircleOutlined, "success", "Duyệt", "Approve"),
  confirm: spec(CheckOutlined, "primary", "Xác nhận", "Confirm"),
  complete: spec(CheckCircleOutlined, "success", "Hoàn tất", "Complete"),
  reject: spec(CloseCircleOutlined, "danger", "Từ chối", "Reject"),
  activate: spec(CheckCircleOutlined, "success", "Kích hoạt", "Activate"),
  deactivate: spec(StopOutlined, "danger", "Vô hiệu hóa", "Deactivate"),
  lock: spec(LockOutlined, "danger", "Khóa", "Lock"),
  unlock: spec(UnlockOutlined, "success", "Mở khóa", "Unlock"),
  start: spec(PlayCircleOutlined, "success", "Bắt đầu", "Start"),
  stop: spec(StopOutlined, "danger", "Dừng", "Stop"),

  // — Quét / đồng bộ —
  scan: spec(ScanOutlined, "sync", "Quét mã", "Scan code"),
  camera: spec(CameraOutlined, "sync", "Quét bằng camera", "Scan with camera"),
  barcode: spec(BarcodeOutlined, "sync", "Mã vạch", "Barcode"),
  sync: spec(SyncOutlined, "sync", "Đồng bộ", "Sync"),
  refresh: spec(ReloadOutlined, "sync", "Làm mới", "Refresh"),
  undo: spec(UndoOutlined, "sync", "Hoàn tác", "Undo"),
  reverse: spec(RollbackOutlined, "sync", "Hoàn đảo", "Reverse"),
  swap: spec(SwapOutlined, "sync", "Chuyển đổi", "Swap"),
  assign: spec(UserSwitchOutlined, "sync", "Gán", "Assign"),

  // — Dữ liệu vào/ra —
  upload: spec(UploadOutlined, "upload", "Tải lên", "Upload"),
  import: spec(ImportOutlined, "upload", "Nhập dữ liệu", "Import data"),
  download: spec(DownloadOutlined, "download", "Tải xuống", "Download"),
  export: spec(ExportOutlined, "download", "Xuất dữ liệu", "Export data"),
  exportExcel: spec(
    FileExcelOutlined,
    "download",
    "Xuất Excel",
    "Export Excel",
  ),
  exportPdf: spec(FilePdfOutlined, "download", "Xuất PDF", "Export PDF"),
  attach: spec(PaperClipOutlined, "upload", "Đính kèm", "Attach"),
  publish: spec(
    CloudUploadOutlined,
    "success",
    "Đưa lên ứng dụng",
    "Publish to app",
  ),
  unpublish: spec(
    CloudDownloadOutlined,
    "danger",
    "Gỡ khỏi ứng dụng",
    "Unpublish from app",
  ),
  send: spec(SendOutlined, "upload", "Gửi", "Send"),
  report: spec(FileTextOutlined, "view", "Báo cáo", "Report"),
  repair: spec(ToolOutlined, "edit", "Sửa chữa", "Repair"),
  more: spec(MoreOutlined, "neutral", "Thao tác", "Actions"),

  // — Tài khoản / phân quyền —
  login: spec(KeyOutlined, "success", "Đăng nhập", "Sign in"),
  logout: spec(LogoutOutlined, "danger", "Đăng xuất", "Sign out"),
  password: spec(LockOutlined, "edit", "Đổi mật khẩu", "Change password"),
  grant: spec(
    SafetyCertificateOutlined,
    "success",
    "Cấp quyền",
    "Grant permission",
  ),
  revoke: spec(DisconnectOutlined, "danger", "Thu hồi", "Revoke"),
  clear: spec(CloseCircleOutlined, "neutral", "Bỏ chọn", "Clear selection"),
  rfid: spec(WifiOutlined, "sync", "RFID", "RFID"),
};

/** Mã màu chuẩn của 1 hành động. */
export function actionColor(kind: ActionKind): string {
  return ACTION_ICON_COLORS[ACTION_KINDS[kind].tone];
}

/**
 * Dựng icon chuẩn (đã tô đúng màu) của 1 hành động.
 * Dùng khi cần truyền icon vào component bên thứ ba không nhận `kind`.
 */
export function actionIcon(kind: ActionKind) {
  const Icon = ACTION_KINDS[kind].icon;
  return <Icon style={{ color: actionColor(kind) }} />;
}
