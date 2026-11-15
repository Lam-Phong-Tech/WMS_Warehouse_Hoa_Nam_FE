import { describe, expect, it } from "vitest";
import { MESSAGES_VI, type MessageKey } from "./messages";
import { MESSAGES_EN } from "./messages.en";
import { MESSAGES_ZH } from "./messages.zh";
import { ensureChineseMessages } from "./chinese-messages";
import { translate } from "./useT";
import { UI_TEXT_ZH } from "./messages.ui-zh";
import { BUSINESS_LABELS_ZH } from "./business-labels.zh";

function flatten(
  tree: object,
  prefix = "",
  result: Record<string, string> = {},
) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[path] = value;
    else if (value && typeof value === "object") flatten(value, path, result);
  }
  return result;
}

const viMessages = flatten(MESSAGES_VI);
const enMessages = flatten(MESSAGES_EN);
const zhMessages = flatten(MESSAGES_ZH);
const placeholderNames = (value: string) =>
  Array.from(value.matchAll(/\{(\w+)\}/g), (match) => match[1]).sort();
const vietnamese =
  /[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư\u1ea0-\u1ef9]/u;
const nativeLanguageLabels = new Set([
  "topbar.languageVietnamese",
  "topbar.languageVi",
  "topbar.languageEnglish",
  "topbar.languageEn",
]);
// These names and symbols are deliberately shared by all locales.
const prose = (value: string) =>
  value
    .replace(/\{\w+\}/g, "")
    .replace(/\b(?:SKU|Excel|PDF|xlsx|pdf|A|Z)\b/g, "");

// Preserve genuine product names, standards, API identifiers and sample codes.
// Check individual Latin tokens even inside Chinese sentences: having one Han
// character must not conceal an untranslated sentence or control label.
const technicalTokens = new Set(
  `
  SKU Excel NFC PII MB JPG PNG PDF Hoa Nam HOA NAM WEBP API GMT OTP PV WMS KPI
  MP4 MOV WEBM xlsx QR XLSX SLA RFID CSV UID HTTPS BOX xls Authenticator WebP px
  SHA-256 URL pdf RPT-01 RPT-01B Lam Phong Tech DCPB16 request_no sku_code required_qty
  recipient_name customer_name request_date recipient_address recipient_contact_phone
  note warranty.pii.view Warranty.pii.view DJZ10A export_job_id label-print-events
  label.print movement_type source_type UTC drill_key report.export YYYY MM reports
  document-history reversal-documents HN KHO KIEM_SOAT_KHO gmail.com 0xxxxxxxxx
  BarcodeDetector Google Microsoft 1Password MFA JWT Cookie http s UUID TRAY PTW-01
  DEC-UI-BASELINE-01 focus-visible Tab RHF request_id 9f2c-fixture ResponsiveDataTable
  Promise useUiConfirm Modal.confirm UiAppShell UiSidebarNav UiTopbar Vuexy
  inventory.view FormField TextField ID HTTP S3 MinIO zh-CN A Z OR AND
  IN-01 IN-02 20V D id X IP A-Z Z-A A-01 A03 SP-0001-20260822-AB12
  SN-SP-0001-8F3C1A2B XK-2026-000123
`
    .trim()
    .split(/\s+/),
);

describe("Simplified Chinese catalog completeness", () => {
  it("has a nonempty Chinese entry for every Vietnamese key without fallback", () => {
    expect(Object.keys(zhMessages).sort()).toEqual(
      Object.keys(viMessages).sort(),
    );
    for (const [key, value] of Object.entries(zhMessages)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("preserves every interpolation variable, including repeated variables", () => {
    for (const [key, value] of Object.entries(viMessages)) {
      expect(placeholderNames(zhMessages[key]), key).toEqual(
        placeholderNames(value),
      );
    }
  });

  it("contains no Vietnamese prose or untranslated English UI copy", () => {
    for (const [key, value] of Object.entries(zhMessages)) {
      if (nativeLanguageLabels.has(key)) continue;
      expect(vietnamese.test(value), key).toBe(false);
      // Variable-only templates, file extensions and SKU are language independent.
      if (!/[\p{Script=Han}]/u.test(value)) {
        expect(/[A-Za-z]/.test(prose(value)), `${key}: ${value}`).toBe(false);
      }
      if (/[A-Za-z]/.test(prose(enMessages[key]))) {
        expect(value, key).not.toBe(enMessages[key]);
      }
    }
  });

  it("rejects English filler inside Chinese catalog and legacy-label sentences", () => {
    const untranslated: string[] = [];
    const entries = [
      ...Object.entries(zhMessages),
      ...Object.entries(UI_TEXT_ZH).map(([key, value]) => [
        `UI_TEXT_ZH.${key}`,
        value,
      ]),
      ...Object.entries(BUSINESS_LABELS_ZH).map(([key, value]) => [
        `BUSINESS_LABELS_ZH.${key}`,
        value,
      ]),
    ];
    for (const [key, value] of entries) {
      if (nativeLanguageLabels.has(key)) continue;
      const literal = value.replace(/\{\w+\}/g, "");
      const tokens =
        literal.match(
          /[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*(?:[_.-][A-Za-z0-9]+)*/g,
        ) ?? [];
      for (const token of tokens) {
        const technicalToken = token.replace(/^\d+(?=MB$|px$)/, "");
        if (!technicalTokens.has(technicalToken))
          untranslated.push(`${key}: ${token}`);
      }
    }
    expect(untranslated).toEqual([]);
  });

  it("resolves every Chinese message and preserves user supplied values", async () => {
    await ensureChineseMessages();
    const customerValue = "Đại lý Nguyễn Văn An / SKU-001 / English data";
    for (const [key, message] of Object.entries(zhMessages)) {
      const variables = Object.fromEntries(
        placeholderNames(message).map((name) => [name, customerValue]),
      );
      const expected = message.replace(
        /\{(\w+)\}/g,
        (_, name: string) => variables[name],
      );
      expect(translate("zh", key as MessageKey, variables), key).toBe(expected);
    }
  });

  it("keeps the report and export copy translated in the actual runtime catalog", () => {
    expect(zhMessages["reportExport.allHint"]).toBe("跨页导出所有匹配结果");
    expect(zhMessages["packingLabelReport.paperTitle"]).toBe("包装标签");
    expect(zhMessages["goodsTraceAudit.historyTitle"]).toBe(
      "追溯历史（{count} 条事件）",
    );
    expect(zhMessages["dashboardAudit.skuIdentityLocked"]).toContain(
      "无法更改编码",
    );
    expect(zhMessages["uiAudit.text_4c99ba2b46"]).toBe("搜索状态...");
  });

  it("uses warehouse meanings for issues, movements and document notes", () => {
    expect(zhMessages["dashboard.kpi.issueComponent"]).toBe("保修配件出库");
    expect(zhMessages["inventory.detail.colMovementCode"]).toBe("库存流水编码");
    expect(zhMessages["outbound.detail.post"]).toBe("出库过账");
    expect(zhMessages["inbound.list.itemLabel"]).toBe("入库单");
    expect(zhMessages["outbound.edit.fieldNote"]).toBe("备注");
    for (const [key, english] of Object.entries(enMessages)) {
      const source = viMessages[key];
      if (/\bissues?\b/i.test(english) && /xuất/i.test(source)) {
        expect(zhMessages[key], key).not.toContain("问题");
      }
      if (
        /\bmovement/i.test(english) &&
        /biến động|giao dịch|sổ kho/i.test(source)
      ) {
        expect(zhMessages[key], key).not.toContain("运动");
      }
      if (/\bnotes?\b/i.test(english) && /phiếu|chứng từ/i.test(source)) {
        expect(zhMessages[key], key).not.toMatch(/注释|便笺|笔记/);
      }
    }
    // Genuine validation problems and interface motion retain their own meanings.
    expect(zhMessages["importResult.issues"]).toContain("问题");
    expect(zhMessages["catalog.buttons.motionNote"]).not.toContain("库存变动");
  });
});
