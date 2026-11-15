import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { localizeMessage } from "@/shared/i18n/localize-message";
import {
  ApiEnvelopeError,
  createMockAxiosError,
  getApiErrorMessage,
  normalizeError,
} from "./api-error";

const messages = [
  [
    "Barcode/QR không tồn tại hoặc không Đang hoạt động.",
    "The barcode/QR code does not exist or is inactive.",
    "条形码/二维码不存在或未启用。",
  ],
  [
    "SKU không tồn tại hoặc không Đang hoạt động.",
    "The SKU does not exist or is inactive.",
    "SKU 不存在或未启用。",
  ],
  [
    "Mọi phiếu linh kiện phải Đã ghi nhận trước khi bàn giao.",
    "All component issue documents must be posted before handover.",
    "交接前，所有配件出库单必须已过账。",
  ],
  [
    "Không thể kết nối tới máy in. Kiểm tra máy in đã bật và đã kết nối mạng, sau đó thử lại.",
    "Cannot connect to the printer. Check that it is turned on and connected to the network, then try again.",
    "无法连接打印机。请检查打印机是否已开启并连接网络，然后重试。",
  ],
  [
    "Không tìm thấy mã tra cứu (physical code / item / container / SKU).",
    "No matching physical code, item, container or SKU was found.",
    "未找到匹配的实物编码、物品、容器或 SKU。",
  ],
  [
    "Kiểm tra mã danh mục (brand/category/model) đã tồn tại và đang ACTIVE.",
    "Check that the brand, category or model code exists and is active.",
    "请检查品牌、类别或型号编码是否存在且已启用。",
  ],
  [
    "Chỉ hồ sơ bảo hành đang kiểm tra hoặc đang sửa chữa mới được xuất linh kiện khi tạo phiếu.",
    "Components can only be issued for warranty cases that are being checked or repaired when creating the document.",
    "创建单据时，只有处于检测中或维修中的保修单才能领用配件。",
  ],
  [
    "Hồ sơ bảo hành đã đóng nên không xuất linh kiện được khi tạo phiếu.",
    "Components cannot be issued for a closed warranty case when creating the document.",
    "创建单据时，已关闭的保修单不能领用配件。",
  ],
  [
    "Nhập sku_name (bắt buộc), tối đa 255 ký tự.",
    "Enter sku_name (required), up to 255 characters.",
    "请输入 sku_name（必填），最多 255 个字符。",
  ],
  [
    'SKU đã tồn tại: bật tùy chọn "cập nhật SKU đã tồn tại" nếu thực sự muốn ghi đè.',
    "The SKU already exists. Enable the option to update existing SKUs if you intend to overwrite it.",
    "SKU 已存在。如需覆盖，请启用“更新已有 SKU”选项。",
  ],
];
beforeAll(async () => {
  await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
});
afterEach(() => useLanguageStore.getState().setLanguage("vi"));

describe.each(["en", "zh"] as const)(
  "reported screen messages in %s",
  (language) => {
    it.each(messages)(
      "translates known server prose: %s",
      (message, en, zh) => {
        useLanguageStore.getState().setLanguage(language);
        const expected = language === "en" ? en : zh;
        const details = { status: "COMPLETED", not_posted_count: "2" };
        for (const error of [
          new ApiEnvelopeError({
            message,
            error: { code: "BUSINESS_RULE_VIOLATION", details },
          }),
          createMockAxiosError({
            status: 422,
            data: {
              message,
              error_code: "BUSINESS_RULE_VIOLATION",
              errors: details,
            },
          }),
        ]) {
          expect(getApiErrorMessage(error)).toBe(expected);
          expect(normalizeError(error).errors).toBe(details);
        }
        useLanguageStore.getState().setLanguage("vi");
        expect(localizeMessage(message)).toBe(message);
      },
    );

    it.each([
      ["BRAND", "brand", "品牌"],
      ["CATEGORY", "category", "类别"],
      ["MODEL", "model", "型号"],
    ])(
      "translates import master errors and preserves the %s code",
      (type, enType, zhType) => {
        useLanguageStore.getState().setLanguage(language);
        const code = "MÃ-HÒA-NAM.4343-SFSDF";
        const expected =
          language === "en"
            ? `No active ${enType} was found with code ${code}.`
            : `未找到编码为 ${code} 的已启用${zhType}。`;
        for (const status of ["ACTIVE", "Đang hoạt động"]) {
          expect(
            localizeMessage(
              `Không tìm thấy ${type} ${status} với code ${code}.`,
            ),
          ).toBe(expected);
          expect(
            localizeMessage(
              `Không tìm thấy ${type} ${status} với code ${code}. Master data phải được tạo trước qua POST /api/v1/brands hoặc /api/v1/product-categories.`,
            ),
          ).toBe(
            expected +
              (language === "en"
                ? " Create the master data before importing."
                : "请先创建主数据再导入。"),
          );
        }
      },
    );

    it("preserves printer HTTP status and duplicate row numbers", () => {
      useLanguageStore.getState().setLanguage(language);
      expect(
        localizeMessage("Máy in phản hồi lỗi khi nhận lệnh in (HTTP 503)."),
      ).toBe(
        language === "en"
          ? "The printer returned an error while receiving the print job (HTTP 503)."
          : "打印机接收打印任务时返回错误（HTTP 503）。",
      );
      expect(localizeMessage("Trùng dòng 234.")).toBe(
        language === "en" ? "Duplicate of row 234." : "与第 234 行重复。",
      );
      expect(localizeMessage("Mã riêng Hòa Nam 4343SFSDF")).toBe(
        "Mã riêng Hòa Nam 4343SFSDF",
      );
    });
  },
);
