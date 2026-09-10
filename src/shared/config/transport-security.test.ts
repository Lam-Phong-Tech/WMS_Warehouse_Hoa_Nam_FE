import { describe, expect, it } from "vitest";
import {
  isLocalHostname,
  requiresSecureTransport,
  resolveRealtimeScheme,
  transportViolation,
  type TransportEnvName,
} from "@/shared/config/transport-security";

/** Tiện ích: dựng đối tượng giống URL đã phân giải để khỏi lặp `new URL(...)`. */
function url(raw: string) {
  const parsed = new URL(raw);
  return { protocol: parsed.protocol, hostname: parsed.hostname };
}

function violation(
  raw: string,
  envName: TransportEnvName = "prod",
  key = "VITE_API_BASE_URL",
) {
  return transportViolation(url(raw), key, envName);
}

describe("isLocalHostname", () => {
  it("nhận diện các host cục bộ", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("LOCALHOST")).toBe(true);
    expect(isLocalHostname("127.0.0.1")).toBe(true);
    expect(isLocalHostname("0.0.0.0")).toBe(true);
    expect(isLocalHostname("::1")).toBe(true);
    // URL.hostname trả IPv6 kèm ngoặc vuông.
    expect(isLocalHostname("[::1]")).toBe(true);
    expect(isLocalHostname("app.localhost")).toBe(true);
  });

  it("KHÔNG coi dải LAN riêng là cục bộ", () => {
    // Máy chủ trong mạng kho vẫn là máy chủ thật; xem ghi chú trong module.
    expect(isLocalHostname("192.168.1.50")).toBe(false);
    expect(isLocalHostname("10.0.0.5")).toBe(false);
    expect(isLocalHostname("172.16.4.2")).toBe(false);
  });

  it("không bị đánh lừa bởi tên miền chứa chuỗi localhost", () => {
    expect(isLocalHostname("localhost.attacker.com")).toBe(false);
    expect(isLocalHostname("notlocalhost")).toBe(false);
  });

  it("requiresSecureTransport là phủ định của isLocalHostname", () => {
    expect(requiresSecureTransport("localhost")).toBe(false);
    expect(requiresSecureTransport("khohoanamfe.bigk.click")).toBe(true);
  });
});

describe("transportViolation — chặn http tới host thật", () => {
  it("TỪ CHỐI http:// tới domain thật", () => {
    expect(violation("http://khohoanamfe.bigk.click/api/v1")).toMatch(
      /must use https/,
    );
  });

  it("CHẤP NHẬN https:// tới domain thật", () => {
    expect(violation("https://khohoanamfe.bigk.click/api/v1")).toBeNull();
  });

  it("TỪ CHỐI http:// tới IP LAN", () => {
    expect(violation("http://192.168.1.50:8080/api/v1", "uat")).toMatch(
      /must use https/,
    );
  });

  it("CHẤP NHẬN http:// trên localhost khi phát triển cục bộ", () => {
    expect(violation("http://localhost:8080/api/v1", "local")).toBeNull();
    expect(violation("http://127.0.0.1:8080/api/v1", "local")).toBeNull();
    expect(violation("http://localhost:8080/api/v1", "dev")).toBeNull();
    expect(violation("http://localhost:8080/api/v1", "test")).toBeNull();
  });

  it("nêu đích danh biến môi trường sai trong câu lỗi", () => {
    expect(
      violation("http://cdn.example.com", "prod", "VITE_STORAGE_URL"),
    ).toContain("VITE_STORAGE_URL");
  });
});

describe("transportViolation — môi trường uat/prod không được trỏ về máy cục bộ", () => {
  it("TỪ CHỐI localhost dù đã dùng https, khi env là prod", () => {
    expect(violation("https://localhost:8080/api/v1", "prod")).toMatch(
      /must not point back at the local machine/,
    );
  });

  it("TỪ CHỐI localhost khi env là uat", () => {
    expect(violation("https://127.0.0.1/api/v1", "uat")).toMatch(
      /must not point back at the local machine/,
    );
  });

  it("CHO PHÉP localhost khi env là local/dev/test", () => {
    expect(violation("https://localhost:8080/api/v1", "local")).toBeNull();
    expect(violation("https://localhost:8080/api/v1", "dev")).toBeNull();
    expect(violation("https://localhost:8080/api/v1", "test")).toBeNull();
  });
});

describe("resolveRealtimeScheme — không cho phép mixed content", () => {
  it("nâng ws lên wss khi host là thật", () => {
    expect(resolveRealtimeScheme("http", "realtime.bigk.click")).toBe("https");
    expect(resolveRealtimeScheme(undefined, "realtime.bigk.click")).toBe(
      "https",
    );
  });

  it("giữ nguyên http trên localhost", () => {
    expect(resolveRealtimeScheme("http", "localhost")).toBe("http");
    expect(resolveRealtimeScheme(undefined, "127.0.0.1")).toBe("http");
  });

  it("không hạ cấp khi đã yêu cầu https", () => {
    expect(resolveRealtimeScheme("https", "localhost")).toBe("https");
    expect(resolveRealtimeScheme("https", "realtime.bigk.click")).toBe("https");
  });
});
