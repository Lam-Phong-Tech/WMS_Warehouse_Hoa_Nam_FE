/** Reviewed user-facing backend messages; raw and normalized aliases share translations. */
import { BACKEND_CATALOG_BATCH_1_EXTRA } from "./backend-catalog-batch-1-extra";

export const BACKEND_CATALOG_BATCH_1: ReadonlyArray<
  readonly [string, string, string]
> = [
  [
    "A list contains an undefined element; no partial list is returned.",
    "A list contains an undefined element; no partial list is returned.",
    "列表包含未定义的元素，无法返回不完整列表。",
  ],
  [
    "API create/update chỉ chấp nhận Đang hoạt động hoặc Ngừng hoạt động.",
    "Create/update requests only accept ACTIVE or INACTIVE.",
    "创建或更新请求仅接受 ACTIVE 或 INACTIVE。",
  ],
  [
    "API create/update chỉ chấp nhận ACTIVE hoặc INACTIVE.",
    "Create/update requests only accept ACTIVE or INACTIVE.",
    "创建或更新请求仅接受 ACTIVE 或 INACTIVE。",
  ],
  [
    "Account is no longer active.",
    "Account is no longer active.",
    "账号已停用。",
  ],
  [
    "An unresolved security command requires reconciliation or audited support, not a new key.",
    "An unresolved security command requires reconciliation or audited support, not a new key.",
    "安全操作尚未确认结果，请核对记录或通过留有审计记录的支持流程处理，不要更换请求键重试。",
  ],
  [
    "Audit chính thất bại; payload đã được đưa vào outbox nhưng policy yêu cầu fail-closed.",
    "The primary audit failed. The payload was queued in the outbox, but policy requires the operation to fail.",
    "主审计写入失败。数据已加入待处理队列，但按策略必须停止本次操作。",
  ],
  [
    "Availability projection exceeds its declared limit; use a smaller page.",
    "Availability projection exceeds its declared limit; use a smaller page.",
    "字段可用性投影超出限制，请减小每页数量。",
  ],
  [
    "BE không trả document_id sau khi tạo phiếu xuất.",
    "The server did not return document_id after creating the issue note.",
    "创建出库单后，服务器未返回 document_id。",
  ],
  [
    "BOX chưa Hoàn tất nhập kho hoặc không ở trạng thái cho phép putaway.",
    "The BOX receipt has not been posted, or its status does not allow putaway.",
    "BOX 尚未完成入库，或当前状态不允许上架。",
  ],
  [
    "BOX chưa POST Receipt hoặc không ở trạng thái cho phép putaway.",
    "The BOX receipt has not been posted, or its status does not allow putaway.",
    "BOX 尚未完成入库，或当前状态不允许上架。",
  ],
  [
    "BOX chưa gắn với phiếu nhập đã Đã ghi nhận; Initial Putaway chỉ được tạo sau Hoàn tất nhập kho.",
    "The BOX is not linked to a posted receipt. Initial putaway can only be created after the receipt is posted.",
    "BOX 尚未关联已过账的入库单，完成入库后才能创建首次上架任务。",
  ],
  [
    "BOX chưa gắn với phiếu nhập đã POSTED; Initial Putaway chỉ được tạo sau Post Receipt.",
    "The BOX is not linked to a posted receipt. Initial putaway can only be created after the receipt is posted.",
    "BOX 尚未关联已过账的入库单，完成入库后才能创建首次上架任务。",
  ],
  [
    "BOX không còn gắn với phiếu nhập đã Đã ghi nhận; không thể xác nhận putaway.",
    "The BOX is no longer linked to a posted receipt. Putaway cannot be confirmed.",
    "BOX 已不再关联已过账的入库单，无法确认上架。",
  ],
  [
    "BOX không còn gắn với phiếu nhập đã POSTED; không thể xác nhận putaway.",
    "The BOX is no longer linked to a posted receipt. Putaway cannot be confirmed.",
    "BOX 已不再关联已过账的入库单，无法确认上架。",
  ],
  [
    "BOX không đủ số lượng component yêu cầu.",
    "The BOX does not contain the required component quantity.",
    "BOX 中的配件数量不足。",
  ],
  [
    "BOX không đủ quantity component yêu cầu.",
    "The BOX does not contain the required component quantity.",
    "BOX 中的配件数量不足。",
  ],
  [
    "BOX putaway chỉ áp dụng cho SKU Linh kiện.",
    "BOX putaway only applies to component SKUs.",
    "BOX 上架仅适用于配件 SKU。",
  ],
  [
    "BOX putaway chỉ áp dụng cho SKU COMPONENT.",
    "BOX putaway only applies to component SKUs.",
    "BOX 上架仅适用于配件 SKU。",
  ],
  [
    "BOX đang được dùng bởi một phiếu nhập khác chưa kết thúc.",
    "The BOX is being used by another unfinished receipt.",
    "BOX 正被另一张尚未完成的入库单使用。",
  ],
  [
    "BOX đã có putaway Nháp chưa xử lý.",
    "The BOX already has an unprocessed draft putaway task.",
    "BOX 已有尚未处理的草稿上架任务。",
  ],
  [
    "BOX đã có putaway DRAFT chưa xử lý.",
    "The BOX already has an unprocessed draft putaway task.",
    "BOX 已有尚未处理的草稿上架任务。",
  ],
  [
    "BOX đã tồn tại và hợp lệ.",
    "The BOX already exists and is valid.",
    "BOX 已存在且有效。",
  ],
  [
    "BOX đã được lưu kho, đã Hoàn tất nhập kho hoặc không còn ở trạng thái nhận hàng.",
    "The BOX is already stored, its receipt is posted, or it is no longer available for receiving.",
    "BOX 已上架、已完成入库，或已不处于可收货状态。",
  ],
  [
    "BOX đã được lưu kho, đã Post Receipt hoặc không còn ở trạng thái nhận hàng.",
    "The BOX is already stored, its receipt is posted, or it is no longer available for receiving.",
    "BOX 已上架、已完成入库，或已不处于可收货状态。",
  ],
  [
    "Backend health check degraded.",
    "Backend health check degraded.",
    "后端健康检查发现服务异常。",
  ],
  [
    "Backend health check passed.",
    "Backend health check passed.",
    "后端健康检查通过。",
  ],
  [
    "Balance thay đổi đồng thời; retry sau reload.",
    "The balance was changed concurrently. Reload and try again.",
    "库存余额被其他操作修改，请刷新后重试。",
  ],
  [
    "Barcode/QR legacy không tồn tại hoặc không trỏ tới item đã đăng ký.",
    "The legacy barcode/QR code does not exist or does not identify a registered item.",
    "旧格式条形码或二维码不存在，或未关联已登记物品。",
  ],
  [
    "Barcode/QR/RFID không tồn tại hoặc không Đang hoạt động.",
    "The barcode/QR/RFID code does not exist or is inactive.",
    "条形码、二维码或 RFID 编码不存在或未启用。",
  ],
  [
    "Barcode/QR/RFID không tồn tại hoặc không ACTIVE.",
    "The barcode/QR/RFID code does not exist or is inactive.",
    "条形码、二维码或 RFID 编码不存在或未启用。",
  ],
  [
    "Batch N/N đã gửi nhưng phiếu chưa full-scan; toàn bộ transaction sẽ rollback.",
    "The N/N batch has been submitted, but scanning is incomplete. The entire transaction will be rolled back.",
    "N/N 批次已提交，但单据尚未全部扫描，整个事务将回滚。",
  ],
  [
    "Batch đã ghi nhưng chưa đạt full-scan; toàn bộ transaction sẽ rollback.",
    "The batch was recorded, but scanning is incomplete. The entire transaction will be rolled back.",
    "批次已记录，但尚未全部扫描，整个事务将回滚。",
  ],
  [
    "Biên nhận không thuộc lượt P19 linked đã xác nhận.",
    "The receipt does not belong to the confirmed P19 linked operation.",
    "回执不属于已确认的 P19 关联操作。",
  ],
  [
    "Biên nhận không thuộc snapshot P19 linked.",
    "The receipt does not belong to the P19 linked snapshot.",
    "回执不属于 P19 关联快照。",
  ],
  [
    "Bulk item phải có số lượng > 0.",
    "Bulk item quantity must be greater than 0.",
    "散装物品数量必须大于 0。",
  ],
  [
    "Bulk item phải có quantity > 0.",
    "Bulk item quantity must be greater than 0.",
    "散装物品数量必须大于 0。",
  ],
  ["Bí mật TOTP rỗng.", "The TOTP secret is empty.", "TOTP 密钥为空。"],
  [
    "Bạn chưa xác nhận kho tiếp nhận bảo hành. Vui lòng chọn và xác nhận kho trước khi lưu.",
    "The warranty receiving warehouse has not been confirmed. Select and confirm a warehouse before saving.",
    "尚未确认保修接收仓库，请先选择并确认仓库再保存。",
  ],
  ["Bạn chưa đăng nhập.", "You are not signed in.", "您尚未登录。"],
  [
    "Bạn không có quyền thao tác trên chứng từ đính kèm của loại phiếu này.",
    "You do not have permission to manage attachments for this document type.",
    "您无权操作此类单据的附件。",
  ],
  [
    "Bạn không có quyền truy cập nghiệp vụ Mini App.",
    "You do not have permission to access Mini App operations.",
    "您无权访问小程序业务。",
  ],
  [
    "Bản ghi đã được cập nhật bởi phiên khác; tải lại trước khi lưu.",
    "The record was updated in another session. Reload before saving.",
    "记录已被其他会话更新，请刷新后再保存。",
  ],
  [
    "Bản nháp P19 cần đúng contract xuất linh kiện đã liên kết.",
    "The P19 draft requires the matching linked component issue contract.",
    "P19 草稿必须使用与已关联配件出库单匹配的接口约定。",
  ],
  [
    "Bản nháp không còn ở trạng thái cho phép thao tác.",
    "The draft is no longer in a status that permits this operation.",
    "草稿当前状态不再允许此操作。",
  ],
  [
    "Bản nháp đã thay đổi; tải lại trước khi thao tác.",
    "The draft has changed. Reload before continuing.",
    "草稿已更改，请刷新后继续操作。",
  ],
  [
    "Bắt buộc Idempotency-Key UUID ổn định cho thao tác.",
    "A stable UUID Idempotency-Key is required for this operation.",
    "此操作必须提供固定的 UUID 格式 Idempotency-Key。",
  ],
  [
    'Bắt buộc If-Match; dùng "0" cho lần lưu đầu tiên.',
    'If-Match is required. Use "0" for the first save.',
    "必须提供 If-Match，首次保存时使用“0”。",
  ],
  [
    "Bắt buộc gửi If-Match phiên bản nháp.",
    "The draft version must be sent in If-Match.",
    "必须通过 If-Match 提交草稿版本。",
  ],
  [
    "Bắt buộc key, UUID kho và SHA-256 của tệp.",
    "The key, warehouse UUID and file SHA-256 are required.",
    "必须提供请求键、仓库 UUID 和文件 SHA-256。",
  ],
  ["Bắt đầu ca thành công.", "Shift started successfully.", "已成功开始班次。"],
  [
    "Bằng chứng quét không khớp đúng lệnh.",
    "The scan evidence does not match the command.",
    "扫描凭证与操作指令不匹配。",
  ],
  [
    "Bộ lọc ngoài contract KPI P02.",
    "The filter is not supported by the P02 KPI contract.",
    "筛选条件不符合 P02 KPI 接口约定。",
  ],
  [
    "Bộ lọc ngoài contract P09.",
    "The filter is not supported by the P09 contract.",
    "筛选条件不符合 P09 接口约定。",
  ],
  [
    "Bộ lọc ngoài contract phiên quét; không dùng mine hoặc ID phiên đăng nhập để đổi phạm vi.",
    "The filter is not supported by the scan-session contract. Do not use mine or the login-session ID to change the scope.",
    "筛选条件不符合扫描会话接口约定，不可使用 mine 或登录会话 ID 更改范围。",
  ],
  [
    "Bộ lọc thông báo không được hỗ trợ.",
    "The notification filter is not supported.",
    "不支持此通知筛选条件。",
  ],
  [
    "Bộ lọc tệp đính kèm ngoài contract.",
    "The attachment filter is not supported by the contract.",
    "附件筛选条件不符合接口约定。",
  ],
  [
    "CARTON/BOX bắt buộc primary_sku_id.",
    "CARTON/BOX requires primary_sku_id.",
    "CARTON/BOX 必须提供 primary_sku_id。",
  ],
  [
    "CLOSED/ISSUED container không nhận thêm content.",
    "CLOSED/ISSUED containers cannot accept additional contents.",
    "已关闭 或 已出库 状态的容器不能添加内容。",
  ],
  [
    "CREATE chưa có phiên bản phiếu để gửi If-Match.",
    "CREATE has no document version available for If-Match.",
    "CREATE 尚无可通过 If-Match 提交的单据版本。",
  ],
  [
    "Ca chưa có snapshot kết thúc.",
    "The shift does not have a closing snapshot yet.",
    "班次尚无结束快照。",
  ],
  [
    "Ca có thao tác mới; chạy lại close-check.",
    "The shift has new operations. Run the closing check again.",
    "班次中有新操作，请重新执行结束检查。",
  ],
  [
    "Ca không còn hoạt động hoặc chưa thuộc giao thức kết thúc ca.",
    "The shift is no longer active or has not entered the closing protocol.",
    "班次已不再进行中，或尚未进入结束流程。",
  ],
  [
    "Ca đã kết thúc bằng yêu cầu khác; đọc lại receipt.",
    "The shift was closed by another request. Read the receipt again.",
    "班次已被另一请求结束，请重新读取回执。",
  ],
  [
    "Carton chưa có Item nào được quét (Đang hoạt động) trong phiếu này nên không có gì để xác nhận.",
    "No active items have been scanned into this carton on this document, so there is nothing to confirm.",
    "此单据的纸箱内尚无有效的已扫描物品，没有可确认的内容。",
  ],
  [
    "Carton chưa có Item nào được quét (ACTIVE) trong phiếu này nên không có gì để xác nhận.",
    "No active items have been scanned into this carton on this document, so there is nothing to confirm.",
    "此单据的纸箱内尚无有效的已扫描物品，没有可确认的内容。",
  ],
  [
    "Carton đã CLOSED/ISSUED nên không nhận scan mới.",
    "The carton is CLOSED/ISSUED and cannot accept new scans.",
    "纸箱已为 已关闭 或 已出库 状态，不能新增扫描。",
  ],
  [
    "Case bảo hành đã ở trạng thái terminal; không được cập nhật.",
    "The warranty case is in a final status and cannot be updated.",
    "保修单已处于最终状态，不能更新。",
  ],
  [
    "Chip NFC này đã bị thu hồi (mất/hỏng); không tái sử dụng được.",
    "This NFC chip was revoked as lost or damaged and cannot be reused.",
    "此 NFC 芯片已因丢失或损坏被撤销，不能重复使用。",
  ],
  [
    "Chip NFC này đã gắn cho hiện vật khác; bóc chip cũ hoặc dùng chip mới.",
    "This NFC chip is linked to another physical item. Remove the old chip or use a new one.",
    "此 NFC 芯片已关联其他实物，请拆除旧芯片或使用新芯片。",
  ],
  [
    "Chip NFC đã gán trước đó cho đúng hiện vật này.",
    "This NFC chip was already assigned to this physical item.",
    "此 NFC 芯片此前已分配给该实物。",
  ],
  [
    "Chip NFC đã ở trạng thái thu hồi từ trước.",
    "This NFC chip was already revoked.",
    "此 NFC 芯片此前已被撤销。",
  ],
  [
    "Chip chưa gắn với hiện vật nào trong hệ thống.",
    "The chip is not linked to any physical item in the system.",
    "芯片尚未关联系统中的任何实物。",
  ],
  [
    "Chip không hoạt động; dùng chi tiết chip để tra cứu lịch sử, không xác nhận quét thành công.",
    "The chip is inactive. Open its details to view history; do not confirm a successful scan.",
    "芯片未启用，请打开芯片详情查询历史，不要确认扫描成功。",
  ],
  [
    "Chip thuộc lượt đã ghi nhưng bị từ chối; dùng thẻ trắng mới sau khi phục hồi.",
    "The chip belongs to a recorded but rejected operation. Use a new blank tag after recovery.",
    "芯片属于已记录但被拒绝的操作，请在恢复后使用新的空白标签。",
  ],
  [
    "Chip đã được đăng ký cho đối tượng khác.",
    "The chip is already registered to another object.",
    "芯片已登记给其他对象。",
  ],
  [
    "Chính sách phiên chưa sẵn sàng. Vui lòng thử lại sau.",
    "The session policy is not ready. Please try again later.",
    "会话策略尚未就绪，请稍后重试。",
  ],
  [
    "Chính sách đa phiên chỉ được phép trên môi trường DEV/TEST đã duyệt.",
    "The multi-session policy is only permitted in approved DEV/TEST environments.",
    "多会话策略仅允许用于已批准的 DEV/TEST 环境。",
  ],
  [
    "Chưa có owner hiện vật đủ bằng chứng cho nhiều kho.",
    "No physical-item owner has sufficient evidence for multiple warehouses.",
    "尚无具备充分多仓库凭证的实物归属记录。",
  ],
  [
    "Chưa có receipt kết luận cho yêu cầu này.",
    "No conclusive receipt is available for this request.",
    "此请求尚无确定结果的回执。",
  ],
  [
    "Chưa có đăng ký thiết bị.",
    "No device registration is available.",
    "设备尚未登记。",
  ],
  [
    "Chưa có định danh đối chiếu của lượt đọc.",
    "The read operation has no reconciliation identifier.",
    "读取操作尚无核对标识。",
  ],
  ["Chưa có ảnh đại diện.", "No avatar is available.", "尚无头像。"],
  [
    "Chưa cấu hình khóa xác minh yêu cầu.",
    "The request verification key has not been configured.",
    "尚未配置请求验证密钥。",
  ],
  [
    "Chưa ghi nhận được thông báo gửi thử.",
    "The test notification has not been recorded.",
    "尚未记录测试通知。",
  ],
  [
    "Chưa hoàn tất migration P07; tạm dừng thao tác NFC.",
    "P07 migration is incomplete. NFC operations are temporarily suspended.",
    "P07 数据迁移尚未完成，NFC 操作暂时停止。",
  ],
  [
    "Chưa lưu được kết quả yêu cầu.",
    "The request result has not been saved.",
    "尚未保存请求结果。",
  ],
  [
    "Chưa nghiệm thu driver của nguồn checkpoint.",
    "The checkpoint source driver has not been approved.",
    "检查点数据源驱动尚未验收。",
  ],
  [
    "Chưa sẵn sàng nguồn bàn giao Web POST; không suy từ readiness hoặc receipt cũ.",
    "The Web POST handover source is not ready. Do not infer it from readiness or an old receipt.",
    "Web POST 交接数据源尚未就绪，不可根据就绪状态或旧回执推断结果。",
  ],
  [
    "Chưa sẵn sàng nguồn tìm kiếm Unicode.",
    "The Unicode search source is not ready.",
    "Unicode 搜索数据源尚未就绪。",
  ],
  [
    "Chưa triển khai schema biên nhận từ chối NFC.",
    "The NFC rejection receipt schema has not been deployed.",
    "尚未部署 NFC 拒绝回执数据结构。",
  ],
  [
    "Chưa triển khai schema receipt upload.",
    "The upload receipt schema has not been deployed.",
    "尚未部署上传回执数据结构。",
  ],
  [
    "Chưa xác minh đúng nháp nhập để cấp số.",
    "The receipt draft has not been verified for number allocation.",
    "尚未验证用于分配编号的入库草稿。",
  ],
  [
    "Chưa xác minh được receipt đúng thao tác và phạm vi; không chốt kết quả ca.",
    "A receipt matching the operation and scope has not been verified. The shift result cannot be finalized.",
    "尚未验证与操作和范围匹配的回执，不能确认班次结果。",
  ],
  [
    "Chưa xác nhận múi giờ của nguồn bảo hành.",
    "The warranty source timezone has not been confirmed.",
    "尚未确认保修数据源的时区。",
  ],
  [
    "Chưa xác nhận múi giờ của nguồn phiên quét.",
    "The scan-session source timezone has not been confirmed.",
    "尚未确认扫描会话数据源的时区。",
  ],
  [
    "Chưa xác nhận phạm vi tổ chức của nguồn dữ liệu.",
    "The data source organizational scope has not been confirmed.",
    "尚未确认数据源的组织范围。",
  ],
  ["Chưa xác thực", "Unauthenticated.", "尚未通过身份验证。"],
  [
    "Chưa xác thực người dùng Mini App.",
    "The Mini App user has not been authenticated.",
    "小程序用户尚未通过身份验证。",
  ],
  [
    "Chưa xác định kết quả; đối chiếu request, không gửi lại yêu cầu mới.",
    "The result is not yet known. Reconcile the existing request instead of submitting a new one.",
    "结果尚未确定，请核对现有请求，不要提交新请求。",
  ],
  [
    "Chưa xác định được phạm vi tổ chức của nguồn lịch sử.",
    "The history source organizational scope has not been determined.",
    "尚未确定历史数据源的组织范围。",
  ],
  [
    "Chưa áp dụng schema bàn giao bảo hành.",
    "The warranty handover schema has not been applied.",
    "尚未应用保修交接数据结构。",
  ],
  [
    "Chưa đủ N/N; toàn bộ giao dịch được hoàn tác.",
    "The required N/N count has not been reached. The entire transaction has been rolled back.",
    "尚未达到所需的 N/N 数量，整个事务已回滚。",
  ],
  [
    "Chưa đủ điều kiện kết thúc ca.",
    "The shift is not ready to close.",
    "尚不满足结束班次的条件。",
  ],
  [
    "Chưa đủ điều kiện phục hồi; đọc lại receipt, phiên, kho và mapping.",
    "Recovery requirements are not met. Read the receipt, session, warehouse and mapping again.",
    "尚不满足恢复条件，请重新读取回执、会话、仓库和映射。",
  ],
  [
    "Chẩn đoán chỉ dành cho ứng dụng DEV/TEST.",
    "Diagnostics are only available in DEV/TEST applications.",
    "诊断功能仅适用于 DEV/TEST 应用。",
  ],
  [
    "Chỉ Component Issue Nháp mới được Post.",
    "Only draft component issue documents can be posted.",
    "只有草稿状态的配件出库单才能过账。",
  ],
  [
    "Chỉ Component Issue DRAFT mới được Post.",
    "Only draft component issue documents can be posted.",
    "只有草稿状态的配件出库单才能过账。",
  ],
  [
    "Chỉ GET đối chiếu yêu cầu cũ.",
    "Only GET reconciliation of the existing request is permitted.",
    "仅允许使用 GET 核对现有请求。",
  ],
  [
    "Chỉ Import ở trạng thái VALIDATED mới được xử lý.",
    "Only VALIDATED imports can be processed.",
    "只有 VALIDATED 状态的导入任务才能处理。",
  ],
  [
    "Chỉ Nháp/Đang quét mới ghi nhận được mốc xong thùng.",
    "Only DRAFT/SCANNING documents can record carton completion.",
    "只有 草稿 或 扫描中 状态的单据才能记录封箱完成节点。",
  ],
  [
    "Chỉ DRAFT/SCANNING mới ghi nhận được mốc xong thùng.",
    "Only DRAFT/SCANNING documents can record carton completion.",
    "只有 草稿 或 扫描中 状态的单据才能记录封箱完成节点。",
  ],
  [
    "Chỉ Nháp/Đang quét mới được Cancel.",
    "Only DRAFT/SCANNING documents can be cancelled.",
    "只有 草稿 或 扫描中 状态的单据才能取消。",
  ],
  [
    "Chỉ DRAFT/SCANNING mới được Cancel.",
    "Only DRAFT/SCANNING documents can be cancelled.",
    "只有 草稿 或 扫描中 状态的单据才能取消。",
  ],
  [
    "Chỉ Nháp/Đang quét mới được Post.",
    "Only DRAFT/SCANNING documents can be posted.",
    "只有 草稿 或 扫描中 状态的单据才能过账。",
  ],
  [
    "Chỉ DRAFT/SCANNING mới được Post.",
    "Only DRAFT/SCANNING documents can be posted.",
    "只有 草稿 或 扫描中 状态的单据才能过账。",
  ],
  [
    "Chỉ Nháp/Đang quét mới được cập nhật.",
    "Only DRAFT/SCANNING documents can be updated.",
    "只有 草稿 或 扫描中 状态的单据才能更新。",
  ],
  [
    "Chỉ DRAFT/SCANNING mới được cập nhật.",
    "Only DRAFT/SCANNING documents can be updated.",
    "只有 草稿 或 扫描中 状态的单据才能更新。",
  ],
  [
    "Chỉ Nháp/Đang quét mới được gỡ item đã match; sau Post phải dùng điều chỉnh tồn kho.",
    "Only DRAFT/SCANNING documents allow matched items to be removed. After posting, use an inventory reversal.",
    "只有 草稿 或 扫描中 状态的单据才能移除已匹配物品，过账后请使用库存冲销。",
  ],
  [
    "Chỉ DRAFT/SCANNING mới được gỡ item đã match; sau Post phải dùng Reversal.",
    "Only DRAFT/SCANNING documents allow matched items to be removed. After posting, use an inventory reversal.",
    "只有 草稿 或 扫描中 状态的单据才能移除已匹配物品，过账后请使用库存冲销。",
  ],
  [
    "Chỉ Nháp/Đang quét mới được gỡ mã đã quét; sau Post phải dùng điều chỉnh tồn kho.",
    "Only DRAFT/SCANNING documents allow scanned codes to be removed. After posting, use an inventory reversal.",
    "只有 草稿 或 扫描中 状态的单据才能移除已扫描编码，过账后请使用库存冲销。",
  ],
  [
    "Chỉ DRAFT/SCANNING mới được gỡ mã đã quét; sau Post phải dùng Reversal.",
    "Only DRAFT/SCANNING documents allow scanned codes to be removed. After posting, use an inventory reversal.",
    "只有 草稿 或 扫描中 状态的单据才能移除已扫描编码，过账后请使用库存冲销。",
  ],
  [
    "Chỉ Nháp/Đang quét mới được scan Component Issue.",
    "Only DRAFT/SCANNING component issue documents can be scanned.",
    "只有 草稿 或 扫描中 状态的配件出库单才能扫描。",
  ],
  [
    "Chỉ DRAFT/SCANNING mới được scan Component Issue.",
    "Only DRAFT/SCANNING component issue documents can be scanned.",
    "只有 草稿 或 扫描中 状态的配件出库单才能扫描。",
  ],
  [
    "Chỉ Nháp/Đang quét mới được scan.",
    "Only DRAFT/SCANNING documents can be scanned.",
    "只有 草稿 或 扫描中 状态的单据才能扫描。",
  ],
  [
    "Chỉ DRAFT/SCANNING mới được scan.",
    "Only DRAFT/SCANNING documents can be scanned.",
    "只有 草稿 或 扫描中 状态的单据才能扫描。",
  ],
  [
    "Chỉ SKU loại Sản phẩm có is_serial_tracked=true (tracking_mode=SERIAL) mới tạo được Item_Instance kèm mã định danh mới.",
    "Only PRODUCT SKUs with is_serial_tracked=true (tracking_mode=SERIAL) can create an Item_Instance with a new identifier.",
    "只有 is_serial_tracked=true（tracking_mode=SERIAL）的 产品 SKU 才能创建带新标识的 Item_Instance。",
  ],
  [
    "Chỉ SKU loại PRODUCT có is_serial_tracked=true (tracking_mode=SERIAL) mới tạo được Item_Instance kèm mã định danh mới.",
    "Only PRODUCT SKUs with is_serial_tracked=true (tracking_mode=SERIAL) can create an Item_Instance with a new identifier.",
    "只有 is_serial_tracked=true（tracking_mode=SERIAL）的 产品 SKU 才能创建带新标识的 Item_Instance。",
  ],
  [
    "Chỉ SKU đang Đang hoạt động mới được publish cho App PV.",
    "Only active SKUs can be published to the PV App.",
    "只有已启用的 SKU 才能发布到 PV 应用。",
  ],
  [
    "Chỉ SKU đang ACTIVE mới được publish cho App PV.",
    "Only active SKUs can be published to the PV App.",
    "只有已启用的 SKU 才能发布到 PV 应用。",
  ],
  [
    "Chỉ Super Admin được đổi trạng thái hoặc lý do tạm dừng của kho.",
    "Only a Super Admin can change warehouse status or the pause reason.",
    "只有超级管理员才能更改仓库状态或暂停原因。",
  ],
  [
    "Chỉ chứng từ Nháp/Đang quét mới được scan.",
    "Only DRAFT/SCANNING documents can be scanned.",
    "只有 草稿 或 扫描中 状态的单据才能扫描。",
  ],
  [
    "Chỉ chứng từ DRAFT/SCANNING mới được scan.",
    "Only DRAFT/SCANNING documents can be scanned.",
    "只有 草稿 或 扫描中 状态的单据才能扫描。",
  ],
  [
    "Chỉ chứng từ Đang quét mới được Post.",
    "Only SCANNING documents can be posted.",
    "只有 扫描中 状态的单据才能过账。",
  ],
  [
    "Chỉ chứng từ SCANNING mới được Post.",
    "Only SCANNING documents can be posted.",
    "只有 扫描中 状态的单据才能过账。",
  ],
  [
    "Chỉ chứng từ Đã ghi nhận mới được điều chỉnh tồn kho.",
    "Only posted documents can be reversed.",
    "只有已过账的单据才能进行库存冲销。",
  ],
  [
    "Chỉ chứng từ POSTED mới được reversal.",
    "Only posted documents can be reversed.",
    "只有已过账的单据才能进行库存冲销。",
  ],
  [
    "Chỉ code Đang hoạt động mới được deactivate.",
    "Only active codes can be deactivated.",
    "只有已启用的编码才能停用。",
  ],
  [
    "Chỉ code ACTIVE mới được deactivate.",
    "Only active codes can be deactivated.",
    "只有已启用的编码才能停用。",
  ],
  [
    'Chỉ container loại CARTON mới có mốc "Đã quét xong thùng".',
    'Only CARTON containers can record the "Carton scanning complete" milestone.',
    "只有 CARTON 类型容器才能记录“纸箱扫描完成”节点。",
  ],
  [
    "Chỉ container Đang hoạt động mới được seal.",
    "Only active containers can be sealed.",
    "只有已启用的容器才能封箱。",
  ],
  [
    "Chỉ container ACTIVE mới được seal.",
    "Only active containers can be sealed.",
    "只有已启用的容器才能封箱。",
  ],
  [
    "Chỉ có thể xóa yêu cầu ở trạng thái nháp.",
    "Only draft requests can be deleted.",
    "只有草稿状态的申请才能删除。",
  ],
  [
    "Chỉ cấp số cho đúng nháp xuất chưa ghi nhận.",
    "A number can only be allocated to the matching unposted issue draft.",
    "只能为匹配的未过账出库草稿分配编号。",
  ],
  [
    "Chỉ dòng quét Đang hoạt động mới được gỡ trước Post.",
    "Only active scans can be removed before posting.",
    "过账前只能移除有效的扫描记录。",
  ],
  [
    "Chỉ dòng quét ACTIVE mới được gỡ trước Post.",
    "Only active scans can be removed before posting.",
    "过账前只能移除有效的扫描记录。",
  ],
  [
    "Chỉ dùng đúng ID hiện vật và warehouse_id; không suy vị trí từ SKU.",
    "Use the exact physical-item ID and warehouse_id. Do not infer location from the SKU.",
    "必须使用准确的实物 ID 和 warehouse_id，不可根据 SKU 推断位置。",
  ],
  [
    "Chỉ gửi context_type, context_id hoặc scope_ref; người dùng và phiên do máy chủ xác định.",
    "Send only context_type, context_id or scope_ref. The server determines the user and session.",
    "仅提交 context_type、context_id 或 scope_ref，用户和会话由服务器确定。",
  ],
  [
    "Chỉ gửi các tùy chọn cá nhân được hỗ trợ.",
    "Send only supported personal preferences.",
    "仅提交受支持的个人偏好设置。",
  ],
  [
    "Chỉ gửi keyword hoặc search, không gửi hai giá trị khác nhau.",
    "Send either keyword or search; do not provide conflicting values.",
    "请提交 keyword 或 search，不要提交两个不同的值。",
  ],
  [
    "Chỉ gửi query theo contract đọc, không gửi body/trạng thái/limit.",
    "Send only query parameters permitted by the read contract, without a body, status or limit.",
    "仅提交读取接口允许的查询参数，不要提交请求体、状态或 limit。",
  ],
  [
    "Chỉ gửi query theo contract đọc, không gửi body/status/limit.",
    "Send only query parameters permitted by the read contract, without a body, status or limit.",
    "仅提交读取接口允许的查询参数，不要提交请求体、状态或 limit。",
  ],
  [
    "Chỉ gửi thử đến đăng ký của chính phiên này.",
    "Test notifications can only be sent to this session's registration.",
    "只能向当前会话的登记信息发送测试通知。",
  ],
  ["Chỉ gửi tên đăng nhập.", "Send only the username.", "仅提交用户名。"],
  [
    "Chỉ gửi ảnh và các trường hồ sơ được phép.",
    "Send only an image and permitted profile fields.",
    "仅提交图片和允许修改的个人资料字段。",
  ],
  [
    "Chỉ hồ sơ đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện.",
    "Components can only be issued for cases that are being checked or repaired.",
    "只有处于检测中或维修中的保修单才能领用配件。",
  ],
  [
    "Chỉ import VALIDATED mới được consume.",
    "Only VALIDATED imports can be consumed.",
    "只有 VALIDATED 状态的导入任务才能使用。",
  ],
  [
    "Chỉ import VALIDATED/REJECTED (đã resolve) mới được Confirm.",
    "Only VALIDATED imports or resolved REJECTED imports can be confirmed.",
    "只有 VALIDATED 状态或已解决问题的 REJECTED 导入任务才能确认。",
  ],
  [
    "Chỉ match Đang hoạt động mới được gỡ trước Post.",
    "Only active matches can be removed before posting.",
    "过账前只能移除有效的匹配记录。",
  ],
  [
    "Chỉ match ACTIVE mới được gỡ trước Post.",
    "Only active matches can be removed before posting.",
    "过账前只能移除有效的匹配记录。",
  ],
  [
    "Chỉ phiếu Nháp chưa quét, chưa hết hạn và có kế hoạch Sản phẩm hợp lệ được ghi nhận N/N.",
    "N/N can only be recorded on an unexpired, unscanned draft with a valid PRODUCT plan.",
    "只有尚未过期、未扫描且具有有效 产品 计划的草稿单据才能记录 N/N。",
  ],
  [
    "Chỉ phiếu DRAFT chưa quét, chưa hết hạn và có kế hoạch PRODUCT hợp lệ được ghi nhận N/N.",
    "N/N can only be recorded on an unexpired, unscanned draft with a valid PRODUCT plan.",
    "只有尚未过期、未扫描且具有有效 产品 计划的草稿单据才能记录 N/N。",
  ],
  [
    "Chỉ phiếu Nháp/Đang quét mới được cập nhật thông tin đầu phiếu.",
    "Only DRAFT/SCANNING documents allow header information to be updated.",
    "只有 草稿 或 扫描中 状态的单据才能更新单头信息。",
  ],
  [
    "Chỉ phiếu DRAFT/SCANNING mới được cập nhật thông tin đầu phiếu.",
    "Only DRAFT/SCANNING documents allow header information to be updated.",
    "只有 草稿 或 扫描中 状态的单据才能更新单头信息。",
  ],
  [
    "Chỉ phiếu Nháp/Đang quét mới được ghi nhận linh kiện.",
    "Components can only be recorded on DRAFT/SCANNING documents.",
    "只有 草稿 或 扫描中 状态的单据才能登记配件。",
  ],
  [
    "Chỉ phiếu DRAFT/SCANNING mới được ghi nhận linh kiện.",
    "Components can only be recorded on DRAFT/SCANNING documents.",
    "只有 草稿 或 扫描中 状态的单据才能登记配件。",
  ],
  [
    "Chỉ phiếu Nháp/Đang quét mới được gỡ mã đã quét.",
    "Scanned codes can only be removed from DRAFT/SCANNING documents.",
    "只有 草稿 或 扫描中 状态的单据才能移除已扫描编码。",
  ],
  [
    "Chỉ phiếu DRAFT/SCANNING mới được gỡ mã đã quét.",
    "Scanned codes can only be removed from DRAFT/SCANNING documents.",
    "只有 草稿 或 扫描中 状态的单据才能移除已扫描编码。",
  ],
  [
    "Chỉ phiếu Nháp/Đang quét mới được đăng ký BOX.",
    "BOX registration is only permitted on DRAFT/SCANNING documents.",
    "只有 草稿 或 扫描中 状态的单据才能登记 BOX。",
  ],
  [
    "Chỉ phiếu DRAFT/SCANNING mới được đăng ký BOX.",
    "BOX registration is only permitted on DRAFT/SCANNING documents.",
    "只有 草稿 或 扫描中 状态的单据才能登记 BOX。",
  ],
  [
    "Chỉ phiếu xuất hợp lệ mới được tạo Nhãn đóng gói.",
    "Packing labels can only be created for valid issue notes.",
    "只有有效的出库单才能创建包装标签。",
  ],
  [
    "Chỉ phiếu xuất hợp lệ mới được tạo Packing Label.",
    "Packing labels can only be created for valid issue notes.",
    "只有有效的出库单才能创建包装标签。",
  ],
  [
    "Chỉ phiếu Đang quét mới được xác nhận dán Nhãn đóng gói.",
    "Packing label application can only be confirmed on SCANNING documents.",
    "只有 扫描中 状态的单据才能确认已贴包装标签。",
  ],
  [
    "Chỉ phiếu SCANNING mới được xác nhận dán Packing Label.",
    "Packing label application can only be confirmed on SCANNING documents.",
    "只有 扫描中 状态的单据才能确认已贴包装标签。",
  ],
  [
    "Chỉ quản trị hệ thống mới được phép cấp vai trò quản trị hệ thống cho tài khoản khác.",
    "Only a system administrator can grant the system administrator role to another account.",
    "只有系统管理员才能为其他账号授予系统管理员角色。",
  ],
  [
    "Chỉ tạo Nhãn đóng gói sau khi mọi line đã scan đủ chính xác.",
    "A packing label can only be created after every line has been scanned to the exact required quantity.",
    "每行必须扫描至准确的所需数量后才能创建包装标签。",
  ],
  [
    "Chỉ tạo Packing Label sau khi mọi line đã scan đủ chính xác.",
    "A packing label can only be created after every line has been scanned to the exact required quantity.",
    "每行必须扫描至准确的所需数量后才能创建包装标签。",
  ],
  [
    "Chỉ xác nhận dán nhãn sau khi Nhãn đóng gói đã Đã in.",
    "Label application can only be confirmed after the packing label has been printed.",
    "只有包装标签打印完成后才能确认贴标。",
  ],
  [
    "Chỉ xác nhận dán nhãn sau khi Packing Label đã PRINTED.",
    "Label application can only be confirmed after the packing label has been printed.",
    "只有包装标签打印完成后才能确认贴标。",
  ],
  [
    "Chỉ yêu cầu liên kết trên GET lịch sử SKU hoặc hiện vật P06.",
    "Link requests are only supported on GET SKU history or P06 physical-item history.",
    "仅在 GET SKU 历史或 P06 实物历史查询中支持关联请求。",
  ],
  [
    "Chỉ Đang quét mới được Hoàn tất xuất kho.",
    "Only SCANNING documents can complete an issue.",
    "只有 扫描中 状态的单据才能完成出库。",
  ],
  [
    "Chỉ SCANNING mới được Post Issue.",
    "Only SCANNING documents can complete an issue.",
    "只有 扫描中 状态的单据才能完成出库。",
  ],
  [
    "Chỉ Đang quét mới được Post.",
    "Only SCANNING documents can be posted.",
    "只有 扫描中 状态的单据才能过账。",
  ],
  [
    "Chỉ SCANNING mới được Post.",
    "Only SCANNING documents can be posted.",
    "只有 扫描中 状态的单据才能过账。",
  ],
  [
    "Chỉ điều chỉnh tồn kho Nháp mới huỷ được.",
    "Only draft inventory reversals can be cancelled.",
    "只有草稿状态的库存冲销单才能取消。",
  ],
  [
    "Chỉ reversal DRAFT mới huỷ được.",
    "Only draft inventory reversals can be cancelled.",
    "只有草稿状态的库存冲销单才能取消。",
  ],
  [
    "Chỉ điều chỉnh tồn kho Nháp mới xác nhận hàng về.",
    "Returned goods can only be confirmed on draft inventory reversals.",
    "只有草稿状态的库存冲销单才能确认退回货物。",
  ],
  [
    "Chỉ reversal DRAFT mới xác nhận hàng về.",
    "Returned goods can only be confirmed on draft inventory reversals.",
    "只有草稿状态的库存冲销单才能确认退回货物。",
  ],
  [
    "Chỉ được chọn SKU linh kiện cho luồng nhận theo Box.",
    "Only component SKUs can be selected for receiving by BOX.",
    "按 BOX 收货时只能选择配件 SKU。",
  ],
  [
    "Chỉ được gửi tên, mô tả và trạng thái nhà cung cấp.",
    "Only the supplier name, description and status may be submitted.",
    "仅允许提交供应商名称、描述和状态。",
  ],
  [
    "Chỉ được gửi warehouse_id; người dùng và phiên do máy chủ xác định.",
    "Send only warehouse_id. The server determines the user and session.",
    "仅提交 warehouse_id，用户和会话由服务器确定。",
  ],
  [
    "Chỉ được phép có 1 kho tổng đang Đang hoạt động.",
    "Only one active main warehouse is permitted.",
    "只允许有一个已启用的总仓库。",
  ],
  [
    "Chỉ được phép có 1 kho tổng đang ACTIVE.",
    "Only one active main warehouse is permitted.",
    "只允许有一个已启用的总仓库。",
  ],
  [
    "Chỉ được sửa hoặc hủy bản nháp Nháp chưa ghi nhận; không xóa hồ sơ đã ghi nhận hoặc chưa rõ kết quả.",
    "Only unposted DRAFT drafts can be edited or cancelled. Recorded drafts or drafts with unknown results cannot be deleted.",
    "只能编辑或取消尚未过账的 草稿 草稿，不能删除已登记或结果尚未确定的记录。",
  ],
  [
    "Chỉ được sửa hoặc hủy bản nháp DRAFT chưa ghi nhận; không xóa hồ sơ đã ghi nhận hoặc chưa rõ kết quả.",
    "Only unposted DRAFT drafts can be edited or cancelled. Recorded drafts or drafts with unknown results cannot be deleted.",
    "只能编辑或取消尚未过账的 草稿 草稿，不能删除已登记或结果尚未确定的记录。",
  ],
  [
    "Chỉ được sửa tên hiển thị và số điện thoại. Vai trò, quyền và email không tự sửa được.",
    "Only the display name and phone number can be edited. You cannot change your own roles, permissions or email.",
    "只能修改显示名称和电话号码，不能自行更改角色、权限或电子邮箱。",
  ],
  [
    "Chỉ được đúng một media role=PRIMARY.",
    "Exactly one media item must have role=PRIMARY.",
    "必须恰有一个媒体文件的 role=PRIMARY。",
  ],
  [
    "Chỉ đối chiếu key gốc; không upload lại khi chưa rõ kết quả.",
    "Reconcile only the original key. Do not upload again while the result is unknown.",
    "请仅核对原始请求键，结果未确定前不要重新上传。",
  ],
  [
    "Chọn item_id hoặc sku_id+số lượng, không chọn cả hai.",
    "Select either item_id or sku_id with quantity, not both.",
    "请选择 item_id 或 sku_id 加数量，不可同时选择。",
  ],
  [
    "Chọn item_id hoặc sku_id+quantity, không chọn cả hai.",
    "Select either item_id or sku_id with quantity, not both.",
    "请选择 item_id 或 sku_id 加数量，不可同时选择。",
  ],
  [
    "Chọn rõ trường ngày và ngày/khoảng ngày hợp lệ; không gửi lẫn DATE, RANGE và ALL.",
    "Choose an explicit date field and a valid date or range. Do not mix DATE, RANGE and ALL.",
    "请明确选择日期字段及有效日期或范围，不可混用 DATE、RANGE 和 ALL。",
  ],
  [
    "Chọn ảnh PNG, JPEG hoặc WebP có kích thước tối đa 4096 × 4096.",
    "Choose a PNG, JPEG or WebP image no larger than 4096 × 4096.",
    "请选择尺寸不超过 4096 × 4096 的 PNG、JPEG 或 WebP 图片。",
  ],
  [
    "Chức năng gửi thử chưa được bật.",
    "Test sending is not enabled.",
    "尚未启用发送测试功能。",
  ],
  [
    "Chứng từ chỉ nhận ảnh JPG/PNG/WEBP hoặc PDF.",
    "Document attachments must be JPG, PNG, WEBP images or PDF files.",
    "单据附件仅支持 JPG、PNG、WEBP 图片或 PDF 文件。",
  ],
  [
    "Chứng từ hoàn trả/điều chỉnh phải có ít nhất 1 tài liệu đính kèm trước khi Post (đối soát).",
    "Return/adjustment documents require at least one attachment before posting for reconciliation.",
    "退回或调整单据在对账过账前必须至少添加一个附件。",
  ],
  [
    "Chứng từ đã có scan evidence; hãy Cancel và tạo lại để không xóa lịch sử scan.",
    "The document already has scan evidence. Cancel and recreate it to preserve the scan history.",
    "单据已有扫描凭证，请取消后重新创建，以保留扫描历史。",
  ],
  [
    "Chứng từ đã được điều chỉnh tồn kho toàn bộ.",
    "The document has already been fully reversed.",
    "此单据已完成全部库存冲销。",
  ],
  [
    "Chứng từ đã được reversal toàn bộ.",
    "The document has already been fully reversed.",
    "此单据已完成全部库存冲销。",
  ],
  [
    "Chứng từ đính kèm không vượt qua kiểm tra mã độc.",
    "The document attachment failed the malware check.",
    "单据附件未通过恶意软件检查。",
  ],
  [
    "Chứng từ đính kèm nằm ngoài phạm vi kho.",
    "The document attachment is outside the warehouse scope.",
    "单据附件不在允许的仓库范围内。",
  ],
  [
    "Chứng từ đính kèm vượt quá 15MB.",
    "The document attachment exceeds 15 MB.",
    "单据附件超过 15 MB。",
  ],
  [
    "Ciphertext PII sai định dạng: thiếu tiền tố key id.",
    "Invalid PII ciphertext format: the key ID prefix is missing.",
    "个人信息密文格式错误：缺少密钥 ID 前缀。",
  ],
  [
    "Close-check không thuộc đúng ca, phiên hoặc phiên bản quyền hiện tại.",
    "The closing check does not match the current shift, session or permission version.",
    "结束检查与当前班次、会话或权限版本不匹配。",
  ],
  [
    "Close-check đã hết hạn; kiểm tra lại trước khi kết thúc.",
    "The closing check has expired. Run it again before closing.",
    "结束检查已过期，请在结束班次前重新检查。",
  ],
  [
    "Closed/posted documents không thể be checked.",
    "Closed or posted documents cannot be checked.",
    "已关闭或已过账的单据不能检查。",
  ],
  [
    "Closed/posted documents cannot be checked.",
    "Closed or posted documents cannot be checked.",
    "已关闭或已过账的单据不能检查。",
  ],
  [
    "Component Issue chỉ Post khi scanned_qty = required_qty.",
    "Component issues can only be posted when scanned_qty equals required_qty.",
    "配件出库单只有在 scanned_qty 等于 required_qty 时才能过账。",
  ],
  [
    "Component Issue chỉ cho purpose=WARRANTY.",
    "Component issues only allow purpose=WARRANTY.",
    "配件出库仅允许 purpose=WARRANTY。",
  ],
  [
    "Component Issue chỉ chấp nhận SKU Linh kiện Đang hoạt động.",
    "Component issues only accept active COMPONENT SKUs.",
    "配件出库仅接受已启用的 配件 SKU。",
  ],
  [
    "Component Issue chỉ chấp nhận SKU COMPONENT ACTIVE.",
    "Component issues only accept active COMPONENT SKUs.",
    "配件出库仅接受已启用的 配件 SKU。",
  ],
  [
    "Component Issue chỉ nhận SKU Linh kiện Đang hoạt động.",
    "Component issues only accept active COMPONENT SKUs.",
    "配件出库仅接受已启用的 配件 SKU。",
  ],
  [
    "Component Issue chỉ nhận SKU COMPONENT ACTIVE.",
    "Component issues only accept active COMPONENT SKUs.",
    "配件出库仅接受已启用的 配件 SKU。",
  ],
  [
    "Component Issue item thiếu item_id/container_id.",
    "The component issue item is missing item_id or container_id.",
    "配件出库物品缺少 item_id 或 container_id。",
  ],
  [
    "Component Issue phải có ít nhất một dòng.",
    "A component issue must contain at least one line.",
    "配件出库单必须至少有一行。",
  ],
  [
    "Component Issue yêu cầu warranty case đang active.",
    "A component issue requires an active warranty case.",
    "配件出库必须关联进行中的保修单。",
  ],
  [
    "Component item sai SKU hoặc không IN_STOCK.",
    "The component item has a different SKU or is not IN_STOCK.",
    "配件物品的 SKU 不匹配，或其状态不是 IN_STOCK。",
  ],
  [
    "Component không tồn tại hoặc không Đang hoạt động.",
    "The component does not exist or is inactive.",
    "配件不存在或未启用。",
  ],
  [
    "Component không tồn tại hoặc không ACTIVE.",
    "The component does not exist or is inactive.",
    "配件不存在或未启用。",
  ],
  [
    "Component scan vượt required_qty.",
    "The component scan exceeds required_qty.",
    "配件扫描数量超过 required_qty。",
  ],
  [
    "Container CLOSED là immutable.",
    "A CLOSED container cannot be changed.",
    "已关闭 状态的容器不能更改。",
  ],
  [
    "Container SEALED/CLOSED không được chỉnh sửa.",
    "SEALED/CLOSED containers cannot be edited.",
    "已封箱 或 已关闭 状态的容器不能编辑。",
  ],
  [
    "Container changed concurrently.",
    "Container changed concurrently.",
    "容器已被其他操作同时修改。",
  ],
  [
    "Container component phải là BOX còn stock, đúng primary_sku_id và chưa CLOSED/ISSUED.",
    "The component container must be a BOX with stock, matching primary_sku_id, and not CLOSED/ISSUED.",
    "配件容器必须是有库存、primary_sku_id 匹配且未处于 已关闭 或 已出库 状态的 BOX。",
  ],
  [
    "Container content added; stock_effect=NONE.",
    "Container contents added; stock_effect=NONE.",
    "已添加容器内容；stock_effect=NONE。",
  ],
  [
    "Container còn nội dung; đổi SKU chính cần luồng repack nguyên tử được duyệt.",
    "The container still has contents. Changing its primary SKU requires an approved atomic repacking workflow.",
    "容器仍有内容，更改主 SKU 必须通过已批准的原子重新包装流程。",
  ],
  [
    "Container có item không thuộc primary_product_id.",
    "The container contains an item that does not match primary_product_id.",
    "容器内有物品与 primary_product_id 不匹配。",
  ],
  [
    "Container của mã scan không ở trạng thái Đang hoạt động.",
    "The scanned code's container is not active.",
    "扫描编码对应的容器未启用。",
  ],
  [
    "Container của mã scan không ở trạng thái ACTIVE.",
    "The scanned code's container is not active.",
    "扫描编码对应的容器未启用。",
  ],
  [
    "Container không thể là parent của chính nó.",
    "A container cannot be its own parent.",
    "容器不能作为自身的父容器。",
  ],
  [
    "Container mới chỉ được tạo ở trạng thái EMPTY; các trạng thái còn lại là kết quả của Hoàn tất nhập kho / Putaway confirm / thao tác content / Hoàn tất xuất kho.",
    "New containers can only be created as EMPTY. Other statuses result from posting receipts, confirming putaway, changing contents or completing issues.",
    "新容器只能以 EMPTY 状态创建，其他状态由完成入库、确认上架、内容操作或完成出库产生。",
  ],
  [
    "Container mới chỉ được tạo ở trạng thái EMPTY; các trạng thái còn lại là kết quả của Post Receipt / Putaway confirm / thao tác content / Post Issue.",
    "New containers can only be created as EMPTY. Other statuses result from posting receipts, confirming putaway, changing contents or completing issues.",
    "新容器只能以 EMPTY 状态创建，其他状态由完成入库、确认上架、内容操作或完成出库产生。",
  ],
  [
    "Container rỗng không được seal.",
    "An empty container cannot be sealed.",
    "空容器不能封箱。",
  ],
  [
    "Container subledger thay đổi đồng thời; không thể hoàn tất Component Issue.",
    "The container subledger was changed concurrently. The component issue cannot be completed.",
    "容器明细账被其他操作同时修改，无法完成配件出库。",
  ],
  [
    "Container đã CLOSED/ISSUED nên không dùng cho scan mới.",
    "The container is CLOSED/ISSUED and cannot be used for new scans.",
    "容器已处于 已关闭 或 已出库 状态，不能用于新增扫描。",
  ],
  [
    "Container đã bị thay đổi bởi thao tác khác, vui lòng tải lại dữ liệu.",
    "The container was changed by another operation. Reload the data.",
    "容器已被其他操作修改，请重新加载数据。",
  ],
  [
    "Container đã thay đổi bởi request khác.",
    "The container was changed by another request.",
    "容器已被其他请求修改。",
  ],
  [
    "Content SKU không khớp primary_sku_id.",
    "The content SKU does not match primary_sku_id.",
    "内容物的 SKU 与 primary_sku_id 不匹配。",
  ],
  [
    "Contract liên kết phiếu linh kiện không được hỗ trợ.",
    "The linked component issue contract is not supported.",
    "不支持此配件出库关联接口约定。",
  ],
  [
    "Contract này chỉ dành cho OUTBOUND tạo mới.",
    "This contract only supports creating new OUTBOUND documents.",
    "此接口约定仅支持创建新的 OUTBOUND 单据。",
  ],
  [
    "Contract này chỉ áp dụng CREATE, SCAN và POST; không dùng cho RECORD.",
    "This contract only supports CREATE, SCAN and POST, not RECORD.",
    "此接口约定仅支持 CREATE、SCAN 和 POST，不支持 RECORD。",
  ],
  [
    "Contract phục hồi NFC chưa được hỗ trợ.",
    "The NFC recovery contract is not supported.",
    "不支持此 NFC 恢复接口约定。",
  ],
  [
    "Contract timeline chỉ hỗ trợ GET/HEAD chi tiết phiếu nhập hoặc xuất hiện hữu.",
    "The timeline contract only supports GET/HEAD details of existing receipt or issue documents.",
    "时间线接口仅支持通过 GET 或 HEAD 查询现有入库单或出库单的详情。",
  ],
  [
    "Contract đọc P21 không được hỗ trợ.",
    "The P21 read contract is not supported.",
    "不支持此 P21 读取接口约定。",
  ],
  [
    "Contract đọc lịch sử linh kiện không được hỗ trợ.",
    "The component history read contract is not supported.",
    "不支持此配件历史读取接口约定。",
  ],
  ...BACKEND_CATALOG_BATCH_1_EXTRA,
];
