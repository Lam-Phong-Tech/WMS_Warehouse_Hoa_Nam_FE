/**
 * MST-PV-01 — TẢI ẢNH SẢN PHẨM APP PV LÊN KHO LƯU TRỮ CỦA HỆ THỐNG.
 *
 * Cùng lối với tệp đính kèm bảo hành: client POST multipart lên API của mình, BE
 * kiểm nội dung thật (magic bytes + quét mã độc) rồi ghi vào object storage —
 * MinIO ở stack dev, Cloudflare R2 ở bản deploy (xem BE `config/pv.php`).
 *
 * Vì sao KHÔNG đi thẳng lên dịch vụ ảnh bên thứ ba: ảnh sản phẩm là tài sản của
 * Hoa Nam, phải nằm cùng chỗ với mọi media khác để sao lưu/xoá theo cùng một quy
 * trình, và luồng upload phải chịu đúng lớp xác thực + phân quyền của hệ thống.
 * Bản trước đây upload thẳng lên Cloudinary bằng unsigned preset đã bỏ.
 *
 * DB chỉ lưu URL trả về (`pv_product_images.image_url`), giống hệt trước — nên
 * đổi kho lưu trữ không đụng gì tới hợp đồng của hồ sơ sản phẩm.
 */
import { http } from "@/shared/api/http";
import { tStatic } from "@/shared/i18n";
import { PV_API_ENDPOINTS } from "@/modules/pv/services/pv-endpoints";
import { FILE_RULES, type FileRule } from "@/shared/validation/file-rules";

/** Ảnh sản phẩm App PV: cùng bộ đuôi/dung lượng với ảnh hồ sơ bảo hành. */
export const PV_IMAGE_RULE: FileRule = FILE_RULES.warrantyImage;

export interface PvImageUploadResult {
  /** URL công khai — giá trị duy nhất được lưu vào hồ sơ sản phẩm. */
  url: string;
  /** Key trong bucket, giữ lại để đối soát khi cần dọn ảnh mồ côi. */
  storageKey: string;
  bytes: number | null;
  mimeType: string | null;
}

interface RawUploadResponse {
  url?: unknown;
  storage_key?: unknown;
  bytes?: unknown;
  mime_type?: unknown;
}

/**
 * Upload MỘT ảnh.
 *
 * `signal` để huỷ khi người dùng đóng hộp thoại giữa chừng: không huỷ thì
 * `setState` chạy trên component đã unmount và tệp vẫn lặng lẽ bay lên bucket.
 *
 * Ném nguyên lỗi của `http` — nơi gọi dùng `getMutationErrorMessage` để lấy đúng
 * câu tiếng Việt BE trả về (sai định dạng, quá nặng, dính mã độc, bucket lỗi).
 */
export async function uploadPvProductImage(
  file: File,
  options: { signal?: AbortSignal } = {},
): Promise<PvImageUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const raw = await http.post<RawUploadResponse>(
    PV_API_ENDPOINTS.ADMIN_PRODUCT_IMAGES,
    formData,
    { signal: options.signal },
  );

  const url = typeof raw?.url === "string" ? raw.url : "";
  if (!url) {
    // BE luôn trả `url`; rơi vào đây nghĩa là hợp đồng đã trôi. Nổ ngay còn hơn
    // ghi một chuỗi rỗng xuống hồ sơ rồi App PV vẽ ra ô ảnh trống.
    throw new Error(tStatic("pv.upload.missingUrl"));
  }

  return {
    url,
    storageKey: typeof raw?.storage_key === "string" ? raw.storage_key : "",
    bytes: typeof raw?.bytes === "number" ? raw.bytes : null,
    mimeType: typeof raw?.mime_type === "string" ? raw.mime_type : null,
  };
}

/**
 * URL ảnh hợp lệ để lưu xuống BE: http(s) tuyệt đối, tối đa 500 ký tự.
 *
 * Khớp đúng luật của `PvAdminResourceController::imageListInput` — `javascript:`
 * và `data:` bị loại vì App PV render thẳng chuỗi này vào `<img src>`. Vẫn cần ở
 * FE cho nhánh DÁN URL có sẵn (ảnh đã nằm trên CDN khác).
 */
export function isValidImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > 500) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.hostname !== ""
    );
  } catch {
    return false;
  }
}
