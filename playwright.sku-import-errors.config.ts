import { defineConfig } from "@playwright/test";
import base from "./playwright.ui-contrast.config";

export default defineConfig({
  ...base,
  testMatch: "sku-import-errors.spec.ts",
  outputDir: "test-results/sku-import-errors/browser",
});
