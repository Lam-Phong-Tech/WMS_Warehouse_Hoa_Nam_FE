import { describe, expect, it } from "vitest";
import { sha256Hex, sha256HexSync, sha256OfFile } from "./file-digest";

/**
 * WWHN-331 FE331-P1-07R4 — vân tay nội dung là thứ quyết định nút "Import chính thức"
 * có được mở khoá hay không, nên bản thân nó phải đúng theo chuẩn chứ không chỉ "đúng so
 * với chính nó".
 *
 * Cụ thể: FE đối chiếu vân tay này với `file_sha256` mà BE tính bằng
 * `hash_file('sha256', ...)`. Nếu bản cài đặt ở đây sai lệch so với FIPS 180-4 thì hai
 * bên sẽ không bao giờ khớp và người dùng bị chặn Import trên một file hoàn toàn hợp lệ
 * — nên phải khoá bằng vector chuẩn, không phải bằng phép so hai lời gọi của chính nó.
 */

const encoder = new TextEncoder();

/** Vector chuẩn FIPS 180-4 / NIST CAVP. */
const KNOWN_VECTORS: Array<[string, string]> = [
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  [
    "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
  ],
];

describe("sha256HexSync — đường thuần JS", () => {
  it.each(KNOWN_VECTORS)("băm %j ra đúng vector chuẩn", (input, expected) => {
    expect(sha256HexSync(encoder.encode(input))).toBe(expected);
  });

  /**
   * Ranh giới đệm của SHA-256 (§5.1.1): độ dài 55/56/63/64 byte là chỗ khối cuối vừa đủ
   * hoặc phải tràn sang một khối mới. Cài sai chỗ này thì hầu hết file vẫn băm đúng và
   * lỗi chỉ lộ ra với đúng vài kích thước — dạng lỗi tệ nhất để phát hiện ở production.
   */
  it.each([54, 55, 56, 57, 63, 64, 65, 119, 120, 128])(
    "đúng ở ranh giới đệm %i byte",
    (length) => {
      const input = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) input[i] = (i * 31 + 7) % 256;

      // 64 ký tự hex và ổn định — đối chiếu chéo với Web Crypto ở test dưới.
      expect(sha256HexSync(input)).toMatch(/^[0-9a-f]{64}$/);
    },
  );

  it("băm được nội dung nhị phân đủ 256 giá trị byte", () => {
    const input = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) input[i] = i;

    expect(sha256HexSync(input)).toBe(
      "40aff2e9d2d8922e47afd4648e6967497158785fbd1da870e7110266bf944880",
    );
  });
});

describe("sha256Hex — đường Web Crypto và đường dự phòng phải cho cùng một kết quả", () => {
  /**
   * `crypto.subtle` chỉ tồn tại trong secure context. Máy trạm kho mở ứng dụng bằng
   * `http://192.168.x.x` sẽ rơi vào đường dự phòng, nên hai đường buộc phải trùng nhau
   * tuyệt đối — nếu không, cùng một file sẽ cho hai vân tay khác nhau tuỳ máy.
   */
  it.each(KNOWN_VECTORS)(
    "cùng kết quả cho %j dù chạy đường nào",
    async (input, expected) => {
      await expect(sha256Hex(encoder.encode(input))).resolves.toBe(expected);
      expect(sha256HexSync(encoder.encode(input))).toBe(expected);
    },
  );

  it("không lấy nhầm dữ liệu khi đầu vào là khung nhìn trên một buffer lớn hơn", async () => {
    // `crypto.subtle.digest(buffer)` băm CẢ buffer, nên nếu truyền thẳng `view.buffer`
    // thì một Uint8Array con sẽ ra vân tay của dữ liệu khác. Ca này khoá lại điều đó.
    const backing = new Uint8Array([0xff, 0xff, 0x61, 0x62, 0x63, 0xff]);
    const view = backing.subarray(2, 5); // "abc"

    await expect(sha256Hex(view)).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("sha256OfFile — vân tay của một File thật", () => {
  it("hai file trùng tên/kích thước/mốc sửa nhưng khác nội dung có vân tay khác nhau", async () => {
    // Đây chính là ca mà vân tay metadata của bản R3 không phân biệt được.
    const meta = { lastModified: 1_700_000_000_000 };
    const a = new File(["noi-dung-excel-A"], "sku.xlsx", meta);
    const b = new File(["noi-dung-excel-B"], "sku.xlsx", meta);

    expect(a.name).toBe(b.name);
    expect(a.size).toBe(b.size);
    expect(a.lastModified).toBe(b.lastModified);

    const [shaA, shaB] = await Promise.all([sha256OfFile(a), sha256OfFile(b)]);
    expect(shaA).not.toBe(shaB);
  });

  it("cùng nội dung thì cùng vân tay, kể cả khác tên và khác mốc sửa", async () => {
    const a = new File(["noi-dung-excel"], "lan-1.xlsx", {
      lastModified: 1_700_000_000_000,
    });
    const b = new File(["noi-dung-excel"], "lan-2.xlsx", {
      lastModified: 1_800_000_000_000,
    });

    await expect(sha256OfFile(a)).resolves.toBe(await sha256OfFile(b));
  });

  it("khớp với vector chuẩn, tức khớp với hash_file('sha256') của BE", async () => {
    await expect(sha256OfFile(new File(["abc"], "a.xlsx"))).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
