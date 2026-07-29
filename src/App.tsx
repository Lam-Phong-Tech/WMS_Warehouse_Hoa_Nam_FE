import { App as AntdApp, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { Toaster } from "sonner";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { themeConfig } from "@/app/theme";
import { ErrorBoundary } from "@/shared/components";

// Tooltip mặc định của antd ("Nhấp để sắp xếp tăng/giảm dần") không nói rõ
// tăng/giảm dần nghĩa là gì — đổi thành A→Z / Z→A cho rõ ràng hơn khi hover
// vào tiêu đề cột có sorter (áp dụng toàn dự án qua ConfigProvider locale).
const locale = {
  ...viVN,
  Table: {
    ...viVN.Table,
    triggerAsc: "Nhấp để sắp xếp A → Z",
    triggerDesc: "Nhấp để sắp xếp Z → A",
    cancelSort: "Nhấp để bỏ sắp xếp",
  },
};

function App() {
  return (
    <ConfigProvider theme={themeConfig} locale={locale}>
      <AntdApp>
        <ErrorBoundary>
          <Toaster
            position="top-right"
            richColors
            closeButton
            expand
            gap={12}
            visibleToasts={5}
            swipeDirections={["bottom"]}
            className="app-toaster"
          />
          <RouterProvider router={router} />
        </ErrorBoundary>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
