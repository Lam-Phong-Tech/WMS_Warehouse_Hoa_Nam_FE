import { Spin } from "antd";

export function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(255,255,255,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
      }}
    >
      <Spin size="large" />
      <div style={{ marginTop: 10, color: "#555" }}>Loading...</div>
    </div>
  );
}
