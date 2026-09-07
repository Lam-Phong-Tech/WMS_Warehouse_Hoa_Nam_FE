/**
 * CẢNH BÁO KHI FONT ICON KHÔNG TẢI ĐƯỢC.
 *
 * Sự cố 07/09/2026: node_modules dở dang (đang chạy `yarn install`) làm file
 * .woff2 của @flaticon 404. CSS vẫn áp `content: "\f1xx"` nên MỌI icon của app
 * — mũi tên sắp xếp, nút "+", "<" ">" phân trang, icon sidebar — thành ô vuông,
 * mà không có lỗi nào hiện ra: không cảnh báo build, không lỗi console, chỉ có
 * giao diện trông như vỡ. Mất rất nhiều thời gian mới truy ra nguyên nhân.
 *
 * Từ nay app tự nói ra. Bản sao font trong repo (src/styles/hn-icon-font.css →
 * public/fonts) lo phần CHỮA; hàm này lo phần BÁO, để lần sau nhìn console là
 * biết ngay phải làm gì.
 */
import { ICON_FAMILY } from "./icon-family";

/** Bỏ dấu nháy quanh tên họ font mà trình duyệt trả về ("Foo" → Foo). */
function normalizeFamily(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "");
}

/**
 * Lắng nghe sự kiện tải font hỏng và in MỘT dòng lỗi chỉ đúng việc phải làm.
 * Gọi một lần ở src/main.tsx. An toàn khi không có `document.fonts` (jsdom,
 * trình duyệt cũ) — lúc đó lặng lẽ không làm gì.
 */
export function watchIconFontHealth(): void {
  if (typeof document === "undefined") return;
  const fonts = document.fonts as FontFaceSet | undefined;
  if (!fonts || typeof fonts.addEventListener !== "function") return;

  // Trình duyệt bắn "loadingerror" mỗi lần có đoạn chữ cần tới font hỏng, tức
  // là nhiều lần mỗi trang. Chỉ nói MỘT lần cho khỏi lấp console.
  let reported = false;

  fonts.addEventListener("loadingerror", (event) => {
    if (reported) return;
    const broken = event.fontfaces.some(
      (face) => normalizeFamily(face.family) === ICON_FAMILY.fontFamily,
    );
    if (!broken) return;
    reported = true;

    console.error(
      `[icon-font] Một nguồn của font icon "${ICON_FAMILY.fontFamily}" không ` +
        `tải được. App khai hai nguồn cho cùng họ font: bản sao trong repo ` +
        `(public/fonts) và bản trong node_modules/@flaticon — còn một nguồn ` +
        `sống thì icon vẫn hiện đúng. NẾU ICON ĐANG LÀ Ô VUÔNG nghĩa là hỏng ` +
        `cả hai: chạy "yarn install && yarn ui:icons:sync" rồi tải lại trang.`,
    );
  });
}
