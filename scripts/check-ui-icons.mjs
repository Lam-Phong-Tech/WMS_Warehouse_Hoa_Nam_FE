/**
 * ui:icons — guard "chỉ MỘT bộ icon: Flaticon Uicons".
 *
 * Fail khi:
 *  1. Có import từ một thư viện icon khác (@ant-design/icons,
 *     @mui/icons-material, react-icons, lucide-react, phosphor, heroicons...)
 *     hoặc import trực tiếp file con của @flaticon (CSS chỉ nạp ở main.tsx).
 *  2. Một slug `fi-rr-<slug>` dùng trong src/ KHÔNG tồn tại trong bộ font đã
 *     cài (@flaticon/flaticon-uicons/css/regular/rounded.css) — gõ sai slug
 *     chỉ hiện ô trống trên UI nên phải bắt ở CI.
 *  3. Một component MUI TỰ VẼ ICON MẶC ĐỊNH được import trong src/ nhưng chưa
 *     có slot icon khai báo ở src/shared/ui/icons/icon-slots.tsx (⇒ màn đó sẽ
 *     lòi ra icon SVG nội bộ của MUI).
 *  4. Một component antd TỰ VẼ ICON MẶC ĐỊNH được dùng mà file đó không truyền
 *     icon Flaticon (antd không có API global nên phải truyền tay ở wrapper).
 *  5. Emoji pictograph được dùng làm icon trong JSX/chuỗi hiển thị.
 *  6. Codepoint Flaticon hardcode trong src/index.css (mũi tên panel
 *     DatePicker) lệch so với package đang cài.
 *
 * --self-test: chạy fixture vi phạm + fixture sạch để chứng minh guard đỏ/xanh
 * đúng chỗ.
 */
import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  fail,
  loadIconFamily,
  read,
  walk,
} from "./ui-guards-lib.mjs";

const FAMILY = loadIconFamily();
const ENTRYPOINT = "src/main.tsx";
const ICON_SLOTS_FILE = "src/shared/ui/icons/icon-slots.tsx";
const CSS_WITH_CODEPOINTS = "src/index.css";
const MUI_ADAPTER_FILE = "src/shared/ui/theme/mui-adapter.ts";
const EXCLUDES = ["__snapshots__"];

/** Thư viện icon thứ hai — cấm tuyệt đối trong src/. */
export const FORBIDDEN_ICON_IMPORTS = [
  "@ant-design/icons",
  "@mui/icons-material",
  "react-icons",
  "lucide-react",
  "@heroicons/react",
  "@phosphor-icons/react",
  "@fortawesome/",
  "bootstrap-icons",
  "@iconify/",
  "feather-icons",
  "@tabler/icons",
];

/**
 * Component MUI có icon mặc định của riêng nó → BẮT BUỘC có slot trong
 * MUI_ICON_SLOTS. Key = tên import từ "@mui/material" (hoặc path con),
 * value = key theme tương ứng.
 */
export const MUI_ICON_BEARING = {
  Select: "MuiSelect",
  NativeSelect: "MuiNativeSelect",
  Autocomplete: "MuiAutocomplete",
  Checkbox: "MuiCheckbox",
  Radio: "MuiRadio",
  Chip: "MuiChip",
  Alert: "MuiAlert",
  Pagination: "MuiPaginationItem",
  PaginationItem: "MuiPaginationItem",
  TablePagination: "MuiTablePagination",
  Tabs: "MuiTabs",
  Rating: "MuiRating",
  Stepper: "MuiStepper",
  StepIcon: "MuiStepIcon",
  StepLabel: "MuiStepLabel",
  SpeedDial: "MuiSpeedDial",
  AccordionSummary: "MuiAccordionSummary",
};

/**
 * Component MUI vẽ KÝ HIỆU bằng <svg> nội bộ và KHÔNG có slot icon để thay
 * → phải dùng bản canonical bằng glyph Flaticon.
 */
export const MUI_SVG_ONLY_REPLACEMENTS = {
  CircularProgress: "UiSpinner (@/shared/ui) — glyph fi-rr-spinner",
};

/**
 * Component antd có icon mặc định (lấy từ @ant-design/icons) → file dùng nó
 * phải truyền prop icon Flaticon tương ứng. `props` liệt kê MỌI prop icon phải
 * xuất hiện trong file đó.
 */
export const ANTD_ICON_BEARING = {
  DatePicker: ["suffixIcon", "allowClear"],
  RangePicker: ["suffixIcon", "separator", "allowClear"],
  Modal: ["closeIcon"],
  Drawer: ["closeIcon"],
  Alert: ["icon"],
  Transfer: ["selectAllLabels"],
  Upload: ["iconRender"],
};

/** Codepoint Flaticon hardcode trong CSS: selector CSS → slug kỳ vọng. */
export const CSS_CODEPOINT_MAP = {
  "ant-picker-prev-icon": "angle-small-left",
  "ant-picker-next-icon": "angle-small-right",
  "ant-picker-super-prev-icon": "angle-double-small-left",
  "ant-picker-super-next-icon": "angle-double-small-right",
};

/**
 * Emoji "đúng nghĩa icon" — cố ý KHÔNG dùng \p{Extended_Pictographic} vì lớp
 * đó ôm cả © § ↔ vốn là ký tự văn bản/mũi tên trong comment, không phải icon.
 */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

/** Dòng comment — emoji ở đó là ghi chú cho dev, không render ra UI. */
function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
}

/* ------------------------------------------------------------------------ */

/** Tập slug hợp lệ, đọc từ CSS của package đang cài. */
export function loadInstalledSlugs(cssText, prefix = FAMILY.prefix) {
  const slugs = new Set();
  for (const m of cssText.matchAll(
    new RegExp(`\\.${prefix}-([a-z0-9-]+):before\\{`, "g"),
  )) {
    slugs.add(m[1]);
  }
  return slugs;
}

/** slug → codepoint (chuỗi hex, vd "f154") từ CSS của package. */
export function loadSlugCodepoints(cssText, prefix = FAMILY.prefix) {
  const map = new Map();
  for (const m of cssText.matchAll(
    new RegExp(
      `\\.${prefix}-([a-z0-9-]+):before\\{content:"\\\\([0-9a-f]+)"\\}`,
      "g",
    ),
  )) {
    map.set(m[1], m[2]);
  }
  return map;
}

export function findSlugsUsed(content, prefix = FAMILY.prefix) {
  const out = [];
  // JSX/CSS: `<prefix>-user`; factory: createFlatIcon("user") / flatIconClass("user")
  for (const m of content.matchAll(new RegExp(`${prefix}-([a-z0-9-]+)`, "g")))
    out.push(m[1]);
  for (const m of content.matchAll(/flatIconClass\(\s*"([a-z0-9-]+)"/g))
    out.push(m[1]);
  for (const m of content.matchAll(/createFlaticonIcon\("([a-z0-9-]+)"\)/g))
    out.push(m[1]);
  for (const m of content.matchAll(/createFlatIcon\(\s*"([a-z0-9-]+)"/g))
    out.push(m[1]);
  return out;
}

export function findForbiddenIconImports(content) {
  const found = [];
  for (const pkg of FORBIDDEN_ICON_IMPORTS) {
    if (content.includes(`"${pkg}`) || content.includes(`'${pkg}`)) {
      found.push(pkg);
    }
  }
  return found;
}

/** Tên component import từ @mui/material (barrel hoặc path con). */
export function findMuiComponentsImported(content) {
  const names = new Set();
  for (const m of content.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@mui\/material"/g,
  )) {
    for (const raw of m[1].split(",")) {
      const name = raw
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim();
      if (/^[A-Z][A-Za-z0-9]*$/.test(name)) names.add(name);
    }
  }
  for (const m of content.matchAll(
    /from\s+"@mui\/material\/([A-Za-z]+)(?:\/[A-Za-z]+)?"/g,
  )) {
    names.add(m[1]);
  }
  return names;
}

/** Tên component import từ antd (kèm RangePicker lấy từ DatePicker). */
export function findAntdComponentsImported(content) {
  const names = new Set();
  for (const m of content.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"antd"/g,
  )) {
    for (const raw of m[1].split(",")) {
      const name = raw
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim();
      if (/^[A-Z][A-Za-z0-9]*$/.test(name)) names.add(name);
    }
  }
  if (/\bRangePicker\b/.test(content) && names.has("DatePicker")) {
    names.add("RangePicker");
  }
  return names;
}

export function findEmojiLines(content) {
  const hits = [];
  content.split("\n").forEach((line, i) => {
    if (isCommentLine(line)) return;
    if (EMOJI.test(line)) hits.push({ line: i + 1, text: line.trim() });
  });
  return hits;
}

/* ------------------------------------------------------------------------ */

export function checkIcons({
  files,
  contents,
  installedSlugs,
  codepoints,
  slotsSource,
  adapterSource = "",
  cssSource,
  entrypointSource = "",
  family = FAMILY,
}) {
  const violations = [];

  for (const file of files) {
    const content = contents(file);

    // 1. Thư viện icon thứ hai
    for (const pkg of findForbiddenIconImports(content)) {
      violations.push(
        `${file}: import thư viện icon thứ hai "${pkg}" — bộ icon duy nhất là Flaticon Uicons (dùng @/shared/ui/icons hoặc @/shared/components/icons)`,
      );
    }

    // 2. Slug không tồn tại trong font đã cài
    for (const slug of new Set(findSlugsUsed(content))) {
      if (!installedSlugs.has(slug)) {
        violations.push(
          `${file}: slug "${FAMILY.prefix}-${slug}" không có trong @flaticon/flaticon-uicons đang cài — icon sẽ render ô trống`,
        );
      }
    }

    // 5. Emoji làm icon
    if (file.endsWith(".tsx") && !file.includes(".test.")) {
      for (const hit of findEmojiLines(content)) {
        violations.push(
          `${file}:${hit.line}: dùng emoji làm icon (${hit.text.slice(0, 60)}) — thay bằng glyph Flaticon`,
        );
      }
    }

    if (file === ICON_SLOTS_FILE || file.startsWith("src/test/")) continue;

    // 3. Component MUI có icon mặc định nhưng chưa khai báo slot
    for (const name of findMuiComponentsImported(content)) {
      const themeKey = MUI_ICON_BEARING[name];
      if (!themeKey) continue;
      if (!slotsSource.includes(`${themeKey}:`)) {
        violations.push(
          `${file}: dùng MUI <${name}> — component này tự vẽ icon SVG nội bộ của MUI. Khai báo "${themeKey}" trong ${ICON_SLOTS_FILE} và nối vào mui-adapter.ts`,
        );
      }
    }

    // 3b. Component MUI vẽ ký hiệu bằng SVG riêng, không thay được bằng slot
    for (const name of findMuiComponentsImported(content)) {
      const replacement = MUI_SVG_ONLY_REPLACEMENTS[name];
      if (!replacement) continue;
      violations.push(
        `${file}: dùng MUI <${name}> — ký hiệu này vẽ bằng <svg> của MUI. Dùng ${replacement}`,
      );
    }

    // 4. Component antd có icon mặc định nhưng file không truyền icon Flaticon
    for (const name of findAntdComponentsImported(content)) {
      const requiredProps = ANTD_ICON_BEARING[name];
      if (!requiredProps) continue;
      for (const prop of requiredProps) {
        if (!content.includes(`${prop}=`)) {
          violations.push(
            `${file}: dùng antd <${name}> mà thiếu prop "${prop}" — antd sẽ vẽ icon @ant-design/icons. Truyền icon từ @/shared/ui/icons`,
          );
        }
      }
    }
  }

  // 7. Slot đã khai báo phải THỰC SỰ được nối vào theme MUI — nếu không, khai
  //    báo chỉ nằm chết trong file và MUI vẫn vẽ icon SVG nội bộ.
  if (adapterSource) {
    for (const m of slotsSource.matchAll(/^ {2}(Mui[A-Za-z]+):/gm)) {
      if (!adapterSource.includes(`MUI_ICON_SLOTS.${m[1]}`)) {
        violations.push(
          `${MUI_ADAPTER_FILE}: slot "${m[1]}" khai báo ở ${ICON_SLOTS_FILE} nhưng chưa nối vào defaultProps — MUI vẫn dùng icon nội bộ`,
        );
      }
    }
  }

  // 6. Codepoint hardcode trong CSS phải khớp package
  for (const [selector, slug] of Object.entries(CSS_CODEPOINT_MAP)) {
    const expected = codepoints.get(slug);
    if (!expected) {
      violations.push(
        `${CSS_WITH_CODEPOINTS}: slug "${slug}" không còn trong package Flaticon`,
      );
      continue;
    }
    const re = new RegExp(
      `\\.${selector}::before\\s*\\{\\s*content:\\s*"\\\\([0-9a-f]+)"`,
    );
    const found = cssSource.match(re);
    if (!found) {
      violations.push(
        `${CSS_WITH_CODEPOINTS}: thiếu rule content cho .${selector}::before (mũi tên panel DatePicker sẽ về border mặc định của antd)`,
      );
    } else if (found[1] !== expected) {
      violations.push(
        `${CSS_WITH_CODEPOINTS}: .${selector}::before dùng codepoint \\${found[1]} nhưng fi-rr-${slug} trong package là \\${expected}`,
      );
    }
  }

  // 8. Ba nơi khai báo họ icon phải KHỚP nhau: icon-family.ts ↔ import CSS ở
  //    main.tsx ↔ font-family dùng khi override CSS. Lệch một chỗ là icon ra
  //    ô trống / mũi tên antd quay về border mặc định, rất khó truy.
  if (entrypointSource && !entrypointSource.includes(`"${family.cssImport}"`)) {
    violations.push(
      `${ENTRYPOINT}: không import "${family.cssImport}" — lệch với ICON_FAMILY (prefix ${family.prefix}); font không nạp thì mọi icon thành ô trống`,
    );
  }
  if (cssSource && !cssSource.includes(`font-family: ${family.fontFamily}`)) {
    violations.push(
      `${CSS_WITH_CODEPOINTS}: mũi tên panel DatePicker không dùng font-family: ${family.fontFamily} — lệch với ICON_FAMILY`,
    );
  }

  return violations;
}

/* ------------------------------------------------------------------------ */

function selfTest() {
  // Fixture CSS/codepoint "đúng" để phần 6 không nhiễu vào 5 case còn lại.
  const CP = {
    "angle-small-left": "f154",
    "angle-small-right": "f155",
    "angle-double-small-left": "f14d",
    "angle-double-small-right": "f14e",
  };
  const installedSlugs = new Set(["user", ...Object.keys(CP)]);
  const codepoints = new Map(Object.entries(CP));
  const family = FAMILY;
  const entrypointSource = `import "${family.cssImport}";`;
  const cssSource =
    `x { font-family: ${family.fontFamily}; }\n` +
    Object.entries(CSS_CODEPOINT_MAP)
      .map(([sel, slug]) => `.${sel}::before { content: "\\${CP[slug]}"; }`)
      .join("\n");
  const dirty = {
    "src/a.tsx": 'import { UserOutlined } from "@ant-design/icons";',
    "src/b.tsx": 'const I = createFlatIcon("khong-ton-tai");',
    "src/c.tsx": 'import { Autocomplete } from "@mui/material";',
    "src/d.tsx": 'import { Modal } from "antd";\n<Modal open />;',
    "src/e.tsx": "const title = <span>Xin chào 👋</span>;",
    "src/f.tsx":
      'import CircularProgress from "@mui/material/CircularProgress";',
  };
  const dirtyViolations = checkIcons({
    files: Object.keys(dirty),
    contents: (f) => dirty[f],
    installedSlugs,
    codepoints,
    slotsSource: "",
    cssSource,
    entrypointSource,
    family,
  });
  const expectedDirty = 6;
  const clean = {
    "src/ok.tsx":
      'import { UserOutlined } from "@/shared/components/icons";\nconst I = createFlatIcon("user");',
  };
  const cleanViolations = checkIcons({
    files: Object.keys(clean),
    contents: (f) => clean[f],
    installedSlugs,
    codepoints,
    slotsSource: "",
    cssSource,
    entrypointSource,
    family,
  });

  const problems = [];
  if (dirtyViolations.length < expectedDirty) {
    problems.push(
      `fixture bẩn chỉ bắt ${dirtyViolations.length}/${expectedDirty} vi phạm:\n      ${dirtyViolations.join("\n      ")}`,
    );
  }
  if (cleanViolations.length !== 0) {
    problems.push(`fixture sạch bị báo đỏ oan: ${cleanViolations.join(" | ")}`);
  }
  if (problems.length > 0) {
    console.error("[ui:icons --self-test] FAIL");
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }
  console.log(
    `[ui:icons --self-test] PASS (bắt ${dirtyViolations.length} vi phạm ở fixture bẩn, 0 ở fixture sạch)`,
  );
  process.exit(0);
}

if (process.argv.includes("--self-test")) selfTest();

const cssText = fs.readFileSync(path.join(REPO_ROOT, FAMILY.cssFile), "utf8");
const files = walk(path.join(REPO_ROOT, "src"), [".ts", ".tsx", ".css"], {
  exclude: EXCLUDES,
});

process.exit(
  fail(
    checkIcons({
      files,
      contents: read,
      installedSlugs: loadInstalledSlugs(cssText),
      codepoints: loadSlugCodepoints(cssText),
      entrypointSource: read(ENTRYPOINT),
      slotsSource: read(ICON_SLOTS_FILE),
      adapterSource: read(MUI_ADAPTER_FILE),
      cssSource: read(CSS_WITH_CODEPOINTS),
    }),
    "ui:icons",
  ),
);
