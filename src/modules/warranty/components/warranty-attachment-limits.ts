/**
 * Trần đính kèm cho MỘT hồ sơ bảo hành — dùng chung cho màn tiếp nhận
 * (WarrantyIntakeModal, gom tệp rồi tải sau khi tạo case) và màn chi tiết
 * (WarrantyDetailModal, tải ngay từng tệp). Tách ra file riêng (không phải
 * component) để hai modal cùng một nguồn số 10/2/300 mà không vi phạm
 * react-refresh/only-export-components.
 */

// Annex D SCR-WAR-01 field `images`: jpg/png/webp; <=10 files; <=10MB/file.
export const MAX_WARRANTY_IMAGES = 10;

// WAR-02 video đính kèm: mp4/mov/webm, tách riêng khỏi 10 ảnh; <=2 video;
// <=300MB và <=5 phút/video (BE đo lại thời lượng bằng getID3, đây chỉ là
// kiểm tra sớm phía client để không mất công tải file quá dài).
export const MAX_WARRANTY_VIDEOS = 2;
export const MAX_WARRANTY_VIDEO_DURATION_SECONDS = 300;

/** Đọc thời lượng video (giây) từ metadata ngay trên trình duyệt. */
export function probeVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(videoEl.duration);
    };
    videoEl.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("cannot read video metadata"));
    };
    videoEl.src = url;
  });
}
