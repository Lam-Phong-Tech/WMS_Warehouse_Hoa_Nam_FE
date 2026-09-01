import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { PwaStatus } from "@/shared/pwa/PwaStatus";

function App() {
  return (
    <>
      <PwaStatus />
      <RouterProvider router={router} />
    </>
  );
}

export default App;
