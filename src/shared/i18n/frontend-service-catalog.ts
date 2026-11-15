/** Complete frontend-generated errors displayed through the shared API error formatter. */
export const FRONTEND_SERVICE_MESSAGES: ReadonlyArray<
  readonly [source: string, en: string, zh: string]
> = [
  [
    "The reversal report source is incomplete: invalid or excessive pagination.",
    "The reversal report source is incomplete: invalid or excessive pagination.",
    "冲销报表数据源不完整：分页无效或页数过多。",
  ],
  [
    "The reversal report source returned an invalid page.",
    "The reversal report source returned an invalid page.",
    "冲销报表数据源返回了无效页面。",
  ],
  [
    "The reversal report source changed or returned an incomplete dataset. Refresh the report.",
    "The reversal report source changed or returned an incomplete dataset. Refresh the report.",
    "冲销报表数据源已更改或返回的数据不完整，请刷新报表。",
  ],
  [
    "Too many import report pages to display completely.",
    "Too many import report pages to display completely.",
    "导入报表页数过多，无法完整显示。",
  ],
  [
    "Import report history changed during loading. Refresh the report.",
    "Import report history changed during loading. Refresh the report.",
    "导入报表历史在加载期间已更改，请刷新报表。",
  ],
  [
    "Too many result history pages.",
    "Too many result history pages.",
    "结果历史页数过多。",
  ],
  [
    "Encrypted API requires Web Crypto and a secure context",
    "Encrypted API requires Web Crypto and a secure context",
    "加密 API 需要 Web Crypto 和安全上下文。",
  ],
  [
    "Invalid encrypted API response",
    "Invalid encrypted API response",
    "加密 API 响应无效。",
  ],
  [
    "printElement requires a browser document",
    "Printing requires a browser document.",
    "打印需要浏览器文档。",
  ],
  [
    "Could not create the print frame",
    "Could not create the print frame.",
    "无法创建打印框架。",
  ],
  [
    "SUPPLIER_DESCRIPTION_TOO_LONG",
    "The supplier description must not exceed 500 characters.",
    "供应商说明最多 500 个字符。",
  ],
  [
    "PREFERENCES_UNAVAILABLE",
    "Your preferences could not be loaded. Please try again.",
    "无法加载您的偏好设置，请重试。",
  ],
  [
    "Temporary auto-login requires an account without MFA enrollment.",
    "Temporary auto-login requires an account without MFA enrollment.",
    "临时自动登录需要尚未注册 MFA 的账户。",
  ],
  [
    "AUTH_REFRESH_CONTRACT_INVALID: missing access_token",
    "The authentication refresh response is invalid. Please sign in again.",
    "身份验证刷新响应无效，请重新登录。",
  ],
  [
    "AUTH_REFRESH_SUPERSEDED",
    "Your session changed while authentication was refreshing. Please try again.",
    "身份验证刷新期间会话已更改，请重试。",
  ],
  [
    "PROFILE_OWNER_CHANGED",
    "The active account changed. Please reload before continuing.",
    "当前账户已更改，请重新加载后继续。",
  ],
  [
    "Unsupported inbound status from API: {value0}",
    "Unsupported inbound status from API: {value0}",
    "API 返回了不支持的入库状态：{value0}",
  ],
  [
    "Inbound scan must have stock_effect=NONE",
    "Inbound scan must have stock_effect=NONE",
    "入库扫描必须具有 stock_effect=NONE",
  ],
  [
    "Inbound scan must not create stock movement",
    "Inbound scan must not create stock movement",
    "入库扫描不得产生库存变动。",
  ],
  [
    "Inbound document must have at least one scanned unit before Post Receipt",
    "Inbound document must have at least one scanned unit before Post Receipt",
    "入库过账前，入库单必须至少扫描一个实物。",
  ],
  [
    "Post Receipt response must include movement_ids",
    "Post Receipt response must include movement_ids",
    "入库过账响应必须包含 movement_ids。",
  ],
  [
    "Scan quantity must be a positive integer",
    "Scan quantity must be a positive integer",
    "扫描数量必须为正整数。",
  ],
  [
    "Inbound version changed from {value0} to {value1}",
    "Inbound version changed from {value0} to {value1}",
    "入库单版本已从 {value0} 更改为 {value1}。",
  ],
  [
    "Expected exactly one ACTIVE warehouse with code {value0}, received {value1}",
    "Expected exactly one ACTIVE warehouse with code {value0}, received {value1}",
    "预期编码为 {value0} 的 ACTIVE 仓库恰好有一个，实际收到 {value1} 个。",
  ],
  [
    "{value0} must be stock-neutral and must not create inventory movement",
    "{value0} must be stock-neutral and must not create inventory movement",
    "{value0} 必须保持库存不变，且不得产生库存变动。",
  ],
  [
    "{value0} must be a UUID",
    "{value0} must be a UUID",
    "{value0} 必须为 UUID。",
  ],
  [
    "{value0} must be false for read-only scan classification",
    "{value0} must be false for read-only scan classification",
    "只读扫描分类中 {value0} 必须为 false。",
  ],
  [
    "Scan classify response contains unexpected code(s) for {value0}: {value1}",
    "Scan classify response contains unexpected code(s) for {value0}: {value1}",
    "扫描分类响应中 {value0} 包含非预期编码：{value1}",
  ],
  [
    "raw_code must contain at most 512 characters",
    "raw_code must contain at most 512 characters",
    "raw_code 最多 512 个字符。",
  ],
  [
    "context is not supported by WWHN-150.1.1.0",
    "context is not supported by WWHN-150.1.1.0",
    "WWHN-150.1.1.0 不支持此 context。",
  ],
  [
    "Scan classify response data must be an object",
    "Scan classify response data must be an object",
    "扫描分类响应数据必须为对象。",
  ],
  [
    "Scan classify response raw_code does not match the request",
    "Scan classify response raw_code does not match the request",
    "扫描分类响应的 raw_code 与请求不匹配。",
  ],
  [
    "Scan classify response context does not match the request",
    "Scan classify response context does not match the request",
    "扫描分类响应的 context 与请求不匹配。",
  ],
  [
    "contract_version must be WWHN-150.1.1.0",
    "contract_version must be WWHN-150.1.1.0",
    "contract_version 必须为 WWHN-150.1.1.0。",
  ],
  [
    "stock_effect must be NONE",
    "stock_effect must be NONE",
    "stock_effect 必须为 NONE。",
  ],
  [
    "current_location must be an object",
    "current_location must be an object",
    "current_location 必须为对象。",
  ],
  [
    "current_location.warehouse_id does not match the request",
    "current_location.warehouse_id does not match the request",
    "current_location.warehouse_id 与请求不匹配。",
  ],
  [
    "classification=CONTAINER must include a non-null container_id",
    "classification=CONTAINER must include a non-null container_id",
    "classification=CONTAINER 时必须包含非 null 的 container_id。",
  ],
  [
    "Physical code list endpoint is not approved. FE requires BE/BA route, payload, status enum, error code, sample response, and permission sign-off.",
    "Physical code list endpoint is not approved. FE requires BE/BA route, payload, status enum, error code, sample response, and permission sign-off.",
    "物理编码列表端点尚未获批。FE 需要 BE/BA 对路由、载荷、状态枚举、错误码、示例响应及权限进行确认。",
  ],
  [
    "Issue item physical code response data must be an object",
    "Issue item physical code response data must be an object",
    "分配实物物理编码的响应数据必须为对象。",
  ],
  [
    "Unexpected carrier_type in response: {value0}",
    "Unexpected carrier_type in response: {value0}",
    "响应中出现非预期的 carrier_type：{value0}",
  ],
  [
    "stock_effect must be NONE for issuing a new item identity",
    "stock_effect must be NONE for issuing a new item identity",
    "分配新实物标识时 stock_effect 必须为 NONE。",
  ],
  [
    "Outbound scan must have stock_effect=NONE",
    "Outbound scan must have stock_effect=NONE",
    "出库扫描必须具有 stock_effect=NONE",
  ],
  [
    "Outbound scan must not create stock movement",
    "Outbound scan must not create stock movement",
    "出库扫描不得产生库存变动。",
  ],
  [
    "No remaining outbound line matches scanned code {value0}",
    "No remaining outbound line matches scanned code {value0}",
    "没有剩余出库明细与扫描编码 {value0} 匹配。",
  ],
  [
    "Multiple outbound lines match scanned code {value0}; select the exact line in the canonical outbound UI",
    "Multiple outbound lines match scanned code {value0}; select the exact line in the canonical outbound UI",
    "多行出库明细与扫描编码 {value0} 匹配，请在正式出库界面选择准确明细。",
  ],
  [
    "Outbound document must contain lines before Post Issue",
    "Outbound document must contain lines before Post Issue",
    "出库过账前，出库单必须包含明细。",
  ],
  [
    "Post Issue is whole-document; every line must be scanned exactly to planned quantity",
    "Post Issue is whole-document; every line must be scanned exactly to planned quantity",
    "出库过账针对整张单据，每行扫描数量必须与计划数量完全一致。",
  ],
  [
    "Post Issue response must include committed movement_ids",
    "Post Issue response must include committed movement_ids",
    "出库过账响应必须包含已提交的 movement_ids。",
  ],
  [
    "PRODUCT outbound scan is item-level and quantity must equal 1",
    "PRODUCT outbound scan is item-level and quantity must equal 1",
    "PRODUCT 出库扫描按实物进行，quantity 必须等于 1。",
  ],
  [
    "Outbound version changed from {value0} to {value1}",
    "Outbound version changed from {value0} to {value1}",
    "出库单版本已从 {value0} 更改为 {value1}。",
  ],
  [
    "POST /outbound-documents/:id/submit is not registered by BE m1",
    "POST /outbound-documents/:id/submit is not registered by BE m1",
    "BE m1 尚未注册 POST /outbound-documents/:id/submit。",
  ],
  [
    "POST /outbound-documents/:id/approve is not registered by BE m1",
    "POST /outbound-documents/:id/approve is not registered by BE m1",
    "BE m1 尚未注册 POST /outbound-documents/:id/approve。",
  ],
  [
    "POST /outbound-documents/:id/reject is not registered by BE m1",
    "POST /outbound-documents/:id/reject is not registered by BE m1",
    "BE m1 尚未注册 POST /outbound-documents/:id/reject。",
  ],
  [
    "Outbound is full-post only; close-remainder does not exist",
    "Outbound is full-post only; close-remainder does not exist",
    "出库仅支持整单过账，不存在 close-remainder 操作。",
  ],
  [
    "{value0} must be stock-neutral before Post",
    "{value0} must be stock-neutral before Post",
    "Post 前 {value0} 必须保持库存不变。",
  ],
  [
    "{value0} must not create stock movement",
    "{value0} must not create stock movement",
    "{value0} 不得产生库存变动。",
  ],
  [
    "Component Issue requires at least one line",
    "Component Issue requires at least one line",
    "配件出库至少需要一行明细。",
  ],
  [
    "Component Issue Post must decrease stock",
    "Component Issue Post must decrease stock",
    "配件出库过账必须扣减库存。",
  ],
  [
    "Component Issue Post must return movement_ids",
    "Component Issue Post must return movement_ids",
    "配件出库过账必须返回 movement_ids。",
  ],
  [
    "{value0} must have stock_effect=NONE",
    "{value0} must have stock_effect=NONE",
    "{value0} 必须具有 stock_effect=NONE",
  ],
  [
    "{value0} is required for {value1}",
    "{value0} is required for {value1}",
    "{value1} 需要 {value0}。",
  ],
  ["{value0} is required", "{value0} is required", "{value0} 为必填项。"],
  [
    "{value0} must be a positive number",
    "{value0} must be a positive number",
    "{value0} 必须为正数。",
  ],
  [
    "{value0} must be a positive integer",
    "{value0} must be a positive integer",
    "{value0} 必须为正整数。",
  ],
  [
    "{value0} must be a non-negative number",
    "{value0} must be a non-negative number",
    "{value0} 必须为非负数。",
  ],
  [
    "{value0} must contain at least one item",
    "{value0} must contain at least one item",
    "{value0} 必须至少包含一个项目。",
  ],
  [
    "{value0} contains duplicate value: {value1}",
    "{value0} contains duplicate value: {value1}",
    "{value0} 包含重复值：{value1}",
  ],
  [
    "{value0} must contain 8 to {value1} characters",
    "{value0} must contain 8 to {value1} characters",
    "{value0} 长度必须为 8 至 {value1} 个字符。",
  ],
  [
    "Runtime /permissions response does not contain permission codes",
    "Runtime /permissions response does not contain permission codes",
    "运行时 /permissions 响应不包含权限编码。",
  ],
];
