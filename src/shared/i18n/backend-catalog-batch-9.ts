/** Complete raw producer aliases reviewed in the full runtime corpus. */
export const BACKEND_CATALOG_BATCH_9: ReadonlyArray<
  readonly [string, string, string]
> = [
  [
    "Active authenticated owner required.",
    "Active authenticated owner required.",
    "必须由已登录且处于有效状态的归属用户操作。",
  ],
  [
    "Active owner warehouse required.",
    "Active owner warehouse required.",
    "归属仓库必须处于启用状态。",
  ],
  [
    "Balance nằm ngoài warehouse data scope hiện hành.",
    "The balance is outside your current warehouse data scope.",
    "库存余额不在您当前允许访问的仓库范围内。",
  ],
  [
    "Bằng chứng close-check không hợp lệ.",
    "The closing-check evidence is invalid.",
    "结束检查凭证无效。",
  ],
  [
    "Chuỗi base32 không hợp lệ.",
    "The base32 string is invalid.",
    "base32 字符串无效。",
  ],
  [
    "Chỉ original document POSTED mới được reversal.",
    "Only posted original documents can be reversed.",
    "只有已过账的原始单据才能冲销。",
  ],
  [
    "Chỉ phiếu xuất ở trạng thái DRAFT mới được sửa thông tin.",
    "Only draft issue notes allow their information to be edited.",
    "只有草稿状态的出库单才能修改信息。",
  ],
  [
    "Chứng từ gốc nằm ngoài warehouse data scope hiện hành.",
    "The original document is outside your current warehouse data scope.",
    "原始单据不在您当前允许访问的仓库范围内。",
  ],
  [
    "Chứng từ thiếu warehouse stock-effect.",
    "The document is missing its warehouse stock-effect information.",
    "单据缺少仓库库存影响信息。",
  ],
  [
    "Chứng từ đính kèm nằm ngoài warehouse data scope hiện hành.",
    "The attachment is outside your current warehouse data scope.",
    "附件不在您当前允许访问的仓库范围内。",
  ],
  [
    "Component Issue nằm ngoài warehouse data scope hiện hành.",
    "The component issue is outside your current warehouse data scope.",
    "配件出库单不在您当前允许访问的仓库范围内。",
  ],
  [
    "Component Issue version mismatch.",
    "The component issue version has changed.",
    "配件出库单版本已更改。",
  ],
  [
    "Component Issue yêu cầu warehouse ACTIVE.",
    "The component issue requires an active warehouse.",
    "配件出库必须使用已启用的仓库。",
  ],
  [
    "Confirmed warehouse scope required.",
    "A confirmed warehouse scope is required.",
    "必须先确认仓库范围。",
  ],
  [
    "Container con và parent phải cùng warehouse.",
    "Child and parent containers must belong to the same warehouse.",
    "子容器和父容器必须属于同一仓库。",
  ],
  [
    "Container version mismatch.",
    "The container version has changed.",
    "容器版本已更改。",
  ],
  [
    "Contract giữ số PX không hợp lệ.",
    "The PX number reservation contract is invalid.",
    "PX 编号预留接口约定无效。",
  ],
  [
    "Cấu hình giới hạn phiên không hợp lệ.",
    "The session limit configuration is invalid.",
    "会话数量限制配置无效。",
  ],
  [
    "Document must have at least one line.",
    "Document must have at least one line.",
    "单据必须至少有一行。",
  ],
  [
    "Document not found in owner scope.",
    "Document not found in owner scope.",
    "在归属范围内未找到单据。",
  ],
  [
    "Document sequence exceeds the supported range.",
    "Document sequence exceeds the supported range.",
    "单据流水号超出支持范围。",
  ],
  [
    "Document sequence exhausted.",
    "Document sequence exhausted.",
    "单据流水号已用尽。",
  ],
  [
    "Document sequence lock unavailable.",
    "Document sequence lock unavailable.",
    "无法获取单据流水号锁。",
  ],
  [
    "Document version mismatch.",
    "The document version has changed.",
    "单据版本已更改。",
  ],
  [
    "Document view and scan rights required.",
    "Document view and scan rights required.",
    "必须具备查看和扫描单据的权限。",
  ],
  [
    "Dữ liệu App PV không hợp lệ.",
    "The PV App data is invalid.",
    "PV 应用数据无效。",
  ],
  [
    "Dữ liệu RECORD chưa đủ hoặc không hợp lệ.",
    "The RECORD data is incomplete or invalid.",
    "RECORD 数据不完整或无效。",
  ],
  [
    "Dữ liệu hồ sơ App PV không hợp lệ.",
    "The PV App profile data is invalid.",
    "PV 应用资料数据无效。",
  ],
  [
    "Dữ liệu rule gợi ý không hợp lệ.",
    "The recommendation rule data is invalid.",
    "推荐规则数据无效。",
  ],
  [
    "EXPLICIT_RUNTIME_COVERAGE_REQUIRED: set the approved HN_DAILY_COVERAGE_DAYS in the CLI process environment; no implicit 0/14.",
    "EXPLICIT_RUNTIME_COVERAGE_REQUIRED: set the approved HN_DAILY_COVERAGE_DAYS in the CLI process environment; no implicit 0/14.",
    "EXPLICIT_RUNTIME_COVERAGE_REQUIRED：请在命令行进程环境中设置已批准的 HN_DAILY_COVERAGE_DAYS，不可隐式使用 0 或 14。",
  ],
  [
    "Enroll/confirm MFA before using the versioned command protocol; old UNKNOWN requires audited support.",
    "Enroll/confirm MFA before using the versioned command protocol; old UNKNOWN requires audited support.",
    "使用带版本的操作协议前，请先配置并确认 MFA。旧的 UNKNOWN 状态需通过留有审计记录的支持流程处理。",
  ],
  [
    "File này đã được import trước đó với cùng tùy chọn (duplicate/already processed); trả lại kết quả của lần import gốc.",
    "This file was already imported with the same options. The original import result is returned.",
    "此文件已使用相同选项导入，现返回原导入结果。",
  ],
  [
    "GET uses the exact key and no body/query.",
    "GET uses the exact key and no body/query.",
    "GET 必须使用准确的请求键，且不带请求体或查询参数。",
  ],
  [
    "Giá trị domain không hợp lệ.",
    "The domain value is invalid.",
    "domain 值无效。",
  ],
  ["Giá trị sort không hợp lệ.", "The sort value is invalid.", "sort 值无效。"],
  [
    "If-Match hoặc field version là bắt buộc.",
    "If-Match or the version field is required.",
    "必须提供 If-Match 或 version 字段。",
  ],
  [
    "Import version mismatch.",
    "The import version has changed.",
    "导入任务版本已更改。",
  ],
  [
    "Invalid absolute document timestamp.",
    "Invalid absolute document timestamp.",
    "单据绝对时间戳无效。",
  ],
  [
    "Invalid document calendar timestamp.",
    "Invalid document calendar timestamp.",
    "单据日历时间戳无效。",
  ],
  [
    "Invalid or unknown document timestamp offset.",
    "Invalid or unknown document timestamp offset.",
    "单据时间戳的时区偏移无效或未知。",
  ],
  [
    "Item này đã được đảo trong một reversal POSTED; append-only không cho đảo lại cùng một item (BR-REV-08).",
    "This item was already reversed by a posted reversal. The append-only rule prevents reversing the same item again (BR-REV-08).",
    "此物品已通过过账的冲销单冲销。按仅追加规则，同一物品不能再次冲销（BR-REV-08）。",
  ],
  [
    "Keep the original key, body, version and owner scope.",
    "Keep the original key, body, version and owner scope.",
    "请保持原始请求键、请求体、版本和归属范围不变。",
  ],
  [
    "Khóa phản hồi không hợp lệ.",
    "The response key is invalid.",
    "响应键无效。",
  ],
  [
    "Không có field hợp lệ để cập nhật printer config.",
    "No valid fields were provided to update the printer configuration.",
    "未提供可用于更新打印机配置的有效字段。",
  ],
  [
    "Không tìm thấy Nhãn đóng gói của phiếu xuất này.",
    "No packing label was found for this issue note.",
    "未找到此出库单的包装标签。",
  ],
  [
    "Không tìm thấy line trong document.",
    "The line was not found in the document.",
    "单据中未找到此行。",
  ],
  [
    "Không tìm thấy movement cho reference document.",
    "No stock movement was found for the referenced document.",
    "未找到引用单据的库存流水。",
  ],
  [
    "Không tìm thấy original document.",
    "The original document was not found.",
    "未找到原始单据。",
  ],
  [
    "Không tìm thấy pending reversal của original document.",
    "No pending reversal was found for the original document.",
    "未找到原始单据的待处理冲销单。",
  ],
  [
    "Không tìm thấy reversal document.",
    "The reversal document was not found.",
    "未找到冲销单。",
  ],
  [
    "Không tìm thấy stock document.",
    "The stock document was not found.",
    "未找到库存单据。",
  ],
  [
    "Ký tự base32 không hợp lệ.",
    "The base32 character is invalid.",
    "base32 字符无效。",
  ],
  [
    "Movement không có source document để reversal.",
    "The stock movement has no source document to reverse.",
    "此库存流水没有可冲销的来源单据。",
  ],
  [
    "Movement nằm ngoài warehouse data scope hiện hành.",
    "The stock movement is outside your current warehouse data scope.",
    "库存流水不在您当前允许访问的仓库范围内。",
  ],
  [
    "Mã vật lý chỉ có lịch sử ngoài warehouse data scope hiện hành.",
    "This physical code only has history outside your current warehouse data scope.",
    "此实物编码仅在您当前允许访问的仓库范围外有历史记录。",
  ],
  [
    "Một item chỉ được scan/match một lần trong cùng document.",
    "An item can only be scanned or matched once in the same document.",
    "同一单据内每个物品只能扫描或匹配一次。",
  ],
  [
    "New session must verify MFA and GET the original key, not replay the command.",
    "New session must verify MFA and GET the original key, not replay the command.",
    "新会话必须通过 MFA 验证并以 GET 查询原始请求键，不可重新执行操作。",
  ],
  [
    "Nguồn tìm kiếm có văn bản không hợp lệ.",
    "The search source contains invalid text.",
    "搜索数据源包含无效文本。",
  ],
  [
    "Only current_password and code are accepted; no caller/session takeover fields.",
    "Only current_password and code are accepted; no caller/session takeover fields.",
    "仅接受 current_password 和 code，不接受用于更改调用者或会话归属的字段。",
  ],
  [
    "Only warehouse_id and confirmed are accepted.",
    "Only warehouse_id and confirmed are accepted.",
    "仅接受 warehouse_id 和 confirmed。",
  ],
  [
    "Original document phải giữ POSTED.",
    "The original document must remain posted.",
    "原始单据必须保持已过账状态。",
  ],
  [
    "Original key/body/target/request identity must not change.",
    "Original key/body/target/request identity must not change.",
    "原始请求键、请求体、目标和请求标识不得更改。",
  ],
  [
    "Owner metadata already uses the projection namespace; no fields are overwritten.",
    "Owner metadata already uses the projection namespace; no fields are overwritten.",
    "归属元数据已占用投影命名空间，未覆盖任何字段。",
  ],
  [
    "Owner returned no root result without an authoritative no-active-shift state; no empty success is fabricated.",
    "Owner returned no root result without an authoritative no-active-shift state; no empty success is fabricated.",
    "归属方未返回根结果，也未明确确认没有进行中的班次，不能将空结果视为成功。",
  ],
  [
    "Packing Label version mismatch.",
    "The packing label version has changed.",
    "包装标签版本已更改。",
  ],
  [
    "Phiên đăng nhập không hợp lệ.",
    "The login session is invalid.",
    "登录会话无效。",
  ],
  [
    "Phiếu nhập nằm ngoài warehouse data scope hiện hành.",
    "The receipt is outside your current warehouse data scope.",
    "入库单不在您当前允许访问的仓库范围内。",
  ],
  [
    "Phiếu xuất nằm ngoài warehouse data scope hiện hành.",
    "The issue note is outside your current warehouse data scope.",
    "出库单不在您当前允许访问的仓库范围内。",
  ],
  [
    "Physical code version mismatch.",
    "The physical code version has changed.",
    "实物编码版本已更改。",
  ],
  [
    "Phải gửi ít nhất một field để cập nhật.",
    "Provide at least one field to update.",
    "请至少提供一个要更新的字段。",
  ],
  [
    "Reauthenticate with password and the pre-existing MFA factor before reading this original key.",
    "Reauthenticate with password and the pre-existing MFA factor before reading this original key.",
    "读取此原始请求键前，必须使用密码和原有 MFA 验证方式重新认证。",
  ],
  [
    "Reject approval is outside the latest MVP baseline.",
    "Reject approval is outside the latest MVP baseline.",
    "最新 MVP 基线不支持拒绝审批。",
  ],
  [
    "Reload the current document version.",
    "Reload the current document version.",
    "请重新加载单据当前版本。",
  ],
  [
    "Removing the protocol header cannot bypass an unresolved command; reconcile its original key.",
    "Removing the protocol header cannot bypass an unresolved command; reconcile its original key.",
    "删除协议请求头不能绕过结果未确定的操作，请核对其原始请求键。",
  ],
  [
    "Reversal POSTED là append-only; tạo reversal mới trong cùng chain (BR-REV-08).",
    "Posted reversals are append-only. Create a new reversal in the same chain (BR-REV-08).",
    "已过账的冲销单只能追加记录，请在同一链中创建新冲销单（BR-REV-08）。",
  ],
  [
    "Reversal document nằm ngoài warehouse data scope hiện hành.",
    "The reversal document is outside your current warehouse data scope.",
    "冲销单不在您当前允许访问的仓库范围内。",
  ],
  ["Row validation failed.", "Row validation failed.", "行数据校验失败。"],
  [
    "Scan classified without stock effect",
    "Scan classified without stock effect",
    "已完成扫描分类，库存未发生变化。",
  ],
  [
    "Scan quantity must be greater than zero.",
    "Scan quantity must be greater than zero.",
    "扫描数量必须大于零。",
  ],
  [
    "Serial và container phải cùng warehouse.",
    "The serial item and container must belong to the same warehouse.",
    "序列号物品和容器必须属于同一仓库。",
  ],
  [
    "Số lượng component phải lớn hơn 0.",
    "The component quantity must be greater than 0.",
    "配件数量必须大于 0。",
  ],
  [
    "Số mã N/N phải bằng tổng kế hoạch của phiếu nguồn.",
    "The N/N code count must equal the source document's total planned quantity.",
    "N/N 编码数量必须等于来源单据的计划总数量。",
  ],
  [
    "The authorized owner did not return a JSON object.",
    "The authorized owner did not return a JSON object.",
    "已授权的归属方未返回 JSON 对象。",
  ],
  [
    "The explicit field contract supports declared GET reads only, never commands.",
    "The explicit field contract supports declared GET reads only, never commands.",
    "显式字段接口约定仅支持已声明的 GET 读取操作，不支持操作指令。",
  ],
  [
    "Thông tin đăng ký thiết bị không hợp lệ.",
    "The device registration information is invalid.",
    "设备登记信息无效。",
  ],
  [
    "Thời gian chứng từ nguồn không hợp lệ.",
    "The source document time is invalid.",
    "来源单据时间无效。",
  ],
  [
    "Toa xuất đã có outbound document.",
    "The issue request already has an outbound document.",
    "出库申请已有对应出库单。",
  ],
  [
    "Tùy chọn mã trong nháp không hợp lệ.",
    "The code option in the draft is invalid.",
    "草稿中的编码选项无效。",
  ],
  [
    "Tổng component item quantity phải bằng required_qty.",
    "The total component item quantity must equal required_qty.",
    "配件物品总数量必须等于 required_qty。",
  ],
  [
    "Tổng component item số lượng phải bằng required_qty.",
    "The total component item quantity must equal required_qty.",
    "配件物品总数量必须等于 required_qty。",
  ],
  [
    "UUID Idempotency-Key and strong If-Match required.",
    "UUID Idempotency-Key and strong If-Match required.",
    "必须提供 UUID 格式的 Idempotency-Key 和强校验的 If-Match。",
  ],
  [
    "Unreviewed legacy document timezone.",
    "Unreviewed legacy document timezone.",
    "旧单据时区尚未审核。",
  ],
  [
    "Unsupported document timestamp source.",
    "Unsupported document timestamp source.",
    "不支持此单据时间戳来源。",
  ],
  [
    "Untrusted mixed document search column.",
    "Untrusted mixed document search column.",
    "混合单据搜索列不可信。",
  ],
  [
    "Use the explicit security command contract.",
    "Use the explicit security command contract.",
    "请使用明确的安全操作接口约定。",
  ],
  [
    "Verification failed; do not replay the original command or change its identity.",
    "Verification failed; do not replay the original command or change its identity.",
    "验证失败，不可重新执行原操作或更改其标识。",
  ],
  ["Vui lòng nhập họ tên.", "Please enter your full name.", "请输入姓名。"],
  ["Warehouse is not active.", "Warehouse is not active.", "仓库未启用。"],
  [
    "Warranty ownership must be captured in the case creation transaction.",
    "Warranty ownership must be captured in the case creation transaction.",
    "必须在创建保修单的同一事务中记录保修归属。",
  ],
  [
    "Yêu cầu gửi thử không hợp lệ.",
    "The test-send request is invalid.",
    "测试发送请求无效。",
  ],
  [
    "audit_log là append-only, không được update.",
    "audit_log is append-only and cannot be updated.",
    "audit_log 仅允许追加，不能更新。",
  ],
  [
    "audit_log là append-only, không được xoá.",
    "audit_log is append-only and cannot be deleted.",
    "audit_log 仅允许追加，不能删除。",
  ],
  [
    "close_remainder is outside the latest MVP baseline.",
    "close_remainder is outside the latest MVP baseline.",
    "最新 MVP 基线不支持 close_remainder。",
  ],
  [
    "document_status_history là append-only, không được update.",
    "document_status_history is append-only and cannot be updated.",
    "document_status_history 仅允许追加，不能更新。",
  ],
  [
    "document_status_history là append-only, không được xoá.",
    "document_status_history is append-only and cannot be deleted.",
    "document_status_history 仅允许追加，不能删除。",
  ],
  [
    "item_id đại diện một item cụ thể nên quantity phải bằng 1 hoặc bỏ trống.",
    "item_id identifies one specific item, so quantity must be 1 or omitted.",
    "item_id 表示一个具体物品，因此 quantity 必须为 1 或留空。",
  ],
  [
    "item_id đại diện một item cụ thể nên số lượng phải bằng 1 hoặc bỏ trống.",
    "item_id identifies one specific item, so quantity must be 1 or omitted.",
    "item_id 表示一个具体物品，因此数量必须为 1 或留空。",
  ],
  [
    "movement_id không thuộc original document hoặc không phải movement có thể reversal.",
    "movement_id does not belong to the original document or does not identify a reversible movement.",
    "movement_id 不属于原始单据，或对应的库存流水不能冲销。",
  ],
  [
    "notifications is append-only and cannot be deleted.",
    "notifications is append-only and cannot be deleted.",
    "notifications 仅允许追加，不能删除。",
  ],
  [
    "notifications is append-only and cannot be updated.",
    "notifications is append-only and cannot be updated.",
    "notifications 仅允许追加，不能更新。",
  ],
  [
    "request_date phải theo định dạng YYYY-MM-DD hoặc DD/MM/YYYY.",
    "request_date must use the YYYY-MM-DD or DD/MM/YYYY format.",
    "request_date 必须使用 YYYY-MM-DD 或 DD/MM/YYYY 格式。",
  ],
  [
    "stock_movements is append-only and cannot be deleted.",
    "stock_movements is append-only and cannot be deleted.",
    "stock_movements 仅允许追加，不能删除。",
  ],
  [
    "stock_movements is append-only and cannot be updated.",
    "stock_movements is append-only and cannot be updated.",
    "stock_movements 仅允许追加，不能更新。",
  ],
  [
    "to_date phải lớn hơn hoặc bằng from_date.",
    "to_date must be greater than or equal to from_date.",
    "to_date 必须大于或等于 from_date。",
  ],
  [
    "Đã Post reversal; movement append-only đã ghi.",
    "The reversal was posted and its append-only stock movements were recorded.",
    "冲销单已过账，并已追加记录库存流水。",
  ],
  [
    "Định danh nguồn phiếu linh kiện không hợp lệ.",
    "The component issue source identifier is invalid.",
    "配件出库来源标识无效。",
  ],
  [
    "Định mức tồn tối đa phải lớn hơn định mức tồn tối thiểu.",
    "The maximum stock threshold must be greater than the minimum stock threshold.",
    "最高库存阈值必须大于最低库存阈值。",
  ],
];
