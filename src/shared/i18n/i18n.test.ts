import { describe, expect, it } from "vitest";
import { MESSAGES_EN, MESSAGES_VI, type MessageKey } from "./messages";
import { translate } from "./useT";
import { NAV_LABELS_EN, navLabel } from "./nav-labels";

/** Thu mọi đường dẫn `a.b.c` trỏ tới chuỗi lá trong một cây message. */
function collectLeafPaths(tree: unknown, prefix = ""): string[] {
  if (typeof tree !== "object" || tree === null) return [];
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : collectLeafPaths(value, path);
  });
}

const VI_PATHS = collectLeafPaths(MESSAGES_VI);
const EN_PATHS = collectLeafPaths(MESSAGES_EN);

describe("catalog chuỗi giao diện", () => {
  it("bản EN không được chứa khoá lạ so với bản VI", () => {
    const viSet = new Set(VI_PATHS);
    expect(EN_PATHS.filter((path) => !viSet.has(path))).toEqual([]);
  });

  it("không khoá VI nào bỏ trống", () => {
    const empty = VI_PATHS.filter(
      (path) => translate("vi", path as MessageKey).trim() === "",
    );
    expect(empty).toEqual([]);
  });

  it("placeholder {…} của bản EN khớp với bản VI", () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    const mismatched = EN_PATHS.filter((path) => {
      const vi = translate("vi", path as MessageKey);
      const en = translate("en", path as MessageKey);
      return (
        JSON.stringify(placeholders(vi)) !== JSON.stringify(placeholders(en))
      );
    });
    expect(mismatched).toEqual([]);
  });
});

describe("translate()", () => {
  it("trả tiếng Việt khi ngôn ngữ là vi", () => {
    expect(translate("vi", "dashboard.title")).toBe("Tổng quan kho");
  });

  it("trả tiếng Anh khi ngôn ngữ là en", () => {
    expect(translate("en", "dashboard.title")).toBe("Warehouse overview");
  });

  it("rơi về tiếng Việt khi khoá thiếu bản EN", () => {
    // `dashboard.period.today` có EN; dựng một khoá thiếu EN bằng cách xoá tạm.
    const branch = MESSAGES_EN.dashboard?.period as
      | Record<string, string>
      | undefined;
    const saved = branch?.today;
    if (branch) delete branch.today;
    try {
      expect(translate("en", "dashboard.period.today")).toBe("Hôm nay");
    } finally {
      if (branch && saved !== undefined) branch.today = saved;
    }
  });

  it("không bao giờ trả ra chính tên khoá", () => {
    for (const path of VI_PATHS) {
      expect(translate("en", path as MessageKey)).not.toBe(path);
    }
  });

  it("chèn biến vào chỗ {…}", () => {
    expect(
      translate("vi", "dashboard.periodCaption", {
        from: "01/09",
        to: "30/09",
      }),
    ).toContain("01/09 → 30/09");
  });

  it("giữ nguyên {…} khi thiếu biến, không in undefined", () => {
    const output = translate("vi", "dashboard.periodCaption", {
      from: "01/09",
    });
    expect(output).toContain("{to}");
    expect(output).not.toContain("undefined");
  });
});

describe("nhãn điều hướng", () => {
  it("giữ nguyên tiếng Việt khi ngôn ngữ là vi", () => {
    expect(navLabel("vi", "Tổng quan kho")).toBe("Tổng quan kho");
  });

  it("dịch sang tiếng Anh khi ngôn ngữ là en", () => {
    expect(navLabel("en", "Tổng quan kho")).toBe("Warehouse overview");
  });

  it("nhãn chưa có bản dịch thì trả lại nguyên văn", () => {
    expect(navLabel("en", "Một mục chưa dịch")).toBe("Một mục chưa dịch");
  });

  it("không nhãn nào dịch thành chuỗi rỗng", () => {
    for (const [vi, en] of Object.entries(NAV_LABELS_EN)) {
      expect(en.trim(), `nhãn "${vi}"`).not.toBe("");
    }
  });
});
