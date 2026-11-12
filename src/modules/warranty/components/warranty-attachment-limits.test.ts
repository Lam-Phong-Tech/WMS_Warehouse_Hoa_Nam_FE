import { describe, expect, it } from "vitest";
import { MAX_WARRANTY_VIDEOS } from "./warranty-attachment-limits";

describe("giới hạn tệp đính kèm bảo hành", () => {
  it("chốt 1 video ACTIVE mỗi hồ sơ theo hợp đồng BE", () => {
    // BE CurrentBaselineWarrantyAttachmentController::MAX_ACTIVE_VIDEOS = 1.
    // FE phải cùng con số, nếu không video thứ hai sẽ bị BE trả 422.
    expect(MAX_WARRANTY_VIDEOS).toBe(1);
  });
});
