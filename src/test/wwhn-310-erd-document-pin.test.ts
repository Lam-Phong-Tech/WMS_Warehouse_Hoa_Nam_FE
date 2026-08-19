import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { findStaleErdDigests } from "./wwhn-310-erd-pin-rot";

/**
 * WWHN-310 / DEV310-P1-02 — pin bản ERD có hiệu lực (phía FE).
 *
 * `HN-WMS-ERD-DD-001` tồn tại hai bản giống hệt nhau ở repo BE và repo FE. Bản
 * FE từng lệch 5 nhóm nội dung — trong đó có quy tắc "PRODUCT Post Issue yêu
 * cầu active RFID" đã bị SRS v1.12 thay thế (RFID optional) — và không cổng nào
 * bắt được vì "review ERD" không chỉ vào một checksum cụ thể.
 *
 * Test này băm bản ERD trong repo FE rồi so với `sha256` trong
 * `docs/contracts/erd-document-pin.json`. Repo BE pin **đúng cùng chuỗi đó** và
 * kiểm bằng `tests/Feature/Wwhn310ErdDocumentPinTest.php`, nên hai bản lệch
 * nhau là đỏ ở cả hai phía.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ERD_PATH = "docs/HoaNam_ERD_Moi_Nhat.md";
const PIN_PATH = "docs/contracts/erd-document-pin.json";

interface ErdDocumentPin {
  document_id: string;
  path: string;
  released_version: string;
  effective_revision: string;
  amendments: string[];
  sha256: string;
  bytes: number;
  table_count: number;
  gates: { backend: string; frontend: string };
  rule: string;
}

const pin = JSON.parse(readFileSync(path.join(repoRoot, PIN_PATH), "utf8")) as ErdDocumentPin;
const erdBytes = readFileSync(path.join(repoRoot, ERD_PATH));
const erdText = erdBytes.toString("utf8");

describe("WWHN-310 — pin bản ERD dùng chung giữa hai repo", () => {
  it("pin trỏ đúng tài liệu ERD nằm trong repo FE", () => {
    expect(pin.document_id).toBe("HN-WMS-ERD-DD-001");
    expect(pin.path).toBe(ERD_PATH);
    expect(pin.table_count).toBe(59);
    expect(pin.gates.frontend).toBe("src/test/wwhn-310-erd-document-pin.test.ts");
    expect(pin.gates.backend).toBe("tests/Feature/Wwhn310ErdDocumentPinTest.php");
  });

  it("checksum thật của ERD trong repo FE trùng checksum đã pin", () => {
    const actual = createHash("sha256").update(erdBytes).digest("hex");
    const actualBytes = statSync(path.join(repoRoot, ERD_PATH)).size;

    expect(
      actual,
      `ERD ở repo FE lệch bản đã pin.\n` +
        `Sửa đúng thứ tự: (1) đồng bộ ERD từ repo BE, (2) nâng hậu tố +AMD<nnn>, ` +
        `(3) cập nhật sha256/bytes/amendments trong ${PIN_PATH} của CẢ HAI repo.\n` +
        `sha256 thật = ${actual}; bytes thật = ${actualBytes}.`,
    ).toBe(pin.sha256);
    expect(actualBytes).toBe(pin.bytes);
  });

  it("sổ đăng ký §0.0 khớp danh sách amendments đã pin", () => {
    const registered = [...erdText.matchAll(/^ {2}(ERD-AMD-\d{3})\b/gm)].map((m) => m[1]);
    const unique = [...new Set(registered)].sort();

    expect(unique).toEqual([...pin.amendments].sort());
    expect(unique.length).toBeGreaterThan(0);
  });

  it("hậu tố bản hiệu lực bằng mã amendment lớn nhất và có mặt trong ERD", () => {
    const codes = [...erdText.matchAll(/^ {2}ERD-AMD-(\d{3})\b/gm)].map((m) => Number(m[1]));
    const highest = Math.max(...codes);
    const expected = `${pin.released_version}+AMD${String(highest).padStart(3, "0")}`;

    expect(pin.effective_revision).toBe(expected);
    expect(erdText).toContain(pin.effective_revision);
  });
});

/**
 * Pin rot: digest của ERD còn được nhắc lại trong nhiều governance register
 * (WWHN-230/233/236/237/242, DEVOPS register, M1/M3 API mapping…). Sửa ERD mà
 * chỉ cập nhật `erd-document-pin.json` sẽ để những register đó nói sai — và chỉ
 * vỡ ở test của ticket khác, rất khó truy.
 */
describe("WWHN-310 — không register nào còn pin checksum ERD cũ", () => {
  it("mọi digest gắn với HoaNam_ERD_Moi_Nhat.md trong docs/ đều bằng checksum đang pin", () => {
    const stale = findStaleErdDigests(repoRoot, pin.sha256);

    expect(
      stale.map((entry) => `${entry.file} -> ${entry.digest}`),
      `Còn register pin checksum ERD cũ (pin rot). Checksum đúng hiện tại: ${pin.sha256}`,
    ).toEqual([]);
  });
});