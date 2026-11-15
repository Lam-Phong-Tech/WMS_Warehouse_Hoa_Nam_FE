/** Frontend contract failures use the same display-time localization boundary. */
export const BACKEND_CLIENT_ERRORS: ReadonlyArray<
  readonly [string, string, string]
> = [
  [
    "Dữ liệu từ máy chủ chưa đầy đủ hoặc không hợp lệ ({value0}). Vui lòng tải lại để kiểm tra.",
    "Server data is incomplete or invalid ({value0}). Reload to check again.",
    "服务器数据不完整或无效（{value0}）。请重新加载后检查。",
  ],
  [
    "Chưa xác định được trạng thái từ máy chủ ({value0}). Vui lòng tải lại để kiểm tra.",
    "The server state could not be determined ({value0}). Reload to check again.",
    "无法确定服务器状态（{value0}）。请重新加载后检查。",
  ],
  [
    "Phản hồi máy chủ thiếu định danh {value0}. Vui lòng tải lại để kiểm tra.",
    "The server response is missing identifier {value0}. Reload to check again.",
    "服务器响应缺少标识 {value0}。请重新加载后检查。",
  ],
  [
    "Chưa nhận đủ dữ liệu từ máy chủ ({value0}). Vui lòng tải lại.",
    "Server data is incomplete ({value0}). Please reload.",
    "服务器数据不完整（{value0}）。请重新加载。",
  ],
  [
    "Danh sách từ máy chủ chưa đầy đủ hoặc không hợp lệ ({value0}). Vui lòng tải lại.",
    "The server list is incomplete or invalid ({value0}). Please reload.",
    "服务器列表不完整或无效（{value0}）。请重新加载。",
  ],
  [
    "Chưa có phiên bản bản ghi hợp lệ từ máy chủ. Vui lòng tải lại trước khi thao tác.",
    "No valid record version was received from the server. Reload before continuing.",
    "尚未收到服务器返回的有效记录版本。请重新加载后再操作。",
  ],
  [
    "Phản hồi máy chủ chưa xác định yêu cầu chứng từ. Vui lòng tải lại để kiểm tra.",
    "The server response does not identify the document request. Reload to check again.",
    "服务器响应未能确定单据请求。请重新加载后检查。",
  ],
  [
    "Phản hồi máy chủ không có danh sách chứng từ hợp lệ. Vui lòng tải lại để kiểm tra.",
    "The server response does not contain a valid document list. Reload to check again.",
    "服务器响应未包含有效的单据列表。请重新加载后检查。",
  ],
  [
    "Dữ liệu truy vết không hợp lệ. Vui lòng thử lại.",
    "The traceability data is invalid. Please try again.",
    "追溯数据无效。请重试。",
  ],
  [
    "Sự kiện truy vết thiếu mã hoặc số lượng biến động.",
    "The trace event is missing a code or movement quantity.",
    "追溯事件缺少编码或变动数量。",
  ],
];
