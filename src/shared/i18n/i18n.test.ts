import { describe, expect, it } from "vitest";
import { MESSAGES_EN, MESSAGES_VI, type MessageKey } from "./messages";
import { translate } from "./useT";
import { NAV_GROUPS, SCREEN_META } from "@/app/layouts/nav-data";
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
    // `dashboard.periodName.today` có EN; dựng một khoá thiếu EN bằng cách xoá tạm.
    const branch = MESSAGES_EN.dashboard?.periodName as
      | Record<string, string>
      | undefined;
    const saved = branch?.today;
    if (branch) delete branch.today;
    try {
      expect(translate("en", "dashboard.periodName.today")).toBe("Hôm nay");
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
    expect(navLabel("vi", "MAP-01", "Tổng quan kho")).toBe("Tổng quan kho");
  });

  it("dịch sang tiếng Anh khi ngôn ngữ là en", () => {
    expect(navLabel("en", "MAP-01", "Tổng quan kho")).toBe("Warehouse overview");
  });

  /**
   * Bảng tra theo KHOÁ ỔN ĐỊNH (screen-id / tên icon nhóm) chứ không theo chuỗi
   * tiếng Việt, nên sửa nhãn trong `nav-data.ts` không làm rơi bản dịch.
   */
  it("khoá chưa có bản dịch thì trả lại nhãn gốc", () => {
    expect(navLabel("en", "XXX-99", "Một mục chưa dịch")).toBe(
      "Một mục chưa dịch",
    );
  });

  it("mục không mang khoá thì trả lại nhãn gốc", () => {
    expect(navLabel("en", undefined, "Nhãn tự do")).toBe("Nhãn tự do");
  });

  it("không nhãn nào dịch thành chuỗi rỗng", () => {
    for (const [key, en] of Object.entries(NAV_LABELS_EN)) {
      expect(en.trim(), `khoá "${key}"`).not.toBe("");
    }
  });

  /**
   * Guard thật của lớp này, hai chiều:
   *
   * - Mọi mục đang HIỆN trên cây menu phải có bản EN. Thiếu một khoá là menu
   *   hiện nửa Việt nửa Anh — lỗi im lặng, chỉ test này bắt được.
   * - Mọi khoá EN phải trỏ tới một screen/nhóm CÓ THẬT. Cho phép khoá của
   *   screen đang tạm ẩn khỏi sidebar (vẫn khai trong `SCREEN_META`) để lúc bật
   *   lại không ship mục chưa dịch; nhưng khoá gõ sai thì không lọt.
   */
  it("phủ đúng bộ khoá mà cây menu đang dùng", () => {
    const inTree = new Set<string>(["home"]);
    for (const group of NAV_GROUPS) {
      inTree.add(group.icon);
      for (const item of group.items) inTree.add(item.screen);
    }
    expect([...inTree].filter((key) => !(key in NAV_LABELS_EN))).toEqual([]);

    const known = new Set([...inTree, ...Object.keys(SCREEN_META)]);
    expect(Object.keys(NAV_LABELS_EN).filter((key) => !known.has(key))).toEqual(
      [],
    );
  });
});
