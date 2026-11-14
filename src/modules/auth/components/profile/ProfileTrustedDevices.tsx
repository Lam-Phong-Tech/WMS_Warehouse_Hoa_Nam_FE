import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FILTER_WIDTH,
  UiAlert,
  UiConfirmDialog,
  UiPagination,
  UiSelect,
  UiStatusBadge,
} from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/utils/format-date";
import { useAuthStore } from "@/shared/store/auth.store";
import { profileService } from "../../services/profile.service";
import { profileKeys, type TrustedDevice } from "../../types/profile.types";
import { DeviceIllustration } from "./DeviceIllustration";

export function ProfileTrustedDevices({ userId }: { userId?: string }) {
  const t = useT();
  const client = useQueryClient();
  const storeUserId = useAuthStore((state) =>
    String(state.profile?.id ?? state.user?.id ?? "me"),
  );
  const resolvedUserId = userId || storeUserId;

  const query = useQuery({
    queryKey: profileKeys.trustedDevices(resolvedUserId),
    queryFn: profileService.getTrustedDevices,
    staleTime: 0,
  });

  const [target, setTarget] = useState<TrustedDevice | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  // Phân trang phía client (danh sách khay/thiết bị đã tải hết).
  // Mặc định 6 thẻ/trang, chọn trong 6/9/16/30 như lịch sử đăng nhập.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const revokeMutation = useMutation({
    mutationFn: (id: string) => profileService.revokeTrustedDevice(id),
  });

  const devices = query.data?.data ?? [];
  const total = devices.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, lastPage);
  const pageStart = (safePage - 1) * pageSize;
  const visibleDevices = devices.slice(pageStart, pageStart + pageSize);
  const correctingPage = page > lastPage;
  useEffect(() => {
    if (!correctingPage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Clamp the page when the list shrinks (e.g. after a revoke).
    setPage(lastPage);
  }, [correctingPage, lastPage]);

  const handleConfirmRevoke = async () => {
    if (!target || revokeMutation.isPending) return;
    const current = target;
    setErrorMessage("");
    try {
      const result = await revokeMutation.mutateAsync(current.id);
      setTarget(null);
      if (current.is_current || result?.was_current) {
        useAuthStore.getState().logout();
        return;
      }
      toast.success(t("auth.personal.trustedDevicesRevoked"));
      await client.invalidateQueries({
        queryKey: profileKeys.trustedDevices(resolvedUserId),
      });
      await client.invalidateQueries({
        queryKey: profileKeys.devices(resolvedUserId),
      });
    } catch {
      setTarget(null);
      setErrorMessage(t("auth.personal.saveError"));
    }
  };

  const formatTime = (value?: string | null) =>
    value ? formatDateTime(value) : t("auth.personal.unknown");

  const deviceKind = (device: TrustedDevice) => {
    const combined = `${device.device_label ?? ""} ${device.platform ?? ""}`;
    if (/ipad|tablet|\btab\b|SM-T/i.test(combined)) return "tablet" as const;
    if (
      device.client_type === "app" ||
      /android|ios|iphone|mobile/i.test(combined)
    ) {
      return "phone" as const;
    }
    return "desktop" as const;
  };

  return (
    <section className="hn-personal-card">
      <div className="hn-personal-section-heading">
        <div>
          <h2>{t("auth.personal.trustedDevicesTitle")}</h2>
          <p className="hn-personal-muted">
            {t("auth.personal.trustedDevicesSubtitle")}
          </p>
        </div>
      </div>

      {errorMessage ? <UiAlert tone="error">{errorMessage}</UiAlert> : null}

      {query.isError ? (
        <div className="hn-personal-empty">
          <p>{t("auth.personal.trustedDevicesLoadError")}</p>
          <ActionButton kind="refresh" onClick={() => void query.refetch()}>
            {t("auth.personal.retry")}
          </ActionButton>
        </div>
      ) : query.isPending ? (
        <p role="status">{t("shared.table.loading")}</p>
      ) : devices.length === 0 ? (
        <p className="hn-personal-muted">
          {t("auth.personal.trustedDevicesEmpty")}
        </p>
      ) : (
        <div className="hn-personal-device-grid" data-count={total}>
          {visibleDevices.map((device) => {
            const label =
              device.device_label ||
              device.platform ||
              t("auth.personal.unknown");
            return (
              <article
                className="hn-personal-card hn-personal-device-card"
                key={device.id}
              >
                <header>
                  <DeviceIllustration kind={deviceKind(device)} />
                  <div>
                    <h3>{label}</h3>
                    {device.is_current ? (
                      <UiStatusBadge
                        tone="success"
                        label={t("auth.personal.currentDevice")}
                      />
                    ) : null}
                  </div>
                </header>
                <div className="hn-device-facts">
                  <p className="hn-personal-muted">
                    {t("auth.personal.trustedDevicesLastUsed", {
                      time: formatTime(device.last_used_at ?? device.trusted_at),
                    })}
                    {" · "}
                    {t("auth.personal.trustedDevicesExpiresAt", {
                      time: formatTime(device.expires_at),
                    })}
                  </p>
                </div>
                {device.can_revoke ? (
                  <footer>
                    <ActionButton
                      kind="revoke"
                      appearance="flat"
                      className="hn-device-revoke"
                      disabled={revokeMutation.isPending}
                      onClick={() => setTarget(device)}
                    >
                      {t("auth.personal.trustedDevicesRevoke")}
                    </ActionButton>
                  </footer>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {devices.length ? (
        <div className="hn-login-history-pagination">
          <div className="hn-login-history-summary">
            <span>
              {t("inventory.rangeLabel", {
                from: total ? pageStart + 1 : 0,
                to: Math.min(pageStart + pageSize, total),
                total,
              })}
            </span>
            <UiSelect
              kind="page-size"
              aria-label={t("shared.table.rowsPerPageAria")}
              value={pageSize}
              minWidth={FILTER_WIDTH.pageSize}
              options={[6, 9, 16, 30].map((size) => ({
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
            page={safePage}
            pageSize={pageSize}
            total={total}
            showTotal={false}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      <p className="hn-personal-note">
        {t("auth.personal.trustedDevicesIdentityNote")}
      </p>

      <UiConfirmDialog
        open={Boolean(target)}
        title={t("auth.personal.trustedDevicesRevokeTitle")}
        tone="danger"
        confirmText={t("auth.personal.trustedDevicesRevoke")}
        loading={revokeMutation.isPending}
        onClose={() => {
          if (!revokeMutation.isPending) setTarget(null);
        }}
        onConfirm={() => void handleConfirmRevoke()}
      >
        {target ? (
          <p>
            <strong>
              {target.device_label ||
                target.platform ||
                t("auth.personal.unknown")}
            </strong>
          </p>
        ) : null}
        <p>{t("auth.personal.trustedDevicesRevokeBody")}</p>
      </UiConfirmDialog>
    </section>
  );
}
