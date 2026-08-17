import { z } from "zod";

export const inboundLineSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().min(1, "Chọn SKU."),
  import_batch_id: z.string().nullable().optional(),
  qty_planned: z
    .number()
    .int()
    .min(1, "Expected qty phải là số nguyên lớn hơn 0."),
  scanned_qty: z.number().int().min(0),
  note: z.string().nullable().optional(),
});

export const inboundDraftSchema = z
  .object({
    warehouseId: z.string().min(1, "Chọn kho ACTIVE."),
    documentDate: z.string().min(1, "Chọn ngày chứng từ."),
    // Annex A / Annex D SCR-IN-01: `source_reference` max 200 (không phải 255 của
    // cột vật lý source_name trong ERD bảng 26).
    sourceName: z.string().max(200, "Nguồn/tham chiếu tối đa 200 ký tự."),
    note: z.string().max(2000, "Ghi chú tối đa 2000 ký tự."),
    lines: z
      .array(inboundLineSchema)
      .min(1, "Phiếu nhập phải có ít nhất một dòng."),
  })
  .superRefine((values, context) => {
    values.lines.forEach((line, index) => {
      const minimum = Math.max(1, line.scanned_qty);
      if (line.qty_planned < minimum) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "qty_planned"],
          message: `Expected qty không được nhỏ hơn ${minimum}.`,
        });
      }
    });
  });

export type InboundDraftFormValues = z.infer<typeof inboundDraftSchema>;

export function localToday(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function defaultInboundDraftValues(): InboundDraftFormValues {
  return {
    warehouseId: "",
    documentDate: localToday(),
    sourceName: "",
    note: "",
    lines: [
      {
        product_id: "",
        qty_planned: 1,
        scanned_qty: 0,
        note: null,
      },
    ],
  };
}
