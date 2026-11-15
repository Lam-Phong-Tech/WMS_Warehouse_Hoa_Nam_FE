/** Source-backed backend messages, including normalized UI and original PHP aliases. */
export const BACKEND_CATALOG_BATCH_3: ReadonlyArray<
  readonly [source: string, en: string, zh: string]
> = [
  [
    "Nguồn chưa lưu trường được yêu cầu; không coi là không có kết quả.",
    "The source does not retain the requested field; this does not mean there are no results.",
    "数据源未保存请求的字段；这不代表没有结果。",
  ],
  [
    "Nguồn chứng từ chưa có định danh hợp lệ.",
    "The source document has no valid identifier.",
    "源单据缺少有效标识。",
  ],
  [
    "Nguồn chứng từ có dữ liệu không hợp lệ; không trả kết quả một phần.",
    "The source document contains invalid data; partial results cannot be returned.",
    "源单据含无效数据，无法返回部分结果。",
  ],
  [
    "Nguồn chứng từ tạm thời chưa khả dụng; không trả tổng một phần.",
    "The document source is temporarily unavailable; partial totals cannot be returned.",
    "单据数据源暂不可用，无法返回部分合计。",
  ],
  [
    "Nguồn container chưa có chủ quản kho để hỗ trợ nhiều kho; không suy phạm vi.",
    "The container source has no warehouse owner for multi-warehouse support; scope cannot be inferred.",
    "容器数据源缺少支持多仓库的所属仓库，无法推断范围。",
  ],
  [
    "Nguồn cấp số BH chưa sẵn sàng.",
    "The BH numbering source is not ready.",
    "BH 编号来源尚未就绪。",
  ],
  [
    "Nguồn cấp số phiếu nhập chưa sẵn sàng.",
    "The inbound document numbering source is not ready.",
    "入库单编号来源尚未就绪。",
  ],
  [
    "Nguồn giữ số PN chưa sẵn sàng.",
    "The PN number reservation source is not ready.",
    "PN 编号预留来源尚未就绪。",
  ],
  [
    "Nguồn giữ số PX chưa sẵn sàng.",
    "The PX number reservation source is not ready.",
    "PX 编号预留来源尚未就绪。",
  ],
  [
    "Nguồn giữ số chứng từ chưa sẵn sàng.",
    "The document number reservation source is not ready.",
    "单据编号预留来源尚未就绪。",
  ],
  [
    "Nguồn gọi (Origin) không được phép dùng phiên đăng nhập bằng cookie.",
    "This Origin is not allowed to use a cookie-based login session.",
    "此 Origin 不允许使用基于 cookie 的登录会话。",
  ],
  [
    "Nguồn handoff không sẵn sàng; không dựng mốc gửi Web.",
    "The handoff source is unavailable; the Web submission timestamp cannot be established.",
    "交接数据源不可用，无法确定 Web 提交时间。",
  ],
  [
    "Nguồn hộp tạm thời chưa sẵn sàng; không trả rỗng hoặc tổng một phần.",
    "The box source is temporarily unavailable; empty results or partial totals cannot be returned.",
    "箱数据源暂不可用，无法返回空结果或部分合计。",
  ],
  [
    "Nguồn liên kết linh kiện chưa khả dụng.",
    "The component linkage source is unavailable.",
    "配件关联数据源不可用。",
  ],
  [
    "Nguồn liên kết phiếu linh kiện chưa đủ schema để đối chiếu.",
    "The component document linkage schema is insufficient for reconciliation.",
    "配件单据关联结构不足，无法核对。",
  ],
  [
    "Nguồn lịch sử chưa có schema/phạm vi được xác nhận.",
    "The history source has no confirmed schema or scope.",
    "历史数据源的结构或范围尚未确认。",
  ],
  [
    "Nguồn lịch sử linh kiện chưa đủ schema để đối chiếu.",
    "The component history schema is insufficient for reconciliation.",
    "配件历史结构不足，无法核对。",
  ],
  [
    "Nguồn lọc không khớp loại ID.",
    "The filter source does not match the ID type.",
    "筛选来源与 ID 类型不匹配。",
  ],
  [
    "Nguồn phiên quét chưa có schema/phạm vi được xác nhận.",
    "The scan session source has no confirmed schema or scope.",
    "扫描会话数据源的结构或范围尚未确认。",
  ],
  [
    "Nguồn thời gian báo cáo bảo hành chưa được hỗ trợ.",
    "The warranty report time source is not supported.",
    "不支持此保修报表时间来源。",
  ],
  [
    "Nguồn thời gian chưa có contract cho hệ cơ sở dữ liệu này.",
    "The time source has no contract for this database system.",
    "此数据库系统尚无时间来源契约。",
  ],
  [
    "Nguồn vị trí chưa sẵn sàng; không suy thành chưa có vị trí.",
    "The location source is not ready; this does not mean there is no location.",
    "位置数据源尚未就绪，这不代表没有位置。",
  ],
  [
    "Nguồn đăng ký thiết bị chưa được phép.",
    "The device registration source is not allowed.",
    "不允许此设备注册来源。",
  ],
  [
    "Nguồn được phép đọc chưa sẵn sàng; không trả danh sách hoặc tổng một phần.",
    "The authorized data source is not ready; partial lists or totals cannot be returned.",
    "获准读取的数据源尚未就绪，无法返回部分列表或合计。",
  ],
  [
    "Nguồn đối chiếu kho của hiện vật chưa khả dụng.",
    "The item's warehouse reconciliation source is unavailable.",
    "实物仓库核对数据源不可用。",
  ],
  [
    "Ngành nghề không tồn tại hoặc đã Ngừng hoạt động.",
    "The industry does not exist or is INACTIVE.",
    "行业不存在或为 INACTIVE。",
  ],
  [
    "Ngành nghề không tồn tại hoặc đã INACTIVE.",
    "The industry does not exist or is INACTIVE.",
    "行业不存在或为 INACTIVE。",
  ],
  [
    "Người dùng chưa được xác thực.",
    "The user is not authenticated.",
    "用户尚未认证。",
  ],
  [
    "Người dùng đã bị thay đổi bởi thao tác khác; tải lại trước khi lưu.",
    "Another operation changed this user; reload before saving.",
    "其他操作已更改此用户，请重新加载后保存。",
  ],
  [
    "Ngữ cảnh SYSTEM không nhận UUID kho.",
    "The SYSTEM context does not accept a warehouse UUID.",
    "SYSTEM 上下文不接受仓库 UUID。",
  ],
  [
    "Ngữ cảnh kho không còn hợp lệ.",
    "The warehouse context is no longer valid.",
    "仓库上下文已失效。",
  ],
  [
    "Ngữ cảnh kho không còn hợp lệ; tải lại phiên.",
    "The warehouse context is no longer valid; reload the session.",
    "仓库上下文已失效，请重新加载会话。",
  ],
  [
    "Ngữ cảnh kho nằm ngoài phạm vi được gán.",
    "The warehouse context is outside the assigned scope.",
    "仓库上下文超出分配范围。",
  ],
  [
    "Ngữ cảnh kho đã thay đổi; tải lại phiên trước khi tiếp nhận.",
    "The warehouse context changed; reload the session before receiving.",
    "仓库上下文已更改，请重新加载会话后接收。",
  ],
  [
    "Ngữ cảnh thay đổi trước khi ghi nhận yêu cầu.",
    "The context changed before the request was recorded.",
    "记录请求前上下文已更改。",
  ],
  [
    "Nhà cung cấp không tồn tại trong danh mục chung.",
    "The supplier does not exist in the shared catalog.",
    "供应商不存在于共享目录中。",
  ],
  [
    "Nhà cung cấp đã ngừng sử dụng; chọn lại trước khi ghi nhận.",
    "The supplier is inactive; select another before recording.",
    "供应商已停用，请重新选择后记录。",
  ],
  [
    "Nhà cung cấp đã ngừng sử dụng; chọn lại trước khi lưu.",
    "The supplier is inactive; select another before saving.",
    "供应商已停用，请重新选择后保存。",
  ],
  [
    "Nhà cung cấp đã được cập nhật; tải lại trước khi lưu.",
    "The supplier was updated; reload before saving.",
    "供应商已更新，请重新加载后保存。",
  ],
  [
    "Nhãn outbound không được chứa SĐT/customer_phone.",
    "Outbound labels must not contain phone numbers/customer_phone.",
    "出库标签不得包含电话号码/customer_phone。",
  ],
  [
    "Nhãn đóng gói đã đóng băng snapshot (Sẵn sàng in trở đi). Không được thay đổi match; hãy Cancel phiếu và tạo lại nếu dữ liệu lô sai.",
    "The packing label snapshot is frozen from READY_TO_PRINT onward. Matching cannot be changed; cancel and recreate the document if batch data is incorrect.",
    "包装标签快照自 READY_TO_PRINT 状态起已冻结，无法更改匹配；若批次数据有误，请取消并重建单据。",
  ],
  [
    "Packing Label đã đóng băng snapshot (READY_TO_PRINT trở đi). Không được thay đổi match; hãy Cancel phiếu và tạo lại nếu dữ liệu lô sai.",
    "The packing label snapshot is frozen from READY_TO_PRINT onward. Matching cannot be changed; cancel and recreate the document if batch data is incorrect.",
    "包装标签快照自 READY_TO_PRINT 状态起已冻结，无法更改匹配；若批次数据有误，请取消并重建单据。",
  ],
  [
    "Nhóm hàng không tồn tại.",
    "The product category does not exist.",
    "商品类别不存在。",
  ],
  [
    "No availability projection is defined for this route; native receipts/binary reads keep their owner contract.",
    "No availability projection is defined for this route; native receipts/binary reads keep their owner contract.",
    "此路由未定义可用性投影；原生回执及二进制读取沿用所属方契约。",
  ],
  [
    "Nếu thông tin hợp lệ, mã xác minh mới đã được gửi.",
    "If the information is valid, a new verification code has been sent.",
    "若信息有效，新的验证码已发送。",
  ],
  [
    "Nền tảng thiết bị không khớp đăng ký.",
    "The device platform does not match its registration.",
    "设备平台与注册信息不匹配。",
  ],
  [
    "Nội dung bản nháp vượt giới hạn 768 KiB.",
    "The draft content exceeds the 768 KiB limit.",
    "草稿内容超过 768 KiB 限制。",
  ],
  [
    "Nội dung bản nháp vượt giới hạn.",
    "The draft content exceeds the limit.",
    "草稿内容超出限制。",
  ],
  [
    "Nội dung kết thúc ca có trường không được hỗ trợ.",
    "The shift closing content contains unsupported fields.",
    "结束班次内容含不支持的字段。",
  ],
  [
    "Nội dung lượt phục hồi không khớp request gốc.",
    "The recovery attempt content does not match the original request.",
    "恢复尝试内容与原请求不匹配。",
  ],
  [
    "Nội dung nhà cung cấp vượt giới hạn.",
    "The supplier content exceeds the limit.",
    "供应商内容超出限制。",
  ],
  [
    "Nội dung tìm kiếm phải là UTF-8 hợp lệ.",
    "Search text must be valid UTF-8.",
    "搜索内容必须为有效 UTF-8。",
  ],
  [
    "Nội dung tìm kiếm tối đa 200 ký tự sau chuẩn hóa.",
    "Search text must not exceed 200 characters after normalization.",
    "搜索内容规范化后最多 200 个字符。",
  ],
  [
    "Nội dung tệp không phải bảng tính Excel hợp lệ (phần mở rộng không khớp nội dung thật).",
    "The file is not a valid Excel workbook; its extension does not match its actual content.",
    "文件不是有效的 Excel 工作簿，扩展名与实际内容不匹配。",
  ],
  [
    "Nội dung đọc lại không khớp chính xác payload đã chuẩn bị.",
    "The read-back content does not exactly match the prepared payload.",
    "回读内容与预备载荷不完全匹配。",
  ],
  [
    "Nội dung đọc lại không khớp payload đã chuẩn bị.",
    "The read-back content does not match the prepared payload.",
    "回读内容与预备载荷不匹配。",
  ],
  [
    "Nội dung đọc lại từ chip không trỏ về đúng hiện vật đang gán.",
    "The chip's read-back content does not identify the item being assigned.",
    "芯片回读内容未指向正在绑定的实物。",
  ],
  [
    "Outbound phải liên kết toa/request nguồn.",
    "The outbound document must link to its source request.",
    "出库单必须关联源申请单。",
  ],
  [
    "Outbound phải được sinh từ toa/request nguồn.",
    "The outbound document must be generated from its source request.",
    "出库单必须由源申请单生成。",
  ],
  [
    "Outbound phải được sinh từ toa/request đã consume theo BP-WMS-04.",
    "The outbound document must be generated from a request consumed under BP-WMS-04.",
    "出库单必须由已按 BP-WMS-04 处理的申请单生成。",
  ],
  [
    "Outbound sequence lock unavailable.",
    "Outbound sequence lock unavailable.",
    "出库序号锁不可用。",
  ],
  [
    "Outbound sinh từ toa Excel không được thay line nguồn; hãy Cancel và tạo request mới.",
    "Outbound documents generated from Excel requests cannot change source lines; cancel and create a new request.",
    "由 Excel 申请生成的出库单不得更改源明细，请取消并新建申请。",
  ],
  [
    "Outbound sản phẩm chỉ chấp nhận SKU Sản phẩm; Linh kiện chỉ xuất qua Component Issue WARRANTY.",
    "Product outbound documents only accept PRODUCT SKUs; COMPONENT can only be issued through Component Issue WARRANTY.",
    "产品出库单仅接受 PRODUCT SKU；COMPONENT 只能通过 Component Issue WARRANTY 出库。",
  ],
  [
    "Outbound sản phẩm chỉ chấp nhận SKU PRODUCT; COMPONENT chỉ xuất qua Component Issue WARRANTY.",
    "Product outbound documents only accept PRODUCT SKUs; COMPONENT can only be issued through Component Issue WARRANTY.",
    "产品出库单仅接受 PRODUCT SKU；COMPONENT 只能通过 Component Issue WARRANTY 出库。",
  ],
  [
    "Outbound sản phẩm chỉ nhận SKU loại Sản phẩm.",
    "Product outbound documents only accept PRODUCT SKUs.",
    "产品出库单仅接受 PRODUCT 类型 SKU。",
  ],
  [
    "Outbound sản phẩm chỉ nhận SKU loại PRODUCT.",
    "Product outbound documents only accept PRODUCT SKUs.",
    "产品出库单仅接受 PRODUCT 类型 SKU。",
  ],
  [
    "Outbound sản phẩm không được scan Linh kiện; linh kiện chỉ xuất qua Component Issue WARRANTY.",
    "Product outbound documents cannot scan COMPONENT; components can only be issued through Component Issue WARRANTY.",
    "产品出库单不得扫描 COMPONENT；配件只能通过 Component Issue WARRANTY 出库。",
  ],
  [
    "Outbound sản phẩm không được scan COMPONENT; linh kiện chỉ xuất qua Component Issue WARRANTY.",
    "Product outbound documents cannot scan COMPONENT; components can only be issued through Component Issue WARRANTY.",
    "产品出库单不得扫描 COMPONENT；配件只能通过 Component Issue WARRANTY 出库。",
  ],
  [
    "Owner chưa chứng minh tệp đã lưu; không báo thành công.",
    "The owner has not confirmed the file was saved; success cannot be reported.",
    "所属方尚未确认文件已保存，无法报告成功。",
  ],
  [
    "Owner metadata is not an object.",
    "Owner metadata is not an object.",
    "所属方元数据不是对象。",
  ],
  [
    "Owner organization mismatch.",
    "Owner organization mismatch.",
    "所属组织不匹配。",
  ],
  [
    "Owner success envelope is không hợp lệ; no empty fallback.",
    "The owner's success envelope is invalid; an empty fallback is not allowed.",
    "所属方的成功响应封装无效，不允许以空结果回退。",
  ],
  [
    "Owner success envelope is invalid; no empty fallback.",
    "The owner's success envelope is invalid; an empty fallback is not allowed.",
    "所属方的成功响应封装无效，不允许以空结果回退。",
  ],
  [
    "Owner supplied an không hợp lệ write precondition; no replacement ETag is invented.",
    "The owner supplied an invalid write precondition; a replacement ETag cannot be invented.",
    "所属方提供的写入前提条件无效，无法生成替代 ETag。",
  ],
  [
    "Owner supplied an invalid write precondition; no replacement ETag is invented.",
    "The owner supplied an invalid write precondition; a replacement ETag cannot be invented.",
    "所属方提供的写入前提条件无效，无法生成替代 ETag。",
  ],
  [
    "P03 chỉ nhận application/json.",
    "P03 only accepts application/json.",
    "P03 仅接受 application/json。",
  ],
  [
    "P06 GET chỉ nhận query, không nhận body.",
    "P06 GET only accepts query parameters, not a body.",
    "P06 GET 仅接受查询参数，不接受请求体。",
  ],
  [
    "P07 không cho phép thay thế chip đang liên kết.",
    "P07 does not allow replacement of a linked chip.",
    "P07 不允许替换已关联的芯片。",
  ],
  [
    "P19 record chỉ nhận JSON body, không nhận query.",
    "P19 record only accepts a JSON body, not query parameters.",
    "P19 record 仅接受 JSON 请求体，不接受查询参数。",
  ],
  [
    "P19 record là xác nhận Post; lưu dở bằng P03 SAVE, không record false.",
    "P19 record confirms posting; use P03 SAVE for drafts, not record false.",
    "P19 record 用于确认过账；暂存草稿请使用 P03 SAVE，不得使用 record false。",
  ],
  [
    "P19 yêu cầu bản nháp P03 đã lưu; không dùng record standalone để phục hồi.",
    "P19 requires a saved P03 draft; standalone record cannot be used for recovery.",
    "P19 需要已保存的 P03 草稿，不得使用独立 record 恢复。",
  ],
  [
    "P21 chỉ dùng GET nháp và biên nhận đã khai báo.",
    "P21 only uses declared draft and receipt GET requests.",
    "P21 仅使用已声明的草稿和回执 GET 请求。",
  ],
  [
    "P21 chỉ đọc query đã khai báo, không nhận body hoặc bộ lọc khác.",
    "P21 only reads declared query parameters, not a body or other filters.",
    "P21 仅读取已声明的查询参数，不接受请求体或其他筛选条件。",
  ],
  [
    "P22 chỉ đọc, không nhận body.",
    "P22 is read-only and does not accept a body.",
    "P22 为只读，不接受请求体。",
  ],
  [
    "P22 không phải lịch sử phiên quét.",
    "P22 is not scan session history.",
    "P22 不是扫描会话历史。",
  ],
  [
    "PATCH yêu cầu header If-Match chứa version hiện tại.",
    "PATCH requires an If-Match header containing the current version.",
    "PATCH 需要包含当前版本的 If-Match 请求头。",
  ],
  [
    "Package Variant không tồn tại hoặc không Đang hoạt động.",
    "The Package Variant does not exist or is not ACTIVE.",
    "包装规格不存在或不是 ACTIVE 状态。",
  ],
  [
    "Package Variant không tồn tại hoặc không ACTIVE.",
    "The Package Variant does not exist or is not ACTIVE.",
    "包装规格不存在或不是 ACTIVE 状态。",
  ],
  [
    "Parent container không khả dụng.",
    "The parent container is unavailable.",
    "父容器不可用。",
  ],
  [
    "Parent container không tồn tại.",
    "The parent container does not exist.",
    "父容器不存在。",
  ],
  [
    "Payload có trường chưa được hỗ trợ; không gửi name, nickname, avatar hoặc quyền ngoài contract.",
    "The payload contains unsupported fields; do not send name, nickname, avatar or permissions outside the contract.",
    "载荷含不支持的字段；不得发送契约外的 name、nickname、avatar 或权限。",
  ],
  [
    "Payload có trường ngoài contract P09.",
    "The payload contains fields outside the P09 contract.",
    "载荷含 P09 契约外的字段。",
  ],
  [
    "Pending return chỉ được Post khi physical_return_confirmed=true.",
    "A pending return can only be posted when physical_return_confirmed=true.",
    "仅当 physical_return_confirmed=true 时，待退回记录才能过账。",
  ],
  [
    "Permit đã có lượt xác nhận; không tạo key/chip thay thế khi chưa rõ kết quả.",
    "The permit already has a confirmation attempt; do not create a replacement key or chip while the result is unknown.",
    "许可已有确认尝试；结果未明时不得创建替代密钥或芯片。",
  ],
  [
    "Phiên chỉ dùng access token cần thời hạn xác thực hữu hạn.",
    "Access-token-only sessions require a finite authentication lifetime.",
    "仅使用 access token 的会话必须有明确的认证有效期。",
  ],
  [
    "Phiên cũ không có định danh ổn định. Vui lòng đăng nhập lại.",
    "The old session has no stable identifier. Please sign in again.",
    "旧会话缺少稳定标识，请重新登录。",
  ],
  [
    "Phiên hiện tại đã bắt đầu ca tại kho khác.",
    "The current session has already started a shift at another warehouse.",
    "当前会话已在其他仓库开始班次。",
  ],
  [
    "Phiên hoặc kho đã thay đổi trước khi xác nhận.",
    "The session or warehouse changed before confirmation.",
    "确认前会话或仓库已更改。",
  ],
  [
    "Phiên làm việc đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.",
    "The session expired or was revoked. Please sign in again.",
    "会话已过期或被撤销，请重新登录。",
  ],
  [
    "Phiên quét chỉ lọc theo created_at; không suy ra ngày bắt đầu/kết thúc.",
    "Scan sessions can only be filtered by created_at; start and end dates cannot be inferred.",
    "扫描会话仅可按 created_at 筛选，无法推断开始或结束日期。",
  ],
  [
    "Phiên quét chỉ nhận warehouse_id, limit và cursor; tổng phiên không được thu hẹp bằng bộ lọc danh sách.",
    "Scan sessions only accept warehouse_id, limit and cursor; list filters must not narrow session totals.",
    "扫描会话仅接受 warehouse_id、limit 和 cursor；列表筛选不得缩小会话合计范围。",
  ],
  [
    "Phiên quét đã gắn với bản nháp khác; không tạo bản thay thế.",
    "The scan session is linked to another draft; a replacement cannot be created.",
    "扫描会话已关联其他草稿，无法创建替代草稿。",
  ],
  [
    "Phiên trình duyệt được làm mới bằng cookie HttpOnly; không gửi refresh token trong body.",
    "Browser sessions refresh through HttpOnly cookies; do not send a refresh token in the body.",
    "浏览器会话通过 HttpOnly cookie 刷新，请勿在请求体中发送 refresh token。",
  ],
  [
    "Phiên xác minh bảo mật đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
    "The security verification session expired or is invalid. Please sign in again.",
    "安全验证会话已过期或无效，请重新登录。",
  ],
  [
    "Phiên xác minh thiết bị đã hết hạn. Vui lòng đăng nhập lại.",
    "The device verification session expired. Please sign in again.",
    "设备验证会话已过期，请重新登录。",
  ],
  [
    "Phiên xác thực hai bước không hợp lệ hoặc đã hết hạn. Hãy đăng nhập lại.",
    "The two-step verification session is invalid or expired. Please sign in again.",
    "两步验证会话无效或已过期，请重新登录。",
  ],
  [
    "Phiên đã bắt đầu ca; không thể đổi hoặc bỏ kho của ca này.",
    "The session has started a shift; its warehouse cannot be changed or removed.",
    "会话已开始班次，无法更改或移除此班次的仓库。",
  ],
  [
    "Phiên đăng nhập không còn hợp lệ.",
    "The login session is no longer valid.",
    "登录会话已失效。",
  ],
  [
    "Phiên đăng nhập đã hết hạn hoặc bị thu hồi.",
    "The login session expired or was revoked.",
    "登录会话已过期或被撤销。",
  ],
  [
    "Phiếu Web giữ nguyên doc_no, không cấp PX thay thế.",
    "Web documents retain doc_no; a replacement PX is not issued.",
    "Web 单据保留 doc_no，不另行分配 PX。",
  ],
  [
    "Phiếu nguồn nằm ngoài phạm vi kho.",
    "The source document is outside the warehouse scope.",
    "源单据超出仓库范围。",
  ],
  [
    "Phiếu nguồn đã thay đổi; tải lại chi tiết.",
    "The source document changed; reload its details.",
    "源单据已更改，请重新加载详情。",
  ],
  [
    "Phiếu nguồn đã thay đổi; đọc lại trước khi ghi nhận.",
    "The source document changed; read it again before recording.",
    "源单据已更改，请重新读取后记录。",
  ],
  [
    "Phiếu nháp đã hết hạn sau 07 ngày. Hãy hủy phiếu hoặc tạo phiếu mới.",
    "The draft expired after 07 days. Cancel it or create a new document.",
    "草稿已超过 07 天有效期，请取消或新建单据。",
  ],
  [
    "Phiếu nhập MVP chỉ được phép sử dụng Kho tổng Hoa Nam đang Đang hoạt động.",
    "MVP inbound documents can only use the ACTIVE Hoa Nam central warehouse.",
    "MVP 入库单仅可使用 ACTIVE 状态的 Hoa Nam 总仓。",
  ],
  [
    "Phiếu nhập MVP chỉ được phép sử dụng Kho tổng Hoa Nam đang ACTIVE.",
    "MVP inbound documents can only use the ACTIVE Hoa Nam central warehouse.",
    "MVP 入库单仅可使用 ACTIVE 状态的 Hoa Nam 总仓。",
  ],
  [
    "Phiếu nhập đã thay đổi. Hãy tải lại dữ liệu trước khi lưu.",
    "The inbound document changed. Reload the data before saving.",
    "入库单已更改，请重新加载数据后保存。",
  ],
  [
    "Phiếu nhập đã đóng (Đã ghi nhận/Đã hủy); không thể đính kèm thêm chứng từ.",
    "The inbound document is closed (POSTED/CANCELLED); no more attachments can be added.",
    "入库单已关闭（POSTED/CANCELLED），无法继续添加附件。",
  ],
  [
    "Phiếu nhập đã đóng (POSTED/CANCELLED); không thể đính kèm thêm chứng từ.",
    "The inbound document is closed (POSTED/CANCELLED); no more attachments can be added.",
    "入库单已关闭（POSTED/CANCELLED），无法继续添加附件。",
  ],
  [
    "Phiếu này chưa thuộc lịch sử xuất đã ghi sổ.",
    "This document is not part of posted outbound history.",
    "此单据尚不属于已过账出库历史。",
  ],
  [
    "Phiếu phải ở trạng thái Đã tiếp nhận để chuyển TEMP_ONLY.",
    "The document must be RECEIVED to switch to TEMP_ONLY.",
    "单据必须处于 RECEIVED 状态才能转为 TEMP_ONLY。",
  ],
  [
    "Phiếu phải ở trạng thái RECEIVED để chuyển TEMP_ONLY.",
    "The document must be RECEIVED to switch to TEMP_ONLY.",
    "单据必须处于 RECEIVED 状态才能转为 TEMP_ONLY。",
  ],
  [
    "Phiếu xuất Mini App chỉ nhận SKU Sản phẩm Đang hoạt động.",
    "Mini App outbound documents only accept PRODUCT ACTIVE SKUs.",
    "Mini App 出库单仅接受 PRODUCT ACTIVE 的 SKU。",
  ],
  [
    "Phiếu xuất Mini App chỉ nhận SKU PRODUCT ACTIVE.",
    "Mini App outbound documents only accept PRODUCT ACTIVE SKUs.",
    "Mini App 出库单仅接受 PRODUCT ACTIVE 的 SKU。",
  ],
  [
    "Phiếu xuất chưa có Nhãn đóng gói. Chỉ full match mới tạo Nhãn đóng gói.",
    "The outbound document has no packing label. A packing label is only created after a full match.",
    "出库单尚无包装标签，只有完全匹配后才会创建包装标签。",
  ],
  [
    "Phiếu xuất chưa có Packing Label. Chỉ full match mới tạo Packing Label.",
    "The outbound document has no packing label. A packing label is only created after a full match.",
    "出库单尚无包装标签，只有完全匹配后才会创建包装标签。",
  ],
  [
    "Phiếu xuất không ở trạng thái cho phép thao tác nhãn.",
    "The outbound document's status does not allow label operations.",
    "出库单当前状态不允许操作标签。",
  ],
  [
    "Phiếu xuất thiếu kho nguồn.",
    "The outbound document has no source warehouse.",
    "出库单缺少源仓库。",
  ],
  [
    "Phiếu xuất vừa tạo không còn tồn tại.",
    "The newly created outbound document no longer exists.",
    "刚创建的出库单已不存在。",
  ],
  [
    "Phiếu xuất đã đóng (Đã ghi nhận/Đã hủy); không thể đính kèm thêm chứng từ.",
    "The outbound document is closed (POSTED/CANCELLED); no more attachments can be added.",
    "出库单已关闭（POSTED/CANCELLED），无法继续添加附件。",
  ],
  [
    "Phiếu xuất đã đóng (POSTED/CANCELLED); không thể đính kèm thêm chứng từ.",
    "The outbound document is closed (POSTED/CANCELLED); no more attachments can be added.",
    "出库单已关闭（POSTED/CANCELLED），无法继续添加附件。",
  ],
  [
    "Phiếu đã có scan evidence; SKU của dòng đã quét không được thay đổi.",
    "The document has scan evidence; the SKU of scanned lines cannot be changed.",
    "单据已有扫描凭证，不得更改已扫描明细的 SKU。",
  ],
  [
    "Phiếu đã có scan evidence; hãy Cancel và tạo lại để không xóa lịch sử scan.",
    "The document has scan evidence; cancel and recreate it to preserve scan history.",
    "单据已有扫描凭证，请取消并重建以保留扫描历史。",
  ],
  [
    "Phiếu đã có scan evidence; import batch của dòng đã quét không được thay đổi.",
    "The document has scan evidence; the import batch of scanned lines cannot be changed.",
    "单据已有扫描凭证，不得更改已扫描明细的导入批次。",
  ],
  [
    "Phiếu đã có scan evidence; không được thêm hoặc xóa dòng. Chỉ được sửa Expected qty/ghi chú trên đúng dòng hiện hữu.",
    "The document has scan evidence; lines cannot be added or removed. Only Expected qty/notes on existing lines can be edited.",
    "单据已有扫描凭证，不得新增或删除明细，仅可修改原有明细的 Expected qty/备注。",
  ],
  [
    "Phiếu đã có scan evidence; thứ tự và định danh dòng phải được giữ nguyên.",
    "The document has scan evidence; line order and identifiers must be retained.",
    "单据已有扫描凭证，必须保留明细顺序和标识。",
  ],
  [
    "Phiếu đã thay đổi. Hãy tải lại dữ liệu trước khi gỡ mã.",
    "The document changed. Reload the data before removing codes.",
    "单据已更改，请重新加载数据后移除编码。",
  ],
  [
    "Physical code bị trùng trong payload.",
    "The payload contains duplicate physical codes.",
    "载荷中存在重复的物理编码。",
  ],
  [
    "Physical code của container không tồn tại hoặc không Đang hoạt động.",
    "The container's physical code does not exist or is not ACTIVE.",
    "容器物理编码不存在或不是 ACTIVE 状态。",
  ],
  [
    "Physical code của container không tồn tại hoặc không ACTIVE.",
    "The container's physical code does not exist or is not ACTIVE.",
    "容器物理编码不存在或不是 ACTIVE 状态。",
  ],
  [
    "Physical code không thuộc SKU này.",
    "The physical code does not belong to this SKU.",
    "物理编码不属于此 SKU。",
  ],
  [
    "Physical code không thuộc item của SKU này.",
    "The physical code does not belong to an item of this SKU.",
    "物理编码不属于此 SKU 的实物。",
  ],
  [
    "Physical code phải map tối đa một item_id hoặc container_id.",
    "A physical code must map to at most one item_id or container_id.",
    "物理编码最多只能映射一个 item_id 或 container_id。",
  ],
  [
    "Physical code phải Đang hoạt động.",
    "The physical code must be ACTIVE.",
    "物理编码必须为 ACTIVE。",
  ],
  [
    "Physical code phải ACTIVE.",
    "The physical code must be ACTIVE.",
    "物理编码必须为 ACTIVE。",
  ],
  [
    "Physical code đã map target khác.",
    "The physical code is mapped to another target.",
    "物理编码已映射到其他目标。",
  ],
  [
    "Physical code đã được gán cho container khác.",
    "The physical code is assigned to another container.",
    "物理编码已分配给其他容器。",
  ],
  [
    "Physical code đã được gán cho object khác.",
    "The physical code is assigned to another object.",
    "物理编码已分配给其他对象。",
  ],
  [
    "Phòng ban không tồn tại.",
    "The department does not exist.",
    "部门不存在。",
  ],
  [
    "Phạm vi TEST đã đóng. Không tự gửi lại.",
    "The TEST scope is closed. Do not resend automatically.",
    "TEST 范围已关闭，请勿自动重发。",
  ],
  [
    "Phạm vi phiên đã thay đổi.",
    "The session scope changed.",
    "会话范围已更改。",
  ],
  [
    "Phạm vi và người thao tác do máy chủ xác định.",
    "The server determines the scope and operator.",
    "范围和操作人由服务器确定。",
  ],
  [
    "Phạm vi và phiên xác thực do máy chủ xác định.",
    "The server determines the scope and authentication session.",
    "范围和认证会话由服务器确定。",
  ],
  [
    "Phải chỉ định dòng cần gỡ bằng component_issue_item_id hoặc code_value/item_id/container_id.",
    "Specify the line to remove using component_issue_item_id or code_value/item_id/container_id.",
    "请通过 component_issue_item_id 或 code_value/item_id/container_id 指定要移除的明细。",
  ],
  [
    "Phải gửi ít nhất một trong required_qty hoặc note.",
    "Send at least one of required_qty or note.",
    "至少发送 required_qty 或 note 中的一项。",
  ],
  [
    "Phải gửi ít nhất một trường để cập nhật.",
    "Send at least one field to update.",
    "请至少发送一个待更新字段。",
  ],
  [
    "Phần mở rộng tệp không khớp nội dung thật.",
    "The file extension does not match its actual content.",
    "文件扩展名与实际内容不匹配。",
  ],
  [
    "Primary SKU của carton không khớp SKU của dòng nhập.",
    "The carton's primary SKU does not match the inbound line's SKU.",
    "纸箱主 SKU 与入库明细的 SKU 不匹配。",
  ],
  [
    "Priority đã được dùng bởi một rule Đang hoạt động khác trong cùng ngành nghề.",
    "This priority is used by another ACTIVE rule in the same industry.",
    "同一行业中的其他 ACTIVE 规则已使用此优先级。",
  ],
  [
    "Priority đã được dùng bởi một rule ACTIVE khác trong cùng ngành nghề.",
    "This priority is used by another ACTIVE rule in the same industry.",
    "同一行业中的其他 ACTIVE 规则已使用此优先级。",
  ],
  [
    "Product không tồn tại hoặc không Đang hoạt động.",
    "The product does not exist or is not ACTIVE.",
    "产品不存在或不是 ACTIVE 状态。",
  ],
  [
    "Product không tồn tại hoặc không ACTIVE.",
    "The product does not exist or is not ACTIVE.",
    "产品不存在或不是 ACTIVE 状态。",
  ],
  [
    "Product model chỉ được tham chiếu Brand Đang hoạt động.",
    "A product model can only reference an ACTIVE Brand.",
    "产品型号只能引用 ACTIVE 品牌。",
  ],
  [
    "Product model chỉ được tham chiếu Brand ACTIVE.",
    "A product model can only reference an ACTIVE Brand.",
    "产品型号只能引用 ACTIVE 品牌。",
  ],
  [
    "Publish App PV bắt buộc header If-Match chứa version hồ sơ App PV hiện tại (0 nếu SKU chưa có hồ sơ).",
    "Publishing to App PV requires an If-Match header with the current App PV profile version (0 if the SKU has no profile).",
    "发布到 App PV 需要 If-Match 请求头包含当前 App PV 档案版本（SKU 尚无档案时为 0）。",
  ],
  [
    "Publish/unpublish dùng PATCH /pv/products/{sku_id}/publish với quyền pv.publish.",
    "Publish/unpublish uses PATCH /pv/products/{sku_id}/publish with pv.publish permission.",
    "发布/取消发布使用 PATCH /pv/products/{sku_id}/publish，并需要 pv.publish 权限。",
  ],
  [
    "Putaway CONFIRMED; không phát sinh biến động tồn.",
    "Putaway CONFIRMED; no stock movement was generated.",
    "上架已 CONFIRMED，未产生库存变动。",
  ],
  [
    "Putaway invariant violated: stock movement count changed.",
    "Putaway invariant violated: stock movement count changed.",
    "上架约束被违反：库存变动记录数量已更改。",
  ],
  [
    "Putaway sẽ tạo vòng lặp container.",
    "Putaway would create a container cycle.",
    "上架操作会形成容器循环。",
  ],
  [
    "Putaway yêu cầu container BOX.",
    "Putaway requires a BOX container.",
    "上架操作需要 BOX 容器。",
  ],
  [
    "QR composite không parse được; dùng TEMP_ONLY nếu không thể định danh item.",
    "The composite QR cannot be parsed; use TEMP_ONLY if the item cannot be identified.",
    "无法解析组合 QR；若无法识别实物，请使用 TEMP_ONLY。",
  ],
  [
    "QR hợp lệ nhưng item chưa được đăng ký trong hệ thống.",
    "The QR is valid, but the item is not registered in the system.",
    "QR 有效，但实物尚未在系统中注册。",
  ],
  [
    "QR hợp lệ nhưng item chưa được đăng ký; dùng TEMP_ONLY nếu cần.",
    "The QR is valid, but the item is not registered; use TEMP_ONLY if needed.",
    "QR 有效，但实物尚未注册；如有需要，请使用 TEMP_ONLY。",
  ],
  [
    "QR/Barcode composite sai cấu trúc; không thể parse SKU + item unique.",
    "The composite QR/Barcode structure is invalid; SKU + item unique cannot be parsed.",
    "组合 QR/Barcode 结构无效，无法解析 SKU + item unique。",
  ],
  [
    "QR/Barcode sai cấu trúc; không thể resolve SKU + item identity.",
    "The QR/Barcode structure is invalid; SKU + item identity cannot be resolved.",
    "QR/Barcode 结构无效，无法解析 SKU + item identity。",
  ],
  [
    "Quan hệ component tạo chu trình.",
    "The component relationship creates a cycle.",
    "配件关系形成循环。",
  ],
  [
    "Quan hệ parent container tạo chu trình.",
    "The parent container relationship creates a cycle.",
    "父容器关系形成循环。",
  ],
  [
    "Query đối chiếu không thuộc contract.",
    "The reconciliation query is outside the contract.",
    "核对查询不符合契约。",
  ],
  [
    "Quy ước thời gian đã thay đổi; tải lại trang đầu.",
    "The time convention changed; reload the first page.",
    "时间约定已更改，请重新加载第一页。",
  ],
  [
    "Quyền cấp riêng này chưa được cấp cho người dùng.",
    "This individual permission has not been granted to the user.",
    "尚未向用户单独授予此权限。",
  ],
  [
    "Quyền hiện tại không cho phép đọc toàn bộ snapshot này.",
    "Your current permissions do not allow reading this entire snapshot.",
    "当前权限不允许读取完整快照。",
  ],
  [
    "Quyền hoặc phiên đã thay đổi trong lúc đọc.",
    "Permissions or the session changed during the read.",
    "读取期间权限或会话已更改。",
  ],
  [
    "Quyền không tồn tại hoặc đã ngừng hiệu lực, không thể cấp.",
    "The permission does not exist or is inactive and cannot be granted.",
    "权限不存在或已失效，无法授予。",
  ],
  [
    "Quyền nghiệp vụ đã thay đổi; không được đọc snapshot này.",
    "Business permissions changed; this snapshot cannot be read.",
    "业务权限已更改，无法读取此快照。",
  ],
  [
    "Quyền này đã được cấp riêng cho người dùng.",
    "This permission has already been granted to the user individually.",
    "已向用户单独授予此权限。",
  ],
  [
    "Quyền tra cứu yêu cầu đã hết hạn.",
    "The request lookup permission expired.",
    "申请查询权限已过期。",
  ],
  [
    "Quét mã QR bằng ứng dụng xác thực rồi gửi mã 6 chữ số để xác nhận.",
    "Scan the QR code with an authenticator app, then submit the 6-digit code to confirm.",
    "请使用验证器应用扫描 QR 码，然后提交 6 位验证码确认。",
  ],
  [
    "RECORD phải giữ đúng nháp, phiên quét và phiên bản gốc.",
    "RECORD must retain the original draft, scan session and version.",
    "RECORD 必须保留原草稿、扫描会话和版本。",
  ],
  [
    "RFID bắt buộc hardware_uid duy nhất.",
    "RFID requires a unique hardware_uid.",
    "RFID 需要唯一的 hardware_uid。",
  ],
  [
    "RFID bắt buộc hardware_uid.",
    "RFID requires hardware_uid.",
    "RFID 需要 hardware_uid。",
  ],
  [
    "RFID đã gắn trước đó cho item này.",
    "RFID was previously linked to this item.",
    "RFID 已关联过此实物。",
  ],
  [
    "Receipt có item đã Issue/Warranty; phải đảo dependency theo thứ tự ngược.",
    "The receipt has items already issued or in warranty; reverse dependencies in reverse order.",
    "入库记录含已出库或保修中的实物，必须按相反顺序撤销依赖交易。",
  ],
  [
    "Receipt item không còn ở trạng thái IN_STOCK/NEW (đã Issue/Warranty hoặc đã đảo); phải đảo dependency theo thứ tự ngược.",
    "The receipt item is no longer IN_STOCK/NEW (issued, in warranty or reversed); reverse dependencies in reverse order.",
    "入库实物已不处于 IN_STOCK/NEW（已出库、保修或已冲销），必须按相反顺序撤销依赖交易。",
  ],
  [
    "Receipt không còn khả dụng; không tự tạo yêu cầu mới.",
    "The receipt is no longer available; do not create a new request automatically.",
    "回执已不可用，请勿自动创建新请求。",
  ],
  [
    "Receipt không thuộc hiện vật, phiên và kho này.",
    "The receipt does not belong to this item, session and warehouse.",
    "回执不属于此实物、会话和仓库。",
  ],
  [
    "Receipt nghiệp vụ không xác nhận được chứng từ và kho; giao dịch được hoàn tác.",
    "The business receipt cannot confirm the document and warehouse; the transaction was rolled back.",
    "业务回执无法确认单据和仓库，交易已回滚。",
  ],
  [
    "Record dùng X-Draft-Version; If-Match chỉ dùng khi lưu bản nháp.",
    "Record uses X-Draft-Version; If-Match is only used when saving drafts.",
    "Record 使用 X-Draft-Version；If-Match 仅用于保存草稿。",
  ],
  [
    "Refresh token không hợp lệ hoặc đã hết hạn.",
    "The refresh token is invalid or expired.",
    "refresh token 无效或已过期。",
  ],
  [
    "Refresh token không thuộc phiên của access token đang dùng.",
    "The refresh token does not belong to the current access token's session.",
    "refresh token 不属于当前 access token 的会话。",
  ],
  [
    "Request ID hoặc Idempotency-Key đã được dùng cho yêu cầu khác.",
    "The Request ID or Idempotency-Key was used for a different request.",
    "Request ID 或 Idempotency-Key 已用于其他请求。",
  ],
  [
    "Request a fresh no-store representation, not a cached legacy body.",
    "Request a fresh no-store representation, not a cached legacy body.",
    "请请求新的 no-store 表示，不要使用缓存的旧版响应体。",
  ],
  [
    "Reservation thuộc lượt đã bị từ chối; phải prepare phục hồi.",
    "The reservation belongs to a rejected attempt; prepare recovery first.",
    "预留属于已拒绝的尝试，请先准备恢复。",
  ],
  [
    "Reverse Issue/Component Issue bắt buộc condition_status SELLABLE/Hàng lỗi/Không thể bán/xuất.",
    "Reverse Issue/Component Issue requires condition_status SELLABLE/DEFECTIVE/NON_SELLABLE.",
    "冲销出库/配件出库需要 condition_status 为 SELLABLE/DEFECTIVE/NON_SELLABLE。",
  ],
  [
    "Reverse Issue/Component Issue bắt buộc condition_status SELLABLE/DEFECTIVE/NON_SELLABLE.",
    "Reverse Issue/Component Issue requires condition_status SELLABLE/DEFECTIVE/NON_SELLABLE.",
    "冲销出库/配件出库需要 condition_status 为 SELLABLE/DEFECTIVE/NON_SELLABLE。",
  ],
  [
    "Reverse Issue/Component Issue chưa xác nhận hàng về vật lý; stock effect = 0.",
    "Reverse Issue/Component Issue has no physical return confirmation; stock effect = 0.",
    "冲销出库/配件出库尚未确认实物退回，stock effect = 0。",
  ],
  [
    "Revision metadata P06 không được hỗ trợ.",
    "P06 revision metadata is not supported.",
    "不支持 P06 版本元数据。",
  ],
  [
    "Role đang được gán cho người dùng, không thể xoá.",
    "The role is assigned to users and cannot be deleted.",
    "角色已分配给用户，无法删除。",
  ],
  [
    "Rule phải có ít nhất một selector: sku_id, category_id hoặc tag_id.",
    "A rule requires at least one selector: sku_id, category_id or tag_id.",
    "规则至少需要一个选择器：sku_id、category_id 或 tag_id。",
  ],
  [
    "SAVE đúng nháp tạo mới để cấp PX trước RECORD.",
    "SAVE the correct new draft to obtain PX before RECORD.",
    "请在 RECORD 前 SAVE 正确的新草稿以分配 PX。",
  ],
  [
    "SCAN/POST cần If-Match của phiếu canonical.",
    "SCAN/POST requires the canonical document's If-Match.",
    "SCAN/POST 需要正式单据的 If-Match。",
  ],
  [
    "SHA-256 không khớp nội dung tệp nhận được.",
    "SHA-256 does not match the received file content.",
    "SHA-256 与收到的文件内容不匹配。",
  ],
  [
    "SKU Linh kiện phải Đang hoạt động.",
    "The COMPONENT SKU must be ACTIVE.",
    "COMPONENT SKU 必须为 ACTIVE。",
  ],
  [
    "SKU COMPONENT phải ACTIVE.",
    "The COMPONENT SKU must be ACTIVE.",
    "COMPONENT SKU 必须为 ACTIVE。",
  ],
  [
    "SKU của item không tồn tại trong master data.",
    "The item's SKU does not exist in master data.",
    "实物的 SKU 不存在于主数据中。",
  ],
  [
    "SKU của item đang không Đang hoạt động.",
    "The item's SKU is not ACTIVE.",
    "实物的 SKU 不是 ACTIVE 状态。",
  ],
  [
    "SKU của item đang không ACTIVE.",
    "The item's SKU is not ACTIVE.",
    "实物的 SKU 不是 ACTIVE 状态。",
  ],
  [
    "SKU của mã scan không có dòng nào trên chứng từ.",
    "The scanned code's SKU has no line on this document.",
    "扫描编码的 SKU 在此单据中没有对应明细。",
  ],
  [
    "SKU của mã đã thay đổi; không xác nhận từ kết quả cũ.",
    "The code's SKU changed; do not confirm using an old result.",
    "编码的 SKU 已更改，请勿根据旧结果确认。",
  ],
  [
    "SKU embedded trong QR không khớp SKU của dòng chứng từ.",
    "The SKU embedded in the QR does not match the document line's SKU.",
    "QR 内嵌的 SKU 与单据明细的 SKU 不匹配。",
  ],
  [
    "SKU embedded trong QR không khớp SKU của item đã đăng ký.",
    "The SKU embedded in the QR does not match the registered item's SKU.",
    "QR 内嵌的 SKU 与已注册实物的 SKU 不匹配。",
  ],
  [
    "SKU hiện không còn available_qty để ghi nhận batch xuất.",
    "The SKU no longer has available_qty to post the outbound batch.",
    "SKU 已无可用 available_qty，无法记录出库批次。",
  ],
  [
    "SKU identifier and mã SKU point to different records.",
    "The SKU identifier and SKU code refer to different records.",
    "SKU 标识与 SKU 编码指向不同记录。",
  ],
  [
    "SKU identifier and SKU code point to different records.",
    "The SKU identifier and SKU code refer to different records.",
    "SKU 标识与 SKU 编码指向不同记录。",
  ],
  [
    "SKU không thể là component của chính nó.",
    "A SKU cannot be its own component.",
    "SKU 不能作为自身的配件。",
  ],
  [
    "SKU linh kiện của hộp không Đang hoạt động.",
    "The box's component SKU is not ACTIVE.",
    "箱内配件 SKU 不是 ACTIVE 状态。",
  ],
  [
    "SKU linh kiện của hộp không ACTIVE.",
    "The box's component SKU is not ACTIVE.",
    "箱内配件 SKU 不是 ACTIVE 状态。",
  ],
  [
    "SKU linh kiện không tồn tại hoặc không hoạt động.",
    "The component SKU does not exist or is inactive.",
    "配件 SKU 不存在或已停用。",
  ],
  [
    "SKU loại Linh kiện không được có component con.",
    "A COMPONENT SKU cannot have child components.",
    "COMPONENT 类型 SKU 不能包含子配件。",
  ],
  [
    "SKU loại COMPONENT không được có component con.",
    "A COMPONENT SKU cannot have child components.",
    "COMPONENT 类型 SKU 不能包含子配件。",
  ],
  [
    "SKU phải Đang hoạt động trước khi giữ chỗ ghi chip.",
    "The SKU must be ACTIVE before reserving a chip write.",
    "预留芯片写入前，SKU 必须为 ACTIVE。",
  ],
  [
    "SKU phải ACTIVE trước khi giữ chỗ ghi chip.",
    "The SKU must be ACTIVE before reserving a chip write.",
    "预留芯片写入前，SKU 必须为 ACTIVE。",
  ],
  [
    "SKU số lượng-mode không được gán item_id tùy ý khi điều chỉnh tồn kho.",
    "A quantity-mode SKU cannot be assigned an arbitrary item_id during a reversal.",
    "数量模式 SKU 在冲销时不得任意指定 item_id。",
  ],
  [
    "SKU quantity-mode không được gán item_id tùy ý khi reversal.",
    "A quantity-mode SKU cannot be assigned an arbitrary item_id during a reversal.",
    "数量模式 SKU 在冲销时不得任意指定 item_id。",
  ],
  [
    "SKU trong QR không tồn tại trong master data.",
    "The SKU in the QR does not exist in master data.",
    "QR 中的 SKU 不存在于主数据中。",
  ],
  [
    "SKU trong QR đang không Đang hoạt động.",
    "The SKU in the QR is not ACTIVE.",
    "QR 中的 SKU 不是 ACTIVE 状态。",
  ],
  [
    "SKU trong QR đang không ACTIVE.",
    "The SKU in the QR is not ACTIVE.",
    "QR 中的 SKU 不是 ACTIVE 状态。",
  ],
  [
    "SKU và số lượng quét phải khớp từng dòng kế hoạch, không chỉ tổng N/N.",
    "The scanned SKUs and quantities must match every plan line, not just the N/N total.",
    "扫描的 SKU 和数量必须逐行匹配计划，而非仅匹配 N/N 总数。",
  ],
  ["SKU đang không hoạt động.", "The SKU is inactive.", "SKU 已停用。"],
  [
    "SKU đã có hồ sơ App PV; hãy cập nhật hồ sơ hiện có.",
    "The SKU already has an App PV profile; update the existing profile.",
    "SKU 已有 App PV 档案，请更新现有档案。",
  ],
  [
    "SKU đã được cập nhật bởi phiên khác; tải lại trước khi lưu.",
    "Another session updated the SKU; reload before saving.",
    "其他会话已更新 SKU，请重新加载后保存。",
  ],
  [
    "SUPER_ADMIN là vai trò hệ thống, không cho phép sửa, xoá hoặc thay đổi ma trận quyền.",
    "SUPER_ADMIN is a system role; editing, deletion and permission matrix changes are not allowed.",
    "SUPER_ADMIN 为系统角色，不允许编辑、删除或更改权限矩阵。",
  ],
  [
    "Scan item cụ thể chỉ cho phép số lượng=1.",
    "Scanning a specific item only allows quantity=1.",
    "扫描具体实物时仅允许 quantity=1。",
  ],
  [
    "Scan item cụ thể chỉ cho phép quantity=1.",
    "Scanning a specific item only allows quantity=1.",
    "扫描具体实物时仅允许 quantity=1。",
  ],
  [
    "Scan đủ toàn bộ phiếu. Đã tổng hợp lô và tạo/đảm bảo 01 Nhãn đóng gói Nháp; stock_effect=NONE.",
    "The entire document was scanned. The batch was consolidated and exactly 01 DRAFT packing label was created/ensured; stock_effect=NONE.",
    "整张单据已扫描完成，已汇总批次并创建或确保恰好 01 个 DRAFT 包装标签；stock_effect=NONE。",
  ],
  [
    "Scan đủ toàn bộ phiếu. Đã tổng hợp lô và tạo/đảm bảo 01 Packing Label DRAFT; stock_effect=NONE.",
    "The entire document was scanned. The batch was consolidated and exactly 01 DRAFT packing label was created/ensured; stock_effect=NONE.",
    "整张单据已扫描完成，已汇总批次并创建或确保恰好 01 个 DRAFT 包装标签；stock_effect=NONE。",
  ],
  [
    "Schema chưa hỗ trợ new item candidate; hãy chạy migration mới nhất.",
    "The schema does not support new item candidates; run the latest migration.",
    "当前结构不支持新实物候选项，请运行最新迁移。",
  ],
  [
    "Security receipt protocol is not released or schema is unavailable.",
    "Security receipt protocol is not released or schema is unavailable.",
    "安全回执协议尚未发布或结构不可用。",
  ],
  [
    "Serial component item bắt buộc số lượng=1.",
    "A serial component item requires quantity=1.",
    "带序列号的配件实物需要 quantity=1。",
  ],
  [
    "Serial component item bắt buộc quantity=1.",
    "A serial component item requires quantity=1.",
    "带序列号的配件实物需要 quantity=1。",
  ],
  [
    "Serial component item không còn IN_STOCK hoặc sai SKU.",
    "The serial component item is no longer IN_STOCK or has the wrong SKU.",
    "带序列号的配件实物已不处于 IN_STOCK 状态或 SKU 不正确。",
  ],
  [
    "Serial component item không thuộc SKU hoặc không IN_STOCK.",
    "The serial component item does not belong to this SKU or is not IN_STOCK.",
    "带序列号的配件实物不属于此 SKU 或不处于 IN_STOCK 状态。",
  ],
  [
    "Serial component số lượng phải = 1.",
    "Serial component quantity must = 1.",
    "带序列号的配件数量必须 = 1。",
  ],
  [
    "Serial component quantity phải = 1.",
    "Serial component quantity must = 1.",
    "带序列号的配件数量必须 = 1。",
  ],
  [
    "Serial không ở trạng thái có thể đưa vào container.",
    "The serial's status does not allow placing it in a container.",
    "序列号当前状态不允许放入容器。",
  ],
  [
    "Serial liên kết không tồn tại; không được tiếp nhận bảo hành.",
    "The linked serial does not exist; warranty intake is not allowed.",
    "关联序列号不存在，无法接收保修。",
  ],
  [
    "Serial phải hoàn tất Hoàn tất xuất kho trước khi tiếp nhận bảo hành.",
    "The serial must complete Post Issue before warranty intake.",
    "序列号必须完成出库过账后才能接收保修。",
  ],
  [
    "Serial phải hoàn tất Post Issue trước khi tiếp nhận bảo hành.",
    "The serial must complete Post Issue before warranty intake.",
    "序列号必须完成出库过账后才能接收保修。",
  ],
  [
    "Serial đang thuộc container khác.",
    "The serial belongs to another container.",
    "序列号属于其他容器。",
  ],
  [
    "Serial đã có một phiếu bảo hành đang hoạt động.",
    "The serial already has an active warranty case.",
    "序列号已有进行中的保修单。",
  ],
  [
    "Session or pre-existing factor changed.",
    "Session or pre-existing factor changed.",
    "会话或原有验证因素已更改。",
  ],
  [
    "Snapshot nhãn item legacy không thể dùng làm Nhãn đóng gói của lô.",
    "A legacy item label snapshot cannot serve as the batch packing label.",
    "旧版实物标签快照不能用作批次包装标签。",
  ],
  [
    "Snapshot nhãn item legacy không thể dùng làm Packing Label của lô.",
    "A legacy item label snapshot cannot serve as the batch packing label.",
    "旧版实物标签快照不能用作批次包装标签。",
  ],
  [
    "Source key replayed; no trùng lặp import created.",
    "Source key replayed; no duplicate import created.",
    "来源键已重放，未创建重复导入。",
  ],
  [
    "Source key replayed; no duplicate import created.",
    "Source key replayed; no duplicate import created.",
    "来源键已重放，未创建重复导入。",
  ],
  [
    "Stock effect sẽ làm available_qty âm.",
    "The stock effect would make available_qty negative.",
    "库存变动会使 available_qty 为负。",
  ],
  [
    "Stock effect sẽ làm tồn âm.",
    "The stock effect would make inventory negative.",
    "库存变动会导致负库存。",
  ],
  [
    "Stock effect đã được ghi trước đó.",
    "The stock effect was already recorded.",
    "库存变动已记录。",
  ],
  [
    "Stock số lượng phải là số nguyên dương.",
    "Stock quantity must be a positive integer.",
    "库存数量必须为正整数。",
  ],
  [
    "Stock quantity phải là số nguyên dương.",
    "Stock quantity must be a positive integer.",
    "库存数量必须为正整数。",
  ],
  [
    "Summary không nhận cursor hoặc activityId.",
    "Summary does not accept cursor or activityId.",
    "Summary 不接受 cursor 或 activityId。",
  ],
  [
    "Summary không phân trang.",
    "Summary is not paginated.",
    "Summary 不分页。",
  ],
  [
    "Summary không phân trang; không gửi limit, cursor hoặc activityId.",
    "Summary is not paginated; do not send limit, cursor or activityId.",
    "Summary 不分页，请勿发送 limit、cursor 或 activityId。",
  ],
  [
    "Sản phẩm Item chỉ được scan vào container loại CARTON.",
    "A PRODUCT item can only be scanned into a CARTON container.",
    "PRODUCT 实物只能扫描放入 CARTON 容器。",
  ],
  [
    "PRODUCT Item chỉ được scan vào container loại CARTON.",
    "A PRODUCT item can only be scanned into a CARTON container.",
    "PRODUCT 实物只能扫描放入 CARTON 容器。",
  ],
  [
    "Sản phẩm/serial điều chỉnh tồn kho phải chỉ rõ item_id và số lượng=1 cho từng line (mỗi máy một line).",
    "PRODUCT/serial reversals must specify item_id and quantity=1 for each line (one unit per line).",
    "PRODUCT/序列号冲销必须为每行指定 item_id 和 quantity=1（每台一行）。",
  ],
  [
    "PRODUCT/serial reversal phải chỉ rõ item_id và quantity=1 cho từng line (mỗi máy một line).",
    "PRODUCT/serial reversals must specify item_id and quantity=1 for each line (one unit per line).",
    "PRODUCT/序列号冲销必须为每行指定 item_id 和 quantity=1（每台一行）。",
  ],
  [
    "Sản phẩm/serial-tracked line bắt buộc scan một item cụ thể.",
    "A PRODUCT/serial-tracked line requires scanning a specific item.",
    "PRODUCT/序列号跟踪明细必须扫描具体实物。",
  ],
  [
    "PRODUCT/serial-tracked line bắt buộc scan một item cụ thể.",
    "A PRODUCT/serial-tracked line requires scanning a specific item.",
    "PRODUCT/序列号跟踪明细必须扫描具体实物。",
  ],
  [
    "Số PX không khớp nháp, owner hoặc kho đã xác nhận.",
    "The PX number does not match the confirmed draft, owner or warehouse.",
    "PX 编号与已确认的草稿、所属方或仓库不匹配。",
  ],
  [
    "Số PX yêu cầu đúng owner P03.",
    "The PX number requires the correct P03 owner.",
    "PX 编号需要正确的 P03 所属方。",
  ],
  [
    "Số PX đã được giữ cho nháp xuất khác.",
    "The PX number is reserved for another outbound draft.",
    "PX 编号已为其他出库草稿预留。",
  ],
  [
    "Số dòng scan local phải đúng bằng số lượng đã nhập trước khi xác nhận.",
    "The number of local scanned lines must exactly match the entered quantity before confirmation.",
    "确认前，本地扫描行数必须与输入数量完全一致。",
  ],
  [
    "Số item đã quét của một SKU vượt available_qty hiện tại.",
    "The scanned item count for a SKU exceeds the current available_qty.",
    "某 SKU 的已扫描实物数量超过当前 available_qty。",
  ],
  [
    "Số lượng cần xuất không được nhỏ hơn số đã quét; gỡ bớt dòng quét trước.",
    "The required outbound quantity cannot be less than the scanned quantity; remove scanned lines first.",
    "所需出库数量不得少于已扫描数量，请先移除扫描明细。",
  ],
  [
    "Số lượng mất mát vượt quá số lượng còn lại chưa xử lý.",
    "The loss quantity exceeds the remaining unprocessed quantity.",
    "损失数量超过剩余未处理数量。",
  ],
  [
    "Số lượng nhận không được vượt quá số lượng đã xuất.",
    "The received quantity cannot exceed the issued quantity.",
    "接收数量不得超过已出库数量。",
  ],
  [
    "Số lượng scan phải là số nguyên lớn hơn 0.",
    "The scanned quantity must be an integer greater than 0.",
    "扫描数量必须为大于 0 的整数。",
  ],
  [
    "Số lượng scan vượt số lượng yêu cầu của dòng.",
    "The scanned quantity exceeds the line's required quantity.",
    "扫描数量超过该明细的所需数量。",
  ],
  [
    "Số lượng đã nhập đã bị tiêu thụ bởi giao dịch sau đó; phải đảo dependency theo thứ tự ngược trước.",
    "The received quantity was consumed by subsequent transactions; reverse dependencies in reverse order first.",
    "已入库数量已被后续交易消耗，请先按相反顺序撤销依赖交易。",
  ],
  [
    "Số phiếu đã được giữ cho một nháp nhập. Tiếp tục đúng nháp hoặc dùng số khác.",
    "The document number is reserved for an inbound draft. Continue that draft or use another number.",
    "单据编号已为入库草稿预留，请继续原草稿或使用其他编号。",
  ],
  [
    "Số toa đã tồn tại trong hệ thống.",
    "The request number already exists in the system.",
    "申请单号已存在于系统中。",
  ],
  [
    "Số toa đã tồn tại trong hệ thống; không tạo phiếu xuất trùng.",
    "The request number already exists; a duplicate outbound document will not be created.",
    "申请单号已存在，不会创建重复出库单。",
  ],
  [
    "Số yêu cầu xuất đã tồn tại.",
    "The outbound request number already exists.",
    "出库申请单号已存在。",
  ],
  [
    "Sự kiện không thuộc đúng bản ghi lịch sử này.",
    "The event does not belong to this history record.",
    "事件不属于此历史记录。",
  ],
  [
    "Sự kiện không thuộc đúng chip và phạm vi lịch sử.",
    "The event does not belong to this chip and history scope.",
    "事件不属于此芯片及历史范围。",
  ],
  [
    "TEMP_ONLY bắt buộc missing_code_reason và manual_product_description.",
    "TEMP_ONLY requires missing_code_reason and manual_product_description.",
    "TEMP_ONLY 需要 missing_code_reason 和 manual_product_description。",
  ],
  [
    "TRAY đã đóng hoặc không còn khả dụng.",
    "The TRAY is closed or no longer available.",
    "TRAY 已关闭或不再可用。",
  ],
  [
    "Tag không tồn tại hoặc đã Ngừng hoạt động.",
    "The tag does not exist or is INACTIVE.",
    "标签不存在或为 INACTIVE。",
  ],
  [
    "Tag không tồn tại hoặc đã INACTIVE.",
    "The tag does not exist or is INACTIVE.",
    "标签不存在或为 INACTIVE。",
  ],
  [
    "Tham số không thuộc contract danh sách trộn.",
    "The parameter is outside the mixed-list contract.",
    "参数不符合混合列表契约。",
  ],
  [
    "Tham số ngoài contract P06; không bỏ qua bộ lọc không được hỗ trợ.",
    "The parameter is outside the P06 contract; unsupported filters cannot be ignored.",
    "参数不符合 P06 契约，不能忽略不支持的筛选条件。",
  ],
  [
    "Tham số ngoài contract P08; không dùng tenant/org/user ID để đổi phạm vi.",
    "The parameter is outside the P08 contract; tenant/org/user IDs cannot change scope.",
    "参数不符合 P08 契约，不得使用 tenant/org/user ID 更改范围。",
  ],
  [
    "Tham số ngoài contract P22.",
    "The parameter is outside the P22 contract.",
    "参数不符合 P22 契约。",
  ],
  [
    "Thay chip cũ bắt buộc khai lý do để truy vết.",
    "Replacing an old chip requires a reason for traceability.",
    "更换旧芯片必须填写原因以便追溯。",
  ],
  [
    "This family adopted native receipts; do not downgrade to a legacy command.",
    "This family adopted native receipts; do not downgrade to a legacy command.",
    "此类别已采用原生回执，不得降级为旧版命令。",
  ],
  [
    "Thiết bị không thuộc phạm vi TEST đã xác minh.",
    "The device is outside the verified TEST scope.",
    "设备不属于已验证的 TEST 范围。",
  ],
  [
    "Thiết bị này chưa được tin cậy. Nhập mã xác minh đã gửi tới email đăng ký.",
    "This device is not trusted yet. Enter the verification code sent to your registered email.",
    "此设备尚未受信任，请输入发送至注册邮箱的验证码。",
  ],
  [
    "Thông báo hệ thống chưa sẵn sàng.",
    "System notifications are not ready.",
    "系统通知尚未就绪。",
  ],
  [
    "Thông báo tài khoản và bảo mật trong ứng dụng là bắt buộc.",
    "In-app account and security notifications are mandatory.",
    "应用内账户和安全通知为必选项。",
  ],
  [
    "Thông tin bàn giao chỉ hợp lệ cho Đã hoàn tất -> Đã trả khách.",
    "Handover information is only valid for COMPLETED -> RETURNED.",
    "交接信息仅适用于 COMPLETED -> RETURNED。",
  ],
  [
    "Thông tin bàn giao chỉ hợp lệ cho COMPLETED -> RETURNED.",
    "Handover information is only valid for COMPLETED -> RETURNED.",
    "交接信息仅适用于 COMPLETED -> RETURNED。",
  ],
  [
    "Thông tin sở hữu kho do máy chủ xác định.",
    "Warehouse ownership is determined by the server.",
    "所属仓库信息由服务器确定。",
  ],
  [
    "Thông tin xác thực đã thay đổi; đăng nhập lại.",
    "Authentication information changed; sign in again.",
    "认证信息已更改，请重新登录。",
  ],
  [
    "Thông tin ứng dụng không đúng định dạng UTF-8.",
    "The application information is not valid UTF-8.",
    "应用信息不是有效 UTF-8。",
  ],
  [
    "Thời gian nguồn không hợp lệ; không suy diễn mốc thay thế.",
    "The source timestamp is invalid; a replacement timestamp cannot be inferred.",
    "源时间无效，无法推断替代时间。",
  ],
  [
    "Thời gian nguồn không hợp lệ; không thay bằng thời gian hiện tại.",
    "The source timestamp is invalid; it cannot be replaced with the current time.",
    "源时间无效，不能用当前时间替代。",
  ],
  ["Tiếp tục ca hiện tại.", "Continue the current shift.", "继续当前班次。"],
  [
    "Toa outbound chỉ được consume khi mọi SKU là Sản phẩm Đang hoạt động.",
    "An outbound request can only be consumed when all SKUs are PRODUCT ACTIVE.",
    "仅当所有 SKU 均为已启用产品（PRODUCT ACTIVE）时，才可处理并转换出库申请单。",
  ],
  [
    "Toa outbound chỉ được consume khi mọi SKU là PRODUCT ACTIVE.",
    "An outbound request can only be consumed when all SKUs are PRODUCT ACTIVE.",
    "仅当所有 SKU 均为已启用产品（PRODUCT ACTIVE）时，才可处理并转换出库申请单。",
  ],
  [
    "Toa xuất không có line hợp lệ.",
    "The outbound request has no valid lines.",
    "出库申请单没有有效明细。",
  ],
  [
    "Toa xuất không tồn tại hoặc không còn active.",
    "The outbound request does not exist or is no longer active.",
    "出库申请单不存在或已失效。",
  ],
  [
    "Token đã có đăng ký thiết bị khác.",
    "The token has another device registration.",
    "此 token 已关联其他设备注册。",
  ],
  [
    "Tra event_id trực tiếp chỉ nhận kho và nguồn NFC.",
    "Direct event_id lookup only accepts the warehouse and NFC source.",
    "直接查询 event_id 仅接受仓库和 NFC 来源。",
  ],
  [
    "Truy vấn có trường hoặc body không được hỗ trợ.",
    "The query contains unsupported fields or a body.",
    "查询含不支持的字段或请求体。",
  ],
  [
    "Trình duyệt chỉ dùng cookie HttpOnly, không gửi refresh token trong body.",
    "The browser only uses HttpOnly cookies; do not send a refresh token in the body.",
    "浏览器仅使用 HttpOnly cookie，请勿在请求体中发送 refresh token。",
  ],
  [
    "Trường :attribute chứa ký tự không hợp lệ (không phải UTF-8).",
    "The :attribute field contains invalid characters (not UTF-8).",
    "字段 :attribute 含无效字符（非 UTF-8）。",
  ],
  ["Trạng thái MFA.", "MFA status.", "MFA 状态。"],
  [
    "Trạng thái ghi nhận không hợp lệ; giao dịch được hoàn tác.",
    "The posting status is invalid; the transaction was rolled back.",
    "过账状态无效，交易已回滚。",
  ],
  [
    "Trạng thái hiện tại không cho phép thực hiện lệnh mới.",
    "The current status does not allow a new command.",
    "当前状态不允许执行新命令。",
  ],
  [
    "Trạng thái hiện vật không cho phép gán chip NFC.",
    "The item's status does not allow NFC chip assignment.",
    "实物状态不允许绑定 NFC 芯片。",
  ],
  [
    "Trạng thái hiện vật không cho phép gán chip.",
    "The item's status does not allow chip assignment.",
    "实物状态不允许绑定芯片。",
  ],
  [
    "Trạng thái không thuộc nguồn đã chọn.",
    "The status does not belong to the selected source.",
    "状态不属于所选来源。",
  ],
  [
    "Trạng thái vòng đời của container do luồng nghiệp vụ sở hữu sự kiện đặt (Hoàn tất nhập kho / Putaway confirm / Hoàn tất xuất kho), không set qua PATCH /containers/{id}.",
    "Container lifecycle status is set by the owning workflow (Post Receipt / Putaway confirm / Post Issue), not PATCH /containers/{id}.",
    "容器生命周期状态由所属业务流程设置（入库过账/上架确认/出库过账），不得通过 PATCH /containers/{id} 设置。",
  ],
  [
    "Trạng thái vòng đời của container do luồng nghiệp vụ sở hữu sự kiện đặt (Post Receipt / Putaway confirm / Post Issue), không set qua PATCH /containers/{id}.",
    "Container lifecycle status is set by the owning workflow (Post Receipt / Putaway confirm / Post Issue), not PATCH /containers/{id}.",
    "容器生命周期状态由所属业务流程设置（入库过账/上架确认/出库过账），不得通过 PATCH /containers/{id} 设置。",
  ],
  [
    "Tài khoản chưa được phép gửi thử.",
    "The account is not allowed to send tests yet.",
    "账户尚不允许发送测试。",
  ],
  [
    "Tài khoản chưa được phép nhận thông báo.",
    "The account is not allowed to receive notifications yet.",
    "账户尚不允许接收通知。",
  ],
  [
    "Tài khoản không còn hoạt động.",
    "The account is no longer active.",
    "账户已停用。",
  ],
  [
    "Tài khoản không còn khả dụng.",
    "The account is no longer available.",
    "账户已不可用。",
  ],
  [
    "Tài khoản không có quyền gán NFC.",
    "The account does not have permission to assign NFC.",
    "账户无权绑定 NFC。",
  ],
  [
    "Tài khoản không có quyền đọc chứng từ.",
    "The account does not have permission to read documents.",
    "账户无权读取单据。",
  ],
  [
    "Tài khoản quản trị hệ thống chỉ có thể được chỉnh sửa bởi một quản trị hệ thống khác.",
    "A system administrator account can only be edited by another system administrator.",
    "系统管理员账户只能由其他系统管理员编辑。",
  ],
  [
    "Tài khoản đang bị khoá hoặc ngừng hoạt động.",
    "The account is locked or inactive.",
    "账户已锁定或停用。",
  ],
  [
    "Tài khoản đang bị khoá hoặc ngừng hoạt động. Vui lòng liên hệ quản trị viên.",
    "The account is locked or inactive. Please contact an administrator.",
    "账户已锁定或停用，请联系管理员。",
  ],
  [
    "Tài khoản đã bật MFA. Hãy tắt MFA hiện tại trước khi đăng ký thiết bị mới.",
    "MFA is already enabled. Disable the current MFA before registering a new device.",
    "账户已启用 MFA，请先关闭当前 MFA，再注册新设备。",
  ],
  [
    "Tài khoản đã đăng nhập ở phiên khác. Vui lòng đăng nhập lại.",
    "The account signed in in another session. Please sign in again.",
    "账户已在其他会话登录，请重新登录。",
  ],
  [
    "Tài khoản đã đạt giới hạn phiên hoạt động. Vui lòng chủ động đăng xuất một phiên trước khi đăng nhập thêm.",
    "The account reached its active session limit. Sign out of one session before signing in again.",
    "账户已达活动会话数量上限，请先主动退出一个会话再登录。",
  ],
  [
    "Tên SKU phải khác mã SKU và đơn vị tính không được để trống.",
    "The SKU name must differ from the SKU code, and the unit must not be empty.",
    "SKU 名称必须与 SKU 编码不同，且计量单位不能为空。",
  ],
  [
    "Tên người nhận/khách hàng là bắt buộc.",
    "The recipient/customer name is required.",
    "必须填写收货人/客户名称。",
  ],
  [
    "Tích hợp kết thúc ca chưa được kích hoạt.",
    "Shift closing integration is not enabled.",
    "结束班次集成尚未启用。",
  ],
  [
    "Tùy chọn đã thay đổi; đọc lại trước khi lưu.",
    "The options changed; read them again before saving.",
    "选项已更改，请重新读取后保存。",
  ],
  [
    "Tạm dừng tạo phiên mới; các phiên đang hoạt động được giữ nguyên.",
    "New session creation is paused; active sessions are retained.",
    "已暂停创建新会话，现有活动会话保留。",
  ],
  [
    "Tải ảnh sản phẩm thành công.",
    "Product image uploaded successfully.",
    "产品图片上传成功。",
  ],
  [
    "Tệp không khả dụng trong quyền truy cập hiện tại.",
    "The file is unavailable under your current access permissions.",
    "当前访问权限下文件不可用。",
  ],
  [
    "Tệp không vượt qua kiểm tra mã độc.",
    "The file failed the malware scan.",
    "文件未通过恶意软件检查。",
  ],
  [
    "Tệp đính kèm chỉ nhận ảnh JPG/PNG/WEBP hoặc video MP4/MOV/WEBM.",
    "Attachments only accept JPG/PNG/WEBP images or MP4/MOV/WEBM videos.",
    "附件仅接受 JPG/PNG/WEBP 图片或 MP4/MOV/WEBM 视频。",
  ],
  [
    "Tệp đính kèm không vượt qua kiểm tra mã độc.",
    "The attachment failed the malware scan.",
    "附件未通过恶意软件检查。",
  ],
  [
    "Tồn kho vừa bị thay đổi bởi thao tác khác. Vui lòng tải lại dữ liệu mới nhất rồi thử lại.",
    "Another operation just changed inventory. Reload the latest data and try again.",
    "其他操作刚刚更改了库存，请重新加载最新数据后重试。",
  ],
  [
    "UID chip chưa được xác nhận với nội dung này; không suy ra liên kết từ payload.",
    "The chip UID has not been confirmed with this content; a link cannot be inferred from the payload.",
    "芯片 UID 尚未与此内容确认，无法从载荷推断关联。",
  ],
  [
    "UID hoặc mã chip vừa được đăng ký bởi yêu cầu khác; đọc lại và đối chiếu trước khi tiếp tục.",
    "Another request just registered the UID or chip code; read and reconcile before continuing.",
    "其他请求刚注册了该 UID 或芯片编码，请重新读取并核对后继续。",
  ],
  [
    "UID không thuộc chip NFC.",
    "The UID does not belong to an NFC chip.",
    "UID 不属于 NFC 芯片。",
  ],
  [
    "UID và nội dung đọc từ chip không khớp cùng hiện vật.",
    "The UID and chip content do not match the same item.",
    "UID 与芯片内容未对应同一实物。",
  ],
  [
    "UID đã được đăng ký cho loại mã vật lý khác.",
    "The UID is registered for another physical code type.",
    "UID 已注册为其他物理编码类型。",
  ],
  [
    "Unsupported history timestamp column.",
    "Unsupported history timestamp column.",
    "不支持此历史时间戳列。",
  ],
  [
    "Unsupported stock projection source",
    "Unsupported stock projection source",
    "不支持此库存投影来源。",
  ],
  [
    "Upload trong ca tracked bắt buộc receipt contract và identity gốc.",
    "Uploads in a tracked shift require the receipt contract and original identity.",
    "受跟踪班次中的上传需要回执契约和原始身份标识。",
  ],
  [
    "Vai trò của bạn bắt buộc dùng xác thực hai bước. Vui lòng đăng ký trước khi tiếp tục.",
    "Your role requires two-step verification. Please enroll before continuing.",
    "您的角色要求两步验证，请先完成注册再继续。",
  ],
  [
    "Vai trò của tài khoản này bắt buộc dùng xác thực hai bước. Liên hệ quản trị viên nếu cần đổi thiết bị.",
    "This account's role requires two-step verification. Contact an administrator to change devices.",
    "此账户角色要求两步验证，如需更换设备请联系管理员。",
  ],
  [
    "Version cấu trúc QR không được hỗ trợ.",
    "The QR structure version is not supported.",
    "不支持此 QR 结构版本。",
  ],
  [
    "Version không khớp, tải lại dữ liệu trước khi thao tác.",
    "The version does not match; reload the data before proceeding.",
    "版本不匹配，请重新加载数据后操作。",
  ],
  [
    "Video bảo hành chỉ nhận MP4/MOV/WEBM.",
    "Warranty videos only accept MP4/MOV/WEBM.",
    "保修视频仅接受 MP4/MOV/WEBM。",
  ],
  [
    "Video đính kèm vượt quá 300MB.",
    "The video attachment exceeds 300MB.",
    "视频附件超过 300MB。",
  ],
  [
    "Video đính kèm vượt quá 5 phút.",
    "The video attachment exceeds 5 minutes.",
    "视频附件超过 5 分钟。",
  ],
  [
    "Vui lòng chờ một phút trước khi gửi thử lại.",
    "Please wait one minute before sending another test.",
    "请等待一分钟后再次发送测试。",
  ],
  [
    "Vui lòng xác minh thiết bị trước khi tiếp tục đăng nhập.",
    "Please verify the device before continuing to sign in.",
    "请先验证设备，再继续登录。",
  ],
  [
    "Vì lý do bảo mật, vui lòng xác minh thiết bị để tiếp tục.",
    "For security, please verify the device to continue.",
    "为确保安全，请验证设备后继续。",
  ],
  [
    "Vòng đời ca tiếp theo chưa được kích hoạt.",
    "The next shift lifecycle is not enabled.",
    "后续班次生命周期尚未启用。",
  ],
  [
    "Warranty case không tìm thấy.",
    "Warranty case not found.",
    "未找到保修单。",
  ],
  ["Warranty case not found.", "Warranty case not found.", "未找到保修单。"],
  [
    "Workbook Excel không đọc được hoặc đã hỏng.",
    "The Excel workbook cannot be read or is corrupted.",
    "Excel 工作簿无法读取或已损坏。",
  ],
  [
    "Xuất PII bảo hành cần quyền warranty.pii.export.",
    "Exporting warranty PII requires warranty.pii.export permission.",
    "导出保修个人信息（PII）需要 warranty.pii.export 权限。",
  ],
  [
    "Xác minh bảo mật thành công. Vui lòng tiếp tục đăng nhập.",
    "Security verification succeeded. Please continue to sign in.",
    "安全验证成功，请继续登录。",
  ],
  [
    "Xác minh thiết bị và đăng nhập thành công.",
    "Device verification and sign-in succeeded.",
    "设备验证和登录成功。",
  ],
  [
    "Xác nhận kho làm việc trước khi tiếp tục.",
    "Confirm your working warehouse before continuing.",
    "请确认工作仓库后继续。",
  ],
  [
    "Xác nhận kho làm việc trước khi truy cập bảo hành.",
    "Confirm your working warehouse before accessing warranty.",
    "请确认工作仓库后访问保修。",
  ],
  [
    "Xác nhận kho làm việc trước khi đọc chứng từ.",
    "Confirm your working warehouse before reading documents.",
    "请确认工作仓库后读取单据。",
  ],
  [
    "Xác nhận lại kho của phiên.",
    "Reconfirm the session's warehouse.",
    "请重新确认会话仓库。",
  ],
  [
    "Xác nhận lại kho làm việc của phiên đăng nhập.",
    "Reconfirm the login session's working warehouse.",
    "请重新确认登录会话的工作仓库。",
  ],
  [
    "Xác nhận lại kho làm việc trước khi đọc dữ liệu.",
    "Reconfirm your working warehouse before reading data.",
    "请重新确认工作仓库后读取数据。",
  ],
  [
    "Xác nhận lại kho làm việc.",
    "Reconfirm your working warehouse.",
    "请重新确认工作仓库。",
  ],
  [
    "Xác nhận lại kho upload.",
    "Reconfirm the upload warehouse.",
    "请重新确认上传仓库。",
  ],
  [
    "Xác nhận lại ngữ cảnh kho trước khi thao tác bản nháp.",
    "Reconfirm the warehouse context before operating on the draft.",
    "请重新确认仓库上下文后操作草稿。",
  ],
  [
    "Xác nhận đúng kho của phiên trước khi đọc hộp.",
    "Confirm the session's correct warehouse before reading boxes.",
    "请确认会话对应仓库后读取箱信息。",
  ],
  [
    "Yêu cầu hỗ trợ đã được ghi nhận. Việc khôi phục cần được quản trị viên xác minh.",
    "Your support request was recorded. Recovery requires administrator verification.",
    "支持申请已记录，恢复操作需要管理员核实。",
  ],
  [
    "Yêu cầu không khớp chủ sở hữu hoặc phiên hiện hành.",
    "The request does not match the current owner or session.",
    "请求与当前所属方或会话不匹配。",
  ],
  [
    "Yêu cầu không thuộc thiết bị TEST đã xác minh.",
    "The request does not belong to the verified TEST device.",
    "请求不属于已验证的 TEST 设备。",
  ],
  [
    "Yêu cầu này đã được chuyển thành phiếu trước đó.",
    "This request was already converted to a document.",
    "此申请已转换为单据。",
  ],
  [
    "Yêu cầu này đã được dùng cho kho khác.",
    "This request was already used for another warehouse.",
    "此申请已用于其他仓库。",
  ],
  [
    "Yêu cầu phải có ít nhất 1 dòng sản phẩm.",
    "The request must contain at least 1 product line.",
    "申请必须至少包含 1 行产品明细。",
  ],
  [
    "Yêu cầu thuộc ngữ cảnh khác.",
    "The request belongs to another context.",
    "申请属于其他上下文。",
  ],
  [
    "Yêu cầu điều chuyển kho cần dùng transfer-orders để chuyển đổi (chưa hỗ trợ tự động convert sang stock_documents).",
    "Warehouse transfer requests must use transfer-orders for conversion; automatic conversion to stock_documents is not supported.",
    "仓库调拨申请必须使用 transfer-orders 转换，尚不支持自动转为 stock_documents。",
  ],
  [
    "Yêu cầu đã có kết quả; đối chiếu tại đúng nghiệp vụ trước khi gửi lại.",
    "The request already has a result; reconcile in the correct workflow before resending.",
    "申请已有结果，请在对应业务中核对后再重新发送。",
  ],
  [
    "activityId chỉ dùng cùng recordId ở màn chi tiết.",
    "activityId can only be used with recordId on the detail screen.",
    "activityId 仅可在详情界面与 recordId 一同使用。",
  ],
  [
    "activityId chỉ dùng với recordId.",
    "activityId can only be used with recordId.",
    "activityId 仅可与 recordId 一同使用。",
  ],
  [
    "box_number gửi kèm không khớp số hộp nằm trong mã hộp.",
    "The supplied box_number does not match the box number encoded in the box code.",
    "提交的 box_number 与箱码中的箱号不匹配。",
  ],
  [
    "client_request_id phải trùng Idempotency-Key.",
    "client_request_id must match Idempotency-Key.",
    "client_request_id 必须与 Idempotency-Key 一致。",
  ],
  [
    "code hoặc sku_code là bắt buộc.",
    "code or sku_code is required.",
    "必须提供 code 或 sku_code。",
  ],
  [
    "code_value của chip đã tồn tại trong hệ thống.",
    "The chip's code_value already exists in the system.",
    "芯片的 code_value 已存在于系统中。",
  ],
  [
    "code_value và container_id không cùng target.",
    "code_value and container_id do not identify the same target.",
    "code_value 与 container_id 未指向同一目标。",
  ],
  [
    "code_value và item_id không cùng target.",
    "code_value and item_id do not identify the same target.",
    "code_value 与 item_id 未指向同一目标。",
  ],
  [
    "code_value và item_id không trỏ cùng item.",
    "code_value and item_id do not identify the same item.",
    "code_value 与 item_id 未指向同一实物。",
  ],
  [
    "code_value đã tồn tại trong hệ thống.",
    "code_value already exists in the system.",
    "code_value 已存在于系统中。",
  ],
  [
    "container_code đã tồn tại.",
    "container_code already exists.",
    "container_code 已存在。",
  ],
  [
    "container_id của Linh kiện phải trỏ tới container loại BOX.",
    "The COMPONENT container_id must identify a BOX container.",
    "COMPONENT 的 container_id 必须指向 BOX 容器。",
  ],
  [
    "container_id của COMPONENT phải trỏ tới container loại BOX.",
    "The COMPONENT container_id must identify a BOX container.",
    "COMPONENT 的 container_id 必须指向 BOX 容器。",
  ],
  [
    "context_id và scope_ref phải trỏ cùng một kho.",
    "context_id and scope_ref must identify the same warehouse.",
    "context_id 与 scope_ref 必须指向同一仓库。",
  ],
  [
    "cursor không hợp lệ hoặc đã bị sửa đổi.",
    "cursor is invalid or was modified.",
    "cursor 无效或已被修改。",
  ],
  [
    "cursor không khớp với bộ lọc hiện tại.",
    "cursor does not match the current filters.",
    "cursor 与当前筛选条件不匹配。",
  ],
  [
    "cursor không khớp với tham số sort hiện tại.",
    "cursor does not match the current sort parameters.",
    "cursor 与当前排序参数不匹配。",
  ],
  [
    "cursor không đúng định dạng.",
    "cursor has an invalid format.",
    "cursor 格式无效。",
  ],
  [
    "cursor đã hết hiệu lực, vui lòng tải lại danh sách.",
    "cursor expired; please reload the list.",
    "cursor 已过期，请重新加载列表。",
  ],
  [
    "customer_name (người nhận) bắt buộc trước khi consume toa xuất.",
    "customer_name (recipient) is required before consuming an outbound request.",
    "处理并转换出库申请单前，必须提供 customer_name（收货人）。",
  ],
  [
    "db:seed bị chặn trên CSDL được bảo vệ. Deploy chỉ được dùng migrate --force. Seed dữ liệu phải được duyệt riêng và đặt WMS_ALLOW_PROTECTED_DATABASE_SEED=CONFIRM_SEED_WRITE cho đúng một lệnh.",
    "db:seed is blocked on protected databases. Deployment may only use migrate --force. Seeding requires separate approval and WMS_ALLOW_PROTECTED_DATABASE_SEED=CONFIRM_SEED_WRITE for exactly one command.",
    "受保护数据库禁止 db:seed；部署仅可使用 migrate --force。填充数据需单独批准，并仅为一条命令设置 WMS_ALLOW_PROTECTED_DATABASE_SEED=CONFIRM_SEED_WRITE。",
  ],
  [
    "family_name tối đa 200 ký tự.",
    "family_name must not exceed 200 characters.",
    "family_name 最多 200 个字符。",
  ],
  [
    "from_date phải nhỏ hơn hoặc bằng to_date.",
    "from_date must be less than or equal to to_date.",
    "from_date 必须早于或等于 to_date。",
  ],
  [
    "id không phải UUID hợp lệ.",
    "id is not a valid UUID.",
    "id 不是有效 UUID。",
  ],
  [
    "industry_id là tham số bắt buộc và phải là UUID.",
    "industry_id is required and must be a UUID.",
    "industry_id 为必填参数，且必须为 UUID。",
  ],
  [
    "inventory_serial_id không thuộc product_id đã gửi.",
    "inventory_serial_id does not belong to the supplied product_id.",
    "inventory_serial_id 不属于提交的 product_id。",
  ],
  [
    "item_id không khớp serial/mã đã cung cấp.",
    "item_id does not match the supplied serial/code.",
    "item_id 与提供的序列号/编码不匹配。",
  ],
  [
    "item_id không thuộc SKU movement gốc.",
    "item_id does not belong to the original movement's SKU.",
    "item_id 不属于原库存变动的 SKU。",
  ],
  [
    "item_id không thuộc SKU trên URL.",
    "item_id does not belong to the SKU in the URL.",
    "item_id 不属于 URL 中的 SKU。",
  ],
  [
    "item_id không thuộc line giao dịch gốc.",
    "item_id does not belong to the original transaction line.",
    "item_id 不属于原交易明细。",
  ],
  [
    "item_type gửi lên không khớp loại mã đã quét (mã hộp BOX-<SKU>-<số hộp> là BOX, còn lại là ITEM).",
    "The supplied item_type does not match the scanned code type (BOX-<SKU>-<box number> is BOX; other codes are ITEM).",
    "提交的 item_type 与扫描编码类型不匹配（BOX-<SKU>-<箱号> 为 BOX，其余为 ITEM）。",
  ],
  [
    "item_unique trong QR không trỏ tới một ITEM đã đăng ký.",
    "item_unique in the QR does not identify a registered ITEM.",
    "QR 中的 item_unique 未指向已注册的 ITEM。",
  ],
  [
    "item_unique đã bị một định danh khác chiếm dụng.",
    "item_unique is occupied by another identifier.",
    "item_unique 已被其他标识占用。",
  ],
  [
    "item_unique đã được sử dụng bởi một định danh khác trong hệ thống.",
    "item_unique is already used by another identifier in the system.",
    "item_unique 已被系统中的其他标识使用。",
  ],
  [
    "item_unique/serial của candidate đã được đăng ký bởi giao dịch khác; gỡ mã và quét lại.",
    "The candidate's item_unique/serial was registered by another transaction; remove the code and scan again.",
    "候选项的 item_unique/序列号已被其他交易注册，请移除编码后重新扫描。",
  ],
  [
    "không hợp lệ CI source SHA marker",
    "Invalid CI source SHA marker",
    "CI 来源 SHA 标记无效。",
  ],
  [
    "Invalid CI source SHA marker",
    "Invalid CI source SHA marker",
    "CI 来源 SHA 标记无效。",
  ],
  [
    "không hợp lệ internal warranty query alias.",
    "Invalid internal warranty query alias.",
    "内部保修查询别名无效。",
  ],
  [
    "Invalid internal warranty query alias.",
    "Invalid internal warranty query alias.",
    "内部保修查询别名无效。",
  ],
  ["không hợp lệ row.", "Invalid row.", "无效行。"],
  ["Invalid row.", "Invalid row.", "无效行。"],
  [
    "không thể create recheck temporary file.",
    "Cannot create recheck temporary file.",
    "无法创建重新检查临时文件。",
  ],
  [
    "Cannot create recheck temporary file.",
    "Cannot create recheck temporary file.",
    "无法创建重新检查临时文件。",
  ],
  [
    "không thể encrypt API response",
    "Cannot encrypt API response",
    "无法加密 API 响应。",
  ],
  [
    "Cannot encrypt API response",
    "Cannot encrypt API response",
    "无法加密 API 响应。",
  ],
  [
    "không thể read CI source SHA marker timestamp",
    "Cannot read CI source SHA marker timestamp",
    "无法读取 CI 来源 SHA 标记时间戳。",
  ],
  [
    "Cannot read CI source SHA marker timestamp",
    "Cannot read CI source SHA marker timestamp",
    "无法读取 CI 来源 SHA 标记时间戳。",
  ],
  [
    "không thể read retained source file.",
    "Cannot read retained source file.",
    "无法读取保留的源文件。",
  ],
  [
    "Cannot read retained source file.",
    "Cannot read retained source file.",
    "无法读取保留的源文件。",
  ],
  [
    "không thể retain import source file.",
    "Cannot retain import source file.",
    "无法保留导入源文件。",
  ],
  [
    "Cannot retain import source file.",
    "Cannot retain import source file.",
    "无法保留导入源文件。",
  ],
  [
    "master_type phải thuộc: brands, product-categories, product-models, power-sources, package-variants.",
    "master_type must be one of: brands, product-categories, product-models, power-sources, package-variants.",
    "master_type 必须为以下之一：brands、product-categories、product-models、power-sources、package-variants。",
  ],
  [
    "media phải là https:// (CDN đã xác minh).",
    "media must use https:// on a verified CDN.",
    "media 必须使用经过验证的 CDN 上的 https:// 地址。",
  ],
  [
    "name bắt buộc, tối đa 255 ký tự.",
    "name is required and must not exceed 255 characters.",
    "name 为必填项，最多 255 个字符。",
  ],
  [
    "name hoặc sku_name là bắt buộc.",
    "name or sku_name is required.",
    "必须提供 name 或 sku_name。",
  ],
  [
    "page phải là số nguyên dương.",
    "page must be a positive integer.",
    "page 必须为正整数。",
  ],
  [
    "pending_product_info chỉ nhận true/false (1/0).",
    "pending_product_info only accepts true/false (1/0).",
    "pending_product_info 仅接受 true/false（1/0）。",
  ],
  [
    "per_page phải là số nguyên dương.",
    "per_page must be a positive integer.",
    "per_page 必须为正整数。",
  ],
  [
    "physical_code_id phải Đang hoạt động.",
    "physical_code_id must be ACTIVE.",
    "physical_code_id 必须为 ACTIVE。",
  ],
  [
    "physical_code_id phải ACTIVE.",
    "physical_code_id must be ACTIVE.",
    "physical_code_id 必须为 ACTIVE。",
  ],
  [
    "power_source_id/power_source_code không tồn tại hoặc không Đang hoạt động.",
    "power_source_id/power_source_code does not exist or is not ACTIVE.",
    "power_source_id/power_source_code 不存在或不是 ACTIVE 状态。",
  ],
  [
    "power_source_id/power_source_code không tồn tại hoặc không ACTIVE.",
    "power_source_id/power_source_code does not exist or is not ACTIVE.",
    "power_source_id/power_source_code 不存在或不是 ACTIVE 状态。",
  ],
  [
    "product_code bắt buộc, tối đa 100 ký tự, chỉ chữ/số/._-.",
    "product_code is required, at most 100 characters, and only allows letters, numbers and ._-.",
    "product_code 为必填项，最多 100 个字符，仅允许字母、数字及 ._-。",
  ],
  [
    "product_id là bắt buộc.",
    "product_id is required.",
    "product_id 为必填项。",
  ],
  [
    "ready_for_post phải là true hoặc false.",
    "ready_for_post must be true or false.",
    "ready_for_post 必须为 true 或 false。",
  ],
  [
    "request_date không được ở tương lai.",
    "request_date cannot be in the future.",
    "request_date 不能是未来日期。",
  ],
  [
    "request_id không khớp bản nháp, phiên quét hoặc thao tác yêu cầu.",
    "request_id does not match the draft, scan session or requested operation.",
    "request_id 与草稿、扫描会话或请求操作不匹配。",
  ],
  [
    "request_no là bắt buộc.",
    "request_no is required.",
    "request_no 为必填项。",
  ],
  [
    "required_qty phải là số nguyên dương.",
    "required_qty must be a positive integer.",
    "required_qty 必须为正整数。",
  ],
  [
    "role phải là PRIMARY hoặc GALLERY.",
    "role must be PRIMARY or GALLERY.",
    "role 必须为 PRIMARY 或 GALLERY。",
  ],
  [
    "sku_code gửi kèm không khớp SKU resolve được từ raw_code.",
    "The supplied sku_code does not match the SKU resolved from raw_code.",
    "提交的 sku_code 与从 raw_code 解析的 SKU 不匹配。",
  ],
  [
    "sku_code không khớp sku_id/product_id được gửi.",
    "sku_code does not match the supplied sku_id/product_id.",
    "sku_code 与提交的 sku_id/product_id 不匹配。",
  ],
  ["sku_code không tồn tại.", "sku_code does not exist.", "sku_code 不存在。"],
  [
    "sku_code không được là chuỗi UUID thô.",
    "sku_code must not be a raw UUID string.",
    "sku_code 不得为原始 UUID 字符串。",
  ],
  ["sku_code đã tồn tại.", "sku_code already exists.", "sku_code 已存在。"],
  ["sku_id không tồn tại.", "sku_id does not exist.", "sku_id 不存在。"],
  ["sku_id phải là UUID.", "sku_id must be a UUID.", "sku_id 必须为 UUID。"],
  [
    "sku_id và sku_code không trỏ cùng một SKU.",
    "sku_id and sku_code do not identify the same SKU.",
    "sku_id 与 sku_code 未指向同一 SKU。",
  ],
  [
    "sort_order chỉ nhận asc/desc.",
    "sort_order only accepts asc/desc.",
    "sort_order 仅接受 asc/desc。",
  ],
  [
    "source_key đã được dùng cho payload/file khác.",
    "source_key was used for a different payload/file.",
    "source_key 已用于其他载荷/文件。",
  ],
  [
    "specifications phải là object.",
    "specifications must be an object.",
    "specifications 必须为对象。",
  ],
  [
    "số lượng phải là số nguyên dương.",
    "Quantity must be a positive integer.",
    "数量必须为正整数。",
  ],
  [
    "Quantity phải là số nguyên dương.",
    "Quantity must be a positive integer.",
    "数量必须为正整数。",
  ],
  [
    "số lượng-mode bắt buộc số lượng > 0.",
    "Quantity-mode requires quantity > 0.",
    "数量模式要求 quantity > 0。",
  ],
  [
    "Quantity-mode bắt buộc quantity > 0.",
    "Quantity-mode requires quantity > 0.",
    "数量模式要求 quantity > 0。",
  ],
  [
    "trạng thái không hợp lệ cho danh sách phiếu nhập Mini App.",
    "Invalid status for the Mini App inbound document list.",
    "Mini App 入库单列表的 status 无效。",
  ],
  [
    "status không hợp lệ cho danh sách phiếu nhập Mini App.",
    "Invalid status for the Mini App inbound document list.",
    "Mini App 入库单列表的 status 无效。",
  ],
  [
    "trạng thái không hợp lệ cho danh sách phiếu xuất Mini App.",
    "Invalid status for the Mini App outbound document list.",
    "Mini App 出库单列表的 status 无效。",
  ],
  [
    "status không hợp lệ cho danh sách phiếu xuất Mini App.",
    "Invalid status for the Mini App outbound document list.",
    "Mini App 出库单列表的 status 无效。",
  ],
  [
    "trạng thái scan-entry chỉ nhận Đang hoạt động, REMOVED hoặc ALL.",
    "Scan-entry status only accepts ACTIVE, REMOVED or ALL.",
    "扫描记录的 status 仅接受 ACTIVE、REMOVED 或 ALL。",
  ],
  [
    "status scan-entry chỉ nhận ACTIVE, REMOVED hoặc ALL.",
    "Scan-entry status only accepts ACTIVE, REMOVED or ALL.",
    "扫描记录的 status 仅接受 ACTIVE、REMOVED 或 ALL。",
  ],
  [
    "variant_label chỉ có nghĩa khi đã có family_name.",
    "variant_label is only meaningful when family_name is provided.",
    "仅在提供 family_name 时，variant_label 才有意义。",
  ],
  [
    "variant_label tối đa 100 ký tự.",
    "variant_label must not exceed 100 characters.",
    "variant_label 最多 100 个字符。",
  ],
  [
    "warehouse_id phải là UUID.",
    "warehouse_id must be a UUID.",
    "warehouse_id 必须为 UUID。",
  ],
  [
    "warehouse_id và dst_warehouse_id trỏ tới hai kho khác nhau.",
    "warehouse_id and dst_warehouse_id identify different warehouses.",
    "warehouse_id 与 dst_warehouse_id 指向不同仓库。",
  ],
  [
    "Đang hoàn tất các ca hiện có; chưa mở ca mới.",
    "Existing shifts are being completed; new shifts are not open yet.",
    "正在完成现有班次，暂未开放新班次。",
  ],
  [
    "Đang xử lý NFC cho hiện vật; đối chiếu trước khi tiếp tục.",
    "NFC processing is in progress for this item; reconcile before continuing.",
    "正在为此实物处理 NFC，请核对后继续。",
  ],
  [
    "Điều chỉnh trực tiếp chứng từ is không thuộc quy trình MVP hiện hành: BR-REV-01 giữ chứng từ gốc ở Đã ghi nhận. Dùng POST /inbound-documents/{id}/reversals hoặc /outbound-documents/{id}/reversals.",
    "reverse_document is outside the current MVP workflow: BR-REV-01 keeps the original document POSTED. Use POST /inbound-documents/{id}/reversals or /outbound-documents/{id}/reversals.",
    "reverse_document 不属于当前 MVP 流程：BR-REV-01 保留原单据为 POSTED。请使用 POST /inbound-documents/{id}/reversals 或 /outbound-documents/{id}/reversals。",
  ],
  [
    "reverse_document is outside the latest MVP baseline: BR-REV-01 giữ chứng từ gốc ở POSTED. Dùng POST /inbound-documents/{id}/reversals hoặc /outbound-documents/{id}/reversals.",
    "reverse_document is outside the current MVP workflow: BR-REV-01 keeps the original document POSTED. Use POST /inbound-documents/{id}/reversals or /outbound-documents/{id}/reversals.",
    "reverse_document 不属于当前 MVP 流程：BR-REV-01 保留原单据为 POSTED。请使用 POST /inbound-documents/{id}/reversals 或 /outbound-documents/{id}/reversals。",
  ],
  [
    "Điểm đến putaway phải là TRAY.",
    "The putaway destination must be a TRAY.",
    "上架目标必须为 TRAY。",
  ],
  ["Đã bật transition", "Transition enabled.", "已启用状态转换。"],
  [
    "Đã cập nhật ngữ cảnh làm việc",
    "Working context updated.",
    "已更新工作上下文。",
  ],
  ["Đã duyệt yêu cầu", "Request approved.", "已批准申请。"],
  [
    "Đã ghi nhận quét linh kiện hợp lệ; tồn kho chưa thay đổi (stock_effect=NONE).",
    "A valid component scan was recorded; inventory is unchanged (stock_effect=NONE).",
    "已记录有效配件扫描，库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã giữ chỗ ghi chip; ghi nfc_payload vào chip rồi gọi PATCH .../nfc để xác nhận.",
    "Chip write reserved; write nfc_payload to the chip, then call PATCH .../nfc to confirm.",
    "已预留芯片写入，请将 nfc_payload 写入芯片，再调用 PATCH .../nfc 确认。",
  ],
  [
    "Đã gán chip NFC cho hiện vật; tồn kho không đổi.",
    "NFC chip assigned to the item; inventory is unchanged.",
    "已为实物绑定 NFC 芯片，库存未变。",
  ],
  [
    "Đã gán mã vật lý vào đối tượng đích.",
    "Physical code assigned to the target object.",
    "已为目标对象分配物理编码。",
  ],
  [
    "Đã gắn RFID cho item; RFID không phải điều kiện Hoàn tất xuất kho.",
    "RFID linked to the item; RFID is not a prerequisite for Post Issue.",
    "已为实物关联 RFID；RFID 不是出库过账的前提。",
  ],
  [
    "Đã gắn RFID cho item; RFID không phải điều kiện Post Issue.",
    "RFID linked to the item; RFID is not a prerequisite for Post Issue.",
    "已为实物关联 RFID；RFID 不是出库过账的前提。",
  ],
  [
    "Đã gỡ SKU khỏi App PV.",
    "SKU removed from App PV.",
    "已从 App PV 移除 SKU。",
  ],
  [
    "Đã gỡ dòng quét khỏi phiếu xuất linh kiện; tồn kho không đổi (stock_effect=NONE).",
    "Scanned line removed from the component issue; inventory is unchanged (stock_effect=NONE).",
    "已从配件出库单移除扫描明细，库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã gỡ khớp mã xuất kho; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Outbound code match removed; inventory is unchanged (stock_effect=NONE).",
    "已移除出库编码匹配，库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã gỡ mã khỏi số lượng thực nhận; tồn kho chưa thay đổi.",
    "Code removed from the actual received quantity; inventory is unchanged.",
    "已从实收数量中移除编码，库存未变。",
  ],
  [
    "Đã gỡ mã quét nhập kho; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Inbound scan code removed; inventory is unchanged (stock_effect=NONE).",
    "已移除入库扫描编码，库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã gỡ nội dung container.",
    "Container contents removed.",
    "已移除容器内容。",
  ],
  [
    "Đã gửi duyệt yêu cầu",
    "Request submitted for approval.",
    "已提交申请审批。",
  ],
  [
    "Đã gửi lại mã xác minh thiết bị.",
    "Device verification code resent.",
    "已重新发送设备验证码。",
  ],
  [
    "Đã hoàn tất quét thùng; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Carton scan completed; inventory is unchanged (stock_effect=NONE).",
    "已完成纸箱扫描，库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã huỷ điều chỉnh tồn kho Nháp; không phát sinh stock effect.",
    "DRAFT reversal cancelled; no stock effect was generated.",
    "已取消 DRAFT 冲销，未产生库存变动。",
  ],
  [
    "Đã huỷ reversal DRAFT; không phát sinh stock effect.",
    "DRAFT reversal cancelled; no stock effect was generated.",
    "已取消 DRAFT 冲销，未产生库存变动。",
  ],
  ["Đã hủy chứng từ.", "Document cancelled.", "已取消单据。"],
  ["Đã hủy tác vụ putaway.", "Putaway task cancelled.", "已取消上架任务。"],
  ["Đã in lại nhãn.", "Label reprinted.", "已重新打印标签。"],
  ["Đã in nhãn.", "Label printed.", "已打印标签。"],
  [
    "Đã khởi tạo thử thách xác minh thiết bị.",
    "Device verification challenge initiated.",
    "已发起设备验证挑战。",
  ],
  [
    "Đã kiểm tra Import toa xuất.",
    "Outbound request import checked.",
    "已检查出库申请导入。",
  ],
  [
    "Đã kiểm tra file Excel theo quy tắc chỉ áp dụng cho SKU loại Sản phẩm.",
    "The Excel file was checked under rules limited to PRODUCT SKUs.",
    "已按仅适用于 PRODUCT SKU 的规则检查 Excel 文件。",
  ],
  [
    "Đã kiểm tra file Excel theo quy tắc chỉ áp dụng cho SKU loại PRODUCT.",
    "The Excel file was checked under rules limited to PRODUCT SKUs.",
    "已按仅适用于 PRODUCT SKU 的规则检查 Excel 文件。",
  ],
  [
    "Đã lưu phiên bản kiểm tra mới; không ghi dữ liệu SKU.",
    "A new check version was saved; no SKU data was written.",
    "已保存新的检查版本，未写入 SKU 数据。",
  ],
  [
    "Đã nhập sai mã quá nhiều lần. Vui lòng thử lại sau.",
    "Too many incorrect code attempts. Please try again later.",
    "验证码错误次数过多，请稍后重试。",
  ],
  [
    "Đã nhập sai mã xác minh quá số lần cho phép. Vui lòng đăng nhập lại.",
    "The verification code exceeded the allowed incorrect attempts. Please sign in again.",
    "验证码错误次数已达上限，请重新登录。",
  ],
  [
    "Đã publish SKU lên App PV.",
    "SKU published to App PV.",
    "已将 SKU 发布到 App PV。",
  ],
  [
    "Đã quét hợp lệ cho phiếu xuất linh kiện",
    "Valid component issue scan recorded.",
    "已记录有效配件出库扫描。",
  ],
  [
    "Đã resolve hiện vật nhưng chưa đủ điều kiện gán chip NFC mới.",
    "The item was resolved but is not yet eligible for a new NFC chip.",
    "已解析实物，但尚不符合绑定新 NFC 芯片的条件。",
  ],
  [
    "Đã resolve hiện vật; gọi prepare để giữ chỗ trước khi ghi chip.",
    "The item was resolved; call prepare to reserve before writing the chip.",
    "已解析实物，请先调用 prepare 预留，再写入芯片。",
  ],
  [
    "Đã resolve mã cho local staging; chưa ghi nhận vào WMS.",
    "The code was resolved for local staging; nothing was recorded in WMS.",
    "已解析编码供本地暂存，尚未写入 WMS。",
  ],
  [
    "Đã resolve mã nhưng chưa đủ điều kiện xuất linh kiện; chưa ghi nhận vào WMS.",
    "The code was resolved but is not eligible for component issue; nothing was recorded in WMS.",
    "已解析编码，但尚不符合配件出库条件，未写入 WMS。",
  ],
  [
    "Đã resolve mã nhưng item hiện chưa đủ điều kiện xuất; chưa tạo phiếu WMS.",
    "The code was resolved but the item is not eligible for issue; no WMS document was created.",
    "已解析编码，但实物尚不符合出库条件，未创建 WMS 单据。",
  ],
  [
    "Đã sẵn sàng ghi nhận linh kiện thực tế theo Box.",
    "Ready to record actual components by Box.",
    "已可按 Box 记录实际配件。",
  ],
  [
    "Đã thu hồi chip NFC; hiện vật có thể gán chip mới.",
    "NFC chip revoked; the item can be assigned a new chip.",
    "已撤销 NFC 芯片，实物可绑定新芯片。",
  ],
  [
    "Đã tiếp nhận ca bảo hành; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Warranty case received; inventory is unchanged (stock_effect=NONE).",
    "已接收保修单，库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã tra cứu hiện vật từ chip NFC.",
    "Item looked up from the NFC chip.",
    "已通过 NFC 芯片查询实物。",
  ],
  [
    "Đã tạo container; gán mã vật lý qua physical_codes.container_id; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Container created; assign its physical code through physical_codes.container_id; inventory is unchanged (stock_effect=NONE).",
    "已创建容器，请通过 physical_codes.container_id 分配物理编码；库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã tạo cấu hình máy in.",
    "Printer configuration created.",
    "已创建打印机配置。",
  ],
  [
    "Đã tạo phiếu xuất linh kiện; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Component issue document created; inventory is unchanged (stock_effect=NONE).",
    "已创建配件出库单，库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã tạo snapshot nhãn (bất biến).",
    "Immutable label snapshot created.",
    "已创建不可变标签快照。",
  ],
  [
    "Đã tạo tác vụ putaway Nháp.",
    "DRAFT putaway task created.",
    "已创建 DRAFT 上架任务。",
  ],
  [
    "Đã tạo tác vụ putaway DRAFT.",
    "DRAFT putaway task created.",
    "已创建 DRAFT 上架任务。",
  ],
  [
    "Đã tạo yêu cầu export; theo dõi qua status_url rồi tải qua download_url khi trạng thái=READY.",
    "Export request created; follow status_url, then use download_url when status=READY.",
    "已创建导出请求，请通过 status_url 跟踪，并在 status=READY 时通过 download_url 下载。",
  ],
  [
    "Đã tạo yêu cầu export; theo dõi qua status_url rồi tải qua download_url khi status=READY.",
    "Export request created; follow status_url, then use download_url when status=READY.",
    "已创建导出请求，请通过 status_url 跟踪，并在 status=READY 时通过 download_url 下载。",
  ],
  ["Đã tắt transition", "Transition disabled.", "已关闭状态转换。"],
  [
    "Đã tắt xác thực hai bước.",
    "Two-step verification disabled.",
    "已关闭两步验证。",
  ],
  [
    "Đã từ chối duyệt yêu cầu",
    "Request approval rejected.",
    "已拒绝申请审批。",
  ],
  [
    "Đã xoá chứng từ đính kèm (xoá logic).",
    "Document attachment deleted (soft delete).",
    "已删除单据附件（逻辑删除）。",
  ],
  [
    "Đã xoá dòng linh kiện khỏi phiếu; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Component line removed from the document; inventory is unchanged (stock_effect=NONE).",
    "已从单据删除配件明细，库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã xác nhận dán Nhãn đóng gói; stock_effect=NONE.",
    "Packing label attachment confirmed; stock_effect=NONE.",
    "已确认粘贴包装标签，stock_effect=NONE。",
  ],
  [
    "Đã xác nhận dán Packing Label; stock_effect=NONE.",
    "Packing label attachment confirmed; stock_effect=NONE.",
    "已确认粘贴包装标签，stock_effect=NONE。",
  ],
  [
    "Đã xác nhận hàng vật lý quay lại kho; chưa phát sinh stock effect.",
    "Physical return to the warehouse confirmed; no stock effect has occurred.",
    "已确认实物退回仓库，尚未产生库存变动。",
  ],
  [
    "Đã xóa tệp đính kèm bảo hành (xóa logic).",
    "Warranty attachment deleted (soft delete).",
    "已删除保修附件（逻辑删除）。",
  ],
  [
    "Đã xử lý Import toa xuất.",
    "Outbound request import processed.",
    "已处理出库申请导入。",
  ],
  [
    "Đã xử lý import toa xuất: toa yêu cầu chuyển sang CONSUMED và đã tạo phiếu xuất kho ở trạng thái Nháp.",
    "Outbound request import processed: the request is CONSUMED and a DRAFT outbound document was created.",
    "已处理出库申请导入：申请单已转为 CONSUMED，并已创建 DRAFT 出库单。",
  ],
  [
    "Đã xử lý import toa xuất: toa yêu cầu chuyển sang CONSUMED và đã tạo phiếu xuất kho ở trạng thái DRAFT.",
    "Outbound request import processed: the request is CONSUMED and a DRAFT outbound document was created.",
    "已处理出库申请导入：申请单已转为 CONSUMED，并已创建 DRAFT 出库单。",
  ],
  ["Đã đánh dấu tất cả đã đọc", "All marked as read.", "已全部标为已读。"],
  ["Đã đánh dấu đã đọc", "Marked as read.", "已标为已读。"],
  [
    "Đã đăng ký BOX cho dòng nhập Linh kiện.",
    "BOX registered for the COMPONENT inbound line.",
    "已为 COMPONENT 入库明细注册 BOX。",
  ],
  [
    "Đã đăng ký BOX cho dòng nhập COMPONENT.",
    "BOX registered for the COMPONENT inbound line.",
    "已为 COMPONENT 入库明细注册 BOX。",
  ],
  [
    "Đã đảm bảo đúng 01 Nhãn đóng gói bất biến cho phiếu/lô xuất; chưa trừ tồn.",
    "Exactly 01 immutable packing label was ensured for the outbound document/batch; inventory has not been deducted.",
    "已为出库单/批次确保恰好 01 个不可变包装标签，尚未扣减库存。",
  ],
  [
    "Đã đảm bảo đúng 01 Packing Label bất biến cho phiếu/lô xuất; chưa trừ tồn.",
    "Exactly 01 immutable packing label was ensured for the outbound document/batch; inventory has not been deducted.",
    "已为出库单/批次确保恰好 01 个不可变包装标签，尚未扣减库存。",
  ],
  [
    "Đăng ký thiết bị đã thay đổi.",
    "Device registration changed.",
    "设备注册信息已更改。",
  ],
  [
    "Đăng ký thiết bị đã thay đổi. Vui lòng đọc lại.",
    "Device registration changed. Please read it again.",
    "设备注册信息已更改，请重新读取。",
  ],
  [
    "Đăng nhập chỉ nhận email đầy đủ; không dùng tên đăng nhập.",
    "Sign-in only accepts a full email address, not a username.",
    "登录仅接受完整电子邮箱地址，不接受用户名。",
  ],
  [
    "Đăng nhập lại bằng phiên hỗ trợ quản lý thiết bị.",
    "Sign in again using a session that supports device management.",
    "请使用支持设备管理的会话重新登录。",
  ],
  [
    "Đại lý đã được cập nhật bởi phiên khác; tải lại trước khi lưu.",
    "Another session updated the agency; reload before saving.",
    "其他会话已更新经销商，请重新加载后保存。",
  ],
  [
    "Đại lý đã được dùng trên chứng từ nên không đổi được agency_code.",
    "The agency is used on documents, so agency_code cannot be changed.",
    "经销商已用于单据，无法更改 agency_code。",
  ],
  [
    "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.",
    "Password reset succeeded. Please sign in with your new password.",
    "密码重置成功，请使用新密码登录。",
  ],
  [
    "Định danh phải là UUID chữ thường.",
    "The identifier must be a lowercase UUID.",
    "标识必须为小写 UUID。",
  ],
  [
    "Định danh phải là UUID thực, không phải số phiếu.",
    "The identifier must be an actual UUID, not a document number.",
    "标识必须为实际 UUID，不能是单据编号。",
  ],
  [
    "Đối tượng nhận hàng đã được cập nhật bởi phiên khác; tải lại trước khi lưu.",
    "Another session updated the recipient; reload before saving.",
    "其他会话已更新收货对象，请重新加载后保存。",
  ],
  [
    "Đối tượng scan chưa có kho hiện tại nên không thể xác nhận ngữ cảnh.",
    "The scanned object has no current warehouse, so its context cannot be confirmed.",
    "扫描对象缺少当前仓库，无法确认上下文。",
  ],
  [
    "Đối tượng scan không đủ điều kiện cho ngữ cảnh OUTBOUND.",
    "The scanned object is not eligible for the OUTBOUND context.",
    "扫描对象不符合 OUTBOUND 上下文条件。",
  ],
  [
    "Đổi mã trace hoặc ca không tạo ý định owner mới; đối chiếu yêu cầu gốc.",
    "Changing the trace code or shift does not create a new owner intent; reconcile the original request.",
    "更改追溯码或班次不会创建新的所属方操作意图，请核对原请求。",
  ],
  [
    "Đổi parent_container_id là thao tác putaway; dùng POST /putaway/tasks rồi confirm, không dùng PATCH /containers/{id}.",
    "Changing parent_container_id is a putaway operation; use POST /putaway/tasks then confirm, not PATCH /containers/{id}.",
    "更改 parent_container_id 属于上架操作，请使用 POST /putaway/tasks 后确认，不得使用 PATCH /containers/{id}。",
  ],
  [
    "Đổi parent_container_id là thao tác putaway; dùng POST /putaway/tasks rồi confirm, không dùng generic container update.",
    "Changing parent_container_id is a putaway operation; use POST /putaway/tasks then confirm, not a generic container update.",
    "更改 parent_container_id 属于上架操作，请使用 POST /putaway/tasks 后确认，不得使用通用容器更新。",
  ],
  [
    "Đổi trạng thái hiển thị App PV (published_to_app) cần quyền pv.publish.",
    "Changing App PV visibility (published_to_app) requires pv.publish permission.",
    "更改 App PV 显示状态（published_to_app）需要 pv.publish 权限。",
  ],
  [
    "điều chỉnh tồn kho Nháp không có line.",
    "The DRAFT reversal has no lines.",
    "DRAFT 冲销没有明细。",
  ],
  [
    "Reversal DRAFT không có line.",
    "The DRAFT reversal has no lines.",
    "DRAFT 冲销没有明细。",
  ],
  [
    "điều chỉnh tồn kho bắt buộc header If-Match theo version chứng từ gốc.",
    "A reversal requires an If-Match header matching the original document version.",
    "冲销需要与原单据版本匹配的 If-Match 请求头。",
  ],
  [
    "Reversal bắt buộc header If-Match theo version chứng từ gốc.",
    "A reversal requires an If-Match header matching the original document version.",
    "冲销需要与原单据版本匹配的 If-Match 请求头。",
  ],
  [
    "điều chỉnh tồn kho không ở Nháp/PENDING_RETURN.",
    "The reversal is not DRAFT/PENDING_RETURN.",
    "冲销不处于 DRAFT/PENDING_RETURN 状态。",
  ],
  [
    "Reversal không ở DRAFT/PENDING_RETURN.",
    "The reversal is not DRAFT/PENDING_RETURN.",
    "冲销不处于 DRAFT/PENDING_RETURN 状态。",
  ],
  [
    "điều chỉnh tồn kho không ở trạng thái chờ hàng về.",
    "The reversal is not awaiting a physical return.",
    "冲销不处于等待实物退回状态。",
  ],
  [
    "Reversal không ở trạng thái chờ hàng về.",
    "The reversal is not awaiting a physical return.",
    "冲销不处于等待实物退回状态。",
  ],
  [
    "điều chỉnh tồn kho phải chỉ rõ movement/số lượng cần đảo; không auto-reverse toàn chứng từ.",
    "A reversal must specify the movement/quantity to reverse; the entire document is not reversed automatically.",
    "冲销必须指定要撤销的库存变动/数量，不会自动冲销整张单据。",
  ],
  [
    "Reversal phải chỉ rõ movement/quantity cần đảo; không auto-reverse toàn chứng từ.",
    "A reversal must specify the movement/quantity to reverse; the entire document is not reversed automatically.",
    "冲销必须指定要撤销的库存变动/数量，不会自动冲销整张单据。",
  ],
  [
    "điều chỉnh tồn kho phải ở Nháp trước khi Post.",
    "The reversal must be DRAFT before posting.",
    "冲销必须处于 DRAFT 状态才能过账。",
  ],
  [
    "Reversal phải ở DRAFT trước khi Post.",
    "The reversal must be DRAFT before posting.",
    "冲销必须处于 DRAFT 状态才能过账。",
  ],
  [
    "điều chỉnh tồn kho receipt sẽ làm tồn âm.",
    "The receipt reversal would make inventory negative.",
    "入库冲销会导致负库存。",
  ],
  [
    "Reversal receipt sẽ làm tồn âm.",
    "The receipt reversal would make inventory negative.",
    "入库冲销会导致负库存。",
  ],
  [
    "điều chỉnh tồn kho stock effect sẽ làm tồn âm.",
    "The reversal's stock effect would make inventory negative.",
    "冲销的库存变动会导致负库存。",
  ],
  [
    "Reversal stock effect sẽ làm tồn âm.",
    "The reversal's stock effect would make inventory negative.",
    "冲销的库存变动会导致负库存。",
  ],
  [
    "điều chỉnh tồn kho sẽ làm available_qty âm.",
    "The reversal would make available_qty negative.",
    "冲销会使 available_qty 为负。",
  ],
  [
    "Reversal sẽ làm available_qty âm.",
    "The reversal would make available_qty negative.",
    "冲销会使 available_qty 为负。",
  ],
  [
    "điều chỉnh tồn kho số lượng phải là số nguyên dương.",
    "The reversal quantity must be a positive integer.",
    "冲销数量必须为正整数。",
  ],
  [
    "Reversal quantity phải là số nguyên dương.",
    "The reversal quantity must be a positive integer.",
    "冲销数量必须为正整数。",
  ],
  [
    "điều chỉnh tồn kho số lượng vượt reversible_qty.",
    "The reversal quantity exceeds reversible_qty.",
    "冲销数量超过 reversible_qty。",
  ],
  [
    "Reversal quantity vượt reversible_qty.",
    "The reversal quantity exceeds reversible_qty.",
    "冲销数量超过 reversible_qty。",
  ],
  [
    "điều chỉnh tồn kho đã huỷ; không thể đính kèm thêm chứng từ.",
    "The reversal is cancelled; no more attachments can be added.",
    "冲销已取消，无法继续添加附件。",
  ],
  [
    "Reversal đã huỷ; không thể đính kèm thêm chứng từ.",
    "The reversal is cancelled; no more attachments can be added.",
    "冲销已取消，无法继续添加附件。",
  ],
  [
    "Ảnh bảo hành chỉ nhận JPG/PNG/WEBP.",
    "Warranty images only accept JPG/PNG/WEBP.",
    "保修图片仅接受 JPG/PNG/WEBP。",
  ],
  [
    "Ảnh sau xử lý phải nhỏ hơn hoặc bằng 2 MiB.",
    "The processed image must be no larger than 2 MiB.",
    "处理后的图片不得大于 2 MiB。",
  ],
  [
    "Ảnh sản phẩm chỉ nhận JPG/PNG/WEBP.",
    "Product images only accept JPG/PNG/WEBP.",
    "产品图片仅接受 JPG/PNG/WEBP。",
  ],
  [
    "Ảnh đính kèm vượt quá 10MB.",
    "The image attachment exceeds 10MB.",
    "图片附件超过 10MB。",
  ],
  [
    "Ứng dụng đăng ký chưa được phép.",
    "The registered application is not allowed.",
    "不允许此注册应用。",
  ],
];
