import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ACTION_KINDS } from "./action-kinds";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";

/**
 * Chốt chặn chống lệch chuẩn nút hành động.
 *
 * Toàn dự án chỉ được dựng nút thao tác bằng `<ActionButton />` /
 * `<ActionIconButton />` (xem README.md cùng thư mục). Test này quét mã nguồn
 * để phát hiện ngay khi có màn tự vẽ nút riêng — vì lỗi kiểu này không làm
 * hỏng build, chỉ làm giao diện lệch dần và rất khó soát bằng mắt.
 */

const SRC = path.resolve(__dirname, "../../..");

/**
 * Điều khiển KHÔNG phải hành động nghiệp vụ (điều hướng / chọn trạng thái) nên
 * được giữ nguyên dạng nút gốc. Thêm mục mới vào đây phải có lý do rõ ràng.
 */
const RAW_BUTTON_ALLOWLIST = new Set([
  // Chuông thông báo — là điểm neo của popover, không mang nhãn hành động.
  "modules/notifications/components/NotificationBell.tsx",
  // Bộ chọn kỳ + sơ đồ luồng: cần giữ trạng thái "đang chọn" (contained/outlined),
  // nút phẳng đồng nhất sẽ xoá mất phản hồi đang-chọn.
  "modules/dashboard/pages/DashboardPage.tsx",
  // Foundation của design system (Part 2 Vuexy sync): UiButton/UiIconButton là
  // TẦNG WRAP engine — nơi duy nhất được chạm MUI Button trực tiếp; screen
  // nghiệp vụ vẫn phải đi qua ActionButton/UiButton, không tự dựng nút.
  "shared/ui/components/UiButton.tsx",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(full, out);
    } else if (
      entry.name.endsWith(".tsx") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

function relative(file: string) {
  return path.relative(SRC, file).replace(/\\/g, "/");
}

/** Bỏ chú thích để ví dụ JSX trong JSDoc không bị chấm là mã thật. */
function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Lấy phần thuộc tính của một thẻ mở JSX, bắt đầu ngay sau tên thẻ.
 * Cần quét thủ công vì `>` có thể nằm trong arrow function (`onClick={() => x}`)
 * hoặc trong chuỗi — regex đơn giản sẽ cắt nhầm giữa chừng.
 */
function openTagAttrs(source: string, from: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return source.slice(from, i);
  }
  return source.slice(from);
}

describe("Chuẩn nút hành động", () => {
  const files = walk(SRC).filter(
    (f) => !relative(f).startsWith("shared/components/actions/"),
  );

  it("không màn nào tự dựng <Button>/<IconButton> cho thao tác nghiệp vụ", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(file);
      if (RAW_BUTTON_ALLOWLIST.has(rel)) continue;
      const source = stripComments(fs.readFileSync(file, "utf8"));
      const matches = source.match(
        /<(Button|MuiButton|IconButton|MuiIconButton)(?=[\s/>])/g,
      );
      if (matches?.length) offenders.push(`${rel} (${matches.length})`);
    }
    expect(offenders).toEqual([]);
  });

  it("không màn nào tự tô màu icon hành động bằng ACTION_ICON_COLORS", () => {
    // Màu của icon HÀNH ĐỘNG phải suy ra từ `kind`, không khai lại tại chỗ gọi.
    // Vài chỗ vẫn được phép dùng bảng màu trực tiếp cho icon TRANG TRÍ (huy hiệu
    // loại tệp, icon vùng kéo-thả) — chúng không phải nút bấm nên không gây lệch.
    const decorativeOnly = new Set([
      "modules/warranty/components/WarrantyDetailModal.tsx",
      "modules/warranty/components/WarrantyIntakeModal.tsx",
      "shared/components/DocumentAttachmentsPanel.tsx",
    ]);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(file);
      if (decorativeOnly.has(rel)) continue;
      const source = fs.readFileSync(file, "utf8");
      if (source.includes("ACTION_ICON_COLORS")) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("mọi kind đều có icon, nhãn tiếng Việt và tông màu hợp lệ", () => {
    for (const [kind, spec] of Object.entries(ACTION_KINDS)) {
      expect(spec.icon, `${kind} thiếu icon`).toBeTypeOf("function");
      expect(spec.label.trim(), `${kind} thiếu nhãn`).not.toBe("");
      expect(
        Object.keys(ACTION_ICON_COLORS),
        `${kind} dùng tông màu không có trong bảng chuẩn`,
      ).toContain(spec.tone);
    }
  });

  it("mọi <ActionButton>/<ActionIconButton> đều khai kind hợp lệ", () => {
    const validKinds = new Set(Object.keys(ACTION_KINDS));
    const offenders: string[] = [];
    for (const file of files) {
      const source = stripComments(fs.readFileSync(file, "utf8"));
      const starts = source.matchAll(
        /<(ActionButton|ActionIconButton)(?=[\s/>])/g,
      );
      for (const start of starts) {
        const attrs = openTagAttrs(source, start.index + start[0].length);
        // `{...props}` chuyển tiếp kind từ component bọc ngoài (ConfirmButton,
        // FormActions) — TypeScript đã bắt buộc kind ở đó rồi.
        if (attrs.includes("{...")) continue;
        // kind động (`kind={cond ? "a" : "b"}`) đã được TypeScript kiểm tra.
        if (/\bkind=\{/.test(attrs)) continue;
        const kind = /\bkind="([^"]+)"/.exec(attrs)?.[1];
        if (!kind || !validKinds.has(kind)) {
          offenders.push(`${relative(file)}: kind=${kind ?? "(thiếu)"}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
