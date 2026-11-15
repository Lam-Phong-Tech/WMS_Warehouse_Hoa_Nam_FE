/** Source contracts: BE lang/vi/validation.php and UserFacingMessageLocalizer::EXACT. */
export const BACKEND_MESSAGES: Record<string, string> = {
  "Sửa giá trị theo mô tả ở cột message rồi import lại.":
    "Correct the value as described in the message column, then import again.",
  "Không tìm thấy movement.": "Stock movement not found.",
  "Không tìm thấy mã vật lý.": "Physical code not found.",
  "Không thể kết nối tới máy in. Kiểm tra máy in đã bật và đã kết nối mạng, sau đó thử lại.":
    "Cannot connect to the printer. Check that it is turned on and connected to the network, then try again.",
  "Không thể gửi lệnh in tới máy in.":
    "Could not send the print job to the printer.",
  "Label snapshot đã bị thay đổi bởi lệnh in khác; tải lại rồi thử lại.":
    "The label was changed by another print job. Reload and try again.",
  "Không tìm thấy Packing Label của phiếu xuất này.":
    "No packing label was found for this issue note.",
  "Không tìm thấy mã tra cứu (physical code / item / container / SKU).":
    "No matching physical code, item, container or SKU was found.",
  "Không tìm thấy hồ sơ bảo hành của phiếu xuất linh kiện.":
    "The warranty case linked to this component issue document was not found.",
  "Chỉ hồ sơ bảo hành đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện.":
    "Components can only be issued for warranty cases that are being checked or repaired.",
  "Kiểm tra mã danh mục (brand/category/model) đã tồn tại và đang ACTIVE.":
    "Check that the brand, category or model code exists and is active.",
  "Sửa sku_code: chỉ chữ HOA/số, dấu . _ - ở giữa, tối đa 100 ký tự.":
    "Correct sku_code: use uppercase letters or digits, with . _ - between them, up to 100 characters.",
  "Nhập sku_name (bắt buộc), tối đa 255 ký tự.":
    "Enter sku_name (required), up to 255 characters.",
  "Xoá hoặc gộp dòng trùng sku_code ngay trong file trước khi import lại.":
    "Delete or merge duplicate sku_code rows in the file before importing again.",
  'SKU đã tồn tại: bật tùy chọn "cập nhật SKU đã tồn tại" nếu thực sự muốn ghi đè.':
    "The SKU already exists. Enable the option to update existing SKUs if you intend to overwrite it.",
  "SKU đang INACTIVE: kích hoạt lại bằng chức năng sửa SKU, import không tự kích hoạt.":
    "The SKU is inactive. Reactivate it by editing the SKU; importing does not reactivate it automatically.",
  "Chọn đúng một trong các giá trị hợp lệ được liệt kê ở cột message.":
    "Choose one of the valid values listed in the message column.",
  "Dùng 1/0, true/false, yes/no hoặc để trống.":
    "Use 1/0, true/false, yes/no, or leave blank.",
  "Rút gọn version_code xuống tối đa 30 ký tự.":
    "Shorten version_code to at most 30 characters.",
  "sku_code không hợp lệ.": "The SKU code is invalid.",
  "sku_name bắt buộc và tối đa 255 ký tự.":
    "The SKU name is required and must not exceed 255 characters.",
  "version_code tối đa 30 ký tự.":
    "The version code must not exceed 30 characters.",
  "SKU không ACTIVE, import không được tự kích hoạt.":
    "The SKU is inactive; importing cannot reactivate it.",
  "SKU đã tồn tại; cần bật update_existing.":
    "The SKU already exists. Enable updating existing SKUs.",
  "Chỉ hồ sơ bảo hành đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện khi tạo phiếu.":
    "Components can only be issued for warranty cases that are being checked or repaired when creating the document.",
  "Hồ sơ bảo hành đã đóng nên không xuất linh kiện được khi tạo phiếu.":
    "Components cannot be issued for a closed warranty case when creating the document.",
  "Chỉ hồ sơ bảo hành đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện khi quét linh kiện.":
    "Components can only be issued for warranty cases that are being checked or repaired when scanning components.",
  "Hồ sơ bảo hành đã đóng nên không xuất linh kiện được khi quét linh kiện.":
    "Components cannot be issued for a closed warranty case when scanning components.",
  "Chỉ hồ sơ bảo hành đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện khi gỡ dòng quét.":
    "Components can only be issued for warranty cases that are being checked or repaired when removing a scan.",
  "Hồ sơ bảo hành đã đóng nên không xuất linh kiện được khi gỡ dòng quét.":
    "Components cannot be issued for a closed warranty case when removing a scan.",
  "Chỉ hồ sơ bảo hành đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện khi thêm dòng linh kiện.":
    "Components can only be issued for warranty cases that are being checked or repaired when adding a component line.",
  "Hồ sơ bảo hành đã đóng nên không xuất linh kiện được khi thêm dòng linh kiện.":
    "Components cannot be issued for a closed warranty case when adding a component line.",
  "Chỉ hồ sơ bảo hành đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện khi sửa dòng linh kiện.":
    "Components can only be issued for warranty cases that are being checked or repaired when editing a component line.",
  "Hồ sơ bảo hành đã đóng nên không xuất linh kiện được khi sửa dòng linh kiện.":
    "Components cannot be issued for a closed warranty case when editing a component line.",
  "Chỉ hồ sơ bảo hành đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện khi xoá dòng linh kiện.":
    "Components can only be issued for warranty cases that are being checked or repaired when deleting a component line.",
  "Hồ sơ bảo hành đã đóng nên không xuất linh kiện được khi xoá dòng linh kiện.":
    "Components cannot be issued for a closed warranty case when deleting a component line.",
  "Máy in chưa được cấu hình hoặc đang ở trạng thái không hoạt động.":
    "The printer is not configured or is inactive.",
  "Chỉ hồ sơ bảo hành đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện tại thời điểm Post.":
    "Components can only be issued for warranty cases that are being checked or repaired when posting.",
  "Hồ sơ bảo hành đã đóng nên không xuất linh kiện được tại thời điểm Post.":
    "Components cannot be issued for a closed warranty case when posting.",
  "Kiểm tra mã danh mục (brand/category/model) đã tồn tại và đang Đang hoạt động.":
    "Check that the brand, category or model code exists and is active.",
  "SKU đang Ngừng hoạt động: kích hoạt lại bằng chức năng sửa SKU, import không tự kích hoạt.":
    "The SKU is inactive. Reactivate it by editing the SKU; importing does not reactivate it automatically.",
  "SKU không Đang hoạt động, import không được tự kích hoạt.":
    "The SKU is inactive; importing cannot reactivate it.",
  "Barcode/QR không tồn tại hoặc không ACTIVE.":
    "The barcode/QR code does not exist or is inactive.",
  "Barcode/QR không tồn tại hoặc không Đang hoạt động.":
    "The barcode/QR code does not exist or is inactive.",
  "Mọi phiếu linh kiện phải POSTED trước khi bàn giao.":
    "All component issue documents must be posted before handover.",
  "Mọi phiếu linh kiện phải Đã ghi nhận trước khi bàn giao.":
    "All component issue documents must be posted before handover.",
  "Nguồn phiếu xuất linh kiện chưa sẵn sàng để xác minh bàn giao.":
    "Component issue records are unavailable for handover verification.",
  "Có phiếu linh kiện không thuộc kho sở hữu hồ sơ.":
    "A component issue document belongs to a different warehouse than the warranty case.",
  "SKU không tồn tại hoặc không ACTIVE.":
    "The SKU does not exist or is inactive.",
  "SKU không tồn tại hoặc không Đang hoạt động.":
    "The SKU does not exist or is inactive.",
  "Không còn file gốc để kiểm tra lại.":
    "The original file is no longer available for rechecking.",
  "Lần nhập cũ chưa lưu tùy chọn cập nhật; hãy tải file lên để kiểm tra mới.":
    "Update options were not recorded for this legacy import; upload the file to run a new check.",
  "Định dạng file gốc không được hỗ trợ.":
    "The original file format is not supported.",
  "Nội dung file gốc không khớp lần tải lên.":
    "The original file no longer matches the uploaded content.",
  "Không còn file gốc để tải.":
    "The original file is no longer available for download.",
  "Không lưu được kết quả kiểm tra. Vui lòng thử lại.":
    "Could not save the check result. Please try again.",
  "Không tìm thấy báo cáo.": "Report not found.",
  "Dữ liệu đầu vào không hợp lệ.": "The submitted data is invalid.",
  "Dữ liệu không hợp lệ.": "The submitted data is invalid.",
  "Dữ liệu không đáp ứng quy tắc nghiệp vụ.":
    "The data does not meet the business rules.",
  "Yêu cầu không hợp lệ.": "The request is invalid.",
  "Không thể thực hiện yêu cầu do dữ liệu hoặc trạng thái hiện tại không hợp lệ.":
    "The request cannot be completed because the current data or status is invalid.",
  "Không tìm thấy dữ liệu.": "Resource not found",
  "Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.": "Unauthenticated.",
  "Bạn không được phép thực hiện thao tác này.": "Unauthorized",
  "Bạn không có quyền truy cập.":
    "You do not have permission to access this resource.",
  "Bạn không có quyền thực hiện thao tác này.": "This action is unauthorized.",
  "Dữ liệu gửi lên không hợp lệ.": "Validation failed.",
  "Phương thức truy cập không được hỗ trợ.": "Method Not Allowed",
  "Bạn thao tác quá nhiều lần, vui lòng thử lại sau.": "Too Many Requests",
  "Phiên làm việc đã hết hạn, vui lòng thử lại.": "Page Expired",
  "Phiên làm việc không hợp lệ, vui lòng thử lại.": "CSRF token mismatch.",
  "Hệ thống gặp lỗi nội bộ.": "Internal Server Error",
  "Chứng từ phải có ít nhất một dòng.": "Document must have at least one line.",
  "Hồ sơ bảo hành vừa được cập nhật ở nơi khác. Hãy tải lại rồi thao tác lại.":
    "Warranty case version mismatch.",
  "Chứng từ vừa được cập nhật ở nơi khác. Hãy tải lại rồi thao tác lại.":
    "Document version mismatch.",
  "Nhãn đóng gói vừa được cập nhật ở nơi khác. Hãy tải lại rồi thao tác lại.":
    "Packing Label version mismatch.",
  "Phiếu xuất linh kiện vừa được cập nhật ở nơi khác. Hãy tải lại rồi thao tác lại.":
    "Component Issue version mismatch.",
  "Thùng/hộp vừa được cập nhật ở nơi khác. Hãy tải lại rồi thao tác lại.":
    "Container version mismatch.",
  "Lô nạp dữ liệu vừa được cập nhật ở nơi khác. Hãy tải lại rồi thao tác lại.":
    "Import version mismatch.",
  "Mã vật lý vừa được cập nhật ở nơi khác. Hãy tải lại rồi thao tác lại.":
    "Physical code version mismatch.",
  "Số lượng quét phải lớn hơn 0.": "Scan quantity must be greater than zero.",
  "Thao tác từ chối phê duyệt không thuộc quy trình MVP hiện hành.":
    "Reject approval is outside the latest MVP baseline.",
  "Thao tác đóng phần còn lại không thuộc quy trình MVP hiện hành.":
    "close_remainder is outside the latest MVP baseline.",
  "Mật khẩu hiện tại không chính xác": "The current password is incorrect.",
  "Mật khẩu hiện tại không chính xác.": "The current password is incorrect.",
  "Mật khẩu xác nhận không khớp với mật khẩu mới":
    "The password confirmation does not match the new password.",
  "Thông tin đổi mật khẩu không hợp lệ.":
    "The password change details are invalid.",
  "Mật khẩu nhập lại chưa khớp với mật khẩu mới.":
    "The password confirmation does not match the new password.",
  "Vui lòng nhập mật khẩu hiện tại để xác nhận.":
    "Enter your current password to confirm.",
  "Email này đã được dùng cho một tài khoản khác. Vui lòng nhập email khác.":
    "This email is already used by another account. Enter a different email.",
  "Email chưa đúng định dạng. Ví dụ hợp lệ: nguyenvana@gmail.com":
    "The email format is invalid. Example: nguyenvana@gmail.com",
  "Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác.":
    "This username is already taken. Choose a different name.",
  "Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 ký tự đặc biệt.":
    "The password must contain at least one uppercase letter, one lowercase letter and one special character.",
  "Chứng từ phải có ít nhất một dòng hàng.":
    "The document must contain at least one line item.",
};
export const VALIDATION_ATTRIBUTES: Record<string, string> = {
  email: "email",
  "tên đăng nhập": "username",
  "mật khẩu": "password",
  "mật khẩu mới": "new password",
  "mật khẩu hiện tại": "current password",
  "mã đặt lại mật khẩu": "reset token",
  "mã OTP": "OTP",
  "họ và tên": "display name",
  "mã vai trò": "role code",
  "tên vai trò": "role name",
  "vai trò": "role",
  "danh sách vai trò": "role ids",
  "phạm vi vai trò": "scope ref",
  "ngày hiệu lực từ": "effective from",
  "ngày hiệu lực đến": "effective to",
  quyền: "permission",
  "danh sách quyền": "permission ids",
  "loại phạm vi": "scope type",
  "phạm vi dữ liệu": "scope ref",
  "ngữ cảnh": "context",
  "loại ngữ cảnh": "context type",
  "người thực hiện": "actor",
  "phòng ban": "department",
  "mã phòng ban": "department code",
  "tên phòng ban": "department name",
  "lý do ngừng hoạt động": "deactivation reason",
  tên: "name",
  mã: "code",
  "mô tả": "description",
  "ghi chú": "note",
  "lý do": "reason",
  "mã lý do": "reason code",
  "lý do hủy": "cancel reason",
  "trạng thái": "status",
  "phiên bản": "version",
  "mã phiên bản": "version code",
  "số điện thoại": "phone",
  "địa chỉ": "address",
  "tên người liên hệ": "contact name",
  "người liên hệ": "contact person",
  "đặt làm mặc định": "is primary",
  "độ ưu tiên": "priority",
  "thứ tự sắp xếp": "sort order",
  "đơn vị tính": "unit",
  "thông tin bổ sung": "meta",
  "chế độ": "mode",
  "mục đích": "purpose",
  "thị trường": "market",
  "khu vực": "region",
  "từ khóa": "keyword",
  trang: "page",
  "số dòng mỗi trang": "per page",
  "trường sắp xếp": "sort by",
  "chiều sắp xếp": "sort dir",
  "từ ngày": "from date",
  "đến ngày": "to date",
  "tính đến thời điểm": "as of",
  "bộ lọc": "filters",
  "định dạng": "format",
  "mã báo cáo": "report code",
  "chỉ hiện chênh lệch": "only mismatch",
  "tệp tin": "file",
  "mã kiểm tra tệp": "file sha256",
  "mã kiểm tra nguồn": "source checksum",
  "tên tệp nguồn": "source file name",
  "mã chứng từ": "doc no",
  "ngày chứng từ": "doc date",
  "loại chứng từ": "doc type",
  "loại phát sinh": "movement type",
  "mã yêu cầu": "request no",
  "ngày yêu cầu": "request date",
  "loại yêu cầu": "request type",
  "yêu cầu": "request",
  "danh sách yêu cầu": "requests",
  "tên người nhận": "receiver name",
  "địa chỉ người nhận": "receiver address",
  "số điện thoại người nhận": "receiver contact phone",
  "chứng từ tham chiếu": "reference document",
  "loại chứng từ tham chiếu": "reference document type",
  "phiếu xuất": "outbound document",
  "dòng khớp phiếu xuất": "outbound item match",
  "phiếu hoàn trả": "reversal document",
  "loại hoàn trả": "reversal type",
  "mã phiếu xuất linh kiện": "component issue no",
  "mã lô nhập": "import no",
  "lô nhập khẩu": "import batch",
  "mã lô nhập khẩu": "import batch code",
  "kỳ nhập": "import period",
  "lần chuyển dữ liệu": "migration run",
  "nhà cung cấp": "supplier name",
  "số lô nhà cung cấp": "supplier batch no",
  "ngày mua": "purchase date",
  "danh sách dòng hàng": "lines",
  "dòng hàng": "id",
  "số thứ tự dòng": "row no",
  "sản phẩm": "product",
  "mã SKU": "SKU",
  "sản phẩm cụ thể": "item",
  "danh sách sản phẩm": "items",
  "thùng/khay": "container",
  "số lượng": "quantity",
  "số lượng dự kiến": "quantity planned",
  "số lượng thực tế": "quantity actual",
  "số lượng thất lạc": "quantity lost",
  "số lượng yêu cầu": "required quantity",
  "số lượng hoàn trả": "reversal quantity",
  "đơn giá": "unit cost",
  "phát sinh kho": "movement",
  "danh sách dòng": "rows",
  "đại lý": "agency",
  "tên khách hàng": "customer name",
  "số điện thoại khách hàng": "customer phone",
  "địa chỉ khách hàng": "customer address",
  "số lượng nhận": "received quantity",
  "tổng số lượng dự kiến": "expected total quantity",
  "định mức tồn tối thiểu": "min stock",
  "định mức tồn tối đa": "max stock",
  "danh sách SKU dưới định mức": "below min stock SKUs",
  "danh sách SKU vượt định mức": "above max stock SKUs",
  kho: "warehouse",
  "kho nguồn": "src warehouse",
  "kho đích": "dst warehouse",
  "mã khu vực": "zone code",
  "gợi ý vị trí": "location hint",
  "mã thùng/khay": "container code",
  "loại thùng/khay": "container type",
  "thùng/khay cha": "parent container",
  "mã thùng": "box code",
  thùng: "box container",
  "khay đích": "to tray",
  "mã kiện hàng": "shipment container code",
  "trạng thái tồn kho": "stock status",
  "tên SKU": "SKU name",
  "loại SKU": "SKU type",
  "sản phẩm chính": "primary SKU",
  "danh mục cha": "parent master",
  "loại danh mục": "master type",
  "thương hiệu": "brand",
  "mã thương hiệu": "brand code",
  "danh mục": "category",
  "mã danh mục": "category code",
  "ngành hàng": "industry",
  "thẻ gắn nhãn": "tag",
  "dòng máy": "model",
  "mã dòng máy": "model code",
  "tên dòng máy": "model name",
  "nguồn điện": "power source",
  "mã nguồn điện": "power source code",
  "nguồn điện/điện áp": "power or voltage",
  "quy cách đóng gói": "package variant",
  "mã quy cách đóng gói": "package variant code",
  "mã quy cách": "package code",
  "tên quy cách": "package name",
  "thông số kỹ thuật": "specification",
  "quản lý theo serial": "is serial tracked",
  "mô tả sản phẩm nhập tay": "manual product description",
  "trạng thái xuất bản": "published",
  "xuất bản lên App PV": "published to app",
  "mã sản phẩm": "item code",
  "trạng thái sản phẩm": "item status",
  "tình trạng sản phẩm": "item condition",
  "mã quét": "raw code",
  "nguồn quét": "scan source",
  "số serial": "serial number",
  "mã thiết bị": "hardware uid",
  "mã tạm của sản phẩm": "temporary item code",
  "giá trị mã": "code value",
  "loại mã": "code type",
  "danh sách mã": "codes",
  "loại vật mang mã": "carrier type",
  "mã vật lý": "physical code",
  "danh sách mã vật lý": "physical codes",
  "trạng thái mã": "status",
  "mã thay thế": "replaced by code",
  "lượt quét nhập": "inbound scan entry",
  "lô quét": "batch",
  "trạng thái nhận diện": "identification status",
  "phiên bản mã hóa": "encoded payload version",
  "nội dung nhãn": "label payload",
  "khổ nhãn": "label size",
  "mẫu nhãn": "label snapshot",
  "máy in": "printer",
  "mã máy in": "printer code",
  "tên máy in": "printer name",
  "cấu hình máy in": "printer config",
  "mã agent in": "agent code",
  "địa chỉ agent in": "agent endpoint",
  "mã đại lý": "agency code",
  "tên đại lý": "agency name",
  "người nhận": "recipient",
  "loại người nhận": "recipient type",
  "mã phiếu bảo hành": "case no",
  "phiếu bảo hành": "warranty case",
  "thuộc diện bảo hành": "warranty applicable",
  "lỗi hỏng": "defect",
  "danh sách lỗi hỏng": "defect ids",
  "mã lỗi hỏng": "defect code",
  "danh sách mã lỗi hỏng": "defect codes",
  "tên lỗi hỏng": "defect name",
  "lỗi khách báo": "reported defect",
  "lỗi đã xác nhận": "confirmed defect",
  "tình trạng khi nhận": "received condition",
  "tình trạng khi trả": "return condition",
  "tình trạng": "condition status",
  "phụ kiện kèm theo": "accessories received",
  "xác nhận đã trả hàng": "physical return confirmed",
  "ngày dự kiến hoàn tất": "estimated completion date",
  "danh sách linh kiện": "components",
  "linh kiện": "component",
  "số lượng linh kiện": "quantity",
  "loại tệp đính kèm": "attachment type",
  "định dạng ảnh cho phép": "allowed image mime",
  "định dạng video cho phép": "allowed video mime",
  "nguồn dữ liệu": "source",
  "tên nguồn dữ liệu": "source name",
  "loại nguồn dữ liệu": "source type",
  "tham chiếu nguồn": "source reference",
  "đối tượng gán": "assigned object",
  "loại đối tượng gán": "assigned object type",
  "cho phép cập nhật dữ liệu hiện có": "update existing",
  "chạy thử": "dry run",
  "lý do thiếu mã": "missing code reason",
  "trạng thái lỗi": "error status",
  "dữ liệu không hợp lệ": "unexpected fields",
  "thông tin cá nhân đã thay đổi": "pii fields changed",
};
export const VALIDATION_MESSAGES: ReadonlyArray<readonly [string, string]> = [
  [
    "Trường {attribute} chứa ký tự không hợp lệ (không phải UTF-8).",
    "Field {attribute} contains invalid characters (not UTF-8).",
  ],
  [
    "Máy in phản hồi lỗi khi nhận lệnh in (HTTP {status}).",
    "The printer returned an error while receiving the print job (HTTP {status}).",
  ],
  ["Trùng dòng {row}.", "Duplicate of row {row}."],
  [
    "Không tìm thấy BRAND ACTIVE với code {code}. Master data phải được tạo trước qua POST /api/v1/brands hoặc /api/v1/product-categories.",
    "No active brand was found with code {code}. Create the master data before importing.",
  ],
  [
    "Không tìm thấy BRAND ACTIVE với code {code}.",
    "No active brand was found with code {code}.",
  ],
  [
    "Không tìm thấy BRAND Đang hoạt động với code {code}. Master data phải được tạo trước qua POST /api/v1/brands hoặc /api/v1/product-categories.",
    "No active brand was found with code {code}. Create the master data before importing.",
  ],
  [
    "Không tìm thấy BRAND Đang hoạt động với code {code}.",
    "No active brand was found with code {code}.",
  ],
  [
    "Không tìm thấy CATEGORY ACTIVE với code {code}. Master data phải được tạo trước qua POST /api/v1/brands hoặc /api/v1/product-categories.",
    "No active category was found with code {code}. Create the master data before importing.",
  ],
  [
    "Không tìm thấy CATEGORY ACTIVE với code {code}.",
    "No active category was found with code {code}.",
  ],
  [
    "Không tìm thấy CATEGORY Đang hoạt động với code {code}. Master data phải được tạo trước qua POST /api/v1/brands hoặc /api/v1/product-categories.",
    "No active category was found with code {code}. Create the master data before importing.",
  ],
  [
    "Không tìm thấy CATEGORY Đang hoạt động với code {code}.",
    "No active category was found with code {code}.",
  ],
  [
    "Không tìm thấy MODEL ACTIVE với code {code}. Master data phải được tạo trước qua POST /api/v1/brands hoặc /api/v1/product-categories.",
    "No active model was found with code {code}. Create the master data before importing.",
  ],
  [
    "Không tìm thấy MODEL ACTIVE với code {code}.",
    "No active model was found with code {code}.",
  ],
  [
    "Không tìm thấy MODEL Đang hoạt động với code {code}. Master data phải được tạo trước qua POST /api/v1/brands hoặc /api/v1/product-categories.",
    "No active model was found with code {code}. Create the master data before importing.",
  ],
  [
    "Không tìm thấy MODEL Đang hoạt động với code {code}.",
    "No active model was found with code {code}.",
  ],
  ["sku_type phải thuộc {values}.", "sku_type must be one of: {values}."],
  ["sku_type không hợp lệ.", "sku_type is invalid."],
  ["status phải thuộc {values}.", "status must be one of: {values}."],
  ["status không hợp lệ.", "status is invalid."],
  [
    "published_to_app phải thuộc {values}.",
    "published_to_app must be one of: {values}.",
  ],
  ["published_to_app không hợp lệ.", "published_to_app is invalid."],
  [
    "is_serial_tracked phải thuộc {values}.",
    "is_serial_tracked must be one of: {values}.",
  ],
  ["is_serial_tracked không hợp lệ.", "is_serial_tracked is invalid."],
  [
    "package_variant phải thuộc {values}.",
    "package_variant must be one of: {values}.",
  ],
  ["package_variant không hợp lệ.", "package_variant is invalid."],
  ["Vui lòng nhập {attribute}.", "Enter {attribute}."],
  [
    "{attribute} phải có ít nhất {min} ký tự.",
    "{attribute} must contain at least {min} characters.",
  ],
  [
    "{attribute} không được dài quá {max} ký tự.",
    "{attribute} must not exceed {max} characters.",
  ],
  ["{attribute} phải là số nguyên.", "{attribute} must be an integer."],
  ["{attribute} phải là số.", "{attribute} must be a number."],
  [
    "{attribute} phải lớn hơn {value}.",
    "{attribute} must be greater than {value}.",
  ],
  [
    "{attribute} không được lớn hơn {value}.",
    "{attribute} must not exceed {value}.",
  ],
  [
    "{attribute} phải từ {value} trở lên.",
    "{attribute} must be at least {value}.",
  ],
  [
    "{attribute} chưa đúng định dạng email.",
    "{attribute} must be a valid email address.",
  ],
  [
    "{attribute} chưa đúng định dạng ngày.",
    "{attribute} must be a valid date.",
  ],
  ["{attribute} chưa đúng định dạng.", "{attribute} has an invalid format."],
  ["{attribute} không hợp lệ.", "{attribute} is invalid."],
  ["{attribute} phải là danh sách.", "{attribute} must be a list."],
  ["{attribute} phải là chuỗi ký tự.", "{attribute} must be text."],
  [
    "{attribute} phải có ít nhất {min} mục.",
    "{attribute} must contain at least {min} items.",
  ],
  [
    "{attribute} không được có quá {max} mục.",
    "{attribute} must not contain more than {max} items.",
  ],
  [
    "{attribute} phải gồm đúng {digits} chữ số.",
    "{attribute} must contain exactly {digits} digits.",
  ],
  [
    "{attribute} đã chọn không tồn tại trong hệ thống. Vui lòng chọn lại.",
    "The selected {attribute} does not exist. Choose another value.",
  ],
  [
    "{attribute} đã chọn không nằm trong danh sách cho phép.",
    "The selected {attribute} is not allowed.",
  ],
  [
    "{attribute} này đã tồn tại trong hệ thống. Vui lòng nhập giá trị khác.",
    "This {attribute} already exists. Enter a different value.",
  ],
  [
    "{attribute} bị nhập trùng. Mỗi giá trị chỉ được xuất hiện một lần.",
    "{attribute} is duplicated. Each value may only appear once.",
  ],
  ["{attribute} phải sau ngày {date}.", "{attribute} must be after {date}."],
  [
    "{attribute} phải từ ngày {date} trở đi.",
    "{attribute} must be on or after {date}.",
  ],
  ["{attribute} phải trước ngày {date}.", "{attribute} must be before {date}."],
  [
    "{attribute} phải trước hoặc bằng ngày {date}.",
    "{attribute} must be on or before {date}.",
  ],
  [
    "{attribute} phải theo định dạng {format}.",
    "{attribute} must use the format {format}.",
  ],
  [
    "{attribute} phải có từ {min} đến {max} mục.",
    "{attribute} must contain between {min} and {max} items.",
  ],
  [
    "{attribute} phải nằm trong khoảng {min} đến {max}.",
    "{attribute} must be between {min} and {max}.",
  ],
  [
    "{attribute} phải có độ dài từ {min} đến {max} ký tự.",
    "{attribute} must contain between {min} and {max} characters.",
  ],
  [
    "{attribute} chỉ được chứa chữ cái.",
    "{attribute} may only contain letters.",
  ],
  [
    "{attribute} chỉ được chứa chữ cái và số.",
    "{attribute} may only contain letters and numbers.",
  ],
  ["{attribute} phải là đường dẫn hợp lệ.", "{attribute} must be a valid URL."],
  [
    "{attribute} chỉ nhận giá trị có hoặc không.",
    "{attribute} must be yes or no.",
  ],
  ["{attribute} phải là một tệp tin.", "{attribute} must be a file."],
  ["{attribute} phải là tệp hình ảnh.", "{attribute} must be an image."],
  [
    "{attribute} phải có đúng {size} ký tự.",
    "{attribute} must contain exactly {size} characters.",
  ],
  [
    "{attribute} phải có đúng {size} mục.",
    "{attribute} must contain exactly {size} items.",
  ],
  ["{attribute} phải bằng {size}.", "{attribute} must equal {size}."],
  [
    "{attribute} phải có từ {min} đến {max} chữ số.",
    "{attribute} must contain between {min} and {max} digits.",
  ],
  [
    "{attribute} phải có {decimal} chữ số sau dấu phẩy.",
    "{attribute} must contain {decimal} decimal places.",
  ],
  ["{attribute} phải viết thường toàn bộ.", "{attribute} must be lowercase."],
  ["{attribute} phải viết hoa toàn bộ.", "{attribute} must be uppercase."],
  [
    "{attribute} phải là múi giờ hợp lệ.",
    "{attribute} must be a valid timezone.",
  ],
  [
    "{attribute} phải là địa chỉ IP hợp lệ.",
    "{attribute} must be a valid IP address.",
  ],
  [
    "{attribute} phải là địa chỉ IPv4 hợp lệ.",
    "{attribute} must be a valid IPv4 address.",
  ],
  [
    "{attribute} phải là địa chỉ IPv6 hợp lệ.",
    "{attribute} must be a valid IPv6 address.",
  ],
  [
    "{attribute} phải là chuỗi JSON đúng cú pháp.",
    "{attribute} must be valid JSON.",
  ],
  [
    "Không được nhập {attribute} trong trường hợp này.",
    "Do not enter {attribute} in this case.",
  ],
  [
    "Thiếu {attribute} trong dữ liệu gửi lên.",
    "{attribute} is missing from the submitted data.",
  ],
  [
    "Tệp {attribute} không được lớn hơn {max} KB.",
    "The {attribute} file must not exceed {max} KB.",
  ],
  [
    "Tệp {attribute} phải có dung lượng ít nhất {min} KB.",
    "The {attribute} file must be at least {min} KB.",
  ],
  [
    "Không tải lên được tệp {attribute}. Vui lòng thử lại.",
    "The {attribute} file could not be uploaded. Try again.",
  ],
  [
    "Phần xác nhận {attribute} chưa khớp. Vui lòng nhập lại cho giống nhau.",
    "The {attribute} confirmation does not match. Enter matching values.",
  ],
  ["Trường {attribute} là bắt buộc.", "{attribute} is required."],
  [
    "Trường {attribute} phải có ít nhất {min} ký tự.",
    "{attribute} must contain at least {min} characters.",
  ],
  [
    "Số lượng quét vượt quá số lượng còn lại ở dòng {line}.",
    "The scanned quantity exceeds the remaining quantity on line {line}.",
  ],
  [
    "{attribute} vừa được cập nhật ở nơi khác. Hãy tải lại rồi thao tác lại.",
    "{attribute} was updated elsewhere. Reload and try again.",
  ],
];
