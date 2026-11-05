import { useNotificationText } from "@/modules/notifications/utils/notification-text";
import { useState } from "react";
import { UiCard, UiPagination } from "@/shared/ui";
import { EmptyState, LoadingState } from "@/shared/components";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { StatusTag } from "@/shared/components/data-display/StatusTag";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsQuery,
} from "@/modules/notifications/hooks/useNotifications";
import { useNotificationStore } from "@/shared/store/notification.store";
import { NOTIFICATION_SEVERITY_COLOR } from "@/modules/notifications/constants/notification.constants";
import { NOTIFICATION_SEVERITY_LABELS } from "@/shared/constants/business-labels";
import { formatDateTime } from "@/shared/utils/format-date";
import { NotificationDetailModal } from "@/modules/notifications/components/NotificationDetailModal";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";
import { ActionButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import "./notifications-page.css";

export default function NotificationsPage() {
  const t = useT();
  const notificationText = useNotificationText();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const perPage = 10;
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const { data, isLoading, isError, error, refetch } = useNotificationsQuery({
    page,
    per_page: perPage,
    ...(unreadOnly ? { unread: true } : {}),
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Phòng thủ render như NotificationBell: payload không phải mảng → coi là rỗng.
  const items = Array.isArray(data?.data) ? data.data : [];
  const total = data?.meta?.total ?? 0;

  const changeFilter = (nextUnreadOnly: boolean) => {
    setUnreadOnly(nextUnreadOnly);
    setPage(1);
  };

  return (
    <div className="notifications-page">
      <UiCard disablePadding className="notifications-panel">
        <div className="notifications-toolbar">
          <div
            className="notifications-filters"
            role="group"
            aria-label={t("notifications.page.filterLabel")}
          >
            <button
              type="button"
              className="notifications-filter"
              aria-pressed={!unreadOnly}
              onClick={() => changeFilter(false)}
            >
              {t("notifications.page.all")}
            </button>
            <button
              type="button"
              className="notifications-filter"
              aria-pressed={unreadOnly}
              onClick={() => changeFilter(true)}
            >
              {t("notifications.page.unread")}
              {unreadCount > 0 ? (
                <span className="notifications-count">{unreadCount}</span>
              ) : null}
            </button>
          </div>
          <ActionButton
            kind="confirm"
            disabled={unreadCount === 0 || markAllRead.isPending}
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            {t("notifications.page.markAll")}
          </ActionButton>
        </div>

        {isError ? (
          <div className="notifications-state">
            <ApiErrorAlert
              error={error}
              title={t("notifications.loadError")}
              onRetry={() => void refetch()}
            />
          </div>
        ) : isLoading && items.length === 0 ? (
          <div className="notifications-state">
            <LoadingState
              tip={t("notifications.page.loading")}
              minHeight={260}
            />
          </div>
        ) : !isLoading && items.length === 0 ? (
          <div className="notifications-state">
            <EmptyState
              title={t("notifications.empty")}
              description={
                unreadOnly
                  ? t("notifications.page.emptyUnread")
                  : t("notifications.page.emptyDescription")
              }
            />
          </div>
        ) : (
          <>
            <ul className="notifications-list">
              {items.map((item) => (
                <li key={item.id} className="notifications-list-item">
                  <button
                    type="button"
                    className="notifications-row"
                    data-unread={!item.read_at}
                    onClick={() => {
                      if (!item.read_at) markRead.mutate(item.id);
                      setSelected(item);
                    }}
                  >
                    <span
                      className="notifications-indicator"
                      aria-hidden="true"
                    />
                    <span className="notifications-copy">
                      <span className="notifications-title">
                        {notificationText(item).title}
                      </span>
                      <span className="notifications-body">
                        {notificationText(item).body}
                      </span>
                      <span className="notifications-visually-hidden">
                        {item.read_at
                          ? t("notifications.page.readSuffix")
                          : t("notifications.page.unread")}
                      </span>
                    </span>
                    <span className="notifications-meta">
                      <StatusTag
                        status={item.severity}
                        colorMap={NOTIFICATION_SEVERITY_COLOR}
                        labelMap={NOTIFICATION_SEVERITY_LABELS}
                      />
                      <time dateTime={item.created_at}>
                        {formatDateTime(item.created_at)}
                      </time>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="notifications-pagination">
              <UiPagination
                page={page}
                pageSize={perPage}
                total={total}
                onPageChange={setPage}
                showTotal
              />
            </div>
          </>
        )}
      </UiCard>

      <NotificationDetailModal
        item={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
