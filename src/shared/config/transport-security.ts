/**
 * WWHN-SEC-04 — luật "ngoài máy cục bộ thì bắt buộc HTTPS", dùng chung cho cả
 * lúc BUILD và lúc CHẠY.
 *
 * VÌ SAO PHẢI TÁCH RA FILE RIÊNG: cùng một luật cần chạy ở hai thời điểm khác
 * nhau. `vite.config.ts` chặn lúc build — artifact sai không bao giờ được sinh
 * ra. `env.ts` chặn lúc SPA khởi động — bắt cả trường hợp build đúng nhưng
 * deploy sai (đổi biến môi trường ở runtime, hoặc dùng lại bundle cũ với cấu
 * hình mới). Chép luật ra hai nơi thì sớm muộn hai bản sẽ trôi khỏi nhau và
 * một trong hai sẽ nói dối.
 *
 * VÌ SAO CHẶN CỨNG CHỨ KHÔNG REDIRECT: redirect http→https chỉ sửa được cú
 * nhấp của người dùng. Nó KHÔNG cứu được request đầu tiên do chính bundle phát
 * ra — request đó mang `Authorization: Bearer` và cookie refresh HttpOnly
 * (`apiWithCredentials` bị ép bật cứng), nên đến lúc redirect trả về thì
 * credential đã đi qua mạng ở dạng rõ rồi.
 *
 * Module này CỐ Ý không import gì: nó phải nạp được cả trong Node (vite config)
 * lẫn trong trình duyệt.
 */

export type TransportEnvName = "local" | "dev" | "uat" | "prod" | "test";

/**
 * Môi trường mà một URL trỏ tới localhost cũng bị coi là sai cấu hình.
 *
 * `dev` KHÔNG nằm ở đây: nhánh dev thường vẫn chạy trên máy lập trình viên.
 * `test` cũng không: bộ test dựng URL giả.
 */
const REMOTE_ONLY_ENVS: ReadonlySet<string> = new Set(["uat", "prod"]);

const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

/**
 * Chuẩn hoá hostname trước khi so sánh.
 *
 * `URL.hostname` trả IPv6 kèm ngoặc vuông (`[::1]`), còn biến môi trường do
 * người viết tay có thể lẫn hoa/thường và khoảng trắng.
 */
function canonicalHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

/**
 * Host này có phải máy cục bộ của lập trình viên không?
 *
 * CỐ Ý KHÔNG coi dải LAN riêng (10.x, 192.168.x, 172.16-31.x) là cục bộ. Một
 * máy chủ trong mạng kho vẫn là máy chủ thật, vẫn có người khác trong cùng mạng
 * nghe được, và NFR-SRS-021 đã đòi "secure HTTPS" cho luồng camera — trình
 * duyệt cũng chỉ cấp `getUserMedia` trong secure context. Nghĩa là một bản
 * triển khai LAN chạy http thì máy quét vốn đã không dùng được camera; nới luật
 * ở đây sẽ che mất lỗi đó thay vì sửa nó.
 */
export function isLocalHostname(hostname: string): boolean {
  const host = canonicalHostname(hostname);
  if (LOOPBACK_HOSTNAMES.has(host)) return true;
  // Tên miền `*.localhost` được RFC 6761 dành riêng cho loopback.
  return host === "localhost" || host.endsWith(".localhost");
}

/** Host này bắt buộc phải nói HTTPS/WSS chưa? */
export function requiresSecureTransport(hostname: string): boolean {
  return !isLocalHostname(hostname);
}

/**
 * Kiểm một URL đã phân giải. Trả về câu lỗi, hoặc `null` nếu đạt.
 *
 * Trả chuỗi thay vì throw để bên gọi tự quyết định: `env.ts` throw (chặn SPA
 * khởi động), `vite.config.ts` throw (chặn build), test thì so khớp chuỗi.
 */
export function transportViolation(
  parsed: { protocol: string; hostname: string },
  key: string,
  envName: TransportEnvName,
): string | null {
  const insecure = parsed.protocol === "http:";
  const host = canonicalHostname(parsed.hostname);

  if (insecure && requiresSecureTransport(host)) {
    return `${key} must use https:// when it points at a real host ("${host}"). Only localhost/127.0.0.1 may use http://.`;
  }

  if (REMOTE_ONLY_ENVS.has(envName)) {
    if (insecure) {
      return `${key} must use https:// when VITE_APP_ENV=${envName}.`;
    }
    if (isLocalHostname(host)) {
      return `${key} points at "${host}" while VITE_APP_ENV=${envName} — a ${envName} build must not point back at the local machine.`;
    }
  }

  return null;
}

/**
 * Scheme WebSocket an toàn tương ứng với host.
 *
 * CỐ Ý nâng cấp im lặng (kèm cảnh báo) thay vì throw: bảng chuông thông báo là
 * tính năng KHÔNG bắt buộc và `env.ts` đã có chủ trương không làm sập cả SPA vì
 * một biến optional. Nhưng để nguyên `ws://` tới host thật thì trình duyệt trên
 * trang https sẽ chặn vì mixed content — tức tính năng cũng hỏng, chỉ khác là
 * hỏng âm thầm và khó lần ra. Nâng lên `wss` giữ đúng ý định cấu hình mà không
 * mở đường downgrade.
 */
export function resolveRealtimeScheme(
  requested: string | undefined,
  host: string,
): "http" | "https" {
  const wanted = requested === "https" ? "https" : "http";
  if (wanted === "http" && requiresSecureTransport(host)) {
    return "https";
  }
  return wanted;
}
