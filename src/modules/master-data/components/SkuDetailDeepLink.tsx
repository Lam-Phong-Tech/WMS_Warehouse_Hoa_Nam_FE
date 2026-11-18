import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { UiAlert, UiButton } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { getMvpSku } from "../services/mvp-master.service";
import type { SkuRecord } from "../types/mvp-master.types";

export function SkuDetailDeepLink({
  skuId,
  refreshKey,
  onResolved,
  onDismiss,
}: {
  skuId: string;
  refreshKey: number;
  onResolved: (sku: SkuRecord | null) => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const query = useQuery({
    queryKey: ["mvp-master", "sku-detail", skuId, refreshKey],
    queryFn: () => getMvpSku(skuId),
    staleTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (query.data) onResolved(query.data);
    return () => onResolved(null);
  }, [query.data, onResolved]);

  if (query.isLoading)
    return <p role="status">{t("importResult.skuDetailLoading")}</p>;
  if (query.isError)
    return (
      <UiAlert tone="error">
        {t("importResult.skuDetailError")}{" "}
        <UiButton appearance="text" onClick={() => void query.refetch()}>
          {t("importResult.retry")}
        </UiButton>
        <UiButton appearance="text" onClick={onDismiss}>
          {t("common.close")}
        </UiButton>
      </UiAlert>
    );
  return null;
}
