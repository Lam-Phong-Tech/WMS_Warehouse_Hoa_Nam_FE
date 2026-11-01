import { Fragment } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { PwaStatus } from "@/shared/pwa/PwaStatus";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { LanguageBoundary } from "@/shared/i18n/EnglishLanguageBoundary";

function App() {
  const language = useLanguageStore((state) => state.language);
  return (
    <LanguageBoundary>
      <Fragment key={language}>
        <PwaStatus />
        <RouterProvider router={router} />
      </Fragment>
    </LanguageBoundary>
  );
}

export default App;
