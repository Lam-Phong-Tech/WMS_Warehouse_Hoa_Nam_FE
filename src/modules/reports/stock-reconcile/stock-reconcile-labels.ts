import { bilingual } from "@/shared/constants/business-labels";

/**
 * Từ vựng của màn RPT-02 "Tồn kho & đối soát".
 *
 * Vì sao tách khỏi component: ba bảng dưới đây được đọc bằng PHÉP TRUY CẬP
 * THUỘC TÍNH (`LABELS[row.kind]`) ở rất nhiều chỗ, kể cả trong hàm cấp module.
 * `bilingual()` trả về một Proxy đọc ngôn ngữ ngay lúc truy cập, nên giữ nguyên
 * được lối viết đó mà vẫn đổi tiếng — thay vì phải bơm `t()` qua từng hàm.
 * Đây cũng là chỗ duy nhất của màn này được phép chứa chữ tiếng Việt trần
 * (khai trong `VIETNAMESE_IS_DATA` của `i18n-coverage.test.ts`).
 *
 * CẢNH BÁO: KHÔNG spread (`{ ...LABELS }`) mấy bảng này vào bảng khác — spread
 * đọc hết thuộc tính NGAY LÚC ĐÓ và đóng băng ngôn ngữ tại thời điểm import.
 */

/**
 * CỐ Ý không đọc `INVENTORY_STOCK_STATUS_LABELS`: demo gọi DEFECTIVE là "Lỗi"
 * và QUARANTINE là "Cách ly", ngắn hơn nhãn dùng chung ("Hàng lỗi" / "Chờ kiểm
 * tra") vì chúng nằm trong thanh cơ cấu tồn có bề ngang hẹp.
 */
export const LABELS: Readonly<Record<string, string>> = bilingual(
  {
    AVAILABLE: "Khả dụng",
    NON_SELLABLE: "Không thể bán/xuất",
    DEFECTIVE: "Lỗi",
    QUARANTINE: "Cách ly",
    PRODUCT: "Sản phẩm",
    COMPONENT: "Linh kiện",
  },
  {
    AVAILABLE: "Available",
    NON_SELLABLE: "Not sellable/issuable",
    DEFECTIVE: "Defective",
    QUARANTINE: "Quarantined",
    PRODUCT: "Product",
    COMPONENT: "Component",
  },
);

/** Nhãn 4 phép kiểm §7.5 — hai mã đầu lấy từ demo, hai mã sau từ hợp đồng BE. */
export const CHECK_LABELS: Readonly<Record<string, string>> = bilingual(
  {
    ledger_to_balance: "Sổ cái ↔ số dư",
    serial_subledger: "Sổ serial",
    quantity_subledger: "Số lượng trong thùng",
    container_integrity: "Toàn vẹn thùng chứa",
  },
  {
    ledger_to_balance: "Ledger ↔ balance",
    serial_subledger: "Serial subledger",
    quantity_subledger: "Quantity in container",
    container_integrity: "Container integrity",
  },
);

/**
 * Tra nhãn phép kiểm CHỊU ĐƯỢC khác biệt cách viết của BE.
 *
 * Khoá của `CHECK_LABELS` là chữ thường (`serial_subledger`) vì đó là dạng
 * endpoint đối soát đang trả. Nhưng cùng khái niệm đó, bảng
 * `reconciliation_incidents.divergence_type` lại lưu HOA kèm hậu tố
 * (`SERIAL_SUBLEDGER_MISMATCH`). Trước đây nơi gọi rơi thẳng về `?? check` nên
 * dạng nào lệch một chút là in nguyên mã máy ra chip "Lệch ở". Chuẩn hoá về
 * chữ thường + bỏ hậu tố `_mismatch` để cả hai cách viết cùng ra một nhãn;
 * mã thật sự lạ mới tách gạch dưới cho đọc được.
 */
export function checkLabelOf(code: string): string {
  const raw = code.trim();
  if (raw === "") return "";
  const normalized = raw.toLowerCase().replace(/_mismatch$/, "");
  return (
    CHECK_LABELS[raw] ??
    CHECK_LABELS[normalized] ??
    normalized.split("_").filter(Boolean).join(" ")
  );
}

/**
 * `reconciliation_incidents.status` — trạng thái xử lý sự cố đối soát. Cột này
 * hiện chưa có nguồn ở endpoint đối soát (adapter trả `null`), nhưng chỗ render
 * ghép thẳng giá trị vào chuỗi, nên ngày BE map thật vào là mã máy ra thẳng
 * màn hình. Khai nhãn TRƯỚC để cái ngày đó không phải là một lỗi nữa.
 */
export const INCIDENT_STATUS_LABELS: Readonly<Record<string, string>> =
  bilingual(
    {
      INVESTIGATING: "Đang điều tra",
      RESOLVED: "Đã xử lý",
      WAIVED: "Đã bỏ qua",
      OPEN: "Chờ xử lý",
    },
    {
      INVESTIGATING: "Investigating",
      RESOLVED: "Resolved",
      WAIVED: "Waived",
      OPEN: "Open",
    },
  );

export type NormState = "LOW" | "OVER" | "NORMAL" | "UNSET";

/**
 * KHÔNG dùng "Min"/"Max" ở bản tiếng Việt: đây là màn cho người vận hành kho,
 * chữ viết tắt tiếng Anh trong ô trạng thái thì người đọc phải tự dịch. Dùng
 * đúng cặp từ đã in trên chính hai cột số ngay bên trái ("Tối thiểu" / "Tối
 * đa") để người đọc nối được ô trạng thái với con số sinh ra nó.
 */
export const NORM_STATE_LABELS: Readonly<Record<NormState, string>> = bilingual(
  {
    LOW: "Dưới tối thiểu",
    OVER: "Vượt tối đa",
    NORMAL: "Trong định mức",
    UNSET: "Chưa đặt định mức",
  },
  {
    LOW: "Below minimum",
    OVER: "Above maximum",
    NORMAL: "Within range",
    UNSET: "No threshold set",
  },
);

const KIND_OPTION_LABELS = bilingual(
  { all: "Tất cả loại hàng" },
  { all: "All item kinds" },
);

/**
 * `label` là GETTER chứ không phải giá trị: đọc nhãn ngay tại đây sẽ đóng băng
 * ngôn ngữ lúc import module.
 */
export const KIND_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  {
    value: "all",
    get label() {
      return KIND_OPTION_LABELS.all;
    },
  },
  {
    value: "PRODUCT",
    get label() {
      return LABELS.PRODUCT;
    },
  },
  {
    value: "COMPONENT",
    get label() {
      return LABELS.COMPONENT;
    },
  },
];
