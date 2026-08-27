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

/**
 * ĐĂNG KÝ HÀNH ĐỘNG CHUẨN — nguồn DUY NHẤT của toàn dự án.
 *
 * Mỗi hành động nghiệp vụ ứng với đúng 1 bộ (icon, tông màu, nhãn mặc định).
 * Màn nghiệp vụ KHÔNG được tự chọn icon/màu tại chỗ; chỉ khai `kind` rồi để
 * `<ActionButton kind="..." />` / `<ActionIconButton kind="..." />` dựng UI.
 *
 * Muốn thêm hành động mới: thêm 1 dòng vào đây, KHÔNG thêm icon rời ở màn.
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
  /** Nhãn tiếng Việt mặc định. Màn có thể ghi đè bằng prop `label`. */
  label: string;
}

export const ACTION_KINDS: Record<ActionKind, ActionKindSpec> = {
  // — Đọc —
  view: { icon: EyeOutlined, tone: "view", label: "Xem" },
  detail: { icon: FileTextOutlined, tone: "view", label: "Chi tiết" },
  history: { icon: HistoryOutlined, tone: "view", label: "Lịch sử" },
  trace: { icon: SearchOutlined, tone: "view", label: "Truy vết" },
  search: { icon: SearchOutlined, tone: "view", label: "Tìm kiếm" },
  filter: { icon: FilterOutlined, tone: "view", label: "Lọc" },
  print: { icon: PrinterOutlined, tone: "download", label: "In" },

  // — Ghi —
  create: { icon: PlusOutlined, tone: "primary", label: "Thêm mới" },
  edit: { icon: EditOutlined, tone: "edit", label: "Sửa" },
  save: { icon: SaveOutlined, tone: "primary", label: "Lưu" },
  delete: { icon: DeleteOutlined, tone: "delete", label: "Xóa" },
  remove: { icon: CloseCircleOutlined, tone: "delete", label: "Gỡ" },
  copy: { icon: CopyOutlined, tone: "neutral", label: "Sao chép" },
  settings: { icon: SettingOutlined, tone: "neutral", label: "Cấu hình" },

  // — Kết thúc / hủy —
  close: { icon: CloseOutlined, tone: "neutral", label: "Đóng" },
  cancel: { icon: CloseOutlined, tone: "neutral", label: "Hủy" },
  reset: { icon: ReloadOutlined, tone: "neutral", label: "Đặt lại" },
  back: { icon: ArrowLeftOutlined, tone: "neutral", label: "Quay lại" },
  next: { icon: ArrowRightOutlined, tone: "neutral", label: "Tiếp tục" },

  // — Phê duyệt / trạng thái —
  approve: { icon: CheckCircleOutlined, tone: "success", label: "Duyệt" },
  confirm: { icon: CheckOutlined, tone: "primary", label: "Xác nhận" },
  complete: { icon: CheckCircleOutlined, tone: "success", label: "Hoàn tất" },
  reject: { icon: CloseCircleOutlined, tone: "danger", label: "Từ chối" },
  activate: { icon: CheckCircleOutlined, tone: "success", label: "Kích hoạt" },
  deactivate: { icon: StopOutlined, tone: "danger", label: "Vô hiệu hóa" },
  lock: { icon: LockOutlined, tone: "danger", label: "Khóa" },
  unlock: { icon: UnlockOutlined, tone: "success", label: "Mở khóa" },
  start: { icon: PlayCircleOutlined, tone: "success", label: "Bắt đầu" },
  stop: { icon: StopOutlined, tone: "danger", label: "Dừng" },

  // — Quét / đồng bộ —
  scan: { icon: ScanOutlined, tone: "sync", label: "Quét mã" },
  camera: { icon: CameraOutlined, tone: "sync", label: "Quét bằng camera" },
  barcode: { icon: BarcodeOutlined, tone: "sync", label: "Mã vạch" },
  sync: { icon: SyncOutlined, tone: "sync", label: "Đồng bộ" },
  refresh: { icon: ReloadOutlined, tone: "sync", label: "Làm mới" },
  undo: { icon: UndoOutlined, tone: "sync", label: "Hoàn tác" },
  reverse: { icon: RollbackOutlined, tone: "sync", label: "Hoàn đảo" },
  swap: { icon: SwapOutlined, tone: "sync", label: "Chuyển đổi" },
  assign: { icon: UserSwitchOutlined, tone: "sync", label: "Gán" },

  // — Dữ liệu vào/ra —
  upload: { icon: UploadOutlined, tone: "upload", label: "Tải lên" },
  import: { icon: ImportOutlined, tone: "upload", label: "Nhập dữ liệu" },
  download: { icon: DownloadOutlined, tone: "download", label: "Tải xuống" },
  export: { icon: ExportOutlined, tone: "download", label: "Xuất dữ liệu" },
  exportExcel: {
    icon: FileExcelOutlined,
    tone: "download",
    label: "Xuất Excel",
  },
  exportPdf: { icon: FilePdfOutlined, tone: "download", label: "Xuất PDF" },
  attach: { icon: PaperClipOutlined, tone: "upload", label: "Đính kèm" },
  publish: {
    icon: CloudUploadOutlined,
    tone: "success",
    label: "Đưa lên ứng dụng",
  },
  unpublish: {
    icon: CloudDownloadOutlined,
    tone: "danger",
    label: "Gỡ khỏi ứng dụng",
  },
  send: { icon: SendOutlined, tone: "upload", label: "Gửi" },
  report: { icon: FileTextOutlined, tone: "view", label: "Báo cáo" },
  repair: { icon: ToolOutlined, tone: "edit", label: "Sửa chữa" },
  more: { icon: MoreOutlined, tone: "neutral", label: "Thao tác" },

  // — Tài khoản / phân quyền —
  login: { icon: KeyOutlined, tone: "success", label: "Đăng nhập" },
  logout: { icon: LogoutOutlined, tone: "danger", label: "Đăng xuất" },
  password: { icon: LockOutlined, tone: "edit", label: "Đổi mật khẩu" },
  grant: {
    icon: SafetyCertificateOutlined,
    tone: "success",
    label: "Cấp quyền",
  },
  revoke: { icon: DisconnectOutlined, tone: "danger", label: "Thu hồi" },
  clear: { icon: CloseCircleOutlined, tone: "neutral", label: "Bỏ chọn" },
  rfid: { icon: WifiOutlined, tone: "sync", label: "RFID" },
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
