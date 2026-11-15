import type { BackendParameterKind } from "./backend-catalog.types";

type Vocabulary = Readonly<Record<string, readonly [en: string, zh: string]>>;

/** Only values produced by these typed backend parameters are translated.
 * Names, document codes, UUIDs and all unknown parameter values stay unchanged. */
const status: Vocabulary = {
  Nháp: ["Draft", "草稿"],
  "Đang quét": ["Scanning", "扫描中"],
  "Đã ghi nhận": ["Posted", "已过账"],
  "Đã hủy": ["Canceled", "已取消"],
  "Đã in": ["Printed", "已打印"],
  "Đã xem trước": ["Previewed", "已预览"],
  "Sẵn sàng in": ["Ready to print", "待打印"],
  "Chờ in": ["Pending print", "等待打印"],
  "In thất bại": ["Print failed", "打印失败"],
  "Hợp lệ": ["Valid", "有效"],
  "Đã tồn tại/đã xử lý": ["Already exists or processed", "已存在或已处理"],
  "Không nhận diện được": ["Unknown", "无法识别"],
  "Không hợp lệ": ["Invalid", "无效"],
  Khớp: ["Matched", "匹配"],
  "Có chênh lệch": ["Mismatch", "存在差异"],
  "Không áp dụng": ["Not applicable", "不适用"],
  "Khả dụng": ["Available", "可用"],
  "Không thể bán/xuất": ["Non-sellable", "不可销售或出库"],
  "Hàng lỗi": ["Defective", "不良品"],
  "Chờ kiểm tra": ["Quarantined", "待检"],
  "Đang hoạt động": ["Active", "已启用"],
  "Ngừng hoạt động": ["Inactive", "已停用"],
  "Đã khóa": ["Locked", "已锁定"],
  "Sản phẩm": ["Product", "产品"],
  "Linh kiện": ["Component", "配件"],
  "Chờ xếp khay": ["Awaiting putaway", "待上架"],
  "Đã xếp khay": ["Stored", "已上架"],
  "Đã tiếp nhận": ["Received", "已接收"],
  "Đang kiểm tra": ["Checking", "检测中"],
  "Đang sửa chữa": ["Repairing", "维修中"],
  "Đã hoàn tất": ["Completed", "已完成"],
  "Đã trả khách": ["Returned to customer", "已退还客户"],
  "Đang bảo hành": ["Under warranty", "保修中"],
};

const phase: Vocabulary = {
  "khi tạo phiếu": ["when creating the document", "创建单据时"],
  "khi quét linh kiện": ["when scanning components", "扫描配件时"],
  "khi gỡ dòng quét": ["when removing a scan", "移除扫描记录时"],
  "khi thêm dòng linh kiện": ["when adding a component line", "添加配件行时"],
  "khi sửa dòng linh kiện": ["when editing a component line", "编辑配件行时"],
  "khi xoá dòng linh kiện": ["when deleting a component line", "删除配件行时"],
  "tại thời điểm Post": ["when posting", "过账时"],
};

const action: Vocabulary = {
  update: ["update", "更新"],
  cancel: ["cancel", "取消"],
  "post receipt": ["post receipt", "入库过账"],
  "post issue": ["post issue", "出库过账"],
  scan: ["scan", "扫描"],
  "gỡ dòng quét": ["remove a scan", "移除扫描记录"],
  "thêm dòng": ["add a line", "添加行"],
  "sửa dòng": ["edit a line", "编辑行"],
  "xoá dòng": ["delete a line", "删除行"],
  "cập nhật": ["update", "更新"],
  "gửi duyệt": ["submit for approval", "提交审批"],
  duyệt: ["approve", "批准"],
  "từ chối duyệt": ["reject approval", "拒绝审批"],
  hủy: ["cancel", "取消"],
  "chuyển đổi thành phiếu": ["convert to a document", "转换为单据"],
  "xuất điều chuyển": ["dispatch the transfer", "调拨出库"],
  "nhận hàng điều chuyển": ["receive transferred goods", "接收调拨货物"],
  "ghi nhận mất mát điều chuyển": ["record a transfer loss", "记录调拨损失"],
  "trả lại hàng điều chuyển": ["return transferred goods", "退回调拨货物"],
  "xác nhận nhận lại hàng trả về": [
    "confirm receipt of returned goods",
    "确认接收退回货物",
  ],
};

const handover: Vocabulary = {
  "người nhận": ["recipient", "接收人"],
  "ngày bàn giao": ["handover date", "交接日期"],
  "xác nhận kiểm tra": ["inspection confirmation", "检查确认"],
  "ghi chú": ["note", "备注"],
};

const vocabularies: Readonly<
  Partial<Record<BackendParameterKind, Vocabulary>>
> = {
  status,
  phase,
  action,
  handover,
  master: {
    BRAND: ["brand", "品牌"],
    CATEGORY: ["category", "类别"],
    MODEL: ["model", "型号"],
    "Ngành nghề": ["industries", "行业"],
    Tag: ["tags", "标签"],
  },
  resource: {
    "Chứng từ gốc": ["The original document", "原始单据"],
    "Chứng từ điều chỉnh": ["The reversal document", "冲销单"],
    "Dữ liệu": ["The data", "数据"],
  },
};

export function translateBackendParameter(
  value: string,
  kind: BackendParameterKind,
  language: "en" | "zh",
  translateNested: (message: string) => string,
): string {
  if (kind === "message") return translateNested(value);
  if (kind === "extensions") {
    // Only the producer's extension list connector is prose.
    return /^\.?[a-z0-9]+(?: hoặc \.?[a-z0-9]+)+$/i.test(value)
      ? value.split(" hoặc ").join(language === "en" ? " or " : " 或 ")
      : value;
  }
  const vocabulary = vocabularies[kind];
  const index = language === "en" ? 0 : 1;
  const lookup = (label: string): string | undefined => {
    if (!vocabulary) return undefined;
    if (Object.hasOwn(vocabulary, label)) return vocabulary[label][index];
    return Object.values(vocabulary).find((values) => values.includes(label))?.[
      index
    ];
  };
  if (kind === "handover") {
    const labels = value.split(value.includes("、") ? "、" : ", ");
    return labels.every((label) => lookup(label) !== undefined)
      ? labels
          .map((label) => lookup(label))
          .join(language === "en" ? ", " : "、")
      : value;
  }
  return lookup(value) ?? value;
}
