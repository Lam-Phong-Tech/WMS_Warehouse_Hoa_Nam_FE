/** Source-backed helper/wrapper messages; placeholder captures remain unchanged. */
export const BACKEND_CATALOG_BATCH_6: ReadonlyArray<
  readonly [source: string, en: string, zh: string]
> = [
  [
    "Bạn cần đồng ý với chính sách bảo mật trước khi gửi yêu cầu.",
    "You must agree to the privacy policy before submitting a request.",
    "提交申请前，您必须同意隐私政策。",
  ],
  [
    "Bạn thao tác quá nhanh. Vui lòng thử lại sau {value0} giây.",
    "You are acting too quickly. Please try again in {value0} seconds.",
    "操作过于频繁，请在 {value0} 秒后重试。",
  ],
  [
    "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
    "You are acting too quickly. Please try again in a few minutes.",
    "操作过于频繁，请几分钟后重试。",
  ],
  [
    "Bạn đã gửi quá nhiều yêu cầu tư vấn. Vui lòng thử lại sau ít phút.",
    "You submitted too many consultation requests. Please try again in a few minutes.",
    "提交的咨询申请过多，请几分钟后重试。",
  ],
  [
    "Bạn đã nhập mã xác minh quá nhiều lần. Vui lòng thử lại sau.",
    "You entered verification codes too many times. Please try again later.",
    "验证码输入次数过多，请稍后重试。",
  ],
  [
    "Bạn đã nhập mã xác minh thiết bị quá nhiều lần. Vui lòng thử lại sau.",
    "You entered device verification codes too many times. Please try again later.",
    "设备验证码输入次数过多，请稍后重试。",
  ],
  [
    "Bạn đã nhập mã xác thực quá nhiều lần. Vui lòng thử lại sau.",
    "You entered authentication codes too many times. Please try again later.",
    "认证码输入次数过多，请稍后重试。",
  ],
  [
    "Bạn đã yêu cầu gửi lại mã xác minh quá nhiều lần. Vui lòng thử lại sau.",
    "You requested verification code resends too many times. Please try again later.",
    "重新发送验证码的请求过多，请稍后重试。",
  ],
  [
    "Bạn đã yêu cầu gửi lại mã xác minh thiết bị quá nhiều lần. Vui lòng thử lại sau.",
    "You requested device verification code resends too many times. Please try again later.",
    "重新发送设备验证码的请求过多，请稍后重试。",
  ],
  [
    "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau {value0} giây.",
    "Too many failed sign-in attempts. Please try again in {value0} seconds.",
    "登录失败次数过多，请在 {value0} 秒后重试。",
  ],
  [
    "Bệnh/lỗi đã ngừng sử dụng nên không chọn được cho hồ sơ mới.",
    "This defect is inactive and cannot be selected for new records.",
    "此故障已停用，无法为新档案选择。",
  ],
  [
    "Bộ lọc spec không được hỗ trợ.",
    "The spec filter is not supported.",
    "不支持此规格筛选条件。",
  ],
  [
    "Chính sách bảo mật đã được cập nhật. Vui lòng tải lại và đồng ý phiên bản mới nhất.",
    "The privacy policy was updated. Please reload and agree to the latest version.",
    "隐私政策已更新，请重新加载并同意最新版本。",
  ],
  ["Component Issue posted.", "Component Issue posted.", "配件出库已过账。"],
  [
    "Container item phải có serial hoặc product.",
    "A container item must have a serial or product.",
    "容器明细必须包含序列号或产品。",
  ],
  [
    "Container item số lượng phải > 0.",
    "Container item quantity must be > 0.",
    "容器明细数量必须 > 0。",
  ],
  [
    "Container item quantity phải > 0.",
    "Container item quantity must be > 0.",
    "容器明细数量必须 > 0。",
  ],
  ["Cập nhật SKU thành công.", "SKU updated successfully.", "SKU 更新成功。"],
  ["Dịch vụ đang hoạt động.", "The service is running.", "服务正在运行。"],
  [
    "Dữ liệu gửi lên chưa hợp lệ.",
    "The submitted data is invalid.",
    "提交的数据无效。",
  ],
  [
    "Gán physical code thành công.",
    "Physical code assigned successfully.",
    "物理编码分配成功。",
  ],
  [
    "Hoàn tất nhập kho thành công.",
    "Inbound receipt posted successfully.",
    "入库过账成功。",
  ],
  [
    "Post Receipt thành công.",
    "Inbound receipt posted successfully.",
    "入库过账成功。",
  ],
  [
    "Hoàn tất xuất kho thành công.",
    "Outbound issue posted successfully.",
    "出库过账成功。",
  ],
  [
    "Post Issue thành công.",
    "Outbound issue posted successfully.",
    "出库过账成功。",
  ],
  [
    "Hoàn tất xuất kho thành công; tồn được trừ tại bước hoàn tất này.",
    "Outbound issue posted successfully; inventory is deducted at this posting step.",
    "出库过账成功，库存已在此过账步骤扣减。",
  ],
  [
    "Post Issue thành công; tồn được trừ tại bước hoàn tất này.",
    "Outbound issue posted successfully; inventory is deducted at this posting step.",
    "出库过账成功，库存已在此过账步骤扣减。",
  ],
  [
    "Hệ thống xử lý export nền không nhận việc sau {value0} giây. Vui lòng thử xuất lại; nếu vẫn lỗi, báo quản trị viên kiểm tra worker hàng đợi.",
    "The background export system did not accept the job within {value0} seconds. Try exporting again; if it still fails, ask an administrator to check the queue worker.",
    "后台导出系统在 {value0} 秒内未接收任务。请重试导出；若仍失败，请联系管理员检查队列工作进程。",
  ],
  [
    "Idempotency-Key chỉ được chứa chữ, số và các ký tự - _ . :",
    "Idempotency-Key may only contain letters, numbers and - _ . :",
    "Idempotency-Key 仅可包含字母、数字及 - _ . :",
  ],
  [
    "Idempotency-Key này đã được dùng cho một yêu cầu khác.",
    "This Idempotency-Key was used for another request.",
    "此 Idempotency-Key 已用于其他请求。",
  ],
  [
    "Idempotency-Key phải dài {value0}-{value1} ký tự.",
    "Idempotency-Key must be {value0}-{value1} characters long.",
    "Idempotency-Key 长度必须为 {value0}-{value1} 个字符。",
  ],
  [
    "Inbound scan validated; stock_effect=NONE.",
    "Inbound scan validated; stock_effect=NONE.",
    "入库扫描已验证，stock_effect=NONE。",
  ],
  [
    "Khóa Idempotency đã được dùng cho một yêu cầu khác với dữ liệu khác. Vui lòng tạo khóa mới.",
    "The idempotency key was used for another request with different data. Please create a new key.",
    "幂等键已用于包含不同数据的其他请求，请创建新键。",
  ],
  [
    "Không có movement trong scope để chứng minh quyền truy cập mã vật lý.",
    "No movement exists in this scope to establish access to the physical code.",
    "此范围内没有库存变动记录，无法证明物理编码访问权限。",
  ],
  [
    "Không dùng ids chung với bộ lọc/sắp xếp/phân trang.",
    "Do not combine ids with filters, sorting or pagination.",
    "不得将 ids 与筛选、排序或分页一同使用。",
  ],
  [
    "Không tìm thấy hiện vật ứng với mã này.",
    "No item was found for this code.",
    "未找到与此编码对应的实物。",
  ],
  [
    "Không tìm thấy hộp ứng với mã này.",
    "No box was found for this code.",
    "未找到与此编码对应的箱。",
  ],
  [
    "Không xác định được người yêu cầu export nên không áp được phạm vi kho/PII. Vui lòng đăng nhập lại rồi xuất báo cáo lần nữa.",
    "The export requester could not be identified, so warehouse/PII scope cannot be applied. Please sign in again and export the report again.",
    "无法识别导出申请人，因而无法应用仓库/PII 范围。请重新登录后再次导出报表。",
  ],
  [
    "Không được có parent_product_id = component_product_id.",
    "parent_product_id must not equal component_product_id.",
    "parent_product_id 不得等于 component_product_id。",
  ],
  [
    "Lease Idempotency đã được request khác tiếp quản.",
    "Another request took over the idempotency lease.",
    "其他请求已接管幂等租约。",
  ],
  [
    "Linh kiện không còn trong kho (item_status khác IN_STOCK).",
    "The component is no longer in stock (item_status is not IN_STOCK).",
    "配件已不在库（item_status 不是 IN_STOCK）。",
  ],
  [
    "Linh kiện này dán mã từng cái; phải quét mã trên linh kiện chứ không quét hộp.",
    "This component is individually labeled; scan the component's code, not the box.",
    "此配件按件贴码，请扫描配件上的编码，不要扫描箱码。",
  ],
  [
    "Linh kiện này đang được quét ở phiếu xuất linh kiện khác ({value0}) và chưa hủy/hoàn tất.",
    "This component is being scanned on another component issue document ({value0}) that has not been cancelled or completed.",
    "此配件正在其他尚未取消或完成的配件出库单（{value0}）中扫描。",
  ],
  [
    "Lấy bộ lọc thành công.",
    "Filters retrieved successfully.",
    "筛选条件获取成功。",
  ],
  [
    "Lấy chi tiết sản phẩm thành công.",
    "Product details retrieved successfully.",
    "产品详情获取成功。",
  ],
  [
    "Lấy cấu hình thành công.",
    "Configuration retrieved successfully.",
    "配置获取成功。",
  ],
  [
    "Lấy danh mục thành công.",
    "Catalog retrieved successfully.",
    "目录获取成功。",
  ],
  [
    "Lấy danh sách sản phẩm thành công.",
    "Product list retrieved successfully.",
    "产品列表获取成功。",
  ],
  [
    "Lấy dữ liệu trang chủ thành công.",
    "Home page data retrieved successfully.",
    "首页数据获取成功。",
  ],
  [
    "Lấy sản phẩm liên quan thành công.",
    "Related products retrieved successfully.",
    "相关产品获取成功。",
  ],
  [
    "Lấy sản phẩm theo danh sách id thành công.",
    "Products retrieved successfully by ID list.",
    "已按 ID 列表成功获取产品。",
  ],
  [
    "Máy chủ không tìm thấy file của lần xuất này (file chưa được lưu thành công hoặc máy chủ không đọc được nơi lưu file). Vui lòng bấm xuất lại; nếu lỗi lặp lại, báo quản trị viên kiểm tra nơi lưu file xuất báo cáo.",
    "The server could not find this export file (it was not saved successfully or its storage cannot be read). Export again; if the error repeats, ask an administrator to check report export storage.",
    "服务器未找到此次导出文件（文件未成功保存或存储位置无法读取）。请重新导出；若问题重复，请联系管理员检查报表导出存储。",
  ],
  [
    "Mã hộp trỏ tới SKU [{value0}] chưa có trong danh mục. Kiểm tra lại mã in trên hộp.",
    "The box code identifies SKU [{value0}], which is not in the catalog. Check the code printed on the box.",
    "箱码指向目录中不存在的 SKU [{value0}]，请检查箱上打印的编码。",
  ],
  [
    "Mã này không phải linh kiện (SKU Linh kiện Đang hoạt động).",
    "This code is not a component (SKU COMPONENT ACTIVE).",
    "此编码不是配件编码（SKU COMPONENT ACTIVE）。",
  ],
  [
    "Mã này không phải linh kiện (SKU COMPONENT ACTIVE).",
    "This code is not a component (SKU COMPONENT ACTIVE).",
    "此编码不是配件编码（SKU COMPONENT ACTIVE）。",
  ],
  [
    "Mã vật lý chưa gắn với linh kiện hay hộp nào.",
    "The physical code is not linked to a component or box.",
    "物理编码尚未关联配件或箱。",
  ],
  [
    "Mỗi parent/component pair chỉ có một row.",
    "Each parent/component pair may have only one row.",
    "每个父项/配件组合只能有一行。",
  ],
  [
    "Một physical code chỉ thuộc một container còn hiệu lực.",
    "A physical code may belong to only one valid container.",
    "一个物理编码只能属于一个有效容器。",
  ],
  [
    "Một serial chỉ được có một container-item owner.",
    "A serial may have only one container-item owner.",
    "一个序列号只能有一个容器明细所属方。",
  ],
  [
    "Nhãn đóng gói đã sẵn sàng in; snapshot bất biến.",
    "The packing label is ready to print; its snapshot is immutable.",
    "包装标签已可打印，快照不可更改。",
  ],
  [
    "Packing Label đã sẵn sàng in; snapshot bất biến.",
    "The packing label is ready to print; its snapshot is immutable.",
    "包装标签已可打印，快照不可更改。",
  ],
  [
    "Outbound import consumed.",
    "Outbound import consumed.",
    "出库导入已处理。",
  ],
  [
    "SKU linh kiện [{value0}] đang không Đang hoạt động.",
    "Component SKU [{value0}] is not ACTIVE.",
    "配件 SKU [{value0}] 不是 ACTIVE 状态。",
  ],
  [
    "SKU linh kiện [{value0}] đang không ACTIVE.",
    "Component SKU [{value0}] is not ACTIVE.",
    "配件 SKU [{value0}] 不是 ACTIVE 状态。",
  ],
  [
    "Tham số truy vấn chứa ký tự không hợp lệ (không phải UTF-8).",
    "The query parameter contains invalid characters (not UTF-8).",
    "查询参数含无效字符（非 UTF-8）。",
  ],
  [
    "Thu hồi physical code thành công.",
    "Physical code revoked successfully.",
    "物理编码撤销成功。",
  ],
  [
    "Tiến trình tạo file export dừng giữa chừng (quá {value0} giây không phản hồi). Vui lòng thử xuất lại với bộ lọc hẹp hơn.",
    "Export file generation stopped responding for over {value0} seconds. Please try again with narrower filters.",
    "导出文件生成进程超过 {value0} 秒未响应，请缩小筛选范围后重试。",
  ],
  [
    "Tính năng gửi yêu cầu tư vấn đang tạm tắt.",
    "Consultation requests are temporarily disabled.",
    "咨询申请功能暂时关闭。",
  ],
  [
    "Vui lòng chờ {value0} giây trước khi yêu cầu gửi lại mã xác minh.",
    "Please wait {value0} seconds before requesting another verification code.",
    "请等待 {value0} 秒后再请求发送验证码。",
  ],
  [
    "Vui lòng đợi trước khi yêu cầu gửi lại mã xác minh thiết bị.",
    "Please wait before requesting another device verification code.",
    "请稍等后再请求发送设备验证码。",
  ],
  [
    "Worker hàng đợi dừng giữa chừng khi tạo file export.",
    "The queue worker stopped while generating the export file.",
    "队列工作进程在生成导出文件时中断。",
  ],
  [
    "Worker hàng đợi dừng giữa chừng khi tạo file export: {value0}",
    "The queue worker stopped while generating the export file: {value0}",
    "队列工作进程在生成导出文件时中断：{value0}",
  ],
  [
    "Yêu cầu tư vấn đã được tiếp nhận trước đó.",
    "This consultation request was already received.",
    "此咨询申请此前已接收。",
  ],
  [
    "Yêu cầu đang được xử lý, vui lòng không gửi trùng lặp.",
    "The request is being processed; please do not submit duplicates.",
    "请求正在处理中，请勿重复提交。",
  ],
  [
    "container.physical_code_id chưa tồn tại",
    "container.physical_code_id does not exist.",
    "container.physical_code_id 不存在。",
  ],
  [
    "container_item chưa tồn tại",
    "container_item does not exist.",
    "container_item 不存在。",
  ],
  [
    "cursor không còn phù hợp, vui lòng tải lại danh sách.",
    "cursor is no longer applicable; please reload the list.",
    "cursor 已不再适用，请重新加载列表。",
  ],
  ["ids không được rỗng.", "ids must not be empty.", "ids 不能为空。"],
  [
    "ids phải là UUID hợp lệ.",
    "ids must be valid UUIDs.",
    "ids 必须为有效 UUID。",
  ],
  [
    "ids tối đa {value0} phần tử.",
    "ids must contain at most {value0} elements.",
    "ids 最多包含 {value0} 个元素。",
  ],
  ["item_key chưa tồn tại", "item_key does not exist.", "item_key 不存在。"],
  [
    "item_key phải unique trong một container.",
    "item_key must be unique within a container.",
    "item_key 在同一容器内必须唯一。",
  ],
  [
    "item_key phải được backfill trước khi tạo unique index.",
    "item_key must be backfilled before creating a unique index.",
    "创建唯一索引前必须回填 item_key。",
  ],
  [
    "limit phải là số nguyên dương.",
    "limit must be a positive integer.",
    "limit 必须为正整数。",
  ],
  [
    "limit tối đa là {value0}.",
    "limit must not exceed {value0}.",
    "limit 不得超过 {value0}。",
  ],
  [
    "sku_component chưa tồn tại",
    "sku_component does not exist.",
    "sku_component 不存在。",
  ],
  [
    "số lượng của component phải > 0.",
    "Component quantity must be > 0.",
    "配件数量必须 > 0。",
  ],
  [
    "quantity của component phải > 0.",
    "Component quantity must be > 0.",
    "配件数量必须 > 0。",
  ],
  [
    "Đã dựng phiếu xuất linh kiện đã quét đủ; chưa trừ tồn (stock_effect=NONE).",
    "A fully scanned component issue document was created; inventory has not been deducted (stock_effect=NONE).",
    "已创建扫描完成的配件出库单，尚未扣减库存（stock_effect=NONE）。",
  ],
  [
    "Đã ghi nhận batch xuất N/N; phiếu đã full-scan và đang chờ xử lý Nhãn đóng gói. Chưa trừ tồn.",
    "Outbound batch N/N recorded; the document is fully scanned and awaiting packing label processing. Inventory has not been deducted.",
    "已记录出库批次 N/N；单据已扫描完成，正在等待处理包装标签，尚未扣减库存。",
  ],
  [
    "Đã ghi nhận batch xuất N/N; phiếu đã full-scan và đang chờ xử lý Packing Label. Chưa trừ tồn.",
    "Outbound batch N/N recorded; the document is fully scanned and awaiting packing label processing. Inventory has not been deducted.",
    "已记录出库批次 N/N；单据已扫描完成，正在等待处理包装标签，尚未扣减库存。",
  ],
  ["Đã ghi nhận hàng mất mát", "Lost goods recorded.", "已记录丢失货物。"],
  [
    "Đã ghi nhận hàng nhập; phiếu đang chờ duyệt và chưa tăng tồn.",
    "Received goods recorded; the document awaits approval and inventory has not increased.",
    "已记录收货，单据正在等待审批，库存尚未增加。",
  ],
  [
    "Đã ghi nhận mã quét nhập kho; tồn kho chưa thay đổi (stock_effect=NONE).",
    "Inbound scan code recorded; inventory is unchanged (stock_effect=NONE).",
    "已记录入库扫描编码，库存未变（stock_effect=NONE）。",
  ],
  [
    "Đã ghi nhận xuất linh kiện.",
    "Component issue recorded.",
    "已记录配件出库。",
  ],
  [
    "Đã gán định danh vật lý cho item.",
    "Physical identity assigned to the item.",
    "已为实物分配物理标识。",
  ],
  ["Đã nhận hàng điều chuyển", "Transfer goods received.", "已接收调拨货物。"],
  [
    "Đã preview Nhãn đóng gói; chưa in, chưa trừ tồn.",
    "Packing label previewed; not printed and inventory has not been deducted.",
    "已预览包装标签，尚未打印或扣减库存。",
  ],
  [
    "Đã preview Packing Label; chưa in, chưa trừ tồn.",
    "Packing label previewed; not printed and inventory has not been deducted.",
    "已预览包装标签，尚未打印或扣减库存。",
  ],
  [
    "Đã tiếp nhận yêu cầu tư vấn.",
    "Consultation request received.",
    "已接收咨询申请。",
  ],
  [
    "Đã trả lại hàng điều chuyển",
    "Transfer goods returned.",
    "已退回调拨货物。",
  ],
  [
    "Đã tạo item mới kèm mã định danh.",
    "New item created with an identity code.",
    "已创建带标识码的新实物。",
  ],
  [
    "Đã vô hiệu hóa định danh vật lý.",
    "Physical identity deactivated.",
    "已停用物理标识。",
  ],
  [
    "Đã xuất linh kiện cho hồ sơ bảo hành; tồn kho đã trừ (stock_effect=DECREASE).",
    "Components issued for the warranty case; inventory deducted (stock_effect=DECREASE).",
    "已为保修单领用配件，并扣减库存（stock_effect=DECREASE）。",
  ],
  ["Đã xuất điều chuyển", "Transfer goods dispatched.", "已发出调拨货物。"],
  [
    "Đã xác nhận kho nguồn nhận lại hàng trả về",
    "Source warehouse receipt of returned goods confirmed.",
    "已确认源仓库收到退回货物。",
  ],
  [
    "Đã xử lý lệnh điều chỉnh; chứng từ gốc vẫn giữ trạng thái Đã ghi nhận.",
    "Adjustment command processed; the original document remains POSTED.",
    "已处理调整命令，原单据仍保持 POSTED 状态。",
  ],
  [
    "Đã xử lý lệnh điều chỉnh; chứng từ gốc vẫn giữ trạng thái POSTED.",
    "Adjustment command processed; the original document remains POSTED.",
    "已处理调整命令，原单据仍保持 POSTED 状态。",
  ],
  [
    "Đại lý đã ngừng hoạt động nên không chọn được cho chứng từ mới.",
    "The agency is inactive and cannot be selected for new documents.",
    "经销商已停用，无法为新单据选择。",
  ],
  [
    "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
    "Password changed successfully. Please sign in again.",
    "密码修改成功，请重新登录。",
  ],
];
