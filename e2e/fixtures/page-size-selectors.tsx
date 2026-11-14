import { createRoot } from "react-dom/client";
import { useState } from "react";
import { AppProviders } from "@/app/providers/AppProviders";
import { UiSelect } from "@/shared/ui/components/UiSelect";
import { UiPagination } from "@/shared/ui/components/UiPagination";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { TopPagination } from "@/shared/components/data-display/TopPagination";
import {
  initializeLanguage,
  useLanguageStore,
} from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { useT } from "@/shared/i18n/useT";
import { initializeTheme } from "@/shared/ui/theme/theme.store";
import "@/shared/ui/tokens/css-vars.css";
import "@/shared/ui/tokens/css-vars-dark.css";
import "@/shared/ui/tokens/operations.css";
import "@/index.css";
import "@/shared/ui/operations-ui.css";
import "@/modules/outbound/pages/outbound-list.css";
import "@/modules/master-data/pages/sku-list.css";

initializeTheme();
initializeLanguage();
const language = useLanguageStore.getState().language;
if (language === "en") await ensureEnglishMessages();
if (language === "zh") await ensureChineseMessages();

export function Fixture() {
  const [size, setSize] = useState(15);
  const t = useT();
  return (
    <main className="hn-system-shell" style={{ padding: 12 }}>
      <section
        aria-label="Page size regression"
        style={{ display: "flex", flexDirection: "column", gap: 24 }}
      >
        <div className="hn-outbound-list">
          <UiSelect
            kind="page-size"
            value={size}
            minWidth={70}
            menuClassName="hn-outbound-menu"
            aria-label="Outbound-sized selector"
            onChange={(value) => setSize(Number(value))}
            options={[10, 15, 20, 50, 1000].map((size) => ({
              value: size,
              label: t("shared.table.perPage", { size }),
            }))}
          />
        </div>
        <UiPagination
          page={1}
          pageSize={size}
          total={120}
          onPageChange={() => {}}
          onPageSizeChange={setSize}
        />
        <div className="hn-sku-screen">
          <MvpPageSizeSelector
            value={size}
            onChange={setSize}
            menuClassName="hn-sku-menu"
          />
        </div>
        <TopPagination
          total={120}
          current={1}
          pageSize={size}
          onChange={(_page, nextSize) => setSize(nextSize)}
        />
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <Fixture />
  </AppProviders>,
);
