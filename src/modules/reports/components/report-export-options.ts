import type {
  ReportExportChoice,
  ExportWorkbookOptions,
} from "./report-export-workbook";
export function reportWorkbookOptions(
  choice: ReportExportChoice,
  columns: string[],
  allKeys: string[],
  pageKeys?: string[],
  context?: [string, string][],
): ExportWorkbookOptions {
  return {
    filename: choice.filename,
    sectionIds: choice.sectionIds,
    match: {
      columns,
      values: choice.scope === "page" ? (pageKeys ?? []) : allKeys,
    },
    context,
  };
}
