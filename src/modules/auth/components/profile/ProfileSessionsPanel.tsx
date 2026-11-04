import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  UiAlert,
  UiConfirmDialog,
  UiDrawer,
  UiIcon,
  UiStatusBadge,
} from "@/shared/ui";
import {
  ActionButton,
  ActionIconButton,
  RowActionButton,
} from "@/shared/components/actions";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/utils/format-date";
import { captureAuthOwner } from "@/shared/store/auth-owner";
import { profileService } from "../../services/profile.service";
import { desktopChromePlatform } from "./device-presentation";
import {
  profileKeys,
  type ProfileDevice,
  type ProfileDevicesResponse,
  type ProfileSession,
} from "../../types/profile.types";

type RevokeTarget =
  | { kind: "session"; session: ProfileSession }
  | { kind: "device"; device: ProfileDevice }
  | { kind: "others" };
const sessionName = (session: ProfileSession) => {
  if (session.client_type === "app") return "App";
  const ua = session.user_agent || "";
  return /Edg\//i.test(ua)
    ? "Edge"
    : /Firefox\//i.test(ua)
      ? "Firefox"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua)
          ? "Safari"
          : session.client_type === "web"
            ? "Web"
            : "—";
};

export function ProfileSessionsPanel({
  userId,
  compact = false,
  onManage,
}: {
  userId: string;
  compact?: boolean;
  onManage?: () => void;
}) {
  const t = useT();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: profileKeys.devices(userId),
    queryFn: profileService.getDevices,
  });
  const [selected, setSelected] = useState<{
    device: ProfileDevice;
    session?: ProfileSession;
  } | null>(null);
  const [target, setTarget] = useState<RevokeTarget | null>(null);
  const [uncertain, setUncertain] = useState<RevokeTarget | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const mutation = useMutation({
    mutationFn: (item: RevokeTarget) =>
      item.kind === "session"
        ? profileService.revokeSession(item.session.id)
        : item.kind === "device"
          ? profileService.revokeDevice(item.device.device_id!)
          : profileService.revokeOthers(),
  });
  const devices = query.data?.data ?? [];
  const sessions = devices.flatMap((device) => device.sessions);
  const selectedCurrent = selected
    ? devices.find((device) => device.group_key === selected.device.group_key)
    : undefined;
  const selectedSession = selected?.session
    ? selectedCurrent?.sessions.find(
        (session) => session.session_id === selected.session?.session_id,
      )
    : undefined;
  const policy = query.data?.meta;
  const policyLabel =
    policy?.account_session_policy?.enabled === true
      ? t("auth.personal.replacementPolicy")
      : policy?.account_session_policy?.enabled === false
        ? t("auth.personal.noLimit")
        : t("auth.personal.unknown");
  const otherCount = sessions.filter(
    (session) => !session.is_current && session.can_revoke,
  ).length;
  const date = (value?: string | null) =>
    value ? formatDateTime(value) : t("auth.personal.unknown");
  const deviceName = (device: ProfileDevice) =>
    (desktopChromePlatform(device)
      ? t("auth.personal.officeComputer")
      : null) ||
    device.device_label ||
    device.platform ||
    t("auth.personal.unknown");
  const icon = (device: ProfileDevice) =>
    device.client_type === "app"
      ? "mobile-notch"
      : /android|ios/i.test(device.platform || "")
        ? "tablet"
        : "computer";
  const revoke = async () => {
    if (!target || mutation.isPending) return;
    const current = target;
    const stillCurrent = captureAuthOwner();
    setError("");
    setNotice("");
    try {
      await mutation.mutateAsync(current);
      if (!stillCurrent()) return;
      setTarget(null);
      setSelected(null);
      setNotice(t("auth.personal.revokeDone"));
      await client.invalidateQueries({ queryKey: profileKeys.devices(userId) });
    } catch (cause) {
      if (!stillCurrent()) return;
      setTarget(null);
      if (
        !isAxiosError(cause) ||
        !cause.response ||
        cause.code === "ECONNABORTED" ||
        cause.response.status >= 500
      ) {
        setUncertain(current);
      } else if (cause.response.status === 404) {
        setMissing(true);
      } else {
        setError(t("auth.personal.saveError"));
      }
    }
  };
  const targetStillPresent = (
    item: RevokeTarget,
    response: ProfileDevicesResponse,
  ) =>
    item.kind === "session"
      ? response.data.some((device) =>
          device.sessions.some(
            (session) => session.session_id === item.session.session_id,
          ),
        )
      : item.kind === "device"
        ? response.data.some(
            (device) =>
              device.device_id === item.device.device_id &&
              device.sessions.length > 0,
          )
        : response.data.some((device) =>
            device.sessions.some((session) => !session.is_current),
          );
  const reconcile = async () => {
    if (!uncertain) return;
    const stillCurrent = captureAuthOwner();
    const result = await query.refetch();
    if (!stillCurrent() || !result.isSuccess || !result.data) return;
    setNotice(
      t(
        targetStillPresent(uncertain, result.data)
          ? "auth.personal.sessionStillActive"
          : "auth.personal.revokeDone",
      ),
    );
    setUncertain(null);
  };
  const counts = (
    <div className="hn-personal-session-counts">
      <span>
        <UiIcon name="computer" size="sm" />
        {t("auth.personal.devicesCount", {
          count: Number(
            policy?.active_device_count ??
              devices.filter((device) => device.device_id).length,
          ),
        })}
      </span>
      <span>
        <UiIcon name="layers" size="sm" />
        {t("auth.personal.sessionsCount", { count: sessions.length })}
      </span>
      {Number(policy?.unknown_device_group_count) > 0 ? (
        <span>
          {t("auth.personal.unknownDevices", {
            count: Number(policy?.unknown_device_group_count),
          })}
        </span>
      ) : null}
    </div>
  );
  if (query.isPending)
    return (
      <section className="hn-personal-card" role="status">
        {t("shared.table.loading")}
      </section>
    );
  if (query.isError)
    return (
      <section className="hn-personal-card hn-personal-empty">
        <UiIcon name="computer" />
        <h2>{t("auth.personal.sessionLoadError")}</h2>
        <ActionButton kind="refresh" onClick={() => void query.refetch()}>
          {t("auth.personal.retry")}
        </ActionButton>
      </section>
    );
  if (compact)
    return (
      <section className="hn-personal-card hn-personal-sessions-summary">
        <div>
          <h2>{t("auth.personal.tabsSessions")}</h2>
          {counts}
          <p className="hn-personal-muted">{policyLabel}</p>
        </div>
        <ActionButton kind="view" onClick={onManage}>
          {t("auth.personal.manageDevices")}
        </ActionButton>
      </section>
    );
  return (
    <div className="hn-personal-session-panel">
      {counts}
      {notice ? <UiAlert tone="info">{notice}</UiAlert> : null}
      {error ? <UiAlert tone="error">{error}</UiAlert> : null}
      {uncertain ? (
        <UiAlert tone="warning">
          <strong>{t("auth.personal.unknownOutcome")}</strong>
          <p>{t("auth.personal.unknownOutcomeHint")}</p>
          <ActionButton
            kind="refresh"
            loading={query.isFetching}
            onClick={reconcile}
          >
            {t("auth.personal.checkStatus")}
          </ActionButton>
        </UiAlert>
      ) : null}
      <div className="hn-personal-device-grid" data-count={devices.length}>
        {devices.map((device) => (
          <article
            className="hn-personal-card hn-personal-device-card"
            key={device.group_key}
          >
            <header>
              <span className="hn-personal-device-icon">
                <UiIcon name={icon(device)} />
              </span>
              <div>
                <h2>{deviceName(device)}</h2>
                <p className="hn-personal-muted">
                  {device.platform ||
                    desktopChromePlatform(device) ||
                    t("auth.personal.unknown")}
                </p>
                {device.is_current ? (
                  <UiStatusBadge
                    tone="info"
                    label={t("auth.personal.currentDevice")}
                  />
                ) : null}
              </div>
            </header>
            <dl className="hn-personal-detail-list">
              <div>
                <dt>
                  {t("auth.personal.sessionsCount", {
                    count: device.sessions.length,
                  })}
                </dt>
                <dd>
                  {device.sessions
                    .map((session) => sessionName(session))
                    .join(" · ")}
                </dd>
              </div>
              <div>
                <dt>{t("auth.personal.lastActive")}</dt>
                <dd>{date(device.last_active_at)}</dd>
              </div>
            </dl>
            <footer>
              <RowActionButton
                kind="view"
                aria-label={`${t("auth.personal.viewDetails")} · ${deviceName(device)}`}
                onClick={() => {
                  setSelected({ device });
                  setMissing(false);
                }}
              />
              {device.device_id && device.can_revoke && !device.is_current ? (
                <ActionButton
                  kind="revoke"
                  disabled={Boolean(uncertain) || mutation.isPending}
                  onClick={() => setTarget({ kind: "device", device })}
                >
                  {t("auth.personal.revokeDevice")}
                </ActionButton>
              ) : null}
            </footer>
          </article>
        ))}
      </div>
      {!otherCount ? (
        <section className="hn-personal-card">
          <h2>{t("auth.personal.noOtherSessions")}</h2>
          <p className="hn-personal-muted">
            {t("auth.personal.noOtherSessionsHint")}
          </p>
        </section>
      ) : null}
      <div className="hn-personal-actions">
        <ActionButton
          kind="revoke"
          disabled={!otherCount || Boolean(uncertain) || mutation.isPending}
          onClick={() => setTarget({ kind: "others" })}
        >
          {t("auth.personal.revokeOthers")}
        </ActionButton>
      </div>
      <UiDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width={640}
        className="hn-personal-drawer"
        slotProps={{ paper: { role: "dialog", "aria-modal": true } }}
        actions={
          selectedCurrent &&
          !missing &&
          (!selected?.session || selectedSession) ? (
            <div className="hn-personal-actions">
              <ActionButton kind="close" onClick={() => setSelected(null)}>
                {t("auth.personal.close")}
              </ActionButton>
              {selectedSession ? (
                selectedSession.can_revoke && !selectedSession.is_current ? (
                  <ActionButton
                    kind="revoke"
                    disabled={Boolean(uncertain) || mutation.isPending}
                    onClick={() =>
                      setTarget({ kind: "session", session: selectedSession })
                    }
                  >
                    {t("auth.personal.revokeSession")}
                  </ActionButton>
                ) : null
              ) : selectedCurrent.device_id &&
                selectedCurrent.can_revoke &&
                !selectedCurrent.is_current ? (
                <ActionButton
                  kind="revoke"
                  disabled={Boolean(uncertain) || mutation.isPending}
                  onClick={() =>
                    setTarget({ kind: "device", device: selectedCurrent })
                  }
                >
                  {t("auth.personal.revokeDevice")}
                </ActionButton>
              ) : null}
            </div>
          ) : undefined
        }
        title={
          <span className="hn-personal-drawer-title">
            {t(
              selected?.session
                ? "auth.personal.sessionDetails"
                : "auth.personal.deviceDetails",
            )}
            <ActionIconButton
              kind="close"
              label={t("auth.personal.close")}
              onClick={() => setSelected(null)}
            />
          </span>
        }
      >
        {selected ? (
          !selectedCurrent ||
          (selected.session && !selectedSession) ||
          missing ? (
            <div className="hn-personal-empty">
              <UiIcon name="computer" />
              <h3>{t("auth.personal.sessionMissing")}</h3>
              <p>{t("auth.personal.sessionMissingHint")}</p>
              <ActionButton
                kind="refresh"
                onClick={() => {
                  setMissing(false);
                  void query.refetch();
                }}
              >
                {t("auth.personal.reload")}
              </ActionButton>
            </div>
          ) : (
            <>
              {selected.session ? (
                <ActionButton
                  kind="back"
                  appearance="flat"
                  onClick={() => setSelected({ device: selectedCurrent })}
                >
                  {t("auth.personal.deviceDetails")}
                </ActionButton>
              ) : null}
              <div className="hn-personal-device-heading">
                <span className="hn-personal-device-icon">
                  <UiIcon name={icon(selectedCurrent)} />
                </span>
                <div>
                  <h3>
                    {selectedSession
                      ? sessionName(selectedSession)
                      : deviceName(selectedCurrent)}
                  </h3>
                  <p>
                    {selectedCurrent.platform ||
                      desktopChromePlatform(selectedCurrent) ||
                      t("auth.personal.unknown")}
                  </p>
                </div>
              </div>
              <dl className="hn-personal-detail-list">
                <div>
                  <dt>
                    {t(
                      selectedSession
                        ? "auth.personal.startedAt"
                        : "auth.personal.firstSeen",
                    )}
                  </dt>
                  <dd>
                    {date(
                      selectedSession?.started_at ??
                        selectedCurrent.first_seen_at,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t("auth.personal.lastActive")}</dt>
                  <dd>
                    {date(
                      selectedSession?.last_active_at ??
                        selectedCurrent.last_active_at,
                    )}
                  </dd>
                </div>
                {selectedSession ? (
                  <>
                    <div>
                      <dt>{t("auth.personal.sessionReference")}</dt>
                      <dd>
                        <CopyableId value={selectedSession.session_id} />
                      </dd>
                    </div>
                    <div>
                      <dt>{t("auth.personal.ip")}</dt>
                      <dd>
                        {selectedSession.ip_address ||
                          t("auth.personal.unknown")}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
              <p className="hn-personal-note">
                <UiIcon name="info" size="sm" />
                {t("auth.personal.sessionActivityNote")}
              </p>
              {!selectedSession ? (
                <section className="hn-personal-device-sessions">
                  <h3>{t("auth.personal.tabsSessions")}</h3>
                  {selectedCurrent.sessions.map((session) => (
                    <article key={session.session_id}>
                      <div>
                        <strong>{sessionName(session)}</strong>
                        {session.is_current ? (
                          <UiStatusBadge
                            tone="info"
                            label={t("auth.personal.currentSession")}
                          />
                        ) : null}
                        <p>{date(session.last_active_at)}</p>
                      </div>
                      <RowActionButton
                        kind="view"
                        aria-label={`${t("auth.personal.sessionDetails")} · ${sessionName(session)}`}
                        onClick={() =>
                          setSelected({ device: selectedCurrent, session })
                        }
                      />
                    </article>
                  ))}
                </section>
              ) : selectedSession.can_revoke &&
                !selectedSession.is_current ? null : (
                <UiAlert tone="info">
                  {t("auth.personal.currentProtected")}
                </UiAlert>
              )}
            </>
          )
        ) : null}
      </UiDrawer>
      <UiConfirmDialog
        open={Boolean(target)}
        title={t("auth.personal.revokeTitle")}
        tone="danger"
        confirmText={t("auth.personal.revokeSession")}
        loading={mutation.isPending}
        onClose={() => {
          if (!mutation.isPending) setTarget(null);
        }}
        onConfirm={() => void revoke()}
      >
        <p>
          {target?.kind === "device"
            ? deviceName(target.device)
            : target?.kind === "session"
              ? sessionName(target.session)
              : t("auth.personal.revokeOthers")}
        </p>
        {target ? (
          <ul className="hn-personal-confirm-sessions">
            {(target.kind === "others"
              ? sessions.filter(
                  (session) => !session.is_current && session.can_revoke,
                )
              : target.kind === "device"
                ? target.device.sessions.filter(
                    (session) => !session.is_current && session.can_revoke,
                  )
                : [target.session]
            ).map((session) => (
              <li key={session.session_id}>
                <strong>{sessionName(session)}</strong>
                <span>
                  {devices.find((device) =>
                    device.sessions.some(
                      (entry) => entry.session_id === session.session_id,
                    ),
                  )?.device_label ||
                    session.platform ||
                    t("auth.personal.unknown")}
                </span>
                <time>{date(session.last_active_at)}</time>
              </li>
            ))}
          </ul>
        ) : null}
        <p>{t("auth.personal.revokeHint")}</p>
      </UiConfirmDialog>
    </div>
  );
}
