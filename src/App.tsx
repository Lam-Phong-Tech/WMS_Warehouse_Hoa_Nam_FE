import { Fragment } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { PwaStatus } from "@/shared/pwa/PwaStatus";
import { useLanguageStore } from "@/shared/i18n/language.store";

/**
 * `key={language}`: đổi ngôn ngữ là REMOUNT toàn bộ cây dưới router.
 *
 * Vì sao cần: `useT()` chỉ re-render component có subscribe store; các nhãn đọc
 * qua hàm thuần lúc render (`businessLabel`, `emptyText`, option dựng ở cấp
 * module…) không subscribe nên nếu chỉ re-render cục bộ sẽ sót chuỗi ở ngôn ngữ
 * cũ — đúng loại "điểm chết" từng bị báo (đổi EN nhưng lác đác còn tiếng Việt).
 * Router là instance cấp module nên URL/history giữ nguyên sau remount; cái mất
 * là state cục bộ (dialog đang mở, form chưa lưu) — chấp nhận được cho một thao
 * tác đổi ngôn ngữ chủ động.
 */
function App() {
  const language = useLanguageStore((state) => state.language);
  return (
    <Fragment key={language}>
      <PwaStatus />
      <RouterProvider router={router} />
    </Fragment>
  );
}

export default App;
