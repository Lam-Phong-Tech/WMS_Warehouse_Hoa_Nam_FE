/**
 * PUBLIC EXPORT SURFACE của design system.
 * Feature modules import từ đây (hoặc các barrel con tokens/theme/components/
 * forms/layout) — KHÔNG import trực tiếp antd/@mui/material
 * (guard: yarn ui:architecture; chính sách: docs/ui/vuexy-sync/13).
 */
export * from "./tokens";
export * from "./theme";
export * from "./icons";
export * from "./components";
export * from "./forms";
export * from "./layout";
export * from "./primitives-mui";
