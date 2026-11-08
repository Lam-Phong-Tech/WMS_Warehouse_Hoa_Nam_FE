export const NOTIFICATION_CONTENT_VI = {
  inboundCreated: {
    title: "Đã tạo phiếu nhập mới",
    body: "Phiếu nhập {document} vừa được tạo ở trạng thái Nháp.",
  },
  inboundScanning: {
    title: "Đã bắt đầu quét",
    body: "Phiếu nhập {document} đã chuyển sang trạng thái Đang quét.",
  },
  inboundCompleted: {
    title: "Đã hoàn tất nhập kho",
    body: "Phiếu nhập {document} đã được ghi nhận nhập kho thành công.",
  },
  inboundCancelled: {
    title: "Đã hủy chứng từ",
    body: "Phiếu nhập {document} đã bị hủy.",
  },
  outboundCreated: {
    title: "Đã tạo phiếu xuất mới",
    body: "Phiếu xuất {document} vừa được tạo ở trạng thái Nháp.",
  },
  outboundScanning: {
    title: "Đã bắt đầu quét",
    body: "Phiếu xuất {document} đã chuyển sang trạng thái Đang quét.",
  },
  outboundPosted: {
    title: "Đã hoàn tất xuất kho",
    body: "Phiếu xuất {document} đã được ghi nhận xuất kho; tồn kho đã được trừ.",
  },
  outboundCancelled: {
    title: "Đã hủy chứng từ",
    body: "Phiếu xuất {document} đã bị hủy.",
  },
  inboundSkuPending: {
    title: "Phiếu nhập chờ bổ sung thông tin SKU",
    body: "Phiếu nhập {document} có SKU chưa đủ thông tin ({skus}). Bổ sung tên và đơn vị tính trước khi ghi nhận nhập kho.",
  },
  reversalCreated: {
    title: "Đã tạo phiếu điều chỉnh",
    body: "Phiếu điều chỉnh {document} đang chờ xác nhận hàng vật lý quay lại kho.",
  },
  reversalPosted: {
    title: "Đã ghi nhận điều chỉnh tồn kho",
    body: "Phiếu điều chỉnh {document} đã được ghi sổ; biến động điều chỉnh đã được ghi nhận.",
  },
  reversalCancelled: {
    title: "Đã hủy phiếu điều chỉnh",
    body: "Phiếu điều chỉnh {document} đã bị hủy.",
  },
  stockShortage: {
    title: "Tồn kho không đủ",
    body: "Thao tác trên phiếu {document} thất bại do tồn kho không đủ cho sản phẩm {product}.",
  },
  rolePermissions: {
    title: "Phân quyền vai trò đã thay đổi",
    body: "Danh sách quyền của vai trò {role} vừa được cập nhật.",
  },
  userCreated: {
    title: "Tài khoản mới được tạo",
    body: "Một tài khoản người dùng mới vừa được tạo trong hệ thống.",
  },
  userUpdated: {
    title: "Tài khoản của bạn đã được cập nhật",
    body: "Thông tin tài khoản của bạn vừa được quản trị viên cập nhật.",
  },
  userLocked: {
    title: "Tài khoản đã tự động khóa",
    body: "Tài khoản đã bị khóa do không đăng nhập lần đầu trong vòng 7 ngày kể từ khi được cấp.",
  },
  warrantyCreated: {
    title: "Đã tiếp nhận hồ sơ bảo hành mới",
    body: "Hồ sơ bảo hành {case} vừa được tiếp nhận.",
  },
  warrantyStatus: {
    title: "Hồ sơ bảo hành đổi trạng thái",
    body: "Hồ sơ bảo hành chuyển từ {from} sang {to}.",
  },
  securityThrottled: {
    title: "Cảnh báo bảo mật đăng nhập",
    body: "Phát hiện nhiều lần đăng nhập sai liên tiếp; một định danh đã bị tạm khóa thử đăng nhập.",
  },
  securityDenied: {
    title: "Cảnh báo bảo mật đăng nhập",
    body: "Tài khoản {account} bị từ chối đăng nhập vì đang ở trạng thái {status}.",
  },
  states: {
    received: "Đã tiếp nhận",
    checking: "Đang kiểm tra",
    repairing: "Đang sửa chữa",
    ready: "Sẵn sàng trả",
    returned: "Đã trả",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
    active: "Đang hoạt động",
    inactive: "Ngừng hoạt động",
    locked: "Đã khóa",
  },
} as const;

export const NOTIFICATION_CONTENT_EN = {
  inboundCreated: {
    title: "Inbound document created",
    body: "Inbound document {document} was created as a draft.",
  },
  inboundScanning: {
    title: "Scanning started",
    body: "Inbound document {document} is now being scanned.",
  },
  inboundCompleted: {
    title: "Inbound completed",
    body: "Inbound document {document} was successfully received into stock.",
  },
  inboundCancelled: {
    title: "Document cancelled",
    body: "Inbound document {document} was cancelled.",
  },
  outboundCreated: {
    title: "Outbound document created",
    body: "Outbound document {document} was created as a draft.",
  },
  outboundScanning: {
    title: "Scanning started",
    body: "Outbound document {document} is now being scanned.",
  },
  outboundPosted: {
    title: "Outbound completed",
    body: "Outbound document {document} was posted successfully; stock was deducted.",
  },
  outboundCancelled: {
    title: "Document cancelled",
    body: "Outbound document {document} was cancelled.",
  },
  inboundSkuPending: {
    title: "Inbound awaiting SKU information",
    body: "Inbound document {document} contains incomplete SKUs ({skus}). Add their names and units before receiving stock.",
  },
  reversalCreated: {
    title: "Reversal document created",
    body: "Reversal document {document} is awaiting confirmation that the goods have physically returned to the warehouse.",
  },
  reversalPosted: {
    title: "Stock adjustment posted",
    body: "Reversal document {document} was posted; the adjusting stock movement was recorded.",
  },
  reversalCancelled: {
    title: "Reversal document cancelled",
    body: "Reversal document {document} was cancelled.",
  },
  stockShortage: {
    title: "Insufficient stock",
    body: "The operation on document {document} failed because stock is insufficient for product {product}.",
  },
  rolePermissions: {
    title: "Role permissions changed",
    body: "The permissions for role {role} were updated.",
  },
  userCreated: {
    title: "New account created",
    body: "A new user account was created in the system.",
  },
  userUpdated: {
    title: "Your account was updated",
    body: "An administrator updated your account information.",
  },
  userLocked: {
    title: "Account automatically locked",
    body: "The account was locked because no first sign-in occurred within seven days of account creation.",
  },
  warrantyCreated: {
    title: "Warranty case received",
    body: "Warranty case {case} was received.",
  },
  warrantyStatus: {
    title: "Warranty case status changed",
    body: "The warranty case changed from {from} to {to}.",
  },
  securityThrottled: {
    title: "Sign-in security alert",
    body: "Repeated failed sign-in attempts were detected; sign-in attempts for an identifier have been temporarily blocked.",
  },
  securityDenied: {
    title: "Sign-in security alert",
    body: "Sign-in was denied for account {account} because its status is {status}.",
  },
  states: {
    received: "Received",
    checking: "Under inspection",
    repairing: "Under repair",
    ready: "Ready for return",
    returned: "Returned",
    completed: "Completed",
    cancelled: "Cancelled",
    active: "Active",
    inactive: "Inactive",
    locked: "Locked",
  },
} as const;

export const NOTIFICATION_CONTENT_ZH = {
  inboundCreated: {
    title: "入库单已创建",
    body: "入库单 {document} 已创建为草稿。",
  },
  inboundScanning: {
    title: "已开始扫描",
    body: "入库单 {document} 已进入扫描状态。",
  },
  inboundCompleted: {
    title: "入库已完成",
    body: "入库单 {document} 已成功登记入库。",
  },
  inboundCancelled: { title: "单据已取消", body: "入库单 {document} 已取消。" },
  outboundCreated: {
    title: "出库单已创建",
    body: "出库单 {document} 已创建为草稿。",
  },
  outboundScanning: {
    title: "已开始扫描",
    body: "出库单 {document} 已进入扫描状态。",
  },
  outboundPosted: {
    title: "出库已完成",
    body: "出库单 {document} 已成功过账，库存已扣减。",
  },
  outboundCancelled: {
    title: "单据已取消",
    body: "出库单 {document} 已取消。",
  },
  inboundSkuPending: {
    title: "入库单等待补充 SKU 信息",
    body: "入库单 {document} 中的 SKU 信息不完整（{skus}）。请先补充名称和计量单位，再登记入库。",
  },
  reversalCreated: {
    title: "冲销单已创建",
    body: "冲销单 {document} 正等待确认货物已实际退回仓库。",
  },
  reversalPosted: {
    title: "库存调整已过账",
    body: "冲销单 {document} 已过账，库存调整记录已生成。",
  },
  reversalCancelled: {
    title: "冲销单已取消",
    body: "冲销单 {document} 已取消。",
  },
  stockShortage: {
    title: "库存不足",
    body: "单据 {document} 的操作失败，产品 {product} 的库存不足。",
  },
  rolePermissions: {
    title: "角色权限已更改",
    body: "角色 {role} 的权限已更新。",
  },
  userCreated: { title: "新账户已创建", body: "系统中已创建新的用户账户。" },
  userUpdated: { title: "您的账户已更新", body: "管理员已更新您的账户信息。" },
  userLocked: {
    title: "账户已自动锁定",
    body: "账户创建后七天内未首次登录，因此已被锁定。",
  },
  warrantyCreated: {
    title: "保修工单已受理",
    body: "保修工单 {case} 已受理。",
  },
  warrantyStatus: {
    title: "保修工单状态已更改",
    body: "保修工单状态已从 {from} 更改为 {to}。",
  },
  securityThrottled: {
    title: "登录安全警报",
    body: "检测到连续多次登录失败，已暂时禁止该标识的登录尝试。",
  },
  securityDenied: {
    title: "登录安全警报",
    body: "账户 {account} 因状态为 {status} 而被拒绝登录。",
  },
  states: {
    received: "已受理",
    checking: "检查中",
    repairing: "维修中",
    ready: "待返还",
    returned: "已返还",
    completed: "已完成",
    cancelled: "已取消",
    active: "启用",
    inactive: "停用",
    locked: "已锁定",
  },
} as const;

export type NotificationContentKey = Exclude<
  keyof typeof NOTIFICATION_CONTENT_VI,
  "states"
>;
