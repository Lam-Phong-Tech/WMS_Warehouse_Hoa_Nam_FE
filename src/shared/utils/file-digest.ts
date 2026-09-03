/**
 * WWHN-331 FE331-P1-07R4 — vân tay NỘI DUNG của một file người dùng chọn.
 *
 * Vì sao không dùng metadata (`name` + `size` + `lastModified`) như bản trước: bộ ba đó
 * KHÔNG định danh nội dung. Ba đường va chạm có thật, không phải giả định lý thuyết:
 *
 * 1. **Hai file khác nhau, cùng metadata.** Người dùng kiểm tra thử `sku.xlsx` ở thư mục
 *    A rồi chọn `sku.xlsx` ở thư mục B (bản tải lại, bản đồng nghiệp gửi). Trùng tên là
 *    chuyện thường; `size` của hai workbook cùng template thường bằng nhau; `lastModified`
 *    trùng khi file được sao chép giữ nguyên mốc thời gian, giải nén từ zip, hoặc đồng bộ
 *    qua ổ mạng. Đủ ba là nút "Import chính thức" mở khoá cho một file CHƯA HỀ được kiểm
 *    tra thử — đúng thứ mà FE331-P1-01R3 vừa đóng, chỉ khác đường vào.
 * 2. **Cùng một file, nội dung đã đổi trên đĩa.** Người dùng dry-run, thấy lỗi, mở Excel
 *    sửa rồi **ghi đè lên chính file đó**, sau đó bấm Import mà không dry-run lại. Nhiều
 *    hệ thống tệp giữ nguyên `size` (sửa vài ô) và mốc `lastModified` mà trình duyệt đã
 *    chụp lại từ lúc chọn file thì không tự cập nhật. Kết quả: kiểm tra thử một nội
 *    dung, commit một nội dung khác.
 * 3. **`lastModified` không đáng tin theo môi trường.** Nó xuống tới miligiây trên
 *    Windows/NTFS nhưng bị làm tròn (2 giây với FAT/exFAT — đúng loại USB mà kho hay
 *    dùng), và một số kênh tải file đặt nó bằng thời điểm tải.
 *
 * Vân tay đúng chỉ có thể lấy từ chính các byte. SHA-256 được chọn thay vì một hàm băm
 * rẻ hơn vì nó còn đối chiếu được TRỰC TIẾP với `file_sha256` mà máy chủ trả về (BE tính
 * bằng `hash_file('sha256', ...)`), nên FE kiểm chứng được rằng thứ máy chủ đã đọc đúng
 * là thứ người dùng đã chọn — chứ không chỉ tin rằng nó đúng.
 */

import { tStatic } from "@/shared/i18n/useT";

/** Hằng số vòng của SHA-256 (FIPS 180-4 §4.2.2). */
const ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/**
 * SHA-256 thuần JavaScript (FIPS 180-4) — đường dự phòng khi `crypto.subtle` không có.
 *
 * Đây KHÔNG phải tối ưu hoá sớm mà là điều kiện triển khai thật: `crypto.subtle` chỉ tồn
 * tại trong secure context. Ứng dụng kho này chạy trong mạng LAN và một máy trạm mở bằng
 * `http://192.168.x.x` (không phải `localhost`) sẽ có `crypto.subtle === undefined`. Nếu
 * chỉ có đường Web Crypto thì đúng những máy đó lại rơi về so metadata — tức là lỗ hổng
 * này vẫn còn nguyên ở chính môi trường phổ biến nhất của dự án.
 */
export function sha256HexSync(input: Uint8Array): string {
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);

  // Đệm theo §5.1.1: 1 bit 1, các bit 0, rồi độ dài tính bằng BIT trên 64 bit big-endian.
  const paddedLength = (((input.length + 9 + 63) / 64) | 0) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;

  const view = new DataView(padded.buffer);
  const bitLength = input.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const schedule = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      schedule[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const prev15 = schedule[i - 15];
      const prev2 = schedule[i - 2];
      const s0 =
        rotateRight(prev15, 7) ^ rotateRight(prev15, 18) ^ (prev15 >>> 3);
      const s1 =
        rotateRight(prev2, 17) ^ rotateRight(prev2, 19) ^ (prev2 >>> 10);
      schedule[i] = (schedule[i - 16] + s0 + schedule[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + choose + ROUND_CONSTANTS[i] + schedule[i]) >>> 0;
      const S0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  for (let i = 0; i < 8; i += 1) digestView.setUint32(i * 4, state[i], false);
  return toHex(digest);
}

/** `crypto.subtle` khi có (nhanh hơn, chạy ngoài luồng chính), nếu không thì đường thuần JS. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      // Sao chép sang một ArrayBuffer riêng: `bytes` có thể là một khung nhìn trên buffer
      // lớn hơn, và digest cả buffer sẽ ra vân tay của dữ liệu KHÁC.
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      const digest = await subtle.digest("SHA-256", copy.buffer);
      return toHex(new Uint8Array(digest));
    } catch {
      // Thuật toán bị vô hiệu hoá theo chính sách/agent: rơi về đường thuần JS thay vì
      // bỏ luôn việc kiểm tra vân tay.
    }
  }
  return sha256HexSync(bytes);
}

/** Đọc toàn bộ byte của một Blob/File. `arrayBuffer()` thiếu ở vài WebView cũ → FileReader. */
async function readAllBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer());
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () =>
      reject(reader.error ?? new Error(tStatic("shared.utils.fileReadError")));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * SHA-256 (hex thường) của NỘI DUNG file — cùng thuật toán và cùng cách trình bày với
 * `file_sha256` của BE, nên hai bên so trực tiếp được với nhau.
 *
 * Ném lỗi khi không đọc được file. Đó là một trạng thái phải nói ra chứ không được nuốt:
 * trình duyệt từ chối đọc chính vì file đã bị đổi/xoá trên đĩa sau khi chọn — đúng kịch
 * bản mà vân tay này sinh ra để bắt.
 */
export async function sha256OfFile(file: Blob): Promise<string> {
  return sha256Hex(await readAllBytes(file));
}
