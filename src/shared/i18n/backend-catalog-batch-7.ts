/** Complete validation detail producers and public API default messages. */
export const BACKEND_CATALOG_BATCH_7: ReadonlyArray<
  readonly [string, string, string]
> = [
  [
    "Biến thể không thuộc sản phẩm đã chọn.",
    "The variant does not belong to the selected product.",
    "此规格不属于所选产品。",
  ],
  [
    "Body có cả items[] và product_id nhưng không khớp nhau; chỉ cần gửi items[].",
    "The body contains both items[] and product_id with different values. Send only items[].",
    "请求体同时包含 items[] 和 product_id，且两者不匹配。请仅发送 items[]。",
  ],
  [
    "CARTON/BOX bắt buộc phải có primary_sku_id.",
    "CARTON/BOX requires primary_sku_id.",
    "CARTON/BOX 必须提供 primary_sku_id。",
  ],
  [
    "CONTAINER target không tồn tại.",
    "The CONTAINER target does not exist.",
    "CONTAINER 目标不存在。",
  ],
  [
    "Chỉ được chọn một ảnh đại diện.",
    "Only one primary image can be selected.",
    "只能选择一张主图。",
  ],
  [
    "Ghi chú tối đa {value0} ký tự.",
    "The note must not exceed {value0} characters.",
    "备注不能超过 {value0} 个字符。",
  ],
  [
    "Hệ thống đang bảo trì. Vui lòng quay lại sau.",
    "The system is under maintenance. Please return later.",
    "系统正在维护。请稍后再来。",
  ],
  [
    "Họ tên phải từ 2 đến {value0} ký tự.",
    "The full name must contain 2 to {value0} characters.",
    "姓名必须包含 2 至 {value0} 个字符。",
  ],
  [
    "ITEM target không tồn tại.",
    "The ITEM target does not exist.",
    "ITEM 目标不存在。",
  ],
  [
    "Không thể tải dữ liệu lúc này.",
    "Data cannot be loaded at this time.",
    "当前无法加载数据。",
  ],
  [
    "Không tìm thấy dữ liệu yêu cầu.",
    "The requested data was not found.",
    "未找到所请求的数据。",
  ],
  [
    "Mã bắt buộc và tối đa 80 ký tự.",
    "The code is required and must not exceed 80 characters.",
    "编码为必填项，且不能超过 80 个字符。",
  ],
  [
    "Mã vật lý loại ITEM bắt buộc dùng QR/BARCODE/RFID/NFC.",
    "ITEM physical codes must use QR/BARCODE/RFID/NFC.",
    "ITEM 类型的实物编码必须使用 QR/BARCODE/RFID/NFC。",
  ],
  [
    "Mã vật lý loại ITEM bắt buộc dùng carrier chip (QR/BARCODE/RFID/NFC).",
    "ITEM physical codes must use a chip carrier (QR/BARCODE/RFID/NFC).",
    "ITEM 类型的实物编码必须使用芯片载体（QR/BARCODE/RFID/NFC）。",
  ],
  [
    "Mã vật lý phải ở trạng thái Đang hoạt động để gán cho container.",
    "The physical code must be active before it can be assigned to a container.",
    "实物编码必须处于已启用状态，才能分配给容器。",
  ],
  [
    "Mã vật lý phải ở trạng thái ACTIVE để gán cho container.",
    "The physical code must be active before it can be assigned to a container.",
    "实物编码必须处于已启用状态，才能分配给容器。",
  ],
  [
    "Mã vật lý phải ở trạng thái Đang hoạt động để gán cho item.",
    "The physical code must be active before it can be assigned to an item.",
    "实物编码必须处于已启用状态，才能分配给物品。",
  ],
  [
    "Mã vật lý phải ở trạng thái ACTIVE để gán cho item.",
    "The physical code must be active before it can be assigned to an item.",
    "实物编码必须处于已启用状态，才能分配给物品。",
  ],
  ["Mã đã tồn tại.", "The code already exists.", "编码已存在。"],
  [
    "Mô tả phải là chuỗi và tối đa 500 ký tự.",
    "The description must be a string with at most 500 characters.",
    "说明必须为字符串，且不能超过 500 个字符。",
  ],
  [
    "Mỗi phần tử của items phải là một đối tượng.",
    "Each element of items must be an object.",
    "items 中的每个元素必须为对象。",
  ],
  [
    "Mỗi phần tử images phải là object {url, alt_text, is_primary}.",
    "Each element of images must be an object with url, alt_text and is_primary.",
    "images 中的每个元素必须为包含 url、alt_text 和 is_primary 的对象。",
  ],
  [
    "Một yêu cầu tư vấn tối đa {value0} sản phẩm.",
    "A quote request supports at most {value0} products.",
    "每次咨询请求最多支持 {value0} 个产品。",
  ],
  [
    "Physical code map ITEM phải có code_type=ITEM.",
    "A physical code mapped to ITEM must have code_type=ITEM.",
    "映射到 ITEM 的实物编码必须使用 code_type=ITEM。",
  ],
  [
    "Phương thức không được hỗ trợ.",
    "The method is not supported.",
    "不支持此方法。",
  ],
  [
    "Phải chọn đúng 1 trong 2: item_id (serial) hoặc sku_id+số lượng (số lượng), không được cả hai hoặc không có gì.",
    "Choose exactly one: item_id for a serial-tracked item, or sku_id and quantity for a bulk item. Do not provide both or neither.",
    "必须且只能选择一种：按序列号管理的物品使用 item_id，按数量管理的物品使用 sku_id 和数量。不能同时提供，也不能均不提供。",
  ],
  [
    "Phải chọn đúng 1 trong 2: item_id (serial) hoặc sku_id+quantity (số lượng), không được cả hai hoặc không có gì.",
    "Choose exactly one: item_id for a serial-tracked item, or sku_id and quantity for a bulk item. Do not provide both or neither.",
    "必须且只能选择一种：按序列号管理的物品使用 item_id，按数量管理的物品使用 sku_id 和数量。不能同时提供，也不能均不提供。",
  ],
  [
    "RFID bắt buộc có hardware_uid duy nhất.",
    "RFID requires a unique hardware_uid.",
    "RFID 必须提供唯一的 hardware_uid。",
  ],
  [
    "SKU loại Sản phẩm có is_serial_tracked=true bắt buộc phải có physical_code_id.",
    "Product SKUs with is_serial_tracked=true require physical_code_id.",
    "is_serial_tracked=true 的产品 SKU 必须提供 physical_code_id。",
  ],
  [
    "SKU loại PRODUCT có is_serial_tracked=true bắt buộc phải có physical_code_id.",
    "Product SKUs with is_serial_tracked=true require physical_code_id.",
    "is_serial_tracked=true 的产品 SKU 必须提供 physical_code_id。",
  ],
  [
    "SKU theo dõi serial bắt buộc serial_number.",
    "Serial-tracked SKUs require serial_number.",
    "按序列号管理的 SKU 必须提供 serial_number。",
  ],
  [
    "Sản phẩm này đã có ở dòng {value0}.",
    "This product already appears on row {value0}.",
    "此产品已存在于第 {value0} 行。",
  ],
  [
    "Số lượng phải từ 1 đến {value0}.",
    "Quantity must be between 1 and {value0}.",
    "数量必须介于 1 至 {value0} 之间。",
  ],
  ["Thành công.", "Success.", "成功。"],
  [
    "Tên bắt buộc và tối đa 200 ký tự.",
    "The name is required and must not exceed 200 characters.",
    "名称为必填项，且不能超过 200 个字符。",
  ],
  [
    "Tối đa {value0} ảnh cho mỗi sản phẩm.",
    "Each product supports at most {value0} images.",
    "每个产品最多支持 {value0} 张图片。",
  ],
  [
    "Vui lòng chọn sản phẩm cần tư vấn.",
    "Select the product you want to ask about.",
    "请选择需要咨询的产品。",
  ],
  [
    "Vui lòng chọn ít nhất một sản phẩm.",
    "Select at least one product.",
    "请至少选择一个产品。",
  ],
  ["Yêu cầu bị trùng lặp.", "The request is a duplicate.", "请求重复。"],
  [
    "alt_text tối đa 255 ký tự.",
    "alt_text must not exceed 255 characters.",
    "alt_text 不能超过 255 个字符。",
  ],
  [
    "display_name bắt buộc và tối đa 255 ký tự.",
    "display_name is required and must not exceed 255 characters.",
    "display_name 为必填项，且不能超过 255 个字符。",
  ],
  ["images phải là mảng.", "images must be an array.", "images 必须为数组。"],
  [
    "industry_id là bắt buộc.",
    "industry_id is required.",
    "必须提供 industry_id。",
  ],
  [
    "items phải là mảng danh sách sản phẩm.",
    "items must be an array containing a product list.",
    "items 必须为产品列表数组。",
  ],
  [
    "priority phải là số nguyên không âm, tối đa 2147483647.",
    "priority must be a nonnegative integer no greater than 2147483647.",
    "priority 必须为非负整数，且不能超过 2147483647。",
  ],
  ["sku_id là bắt buộc.", "sku_id is required.", "必须提供 sku_id。"],
  [
    "sort_order phải là số nguyên không âm, tối đa 2147483647.",
    "sort_order must be a nonnegative integer no greater than 2147483647.",
    "sort_order 必须为非负整数，且不能超过 2147483647。",
  ],
  [
    "số lượng bắt buộc khi dùng sku_id (không theo serial).",
    "Quantity is required when using sku_id without serial tracking.",
    "使用不按序列号管理的 sku_id 时，必须提供数量。",
  ],
  [
    "quantity bắt buộc khi dùng sku_id (không theo serial).",
    "Quantity is required when using sku_id without serial tracking.",
    "使用不按序列号管理的 sku_id 时，必须提供数量。",
  ],
  [
    "trạng thái chỉ nhận Đang hoạt động hoặc Ngừng hoạt động.",
    "Status only accepts active or inactive.",
    "状态仅接受已启用或已停用。",
  ],
  [
    "status chỉ nhận ACTIVE hoặc INACTIVE.",
    "Status only accepts active or inactive.",
    "状态仅接受已启用或已停用。",
  ],
  [
    "url ảnh bắt buộc và tối đa 500 ký tự.",
    "The image URL is required and must not exceed 500 characters.",
    "图片 URL 为必填项，且不能超过 500 个字符。",
  ],
  [
    "url ảnh phải là địa chỉ http(s) đầy đủ.",
    "The image URL must be a complete http(s) address.",
    "图片 URL 必须为完整的 http(s) 地址。",
  ],
  [
    "{value0} phải là mảng UUID.",
    "{value0} must be an array of UUIDs.",
    "{value0} 必须为 UUID 数组。",
  ],
  [
    "Định mức tồn tối thiểu phải nhỏ hơn định mức tồn tối đa đang đặt ({value0}).",
    "The minimum stock threshold must be lower than the current maximum threshold ({value0}).",
    "最低库存限额必须小于当前最高库存限额（{value0}）。",
  ],
  [
    "Ảnh bị trùng trong danh sách.",
    "The image is duplicated in the list.",
    "列表中存在重复图片。",
  ],
];
