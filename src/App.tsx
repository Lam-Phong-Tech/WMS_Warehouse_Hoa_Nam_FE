import { Fragment } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { PwaStatus } from "@/shared/pwa/PwaStatus";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { EnglishLanguageBoundary } from "@/shared/i18n/EnglishLanguageBoundary";

function App() {
  const language = useLanguageStore((state) => state.language);
  return (
    <EnglishLanguageBoundary>
      <Fragment key={language}>
        <PwaStatus />
        <RouterProvider router={router} />
      </Fragment>
    </EnglishLanguageBoundary>
  );
}

export default App;
