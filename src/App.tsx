import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { VietnameseUiBoundary } from "@/shared/localization/VietnameseUiBoundary";
import { PwaStatus } from "@/shared/pwa/PwaStatus";

function App() {
  return (
    <VietnameseUiBoundary>
      <PwaStatus />
      <RouterProvider router={router} />
    </VietnameseUiBoundary>
  );
}

export default App;
