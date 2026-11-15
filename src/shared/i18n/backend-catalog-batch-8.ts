/** Complete source messages missed by generic UI template coverage. */
export const BACKEND_CATALOG_BATCH_8: ReadonlyArray<
  readonly [source: string, en: string, zh: string]
> = [
  [
    "Thiếu migration aggregate_mutexes của WWHN-172.",
    "The aggregate_mutexes migration for WWHN-172 is missing.",
    "缺少 WWHN-172 的 aggregate_mutexes 迁移。",
  ],
  [
    "Vượt quá giới hạn truy cập danh mục PV công khai. Vui lòng thử lại sau.",
    "The public PV catalog access limit was exceeded. Please try again later.",
    "公开 PV 目录访问次数已达上限，请稍后重试。",
  ],
  [
    "Vượt quá giới hạn làm mới phiên đăng nhập. Vui lòng thử lại sau.",
    "The session refresh limit was exceeded. Please try again later.",
    "登录会话刷新次数已达上限，请稍后重试。",
  ],
  [
    "Vượt quá giới hạn yêu cầu xác minh thiết bị. Vui lòng thử lại sau.",
    "The device verification request limit was exceeded. Please try again later.",
    "设备验证请求次数已达上限，请稍后重试。",
  ],
  [
    "Vượt quá giới hạn số lần gọi cho phép. Vui lòng thử lại sau.",
    "The allowed request limit was exceeded. Please try again later.",
    "请求次数已达上限，请稍后重试。",
  ],
  [
    "Ciphertext PII không thuộc về cột này (context không khớp) — dấu hiệu dữ liệu bị chép chéo giữa các cột/hồ sơ.",
    "The PII ciphertext does not belong to this column (context mismatch), indicating data copied between columns or records.",
    "PII 密文不属于此列（上下文不匹配），表明数据可能被跨列或跨记录复制。",
  ],
  [
    "APP_KEY trống — không dẫn xuất được khoá PII cho môi trường dev.",
    "APP_KEY is empty; a PII key cannot be derived for the development environment.",
    "APP_KEY 为空，无法为开发环境派生 PII 密钥。",
  ],
  [
    "Nhập mã xác thực hai bước để hoàn tất đăng nhập.",
    "Enter your two-step verification code to complete sign-in.",
    "请输入两步验证码以完成登录。",
  ],
  [
    "Làm mới token thành công",
    "Token refreshed successfully.",
    "Token 刷新成功。",
  ],
  [
    "Cập nhật hồ sơ thành công",
    "Profile updated successfully.",
    "档案更新成功。",
  ],
  ["Đã đăng xuất thiết bị", "Device signed out.", "已退出设备登录。"],
  [
    "Đổi mật khẩu thành công",
    "Password changed successfully.",
    "密码修改成功。",
  ],
  [
    "Chuyển ngữ cảnh thành công",
    "Context switched successfully.",
    "上下文切换成功。",
  ],
  [
    "Tạo phòng ban thành công.",
    "Department created successfully.",
    "部门创建成功。",
  ],
  [
    "Đã bật xác thực hai bước. Hãy lưu mã khôi phục ở nơi an toàn — chúng không hiển thị lại.",
    "Two-step verification enabled. Save your recovery codes somewhere safe; they will not be shown again.",
    "已启用两步验证。请将恢复码保存在安全位置，之后将不再显示。",
  ],
  [
    "Nhập mật khẩu hiện tại để thay đổi email.",
    "Enter your current password to change your email.",
    "请输入当前密码以更改邮箱。",
  ],
  ["Đã thu hồi phiên đăng nhập", "Login session revoked.", "已撤销登录会话。"],
  ["Xác thực OTP thành công", "OTP verification succeeded.", "OTP 验证成功。"],
  ["Tạo role thành công", "Role created successfully.", "角色创建成功。"],
  ["Cập nhật role thành công", "Role updated successfully.", "角色更新成功。"],
  ["Xoá role thành công", "Role deleted successfully.", "角色删除成功。"],
  [
    "Gán permission cho role thành công",
    "Permission assigned to the role successfully.",
    "角色权限分配成功。",
  ],
  ["Tạo người dùng thành công", "User created successfully.", "用户创建成功。"],
  [
    "Cập nhật người dùng thành công",
    "User updated successfully.",
    "用户更新成功。",
  ],
  [
    "Gán role cho người dùng thành công",
    "Role assigned to the user successfully.",
    "用户角色分配成功。",
  ],
  [
    "Cấp quyền riêng cho người dùng thành công",
    "Individual permission granted to the user successfully.",
    "用户单独权限授予成功。",
  ],
  [
    "Thu hồi quyền cấp riêng thành công",
    "Individual permission revoked successfully.",
    "单独权限撤销成功。",
  ],
  [
    "Thiếu mật khẩu tài khoản fixture: đặt WMS_FIXTURE_PASSWORD trong .env (local) hoặc secret store (UAT/demo). Seeder không còn mật khẩu mặc định trong source.",
    "The fixture account password is missing: set WMS_FIXTURE_PASSWORD in .env (local) or the secret store (UAT/demo). The seeder no longer has a default password in source.",
    "缺少测试账户密码：请在 .env（本地）或密钥存储（UAT/demo）中设置 WMS_FIXTURE_PASSWORD。填充程序源码中已无默认密码。",
  ],
  ["Tạo đại lý thành công", "Agency created successfully.", "经销商创建成功。"],
  [
    "Cập nhật đại lý thành công",
    "Agency updated successfully.",
    "经销商更新成功。",
  ],
  [
    "Thiếu If-Match hợp lệ khi cập nhật phiếu nhập.",
    "A valid If-Match is missing for the inbound document update.",
    "更新入库单时缺少有效的 If-Match。",
  ],
  [
    "Thiếu If-Match hợp lệ.",
    "A valid If-Match is missing.",
    "缺少有效的 If-Match。",
  ],
  [
    "Tạo container thành công",
    "Container created successfully.",
    "容器创建成功。",
  ],
  [
    "Cập nhật container thành công",
    "Container updated successfully.",
    "容器更新成功。",
  ],
  [
    "Gán item vào container thành công",
    "Item assigned to the container successfully.",
    "实物放入容器成功。",
  ],
  [
    "Gỡ item khỏi container thành công",
    "Item removed from the container successfully.",
    "实物移出容器成功。",
  ],
  [
    "Hồ sơ bảo hành đã đóng nên không xuất linh kiện được {value0}.",
    "The warranty case is closed, so components cannot be issued {value0}.",
    "保修单已关闭，无法领用配件 {value0}。",
  ],
  [
    "Đã tạo phiếu xuất linh kiện (DRAFT); tồn kho chưa thay đổi (stock_effect=NONE).",
    "Component issue document created (DRAFT); inventory is unchanged (stock_effect=NONE).",
    "已创建配件出库单（DRAFT），库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã tạo phiếu xuất linh kiện (Nháp); tồn kho chưa thay đổi (stock_effect=NONE).",
    "Component issue document created (DRAFT); inventory is unchanged (stock_effect=NONE).",
    "已创建配件出库单（DRAFT），库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã thêm dòng linh kiện vào phiếu; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Component line added to the document; inventory is unchanged (stock_effect=NONE).",
    "已向单据添加配件明细，库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã cập nhật dòng linh kiện; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Component line updated; inventory is unchanged (stock_effect=NONE).",
    "已更新配件明细，库存未变（stock_effect=NONE）。",
  ],
  [
    "Dòng còn bằng chứng quét; gỡ hết dòng quét (unscan) trước khi xoá.",
    "The line still has scan evidence; remove all scanned entries (unscan) before deleting it.",
    "明细仍有扫描凭证，请先移除全部扫描记录（unscan）再删除。",
  ],
  [
    "Dòng SKU của phiếu xuất sinh từ toa không được sửa; hãy huỷ phiếu và tạo lại nếu cần đổi hàng.",
    "SKU lines on an outbound document generated from a request cannot be edited; cancel and recreate the document to change products.",
    "由申请单生成的出库单不能修改 SKU 明细，如需更换商品，请取消并重建单据。",
  ],
  [
    "Tạo phiếu nhập kho thành công.",
    "Inbound document created successfully.",
    "入库单创建成功。",
  ],
  [
    "Tạo phiếu xuất kho thành công.",
    "Outbound document created successfully.",
    "出库单创建成功。",
  ],
  [
    "Đã cập nhật cấu hình máy in.",
    "Printer configuration updated.",
    "已更新打印机配置。",
  ],
  [
    "Thiếu cột bắt buộc {value0}.",
    "Required column {value0} is missing.",
    "缺少必填列 {value0}。",
  ],
  [
    "Thiếu recipient_name/customer_name.",
    "recipient_name/customer_name is missing.",
    "缺少 recipient_name/customer_name。",
  ],
  ["Tạo SKU thành công.", "SKU created successfully.", "SKU 创建成功。"],
  [
    "Dòng đã quét không thuộc phiếu nhập này.",
    "The scanned line does not belong to this inbound document.",
    "扫描明细不属于此入库单。",
  ],
  [
    "Còn SKU mới chưa đủ thông tin. Bổ sung tên và đơn vị tính cho các SKU này trước khi ghi nhận nhập kho.",
    "Some new SKUs have incomplete information. Add their names and units before posting the receipt.",
    "部分新 SKU 信息不完整，请补充名称和计量单位后再记录入库。",
  ],
  [
    "Đã tải lên tệp đính kèm bảo hành; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Warranty attachment uploaded; inventory is unchanged (stock_effect=NONE).",
    "已上传保修附件，库存未变（stock_effect=NONE）。",
  ],
  [
    "Sửa thông tin khách hàng cần quyền warranty.pii.view.",
    "Editing customer information requires warranty.pii.view permission.",
    "编辑客户信息需要 warranty.pii.view 权限。",
  ],
  [
    "Đã cập nhật ca bảo hành; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Warranty case updated; inventory is unchanged (stock_effect=NONE).",
    "已更新保修单，库存未变（stock_effect=NONE）。",
  ],
  [
    "Tạo danh mục lỗi thành công",
    "Defect catalog entry created successfully.",
    "故障目录条目创建成功。",
  ],
  [
    "Cập nhật danh mục lỗi thành công",
    "Defect catalog entry updated successfully.",
    "故障目录条目更新成功。",
  ],
  [
    "Lỗi đã được gán vào hồ sơ bảo hành nên không đổi được defect_code.",
    "The defect is assigned to a warranty case, so defect_code cannot be changed.",
    "故障已用于保修单，无法更改 defect_code。",
  ],
  [
    "Đã tải lên chứng từ đính kèm; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Document attachment uploaded; inventory is unchanged (stock_effect=NONE).",
    "已上传单据附件，库存未变（stock_effect=NONE）。",
  ],
  [
    "Tạo lô nhập khẩu thành công",
    "Import batch created successfully.",
    "进口批次创建成功。",
  ],
  [
    "Cập nhật lô nhập khẩu thành công",
    "Import batch updated successfully.",
    "进口批次更新成功。",
  ],
  [
    "Vượt giới hạn 10.000 dòng xuất.",
    "The export limit of 10,000 rows was exceeded.",
    "已超过 10,000 行导出限制。",
  ],
  [
    "Phiếu đã ghi sổ hoặc đã huỷ — không sửa được thông tin SKU ở đây nữa.",
    "The document is posted or cancelled; SKU information can no longer be edited here.",
    "单据已过账或取消，无法在此继续编辑 SKU 信息。",
  ],
  [
    "SKU này đã có trong kho và đã đủ thông tin — sửa ở màn Danh mục SKU.",
    "This SKU already exists in inventory and has complete information; edit it in the SKU catalog.",
    "此 SKU 已在库且信息完整，请到 SKU 目录编辑。",
  ],
  [
    "Đã bổ sung thông tin cho SKU mới.",
    "Information added for the new SKU.",
    "已补充新 SKU 信息。",
  ],
  [
    "Tạo item instance thành công",
    "Item instance created successfully.",
    "实物实例创建成功。",
  ],
  [
    "Cập nhật item instance thành công",
    "Item instance updated successfully.",
    "实物实例更新成功。",
  ],
  [
    "Tổng số lượng rút từ hộp vượt quá tồn của hộp.",
    "The total quantity withdrawn from the box exceeds its stock.",
    "从箱中取出的总数量超过箱内库存。",
  ],
  [
    "SKU [{value0}] là {value1}, không phải linh kiện — mã hộp linh kiện chỉ dùng cho SKU COMPONENT.",
    "SKU [{value0}] is {value1}, not a component; component box codes only apply to COMPONENT SKUs.",
    "SKU [{value0}] 为 {value1}，不是配件；配件箱码仅适用于 COMPONENT SKU。",
  ],
  [
    "SKU [{value0}] là {value1}, không phải linh kiện — mã hộp linh kiện chỉ dùng cho SKU Linh kiện.",
    "SKU [{value0}] is {value1}, not a component; component box codes only apply to COMPONENT SKUs.",
    "SKU [{value0}] 为 {value1}，不是配件；配件箱码仅适用于 COMPONENT SKU。",
  ],
  [
    "Hộp [{value0}] chưa được nhập kho nên không có tồn để xuất. Nhập hộp qua phiếu nhập trước.",
    "Box [{value0}] has not been received into stock, so it has no stock to issue. Receive it through an inbound document first.",
    "箱 [{value0}] 尚未入库，无库存可出库。请先通过入库单接收入库。",
  ],
  [
    "Hộp không còn ở trạng thái mang tồn (đã CLOSED/ISSUED hoặc rỗng).",
    "The box no longer has a stock-bearing status (CLOSED/ISSUED or empty).",
    "箱已不处于承载库存状态（CLOSED/ISSUED 或为空）。",
  ],
  [
    "Hộp không gắn với SKU linh kiện ACTIVE.",
    "The box is not linked to an ACTIVE component SKU.",
    "箱未关联 ACTIVE 状态的配件 SKU。",
  ],
  [
    "Hộp không gắn với SKU linh kiện Đang hoạt động.",
    "The box is not linked to an ACTIVE component SKU.",
    "箱未关联 ACTIVE 状态的配件 SKU。",
  ],
  [
    "Hộp không còn linh kiện nào để xuất.",
    "The box has no components left to issue.",
    "箱内已无配件可出库。",
  ],
  [
    "Tổng số lượng các dòng không khớp expected_total_qty.",
    "The total line quantity does not match expected_total_qty.",
    "明细总数量与 expected_total_qty 不匹配。",
  ],
  [
    "Tổng số lượng SKU vượt tồn khả dụng; chưa ghi nhận batch.",
    "The total SKU quantity exceeds available stock; the batch was not recorded.",
    "SKU 总数量超过可用库存，尚未记录批次。",
  ],
  [
    "Thiếu quyền physical_code.assign_rfid.",
    "Missing physical_code.assign_rfid permission.",
    "缺少 physical_code.assign_rfid 权限。",
  ],
  [
    "Tạo mã vật lý thành công",
    "Physical code created successfully.",
    "物理编码创建成功。",
  ],
  [
    "Cập nhật mã vật lý thành công",
    "Physical code updated successfully.",
    "物理编码更新成功。",
  ],
  ["Tạo SKU thành công", "SKU created successfully.", "SKU 创建成功。"],
  ["Cập nhật SKU thành công", "SKU updated successfully.", "SKU 更新成功。"],
  [
    "Bật sản phẩm thành công",
    "Product enabled successfully.",
    "产品启用成功。",
  ],
  [
    "Tắt sản phẩm thành công",
    "Product disabled successfully.",
    "产品停用成功。",
  ],
  [
    "Tạo product master thành công",
    "Product master created successfully.",
    "产品主数据创建成功。",
  ],
  [
    "Cập nhật product master thành công",
    "Product master updated successfully.",
    "产品主数据更新成功。",
  ],
  [
    "Cập nhật trạng thái SKU thành công",
    "SKU status updated successfully.",
    "SKU 状态更新成功。",
  ],
  [
    "Thiếu header Idempotency-Key.",
    "The Idempotency-Key header is missing.",
    "缺少 Idempotency-Key 请求头。",
  ],
  [
    "Tạo dữ liệu App PV thành công.",
    "App PV data created successfully.",
    "App PV 数据创建成功。",
  ],
  [
    "Thao tác reversal bắt buộc header If-Match.",
    "A reversal requires an If-Match header.",
    "冲销操作需要 If-Match 请求头。",
  ],
  [
    "Thao tác điều chỉnh tồn kho bắt buộc header If-Match.",
    "A reversal requires an If-Match header.",
    "冲销操作需要 If-Match 请求头。",
  ],
  [
    "Tạo chứng từ điều chỉnh thành công.",
    "Adjustment document created successfully.",
    "调整单创建成功。",
  ],
  ["Tạo yêu cầu thành công", "Request created successfully.", "申请创建成功。"],
  [
    "Cập nhật yêu cầu thành công",
    "Request updated successfully.",
    "申请更新成功。",
  ],
  ["Xóa yêu cầu thành công", "Request deleted successfully.", "申请删除成功。"],
  [
    "Chuyển đổi sang phiếu nghiệp vụ thành công",
    "Converted to a business document successfully.",
    "已成功转换为业务单据。",
  ],
  [
    "Đã hủy yêu cầu thành công",
    "Request cancelled successfully.",
    "申请取消成功。",
  ],
  [
    "Phiên bản vượt giới hạn cho phép.",
    "The version exceeds the allowed limit.",
    "版本超出允许上限。",
  ],
  [
    "Phiên bản nhà cung cấp đã đạt giới hạn.",
    "The supplier version reached its limit.",
    "供应商版本已达上限。",
  ],
  [
    "Tạo phiếu điều chuyển thành công",
    "Transfer document created successfully.",
    "调拨单创建成功。",
  ],
  [
    "Cập nhật phiếu điều chuyển thành công",
    "Transfer document updated successfully.",
    "调拨单更新成功。",
  ],
  [
    "Dữ liệu đầu vào không hợp lệ",
    "The input data is invalid.",
    "输入数据无效。",
  ],
  ["Tạo kho thành công", "Warehouse created successfully.", "仓库创建成功。"],
  [
    "Cập nhật kho thành công",
    "Warehouse updated successfully.",
    "仓库更新成功。",
  ],
  [
    "Tiếp nhận TEMP_ONLY thành công",
    "TEMP_ONLY intake succeeded.",
    "TEMP_ONLY 接收成功。",
  ],
  [
    "Tạo batch scan thành công",
    "Scan batch created successfully.",
    "扫描批次创建成功。",
  ],
  [
    "Thiếu quyền inventory.view cho truy vết tồn kho.",
    "Missing inventory.view permission for inventory tracing.",
    "缺少库存追溯所需的 inventory.view 权限。",
  ],
  [
    "Dòng nhập COMPONENT bắt buộc phải gắn BOX trước khi scan.",
    "A COMPONENT inbound line must be linked to a BOX before scanning.",
    "COMPONENT 入库明细必须先关联 BOX 才能扫描。",
  ],
  [
    "Dòng nhập Linh kiện bắt buộc phải gắn BOX trước khi scan.",
    "A COMPONENT inbound line must be linked to a BOX before scanning.",
    "COMPONENT 入库明细必须先关联 BOX 才能扫描。",
  ],
  [
    "Phiên bản contract xuất linh kiện không được hỗ trợ.",
    "The component issue contract version is not supported.",
    "不支持此配件出库契约版本。",
  ],
  [
    "Đối chiếu lượt bị từ chối rồi prepare phục hồi có định danh.",
    "Reconcile the rejected attempt, then prepare recovery with an identifier.",
    "请核对被拒绝的尝试，再准备带标识的恢复操作。",
  ],
  [
    "Nhận diện mã đã thay đổi; không xác nhận từ kết quả cũ.",
    "Code identification changed; do not confirm using an old result.",
    "编码识别结果已更改，请勿根据旧结果确认。",
  ],
  [
    "Phiên bản contract lịch sử NFC chưa được hỗ trợ.",
    "The NFC history contract version is not supported yet.",
    "尚不支持此 NFC 历史契约版本。",
  ],
  [
    "Phiên bản contract upload không được hỗ trợ.",
    "The upload contract version is not supported.",
    "不支持此上传契约版本。",
  ],
  [
    "Thiếu quyền đọc tệp bảo hành.",
    "Missing permission to read warranty files.",
    "缺少读取保修文件的权限。",
  ],
  [
    "SKU chưa có trong hệ thống — hãy chọn đây là Sản phẩm hay Linh kiện trước khi ghi nhận.",
    "The SKU is not in the system; select Product or Component before recording.",
    "系统中不存在此 SKU，请先选择产品或配件再记录。",
  ],
  [
    "Thiếu line_id cho scan không kèm code_value.",
    "line_id is missing for a scan without code_value.",
    "未附带 code_value 的扫描缺少 line_id。",
  ],
  [
    "Hợp lệ theo baseline hiện hành",
    "Valid under the current baseline.",
    "符合当前基准。",
  ],
  [
    "Thiếu cột bắt buộc: sku_code (hoặc alias legacy code).",
    "Required column missing: sku_code (or legacy alias code).",
    "缺少必填列：sku_code（或旧版别名 code）。",
  ],
  [
    "Thiếu cột bắt buộc: sku_name (hoặc alias legacy name).",
    "Required column missing: sku_name (or legacy alias name).",
    "缺少必填列：sku_name（或旧版别名 name）。",
  ],
  [
    "Đối chiếu receipt lưu gần nhất trước khi hủy; không hủy yêu cầu chưa rõ kết quả.",
    "Reconcile the latest saved receipt before cancelling; do not cancel a request with an unknown result.",
    "取消前请核对最近保存的回执，不得取消结果未明的请求。",
  ],
  [
    "Phiên bản phiếu đã thay đổi; không tự gửi lại lệnh.",
    "The document version changed; do not resend the command automatically.",
    "单据版本已更改，请勿自动重发命令。",
  ],
  [
    "Thiếu phiên bản mới xác nhận lệnh của owner.",
    "The new version confirming the owner's command is missing.",
    "缺少确认所属方命令的新版本。",
  ],
  [
    "Thiếu bằng chứng quét riêng của lệnh; không dùng dòng hoặc sự kiện cũ thay thế.",
    "Command-specific scan evidence is missing; old lines or events cannot be used as substitutes.",
    "缺少该命令专属的扫描凭证，不得用旧明细或事件替代。",
  ],
  [
    "Thiếu timestamp hoặc movement xác nhận của lệnh Post.",
    "The Post command's confirming timestamp or movement is missing.",
    "缺少 Post 命令的确认时间戳或库存变动记录。",
  ],
  [
    "Tổng Post không khớp snapshot; giao dịch được hoàn tác.",
    "The Post total does not match the snapshot; the transaction was rolled back.",
    "Post 合计与快照不匹配，交易已回滚。",
  ],
  [
    "SKU đã tồn tại — import này chỉ tạo mới, không cập nhật.",
    "The SKU already exists; this import only creates new SKUs and does not update existing ones.",
    "SKU 已存在；此次导入仅创建新 SKU，不更新现有 SKU。",
  ],
  [
    "Hand Tools không có nguồn điện — power_source phải là null.",
    "Hand Tools have no power source; power_source must be null.",
    "手动工具没有电源，power_source 必须为 null。",
  ],
  [
    "Dòng item serial bắt buộc có raw_code khi scan.",
    "A serial item line requires raw_code when scanning.",
    "序列号实物明细扫描时需要 raw_code。",
  ],
  [
    "Dòng item serial chỉ được ghi nhận số lượng 1.",
    "A serial item line can only record quantity 1.",
    "序列号实物明细只能记录数量 1。",
  ],
  [
    "Chi tiết cần đúng recordId và activityId; không chọn sự kiện đầu tiên.",
    "Details require the exact recordId and activityId; do not select the first event.",
    "详情需要准确的 recordId 和 activityId，不得默认选择首个事件。",
  ],
  [
    "Thiếu quyền đọc lịch sử.",
    "Missing permission to read history.",
    "缺少读取历史记录的权限。",
  ],
  [
    "Thiếu quyền đọc nguồn NFC.",
    "Missing permission to read the NFC source.",
    "缺少读取 NFC 来源的权限。",
  ],
  [
    "Thiếu schema nguồn audit NFC.",
    "The NFC audit source schema is missing.",
    "缺少 NFC 审计来源结构。",
  ],
  [
    "Lỗi in giả lập UIUX",
    "Simulated UIUX print error.",
    "模拟 UIUX 打印错误。",
  ],
];
