/** Source-backed static backend messages, including normalized/raw aliases. */
export const BACKEND_CATALOG_BATCH_2: ReadonlyArray<
  readonly [string, string, string]
> = [
  [
    "Item đã có warranty case đang hoạt động.",
    "This item already has an active warranty case.",
    "该实物已有正在处理的保修工单。",
  ],
  [
    "Item đã match. Tiếp tục scan; chưa tạo nhãn và chưa trừ tồn.",
    "Item matched. Continue scanning; no label has been created and stock has not been deducted.",
    "实物已匹配。请继续扫描；尚未创建标签，也未扣减库存。",
  ],
  [
    "Item đã nằm trong luồng tồn khác và không thể nhập lại.",
    "This item is already in another inventory flow and cannot be received again.",
    "该实物已进入其他库存流程，无法重复入库。",
  ],
  [
    "Item đã nằm trong một active container mapping khác.",
    "This item already has another active container mapping.",
    "该实物已有其他有效的容器关联。",
  ],
  [
    "Item đã được match vào dòng outbound này.",
    "This item is already matched to this outbound line.",
    "该实物已匹配此出库明细行。",
  ],
  [
    "Item đã được scan Đang hoạt động trong Component Issue này.",
    "This item has already been scanned as ACTIVE in this component issue.",
    "此实物已在此配件出库单中登记了有效扫描。",
  ],
  [
    "Item đã được scan ACTIVE trong Component Issue này.",
    "This item has already been scanned as ACTIVE in this component issue.",
    "此实物已在此配件出库单中登记了有效扫描。",
  ],
  [
    "Item đã được đảo bởi một điều chỉnh tồn kho Đã ghi nhận khác; reload reversible_qty.",
    "Another POSTED inventory reversal has already reversed this item; reload reversible_qty.",
    "该实物已被另一张已过账的库存冲销单冲销；请重新加载 reversible_qty。",
  ],
  [
    "Item đã được đảo bởi một reversal POSTED khác; reload reversible_qty.",
    "Another POSTED inventory reversal has already reversed this item; reload reversible_qty.",
    "该实物已被另一张已过账的库存冲销单冲销；请重新加载 reversible_qty。",
  ],
  [
    "KPI P02 chỉ nhận bộ lọc trong query của GET.",
    "KPI P02 only accepts filters in a GET query.",
    "KPI P02 仅接受 GET 查询中的筛选条件。",
  ],
  [
    "Keep original UUID Idempotency-Key and X-Request-ID.",
    "Keep the original UUID Idempotency-Key and X-Request-ID.",
    "请保留原始 UUID 格式的 Idempotency-Key 和 X-Request-ID。",
  ],
  [
    "Key cũ đã gắn với nội dung khác; không ghi lại chip.",
    "The previous key is already associated with different content; do not write the chip again.",
    "原键值已关联其他内容；请勿再次写入芯片。",
  ],
  [
    "Key không khớp parent, kho hoặc tệp cần đối chiếu.",
    "The key does not match the parent record, warehouse or file being reconciled.",
    "该键与待核对的父记录、仓库或文件不匹配。",
  ],
  [
    "Key đã dùng với parent, tệp hoặc metadata khác.",
    "This key has already been used with a different parent record, file or metadata.",
    "该键已用于其他父记录、文件或元数据。",
  ],
  [
    "Kho bảo hành nằm ngoài phạm vi được cấp.",
    "The warranty warehouse is outside your permitted scope.",
    "保修仓库超出您的授权范围。",
  ],
  [
    "Kho của hồ sơ không khớp kho đang làm việc.",
    "The record's warehouse does not match the current working warehouse.",
    "记录所属仓库与当前工作仓库不匹配。",
  ],
  [
    "Kho của thao tác ghi nhận không khớp kho bản nháp.",
    "The posting warehouse does not match the draft's warehouse.",
    "过账操作的仓库与草稿仓库不匹配。",
  ],
  [
    "Kho của thao tác không khớp ca.",
    "The operation's warehouse does not match the shift.",
    "操作仓库与当前班次不匹配。",
  ],
  [
    "Kho của yêu cầu không khớp ca.",
    "The request's warehouse does not match the shift.",
    "请求仓库与当前班次不匹配。",
  ],
  [
    "Kho gửi lên không khớp kho của phiên.",
    "The submitted warehouse does not match the session's warehouse.",
    "提交的仓库与会话仓库不匹配。",
  ],
  [
    "Kho gửi lên không khớp kho phiên.",
    "The submitted warehouse does not match the session's warehouse.",
    "提交的仓库与会话仓库不匹配。",
  ],
  [
    "Kho gửi lên không khớp kho đã xác nhận trong phiên.",
    "The submitted warehouse does not match the warehouse confirmed in this session.",
    "提交的仓库与此会话中已确认的仓库不匹配。",
  ],
  [
    "Kho gửi lên không khớp kho đã xác nhận trong phiên. Tải lại thông tin phiên trước khi tiếp tục.",
    "The submitted warehouse does not match the warehouse confirmed in this session. Reload the session information before continuing.",
    "提交的仓库与此会话中已确认的仓库不匹配。请重新加载会话信息后继续。",
  ],
  [
    "Kho không còn hoạt động.",
    "The warehouse is no longer active.",
    "该仓库已停用。",
  ],
  ["Kho không hoạt động.", "The warehouse is inactive.", "该仓库未启用。"],
  [
    "Kho không khớp phiên.",
    "The warehouse does not match the session.",
    "仓库与当前会话不匹配。",
  ],
  ["Kho không tồn tại.", "The warehouse does not exist.", "仓库不存在。"],
  [
    "Kho liên kết không khớp kho của phiên.",
    "The linked warehouse does not match the session's warehouse.",
    "关联仓库与会话仓库不匹配。",
  ],
  [
    "Kho lưu kết quả lệnh chưa được triển khai.",
    "Command-result storage has not been implemented.",
    "尚未配置命令结果存储。",
  ],
  [
    "Kho ngoài phạm vi được cấp.",
    "The warehouse is outside your permitted scope.",
    "仓库超出您的授权范围。",
  ],
  [
    "Kho nguồn không tồn tại hoặc không Đang hoạt động.",
    "The source warehouse does not exist or is not ACTIVE.",
    "来源仓库不存在或未启用。",
  ],
  [
    "Kho nguồn không tồn tại hoặc không ACTIVE.",
    "The source warehouse does not exist or is not ACTIVE.",
    "来源仓库不存在或未启用。",
  ],
  [
    "Kho nguồn và kho đích không được trùng nhau.",
    "The source and destination warehouses must be different.",
    "来源仓库与目标仓库不能相同。",
  ],
  [
    "Kho nhận không tồn tại hoặc không hoạt động.",
    "The receiving warehouse does not exist or is inactive.",
    "收货仓库不存在或已停用。",
  ],
  [
    "Kho nằm ngoài phạm vi được cấp.",
    "The warehouse is outside your permitted scope.",
    "仓库超出您的授权范围。",
  ],
  [
    "Kho nằm ngoài phạm vi được phân quyền.",
    "The warehouse is outside your authorized scope.",
    "仓库超出您的授权范围。",
  ],
  [
    "Kho nằm ngoài quyền hiện tại.",
    "The warehouse is outside your current permissions.",
    "您当前的权限不包含该仓库。",
  ],
  [
    "Kho nằm ngoài quyền được cấp.",
    "The warehouse is outside your granted permissions.",
    "您没有该仓库的访问权限。",
  ],
  [
    "Kho sở hữu hồ sơ không còn hoạt động; chỉ được đọc.",
    "The record's owning warehouse is no longer active; this record is read-only.",
    "记录所属仓库已停用；仅可查看此记录。",
  ],
  [
    "Kho tổng đang không khả dụng.",
    "The central warehouse is unavailable.",
    "总仓库当前不可用。",
  ],
  [
    "Kho upload không khớp phiên.",
    "The upload warehouse does not match the session.",
    "上传仓库与当前会话不匹配。",
  ],
  [
    "Kho xuất linh kiện không tồn tại hoặc không Đang hoạt động.",
    "The component-issuing warehouse does not exist or is not ACTIVE.",
    "配件出库仓库不存在或未启用。",
  ],
  [
    "Kho xuất linh kiện không tồn tại hoặc không ACTIVE.",
    "The component-issuing warehouse does not exist or is not ACTIVE.",
    "配件出库仓库不存在或未启用。",
  ],
  [
    "Kho yêu cầu không khớp kho của phiên đăng nhập.",
    "The requested warehouse does not match the login session's warehouse.",
    "请求的仓库与登录会话中的仓库不匹配。",
  ],
  [
    "Kho yêu cầu không khớp kho của phiên.",
    "The requested warehouse does not match the session's warehouse.",
    "请求的仓库与会话仓库不匹配。",
  ],
  [
    "Kho yêu cầu không khớp phiên làm việc.",
    "The requested warehouse does not match the working session.",
    "请求的仓库与工作会话不匹配。",
  ],
  [
    "Kho yêu cầu không khớp phiên đăng nhập.",
    "The requested warehouse does not match the login session.",
    "请求的仓库与登录会话不匹配。",
  ],
  [
    "Kho yêu cầu nằm ngoài data scope hiện hành.",
    "The requested warehouse is outside the current data scope.",
    "请求的仓库超出当前数据访问范围。",
  ],
  [
    "Kho yêu cầu nằm ngoài data scope.",
    "The requested warehouse is outside the data scope.",
    "请求的仓库超出数据访问范围。",
  ],
  [
    "Kho đang chọn không còn phù hợp với ca.",
    "The selected warehouse is no longer valid for this shift.",
    "所选仓库已不适用于当前班次。",
  ],
  [
    "Kho đang không Đang hoạt động.",
    "The warehouse is not ACTIVE.",
    "仓库尚未启用。",
  ],
  ["Kho đang không ACTIVE.", "The warehouse is not ACTIVE.", "仓库尚未启用。"],
  [
    "Kho đang tạm dừng hoạt động nên mọi thao tác ghi bị khoá. Vẫn xem, tra cứu, xuất báo cáo và tra nhật ký được. Liên hệ quản trị để mở lại kho.",
    "The warehouse is suspended, so all write operations are locked. Viewing, searching, exporting reports and checking logs remain available. Contact an administrator to reopen the warehouse.",
    "仓库已暂停运营，所有写入操作均已锁定。仍可查看、查询、导出报表和查阅日志。请联系管理员重新启用仓库。",
  ],
  [
    "Kho đang tạm dừng hoạt động.",
    "The warehouse is suspended.",
    "仓库已暂停运营。",
  ],
  [
    "Kho đang tạm ngừng, không thể tạo hoặc tiếp tục chứng từ.",
    "The warehouse is suspended; documents cannot be created or continued.",
    "仓库已暂停运营，无法创建或继续处理单据。",
  ],
  [
    "Khoảng chọn ngày phải nằm từ hôm nay trừ 90 ngày đến hôm nay theo giờ Việt Nam.",
    "The selected dates must fall between 90 days ago and today, in Vietnam time.",
    "所选日期必须在越南时间的今天及此前 90 天内。",
  ],
  [
    "Khoảng ngày cho chart theo ngày tối đa 366 ngày.",
    "The daily chart's date range cannot exceed 366 days.",
    "按日图表的日期范围不能超过 366 天。",
  ],
  [
    "Khoảng ngày cho dashboard tối đa 366 ngày.",
    "The dashboard's date range cannot exceed 366 days.",
    "看板的日期范围不能超过 366 天。",
  ],
  [
    "Khóa đã được dùng với nội dung, phiên bản hoặc định danh khác.",
    "This key has already been used with different content, version or identity.",
    "该键已用于其他内容、版本或标识。",
  ],
  [
    "Không chuẩn hóa được nội dung tìm kiếm.",
    "The search text could not be normalized.",
    "无法规范化搜索内容。",
  ],
  [
    "Không còn giữ chỗ; chưa được ghi chip.",
    "The reservation is no longer held; the chip must not be written yet.",
    "预留已失效；暂不可写入芯片。",
  ],
  [
    "Không có biên nhận từ chối xác định; không tự chuyển Không nhận diện được thành thất bại.",
    "There is no definitive rejection receipt; do not automatically treat UNKNOWN as a failure.",
    "没有明确的拒绝回执；请勿自动将未知结果视为失败。",
  ],
  [
    "Không có biên nhận từ chối xác định; không tự chuyển UNKNOWN thành thất bại.",
    "There is no definitive rejection receipt; do not automatically treat UNKNOWN as a failure.",
    "没有明确的拒绝回执；请勿自动将未知结果视为失败。",
  ],
  [
    "Không có grant thực cho thao tác PX của kho này.",
    "There is no valid authorization grant for the PX operation in this warehouse.",
    "没有对此仓库 PX 操作的有效授权。",
  ],
  [
    "Không có hồ sơ bảo hành thuộc kho của bản nháp.",
    "There is no warranty case belonging to the draft's warehouse.",
    "没有属于该草稿仓库的保修工单。",
  ],
  [
    "Không có movement gốc hợp lệ để điều chỉnh tồn kho.",
    "There is no valid original inventory movement to reverse.",
    "没有可供冲销的有效原始库存流水。",
  ],
  [
    "Không có movement gốc hợp lệ để reversal.",
    "There is no valid original inventory movement to reverse.",
    "没有可供冲销的有效原始库存流水。",
  ],
  [
    "Không có nguồn chứng từ được phép đọc.",
    "No document source is available within your read permissions.",
    "没有您有权读取的单据来源。",
  ],
  [
    "Không có nguồn lịch sử khả dụng trong phạm vi được cấp.",
    "No history source is available within your permitted scope.",
    "您的授权范围内没有可用的历史来源。",
  ],
  [
    "Không có permit phục hồi đã lưu.",
    "No saved recovery permit was found.",
    "未找到已保存的恢复许可。",
  ],
  [
    "Không có quyền bảo hành tương ứng.",
    "You do not have the required warranty permission.",
    "您没有所需的保修操作权限。",
  ],
  [
    "Không có quyền history.read hoặc tài khoản không còn hoạt động.",
    "The history.read permission is missing, or the account is no longer active.",
    "缺少 history.read 权限，或账号已停用。",
  ],
  [
    "Không có quyền quản lý nhà cung cấp.",
    "You do not have permission to manage suppliers.",
    "您没有管理供应商的权限。",
  ],
  [
    "Không có quyền thực hiện thao tác bản nháp này.",
    "You do not have permission to perform this draft operation.",
    "您没有执行此草稿操作的权限。",
  ],
  [
    "Không có quyền thực hiện thao tác nhập kho này.",
    "You do not have permission to perform this inbound operation.",
    "您没有执行此入库操作的权限。",
  ],
  [
    "Không có quyền tra cứu nhà cung cấp.",
    "You do not have permission to look up suppliers.",
    "您没有查询供应商的权限。",
  ],
  [
    "Không có quyền truy cập hồ sơ trong phạm vi kho này.",
    "You do not have permission to access this record within this warehouse scope.",
    "您没有在此仓库范围内访问该记录的权限。",
  ],
  [
    "Không có quyền truy cập kho sở hữu hồ sơ bảo hành.",
    "You do not have access to the warehouse that owns this warranty case.",
    "您没有访问此保修工单所属仓库的权限。",
  ],
  [
    "Không có quyền truy cập kho.",
    "You do not have access to this warehouse.",
    "您没有访问此仓库的权限。",
  ],
  [
    "Không có quyền xuất linh kiện.",
    "You do not have permission to issue components.",
    "您没有配件出库权限。",
  ],
  [
    "Không có quyền đọc bản nháp.",
    "You do not have permission to read this draft.",
    "您没有读取此草稿的权限。",
  ],
  [
    "Không có quyền đọc công việc xuất linh kiện.",
    "You do not have permission to read this component-issue task.",
    "您没有读取此配件出库任务的权限。",
  ],
  [
    "Không có quyền đọc hiện vật và master.",
    "You do not have permission to read items and master data.",
    "您没有读取实物及主数据的权限。",
  ],
  [
    "Không có quyền đọc hộp.",
    "You do not have permission to read this box.",
    "您没有读取此箱的权限。",
  ],
  [
    "Không có quyền đọc nguồn của trạng thái đã chọn.",
    "You do not have permission to read the source for the selected status.",
    "您没有读取所选状态对应来源的权限。",
  ],
  [
    "Không có quyền đọc nguồn lịch sử này.",
    "You do not have permission to read this history source.",
    "您没有读取此历史来源的权限。",
  ],
  [
    "Không có quyền đọc nguồn lịch sử được yêu cầu.",
    "You do not have permission to read the requested history source.",
    "您没有读取所请求历史来源的权限。",
  ],
  [
    "Không có quyền đọc nguồn đã chọn.",
    "You do not have permission to read the selected source.",
    "您没有读取所选来源的权限。",
  ],
  [
    "Không có quyền đọc phiên quét.",
    "You do not have permission to read this scanning session.",
    "您没有读取此扫描会话的权限。",
  ],
  [
    "Không có quyền đọc phiếu nguồn.",
    "You do not have permission to read the source document.",
    "您没有读取来源单据的权限。",
  ],
  [
    "Không có quyền đọc thông tin phân loại linh kiện/sản phẩm của hộp.",
    "You do not have permission to read the box's component/product classification.",
    "您没有读取此箱配件／产品分类信息的权限。",
  ],
  [
    "Không có quyền đọc định danh hiện vật.",
    "You do not have permission to read item identities.",
    "您没有读取实物标识的权限。",
  ],
  [
    "Không có receipt JSON hợp lệ từ nghiệp vụ ghi nhận.",
    "No valid JSON receipt was returned by the posting operation.",
    "过账操作未返回有效的 JSON 回执。",
  ],
  [
    "Không có reservation phục hồi hợp lệ.",
    "No valid recovery reservation was found.",
    "未找到有效的恢复预留。",
  ],
  [
    "Không có trường nào để cập nhật.",
    "There are no fields to update.",
    "没有需要更新的字段。",
  ],
  [
    "Không có yêu cầu gửi thử.",
    "There is no test-send request.",
    "没有测试发送请求。",
  ],
  [
    "Không cấp PX mới cho định danh phiếu Web.",
    "A new PX number cannot be allocated for a web document identity.",
    "不能为网页单据标识分配新的 PX 编号。",
  ],
  [
    "Không cấp số mới cho nháp đã kết thúc.",
    "A new number cannot be allocated to a closed draft.",
    "不能为已结束的草稿分配新编号。",
  ],
  [
    "Không ghi đè metadata, người nhận hoặc kế hoạch phiếu nguồn.",
    "Do not overwrite the source document's metadata, recipient or plan.",
    "请勿覆盖来源单据的元数据、收货方或计划。",
  ],
  [
    "Không ghi được Import báo cáo; giao dịch import phải rollback.",
    "The import report could not be recorded; the import transaction must be rolled back.",
    "无法记录导入报告；必须回滚导入事务。",
  ],
  [
    "Không ghi được chứng từ đính kèm lên kho lưu trữ. Thử lại sau ít phút.",
    "The attached document could not be written to storage. Try again in a few minutes.",
    "无法将附件单据写入存储。请几分钟后重试。",
  ],
  [
    "Không ghi được toàn bộ danh sách quét; transaction sẽ rollback.",
    "The entire scan list could not be saved; the transaction will be rolled back.",
    "无法保存完整扫描列表；事务将回滚。",
  ],
  [
    "Không ghi được tệp đính kèm lên kho lưu trữ. Thử lại sau ít phút.",
    "The attachment could not be written to storage. Try again in a few minutes.",
    "无法将附件写入存储。请几分钟后重试。",
  ],
  [
    "Không ghi được ảnh lên kho lưu trữ. Kiểm tra cấu hình bucket rồi thử lại.",
    "The image could not be written to storage. Check the bucket configuration and try again.",
    "无法将图片写入存储。请检查存储桶配置后重试。",
  ],
  [
    "Không giành được chỗ giữ chống ghi trùng cho lần import này; từ chối để không ghi trùng dữ liệu.",
    "A duplicate-prevention reservation could not be acquired for this import; the import was rejected to prevent duplicate data.",
    "无法取得此次导入的防重复预留；已拒绝导入，以避免重复写入数据。",
  ],
  [
    "Không gắn yêu cầu upload cũ vào phiên đăng nhập mới.",
    "Do not attach an old upload request to a new login session.",
    "请勿将旧的上传请求关联到新的登录会话。",
  ],
  [
    "Không gửi dữ liệu khi đánh dấu đã đọc.",
    "Do not send data when marking notifications as read.",
    "标记通知为已读时请勿发送数据。",
  ],
  [
    "Không gửi page cùng cursor.",
    "Do not send page together with cursor.",
    "请勿同时发送 page 和 cursor。",
  ],
  [
    "Không gửi q và keyword khác nhau.",
    "Do not send different values for q and keyword.",
    "q 与 keyword 的值不能不同。",
  ],
  [
    "Không gửi query trên thao tác lưu/hủy bản nháp.",
    "Do not send a query when saving or cancelling a draft.",
    "保存或取消草稿时请勿发送查询参数。",
  ],
  [
    "Không gửi tham số truy vấn.",
    "Do not send query parameters.",
    "请勿发送查询参数。",
  ],
  [
    "Không gửi thêm dữ liệu khi tắt thông báo.",
    "Do not send additional data when disabling notifications.",
    "停用通知时请勿发送额外数据。",
  ],
  [
    "Không gửi đồng thời page và cursor.",
    "Do not send page and cursor at the same time.",
    "请勿同时发送 page 和 cursor。",
  ],
  [
    "Không hoàn tất được bước xuất linh kiện; transaction sẽ rollback.",
    "The component-issue step could not be completed; the transaction will be rolled back.",
    "无法完成配件出库步骤；事务将回滚。",
  ],
  [
    "Không khóa được bộ cấp số BH.",
    "The BH number allocator could not be locked.",
    "无法锁定 BH 编号分配器。",
  ],
  [
    "Không khóa được bộ cấp số phiếu nhập.",
    "The inbound document number allocator could not be locked.",
    "无法锁定入库单编号分配器。",
  ],
  [
    "Không lưu thông tin xác thực vào bản nháp.",
    "Do not store authentication information in a draft.",
    "请勿在草稿中保存身份验证信息。",
  ],
  [
    "Không lưu được Import báo cáo; toàn bộ giao dịch import đã rollback, không có SKU nào được tạo/cập nhật. Vui lòng thử lại.",
    "The import report could not be saved; the entire import transaction has been rolled back and no SKUs were created or updated. Please try again.",
    "无法保存导入报告；整个导入事务已回滚，未创建或更新任何 SKU。请重试。",
  ],
  [
    "Không lưu được file import tạm thời. Vui lòng thử lại.",
    "The temporary import file could not be saved. Please try again.",
    "无法保存临时导入文件。请重试。",
  ],
  [
    "Không nhận actor, quyền hoặc ngữ cảnh từ query của API cá nhân.",
    "The personal API does not accept an actor, permissions or context from query parameters.",
    "个人 API 不接受查询参数中的操作人、权限或上下文。",
  ],
  [
    "Không resolve được SKU của movement gốc.",
    "The original movement's SKU could not be resolved.",
    "无法确定原始库存流水的 SKU。",
  ],
  [
    "Không resolve được SKU linh kiện từ mã hộp.",
    "The component SKU could not be resolved from the box code.",
    "无法通过箱码确定配件 SKU。",
  ],
  [
    "Không resolve được item từ barcode/serial/physical code.",
    "The item could not be resolved from the barcode, serial number or physical code.",
    "无法通过条码、序列号或实物编码确定实物。",
  ],
  [
    "Không reverse trực tiếp movement điều chỉnh tồn kho; phải correction từ movement nghiệp vụ gốc.",
    "Do not directly reverse a REVERSAL movement; create a correction from the original business movement.",
    "请勿直接冲销 REVERSAL 流水；必须依据原始业务流水进行更正。",
  ],
  [
    "Không reverse trực tiếp movement REVERSAL; phải correction từ movement nghiệp vụ gốc.",
    "Do not directly reverse a REVERSAL movement; create a correction from the original business movement.",
    "请勿直接冲销 REVERSAL 流水；必须依据原始业务流水进行更正。",
  ],
  [
    "Không thay đổi đăng ký trong lượt TEST này.",
    "Do not change the registration during this TEST attempt.",
    "本次 TEST 测试中请勿更改登记。",
  ],
  [
    "Không thể ghi audit hoặc audit outbox; thao tác bị dừng để bảo toàn traceability.",
    "The audit record or audit outbox could not be written; the operation was stopped to preserve traceability.",
    "无法写入审计记录或审计发件箱；为保留可追溯性，操作已停止。",
  ],
  [
    "Không thể ghi toàn bộ batch scan; transaction sẽ rollback.",
    "The entire scan batch could not be saved; the transaction will be rolled back.",
    "无法保存完整扫描批次；事务将回滚。",
  ],
  [
    "Không thể gửi mã xác minh qua email lúc này. Vui lòng thử lại sau hoặc liên hệ quản trị viên.",
    "The verification code cannot be emailed right now. Please try again later or contact an administrator.",
    "目前无法通过邮件发送验证码。请稍后重试或联系管理员。",
  ],
  [
    "Không thể hoàn tất Idempotency snapshot cho đúng lease.",
    "The idempotency snapshot could not be finalized for the correct lease.",
    "无法为对应租约完成幂等快照。",
  ],
  [
    "Không thể thu hồi thiết bị có phiên hiện tại.",
    "The device with the current session cannot be revoked.",
    "无法撤销当前会话所在的设备。",
  ],
  [
    "Không thể tạo phiếu xuất từ batch local; toàn bộ transaction sẽ rollback.",
    "An outbound document could not be created from the local batch; the entire transaction will be rolled back.",
    "无法根据本地批次创建出库单；整个事务将回滚。",
  ],
  [
    "Không thể tắt đăng ký của phiên khác.",
    "You cannot disable another session's registration.",
    "不能停用其他会话的登记。",
  ],
  [
    "Không thể đính kèm tệp vào case đã hủy.",
    "Files cannot be attached to a cancelled warranty case.",
    "无法为已取消的保修工单添加附件。",
  ],
  [
    "Không thể đọc ảnh đã chọn.",
    "The selected image could not be read.",
    "无法读取所选图片。",
  ],
  [
    "Không thể đổi mã nơi nhận đã được dùng trên chứng từ.",
    "A recipient code that has been used on documents cannot be changed.",
    "已用于单据的收货方编码不能更改。",
  ],
  [
    "Không truy vấn được Import báo cáo để kiểm tra trùng lặp; từ chối import để không ghi trùng.",
    "The import report could not be queried for duplicates; the import was rejected to prevent duplicate records.",
    "无法查询导入报告以检查重复；已拒绝导入，以防止重复记录。",
  ],
  [
    "Không trộn lệnh canonical với protocol bản nháp/RECORD.",
    "Do not mix canonical commands with the draft/RECORD protocol.",
    "请勿混用标准命令与草稿／RECORD 协议。",
  ],
  [
    "Không tái dùng chip của lượt đã bị từ chối.",
    "Do not reuse the chip from a rejected attempt.",
    "请勿复用已被拒绝操作中的芯片。",
  ],
  [
    "Không tìm thấy BOX được gửi trong container_id.",
    "The BOX specified in container_id was not found.",
    "未找到 container_id 指定的 BOX 箱。",
  ],
  [
    "Không tìm thấy Component Issue line.",
    "The component-issue line was not found.",
    "未找到配件出库明细行。",
  ],
  [
    "Không tìm thấy Component Issue.",
    "The component issue was not found.",
    "未找到配件出库单。",
  ],
  [
    "Không tìm thấy Import báo cáo.",
    "The import report was not found.",
    "未找到导入报告。",
  ],
  ["Không tìm thấy Import.", "The import was not found.", "未找到导入记录。"],
  [
    "Không tìm thấy Kho tổng Hoa Nam Đang hoạt động.",
    "No ACTIVE Hoa Nam central warehouse was found.",
    "未找到已启用的 Hoa Nam 总仓库。",
  ],
  [
    "Không tìm thấy Kho tổng Hoa Nam ACTIVE.",
    "No ACTIVE Hoa Nam central warehouse was found.",
    "未找到已启用的 Hoa Nam 总仓库。",
  ],
  [
    "Không tìm thấy Nhãn đóng gói.",
    "The packing label was not found.",
    "未找到包装标签。",
  ],
  [
    "Không tìm thấy Packing Label.",
    "The packing label was not found.",
    "未找到包装标签。",
  ],
  [
    "Không tìm thấy SKU của dòng hàng.",
    "The SKU for this line was not found.",
    "未找到此明细行的 SKU。",
  ],
  [
    "Không tìm thấy SKU hoặc SKU đang ngừng hoạt động.",
    "The SKU was not found or is inactive.",
    "SKU 不存在或已停用。",
  ],
  [
    "Không tìm thấy SKU Đang hoạt động theo sku_code.",
    "No ACTIVE SKU was found for sku_code.",
    "未找到 sku_code 对应的已启用 SKU。",
  ],
  [
    "Không tìm thấy SKU ACTIVE theo sku_code.",
    "No ACTIVE SKU was found for sku_code.",
    "未找到 sku_code 对应的已启用 SKU。",
  ],
  [
    "Không tìm thấy SKU Đang hoạt động.",
    "No ACTIVE SKU was found.",
    "未找到已启用的 SKU。",
  ],
  [
    "Không tìm thấy SKU ACTIVE.",
    "No ACTIVE SKU was found.",
    "未找到已启用的 SKU。",
  ],
  ["Không tìm thấy SKU.", "The SKU was not found.", "未找到 SKU。"],
  [
    "Không tìm thấy active mapping.",
    "No active mapping was found.",
    "未找到有效关联。",
  ],
  [
    "Không tìm thấy balance.",
    "The stock balance was not found.",
    "未找到库存余额。",
  ],
  [
    "Không tìm thấy bản ghi lịch sử trong phạm vi được cấp.",
    "The history record was not found within your permitted scope.",
    "在您的授权范围内未找到历史记录。",
  ],
  [
    "Không tìm thấy bản nháp trong phiên hiện tại.",
    "The draft was not found in the current session.",
    "当前会话中未找到该草稿。",
  ],
  [
    "Không tìm thấy bản nháp trong phiên và kho hiện tại.",
    "The draft was not found in the current session and warehouse.",
    "当前会话及仓库中未找到该草稿。",
  ],
  [
    "Không tìm thấy bản nháp trong phiên, kho và nghiệp vụ hiện tại.",
    "The draft was not found in the current session, warehouse and operation.",
    "当前会话、仓库及业务中未找到该草稿。",
  ],
  [
    "Không tìm thấy bản nháp trong phạm vi owner hiện tại.",
    "The draft was not found within the current owner's scope.",
    "在当前归属方范围内未找到该草稿。",
  ],
  [
    "Không tìm thấy bệnh/lỗi Đang hoạt động.",
    "No ACTIVE defect was found.",
    "未找到已启用的故障。",
  ],
  [
    "Không tìm thấy bệnh/lỗi ACTIVE.",
    "No ACTIVE defect was found.",
    "未找到已启用的故障。",
  ],
  [
    "Không tìm thấy ca bảo hành.",
    "The warranty case was not found.",
    "未找到保修工单。",
  ],
  ["Không tìm thấy ca.", "The shift was not found.", "未找到班次。"],
  [
    "Không tìm thấy carton được gửi trong container_id.",
    "The carton specified in container_id was not found.",
    "未找到 container_id 指定的纸箱。",
  ],
  ["Không tìm thấy carton.", "The carton was not found.", "未找到纸箱。"],
  [
    "Không tìm thấy catalog master.",
    "The catalog master record was not found.",
    "未找到目录主数据记录。",
  ],
  [
    "Không tìm thấy checkpoint P19 trong actor, phiên, kho và hồ sơ hiện tại.",
    "The P19 checkpoint was not found for the current actor, session, warehouse and record.",
    "未找到当前操作人、会话、仓库及记录对应的 P19 检查点。",
  ],
  [
    "Không tìm thấy chip NFC.",
    "The NFC chip was not found.",
    "未找到 NFC 芯片。",
  ],
  [
    "Không tìm thấy chip trong phạm vi kho.",
    "The chip was not found within the warehouse scope.",
    "在仓库范围内未找到芯片。",
  ],
  [
    "Không tìm thấy chứng từ hoàn trả/điều chỉnh.",
    "The return/adjustment document was not found.",
    "未找到退货／调整单据。",
  ],
  [
    "Không tìm thấy chứng từ nhập kho trong phạm vi hiện tại.",
    "The inbound document was not found within the current scope.",
    "当前范围内未找到入库单。",
  ],
  [
    "Không tìm thấy chứng từ nhập kho.",
    "The inbound document was not found.",
    "未找到入库单。",
  ],
  [
    "Không tìm thấy chứng từ đính kèm.",
    "The attached document was not found.",
    "未找到附件单据。",
  ],
  ["Không tìm thấy chứng từ.", "The document was not found.", "未找到单据。"],
  ["Không tìm thấy container.", "The container was not found.", "未找到容器。"],
  [
    "Không tìm thấy danh mục lỗi.",
    "The defect catalog was not found.",
    "未找到故障目录。",
  ],
  [
    "Không tìm thấy dòng chứng từ.",
    "The document line was not found.",
    "未找到单据明细行。",
  ],
  [
    "Không tìm thấy dòng hàng trong phiếu nhập.",
    "The item line was not found in the inbound document.",
    "入库单中未找到该商品明细行。",
  ],
  [
    "Không tìm thấy dòng nhập kho.",
    "The inbound line was not found.",
    "未找到入库明细行。",
  ],
  [
    "Không tìm thấy dòng phiếu tương ứng SKU vừa quét.",
    "No document line matches the SKU just scanned.",
    "未找到与刚扫描的 SKU 对应的单据明细行。",
  ],
  [
    "Không tìm thấy dòng quét đang hiệu lực khớp yêu cầu trong phiếu này.",
    "No active scan line in this document matches the request.",
    "此单据中没有与请求匹配的有效扫描明细行。",
  ],
  [
    "Không tìm thấy dòng điều chuyển.",
    "The transfer line was not found.",
    "未找到调拨明细行。",
  ],
  [
    "Không tìm thấy dòng đã quét.",
    "The scanned line was not found.",
    "未找到已扫描的明细行。",
  ],
  ["Không tìm thấy dữ liệu", "No data was found.", "未找到数据。"],
  [
    "Không tìm thấy dữ liệu App PV.",
    "The PV application data was not found.",
    "未找到 PV 应用数据。",
  ],
  [
    "Không tìm thấy export job.",
    "The export job was not found.",
    "未找到导出任务。",
  ],
  [
    "Không tìm thấy file export (job chưa sẵn sàng hoặc không tồn tại).",
    "The export file was not found; the job may not be ready or may not exist.",
    "未找到导出文件；任务可能尚未就绪或不存在。",
  ],
  [
    "Không tìm thấy file import.",
    "The import file was not found.",
    "未找到导入文件。",
  ],
  [
    "Không tìm thấy file lỗi (có thể đã bị dọn dẹp).",
    "The error file was not found; it may have been removed.",
    "未找到错误文件；文件可能已被清理。",
  ],
  [
    "Không tìm thấy hiện vật khớp mã vừa quét; chưa ghi nhận gì.",
    "No item matches the scanned code; nothing has been recorded.",
    "未找到与扫描编码匹配的实物；尚未记录任何内容。",
  ],
  [
    "Không tìm thấy hiện vật trong kho.",
    "The item was not found in the warehouse.",
    "仓库中未找到该实物。",
  ],
  [
    "Không tìm thấy hiện vật trong phạm vi kho.",
    "The item was not found within the warehouse scope.",
    "在仓库范围内未找到该实物。",
  ],
  ["Không tìm thấy hiện vật.", "The item was not found.", "未找到实物。"],
  [
    "Không tìm thấy hồ sơ App PV.",
    "The PV application record was not found.",
    "未找到 PV 应用记录。",
  ],
  [
    "Không tìm thấy hồ sơ bảo hành trong kho.",
    "The warranty case was not found in the warehouse.",
    "仓库中未找到该保修工单。",
  ],
  [
    "Không tìm thấy hồ sơ bảo hành.",
    "The warranty case was not found.",
    "未找到保修工单。",
  ],
  [
    "Không tìm thấy hồ sơ trong kho đã lọc.",
    "The record was not found in the filtered warehouse.",
    "筛选的仓库中未找到该记录。",
  ],
  [
    "Không tìm thấy hộp trong nguồn được phép đọc.",
    "The box was not found in a source you may read.",
    "在您有权读取的来源中未找到该箱。",
  ],
  [
    "Không tìm thấy hộp vừa đăng ký trong atomic record.",
    "The newly registered box was not found in the atomic record.",
    "原子记录中未找到刚登记的箱。",
  ],
  [
    "Không tìm thấy item instance.",
    "The item instance was not found.",
    "未找到实物实例。",
  ],
  [
    "Không tìm thấy item match.",
    "The item match was not found.",
    "未找到实物匹配记录。",
  ],
  [
    "Không tìm thấy item physical code.",
    "The item's physical code was not found.",
    "未找到实物编码。",
  ],
  [
    "Không tìm thấy item điều chỉnh tồn kho.",
    "The inventory-reversal item was not found.",
    "未找到库存冲销实物。",
  ],
  [
    "Không tìm thấy item reversal.",
    "The inventory-reversal item was not found.",
    "未找到库存冲销实物。",
  ],
  ["Không tìm thấy item.", "The item was not found.", "未找到实物。"],
  ["Không tìm thấy item_id.", "The item_id was not found.", "未找到 item_id。"],
  [
    "Không tìm thấy kho được yêu cầu.",
    "The requested warehouse was not found.",
    "未找到请求的仓库。",
  ],
  ["Không tìm thấy kho.", "The warehouse was not found.", "未找到仓库。"],
  [
    "Không tìm thấy label snapshot.",
    "The label snapshot was not found.",
    "未找到标签快照。",
  ],
  [
    "Không tìm thấy line trong phiếu nhập.",
    "The line was not found in the inbound document.",
    "入库单中未找到该明细行。",
  ],
  [
    "Không tìm thấy line trong phiếu xuất.",
    "The line was not found in the outbound document.",
    "出库单中未找到该明细行。",
  ],
  [
    "Không tìm thấy lô nhập khẩu.",
    "The import batch was not found.",
    "未找到导入批次。",
  ],
  [
    "Không tìm thấy mapping item trong container.",
    "The item's container mapping was not found.",
    "未找到实物与容器的关联。",
  ],
  [
    "Không tìm thấy mã scan trong phạm vi được phép.",
    "The scan code was not found within your permitted scope.",
    "在您的授权范围内未找到扫描编码。",
  ],
  [
    "Không tìm thấy mã scan.",
    "The scan code was not found.",
    "未找到扫描编码。",
  ],
  [
    "Không tìm thấy mã đã quét.",
    "The scanned code was not found.",
    "未找到已扫描的编码。",
  ],
  [
    "Không tìm thấy một hoặc nhiều bệnh/lỗi Đang hoạt động.",
    "One or more ACTIVE defects were not found.",
    "未找到一个或多个已启用的故障。",
  ],
  [
    "Không tìm thấy một hoặc nhiều bệnh/lỗi ACTIVE.",
    "One or more ACTIVE defects were not found.",
    "未找到一个或多个已启用的故障。",
  ],
  ["Không tìm thấy người dùng.", "The user was not found.", "未找到用户。"],
  [
    "Không tìm thấy nhà cung cấp.",
    "The supplier was not found.",
    "未找到供应商。",
  ],
  [
    "Không tìm thấy parent trong kho.",
    "The parent record was not found in the warehouse.",
    "仓库中未找到父记录。",
  ],
  [
    "Không tìm thấy parent upload.",
    "The parent upload record was not found.",
    "未找到上传父记录。",
  ],
  [
    "Không tìm thấy permission.",
    "The permission was not found.",
    "未找到该权限。",
  ],
  [
    "Không tìm thấy phiên quét trong phạm vi kho.",
    "The scanning session was not found within the warehouse scope.",
    "在仓库范围内未找到扫描会话。",
  ],
  [
    "Không tìm thấy phiên đăng nhập.",
    "The login session was not found.",
    "未找到登录会话。",
  ],
  [
    "Không tìm thấy phiếu nguồn của bằng chứng quét.",
    "The source document for the scan evidence was not found.",
    "未找到扫描凭证对应的来源单据。",
  ],
  [
    "Không tìm thấy phiếu nguồn của chứng từ.",
    "The document's source document was not found.",
    "未找到此单据对应的来源单据。",
  ],
  [
    "Không tìm thấy phiếu nguồn trong kho hiện tại.",
    "The source document was not found in the current warehouse.",
    "当前仓库中未找到来源单据。",
  ],
  [
    "Không tìm thấy phiếu nguồn trong kho yêu cầu.",
    "The source document was not found in the requested warehouse.",
    "请求的仓库中未找到来源单据。",
  ],
  [
    "Không tìm thấy phiếu nguồn trong phạm vi hiện tại.",
    "The source document was not found within the current scope.",
    "当前范围内未找到来源单据。",
  ],
  [
    "Không tìm thấy phiếu nguồn.",
    "The source document was not found.",
    "未找到来源单据。",
  ],
  [
    "Không tìm thấy phiếu nhập.",
    "The inbound document was not found.",
    "未找到入库单。",
  ],
  [
    "Không tìm thấy phiếu trong kho.",
    "The document was not found in the warehouse.",
    "仓库中未找到该单据。",
  ],
  [
    "Không tìm thấy phiếu xuất linh kiện trong kho.",
    "The component-issue document was not found in the warehouse.",
    "仓库中未找到配件出库单。",
  ],
  [
    "Không tìm thấy phiếu xuất linh kiện.",
    "The component-issue document was not found.",
    "未找到配件出库单。",
  ],
  [
    "Không tìm thấy phiếu xuất trong phạm vi hiện tại.",
    "The outbound document was not found within the current scope.",
    "当前范围内未找到出库单。",
  ],
  [
    "Không tìm thấy phiếu xuất.",
    "The outbound document was not found.",
    "未找到出库单。",
  ],
  [
    "Không tìm thấy physical code.",
    "The physical code was not found.",
    "未找到实物编码。",
  ],
  [
    "Không tìm thấy phòng ban.",
    "The department was not found.",
    "未找到部门。",
  ],
  [
    "Không tìm thấy placement trong phạm vi kho.",
    "The placement was not found within the warehouse scope.",
    "在仓库范围内未找到库位放置记录。",
  ],
  [
    "Không tìm thấy printer config.",
    "The printer configuration was not found.",
    "未找到打印机配置。",
  ],
  [
    "Không tìm thấy product master.",
    "The product master record was not found.",
    "未找到产品主数据记录。",
  ],
  [
    "Không tìm thấy refresh token hợp lệ cho phiên này.",
    "No valid refresh token was found for this session.",
    "未找到此会话的有效刷新令牌。",
  ],
  ["Không tìm thấy role.", "The role was not found.", "未找到角色。"],
  [
    "Không tìm thấy rule gợi ý App PV.",
    "The PV application suggestion rule was not found.",
    "未找到 PV 应用推荐规则。",
  ],
  [
    "Không tìm thấy scan entry vừa tạo trong atomic record.",
    "The scan entry just created was not found in the atomic record.",
    "原子记录中未找到刚创建的扫描条目。",
  ],
  [
    "Không tìm thấy snapshot nhãn.",
    "The label snapshot was not found.",
    "未找到标签快照。",
  ],
  ["Không tìm thấy sản phẩm.", "The product was not found.", "未找到产品。"],
  [
    "Không tìm thấy sự kiện trong phạm vi lịch sử.",
    "The event was not found within the history scope.",
    "在历史范围内未找到该事件。",
  ],
  [
    "Không tìm thấy thiết bị tin cậy.",
    "The trusted device was not found.",
    "未找到受信任设备。",
  ],
  ["Không tìm thấy thiết bị.", "The device was not found.", "未找到设备。"],
  [
    "Không tìm thấy thông báo.",
    "The notification was not found.",
    "未找到通知。",
  ],
  [
    "Không tìm thấy toa yêu cầu xuất.",
    "The outbound request was not found.",
    "未找到出库申请单。",
  ],
  [
    "Không tìm thấy transition.",
    "The transition was not found.",
    "未找到状态流转记录。",
  ],
  [
    "Không tìm thấy tác vụ putaway.",
    "The putaway task was not found.",
    "未找到上架任务。",
  ],
  [
    "Không tìm thấy tệp chứng từ trên storage.",
    "The document file was not found in storage.",
    "存储中未找到单据文件。",
  ],
  [
    "Không tìm thấy tệp đính kèm trên storage.",
    "The attachment file was not found in storage.",
    "存储中未找到附件文件。",
  ],
  [
    "Không tìm thấy tệp đính kèm.",
    "The attachment was not found.",
    "未找到附件。",
  ],
  ["Không tìm thấy tệp.", "The file was not found.", "未找到文件。"],
  [
    "Không tìm thấy yêu cầu có thể đọc.",
    "No readable request was found.",
    "未找到可读取的请求。",
  ],
  ["Không tìm thấy yêu cầu.", "The request was not found.", "未找到请求。"],
  [
    "Không tìm thấy đúng hiện vật trong phạm vi được phép.",
    "The exact item was not found within your permitted scope.",
    "在您的授权范围内未找到对应实物。",
  ],
  ["Không tìm thấy đại lý.", "The agency was not found.", "未找到代理商。"],
  [
    "Không tìm thấy đối tượng nhận hàng.",
    "The goods recipient was not found.",
    "未找到收货方。",
  ],
  [
    "Không tìm thấy đối tượng trong phạm vi đọc hiện tại.",
    "The object was not found within the current read scope.",
    "在当前读取范围内未找到该对象。",
  ],
  [
    "Không tính được SHA-256 của file import.",
    "The import file's SHA-256 checksum could not be calculated.",
    "无法计算导入文件的 SHA-256 校验值。",
  ],
  [
    "Không tạo được file template. Vui lòng thử lại.",
    "The template file could not be created. Please try again.",
    "无法创建模板文件。请重试。",
  ],
  [
    "Không tạo được phiếu xuất linh kiện từ danh sách quét; toàn bộ transaction sẽ rollback.",
    "A component issue could not be created from the scan list; the entire transaction will be rolled back.",
    "无法根据扫描列表创建配件出库单；整个事务将回滚。",
  ],
  [
    "Không xác minh được cùng tenant/tổ chức với kho.",
    "The warehouse's tenant/organization could not be verified as the same.",
    "无法确认与仓库属于同一租户／组织。",
  ],
  [
    "Không xác minh được cùng tổ chức với kho.",
    "The warehouse's organization could not be verified as the same.",
    "无法确认与仓库属于同一组织。",
  ],
  [
    "Không xác minh được cùng tổ chức.",
    "The organization could not be verified as the same.",
    "无法确认属于同一组织。",
  ],
  [
    "Không xác minh được duy nhất chủ quản của bản ghi lịch sử.",
    "A unique owner for the history record could not be verified.",
    "无法确认历史记录的唯一归属方。",
  ],
  [
    "Không xác minh được identity phiếu cho timeline.",
    "The document identity for the timeline could not be verified.",
    "无法验证时间线对应的单据标识。",
  ],
  [
    "Không xác minh được kết quả Post; toàn bộ giao dịch được hoàn tác.",
    "The posting result could not be verified; the entire transaction was rolled back.",
    "无法验证过账结果；整个事务已回滚。",
  ],
  [
    "Không xác minh được kết quả từ owner.",
    "The result from the owning service could not be verified.",
    "无法验证归属服务返回的结果。",
  ],
  [
    "Không xác minh được phạm vi tổ chức.",
    "The organization scope could not be verified.",
    "无法验证组织范围。",
  ],
  [
    "Không xác minh được thiết bị gửi thử.",
    "The test-send device could not be verified.",
    "无法验证测试发送设备。",
  ],
  [
    "Không xác minh được thiết bị này.",
    "This device could not be verified.",
    "无法验证此设备。",
  ],
  [
    "Không xác minh được tổ chức/kho.",
    "The organization/warehouse could not be verified.",
    "无法验证组织／仓库。",
  ],
  [
    "Không xác định được duy nhất hiện vật trong phạm vi kho.",
    "A unique item could not be identified within the warehouse scope.",
    "在仓库范围内无法唯一确定实物。",
  ],
  [
    "Không xác định được hiện vật từ mã.",
    "The item could not be identified from the code.",
    "无法通过编码确定实物。",
  ],
  [
    "Không xác định được owner upload.",
    "The upload owner could not be identified.",
    "无法确定上传记录的归属方。",
  ],
  [
    "Không được giải phóng giữ chỗ của phiên khác.",
    "You cannot release another session's reservation.",
    "不能释放其他会话的预留。",
  ],
  [
    "Không được phép tự thay đổi vai trò của chính mình. Vui lòng nhờ một quản trị viên khác thực hiện.",
    "You cannot change your own role. Please ask another administrator to do this.",
    "不能更改自己的角色。请由其他管理员执行此操作。",
  ],
  [
    "Không được thay đổi kho sở hữu bằng thao tác cập nhật hồ sơ.",
    "The owning warehouse cannot be changed by updating the record.",
    "不能通过更新记录更改所属仓库。",
  ],
  [
    "Không được đổi sku_code/tracking mode sau khi SKU đã có stock hoặc movement.",
    "The sku_code or tracking mode cannot be changed after the SKU has stock or inventory movements.",
    "SKU 已有库存或库存流水后，不能更改 sku_code 或追踪模式。",
  ],
  [
    "Không đọc được biên nhận trong phạm vi hiện tại.",
    "The receipt could not be read within the current scope.",
    "在当前范围内无法读取回执。",
  ],
  [
    "Không đọc được biên nhận trong phạm vi tổ chức hiện tại.",
    "The receipt could not be read within the current organization scope.",
    "在当前组织范围内无法读取回执。",
  ],
  [
    "Không đọc được nội dung tệp tải lên.",
    "The uploaded file's contents could not be read.",
    "无法读取上传文件的内容。",
  ],
  [
    "Không đọc được thời lượng video; tệp có thể hỏng hoặc không đúng định dạng.",
    "The video duration could not be read; the file may be corrupt or in an invalid format.",
    "无法读取视频时长；文件可能已损坏或格式不正确。",
  ],
  [
    "Không đối chiếu được receipt bắt đầu ca.",
    "The shift-start receipt could not be reconciled.",
    "无法核对开始班次的回执。",
  ],
  [
    "Không đổi key để lặp lại tệp/ý định đang chưa rõ kết quả; đối chiếu yêu cầu gốc.",
    "Do not change the key to repeat a file or intent whose outcome is unknown; reconcile the original request.",
    "请勿更改键值以重复结果未知的文件或操作意图；请核对原始请求。",
  ],
  [
    "Không đổi nháp đã giữ PX sang phiếu nguồn Web.",
    "A draft with a reserved PX number cannot be switched to a web source document.",
    "已预留 PX 编号的草稿不能改为网页来源单据。",
  ],
  [
    "Không đủ quyền tệp của owner.",
    "The owning service's file permissions are insufficient.",
    "归属服务的文件权限不足。",
  ],
  [
    "Không đủ quyền đọc dữ liệu yêu cầu.",
    "You do not have sufficient permission to read the requested data.",
    "您没有读取所请求数据的足够权限。",
  ],
  [
    "Không đủ quyền đọc hoặc ghi nhận phiếu xuất.",
    "You do not have sufficient permission to read or post the outbound document.",
    "您没有读取或过账出库单的足够权限。",
  ],
  [
    "Không đủ tồn cho stock effect.",
    "There is insufficient stock for this inventory effect.",
    "库存不足，无法执行此次库存变动。",
  ],
  [
    "Không đủ tồn khả dụng để scan outbound.",
    "There is insufficient available stock for outbound scanning.",
    "可用库存不足，无法执行出库扫描。",
  ],
  [
    "Kiểm tra kết quả chỉ nhận operation và kho, không nhận body.",
    "Outcome checks accept only the operation and warehouse, not a request body.",
    "结果核查仅接受操作和仓库参数，不接受请求正文。",
  ],
  [
    "Kiểm tra lại các mã và số lượng trước khi ghi nhận.",
    "Check the codes and quantities again before posting.",
    "过账前请再次核对编码和数量。",
  ],
  [
    "Kiểm tra thử import hoàn tất, không có dữ liệu nào được ghi.",
    "The import dry run is complete; no data was written.",
    "导入试运行已完成，未写入任何数据。",
  ],
  [
    "Kiểm tra thử import hoàn tất; phát hiện lỗi, không có SKU nào được tạo hoặc cập nhật.",
    "The import dry run is complete and errors were found; no SKUs were created or updated.",
    "导入试运行已完成并发现错误；未创建或更新任何 SKU。",
  ],
  [
    "Kiểm tra thử import hoàn tất; phát hiện lỗi, không có gì được tạo.",
    "The import dry run is complete and errors were found; nothing was created.",
    "导入试运行已完成并发现错误；未创建任何记录。",
  ],
  [
    "Kiểu lưu thời gian chưa có contract đọc được xác nhận.",
    "The timestamp storage type has no confirmed read contract.",
    "时间存储类型尚无已确认的读取约定。",
  ],
  [
    "Kiểu thời gian lịch sử chưa có contract; không suy diễn offset.",
    "The history timestamp type has no defined contract; do not infer a time offset.",
    "历史时间类型尚无明确约定；请勿推断时差。",
  ],
  [
    "Kiểu thời gian nguồn không được hỗ trợ; không suy diễn offset.",
    "The source timestamp type is unsupported; do not infer a time offset.",
    "不支持此来源时间类型；请勿推断时差。",
  ],
  [
    "Kênh hỗ trợ khôi phục chưa khả dụng.",
    "The recovery support channel is unavailable.",
    "恢复支持渠道当前不可用。",
  ],
  [
    "Kênh trả refresh token qua body không được bật cho client này. Trình duyệt dùng cookie HttpOnly.",
    "Returning refresh tokens in the response body is not enabled for this client. Browsers use HttpOnly cookies.",
    "此客户端未启用通过响应正文返回刷新令牌。浏览器使用 HttpOnly Cookie。",
  ],
  [
    "Kết quả không khớp phiếu và hồ sơ của lệnh.",
    "The result does not match the command's document and record.",
    "结果与命令对应的单据及记录不匹配。",
  ],
  [
    "Kết quả không thuộc phiên/kho/hiện vật hiện tại hoặc là receipt cũ chưa đủ dữ liệu đối chiếu.",
    "The result does not belong to the current session, warehouse or item, or it is an old receipt with insufficient reconciliation data.",
    "结果不属于当前会话、仓库或实物，或者为缺少核对数据的旧回执。",
  ],
  [
    "Kết quả owner không khớp trạng thái tệp.",
    "The owning service's result does not match the file status.",
    "归属服务的结果与文件状态不匹配。",
  ],
  [
    "LOST/DAMAGED/Ngừng hoạt động bắt buộc deactivation_reason.",
    "LOST/DAMAGED/INACTIVE requires deactivation_reason.",
    "LOST／DAMAGED／INACTIVE 状态必须提供 deactivation_reason。",
  ],
  [
    "LOST/DAMAGED/INACTIVE bắt buộc deactivation_reason.",
    "LOST/DAMAGED/INACTIVE requires deactivation_reason.",
    "LOST／DAMAGED／INACTIVE 状态必须提供 deactivation_reason。",
  ],
  ["Label printed.", "Label printed.", "标签已打印。"],
  ["Label reprinted.", "Label reprinted.", "标签已重新打印。"],
  [
    "Line phải là Linh kiện Đang hoạt động.",
    "The line must be an ACTIVE COMPONENT.",
    "明细行必须为已启用的配件。",
  ],
  [
    "Line phải là COMPONENT ACTIVE.",
    "The line must be an ACTIVE COMPONENT.",
    "明细行必须为已启用的配件。",
  ],
  [
    "Linh kiện SKU chỉ được xuất qua Component Issue liên kết warranty case active.",
    "A COMPONENT SKU may only be issued through a component issue linked to an active warranty case.",
    "配件 SKU 只能通过关联有效保修工单的配件出库单出库。",
  ],
  [
    "COMPONENT SKU chỉ được xuất qua Component Issue liên kết warranty case active.",
    "A COMPONENT SKU may only be issued through a component issue linked to an active warranty case.",
    "配件 SKU 只能通过关联有效保修工单的配件出库单出库。",
  ],
  [
    "Linh kiện serial-tracked phải xuất từng item_id, không được xuất số lượng bằng BOX.",
    "Serial-tracked COMPONENT items must be issued individually by item_id; quantity-based BOX issues are not allowed.",
    "按序列号追踪的配件必须通过 item_id 逐件出库，不允许按 BOX 箱的数量出库。",
  ],
  [
    "COMPONENT serial-tracked phải xuất từng item_id, không được xuất quantity bằng BOX.",
    "Serial-tracked COMPONENT items must be issued individually by item_id; quantity-based BOX issues are not allowed.",
    "按序列号追踪的配件必须通过 item_id 逐件出库，不允许按 BOX 箱的数量出库。",
  ],
  [
    "Loại SKU phải là Sản phẩm hoặc Linh kiện.",
    "The SKU type must be PRODUCT or COMPONENT.",
    "SKU 类型必须为产品或配件。",
  ],
  [
    "Loại SKU phải là PRODUCT hoặc COMPONENT.",
    "The SKU type must be PRODUCT or COMPONENT.",
    "SKU 类型必须为产品或配件。",
  ],
  [
    "Luồng Mini App outbound local-staging chỉ nhận Sản phẩm.",
    "The Mini App's local outbound staging flow only accepts PRODUCT items.",
    "小程序的本地出库暂存流程仅接受产品。",
  ],
  [
    "Luồng Mini App outbound local-staging chỉ nhận PRODUCT.",
    "The Mini App's local outbound staging flow only accepts PRODUCT items.",
    "小程序的本地出库暂存流程仅接受产品。",
  ],
  [
    "Luồng lệnh này chưa được mở; yêu cầu đã gửi vẫn có thể kiểm tra bằng GET.",
    "This command flow is not enabled yet; requests already sent can still be checked with GET.",
    "尚未启用此命令流程；已发送的请求仍可通过 GET 核查。",
  ],
  [
    "Luồng nhập hiện hành không nhập SKU/số lượng dự kiến. Hãy tạo đầu phiếu rồi quét hàng thực tế.",
    "The current inbound flow does not accept planned SKUs or quantities. Create the document header, then scan the actual goods.",
    "当前入库流程不填写预计 SKU 或数量。请先创建单据表头，再扫描实际货物。",
  ],
  [
    "Luồng nhập hiện tại chỉ hỗ trợ kho canonical đã cấu hình.",
    "The current inbound flow only supports the configured canonical warehouse.",
    "当前入库流程仅支持已配置的标准仓库。",
  ],
  [
    "Luồng nhập kho MVP chỉ dùng Kho tổng Hoa Nam.",
    "The MVP inbound flow only uses the Hoa Nam central warehouse.",
    "MVP 入库流程仅使用 Hoa Nam 总仓库。",
  ],
  [
    "Lý do từ chối không được để trống.",
    "The rejection reason cannot be empty.",
    "拒绝原因不能为空。",
  ],
  [
    "Lưu metadata P04 trước khi kiểm tra hoặc ghi nhận nháp này.",
    "Save the P04 metadata before checking or posting this draft.",
    "核查或过账此草稿前，请先保存 P04 元数据。",
  ],
  [
    "Lưu snapshot P19 vào bản nháp trước khi xác nhận xuất.",
    "Save the P19 snapshot to the draft before confirming the issue.",
    "确认出库前，请先将 P19 快照保存到草稿。",
  ],
  [
    "Lưu và đối chiếu các yêu cầu đang chờ tại đúng nghiệp vụ trước khi kết thúc ca.",
    "Save and reconcile pending requests in the correct operation before ending the shift.",
    "结束班次前，请在对应业务中保存并核对待处理请求。",
  ],
  [
    "Lưu đúng phiếu nguồn và phiên bản vào bản nháp trước khi ghi nhận.",
    "Save the correct source document and version to the draft before posting.",
    "过账前，请将正确的来源单据及版本保存到草稿。",
  ],
  [
    "Lượt TEST đã có yêu cầu. Chỉ GET đối chiếu key gốc.",
    "This TEST attempt already has a request. Use GET only to reconcile the original key.",
    "本次 TEST 测试已有请求。仅可通过 GET 核对原始键值。",
  ],
  [
    "Lượt cũ chưa rõ kết quả; không tiếp quản lease để ghi lại.",
    "The previous attempt's outcome is unknown; do not take over the lease to write again.",
    "上次操作的结果未知；请勿接管租约重新写入。",
  ],
  [
    "Lượt phục hồi chưa có receipt cuối; chỉ đối chiếu, không takeover.",
    "The recovery attempt has no final receipt; reconcile only, without taking over.",
    "恢复操作尚无最终回执；仅可核对，不可接管。",
  ],
  [
    "Lượt xác nhận bị từ chối trước khi ghi mapping vì SKU không Đang hoạt động. Đối chiếu để phục hồi; không gửi lại key cũ.",
    "Confirmation was rejected before the mapping was written because the SKU is not ACTIVE. Reconcile to recover; do not resend the old key.",
    "SKU 未启用，因此确认操作在写入关联前被拒绝。请核对以恢复；勿重新发送旧键值。",
  ],
  [
    "Lượt xác nhận bị từ chối trước khi ghi mapping vì SKU không ACTIVE. Đối chiếu để phục hồi; không gửi lại key cũ.",
    "Confirmation was rejected before the mapping was written because the SKU is not ACTIVE. Reconcile to recover; do not resend the old key.",
    "SKU 未启用，因此确认操作在写入关联前被拒绝。请核对以恢复；勿重新发送旧键值。",
  ],
  [
    "Lệnh nhận JSON body, không nhận query.",
    "This command accepts a JSON body, not query parameters.",
    "此命令接受 JSON 正文，不接受查询参数。",
  ],
  [
    "Lịch sử putaway đã xác nhận.",
    "Putaway history confirmed.",
    "上架历史已确认。",
  ],
  [
    "MVP yêu cầu chính xác một kho Hoa Nam Đang hoạt động trước khi consume toa xuất.",
    "MVP requires exactly one ACTIVE Hoa Nam warehouse before consuming the outbound request.",
    "处理出库申请前，MVP 必须且只能有一个已启用的 Hoa Nam 仓库。",
  ],
  [
    "MVP yêu cầu chính xác một kho Hoa Nam ACTIVE trước khi consume toa xuất.",
    "MVP requires exactly one ACTIVE Hoa Nam warehouse before consuming the outbound request.",
    "处理出库申请前，MVP 必须且只能有一个已启用的 Hoa Nam 仓库。",
  ],
  [
    "MVP yêu cầu chính xác một kho Hoa Nam Đang hoạt động trước khi tạo phiếu xuất.",
    "MVP requires exactly one ACTIVE Hoa Nam warehouse before creating an outbound document.",
    "创建出库单前，MVP 必须且只能有一个已启用的 Hoa Nam 仓库。",
  ],
  [
    "MVP yêu cầu chính xác một kho Hoa Nam ACTIVE trước khi tạo phiếu xuất.",
    "MVP requires exactly one ACTIVE Hoa Nam warehouse before creating an outbound document.",
    "创建出库单前，MVP 必须且只能有一个已启用的 Hoa Nam 仓库。",
  ],
  [
    "MVP yêu cầu chính xác một kho Hoa Nam Đang hoạt động.",
    "MVP requires exactly one ACTIVE Hoa Nam warehouse.",
    "MVP 必须且只能有一个已启用的 Hoa Nam 仓库。",
  ],
  [
    "MVP yêu cầu chính xác một kho Hoa Nam ACTIVE.",
    "MVP requires exactly one ACTIVE Hoa Nam warehouse.",
    "MVP 必须且只能有一个已启用的 Hoa Nam 仓库。",
  ],
  [
    "Master của hiện vật không nằm trong phạm vi đọc.",
    "The item's master record is outside your read scope.",
    "实物对应的主数据超出您的读取范围。",
  ],
  [
    "Match không thuộc phiếu xuất này.",
    "The match does not belong to this outbound document.",
    "该匹配记录不属于此出库单。",
  ],
  [
    "Missing source timezone",
    "The source timezone is missing.",
    "缺少来源时区。",
  ],
  [
    "Movement không khớp dòng/số lượng/kho; giao dịch được hoàn tác.",
    "The inventory movement does not match the line, quantity or warehouse; the transaction was rolled back.",
    "库存流水与明细行、数量或仓库不匹配；事务已回滚。",
  ],
  [
    "Movement không liên kết chứng từ gốc.",
    "The inventory movement is not linked to the original document.",
    "库存流水未关联原始单据。",
  ],
  [
    "Movement số lượng không hợp lệ để điều chỉnh tồn kho.",
    "The inventory movement's quantity is invalid for reversal.",
    "库存流水数量无效，无法冲销。",
  ],
  [
    "Movement quantity không hợp lệ để reversal.",
    "The inventory movement's quantity is invalid for reversal.",
    "库存流水数量无效，无法冲销。",
  ],
  [
    "Movement đã bị điều chỉnh tồn kho bởi request cạnh tranh; reload reversible_qty.",
    "A concurrent request has already reversed this movement; reload reversible_qty.",
    "该库存流水已被并发请求冲销；请重新加载 reversible_qty。",
  ],
  [
    "Movement đã bị reversal bởi request cạnh tranh; reload reversible_qty.",
    "A concurrent request has already reversed this movement; reload reversible_qty.",
    "该库存流水已被并发请求冲销；请重新加载 reversible_qty。",
  ],
  [
    "Mã Sản phẩm dạng cũ đã bị tắt; hàng mới phải dùng QR composite chứa SKU + item unique.",
    "Legacy PRODUCT codes are disabled; new items must use a composite QR code containing the SKU and a unique item identity.",
    "旧式产品编码已停用；新货物必须使用包含 SKU 和唯一实物标识的组合二维码。",
  ],
  [
    "Mã PRODUCT dạng cũ đã bị tắt; hàng mới phải dùng QR composite chứa SKU + item unique.",
    "Legacy PRODUCT codes are disabled; new items must use a composite QR code containing the SKU and a unique item identity.",
    "旧式产品编码已停用；新货物必须使用包含 SKU 和唯一实物标识的组合二维码。",
  ],
  [
    "Mã chip sau chuẩn hóa phải có từ 1 đến 100 ký tự.",
    "The normalized chip code must contain between 1 and 100 characters.",
    "规范化后的芯片编码必须为 1 至 100 个字符。",
  ],
  [
    "Mã dán trên từng linh kiện chỉ nhận số lượng = 1.",
    "A code attached to an individual component only accepts a quantity of 1.",
    "单个配件上的编码仅允许数量为 1。",
  ],
  [
    "Mã hộp linh kiện phải kèm số lượng (số lượng đếm tay trong hộp).",
    "A component box code requires a quantity, counted manually from the box.",
    "配件箱码必须附带数量，即箱内人工清点的数量。",
  ],
  [
    "Mã hộp linh kiện phải kèm quantity (số lượng đếm tay trong hộp).",
    "A component box code requires a quantity, counted manually from the box.",
    "配件箱码必须附带数量，即箱内人工清点的数量。",
  ],
  [
    "Mã hộp phải kèm số lượng linh kiện cần xuất.",
    "A box code requires the quantity of components to issue.",
    "箱码必须附带需要出库的配件数量。",
  ],
  [
    "Mã hộp trỏ tới SKU không phải Linh kiện.",
    "The box code points to a SKU that is not COMPONENT.",
    "箱码对应的 SKU 不是配件类型。",
  ],
  [
    "Mã hộp trỏ tới SKU không phải COMPONENT.",
    "The box code points to a SKU that is not COMPONENT.",
    "箱码对应的 SKU 不是配件类型。",
  ],
  [
    "Mã hộp trỏ tới SKU không phải linh kiện (Linh kiện).",
    "The box code points to a SKU that is not a component (COMPONENT).",
    "箱码对应的 SKU 不是配件类型。",
  ],
  [
    "Mã hộp trỏ tới SKU không phải linh kiện (COMPONENT).",
    "The box code points to a SKU that is not a component (COMPONENT).",
    "箱码对应的 SKU 不是配件类型。",
  ],
  [
    "Mã hợp lệ để đưa vào batch xuất local; chưa tạo phiếu WMS.",
    "The code is valid for the local outbound batch; no WMS document has been created.",
    "编码有效，可加入本地出库批次；尚未创建 WMS 单据。",
  ],
  [
    "Mã hợp lệ để đưa vào danh sách xuất linh kiện; chưa ghi nhận vào WMS.",
    "The code is valid for the component-issue list; nothing has been posted to WMS.",
    "编码有效，可加入配件出库列表；尚未在 WMS 中过账。",
  ],
  [
    "Mã item này thuộc SKU linh kiện; linh kiện không dán mã từng cái phải quét mã hộp BOX-<SKU>-<số hộp>.",
    "This item code belongs to a component SKU; for components without individual labels, scan the box code BOX-<SKU>-<box number>.",
    "此实物编码属于配件 SKU；未逐件贴码的配件必须扫描箱码 BOX-<SKU>-<箱号>。",
  ],
  [
    "Mã không còn đủ điều kiện xuất.",
    "The code is no longer eligible for issue.",
    "此编码已不符合出库条件。",
  ],
  [
    "Mã master đã được SKU tham chiếu nên không được đổi; hãy tạo master mới.",
    "The master code is referenced by a SKU and cannot be changed; create a new master record.",
    "该主数据编码已被 SKU 引用，不能更改；请创建新的主数据记录。",
  ],
  [
    "Mã máy đã tồn tại trong hệ thống; hãy dùng luồng điều chỉnh tồn kho/return được kiểm soát.",
    "The machine code already exists in the system; use the controlled inventory reversal/return flow.",
    "该设备编码已存在；请使用受控的库存冲销／退货流程。",
  ],
  [
    "Mã máy đã tồn tại trong hệ thống; hãy dùng luồng reversal/return được kiểm soát.",
    "The machine code already exists in the system; use the controlled inventory reversal/return flow.",
    "该设备编码已存在；请使用受控的库存冲销／退货流程。",
  ],
  [
    "Mã nhà cung cấp đã đạt giới hạn.",
    "The supplier-code limit has been reached.",
    "供应商编码已达到上限。",
  ],
  [
    "Mã này đã được gỡ trước đó.",
    "This code was already removed.",
    "此编码已被移除。",
  ],
  [
    "Mã phiếu bảo hành đã tồn tại.",
    "The warranty document code already exists.",
    "保修单编码已存在。",
  ],
  [
    "Mã phiếu không khớp nháp nhập đã xác nhận.",
    "The document code does not match the confirmed inbound draft.",
    "单据编码与已确认的入库草稿不匹配。",
  ],
  [
    "Mã scan chưa được gán cho item hoặc container.",
    "The scan code has not been assigned to an item or container.",
    "扫描编码尚未分配给实物或容器。",
  ],
  [
    "Mã scan không thuộc SKU của dòng chứng từ.",
    "The scan code does not belong to the document line's SKU.",
    "扫描编码不属于单据明细行对应的 SKU。",
  ],
  [
    "Mã scan không thuộc item instance của dòng chứng từ.",
    "The scan code does not belong to the document line's item instance.",
    "扫描编码不属于单据明细行对应的实物实例。",
  ],
  [
    "Mã scan không thuộc kho được yêu cầu.",
    "The scan code does not belong to the requested warehouse.",
    "扫描编码不属于请求的仓库。",
  ],
  [
    "Mã scan không ở trạng thái Đang hoạt động.",
    "The scan code is not ACTIVE.",
    "扫描编码未启用。",
  ],
  [
    "Mã scan không ở trạng thái ACTIVE.",
    "The scan code is not ACTIVE.",
    "扫描编码未启用。",
  ],
  [
    "Mã vai trò này được hệ thống giữ riêng, vui lòng chọn mã khác.",
    "This role code is reserved by the system. Please choose another code.",
    "此角色编码为系统保留编码，请选择其他编码。",
  ],
  [
    "Mã vật lý chưa được map vào ITEM.",
    "The physical code has not been mapped to ITEM.",
    "实物编码尚未关联到实物。",
  ],
  [
    "Mã vật lý đang không hoạt động.",
    "The physical code is inactive.",
    "实物编码已停用。",
  ],
  [
    "Mã vật lý đã bị thay đổi bởi thao tác khác. Vui lòng tải lại dữ liệu mới nhất.",
    "The physical code was changed by another operation. Please reload the latest data.",
    "实物编码已被其他操作更改。请重新加载最新数据。",
  ],
  [
    "Mã xác minh không đúng hoặc đã hết hạn.",
    "The verification code is incorrect or has expired.",
    "验证码错误或已过期。",
  ],
  [
    "Mã xác minh thiết bị không hợp lệ hoặc đã hết hạn.",
    "The device verification code is invalid or has expired.",
    "设备验证码无效或已过期。",
  ],
  [
    "Mã xác thực không đúng hoặc đã hết hạn.",
    "The authentication code is incorrect or has expired.",
    "身份验证码错误或已过期。",
  ],
  [
    "Mã xác thực không đúng.",
    "The authentication code is incorrect.",
    "身份验证码错误。",
  ],
  [
    "Mã yêu cầu phải là UUID.",
    "The request ID must be a UUID.",
    "请求标识必须为 UUID。",
  ],
  [
    "Mã yêu cầu đã được dùng cho nội dung khác.",
    "The request ID has already been used with different content.",
    "该请求标识已用于其他内容。",
  ],
  [
    "Mã đang gắn item thuộc phiếu xuất Nháp/Đang quét; gỡ match hoặc hủy phiếu trước khi vô hiệu hóa.",
    "This code is linked to an item in a DRAFT/SCANNING outbound document; remove the match or cancel the document before deactivating it.",
    "此编码关联的实物属于草稿或扫描中的出库单；请先移除匹配或取消单据，再停用编码。",
  ],
  [
    "Mã đang gắn item thuộc phiếu xuất DRAFT/SCANNING; gỡ match hoặc hủy phiếu trước khi vô hiệu hóa.",
    "This code is linked to an item in a DRAFT/SCANNING outbound document; remove the match or cancel the document before deactivating it.",
    "此编码关联的实物属于草稿或扫描中的出库单；请先移除匹配或取消单据，再停用编码。",
  ],
  [
    "Mã đã quét không thuộc phiếu nhập này.",
    "The scanned code does not belong to this inbound document.",
    "扫描的编码不属于此入库单。",
  ],
  [
    "Mã đã tồn tại nhưng không phải BOX.",
    "The code already exists but is not a BOX.",
    "该编码已存在，但不是 BOX 箱码。",
  ],
  [
    "Mã, số lượng, thứ tự hoặc nguồn quét không khớp snapshot đã lưu.",
    "The codes, quantities, order or scan source do not match the saved snapshot.",
    "编码、数量、顺序或扫描来源与已保存的快照不匹配。",
  ],
  [
    "Mật khẩu chứa ký tự không hỗ trợ hoặc vượt giới hạn byte của bộ mã hóa.",
    "The password contains unsupported characters or exceeds the encoder's byte limit.",
    "密码含有不支持的字符，或超过编码器的字节上限。",
  ],
  [
    "Mật khẩu của tài khoản đã được thay đổi. Vui lòng đăng nhập lại.",
    "The account password has changed. Please sign in again.",
    "账号密码已更改。请重新登录。",
  ],
  [
    "Mật khẩu hiện tại không đúng.",
    "The current password is incorrect.",
    "当前密码不正确。",
  ],
  [
    "Mật khẩu không được chứa khoảng trắng hoặc ký tự điều khiển.",
    "The password must not contain whitespace or control characters.",
    "密码不能包含空白或控制字符。",
  ],
  [
    "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
    "The new password must differ from the current password.",
    "新密码不能与当前密码相同。",
  ],
  [
    "Mọi Component line phải scanned_qty = required_qty.",
    "Every component line must have scanned_qty = required_qty.",
    "每个配件明细行都必须满足 scanned_qty = required_qty。",
  ],
  [
    "Mọi Sản phẩm item phải có label Đã in trước Hoàn tất xuất kho.",
    "Every PRODUCT item must have a PRINTED label before Post Issue.",
    "出库过账前，每件产品的标签都必须已打印。",
  ],
  [
    "Mọi PRODUCT item phải có label PRINTED trước Post Issue.",
    "Every PRODUCT item must have a PRINTED label before Post Issue.",
    "出库过账前，每件产品的标签都必须已打印。",
  ],
  [
    "Mọi dòng Component Issue phải là SKU loại Linh kiện.",
    "Every component-issue line must use a COMPONENT SKU.",
    "每个配件出库明细行都必须使用配件类型的 SKU。",
  ],
  [
    "Mọi dòng Component Issue phải là SKU loại COMPONENT.",
    "Every component-issue line must use a COMPONENT SKU.",
    "每个配件出库明细行都必须使用配件类型的 SKU。",
  ],
  [
    "Mọi dòng phải scan đủ chính xác trước khi Post.",
    "Every line must be scanned to the exact required quantity before posting.",
    "过账前，每个明细行都必须精确扫描至所需数量。",
  ],
  [
    "Mọi line phải dùng SKU Đang hoạt động.",
    "Every line must use an ACTIVE SKU.",
    "每个明细行都必须使用已启用的 SKU。",
  ],
  [
    "Mọi line phải dùng SKU ACTIVE.",
    "Every line must use an ACTIVE SKU.",
    "每个明细行都必须使用已启用的 SKU。",
  ],
  [
    "Mọi line phải scan đủ chính xác trước Hoàn tất xuất kho.",
    "Every line must be scanned to the exact required quantity before Post Issue.",
    "出库过账前，每个明细行都必须精确扫描至所需数量。",
  ],
  [
    "Mọi line phải scan đủ chính xác trước Post Issue.",
    "Every line must be scanned to the exact required quantity before Post Issue.",
    "出库过账前，每个明细行都必须精确扫描至所需数量。",
  ],
  [
    "Mỗi Sản phẩm unit phải được match bằng item cụ thể trước Hoàn tất xuất kho.",
    "Each PRODUCT unit must be matched to a specific item before Post Issue.",
    "出库过账前，每件产品都必须匹配到具体实物。",
  ],
  [
    "Mỗi PRODUCT unit phải được match bằng item cụ thể trước Post Issue.",
    "Each PRODUCT unit must be matched to a specific item before Post Issue.",
    "出库过账前，每件产品都必须匹配到具体实物。",
  ],
  [
    "Mỗi component item phải chọn đúng một item_id hoặc container_id.",
    "Each component item must specify exactly one of item_id or container_id.",
    "每个配件条目必须且只能指定 item_id 或 container_id 之一。",
  ],
  [
    "Mỗi dòng phải có sku_id hoặc sku_code.",
    "Every line must have sku_id or sku_code.",
    "每个明细行都必须有 sku_id 或 sku_code。",
  ],
  [
    "Mỗi file export tối đa 10.000 dòng; hãy thu hẹp bộ lọc.",
    "Each export file is limited to 10,000 rows; narrow the filters.",
    "每个导出文件最多 10,000 行；请缩小筛选范围。",
  ],
  [
    "Mỗi mã item là một hiện vật nên số lượng chỉ được là 1 (hoặc bỏ trống); đếm theo số lượng chỉ áp dụng cho mã hộp.",
    "Each item code represents one physical item, so its quantity must be 1 or omitted; quantity-based counting applies only to box codes.",
    "每个实物编码仅代表一件实物，因此数量只能为 1 或留空；按数量计数仅适用于箱码。",
  ],
  [
    "Mỗi mã item là một hiện vật nên quantity chỉ được là 1 (hoặc bỏ trống); đếm theo số lượng chỉ áp dụng cho mã hộp.",
    "Each item code represents one physical item, so its quantity must be 1 or omitted; quantity-based counting applies only to box codes.",
    "每个实物编码仅代表一件实物，因此数量只能为 1 或留空；按数量计数仅适用于箱码。",
  ],
  [
    "Mỗi phần tử items phải là object.",
    "Every items element must be an object.",
    "items 中的每个元素都必须是对象。",
  ],
  [
    "Mỗi phần tử media phải là object {url, role}.",
    "Every media element must be an object {url, role}.",
    "media 中的每个元素都必须是 {url, role} 对象。",
  ],
  [
    "Mỗi scan phải resolve đúng một item hoặc BOX container.",
    "Every scan must resolve to exactly one item or BOX container.",
    "每次扫描必须且只能识别出一个实物或 BOX 容器。",
  ],
  [
    "Một BOX chỉ được chứa một SKU Linh kiện.",
    "A BOX may contain only one COMPONENT SKU.",
    "一个 BOX 箱只能包含一种配件 SKU。",
  ],
  [
    "Một BOX chỉ được chứa một SKU COMPONENT.",
    "A BOX may contain only one COMPONENT SKU.",
    "一个 BOX 箱只能包含一种配件 SKU。",
  ],
  [
    "Một BOX chỉ được nhận đúng SKU Linh kiện đã đăng ký.",
    "A BOX may receive only its registered COMPONENT SKU.",
    "一个 BOX 箱只能接收其已登记的配件 SKU。",
  ],
  [
    "Một BOX chỉ được nhận đúng SKU COMPONENT đã đăng ký.",
    "A BOX may receive only its registered COMPONENT SKU.",
    "一个 BOX 箱只能接收其已登记的配件 SKU。",
  ],
  [
    "Một hiện vật xuất hiện nhiều lần trong batch.",
    "An item appears more than once in the batch.",
    "同一实物在批次中出现多次。",
  ],
  [
    "Một item chỉ được scan một lần trong cùng phiếu nhập.",
    "An item may only be scanned once in the same inbound document.",
    "同一实物在同一入库单中只能扫描一次。",
  ],
  [
    "Một item xuất hiện nhiều hơn một lần trong batch xuất local.",
    "An item appears more than once in the local outbound batch.",
    "同一实物在本地出库批次中出现多次。",
  ],
  [
    "Một item/hộp xuất hiện nhiều hơn một lần trong batch local.",
    "An item or box appears more than once in the local batch.",
    "同一实物或箱在本地批次中出现多次。",
  ],
  [
    "Một thao tác NFC đang xử lý; đối chiếu kết quả trước khi thử lại.",
    "An NFC operation is in progress; reconcile its result before trying again.",
    "有 NFC 操作正在处理；请先核对结果再重试。",
  ],
  [
    "Một toa chỉ được có một người nhận.",
    "An outbound request may have only one recipient.",
    "一张出库申请单只能有一个收货方。",
  ],
  [
    "Nghiệp vụ chưa xác nhận được business ID; giao dịch được hoàn tác.",
    "The operation could not confirm the business ID; the transaction was rolled back.",
    "业务操作无法确认业务标识；事务已回滚。",
  ],
  [
    "Nghiệp vụ tồn kho này đã được hạch toán trước đó.",
    "This inventory operation has already been posted.",
    "此库存业务已过账。",
  ],
  [
    "Nguồn audit có tổ chức chưa được xác định.",
    "The organization for the audit source has not been identified.",
    "尚未确定审计来源所属组织。",
  ],
  [
    "Nguồn chưa có trường thời gian được yêu cầu.",
    "The source does not have the requested timestamp field.",
    "来源中没有所请求的时间字段。",
  ],
  [
    "Nguồn chưa lưu ngày tạo phiên.",
    "The source has not stored the session creation date.",
    "来源尚未保存会话创建日期。",
  ],
];
