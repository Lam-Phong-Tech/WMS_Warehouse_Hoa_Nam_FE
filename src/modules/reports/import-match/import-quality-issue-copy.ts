import { useLanguageStore } from "@/shared/i18n/language.store";
import { localizeMessage } from "@/shared/i18n/localize-message";
import type { ImportQualityIssue } from "./import-quality-api";

const fields: Record<string, string> = {
  sku_type: "Loại SKU",
  sku_code: "Mã SKU",
  sku_name: "Tên SKU",
};
const rules: Record<string, string> = {
  INVALID_ENUM: "Giá trị không thuộc danh sách cho phép",
  DUPLICATE_CODE: "Trùng mã SKU",
};
const skuTypes: Record<string, string> = {
  PRODUCT: "Sản phẩm",
  COMPONENT: "Linh kiện",
};

/** Format presentation only; source fields, rule codes and file values stay intact. */
export function importQualityIssueCopy(issue: ImportQualityIssue) {
  const display = {
    message: localizeMessage(issue.message) || issue.code,
    field: issue.field || "—",
    rule: issue.code || "—",
    hint: localizeMessage(issue.suggestedAction),
  };
  if (useLanguageStore.getState().language !== "vi") return display;

  if (fields[issue.field])
    display.field = `${fields[issue.field]} (${issue.field})`;
  if (rules[issue.code]) display.rule = `${rules[issue.code]} (${issue.code})`;

  // Match known server prose, rather than guessing from an error code alone.
  if (issue.message.trim() === "SKU đã tồn tại; cần bật update_existing.") {
    display.message =
      "SKU đã tồn tại. Bật tùy chọn “Cho phép cập nhật SKU đã tồn tại” để cập nhật.";
  }
  const allowed = /^sku_type phải thuộc (.+)\.$/.exec(issue.message.trim());
  if (issue.field === "sku_type" && issue.code === "INVALID_ENUM" && allowed) {
    const values = allowed[1].split(",").map((value) => value.trim());
    display.message = `Loại SKU chỉ chấp nhận ${values
      .map((value) =>
        skuTypes[value] ? `“${skuTypes[value]}” (${value})` : value,
      )
      .join(" hoặc ")}.`;
  }
  display.hint = display.hint.replace(
    /\bcột message\b/g,
    "cột Thông báo (message)",
  );
  if (
    issue.suggestedAction ===
    'SKU đã tồn tại: bật tùy chọn "cập nhật SKU đã tồn tại" nếu thực sự muốn ghi đè.'
  ) {
    display.hint =
      "Bật tùy chọn “Cho phép cập nhật SKU đã tồn tại” nếu bạn muốn cập nhật dữ liệu của SKU này.";
  }
  return display;
}
