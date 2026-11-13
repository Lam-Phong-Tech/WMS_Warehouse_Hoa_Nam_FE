import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/app/layouts/nav-data";
import { getAuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";
import { bilingual, enumLabelOrText } from "@/shared/constants/business-labels";
import { BUSINESS_LABELS_ZH } from "./business-labels.zh";
import { ensureChineseMessages } from "./chinese-messages";
import { useLanguageStore } from "./language.store";
import { localizedEnglish } from "./localized-english";
import { UI_TEXT_ZH } from "./messages.ui-zh";
import {
  NAV_LABELS_EN,
  NAV_FALLBACK_TITLES_EN,
  SCREEN_META_EN,
  ROUTE_META_EN_BY_TITLE,
  navLabel,
  localizeScreenMeta,
} from "./nav-labels";
import {
  NAV_LABELS_ZH,
  NAV_FALLBACK_TITLES_ZH,
  SCREEN_META_ZH,
  ROUTE_META_ZH_BY_TITLE,
} from "./nav-labels.zh";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.tsx?$/.test(path) && !/\.(test|spec)\./.test(path)
        ? [path]
        : [];
  });
}

describe("Simplified Chinese business and legacy label coverage", () => {
  afterEach(() => useLanguageStore.getState().setLanguage("vi"));

  it("covers every literal English label used by bilingual business maps and legacy text helpers", () => {
    const missing: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      const source = readFileSync(file, "utf8");
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
      );
      const check = (label: string, legacy: boolean) => {
        if (
          !Object.hasOwn(BUSINESS_LABELS_ZH, label) &&
          !(legacy && Object.hasOwn(UI_TEXT_ZH, label))
        ) {
          missing.push(`${file}: ${label}`);
        }
      };
      const visit = (node: ts.Node) => {
        if (
          file.endsWith("auth-uat-copy.ts") &&
          ts.isVariableDeclaration(node) &&
          node.name.getText(ast) === "en" &&
          node.initializer &&
          ts.isObjectLiteralExpression(node.initializer)
        ) {
          for (const property of node.initializer.properties) {
            if (
              ts.isPropertyAssignment(property) &&
              ts.isStringLiteralLike(property.initializer)
            ) {
              check(property.initializer.text, true);
            }
          }
        }
        if (ts.isCallExpression(node)) {
          const name = node.expression.getText(ast);
          if (file.endsWith("action-kinds.tsx") && name === "spec") {
            const label = node.arguments[3];
            if (label && ts.isStringLiteralLike(label)) check(label.text, true);
          }
          const english = node.arguments[1];
          if (
            name === "bilingual" &&
            english &&
            ts.isObjectLiteralExpression(english)
          ) {
            for (const property of english.properties) {
              if (
                ts.isPropertyAssignment(property) &&
                ts.isStringLiteralLike(property.initializer)
              ) {
                check(property.initializer.text, false);
              }
            }
          }
          if (
            source.includes("localizedEnglish") &&
            (name === "text" || name === "localizedEnglish")
          ) {
            const label = node.arguments[name === "text" ? 1 : 0];
            if (label && ts.isStringLiteralLike(label)) check(label.text, true);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(missing).toEqual([]);
  });

  it("uses warehouse meanings for issue, posting and warranty intake", async () => {
    await ensureChineseMessages();
    useLanguageStore.getState().setLanguage("zh");
    const labels = bilingual(
      {
        issue: "Xuất",
        post: "Ghi nhận",
        intake: "Tiếp nhận",
        closed: "Đã đóng",
        waiting: "Chờ nhận",
        receiving: "Đang nhận",
      },
      {
        issue: "Issue",
        post: "Post",
        intake: "Intake",
        closed: "Closed",
        waiting: "Awaiting receipt",
        receiving: "Receiving",
      },
    );
    expect(Object.values(labels)).toEqual([
      "出库",
      "过账",
      "接收登记",
      "已关闭",
      "待收货",
      "收货中",
    ]);
    expect(localizedEnglish("Refreshing…")).toBe("正在刷新…");
    expect(localizedEnglish("Clear filters")).toBe("清除筛选条件");
    for (const [key, value] of Object.entries(getAuthUatCopy())) {
      expect(value, key).toMatch(/\p{Script=Han}/u);
    }
    expect(enumLabelOrText(labels, "Đại lý Nguyễn / SKU-001")).toBe(
      "Đại lý Nguyễn / SKU-001",
    );
  });
});

describe("Simplified Chinese navigation coverage", () => {
  it("covers every English navigation and metadata key", () => {
    for (const key of Object.keys(NAV_LABELS_EN))
      expect(NAV_LABELS_ZH, key).toHaveProperty(key);
    for (const key of Object.keys(NAV_FALLBACK_TITLES_EN))
      expect(NAV_FALLBACK_TITLES_ZH, key).toHaveProperty(key);
    for (const key of Object.keys(SCREEN_META_EN))
      expect(SCREEN_META_ZH, key).toHaveProperty(key);
    for (const key of Object.keys(ROUTE_META_EN_BY_TITLE))
      expect(ROUTE_META_ZH_BY_TITLE, key).toHaveProperty(key);
  });

  it("localizes all routed menu labels and standalone breadcrumb titles", () => {
    for (const group of NAV_GROUPS) {
      expect(navLabel("zh", group.icon, group.name)).toMatch(/\p{Script=Han}/u);
      for (const item of group.items) {
        expect(navLabel("zh", item.screen, item.label), item.path).toMatch(
          /\p{Script=Han}/u,
        );
      }
    }
    for (const title of Object.keys(ROUTE_META_ZH_BY_TITLE)) {
      expect(navLabel("zh", undefined, title), title).toMatch(
        /\p{Script=Han}/u,
      );
      expect(
        localizeScreenMeta("zh", { title, description: "" }).title,
        title,
      ).toMatch(/\p{Script=Han}/u);
    }
    expect(
      localizeScreenMeta("zh", SCREEN_META_EN["RPT-07"], "RPT-07").title,
    ).toBe("按收货方/代理商统计出库");
  });
});
