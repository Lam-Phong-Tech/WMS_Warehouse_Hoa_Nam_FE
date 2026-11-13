import { text, type Raw } from "./report-format";

/** Search all authorized identifiers; do not choose one physical tag to display. */
export function warrantyReportIdentifiers(
  row: Raw,
  detail: Raw = {},
): string[] {
  return [
    ...new Set(
      [
        row.serial_number,
        detail.serial_number,
        row.temporary_item_code,
        detail.temporary_item_code,
        detail.physical_code,
        ...(Array.isArray(row.physical_codes) ? row.physical_codes : []),
      ]
        .map((value) => text(value, ""))
        .filter(Boolean),
    ),
  ];
}
