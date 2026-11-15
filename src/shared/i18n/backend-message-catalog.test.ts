import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  BACKEND_CATALOG,
  translateBackendCatalogMessage,
} from "./backend-message-catalog";
import { ensureEnglishMessages } from "./english-messages";
import { ensureChineseMessages } from "./chinese-messages";
import { useLanguageStore } from "./language.store";
import { localizeMessage } from "./localize-message";
import manifest from "./backend-source-manifest.json";

const VIETNAMESE =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu;
const DATA = "SKU-HÒA-42 / Nguyễn Văn An";
const entries = new Map(BACKEND_CATALOG.map((entry) => [entry[0], entry]));
function example(source: string): string {
  return source.replace(
    /\{(value\d+)\}/g,
    (_, name: string) => entries.get(source)?.[4]?.[name]?.[0] ?? DATA,
  );
}

beforeAll(async () => {
  await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
});
afterEach(() => useLanguageStore.getState().setLanguage("vi"));

describe("reviewed backend message contract", () => {
  it("preserves every substitution and supplies both target languages", () => {
    for (const [source, en, zh] of BACKEND_CATALOG) {
      expect(en.trim(), source).not.toBe("");
      expect(zh.trim(), source).not.toBe("");
      const placeholders = (text: string) =>
        text.match(/\{value\d+\}/g)?.sort() ?? [];
      expect(placeholders(en), source).toEqual(placeholders(source));
      expect(placeholders(zh), source).toEqual(placeholders(source));
      expect(zh, source).toMatch(/\p{Script=Han}/u);
    }
  });

  it.each(["en", "zh"] as const)(
    "covers all reviewed complete source messages in %s without translating captured data",
    (language) => {
      useLanguageStore.getState().setLanguage(language);
      const failures: string[] = [];
      for (const message of manifest.messages) {
        for (const source of new Set([message.source, ...message.rawSources])) {
          const location =
            message.locations.find((entry) => entry.source === source) ??
            message.locations[0];
          const input = example(source);
          const actual = localizeMessage(input);
          const prose = actual.split(DATA).join("");
          if (
            VIETNAMESE.test(prose) ||
            (language === "zh" && !/\p{Script=Han}/u.test(prose))
          ) {
            failures.push(
              `${location?.path}:${location?.line}: ${source} => ${actual}`,
            );
          }
          if (input.includes(DATA) && !actual.includes(DATA)) {
            failures.push(`Captured data changed: ${source} => ${actual}`);
          }
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    },
  );

  it("records unresolved runtime expressions separately from reviewed message coverage", () => {
    expect(manifest.summary.unresolvedExpressions).toBe(
      manifest.unresolved.length,
    );
    for (const expression of manifest.unresolved) {
      expect(expression.classification).not.toBe("");
      expect(expression.reason).not.toBe("");
    }
  });

  it.each(["en", "zh"] as const)(
    "prefers complete templates and handles empty codes in %s",
    (language) => {
      useLanguageStore.getState().setLanguage(language);
      const translated = localizeMessage(
        "Không tìm thấy MODEL ACTIVE với code . Master data phải được tạo trước qua POST /api/v1/brands hoặc /api/v1/product-categories.",
      );
      expect(translated).toBe(
        language === "en"
          ? "No active model was found with code . Create the master data before importing."
          : "未找到编码为  的已启用型号。请先创建主数据再导入。",
      );
      expect(localizeMessage('Kho "" đang ngừng hoạt động.')).toBe(
        language === "en" ? 'Warehouse "" is inactive.' : "仓库“”已停用。",
      );
    },
  );

  it("translates only finite parameter vocabularies produced by the backend", () => {
    useLanguageStore.getState().setLanguage("en");
    expect(
      localizeMessage(
        'Không thể cập nhật khi yêu cầu đang ở trạng thái "Nháp".',
      ),
    ).toBe('Cannot update while the request has status "Draft".');
    expect(localizeMessage('Kho "Đang kiểm tra" đang ngừng hoạt động.')).toBe(
      'Warehouse "Đang kiểm tra" is inactive.',
    );
    expect(
      localizeMessage("Chưa đủ thông tin bàn giao: người nhận, ngày bàn giao."),
    ).toBe("Handover information is incomplete: recipient, handover date.");
  });

  it("does not swallow unknown English prose with an unrestricted template", () => {
    expect(
      translateBackendCatalogMessage("Nguyễn Văn An is not SKU-HÒA-42.", "zh"),
    ).toBeUndefined();
    expect(
      translateBackendCatalogMessage("Nguyễn Văn An is required.", "zh"),
    ).toBeUndefined();
  });

  it("reverses retained known EN/ZH messages while preserving codes and names", () => {
    const source = `Kho "${DATA}" đang ngừng hoạt động.`;
    useLanguageStore.getState().setLanguage("en");
    const retainedEnglish = localizeMessage(source);
    useLanguageStore.getState().setLanguage("zh");
    const retainedChinese = localizeMessage(retainedEnglish);
    expect(retainedChinese).toBe(`仓库“${DATA}”已停用。`);
    useLanguageStore.getState().setLanguage("en");
    expect(localizeMessage(retainedChinese)).toBe(retainedEnglish);
    useLanguageStore.getState().setLanguage("zh");
    expect(
      localizeMessage('Cannot update while the request has status "Draft".'),
    ).toBe("申请处于“草稿”状态时，无法执行操作：更新。");
    expect(
      localizeMessage("The barcode/QR code does not exist or is inactive."),
    ).toBe("条形码/二维码不存在或未启用。");
  });

  it.each(["en", "zh"] as const)(
    "handles Laravel attribute substitution without translating unknown names in %s",
    (language) => {
      useLanguageStore.getState().setLanguage(language);
      expect(
        localizeMessage(
          `Trường ${DATA} chứa ký tự không hợp lệ (không phải UTF-8).`,
        ),
      ).toBe(
        language === "en"
          ? `Field ${DATA} contains invalid characters (not UTF-8).`
          : `字段 ${DATA} 包含无效字符（非 UTF-8）。`,
      );
      const known = localizeMessage(
        "Trường mật khẩu hiện tại chứa ký tự không hợp lệ (không phải UTF-8).",
      );
      expect(known).not.toMatch(VIETNAMESE);
    },
  );

  it("translates known nested errors and terminates for unknown nested data", () => {
    useLanguageStore.getState().setLanguage("zh");
    expect(
      localizeMessage("Không đọc được file Excel: Không tìm thấy mã vật lý."),
    ).toBe("无法读取 Excel 文件：未找到实物编码。");
    const recursive = "Không đọc được file Excel: ".repeat(8) + DATA;
    expect(localizeMessage(recursive)).toContain(DATA);
    expect(localizeMessage(`Không đọc được file Excel: ${DATA}`)).toBe(
      `无法读取 Excel 文件：${DATA}`,
    );
  });
});
