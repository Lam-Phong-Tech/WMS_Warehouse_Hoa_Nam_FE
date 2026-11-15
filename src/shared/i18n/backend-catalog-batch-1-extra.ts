/** Complete emitted backend messages from backend-batch-1 rows 200–399. */
export const BACKEND_CATALOG_BATCH_1_EXTRA: ReadonlyArray<
  readonly [string, string, string]
> = [
  [
    "Current ERD chỉ cho phép số lượng nguyên dương.",
    "The current ERD only allows positive integer quantities.",
    "当前 ERD 仅允许正整数数量。",
  ],
  [
    "Current ERD chỉ cho phép quantity nguyên dương.",
    "The current ERD only allows positive integer quantities.",
    "当前 ERD 仅允许正整数数量。",
  ],
  [
    "Cursor hết hạn hoặc khác bộ lọc/quyền/phiên/kho.",
    "The cursor has expired or does not match the filters, permissions, session or warehouse.",
    "游标已过期，或与筛选条件、权限、会话或仓库不匹配。",
  ],
  [
    "Cursor hết hạn hoặc khác kho, phiên, quyền hay bộ lọc.",
    "The cursor has expired or does not match the warehouse, session, permissions or filters.",
    "游标已过期，或与仓库、会话、权限或筛选条件不匹配。",
  ],
  [
    "Cursor hết hạn hoặc khác phiên, kho, quyền, bộ lọc.",
    "The cursor has expired or does not match the session, warehouse, permissions or filters.",
    "游标已过期，或与会话、仓库、权限或筛选条件不匹配。",
  ],
  [
    "Cursor khác tài khoản, phiên, quyền, kho hoặc bộ lọc.",
    "The cursor does not match the account, session, permissions, warehouse or filters.",
    "游标与账号、会话、权限、仓库或筛选条件不匹配。",
  ],
  [
    "Cursor không hợp lệ hoặc thuộc phiên bản cũ; tải lại trang đầu.",
    "The cursor is invalid or belongs to an older version. Reload the first page.",
    "游标无效或属于旧版本。请重新加载第一页。",
  ],
  [
    "Cursor không hợp lệ; tải lại danh sách.",
    "The cursor is invalid. Reload the list.",
    "游标无效。请重新加载列表。",
  ],
  [
    "Cursor không hợp lệ; tải lại trang đầu.",
    "The cursor is invalid. Reload the first page.",
    "游标无效。请重新加载第一页。",
  ],
  [
    "Cursor không hợp lệ; tải lại từ trang đầu.",
    "The cursor is invalid. Reload from the first page.",
    "游标无效。请从第一页重新加载。",
  ],
  [
    "Cursor không thuộc người dùng, phiên hoặc bộ lọc hiện tại.",
    "The cursor does not belong to the current user, session or filters.",
    "游标不属于当前用户、会话或筛选条件。",
  ],
  [
    "Cursor đã hết hạn; tải lại danh sách.",
    "The cursor has expired. Reload the list.",
    "游标已过期。请重新加载列表。",
  ],
  [
    "Cursor đã hết hạn; tải lại trang đầu.",
    "The cursor has expired. Reload the first page.",
    "游标已过期。请重新加载第一页。",
  ],
  [
    "Có biên nhận nhưng không đọc được checkpoint cùng phạm vi.",
    "A receipt exists, but its checkpoint cannot be read within the same scope.",
    "存在回执，但无法在相同范围内读取其检查点。",
  ],
  [
    "Có quyền không tồn tại hoặc đã ngừng hiệu lực, không thể gán.",
    "Some permissions do not exist or are no longer active and cannot be assigned.",
    "部分权限不存在或已失效，无法分配。",
  ],
  [
    "Có quá nhiều yêu cầu. Vui lòng thử lại sau.",
    "Too many requests. Please try again later.",
    "请求过多。请稍后重试。",
  ],
  [
    "Có trường ngoài contract P03; actor/session/trạng thái/version do máy chủ xác định.",
    "Some fields are outside the P03 contract. The server determines the actor, session, status and version.",
    "部分字段超出 P03 协议范围。操作人、会话、状态和版本由服务器确定。",
  ],
  [
    "Có trường ngoài contract P03; actor/session/status/version do máy chủ xác định.",
    "Some fields are outside the P03 contract. The server determines the actor, session, status and version.",
    "部分字段超出 P03 协议范围。操作人、会话、状态和版本由服务器确定。",
  ],
  [
    "Có trường ngoài contract P04; không tự khai actor, phiên, trạng thái hoặc phiên bản.",
    "Some fields are outside the P04 contract. Do not supply the actor, session, status or version.",
    "部分字段超出 P04 协议范围。请勿自行提供操作人、会话、状态或版本。",
  ],
  [
    "Có trường ngoài contract P19; không gửi ID/số phiếu hoặc quyền do client suy ra.",
    "Some fields are outside the P19 contract. Do not send IDs, document numbers or permissions inferred by the client.",
    "部分字段超出 P19 协议范围。请勿发送客户端推断的 ID、单据编号或权限。",
  ],
  [
    "Có trường ngoài contract của lệnh.",
    "Some fields are outside the command contract.",
    "部分字段超出指令协议范围。",
  ],
  [
    "Cùng file này đang được import với cùng tùy chọn; vui lòng đợi lần chạy hiện tại kết thúc rồi thử lại.",
    "The same file is being imported with the same options. Wait for the current run to finish, then try again.",
    "相同文件正在使用相同选项导入。请等待当前任务完成后重试。",
  ],
  [
    "Cùng một item không được khai nhiều dòng trong một điều chỉnh tồn kho.",
    "An item cannot appear on multiple lines in the same stock reversal.",
    "同一库存冲销单中，同一物品不能出现在多行。",
  ],
  [
    "Cùng một item không được khai nhiều dòng trong một reversal.",
    "An item cannot appear on multiple lines in the same stock reversal.",
    "同一库存冲销单中，同一物品不能出现在多行。",
  ],
  [
    "Cùng một linh kiện bị quét hai lần trong danh sách.",
    "The same component was scanned twice in the list.",
    "列表中同一配件被扫描了两次。",
  ],
  [
    "Cơ sở dữ liệu không hỗ trợ cấp mã nhà cung cấp.",
    "The database does not support generating supplier codes.",
    "数据库不支持生成供应商编码。",
  ],
  [
    "Cần If-Match từ close-check.",
    "If-Match from close-check is required.",
    "必须提供 close-check 返回的 If-Match。",
  ],
  [
    "Cần UUID của kho đã được xác nhận.",
    "The UUID of the verified warehouse is required.",
    "必须提供已确认仓库的 UUID。",
  ],
  [
    "Cần X-Work-Shift-ID và X-Request-ID cho giao thức ca.",
    "The shift protocol requires X-Work-Shift-ID and X-Request-ID.",
    "班次协议要求提供 X-Work-Shift-ID 和 X-Request-ID。",
  ],
  [
    "Cần contract phục hồi trước khi bắt đầu lượt mới.",
    "The recovery contract is required before starting a new operation.",
    "开始新操作前必须提供恢复协议。",
  ],
  [
    "Cần contract đọc trường thiếu rõ ràng.",
    "An explicit missing-field read contract is required.",
    "必须明确指定缺失字段读取协议。",
  ],
  [
    "Cần documents.read và warranty.component_issue để đọc liên kết phiếu linh kiện.",
    "Reading the component issue document link requires documents.read and warranty.component_issue.",
    "读取配件出库单链接需要 documents.read 和 warranty.component_issue 权限。",
  ],
  [
    "Cần documents.read và warranty.component_issue để đọc phiếu linh kiện.",
    "Reading the component issue document requires documents.read and warranty.component_issue.",
    "读取配件出库单需要 documents.read 和 warranty.component_issue 权限。",
  ],
  [
    "Cần gửi If-Match chứa phiên bản nhà cung cấp.",
    "Send If-Match containing the supplier version.",
    "请发送包含供应商版本的 If-Match。",
  ],
  [
    "Cần gửi tên, mô tả hoặc trạng thái để cập nhật.",
    "Supply a name, description or status to update.",
    "请提供要更新的名称、说明或状态。",
  ],
  [
    "Cần mã yêu cầu và bằng chứng đọc hợp lệ.",
    "A request code and valid read proof are required.",
    "必须提供请求编号和有效的读取凭证。",
  ],
  [
    "Cần phiên bản đăng ký đã xác minh.",
    "A verified enrollment version is required.",
    "必须提供已验证的设备注册版本。",
  ],
  [
    "Cần prepare phục hồi trước khi xác nhận lượt mới.",
    "Prepare recovery before confirming a new operation.",
    "确认新操作前，必须先执行恢复准备。",
  ],
  [
    "Cần quyền documents.read để đọc tệp đính kèm.",
    "Reading attachments requires documents.read permission.",
    "读取附件需要 documents.read 权限。",
  ],
  [
    "Cần quyền warranty.pii.view để tải nội dung tệp có thể chứa PII.",
    "Downloading files that may contain PII requires warranty.pii.view permission.",
    "下载可能包含个人信息的文件需要 warranty.pii.view 权限。",
  ],
  [
    "Cần quản trị viên kiểm tra đăng ký thiết bị.",
    "An administrator must review the device enrollment.",
    "需要管理员检查设备注册信息。",
  ],
  [
    "Cần xác minh lại đăng ký thiết bị.",
    "Device enrollment must be verified again.",
    "必须重新验证设备注册信息。",
  ],
  [
    "Cần xác minh thiết bị này.",
    "This device must be verified.",
    "必须验证此设备。",
  ],
  [
    "Cần xác nhận lại kho đang làm việc.",
    "Confirm the working warehouse again.",
    "请重新确认当前工作仓库。",
  ],
  [
    "Cần xác nhận đúng kho của phiên.",
    "Confirm the warehouse that belongs to this session.",
    "请确认此会话所属的正确仓库。",
  ],
  [
    "Cần đúng contract P19.",
    "The correct P19 contract is required.",
    "必须使用正确的 P19 协议。",
  ],
  [
    "Cần đúng contract cấp PX khi SAVE.",
    "The correct PX allocation contract is required when using SAVE.",
    "执行 SAVE 时必须使用正确的 PX 编号分配协议。",
  ],
  [
    "Cần đúng contract kiểm tra lệnh P19.",
    "The correct P19 command-check contract is required.",
    "必须使用正确的 P19 指令检查协议。",
  ],
  [
    "Cần đúng contract đọc hộp của kho.",
    "The correct warehouse box-read contract is required.",
    "必须使用正确的仓库盒子读取协议。",
  ],
  [
    "Cần đúng contract đọc vị trí linh kiện.",
    "The correct component location-read contract is required.",
    "必须使用正确的配件位置读取协议。",
  ],
  [
    "Cần đăng nhập bằng phiên có hỗ trợ gia hạn để bắt đầu ca.",
    "Sign in with a session that supports renewal before starting a shift.",
    "开始班次前，请使用支持续期的会话登录。",
  ],
  [
    "Cần đăng nhập để truy cập hồ sơ bảo hành.",
    "Sign in to access warranty cases.",
    "请登录后访问保修单。",
  ],
  ["Cần đăng nhập.", "Sign-in is required.", "需要登录。"],
  [
    "Cập nhật ca bảo hành thành công.",
    "Warranty case updated successfully.",
    "保修单更新成功。",
  ],
  [
    "Cập nhật catalog master thành công.",
    "Master catalog updated successfully.",
    "主数据目录更新成功。",
  ],
  [
    "Cập nhật chứng từ thành công.",
    "Document updated successfully.",
    "单据更新成功。",
  ],
  [
    "Cập nhật container thành công.",
    "Container updated successfully.",
    "容器更新成功。",
  ],
  [
    "Cập nhật dữ liệu App PV thành công.",
    "App PV data updated successfully.",
    "App PV 数据更新成功。",
  ],
  [
    "Cập nhật mã vật lý thành công.",
    "Physical code updated successfully.",
    "实物编码更新成功。",
  ],
  [
    "Cập nhật phòng ban thành công.",
    "Department updated successfully.",
    "部门更新成功。",
  ],
  [
    "Cập nhật thông tin phiếu xuất kho thành công.",
    "Issue document information updated successfully.",
    "出库单信息更新成功。",
  ],
  [
    "DATE cần date; RANGE cần from/to hợp lệ; ALL không nhận ngày.",
    "DATE requires date; RANGE requires valid from/to; ALL does not accept dates.",
    "DATE 需要 date；RANGE 需要有效的 from/to；ALL 不接受日期。",
  ],
  [
    "DATE cần date; RANGE cần from/to; ALL không nhận ngày.",
    "DATE requires date; RANGE requires from/to; ALL does not accept dates.",
    "DATE 需要 date；RANGE 需要 from/to；ALL 不接受日期。",
  ],
  [
    "Danh mục lỗi đã được cập nhật bởi phiên khác; tải lại trước khi lưu.",
    "The defect catalog was updated by another session. Reload before saving.",
    "故障目录已被其他会话更新。请重新加载后再保存。",
  ],
  [
    "Danh mục sản phẩm vừa thay đổi. Tải lại từ trang đầu.",
    "The product catalog has changed. Reload from the first page.",
    "产品目录已更改。请从第一页重新加载。",
  ],
  [
    "Danh sách BOX chờ xếp khay.",
    "List of BOX containers awaiting putaway.",
    "待上架 BOX 列表。",
  ],
  [
    "Danh sách bệnh/lỗi phải gồm các mã Đang hoạt động hợp lệ.",
    "The defect list must contain valid active codes.",
    "故障列表必须包含有效且已启用的编码。",
  ],
  [
    "Danh sách bệnh/lỗi phải gồm các mã ACTIVE hợp lệ.",
    "The defect list must contain valid active codes.",
    "故障列表必须包含有效且已启用的编码。",
  ],
  [
    "Danh sách component có phần tử trùng.",
    "The component list contains duplicate entries.",
    "配件列表中存在重复项。",
  ],
  [
    "Danh sách hiện vật dùng keyword, không dùng search.",
    "The item list uses keyword rather than search.",
    "物品列表使用 keyword，不使用 search。",
  ],
  [
    "Danh sách mã khác snapshot đã lưu; không ghi nhận bằng dữ liệu chưa đồng bộ.",
    "The code list differs from the saved snapshot. Do not record unsynchronized data.",
    "编码列表与已保存的快照不一致。请勿提交未同步的数据。",
  ],
  [
    "Danh sách phiếu cần bổ sung chứng từ.",
    "List of documents requiring additional attachments.",
    "需要补充凭证的单据列表。",
  ],
  [
    "Danh sách trộn chưa được mở trên bản triển khai này.",
    "Mixed lists are not enabled in this deployment.",
    "当前部署未启用混合列表。",
  ],
  [
    "Database snapshot chưa được xác nhận cho driver hiện tại.",
    "The database snapshot has not been verified for the current driver.",
    "尚未为当前数据库驱动确认快照。",
  ],
  [
    "Dùng auth/logout để đăng xuất phiên hiện tại.",
    "Use auth/logout to sign out of the current session.",
    "请使用 auth/logout 退出当前会话。",
  ],
  [
    "Dịch vụ xử lý định dạng ảnh này chưa sẵn sàng. Vui lòng thử lại sau.",
    "The service for processing this image format is not ready. Try again later.",
    "此图片格式的处理服务尚未就绪。请稍后重试。",
  ],
  [
    "Dịch vụ xử lý ảnh chưa sẵn sàng. Vui lòng thử lại sau.",
    "The image-processing service is not ready. Try again later.",
    "图片处理服务尚未就绪。请稍后重试。",
  ],
  [
    "Dữ liệu JSON không hợp lệ hoặc sai định dạng yêu cầu.",
    "The JSON data is invalid or the request format is incorrect.",
    "JSON 数据无效或请求格式不正确。",
  ],
  [
    "Dữ liệu bàn giao không thể xác minh an toàn.",
    "The handover data cannot be safely verified.",
    "无法安全验证交接数据。",
  ],
  [
    "Dữ liệu gửi lên chứa ký tự không hợp lệ (không phải UTF-8).",
    "The submitted data contains invalid characters that are not UTF-8.",
    "提交的数据包含非 UTF-8 的无效字符。",
  ],
  [
    "Dữ liệu gửi lên chứa trường không được khai báo trong hợp đồng inbound/record.",
    "The submitted data contains fields not declared in the inbound/record contract.",
    "提交的数据包含 inbound/record 协议未声明的字段。",
  ],
  [
    "Dữ liệu gửi lên chứa trường không được khai báo trong hợp đồng outbound/record.",
    "The submitted data contains fields not declared in the outbound/record contract.",
    "提交的数据包含 outbound/record 协议未声明的字段。",
  ],
  [
    "Dữ liệu gửi lên chứa trường không được khai báo trong hợp đồng xuất linh kiện.",
    "The submitted data contains fields not declared in the component issue contract.",
    "提交的数据包含配件出库协议未声明的字段。",
  ],
  [
    "Dữ liệu nháp đã thay đổi; chạy lại close-check.",
    "Draft data has changed. Run close-check again.",
    "草稿数据已更改。请重新执行 close-check。",
  ],
  [
    "Dữ liệu tồn kho đã bị thay đổi bởi thao tác khác, vui lòng thử lại.",
    "Stock data was changed by another operation. Please try again.",
    "库存数据已被其他操作修改。请重试。",
  ],
  [
    "Dữ liệu đã thay đổi bởi request khác.",
    "The data was changed by another request.",
    "数据已被其他请求修改。",
  ],
  [
    "Dữ liệu đã được cập nhật bởi phiên khác; tải lại trước khi lưu.",
    "The data was updated by another session. Reload before saving.",
    "数据已被其他会话更新。请重新加载后再保存。",
  ],
  [
    "Email phải đúng định dạng chữ thường, không có khoảng trắng hoặc chữ hoa.",
    "The email must use lowercase letters and contain no spaces or uppercase letters.",
    "电子邮件地址必须使用小写字母，不能包含空格或大写字母。",
  ],
  [
    "Email đã được sử dụng.",
    "The email is already in use.",
    "此电子邮件地址已被使用。",
  ],
  [
    "Email, tài khoản hoặc mật khẩu không đúng.",
    "The email, username or password is incorrect.",
    "电子邮件地址、账号或密码不正确。",
  ],
  [
    "Excel phải có header và ít nhất một dòng dữ liệu.",
    "The Excel file must contain a header and at least one data row.",
    "Excel 文件必须包含表头和至少一行数据。",
  ],
  [
    "Excel rejected with row-level errors.",
    "Excel rejected with row-level errors.",
    "Excel 校验未通过，存在行级错误。",
  ],
  ["Excel validated.", "Excel validated.", "Excel 校验通过。"],
  [
    "Expected qty không được nhỏ hơn số lượng đã scan.",
    "Expected qty cannot be less than the scanned quantity.",
    "预期数量不能小于已扫描数量。",
  ],
  [
    "FULL_FIXTURE_SEED_BUSY: no seed phase started.",
    "FULL_FIXTURE_SEED_BUSY: no seed phase started.",
    "FULL_FIXTURE_SEED_BUSY：未启动任何初始化阶段。",
  ],
  [
    "FULL_FIXTURE_SEED_PROTECTED_DATABASE: no master or fixture writes authorized.",
    "FULL_FIXTURE_SEED_PROTECTED_DATABASE: no master or fixture writes authorized.",
    "FULL_FIXTURE_SEED_PROTECTED_DATABASE：未授权写入主数据或测试数据。",
  ],
  [
    "File export này đã hết hạn.",
    "This export file has expired.",
    "此导出文件已过期。",
  ],
  [
    "File import không có dòng dữ liệu.",
    "The import file contains no data rows.",
    "导入文件没有数据行。",
  ],
  [
    "File lỗi của Import báo cáo này đã hết hạn.",
    "The error file for this import report has expired.",
    "此导入报告的错误文件已过期。",
  ],
  [
    "File trùng nội dung với lần import trước; trả lại kết quả cũ, không tạo import mới.",
    "The file has the same content as a previous import. Returning the previous result without creating a new import.",
    "文件内容与之前的导入相同。将返回之前的结果，不会创建新的导入任务。",
  ],
  [
    "Form phải là object, không phải danh sách.",
    "Form must be an object rather than a list.",
    "Form 必须为对象，不能为列表。",
  ],
  [
    "Form vượt giới hạn kích thước hoặc độ sâu.",
    "Form exceeds the size or depth limit.",
    "Form 超过大小或嵌套深度限制。",
  ],
  [
    "Full scan phải tạo Nhãn đóng gói Nháp; toàn bộ transaction sẽ rollback.",
    "Full scan must create a draft packing label. The entire transaction will be rolled back.",
    "完整扫描必须创建草稿包装标签。整个事务将回滚。",
  ],
  [
    "Full scan phải tạo Packing Label DRAFT; toàn bộ transaction sẽ rollback.",
    "Full scan must create a draft packing label. The entire transaction will be rolled back.",
    "完整扫描必须创建草稿包装标签。整个事务将回滚。",
  ],
  [
    "GET P21 không nhận header mutation; key đối chiếu nằm ở đường dẫn.",
    "GET P21 does not accept mutation headers. The reconciliation key is part of the path.",
    "GET P21 不接受写入操作请求头。对账键位于路径中。",
  ],
  [
    "GET chỉ nhận query được công bố; không suy vị trí hoặc bỏ qua bộ lọc.",
    "GET only accepts documented query parameters. Do not infer locations or skip filters.",
    "GET 仅接受已公布的查询参数。请勿推断位置或跳过筛选条件。",
  ],
  [
    "GET danh sách trộn không nhận body.",
    "Mixed-list GET requests do not accept a body.",
    "混合列表的 GET 请求不接受请求体。",
  ],
  [
    "Ghi nhận phiếu nguồn phải liên kết bản nháp P03 để đối chiếu đúng yêu cầu.",
    "Recording the source document must link the P03 draft to reconcile the correct request.",
    "提交源单据时必须关联 P03 草稿，以核对正确的请求。",
  ],
  [
    "Giải mã PII thất bại (ciphertext hỏng, sai khoá, hoặc bị sửa).",
    "PII decryption failed: the ciphertext is damaged, the key is incorrect, or the data was modified.",
    "个人信息解密失败：密文损坏、密钥不正确或数据遭到修改。",
  ],
  [
    "Giữ body multipart của đúng owner, không thêm trường ngoài contract.",
    "Keep the multipart body for the correct owner and do not add fields outside the contract.",
    "请保留对应业务的 multipart 请求体，不要添加协议之外的字段。",
  ],
  [
    "Giữ chỗ hết hạn hoặc không thuộc phiên/kho hiện tại; đối chiếu trước khi thao tác tiếp.",
    "The reservation has expired or does not belong to the current session or warehouse. Reconcile before proceeding.",
    "预留已过期或不属于当前会话或仓库。请先核对，再继续操作。",
  ],
  [
    "Giữ chỗ không còn hiệu lực sau khi chờ khóa.",
    "The reservation became invalid while waiting for the lock.",
    "等待锁期间，预留已失效。",
  ],
  [
    "Giữ chỗ không còn hợp lệ; đối chiếu trước khi tiếp tục.",
    "The reservation is no longer valid. Reconcile before continuing.",
    "预留已失效。请先核对，再继续操作。",
  ],
  [
    "Giữ đúng contract của yêu cầu đã gửi; không chuyển sang luồng cũ.",
    "Keep the original request contract and do not switch to the legacy flow.",
    "请保持原请求协议，不要切换到旧流程。",
  ],
  [
    "Giữ đúng yêu cầu, body và phiên bản đã gửi; không tự thay khóa để gửi lại.",
    "Keep the original request, body and version. Do not change the key to resend it.",
    "请保持原请求、请求体和版本，不要自行更换键后重新发送。",
  ],
  [
    "Gửi ALL hoặc DATE/RANGE với date_field=created_at và ngày hợp lệ.",
    "Send ALL, or DATE/RANGE with date_field=created_at and valid dates.",
    "请发送 ALL，或使用 date_field=created_at 和有效日期的 DATE/RANGE。",
  ],
  [
    "Gửi Idempotency-Key (8–100 ký tự) và X-Request-ID dạng UUID; giữ nguyên cả hai khi đối chiếu.",
    "Send Idempotency-Key with 8–100 characters and X-Request-ID as a UUID. Keep both unchanged when reconciling.",
    "请发送 8–100 个字符的 Idempotency-Key，以及 UUID 格式的 X-Request-ID。核对时请保持两者不变。",
  ],
  [
    "Gửi If-Match theo ETag mới nhất.",
    "Send If-Match using the latest ETag.",
    "请根据最新的 ETag 发送 If-Match。",
  ],
  [
    "Gửi JSON body, không gửi query cho thao tác này.",
    "Send a JSON body rather than query parameters for this operation.",
    "此操作请发送 JSON 请求体，不要发送查询参数。",
  ],
  [
    "Gửi JSON body, không kèm query.",
    "Send a JSON body without query parameters.",
    "请发送 JSON 请求体，不要附带查询参数。",
  ],
  [
    "Gửi đúng một raw_code hoặc item_id.",
    "Send exactly one of raw_code or item_id.",
    "raw_code 和 item_id 必须且只能提供一个。",
  ],
  [
    "Hai mã phiếu không khớp nhau.",
    "The two document codes do not match.",
    "两个单据编号不匹配。",
  ],
  [
    "Handoff thiếu identity, version hoặc timestamp được xác minh.",
    "The handoff is missing verified identity, version or timestamp information.",
    "交接缺少已验证的身份、版本或时间戳信息。",
  ],
  [
    "Hardware UID đã gắn cho item khác.",
    "The hardware UID is already linked to another item.",
    "硬件 UID 已关联到其他物品。",
  ],
  [
    "Header Idempotency-Key là bắt buộc cho thao tác này.",
    "The Idempotency-Key header is required for this operation.",
    "此操作必须提供 Idempotency-Key 请求头。",
  ],
  [
    "Header P21 chỉ dành cho GET; mutation phải theo owner P03/P19.",
    "The P21 header is for GET only. Mutations must use the P03/P19 owner flow.",
    "P21 请求头仅用于 GET。写入操作必须遵循 P03/P19 对应业务流程。",
  ],
  [
    'Header X-WMS-Token-Transport chỉ nhận "cookie" hoặc "body".',
    'The X-WMS-Token-Transport header only accepts "cookie" or "body".',
    "X-WMS-Token-Transport 请求头仅接受“cookie”或“body”。",
  ],
  [
    "Hiện vật chưa có serial/mã vật lý ổn định nên không dựng được payload để ghi vào chip.",
    "The item has no stable serial or physical code, so a payload cannot be generated for writing to the chip.",
    "此物品没有稳定的序列号或实物编码，无法生成写入芯片的数据。",
  ],
  [
    "Hiện vật không thuộc SKU linh kiện; không tự phân loại lại.",
    "The item is not a component SKU. Do not reclassify it automatically.",
    "此物品不属于配件 SKU。请勿自动重新分类。",
  ],
  [
    "Hiện vật đang được một máy khác chuẩn bị ghi chip; thử lại sau khi hết hạn giữ chỗ.",
    "Another device is preparing a chip write for this item. Retry after the reservation expires.",
    "另一台设备正在为此物品准备写入芯片。请在预留到期后重试。",
  ],
  [
    "Hiện vật đang được một máy khác giữ chỗ ghi chip; không thể xác nhận từ phiên này.",
    "Another device has reserved this item for a chip write. This session cannot confirm it.",
    "另一台设备已预留此物品以写入芯片。当前会话无法确认。",
  ],
  [
    "Hiện vật đang được phiên khác giữ chỗ.",
    "The item is reserved by another session.",
    "此物品已被其他会话预留。",
  ],
  [
    "Hiện vật đã có chip NFC đang hoạt động; gửi replace_existing=true kèm lý do nếu thay chip.",
    "The item already has an active NFC chip. To replace it, send replace_existing=true and a reason.",
    "此物品已有已启用的 NFC 芯片。如需替换，请发送 replace_existing=true 并填写原因。",
  ],
  [
    "Hiện vật đã có chip NFC đang hoạt động; gửi replace_existing=true kèm reason nếu thay chip.",
    "The item already has an active NFC chip. To replace it, send replace_existing=true and a reason.",
    "此物品已有已启用的 NFC 芯片。如需替换，请发送 replace_existing=true 并填写原因。",
  ],
  [
    "Hiện vật đã có chip NFC đang hoạt động; thu hồi chip cũ hoặc confirm kèm replace_existing.",
    "The item already has an active NFC chip. Revoke the old chip or confirm with replace_existing.",
    "此物品已有已启用的 NFC 芯片。请撤销旧芯片，或确认时提供 replace_existing。",
  ],
  [
    "Hiện vật đã có chip hoạt động; P07 không cho phép thay thế.",
    "The item already has an active chip. P07 does not allow replacement.",
    "此物品已有已启用的芯片。P07 不允许替换。",
  ],
  [
    "Hiện vật đã có chip hoạt động; không được tự thay thế.",
    "The item already has an active chip. Do not replace it automatically.",
    "此物品已有已启用的芯片。请勿自动替换。",
  ],
  [
    "Hiện vật đã có hồ sơ bảo hành đang hoạt động.",
    "The item already has an active warranty case.",
    "此物品已有正在处理的保修单。",
  ],
  [
    "Hoàn tất bảo hành bắt buộc ghi kết quả xử lý (note).",
    "Completing a warranty case requires a resolution note (note).",
    "完成保修处理时必须填写处理结果（note）。",
  ],
  [
    "Hoàn tất xuất kho sẽ làm tồn/available_qty âm.",
    "Posting the issue would make stock or available_qty negative.",
    "出库过账将导致库存或 available_qty 为负数。",
  ],
  [
    "Post Issue sẽ làm tồn/available_qty âm.",
    "Posting the issue would make stock or available_qty negative.",
    "出库过账将导致库存或 available_qty 为负数。",
  ],
  [
    "Hệ thống chỉ cho phép một kho Đang hoạt động; hãy ngừng kích hoạt kho hiện tại trước.",
    "Only one warehouse can be active. Deactivate the current warehouse first.",
    "系统仅允许一个已启用的仓库。请先停用当前仓库。",
  ],
  [
    "Hệ thống chỉ cho phép một kho ACTIVE; hãy ngừng kích hoạt kho hiện tại trước.",
    "Only one warehouse can be active. Deactivate the current warehouse first.",
    "系统仅允许一个已启用的仓库。请先停用当前仓库。",
  ],
  [
    "Hệ thống chỉ vận hành đúng 1 kho tổng; không được tạo thêm kho.",
    "The system operates with exactly one central warehouse. Additional warehouses cannot be created.",
    "系统仅使用一个总仓库，不允许创建更多仓库。",
  ],
  [
    "Hồ sơ App PV đã được cập nhật bởi phiên khác; tải lại trước khi bật/tắt publish.",
    "The App PV profile was updated by another session. Reload before changing its publish status.",
    "App PV 资料已被其他会话更新。请重新加载后再更改发布状态。",
  ],
  [
    "Hồ sơ cũ chưa xác nhận kho sở hữu; cần quản trị đối chiếu trước khi thao tác.",
    "The legacy case has no verified owning warehouse. An administrator must reconcile it before any operation.",
    "旧保修单尚未确认所属仓库。操作前需由管理员核对。",
  ],
  [
    "Hồ sơ vừa được cập nhật; tải lại trước khi sửa.",
    "The case was just updated. Reload before editing.",
    "保修单刚刚更新。请重新加载后再编辑。",
  ],
  [
    "Hồ sơ đã thay đổi; đọc lại trước khi lưu.",
    "The case has changed. Read it again before saving.",
    "保修单已更改。请重新读取后再保存。",
  ],
  [
    "Hồ sơ đã đóng, không được cập nhật.",
    "The case is closed and cannot be updated.",
    "保修单已关闭，无法更新。",
  ],
  [
    "Hồ sơ đã được cập nhật ở phiên khác; tải lại trước khi lưu.",
    "The case was updated in another session. Reload before saving.",
    "保修单已被其他会话更新。请重新加载后再保存。",
  ],
  [
    "Hồ sơ, kho hoặc metadata không khớp snapshot đã lưu.",
    "The case, warehouse or metadata does not match the saved snapshot.",
    "保修单、仓库或元数据与已保存的快照不匹配。",
  ],
  [
    "Hủy case bảo hành bắt buộc có lý do/bằng chứng.",
    "Canceling a warranty case requires a reason or supporting evidence.",
    "取消保修单时必须提供原因或凭证。",
  ],
  [
    "ID lịch sử không đúng định dạng nguồn:UUID.",
    "The history ID must use the source:UUID format.",
    "历史记录 ID 必须使用 source:UUID 格式。",
  ],
  [
    "ID phải là NFC:UUID của đúng đối tượng.",
    "The ID must be NFC:UUID for the correct object.",
    "ID 必须为对应对象的 NFC:UUID。",
  ],
  [
    "Idempotency lease không còn tồn tại trước khi chạy nghiệp vụ.",
    "The idempotency lease no longer exists before the operation starts.",
    "业务操作开始前，幂等租约已不存在。",
  ],
  [
    "Idempotency-Key của P03 phải là UUID.",
    "The P03 Idempotency-Key must be a UUID.",
    "P03 的 Idempotency-Key 必须为 UUID。",
  ],
  [
    "Idempotency-Key là bắt buộc.",
    "Idempotency-Key is required.",
    "必须提供 Idempotency-Key。",
  ],
  [
    "Idempotency-Key phải là UUID của đúng yêu cầu.",
    "Idempotency-Key must be the UUID of the correct request.",
    "Idempotency-Key 必须为对应请求的 UUID。",
  ],
  [
    "Idempotency-Key phải là UUID hợp lệ.",
    "Idempotency-Key must be a valid UUID.",
    "Idempotency-Key 必须为有效的 UUID。",
  ],
  [
    "Idempotency-Key phải từ 8 đến 100 ký tự.",
    "Idempotency-Key must contain 8 to 100 characters.",
    "Idempotency-Key 必须包含 8 至 100 个字符。",
  ],
  [
    "If-Match là bắt buộc cho Component Issue mutation.",
    "If-Match is required for component issue mutations.",
    "修改配件出库单时必须提供 If-Match。",
  ],
  [
    "If-Match là bắt buộc cho SKU update.",
    "If-Match is required for SKU updates.",
    "更新 SKU 时必须提供 If-Match。",
  ],
  [
    "If-Match là bắt buộc cho container mutation.",
    "If-Match is required for container mutations.",
    "修改容器时必须提供 If-Match。",
  ],
  [
    "If-Match là bắt buộc cho lệnh in/in lại Nhãn đóng gói.",
    "If-Match is required for packing label print or reprint commands.",
    "打印或重新打印包装标签时必须提供 If-Match。",
  ],
  [
    "If-Match là bắt buộc cho lệnh in/in lại Packing Label.",
    "If-Match is required for packing label print or reprint commands.",
    "打印或重新打印包装标签时必须提供 If-Match。",
  ],
  [
    "If-Match là bắt buộc cho mutation trên chứng từ hiện hữu.",
    "If-Match is required for mutations to an existing document.",
    "修改现有单据时必须提供 If-Match。",
  ],
  [
    "If-Match là bắt buộc cho physical-code mutation.",
    "If-Match is required for physical-code mutations.",
    "修改实物编码时必须提供 If-Match。",
  ],
  [
    "If-Match là bắt buộc cho scan/post mutation.",
    "If-Match is required for scan or post mutations.",
    "扫描或过账操作必须提供 If-Match。",
  ],
  [
    "If-Match là bắt buộc cho scan/post/điều chỉnh tồn kho mutation.",
    "If-Match is required for scan, post or stock reversal mutations.",
    "扫描、过账或库存冲销操作必须提供 If-Match。",
  ],
  [
    "If-Match là bắt buộc cho scan/post/reversal mutation.",
    "If-Match is required for scan, post or stock reversal mutations.",
    "扫描、过账或库存冲销操作必须提供 If-Match。",
  ],
  [
    "If-Match là bắt buộc khi Confirm toa xuất.",
    "If-Match is required when confirming an outbound request.",
    "确认出库申请时必须提供 If-Match。",
  ],
  ["If-Match là bắt buộc.", "If-Match is required.", "必须提供 If-Match。"],
  [
    "If-Match phải là ETag phiên bản số nguyên có dấu nháy kép.",
    "If-Match must be a double-quoted integer version ETag.",
    "If-Match 必须为带双引号的整数版本 ETag。",
  ],
  [
    "If-Match phải là phiên bản có dấu nháy kép.",
    "If-Match must be a double-quoted version.",
    "If-Match 必须为带双引号的版本号。",
  ],
  [
    "If-Match phải là phiên bản nháp dương có dấu nháy kép.",
    "If-Match must be a double-quoted positive draft version.",
    "If-Match 必须为带双引号的正整数草稿版本。",
  ],
  [
    "If-Match phải là phiên bản số nguyên dương hoặc ETag tương ứng.",
    "If-Match must be a positive integer version or the corresponding ETag.",
    "If-Match 必须为正整数版本或对应的 ETag。",
  ],
  [
    'If-Match phải là phiên bản số nguyên dương, ví dụ "1".',
    'If-Match must be a positive integer version, such as "1".',
    "If-Match 必须为正整数版本，例如“1”。",
  ],
  [
    "If-Match phải là phiên bản số nguyên dương.",
    "If-Match must be a positive integer version.",
    "If-Match 必须为正整数版本。",
  ],
  [
    "If-Match phải là số nguyên dương.",
    "If-Match must be a positive integer.",
    "If-Match 必须为正整数。",
  ],
  [
    "If-Match phải là version số nguyên dương.",
    "If-Match must be a positive integer version.",
    "If-Match 必须为正整数版本。",
  ],
  [
    "If-Match phải là version số nguyên không âm.",
    "If-Match must be a nonnegative integer version.",
    "If-Match 必须为非负整数版本。",
  ],
  [
    "If-Match phải là version số nguyên.",
    "If-Match must be an integer version.",
    "If-Match 必须为整数版本。",
  ],
  [
    "If-Match/version là bắt buộc.",
    "If-Match/version is required.",
    "必须提供 If-Match/version。",
  ],
  [
    "Import SKU đã commit nguyên tử.",
    "The SKU import was committed atomically.",
    "SKU 导入已以原子事务提交。",
  ],
  [
    "Import báo cáo này không có file lỗi để tải.",
    "This import report has no error file to download.",
    "此导入报告没有可下载的错误文件。",
  ],
  [
    "Import bị từ chối; không có SKU nào được tạo hoặc cập nhật.",
    "The import was rejected. No SKUs were created or updated.",
    "导入被拒绝。未创建或更新任何 SKU。",
  ],
  [
    "Import bị từ chối; không có SKU/hồ sơ nào được tạo.",
    "The import was rejected. No SKUs or profiles were created.",
    "导入被拒绝。未创建任何 SKU 或资料。",
  ],
  [
    "Import catalogue App PV đã commit nguyên tử. published_to_app=false cho toàn bộ SKU vừa tạo.",
    "The App PV catalog import was committed atomically. published_to_app=false for every newly created SKU.",
    "App PV 目录导入已以原子事务提交。所有新建 SKU 的 published_to_app=false。",
  ],
  [
    "Import còn row lỗi chưa resolve nên không được Confirm.",
    "The import still has unresolved row errors and cannot be confirmed.",
    "导入仍有未解决的行级错误，无法确认。",
  ],
  [
    "Import không có row hợp lệ để consume.",
    "The import has no valid rows to consume.",
    "导入没有可处理的有效行。",
  ],
  ["Import không tìm thấy.", "The import was not found.", "未找到导入任务。"],
  ["Import not found.", "The import was not found.", "未找到导入任务。"],
  [
    "Initial Putaway chỉ nhận BOX ở trạng thái Chờ xếp khay; BOX đã Đã xếp khay phải dùng nghiệp vụ relocation riêng.",
    "Initial putaway only accepts BOX containers awaiting putaway. Stored BOX containers must use the separate relocation operation.",
    "首次上架仅接受待上架的 BOX。已上架的 BOX 必须使用单独的移位操作。",
  ],
  [
    "Initial Putaway chỉ nhận BOX ở trạng thái RECEIVED_PENDING_PUTAWAY; BOX đã STORED phải dùng nghiệp vụ relocation riêng.",
    "Initial putaway only accepts BOX containers awaiting putaway. Stored BOX containers must use the separate relocation operation.",
    "首次上架仅接受待上架的 BOX。已上架的 BOX 必须使用单独的移位操作。",
  ],
  [
    "Inventory serial không tồn tại.",
    "The inventory serial does not exist.",
    "库存序列号不存在。",
  ],
  [
    "Issue/Component Issue item đang ở downstream state không thể nhận return trực tiếp.",
    "The issue or component issue item is in a downstream state and cannot be returned directly.",
    "出库或配件出库物品已进入后续业务状态，无法直接退回。",
  ],
  [
    "Item bị trùng trong container payload.",
    "The container payload contains a duplicate item.",
    "容器请求数据中包含重复物品。",
  ],
  [
    "Item candidate đang thuộc một inbound chưa Post khác.",
    "The candidate item belongs to another inbound document that has not been posted.",
    "候选物品属于另一张尚未过账的入库单。",
  ],
  [
    "Item chưa được match vào phiếu xuất này nên không thể gắn RFID.",
    "The item is not matched to this issue document, so RFID cannot be attached.",
    "物品未匹配到此出库单，无法关联 RFID。",
  ],
  [
    "Item của dòng nhập không còn ở trạng thái NEW.",
    "The inbound line item no longer has status NEW.",
    "入库行的物品已不处于 NEW 状态。",
  ],
  [
    "Item hiện không ở trạng thái IN_STOCK nên không thể xuất.",
    "The item is not currently IN_STOCK and cannot be issued.",
    "物品当前不处于 IN_STOCK 状态，无法出库。",
  ],
  [
    "Item instance đã bị thay đổi bởi thao tác khác, vui lòng tải lại dữ liệu.",
    "The item instance was changed by another operation. Reload the data.",
    "物品实例已被其他操作修改。请重新加载数据。",
  ],
  [
    "Item không tồn tại hoặc không thuộc SKU của dòng.",
    "The item does not exist or does not belong to the line's SKU.",
    "物品不存在或不属于该行的 SKU。",
  ],
  [
    "Item phải đã xuất cho khách trước khi tiếp nhận bảo hành.",
    "The item must have been issued to the customer before warranty intake.",
    "接收保修前，物品必须已出库给客户。",
  ],
  [
    "Item phải ở trạng thái IN_STOCK trước khi match outbound.",
    "The item must have status IN_STOCK before matching to an outbound document.",
    "匹配出库单前，物品必须处于 IN_STOCK 状态。",
  ],
  [
    "Item scan không thuộc SKU của dòng chứng từ.",
    "The scanned item does not belong to the document line's SKU.",
    "扫描物品不属于单据行的 SKU。",
  ],
  [
    "Item scan đã được ghi nhận hoặc không ở trạng thái NEW.",
    "The scanned item was already recorded or no longer has status NEW.",
    "扫描物品已被记录，或不处于 NEW 状态。",
  ],
  [
    "Item theo serial phải có số lượng = 1.",
    "Serial-tracked items must have quantity = 1.",
    "按序列号管理的物品数量必须为 1。",
  ],
  [
    "Item theo serial phải có quantity = 1.",
    "Serial-tracked items must have quantity = 1.",
    "按序列号管理的物品数量必须为 1。",
  ],
  [
    "Item trong QR chưa tồn tại trong WMS nên không thể xuất kho.",
    "The item in the QR code does not exist in WMS and cannot be issued.",
    "二维码中的物品在 WMS 中不存在，无法出库。",
  ],
  [
    "Item đang thuộc một inbound chưa Post khác.",
    "The item belongs to another inbound document that has not been posted.",
    "物品属于另一张尚未过账的入库单。",
  ],
  [
    "Item đang được giữ bởi một phiếu xuất khác chưa hoàn tất.",
    "The item is reserved by another unfinished issue document.",
    "物品已被另一张尚未完成的出库单占用。",
  ],
  [
    "Item đang được một phiếu xuất khác giữ.",
    "The item is reserved by another issue document.",
    "物品已被另一张出库单占用。",
  ],
];
