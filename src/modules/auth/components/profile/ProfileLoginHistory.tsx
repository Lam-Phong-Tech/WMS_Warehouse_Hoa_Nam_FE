import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionButton } from "@/shared/components/actions";
import {
  FILTER_WIDTH,
  UiPagination,
  UiSelect,
  UiStatusBadge,
} from "@/shared/ui";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/utils/format-date";
import { profileService } from "../../services/profile.service";
import { profileKeys } from "../../types/profile.types";
import { DeviceIllustration } from "./DeviceIllustration";
import { sessionName } from "./session-presentation";

/** Ended login families are read-only and never participate in active counts/actions. */
export function ProfileLoginHistory({ userId }: { userId: string }) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const query = useQuery({
    queryKey: [...profileKeys.deviceHistory(userId), page, pageSize],
    queryFn: () => profileService.getDeviceHistory(page, pageSize),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const pagination = resolveApiPagination(query.data?.meta, {
    page, pageSize, rowCount: query.data?.data.length ?? 0,
  });
  const lastPage = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const correctingPage = query.isSuccess && page > lastPage;
  useEffect(() => {
    if (!correctingPage || query.isFetching) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Token pruning can remove the requested page on a server refetch.
    setPage(lastPage);
  }, [correctingPage, lastPage, query.isFetching]);
  if (query.isPending || correctingPage)
    return <p role="status">{t("auth.personal.loginHistoryLoading")}</p>;
  if (query.isError)
    return (
      <section
        className="hn-personal-card hn-login-history"
        aria-label={t("auth.personal.loginHistory")}
      >
        <p>{t("auth.personal.loginHistoryError")}</p>
        <ActionButton kind="refresh" onClick={() => void query.refetch()}>
          {t("auth.personal.retry")}
        </ActionButton>
      </section>
    );
  if (!query.data.meta.total && page === 1) return null;
  const date = (value: string | null | undefined) =>
    value ? formatDateTime(value) : t("auth.personal.unknown");
  return (
    <section
      className="hn-login-history"
      aria-label={t("auth.personal.loginHistory")}
    >
      <h2>{t("auth.personal.loginHistory")}</h2>
      <div className="hn-personal-device-grid">
        {query.data.data.map((entry) => {
          const metadata = `${entry.device_label || ""} ${entry.platform || ""} ${entry.user_agent || ""}`;
          const tablet = /ipad|tablet|\btab\b|SM-T/i.test(metadata);
          const phone =
            !tablet &&
            (entry.client_type === "app" ||
              /android|ios|iphone|mobile/i.test(metadata));
          const platform =
            entry.platform ||
            (/Android/i.test(metadata)
              ? "Android"
              : /iPhone|iPad/i.test(metadata)
                ? "iOS"
                : /Windows/i.test(metadata)
                  ? "Windows"
                  : /Macintosh|Mac OS/i.test(metadata)
                    ? "macOS"
                    : "");
          const name =
            entry.device_label ||
            (phone
              ? t("auth.personal.phoneDevice")
              : tablet
                ? t("auth.personal.tabletDevice")
                : platform
                  ? t("auth.personal.officeComputer")
                  : t("auth.personal.unknown"));
          return (
            <article
              className="hn-personal-card hn-personal-device-card hn-login-history-card"
              key={entry.session_id}
            >
              <header>
                <DeviceIllustration
                  kind={tablet ? "tablet" : phone ? "phone" : "desktop"}
                />
                <div>
                  <h3>{name}</h3>
                  <p className="hn-personal-muted">
                    {[sessionName(entry), platform].filter(Boolean).join(" · ")}
                  </p>
                  <UiStatusBadge
                    tone="neutral"
                    label={t(
                      entry.status === "EXPIRED"
                        ? "auth.personal.loginExpired"
                        : "auth.personal.loginSignedOut",
                    )}
                  />
                </div>
              </header>
              <dl className="hn-personal-detail-list">
                <div>
                  <dt>{t("auth.personal.loginStarted")}</dt>
                  <dd>{date(entry.started_at)}</dd>
                </div>
                <div>
                  <dt>{t("auth.personal.loginEnded")}</dt>
                  <dd>{date(entry.ended_at)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
      <div className="hn-login-history-pagination">
        <div className="hn-login-history-summary">
          <span>
            {t("auth.personal.historyRange", {
              from: pagination.total ? (pagination.current - 1) * pagination.pageSize + 1 : 0,
              to: Math.min(pagination.current * pagination.pageSize, pagination.total),
              total: pagination.total,
            })}
          </span>
          <UiSelect
            aria-label={t("shared.table.perPageAria")}
            value={pagination.pageSize}
            disabled={query.isFetching}
            minWidth={FILTER_WIDTH.pageSize}
            options={[6, 12, 24].map((size) => ({
              value: size,
              label: t("shared.table.perPage", { size }),
            }))}
            onChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          />
        </div>
        <UiPagination
          page={pagination.current}
          pageSize={pagination.pageSize}
          total={pagination.total}
          showTotal={false}
          disabled={query.isFetching}
          onPageChange={setPage}
        />
      </div>
    </section>
  );
}
