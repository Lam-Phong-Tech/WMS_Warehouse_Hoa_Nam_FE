import { expect, it } from "vitest";
import { warrantyReportIdentifiers } from "./report-warranty-search";

it("keeps serial and every active physical identifier without choosing one tag", () => {
  expect(
    warrantyReportIdentifiers(
      {
        serial_number: "SN-42",
        temporary_item_code: "TEMP-42",
        physical_codes: ["QR-42", "RFID-42"],
      },
      { serial_number: "SN-42" },
    ),
  ).toEqual(["SN-42", "TEMP-42", "QR-42", "RFID-42"]);
});
