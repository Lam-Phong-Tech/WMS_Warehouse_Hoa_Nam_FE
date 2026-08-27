/**
 * PUBLIC EXPORT SURFACE của design system.
 * Feature modules import từ đây (hoặc các barrel con tokens/theme/components) —
 * KHÔNG import trực tiếp antd/@mui/material (guard: yarn ui:architecture).
 */
export * from "./tokens";
export * from "./theme";
export * from "./components";
