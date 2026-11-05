import { tStatic } from "@/shared/i18n/useT";
import type { ExportSection } from "./ReportExportAction";
export function reportExportSections(
  detailLabel?: string,
  extra: "sku" | "components" | "none" = "sku",
): ExportSection[] {
  const t = tStatic;
  return [
    {
      id: "summary",
      label: t("reportExport.summary"),
      description: t("reportExport.summaryHint"),
      selected: true,
    },
    {
      id: "detail",
      label: detailLabel ?? t("reportExport.detail"),
      description: t("reportExport.detailHint"),
      selected: true,
    },
    ...(extra === "none"
      ? []
      : extra === "components"
        ? [
            {
              id: "components",
              label: t("reportExport.components"),
              description: t("reportExport.componentsHint"),
              selected: true,
            },
          ]
        : [
            {
              id: "sku",
              label: t("reportExport.sku"),
              description: t("reportExport.skuHint"),
              selected: true,
            },
            {
              id: "codes",
              label: t("reportExport.codes"),
              description: t("reportExport.codesHint"),
              selected: false,
            },
          ]),
  ];
}
