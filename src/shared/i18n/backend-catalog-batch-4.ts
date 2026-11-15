/** Source-backed interpolated backend messages; see outputs/i18n-audit/backend-batch-4.json. */
import type { BackendCatalogEntry } from "./backend-catalog.types";

export const BACKEND_CATALOG_BATCH_4: ReadonlyArray<BackendCatalogEntry> = [
  [
    'Blind index key id "{value0}" không có trong keyring.',
    'Blind index key id "{value0}" is missing from the keyring.',
    "密钥环中缺少盲索引密钥 ID“{value0}”。",
  ],
  [
    "Bạn chỉ được cấp hoặc thu hồi những quyền mà chính bạn đang có. Yêu cầu này đụng tới {value0} quyền nằm ngoài phạm vi của bạn.",
    "You can only grant or revoke permissions you hold. This request includes {value0} permissions outside your scope.",
    "您只能授予或撤销自己拥有的权限。此请求包含 {value0} 项超出您权限范围的权限。",
  ],
  [
    "Bản PDF chỉ dựng được tối đa {value0} dòng (kết quả hiện tại {value1} dòng). Hãy thu hẹp bộ lọc, hoặc chọn Xuất XLSX nếu cần trọn dữ liệu.",
    "PDF output supports at most {value0} rows (the current result has {value1} rows). Narrow the filters, or export XLSX for the full data.",
    "PDF 最多支持 {value0} 行（当前结果为 {value1} 行）。请缩小筛选范围，或导出 XLSX 获取全部数据。",
  ],
  [
    "Bộ lọc `{value0}` không dùng được trên dữ liệu hiện tại.",
    "Filter `{value0}` cannot be used with the current data.",
    "筛选条件 `{value0}` 无法用于当前数据。",
  ],
  [
    "Chưa đủ thông tin bàn giao: {value0}.",
    "Handover information is incomplete: {value0}.",
    "交接信息不完整：{value0}。",
    {
      value0: "handover",
    },
  ],
  [
    "Chỉ Nháp/Đang quét mới được {value0}.",
    "Only draft or scanning documents allow this action: {value0}.",
    "只有草稿或扫描中的单据才能执行此操作：{value0}。",
    {
      value0: "action",
    },
  ],
  [
    "Chỉ DRAFT/SCANNING mới được {value0}.",
    "Only draft or scanning documents allow this action: {value0}.",
    "只有草稿或扫描中的单据才能执行此操作：{value0}。",
    {
      value0: "action",
    },
  ],
  [
    "Chỉ chấp nhận file {value0}.",
    "Only {value0} files are accepted.",
    "仅支持 {value0} 文件。",
    {
      value0: "extensions",
    },
  ],
  [
    "Chỉ hồ sơ bảo hành đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện {value0}.",
    "Components can only be issued for warranty cases that are being checked or repaired {value0}.",
    "只有处于检测中或维修中的保修单才能领用配件（{value0}）。",
    {
      value0: "phase",
    },
  ],
  [
    "Chỉ in lại được Nhãn đóng gói đã Đã in; trạng thái hiện tại {value0}.",
    "Only printed packing labels can be reprinted; the current status is {value0}.",
    "只有已打印的包装标签才能重新打印；当前状态为 {value0}。",
    {
      value0: "status",
    },
  ],
  [
    "Chỉ in lại được Packing Label đã PRINTED; trạng thái hiện tại {value0}.",
    "Only printed packing labels can be reprinted; the current status is {value0}.",
    "只有已打印的包装标签才能重新打印；当前状态为 {value0}。",
    {
      value0: "status",
    },
  ],
  [
    "Cột bị lặp: {value0}.",
    "Duplicate column: {value0}.",
    "列重复：{value0}。",
  ],
  [
    "Cột không hỗ trợ: {value0}.",
    "Unsupported column: {value0}.",
    "不支持的列：{value0}。",
  ],
  [
    "File import trải dài quá {value0} dòng bảng tính (kể cả dòng trống); vui lòng xoá bớt dòng trống thừa rồi import lại.",
    "The import file spans more than {value0} spreadsheet rows, including blank rows. Remove unnecessary blank rows and import again.",
    "导入文件的工作表行数超过 {value0} 行（包括空行）。请删除多余空行后重新导入。",
  ],
  [
    "File import vượt quá {value0} dòng dữ liệu.",
    "The import file exceeds {value0} data rows.",
    "导入文件的数据行数超过 {value0} 行。",
  ],
  [
    "File import vượt quá {value0}MB.",
    "The import file exceeds {value0}MB.",
    "导入文件超过 {value0}MB。",
  ],
  [
    "Giá trị lọc '{value0}' phải là số nguyên hoặc UUID.",
    "Filter value '{value0}' must be an integer or UUID.",
    "筛选值“{value0}”必须为整数或 UUID。",
  ],
  [
    "Gắn container vào TRAY là thao tác putaway; dùng POST /putaway-tasks rồi confirm (If-Match), không dùng {value0}.",
    "Placing a container in a TRAY is a putaway operation. Use POST /putaway-tasks and then confirm with If-Match, rather than {value0}.",
    "将容器放入 TRAY 属于上架操作。请使用 POST /putaway-tasks，再通过 If-Match 确认，而非 {value0}。",
  ],
  [
    "Item đang được giữ bởi phiếu xuất {value0} ({value1}). Hãy gỡ match, hủy hoặc hoàn tất phiếu đó trước khi quét item vào phiếu hiện tại.",
    "This item is reserved by issue document {value0} ({value1}). Remove its match, cancel it, or complete that document before scanning the item into the current document.",
    "此物品已被出库单 {value0}（{value1}）占用。请先解除匹配、取消或完成该单据，再将物品扫描到当前单据。",
    {
      value1: "status",
    },
  ],
  [
    'Kho "{value0}" đang ngừng hoạt động, không thể thực hiện nghiệp vụ.',
    'Warehouse "{value0}" is inactive and cannot process operations.',
    "仓库“{value0}”已停用，无法执行业务操作。",
  ],
  [
    'Kho "{value0}" đang ngừng hoạt động.',
    'Warehouse "{value0}" is inactive.',
    "仓库“{value0}”已停用。",
  ],
  [
    "Không cho phép {value0} -> {value1}.",
    "The transition {value0} -> {value1} is not allowed.",
    "不允许从 {value0} 转换为 {value1}。",
    {
      value0: "status",
      value1: "status",
    },
  ],
  [
    'Không có báo cáo với report_code "{value0}".',
    'No report exists with report_code "{value0}".',
    "不存在 report_code 为“{value0}”的报表。",
  ],
  [
    "Không ghi được file export vào đĩa '{value0}' (đường dẫn: {value1}).",
    "Could not write the export file to disk '{value0}' (path: {value1}).",
    "无法将导出文件写入磁盘“{value0}”（路径：{value1}）。",
  ],
  [
    'Không giải mã được PII: key id "{value0}" không còn trong keyring. Khoá cũ chỉ được gỡ SAU KHI `pii:reencrypt` chạy xong toàn bộ.',
    'Could not decrypt PII: key id "{value0}" is no longer in the keyring. Remove old keys only AFTER `pii:reencrypt` has fully completed.',
    "无法解密个人信息：密钥 ID“{value0}”已不在密钥环中。只有在 `pii:reencrypt` 完全执行完毕后，才能移除旧密钥。",
  ],
  [
    "Không lưu được file export vào database (bảng {value0}): {value1}",
    "Could not save the export file in the database (table {value0}): {value1}",
    "无法将导出文件保存到数据库（表 {value0}）：{value1}",
    {
      value1: "message",
    },
  ],
  [
    "Không thể chuyển Nhãn đóng gói từ {value0} sang {value1}.",
    "Cannot change the packing label from {value0} to {value1}.",
    "无法将包装标签从 {value0} 转换为 {value1}。",
    {
      value0: "status",
      value1: "status",
    },
  ],
  [
    "Không thể chuyển Packing Label từ {value0} sang {value1}.",
    "Cannot change the packing label from {value0} to {value1}.",
    "无法将包装标签从 {value0} 转换为 {value1}。",
    {
      value0: "status",
      value1: "status",
    },
  ],
  [
    "Không thể chạy precheck: {value0}",
    "Could not run the precheck: {value0}",
    "无法执行预检查：{value0}",
    {
      value0: "message",
    },
  ],
  [
    'Không thể {value0} khi phiếu đang ở trạng thái "{value1}".',
    'Cannot {value0} while the document has status "{value1}".',
    "单据处于“{value1}”状态时，无法执行操作：{value0}。",
    {
      value0: "action",
      value1: "status",
    },
  ],
  [
    'Không thể {value0} khi yêu cầu đang ở trạng thái "{value1}".',
    'Cannot {value0} while the request has status "{value1}".',
    "申请处于“{value1}”状态时，无法执行操作：{value0}。",
    {
      value0: "action",
      value1: "status",
    },
  ],
  [
    "Không tìm thấy movement cho SKU '{value0}'.",
    "No stock movement was found for SKU '{value0}'.",
    "未找到 SKU“{value0}”的库存流水。",
  ],
  [
    'Không tìm thấy mã scan "{value0}".',
    'Scan code "{value0}" was not found.',
    "未找到扫描码“{value0}”。",
  ],
  [
    "Không tìm thấy {value0} Đang hoạt động với code {value1}.",
    "No active {value0} was found with code {value1}.",
    "未找到编码为 {value1} 的已启用{value0}。",
    {
      value0: "master",
    },
  ],
  [
    "Không tìm thấy {value0} ACTIVE với code {value1}.",
    "No active {value0} was found with code {value1}.",
    "未找到编码为 {value1} 的已启用{value0}。",
    {
      value0: "master",
    },
  ],
  [
    "Không tìm thấy {value0} Đang hoạt động với code {value1}. Master data phải được tạo trước qua POST /api/v1/brands hoặc /api/v1/product-categories.",
    "No active {value0} was found with code {value1}. Create the master data before importing.",
    "未找到编码为 {value1} 的已启用{value0}。请先创建主数据再导入。",
    {
      value0: "master",
    },
  ],
  [
    "Không tìm thấy {value0} ACTIVE với code {value1}. Master data phải được tạo trước qua POST /api/v1/brands hoặc /api/v1/product-categories.",
    "No active {value0} was found with code {value1}. Create the master data before importing.",
    "未找到编码为 {value1} 的已启用{value0}。请先创建主数据再导入。",
    {
      value0: "master",
    },
  ],
  [
    "Không đọc được file Excel: {value0}",
    "Could not read the Excel file: {value0}",
    "无法读取 Excel 文件：{value0}",
    {
      value0: "message",
    },
  ],
  [
    "LEDGER_MUTATED_DURING_REBUILD: stock_movements thay đổi trong lúc rebuild ({value0} -> {value1}). Rebuild không được ghi ledger; hãy chạy lại khi không có posting đồng thời.",
    "LEDGER_MUTATED_DURING_REBUILD: stock_movements changed during the rebuild ({value0} -> {value1}). Rebuilding must not write to the ledger. Retry when no posting operations are running concurrently.",
    "LEDGER_MUTATED_DURING_REBUILD：重建期间 stock_movements 发生变化（{value0} -> {value1}）。重建不得写入台账；请在没有并发过账操作时重试。",
  ],
  [
    "Linh kiện này đang được quét ở phiếu xuất linh kiện khác ({value0}) và chưa hủy/hoàn tất. Hủy dòng quét đó hoặc xử lý xong phiếu kia trước khi quét vào phiếu này.",
    "This component is already scanned on another unfinished component issue document ({value0}). Remove that scan or finish the other document before scanning it here.",
    "此配件已扫描到另一张尚未完成的配件出库单（{value0}）。请先移除该扫描记录或完成另一张单据，再扫描到此单据。",
  ],
  [
    "Mỗi case bảo hành chỉ được giữ tối đa {value0} video đính kèm.",
    "Each warranty case can retain at most {value0} attached videos.",
    "每张保修单最多保留 {value0} 个视频附件。",
  ],
  [
    "Mỗi case bảo hành chỉ được giữ tối đa {value0} ảnh đính kèm.",
    "Each warranty case can retain at most {value0} attached images.",
    "每张保修单最多保留 {value0} 张图片附件。",
  ],
  [
    "Mỗi phiếu chỉ được giữ tối đa {value0} chứng từ đính kèm.",
    "Each document can retain at most {value0} document attachments.",
    "每张单据最多保留 {value0} 个凭证附件。",
  ],
  [
    "Một toa chỉ được có một {value0}; giá trị khác nhau giữa các dòng cùng request_no.",
    "A request can have only one {value0}; rows with the same request_no have different values.",
    "每张申请只能有一个 {value0}；相同 request_no 的各行取值不一致。",
  ],
  [
    "Nhãn đóng gói phải Sẵn sàng in trước khi in; trạng thái hiện tại {value0}.",
    "The packing label must be ready to print before printing; the current status is {value0}.",
    "打印前，包装标签必须处于待打印状态；当前状态为 {value0}。",
    {
      value0: "status",
    },
  ],
  [
    "Packing Label phải READY_TO_PRINT trước khi in; trạng thái hiện tại {value0}.",
    "The packing label must be ready to print before printing; the current status is {value0}.",
    "打印前，包装标签必须处于待打印状态；当前状态为 {value0}。",
    {
      value0: "status",
    },
  ],
  [
    "No Data Dictionary fields parsed for {value0}.",
    "No Data Dictionary fields were parsed for {value0}.",
    "未解析出 {value0} 的数据字典字段。",
  ],
  [
    'PII active key id "{value0}" không có trong keyring "{value1}". Đổi active trước khi thêm khoá là cách chắc chắn nhất để hỏng cả ghi lẫn đọc.',
    'PII active key id "{value0}" is missing from keyring "{value1}". Changing the active key before adding it breaks both reads and writes.',
    "个人信息的活动密钥 ID“{value0}”不存在于密钥环“{value1}”中。添加密钥前就切换活动密钥会导致读写均失败。",
  ],
  [
    'PII key "{value0}" của keyring "{value1}" phải là 32 byte mã hoá base64 (sinh bằng `php artisan pii:make-key`).',
    'PII key "{value0}" in keyring "{value1}" must contain 32 bytes encoded as base64 (generate it with `php artisan pii:make-key`).',
    "密钥环“{value1}”中的个人信息密钥“{value0}”必须为经过 base64 编码的 32 字节密钥（使用 `php artisan pii:make-key` 生成）。",
  ],
  [
    'PII key id "{value0}" không có trong keyring.',
    'PII key id "{value0}" is missing from the keyring.',
    "密钥环中缺少个人信息密钥 ID“{value0}”。",
  ],
  [
    'PII keyring "{value0}" có phần tử rỗng.',
    'PII keyring "{value0}" contains an empty entry.',
    "个人信息密钥环“{value0}”包含空条目。",
  ],
  [
    'PII keyring "{value0}" phải là JSON dạng {"v1":"base64:..."} và không được rỗng.',
    'PII keyring "{value0}" must be a nonempty JSON object in the form {"v1":"base64:..."}.',
    '个人信息密钥环“{value0}”必须为非空 JSON 对象，格式为 {"v1":"base64:..."}。',
  ],
  [
    'PII keyring chưa được cấu hình cho mục đích "{value0}". Ngoài local/testing phải khai PII_ENCRYPTION_KEYS và PII_BLIND_INDEX_KEYS (sinh bằng `php artisan pii:make-key`).',
    'The PII keyring is not configured for purpose "{value0}". Outside local/testing, set PII_ENCRYPTION_KEYS and PII_BLIND_INDEX_KEYS (generate keys with `php artisan pii:make-key`).',
    "尚未为用途“{value0}”配置个人信息密钥环。在 local/testing 之外，必须设置 PII_ENCRYPTION_KEYS 和 PII_BLIND_INDEX_KEYS（使用 `php artisan pii:make-key` 生成密钥）。",
  ],
  [
    "Phải ghi kết quả kiểm tra (confirmed_defect) trước khi chuyển sang {value0}.",
    "Record the inspection result (confirmed_defect) before changing the status to {value0}.",
    "转换为 {value0} 状态前，必须填写检测结果（confirmed_defect）。",
    {
      value0: "status",
    },
  ],
  [
    "SEED_{value0}_REQUIRES_REVIEW: {value1}; earlier writes may have committed; full-chain rollback is not claimed.",
    "SEED_{value0}_REQUIRES_REVIEW: {value1}; earlier writes may have committed; a full-chain rollback is not guaranteed.",
    "SEED_{value0}_REQUIRES_REVIEW：{value1}；之前的写入可能已提交，无法保证整个链路均已回滚。",
  ],
  [
    'Sheet "{value0}" không tồn tại trong file nguồn.',
    'Sheet "{value0}" does not exist in the source file.',
    "源文件中不存在工作表“{value0}”。",
  ],
  [
    "Sản phẩm SKU {value0} requires active RFID before Hoàn tất xuất kho.",
    "Product SKU {value0} requires an active RFID before posting the issue.",
    "产品 SKU {value0} 必须具有已启用的 RFID，才能完成出库过账。",
  ],
  [
    "PRODUCT SKU {value0} requires active RFID before Post Issue.",
    "Product SKU {value0} requires an active RFID before posting the issue.",
    "产品 SKU {value0} 必须具有已启用的 RFID，才能完成出库过账。",
  ],
  [
    "Tham số {value0} phải là ngày hợp lệ.",
    "Parameter {value0} must be a valid date.",
    "参数 {value0} 必须为有效日期。",
  ],
  [
    "Trường 'specifications.{value0}' không được chấp nhận ở importer này.",
    "Field 'specifications.{value0}' is not accepted by this importer.",
    "此导入器不支持字段“specifications.{value0}”。",
  ],
  [
    "Trường '{value0}' không được chấp nhận ở importer này.",
    "Field '{value0}' is not accepted by this importer.",
    "此导入器不支持字段“{value0}”。",
  ],
  [
    "Tồn kho không đủ cho sản phẩm {value0}.",
    "Insufficient stock for product {value0}.",
    "产品 {value0} 库存不足。",
  ],
  [
    "UIUX_V2_SEED_OPERATIONAL_COLLISION: {value0}",
    "UIUX_V2_SEED_OPERATIONAL_COLLISION: {value0}",
    "UIUX_V2_SEED_OPERATIONAL_COLLISION：业务初始化数据冲突，{value0}",
  ],
  [
    "UIUX_V2_SEED_OPERATIONAL_COLLISION: {value0}/{value1}",
    "UIUX_V2_SEED_OPERATIONAL_COLLISION: {value0}/{value1}",
    "UIUX_V2_SEED_OPERATIONAL_COLLISION：业务初始化数据冲突，{value0}/{value1}",
  ],
  [
    "Unsupported ERD PostgreSQL type: {value0}",
    "Unsupported ERD PostgreSQL type: {value0}",
    "不支持的 ERD PostgreSQL 类型：{value0}",
  ],
  [
    "VietnameseText: bảng dấu lệch độ dài (có dấu {value0} ký tự, không dấu {value1} ký tự).",
    "VietnameseText: the accent mapping has different lengths ({value0} accented characters, {value1} unaccented characters).",
    "VietnameseText：声调字符映射长度不一致（带声调字符 {value0} 个，不带声调字符 {value1} 个）。",
  ],
  [
    "WMS_FIXTURE_PASSWORD không đạt chính sách cho môi trường demo/UAT (truy cập được từ Internet): {value0}.",
    "WMS_FIXTURE_PASSWORD does not meet the password policy for an Internet-accessible demo/UAT environment: {value0}.",
    "WMS_FIXTURE_PASSWORD 不符合可从互联网访问的 demo/UAT 环境密码策略：{value0}。",
    {
      value0: "message",
    },
  ],
  [
    "category_code '{value0}' chưa được ánh xạ vào domain '{value1}' (config/public_api.php).",
    "category_code '{value0}' is not mapped to domain '{value1}' in config/public_api.php.",
    "config/public_api.php 中未将 category_code“{value0}”映射到 domain“{value1}”。",
  ],
  [
    "domain '{value0}' không có trong config/public_api.php.",
    "domain '{value0}' does not exist in config/public_api.php.",
    "config/public_api.php 中不存在 domain“{value0}”。",
  ],
  [
    "items.{value0} phải có inventory_serial_id hoặc product_id.",
    "items.{value0} must contain inventory_serial_id or product_id.",
    "items.{value0} 必须包含 inventory_serial_id 或 product_id。",
  ],
  [
    "per_page tối đa là {value0}.",
    "per_page must not exceed {value0}.",
    "per_page 不能超过 {value0}。",
  ],
  [
    "report_code không hỗ trợ export nền: {value0}.",
    "report_code does not support background export: {value0}.",
    "report_code 不支持后台导出：{value0}。",
  ],
  [
    "{value0} is not {value1}.",
    "{value0} is not {value1}.",
    "{value0} 与 {value1} 不符。",
    {},
    {
      value0: ["docs/HoaNam_ERD_Moi_Nhat.md"],
      value1: ["HN-WMS-ERD-DD-001"],
    },
  ],
  [
    "{value0} không phải UUID hợp lệ.",
    "{value0} is not a valid UUID.",
    "{value0} 不是有效的 UUID。",
  ],
  [
    "{value0} không tồn tại hoặc không Đang hoạt động.",
    "{value0} does not exist or is inactive.",
    "{value0} 不存在或未启用。",
  ],
  [
    "{value0} không tồn tại hoặc không ACTIVE.",
    "{value0} does not exist or is inactive.",
    "{value0} 不存在或未启用。",
  ],
  ["{value0} là bắt buộc.", "{value0} is required.", "{value0} 为必填项。"],
  [
    "{value0} phải là UUID.",
    "{value0} must be a UUID.",
    "{value0} 必须为 UUID。",
  ],
  [
    "{value0} phải là boolean.",
    "{value0} must be a boolean.",
    "{value0} 必须为布尔值。",
  ],
  [
    "{value0} phải là true hoặc false.",
    "{value0} must be true or false.",
    "{value0} 必须为 true 或 false。",
  ],
  [
    "{value0} phải thuộc {value1}.",
    "{value0} must be one of: {value1}.",
    "{value0} 必须为以下值之一：{value1}。",
  ],
  [
    "{value0} đã bị thay đổi bởi thao tác khác. Vui lòng tải lại dữ liệu mới nhất rồi thử lại.",
    "{value0} was changed by another operation. Reload the latest data and try again.",
    "{value0} 已被其他操作修改。请重新加载最新数据后重试。",
    {
      value0: "resource",
    },
  ],
  [
    "{value0} được gán phải tồn tại và đang Đang hoạt động.",
    "Assigned {value0} must exist and be active.",
    "分配的{value0}必须存在且已启用。",
    {
      value0: "master",
    },
  ],
  [
    "{value0} được gán phải tồn tại và đang ACTIVE.",
    "Assigned {value0} must exist and be active.",
    "分配的{value0}必须存在且已启用。",
    {
      value0: "master",
    },
  ],
  [
    "{value0}/{value1} không tồn tại hoặc không Đang hoạt động.",
    "{value0}/{value1} does not exist or is inactive.",
    "{value0}/{value1} 不存在或未启用。",
  ],
  [
    "{value0}/{value1} không tồn tại hoặc không ACTIVE.",
    "{value0}/{value1} does not exist or is inactive.",
    "{value0}/{value1} 不存在或未启用。",
  ],
];
