/**
 * IN MỘT VÙNG DOM RA MÁY IN — qua iframe cách ly, KHÔNG đụng CSS global.
 *
 * Vì sao không dùng `@media print` + `window.print()` của trang chính:
 *
 *  - Nhãn luôn nằm trong `UiDialog` (MUI portal, `position: fixed`, có vùng
 *    cuộn riêng, có `transform` của hiệu ứng Grow). In thẳng trang chính thì
 *    trình duyệt phải cắt một phần tử fixed nằm trong stacking context có
 *    transform — kết quả lệch hẳn giữa Chrome/Firefox/Safari và hay bị cụt
 *    một nửa nhãn.
 *  - Muốn ẩn phần còn lại của app phải thêm CSS global; entrypoint CSS của dự
 *    án là hợp đồng có guard (`yarn ui:styles`), thêm một lớp chỉ để in là cái
 *    giá quá đắt cho một hộp thoại.
 *
 * Cách làm: dựng một iframe cùng gốc, chép TOÀN BỘ stylesheet đang có của
 * trang sang, rồi đặt đúng một node (bản sao HTML của nhãn) vào body. Nhờ vậy
 * bản in giống hệt bản xem trước — cùng một cây DOM, cùng một bảng style.
 *
 * CHÉP STYLE BẰNG `cssRules`, KHÔNG chép `outerHTML` của thẻ <style>: emotion
 * (engine style của MUI) chạy chế độ "speedy" khi build production — luật được
 * bơm qua `CSSStyleSheet.insertRule` nên thẻ <style> RỖNG hoàn toàn về mặt
 * text. Chép outerHTML sẽ chạy tốt ở dev rồi in ra một tờ giấy không style ở
 * production. Sheet nào không đọc được `cssRules` (khác gốc) thì giữ nguyên
 * bằng thẻ <link>.
 */

/** Thời gian chờ tối đa cho font/ảnh trước khi cứ thế in (ms). */
const ASSET_TIMEOUT_MS = 3000;
/** Dọn iframe sau khi hộp thoại in đóng — kể cả khi `afterprint` không bắn. */
const CLEANUP_DELAY_MS = 1000;
/** CSS px trên 1mm ở 96dpi — hệ quy đổi mà mọi trình duyệt dùng cho đơn vị mm. */
const PX_PER_MM = 96 / 25.4;

export interface PrintPage {
  widthMm: number;
  heightMm: number;
  /** Lề mỗi cạnh; mặc định 0 vì nội dung thường đã có padding riêng. */
  marginMm?: number;
}

export interface PrintElementOptions {
  /** Tiêu đề tài liệu in — trình duyệt dùng làm tên file khi "Lưu thành PDF". */
  title: string;
  /**
   * Khổ giấy đích. Bỏ trống thì để trình duyệt tự chọn khổ mặc định của máy in
   * và KHÔNG co nội dung (không biết khổ thì không biết co theo cái gì).
   */
  page?: PrintPage;
  /**
   * CSS thêm cho riêng bản in (ví dụ: cho nhãn giãn hết bề ngang khổ giấy thay
   * vì giữ `maxWidth` của bản xem trước). Được ghép SAU bảng style của trang
   * nên với cùng độ đặc hiệu (một class) nó thắng — không cần `!important`.
   */
  extraCss?: string;
  /**
   * Co nội dung cho vừa ĐÚNG một trang khi nó cao hơn khổ giấy (mặc định bật
   * khi có `page`).
   *
   * Vì sao cần: nhãn có phần dài ngắn theo dữ liệu (một hồ sơ thay 1 linh kiện
   * và một hồ sơ thay 6 linh kiện chênh nhau vài centimet). Không co thì phần
   * dư tràn sang tờ thứ hai — với decal 100×150 thì đó là một con tem rách đôi
   * chứ không phải "trang 2", và người dán không có cách nào biết trước.
   */
  fitToPage?: boolean;
}

/** Gom stylesheet của trang thành {link ngoài, css nội tuyến}. */
function collectStyles(doc: Document): { links: string[]; css: string } {
  const links: string[] = [];
  const cssChunks: string[] = [];

  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList | null;
    try {
      rules = sheet.cssRules;
    } catch {
      // Khác gốc: không đọc được luật, chỉ còn cách trỏ lại URL gốc.
      rules = null;
    }
    if (rules === null) {
      if (sheet.href) links.push(sheet.href);
      continue;
    }
    let text = "";
    for (const rule of Array.from(rules)) text += `${rule.cssText}\n`;
    if (text.trim() !== "") cssChunks.push(text);
  }

  return { links, css: cssChunks.join("\n") };
}

/** Chờ ảnh trong tài liệu in tải xong (QR là data URL nên gần như tức thì). */
function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images).filter((image) => !image.complete);
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    void promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

/**
 * Co nội dung cho vừa chiều cao một trang.
 *
 * Chạy HAI VÒNG có chủ đích: vòng một tính hệ số theo chiều cao đo được ở bề
 * rộng trang; vòng hai dàn lại nội dung ở bề rộng `width/k` (để sau khi thu nhỏ
 * `k` lần nó vẫn phủ kín bề ngang tem thay vì chừa một dải trắng bên phải) rồi
 * đo lại — chữ xuống dòng ít hơn nên chiều cao thường giảm thêm, và hệ số cuối
 * lấy theo số đo mới chứ không phải số đo cũ.
 */
function fitStageToPage(
  stage: HTMLElement,
  box: { width: number; height: number },
): void {
  const measure = () => stage.getBoundingClientRect().height;

  const naturalHeight = measure();
  if (naturalHeight <= box.height || naturalHeight === 0) return;

  const firstPass = box.height / naturalHeight;
  stage.style.width = `${box.width / firstPass}px`;
  const reflowedHeight = measure();
  const scale =
    reflowedHeight > 0 ? Math.min(1, box.height / reflowedHeight) : firstPass;

  stage.style.width = `${box.width / scale}px`;
  stage.style.transform = `scale(${scale})`;
}

/**
 * Mở hộp thoại in của trình duyệt cho đúng `node` (và cây con của nó).
 *
 * Trả về Promise hoàn tất khi đã gọi được lệnh in — KHÔNG phải khi người dùng
 * bấm In/Hủy trong hộp thoại hệ điều hành (trình duyệt không cho biết điều đó).
 * Ném lỗi khi môi trường không dựng được iframe, để nơi gọi báo người dùng.
 */
export async function printElement(
  node: HTMLElement,
  options: PrintElementOptions,
): Promise<void> {
  if (typeof document === "undefined") {
    // Thông điệp kỹ thuật cho lập trình viên — KHÔNG bao giờ hiện lên UI: nơi
    // gọi bắt lỗi rồi toast câu đã dịch của riêng màn hình đó.
    throw new Error("printElement requires a browser document");
  }

  const iframe = document.createElement("iframe");
  // KHÔNG dùng display:none — một số trình duyệt bỏ qua tài liệu của iframe ẩn
  // kiểu đó khi in. Đẩy ra ngoài khung nhìn là cách duy nhất chắc chắn.
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  // Iframe phải RỘNG ĐÚNG BẰNG vùng in của khổ giấy, không phải 1×1: trình
  // duyệt dàn trang theo bề rộng khung chứa, nên đo trên một khung 1px sẽ cho
  // chiều cao vô nghĩa và mọi tính toán co giãn bên dưới đều sai.
  const contentBox = options.page
    ? {
        width:
          (options.page.widthMm - 2 * (options.page.marginMm ?? 0)) * PX_PER_MM,
        height:
          (options.page.heightMm - 2 * (options.page.marginMm ?? 0)) *
          PX_PER_MM,
      }
    : null;
  iframe.style.width = contentBox ? `${contentBox.width}px` : "1px";
  iframe.style.height = contentBox ? `${contentBox.height}px` : "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = iframe.contentDocument ?? frameWindow?.document ?? null;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    throw new Error("Could not create the print frame");
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
  };

  try {
    const { links, css } = collectStyles(document);
    const pageRule = options.page
      ? `@page { size: ${options.page.widthMm}mm ${options.page.heightMm}mm; margin: ${options.page.marginMm ?? 0}mm; }`
      : "@page { margin: 0; }";

    frameDoc.open();
    frameDoc.write("<!doctype html><html><head></head><body></body></html>");
    frameDoc.close();

    // Chủ ý KHÔNG chép `data-theme` của trang: nhãn in ra giấy trắng, chế độ
    // tối sẽ thành một khối mực đen. Không đặt thuộc tính = bảng token sáng
    // (css-vars.css) có hiệu lực, vì lớp tối chỉ bám `:root[data-theme="dark"]`.
    frameDoc.documentElement.setAttribute(
      "lang",
      document.documentElement.getAttribute("lang") ?? "vi",
    );

    const head = frameDoc.head;
    const titleEl = frameDoc.createElement("title");
    titleEl.textContent = options.title;
    head.appendChild(titleEl);

    for (const href of links) {
      const link = frameDoc.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      head.appendChild(link);
    }

    const pageStyle = frameDoc.createElement("style");
    pageStyle.textContent = [
      css,
      pageRule,
      "html,body{margin:0;padding:0;background:white;}",
      "body{display:block;}",
      options.extraCss ?? "",
    ].join("\n");
    head.appendChild(pageStyle);

    // Hai lớp bọc, chỉ dùng khi biết khổ giấy:
    //  - `clip` khoá đúng MỘT trang (overflow hidden) để phần dư không đẩy máy
    //    in sang tờ thứ hai;
    //  - `stage` mang transform co giãn — transform KHÔNG đổi kích thước hộp
    //    layout, nên nếu thiếu `clip` thì trình duyệt vẫn phân trang theo chiều
    //    cao gốc và in ra một tờ trắng phía sau.
    const clip = frameDoc.createElement("div");
    const stage = frameDoc.createElement("div");
    if (contentBox) {
      clip.style.width = `${contentBox.width}px`;
      clip.style.height = `${contentBox.height}px`;
      clip.style.overflow = "hidden";
      stage.style.transformOrigin = "top left";
      stage.style.width = `${contentBox.width}px`;
      clip.appendChild(stage);
      frameDoc.body.appendChild(clip);
    }

    // `importNode` thay vì gán innerHTML: giữ nguyên cây DOM đã dựng (kể cả
    // <svg> mã vạch do JsBarcode sinh ra) mà không phải serialize/parse lại.
    const printedNode = frameDoc.importNode(node, true);
    (contentBox ? stage : frameDoc.body).appendChild(printedNode);

    const fonts = (frameDoc as Document & { fonts?: FontFaceSet }).fonts;
    await withTimeout(
      Promise.all([waitForImages(frameDoc), fonts?.ready ?? Promise.resolve()]),
      ASSET_TIMEOUT_MS,
    );

    if (contentBox && options.fitToPage !== false) {
      fitStageToPage(stage, contentBox);
    }

    frameWindow.addEventListener("afterprint", cleanup, { once: true });
    frameWindow.focus();
    frameWindow.print();
  } catch (error) {
    cleanup();
    throw error;
  }

  // Lưới an toàn: Safari và một vài bản Firefox không bắn `afterprint` cho
  // iframe. Không dọn thì mỗi lần in để lại một iframe chết trong DOM.
  setTimeout(cleanup, CLEANUP_DELAY_MS);
}
