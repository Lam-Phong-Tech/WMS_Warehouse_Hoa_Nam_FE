/**
 * RPT-01 · hộp thoại "Đối soát SKU" của mockup 8.1.
 *
 * Hành vi port đúng `Other/Report01_HTML_Export/report-01-offline.js`: Escape
 * đóng, bấm nền đóng, mở ra là focus nút đóng, và Tab bị BẪY trong khung
 * (mockup có hẳn nhánh `event.key === "Tab"`).
 *
 * LỊCH SỬ: file này từng chứa thêm hai popover tự dựng (chọn ngày, chọn loại
 * hàng) chép theo mockup. Yêu cầu người dùng 2026-09-03 là bộ lọc của cả 8 màn
 * Báo cáo phải ĐỒNG BỘ với màn "Nhập liệu, đối chiếu & lỗi" (RPT-04), nên hai
 * popover đó được thay bằng `UiDatePicker` / `UiSelect` / `SearchInput` dùng
 * chung và bị xoá khỏi đây — giữ lại chỉ tổ thành mã chết.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/shared/i18n/useT";

/** Danh sách phần tử focus được — đúng bộ chọn mockup dùng để bẫy Tab. */
const FOCUSABLE =
  'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

/** Modal "Đối soát SKU" — vỏ chung, nội dung do trang truyền vào. */
export function DrillDownModal({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const modalRef = useRef<HTMLElement>(null);

  // Mockup focus đúng nút đóng ngay khi mở.
  useEffect(() => {
    modalRef.current?.querySelector<HTMLElement>(".modal-close")?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const modal = modalRef.current;
      if (modal === null) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <section
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {children}
      </section>
    </>
  );
}

/** Nút đóng của modal — đặt trong `.modal-head` đúng vị trí mockup. */
export function ModalCloseButton({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <button
      className="modal-close"
      type="button"
      aria-label={t("reports.common.closeDetail")}
      onClick={onClose}
    >
      ×
    </button>
  );
}
