/**
 * RPT-02 · hộp thoại "Bằng chứng đối soát" của mockup 8.2.
 *
 * Hành vi port đúng `report-02-offline.js`: Escape đóng, bấm nền đóng, mở ra là
 * focus nút đóng — cộng thêm bẫy Tab (hộp thoại khai `aria-modal` nên tiêu điểm
 * không được rơi ra ngoài trong lúc nó đang mở).
 *
 * LỊCH SỬ: file này từng chứa thêm hai popover tự dựng (lịch "Mốc đối soát" và
 * chọn "Loại hàng") chép theo mockup. Yêu cầu người dùng 2026-09-03 là bộ lọc
 * của cả 8 màn Báo cáo phải ĐỒNG BỘ với màn "Nhập liệu, đối chiếu & lỗi"
 * (RPT-04), nên hai popover đó được thay bằng `UiDatePicker` / `UiSelect` /
 * `SearchInput` dùng chung; giữ lại ở đây chỉ tổ thành mã chết.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/shared/i18n/useT";

/** Danh sách phần tử focus được — cùng bộ chọn với hộp thoại của RPT-01. */
const FOCUSABLE =
  'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

/** Modal "Bằng chứng đối soát" — vỏ chung, nội dung do trang truyền vào. */
export function EvidenceModal({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const modalRef = useRef<HTMLElement>(null);

  // Mockup focus đúng nút đóng ngay khi mở (`modal.querySelector(".modal-close").focus()`).
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
