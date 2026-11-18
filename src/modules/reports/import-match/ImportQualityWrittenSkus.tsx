import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UiAlert, UiButton, UiPagination } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { CACHE_POLICIES } from "@/shared/cache/cache-policy";
import { fetchImportQualityWrittenSkus } from "./import-quality-api";

export function ImportQualityWrittenSkus({ batchId }: { batchId: string }) {
  const t = useT();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["rpt-04", "sku-import-written-skus", batchId, page],
    queryFn: () => fetchImportQualityWrittenSkus(batchId, page),
    enabled: expanded,
    staleTime: CACHE_POLICIES.report.staleTime,
  });
  return (
    <div className="rpt04-written-skus">
      <UiButton
        appearance="outlined"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
      >
        {t("importResult.viewWrittenSkus")}
      </UiButton>
      {expanded ? (
        <div id={id} role="region" aria-label={t("importResult.writtenSkus")}>
          <p className="rpt04-batch-note">
            {t("importResult.writtenSkusHint")}
          </p>
          {query.isLoading ? (
            <p role="status">{t("importResult.writtenSkusLoading")}</p>
          ) : null}
          {query.isError ? (
            <UiAlert tone="error">
              {t("importResult.writtenSkusError")}{" "}
              <UiButton appearance="text" onClick={() => void query.refetch()}>
                {t("importResult.retry")}
              </UiButton>
            </UiAlert>
          ) : null}
          {query.isSuccess ? (
            <>
              {query.data.meta?.linkage_status === "NOT_RECORDED" ? (
                <p>{t("importResult.writtenSkusLegacy")}</p>
              ) : query.data.data.length === 0 ? (
                <p>{t("importResult.writtenSkusEmpty")}</p>
              ) : (
                <ul className="rpt04-written-skus-list">
                  {query.data.data.map((sku) => (
                    <li key={sku.sku_id}>
                      <span>
                        {sku.available ? (
                          <a
                            href={`/master-data/skus?${new URLSearchParams({ sku_id: sku.sku_id })}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("importResult.openSkuAria", {
                              code: sku.sku_code,
                            })}
                          >
                            {sku.sku_code} <span aria-hidden="true">↗</span>
                          </a>
                        ) : (
                          <strong>{sku.sku_code}</strong>
                        )}
                        {!sku.available ? (
                          <small>{t("importResult.skuDeleted")}</small>
                        ) : null}
                      </span>
                      <span>
                        {t(
                          sku.action === "CREATED"
                            ? "importResult.inserted"
                            : "importResult.updated",
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {Number(query.data.meta?.total) > 20 ? (
                <UiPagination
                  page={page}
                  pageSize={20}
                  total={Number(query.data.meta?.total)}
                  onPageChange={setPage}
                  showTotal={false}
                  disabled={query.isFetching}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
