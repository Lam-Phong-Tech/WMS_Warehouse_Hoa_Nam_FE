import type { HTMLAttributes } from "react";

/**
 * Shim thay thế @ant-design/icons bằng Flaticon Uicons (style Regular Rounded,
 * lớp `fi-rr-*`). Mỗi tên export giữ đúng tên component antd cũ (VD:
 * `UserOutlined`) nên các nơi gọi `<UserOutlined />` không cần sửa gì thêm —
 * chỉ cần đổi đường dẫn import sang module này.
 *
 * CSS font của Uicons được nạp một lần ở src/main.tsx
 * (@flaticon/flaticon-uicons/css/regular/rounded.css).
 */
export type FlaticonIconProps = HTMLAttributes<HTMLElement>;

function createFlaticonIcon(slug: string) {
  function FlaticonIcon({ className, ...rest }: FlaticonIconProps) {
    const classes = className
      ? `fi fi-rr-${slug} ${className}`
      : `fi fi-rr-${slug}`;
    return <i className={classes} aria-hidden="true" {...rest} />;
  }
  FlaticonIcon.displayName = `FlaticonIcon(${slug})`;
  return FlaticonIcon;
}

export const AimOutlined = createFlaticonIcon("target");
export const ApartmentOutlined = createFlaticonIcon("apartment");
export const AppstoreOutlined = createFlaticonIcon("apps");
export const ArrowLeftOutlined = createFlaticonIcon("arrow-left");
export const ArrowRightOutlined = createFlaticonIcon("arrow-right");
export const AuditOutlined = createFlaticonIcon("audit");
export const BankOutlined = createFlaticonIcon("bank");
export const BarChartOutlined = createFlaticonIcon("chart-histogram");
export const BarcodeOutlined = createFlaticonIcon("barcode");
export const BellOutlined = createFlaticonIcon("bell");
export const CameraOutlined = createFlaticonIcon("camera");
export const CarOutlined = createFlaticonIcon("car");
export const CheckCircleOutlined = createFlaticonIcon("check-circle");
export const CheckOutlined = createFlaticonIcon("check");
export const CloseCircleOutlined = createFlaticonIcon("cross-circle");
export const CloseOutlined = createFlaticonIcon("cross");
export const CloudDownloadOutlined = createFlaticonIcon("cloud-download");
export const CloudUploadOutlined = createFlaticonIcon("cloud-upload");
export const ClusterOutlined = createFlaticonIcon("network");
export const CopyOutlined = createFlaticonIcon("copy");
export const DeleteOutlined = createFlaticonIcon("trash");
export const DisconnectOutlined = createFlaticonIcon("link-slash");
export const DownOutlined = createFlaticonIcon("angle-down");
export const DownloadOutlined = createFlaticonIcon("download");
export const EditOutlined = createFlaticonIcon("edit");
export const EnvironmentOutlined = createFlaticonIcon("marker");
export const ExclamationCircleFilled = createFlaticonIcon("exclamation");
export const ExpandAltOutlined = createFlaticonIcon("expand");
export const ExperimentOutlined = createFlaticonIcon("flask");
export const ExportOutlined = createFlaticonIcon("file-export");
export const EyeOutlined = createFlaticonIcon("eye");
export const FileExcelOutlined = createFlaticonIcon("file-excel");
export const FilePdfOutlined = createFlaticonIcon("file-pdf");
export const FileSearchOutlined = createFlaticonIcon("search-alt");
export const FileTextOutlined = createFlaticonIcon("document");
export const FundOutlined = createFlaticonIcon("inventory-alt");
export const HistoryOutlined = createFlaticonIcon("time-past");
export const HomeOutlined = createFlaticonIcon("home");
export const IdcardOutlined = createFlaticonIcon("id-badge");
export const ImportOutlined = createFlaticonIcon("file-import");
export const InboxOutlined = createFlaticonIcon("inbox");
export const KeyOutlined = createFlaticonIcon("key");
export const LockOutlined = createFlaticonIcon("lock");
export const LogoutOutlined = createFlaticonIcon("sign-out-alt");
export const MailOutlined = createFlaticonIcon("envelope");
export const MenuFoldOutlined = createFlaticonIcon("angle-left");
export const MenuUnfoldOutlined = createFlaticonIcon("angle-right");
export const MoreOutlined = createFlaticonIcon("menu-dots");
export const NodeIndexOutlined = createFlaticonIcon("sitemap");
export const PaperClipOutlined = createFlaticonIcon("paperclip-vertical");
export const PlayCircleOutlined = createFlaticonIcon("play-circle");
export const PlusOutlined = createFlaticonIcon("plus");
export const PrinterOutlined = createFlaticonIcon("print");
export const ProfileOutlined = createFlaticonIcon("id-card-clip-alt");
export const ReloadOutlined = createFlaticonIcon("refresh");
export const RightOutlined = createFlaticonIcon("caret-right");
export const RollbackOutlined = createFlaticonIcon("rotate-left");
export const SafetyCertificateOutlined = createFlaticonIcon("shield-check");
export const SaveOutlined = createFlaticonIcon("floppy-disks");
export const ScanOutlined = createFlaticonIcon("barcode-scan");
export const SearchOutlined = createFlaticonIcon("search");
export const SendOutlined = createFlaticonIcon("paper-plane");
export const SettingOutlined = createFlaticonIcon("settings");
export const ShopOutlined = createFlaticonIcon("shop");
export const ShoppingCartOutlined = createFlaticonIcon("shopping-cart");
export const ShrinkOutlined = createFlaticonIcon("compress");
export const SolutionOutlined = createFlaticonIcon("diploma");
export const StockOutlined = createFlaticonIcon("warehouse-alt");
export const StopOutlined = createFlaticonIcon("ban");
export const SwapOutlined = createFlaticonIcon("swap");
export const SyncOutlined = createFlaticonIcon("rotate-right");
export const TagOutlined = createFlaticonIcon("tags");
export const TeamOutlined = createFlaticonIcon("users");
export const ToolOutlined = createFlaticonIcon("tool-box");
export const UndoOutlined = createFlaticonIcon("undo");
export const UnorderedListOutlined = createFlaticonIcon("list");
export const UploadOutlined = createFlaticonIcon("upload");
export const UserAddOutlined = createFlaticonIcon("user-add");
export const UserOutlined = createFlaticonIcon("user");
export const UserSwitchOutlined = createFlaticonIcon("exchange");
export const WarningOutlined = createFlaticonIcon("triangle-warning");
export const WifiOutlined = createFlaticonIcon("wifi");
export const ZoomInOutlined = createFlaticonIcon("zoom-in");
export const ZoomOutOutlined = createFlaticonIcon("zoom-out");
export const FilterOutlined = createFlaticonIcon("filter");
export const UnlockOutlined = createFlaticonIcon("unlock");
export const MinusOutlined = createFlaticonIcon("minus");
export const LinkOutlined = createFlaticonIcon("link");
export const SortAscendingOutlined = createFlaticonIcon("caret-up");
export const SortDescendingOutlined = createFlaticonIcon("caret-down");
export const SortOutlined = createFlaticonIcon("sort");
export const ThunderboltOutlined = createFlaticonIcon("bolt");
