/**
 * ui:dependencies — guard dependency UI trùng lặp / chết (Part 5 Vuexy sync).
 *
 * Fail khi:
 *  1. package.json chứa một UI stack/icon/style engine THỨ HAI ngoài bộ đã
 *     chốt (DEC-UI-BASELINE-01: MUI + Emotion là engine; antd chỉ còn là
 *     adapter remnant; icon duy nhất Flaticon Uicons). Thêm bootstrap/chakra/
 *     tailwind/styled-components/@ant-design/icons/@mui/icons-material... sẽ đỏ.
 *  2. Một RUNTIME dependency không còn bất kỳ import nào trong src/ (dep chết
 *     kiểu lodash-es/puppeteer đã bị gỡ ở Part 5 — không cho quay lại).
 *
 * --self-test: chạy 2 fixture vi phạm (duplicate stack + dead dep) và một
 * fixture sạch, chứng minh guard đỏ/xanh đúng chỗ.
 */
import path from "node:path";
import { REPO_ROOT, fail, loadJson, read, walk } from "./ui-guards-lib.mjs";

/**
 * Các package coi là "UI stack/engine/icon thứ hai" — cấm xuất hiện ở CẢ
 * dependencies lẫn devDependencies. Mỗi mục có lý do để thông báo lỗi tự nói.
 */
const FORBIDDEN_UI_PACKAGES = {
  "@ant-design/icons":
    "icon đã hợp nhất về Flaticon Uicons (shim @/shared/components/icons)",
  "@mui/icons-material": "icon đã hợp nhất về Flaticon Uicons",
  "styled-components":
    "style engine thứ hai — engine chốt là Emotion (qua MUI)",
  "@emotion/css": "dùng @emotion/react/styled qua MUI, không dùng bản css rời",
  bootstrap: "UI stack thứ hai ngoài MUI",
  "react-bootstrap": "UI stack thứ hai ngoài MUI",
  "@chakra-ui/react": "UI stack thứ hai ngoài MUI",
  "@mantine/core": "UI stack thứ hai ngoài MUI",
  "semantic-ui-react": "UI stack thứ hai ngoài MUI",
  tailwindcss: "hệ styling thứ hai — token/sx là nguồn style duy nhất",
  "antd-mobile": "UI stack thứ hai ngoài MUI",
};

/**
 * Runtime dep được phép KHÔNG có import trực tiếp trong src/ (dùng gián tiếp
 * có chủ đích) — thêm mục mới phải kèm lý do.
 */
const INDIRECT_RUNTIME_DEPS = {
  "@emotion/styled":
    "styled-engine peer của @mui/material (DEC-UI-BASELINE-01); ESLint cấm import trực tiếp @emotion/* trong src nên chỉ dùng gián tiếp qua MUI",
};

function collectSrcImportBlob() {
  const files = walk(path.join(REPO_ROOT, "src"), [".ts", ".tsx", ".css"], {
    exclude: ["__snapshots__"],
  });
  let blob = "";
  for (const file of files) blob += read(file);
  blob += read("index.html");
  return blob;
}

export function checkDependencies(pkg, srcBlob) {
  const violations = [];
  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  for (const [name, reason] of Object.entries(FORBIDDEN_UI_PACKAGES)) {
    if (allDeps[name]) {
      violations.push(
        `package.json: "${name}" là dependency UI trùng lặp bị cấm — ${reason}`,
      );
    }
  }

  for (const name of Object.keys(pkg.dependencies ?? {})) {
    if (INDIRECT_RUNTIME_DEPS[name]) continue;
    // Import khớp: from "pkg", from "pkg/sub", import "pkg...", require("pkg...
    const used =
      srcBlob.includes(`from "${name}"`) ||
      srcBlob.includes(`from "${name}/`) ||
      srcBlob.includes(`import "${name}"`) ||
      srcBlob.includes(`import "${name}/`) ||
      srcBlob.includes(`require("${name}"`) ||
      srcBlob.includes(`require("${name}/`);
    if (!used) {
      violations.push(
        `package.json: runtime dependency "${name}" không có import nào trong src/ — dep chết, gỡ đi hoặc khai INDIRECT_RUNTIME_DEPS kèm lý do`,
      );
    }
  }

  return violations;
}

const args = process.argv.slice(2);

if (args.includes("--self-test")) {
  const cleanPkg = {
    dependencies: { react: "1", sonner: "1" },
    devDependencies: { vitest: "1" },
  };
  const cleanBlob =
    'import { x } from "react";\nimport { toast } from "sonner";';

  const dupPkg = {
    dependencies: { ...cleanPkg.dependencies, "react-bootstrap": "1" },
    devDependencies: cleanPkg.devDependencies,
  };
  const deadPkg = {
    dependencies: { ...cleanPkg.dependencies, "left-pad": "1" },
    devDependencies: cleanPkg.devDependencies,
  };

  const cases = [
    [
      "fixture sạch phải XANH",
      checkDependencies(cleanPkg, cleanBlob).length === 0,
    ],
    [
      "fixture duplicate UI stack (react-bootstrap) phải ĐỎ",
      checkDependencies(dupPkg, cleanBlob).some((v) =>
        v.includes("react-bootstrap"),
      ),
    ],
    [
      "fixture dep chết (left-pad không import) phải ĐỎ",
      checkDependencies(deadPkg, cleanBlob).some((v) => v.includes("left-pad")),
    ],
  ];

  let ok = true;
  for (const [name, passed] of cases) {
    console.log(`${passed ? "✔" : "✘"} self-test: ${name}`);
    if (!passed) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

const pkg = loadJson("package.json");
process.exit(
  fail(checkDependencies(pkg, collectSrcImportBlob()), "ui:dependencies"),
);
