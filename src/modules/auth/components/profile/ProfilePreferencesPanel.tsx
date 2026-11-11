import { useEffect, useState, type CSSProperties } from "react";
import { isAxiosError } from "axios";
import {
  UiAlert,
  UiConfirmDialog,
  UiIcon,
  UiSelect,
  UiTextField,
  Switch,
} from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import {
  cssVarNameOf,
  OPERATIONS_COLORS,
  OPERATIONS_PALETTE,
  PALETTE_KEYS,
  personalAccent,
} from "@/shared/ui/tokens";
import type {
  ProfilePreferences,
  ProfilePreferenceChanges,
} from "../../types/profile.types";

type Mode = "account" | "appearance" | "other" | "notifications";
const fields: Record<Mode, (keyof ProfilePreferenceChanges)[]> = {
  account: ["locale", "timezone", "date_format", "default_homepage"],
  appearance: ["theme", "accent"],
  other: ["font_size", "density", "reduced_motion"],
  notifications: ["notifications"],
};
const accentColors = {
  ocean: personalAccent("light", "ocean").primary,
  teal: personalAccent("light", "teal").primary,
  indigo: personalAccent("light", "indigo").primary,
  graphite: personalAccent("light", "graphite").primary,
};

export function ProfilePreferencesPanel({
  preferences,
  mode,
  onSave,
  onReload,
  onDirtyChange,
  homeOptions,
}: {
  preferences: ProfilePreferences;
  mode: Mode;
  onSave: (
    changes: ProfilePreferenceChanges,
    version: number,
  ) => Promise<ProfilePreferences>;
  onReload: () => void;
  onDirtyChange: (dirty: boolean) => void;
  homeOptions: { value: string; label: string }[];
}) {
  const t = useT();
  const [draft, setDraft] = useState(preferences);
  const [baseline, setBaseline] = useState(preferences);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [reset, setReset] = useState(false);
  const [reload, setReload] = useState(false);
  const homeLabels: Record<string, string> = {
    dashboard: t("auth.personal.homeDashboard"),
    inbound: t("auth.personal.homeInbound"),
    outbound: t("auth.personal.homeOutbound"),
    inventory: t("auth.personal.homeInventory"),
  };
  const dirty = fields[mode].some(
    (key) => JSON.stringify(draft[key]) !== JSON.stringify(baseline[key]),
  );
  useEffect(() => {
    if (!dirty && preferences.version !== baseline.version) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize fresh canonical preferences only when there is no user draft.
      setDraft(preferences);
      setBaseline(preferences);
    }
  }, [preferences, baseline.version, dirty]);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  const update = <K extends keyof ProfilePreferences>(
    key: K,
    value: ProfilePreferences[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setPending(true);
    setError("");
    const changes = Object.fromEntries(
      fields[mode].map((key) => [key, draft[key]]),
    ) as ProfilePreferenceChanges;
    try {
      const saved = await onSave(changes, baseline.version);
      setDraft(saved);
      setBaseline(saved);
      setStale(false);
    } catch (cause) {
      setStale(isAxiosError(cause) && cause.response?.status === 412);
      setError(t("auth.personal.saveError"));
    } finally {
      setPending(false);
    }
  };
  const select = <
    K extends "locale" | "timezone" | "date_format" | "default_homepage",
  >(
    key: K,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <UiSelect
      key={key}
      fullWidth
      label={label}
      aria-label={label}
      value={draft[key]}
      disabled={pending}
      options={
        options.some((option) => option.value === draft[key])
          ? options
          : [
              {
                value: draft[key],
                label:
                  key === "default_homepage"
                    ? homeLabels[draft[key]] || draft[key]
                    : draft[key],
              },
              ...options,
            ]
      }
      onChange={(value) => update(key, String(value) as ProfilePreferences[K])}
    />
  );
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: draft.timezone,
  }).formatToParts(new Date());
  const part = (type: string) =>
    dateParts.find((item) => item.type === type)?.value || "";
  const sampleDate =
    draft.date_format === "YYYY-MM-DD"
      ? `${part("year")}-${part("month")}-${part("day")}`
      : draft.date_format === "MM/DD/YYYY"
        ? `${part("month")}/${part("day")}/${part("year")}`
        : `${part("day")}/${part("month")}/${part("year")}`;
  const sampleTime = new Intl.DateTimeFormat(draft.locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: draft.timezone,
  }).format(new Date());
  const categories = [
    {
      key: "stock_documents",
      label: t("auth.personal.categoryDocuments"),
      icon: "box",
    },
    {
      key: "inventory",
      label: t("auth.personal.categoryInventory"),
      icon: "layers",
    },
    {
      key: "warranty",
      label: t("auth.personal.categoryWarranty"),
      icon: "wrench-simple",
    },
    { key: "account", label: t("auth.personal.categoryAccount"), icon: "user" },
  ];
  return (
    <div className="hn-personal-settings">
      {error ? (
        <UiAlert tone="error">
          {stale ? t("auth.personal.stale") : error}
          {stale ? (
            <ActionButton kind="refresh" onClick={() => setReload(true)}>
              {t("auth.personal.reload")}
            </ActionButton>
          ) : null}
        </UiAlert>
      ) : null}
      {mode === "account" ? (
        <div className="hn-personal-settings-grid">
          <section className="hn-personal-card">
            <h2>{t("auth.personal.preferencesTitle")}</h2>
            <div className="hn-personal-form-grid">
              {select("locale", t("auth.personal.language"), [
                { value: "vi", label: "Tiếng Việt" },
                { value: "en", label: "English" },
                { value: "zh", label: "中文" },
              ])}
              {select(
                "timezone",
                t("auth.personal.timezone"),
                [
                  ...new Set([
                    "UTC",
                    ...(typeof Intl.supportedValuesOf === "function"
                      ? Intl.supportedValuesOf("timeZone")
                      : ["Asia/Ho_Chi_Minh", "Asia/Shanghai"]),
                  ]),
                ].map((value) => ({ value, label: value })),
              )}
              {select(
                "date_format",
                t("auth.personal.dateFormat"),
                ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((value) => ({
                  value,
                  label: value,
                })),
              )}
              {select(
                "default_homepage",
                t("auth.personal.homePage"),
                homeOptions,
              )}
            </div>
            <p className="hn-personal-note">
              <UiIcon name="info" size="sm" />
              {t("auth.personal.personalOnly")}
            </p>
          </section>
          <section className="hn-personal-card hn-personal-format-preview">
            <h2>{t("auth.personal.preview")}</h2>
            <p>
              <UiIcon name="calendar" />
              {sampleDate}
            </p>
            <p>
              <UiIcon name="clock" />
              {sampleTime} · {draft.timezone}
            </p>
            <small>{draft.date_format}</small>
          </section>
        </div>
      ) : null}
      {mode === "notifications" ? (
        <div className="hn-personal-settings-grid hn-personal-settings-grid--single">
          <section className="hn-personal-card">
            <h2>{t("auth.personal.notifications")}</h2>
            <div className="hn-personal-notification-table">
              <div className="hn-personal-notification-head">
                <span>{t("auth.personal.category")}</span>
                <span>{t("auth.personal.inApp")}</span>
                <span>{t("auth.personal.emailChannel")}</span>
              </div>
              {categories.map(({ key, label, icon }) => (
                <div className="hn-personal-notification-row" key={key}>
                  <span>
                    <UiIcon name={icon} size="sm" />
                    {label}
                  </span>
                  {(["in_app", "email"] as const).map((channel) => (
                    <label
                      key={channel}
                      className="hn-personal-notification-toggle"
                    >
                      <Switch
                        checked={
                          key === "account" && channel === "in_app"
                            ? true
                            : Boolean(draft.notifications[key]?.[channel])
                        }
                        disabled={
                          pending || (key === "account" && channel === "in_app")
                        }
                        slotProps={{
                          input: {
                            "aria-label": `${label} · ${t(channel === "in_app" ? "auth.personal.inApp" : "auth.personal.emailChannel")}`,
                          },
                        }}
                        onChange={(_, checked) =>
                          update("notifications", {
                            ...draft.notifications,
                            [key]: {
                              ...draft.notifications[key],
                              [channel]: checked,
                            },
                          })
                        }
                      />
                      {key === "account" && channel === "in_app" ? (
                        <small>{t("auth.personal.mandatory")}</small>
                      ) : null}
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <p className="hn-personal-note">
              <UiIcon name="lock" size="sm" />
              {t("auth.personal.notificationPolicy")}
            </p>
          </section>
        </div>
      ) : null}
      {mode === "appearance" ? (
        <div className="hn-personal-settings-grid">
          <section className="hn-personal-card">
            <h2>{t("auth.personal.theme")}</h2>
            <div className="hn-personal-theme-options">
              {(["light", "dark", "system"] as const).map((theme) => {
                const thumbPalette =
                  theme === "system" ? null : OPERATIONS_COLORS[theme];
                return (
                  <button
                    type="button"
                    key={theme}
                    aria-pressed={draft.theme === theme}
                    disabled={pending}
                    onClick={() => update("theme", theme)}
                  >
                    <span
                      className={`hn-personal-theme-thumbnail ${theme}`}
                      style={
                        thumbPalette
                          ? ({
                              "--theme-thumb-canvas": thumbPalette.canvas,
                              "--theme-thumb-accent": thumbPalette.primary,
                              "--theme-thumb-line": thumbPalette.line,
                            } as CSSProperties)
                          : undefined
                      }
                    >
                      <i />
                      <span>
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                    {t(`auth.personal.${theme}`)}
                  </button>
                );
              })}
            </div>
            <h3>{t("auth.personal.accent")}</h3>
            <div className="hn-personal-choice-row">
              {(Object.keys(accentColors) as (keyof typeof accentColors)[]).map(
                (accent) => (
                  <button
                    key={accent}
                    type="button"
                    disabled={pending}
                    aria-pressed={draft.accent === accent}
                    onClick={() => update("accent", accent)}
                  >
                    <i style={{ background: accentColors[accent] }} />
                    {accent[0].toUpperCase() + accent.slice(1)}
                  </button>
                ),
              )}
            </div>
            <p className="hn-personal-note">
              <UiIcon name="info" size="sm" />
              {t("auth.personal.semanticColors")}
            </p>
          </section>
          <PreferencePreview preferences={draft} />
        </div>
      ) : null}
      {mode === "other" ? (
        <div className="hn-personal-settings-grid">
          <section className="hn-personal-card">
            <div className="hn-personal-section-heading hn-personal-preferences-heading">
              <h2>{t("auth.personal.fontSize")}</h2>
              <ActionButton
                kind="reset"
                appearance="flat"
                disabled={pending}
                onClick={() => setReset(true)}
              >
                {t("auth.personal.resetDefaults")}
              </ActionButton>
            </div>
            <div className="hn-personal-choice-row">
              {(["medium", "large"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  disabled={pending}
                  aria-pressed={draft.font_size === size}
                  onClick={() => update("font_size", size)}
                >
                  {t(
                    size === "medium"
                      ? "auth.personal.standard"
                      : "auth.personal.large",
                  )}
                </button>
              ))}
            </div>
            <h3>{t("auth.personal.density")}</h3>
            <div className="hn-personal-choice-row">
              {(["comfortable", "compact"] as const).map((density) => (
                <button
                  type="button"
                  key={density}
                  disabled={pending}
                  aria-pressed={draft.density === density}
                  onClick={() => update("density", density)}
                >
                  {t(`auth.personal.${density}`)}
                </button>
              ))}
            </div>
            <div className="hn-personal-motion-settings">
              <h3>{t("auth.personal.motion")}</h3>
              <label className="hn-personal-switch-row">
                <span>
                  <strong>{t("auth.personal.reduceMotion")}</strong>
                  <small>{t("auth.personal.reduceMotionHint")}</small>
                </span>
                <Switch
                  disabled={pending}
                  checked={draft.reduced_motion}
                  onChange={(_, checked) => update("reduced_motion", checked)}
                  slotProps={{
                    input: { "aria-label": t("auth.personal.reduceMotion") },
                  }}
                />
              </label>
            </div>
          </section>
          <PreferencePreview preferences={draft} />
        </div>
      ) : null}
      <div className="hn-personal-actions">
        <ActionButton
          kind="cancel"
          disabled={pending || !dirty}
          onClick={() => {
            setDraft(preferences);
            setBaseline(preferences);
            setError("");
            setStale(false);
          }}
        >
          {t("auth.personal.cancel")}
        </ActionButton>
        <ActionButton
          kind="save"
          disabled={!dirty || stale}
          loading={pending}
          onClick={save}
        >
          {t("auth.personal.save")}
        </ActionButton>
      </div>
      <UiConfirmDialog
        open={reset}
        title={t("auth.personal.resetTitle")}
        confirmText={t("auth.personal.resetDefaults")}
        onConfirm={() => {
          setDraft((current) => ({
            ...current,
            font_size: "medium",
            density: "comfortable",
            reduced_motion: false,
          }));
          setReset(false);
        }}
        onClose={() => setReset(false)}
      >
        {t("auth.personal.resetHint")}
      </UiConfirmDialog>
      <UiConfirmDialog
        open={reload}
        title={t("auth.personal.unsavedTitle")}
        tone="danger"
        confirmText={t("auth.personal.discard")}
        cancelText={t("auth.personal.keepEditing")}
        onConfirm={() => {
          onReload();
          setReload(false);
        }}
        onClose={() => setReload(false)}
      >
        {t("auth.personal.unsavedBody")}
      </UiConfirmDialog>
    </div>
  );
}

function PreferencePreview({
  preferences,
}: {
  preferences: ProfilePreferences;
}) {
  const t = useT();
  const dark =
    preferences.theme === "dark" ||
    (preferences.theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const mode = dark ? "dark" : "light";
  const palette = OPERATIONS_COLORS[mode];
  const semantic = OPERATIONS_PALETTE[mode];
  // The preview is a mini app of its own: scope every semantic token to the
  // draft theme so MUI fields, the sample table and status pills do not keep
  // resolving the *current* page theme while the card shows the other one.
  const previewTokens = {
    "--ops-heading": palette.heading,
    "--ops-primary": palette.primary,
    "--ops-primary-hover": palette.primaryHover,
    "--ops-text": palette.text,
    "--ops-muted": palette.muted,
    "--ops-line": palette.line,
    "--ops-divider": palette.divider,
    "--ops-pale": palette.pale,
    "--ops-table-header": palette.tableHeader,
    "--ops-link": palette.link,
    "--ops-surface": palette.surface,
    "--ops-canvas": palette.canvas,
    "--ops-success": palette.success,
    "--ops-warning": palette.warning,
    "--ops-danger": palette.danger,
    "--ops-on-primary": palette.onPrimary,
    "--ops-inactive": palette.inactive,
    "--ops-success-soft": palette.successSoft,
    "--ops-success-text": palette.successText,
    "--ops-warning-text": palette.warningText,
    "--ops-danger-text": palette.dangerText,
    "--ops-warning-soft": palette.warningSoft,
    "--ops-danger-soft": palette.dangerSoft,
    "--ops-focus-ring": palette.focusRing,
    "--ops-shadow-card": palette.shadowCard,
    "--ops-shadow-floating": palette.shadowFloating,
    "--ops-shadow-dialog": palette.shadowDialog,
    "--ops-ink-rgb": palette.inkRgb,
    "--personal-preview-accent": personalAccent(
      mode,
      preferences.accent,
    ).primary,
    ...Object.fromEntries(
      PALETTE_KEYS.map((key) => [cssVarNameOf(key), semantic[key]]),
    ),
  } as CSSProperties;
  return (
    <section
      className={`hn-personal-card hn-personal-preview${dark ? " is-dark" : ""}`}
      style={{ ...previewTokens, colorScheme: dark ? "dark" : "light" }}
      data-preview-theme={mode}
      data-testid="profile-preference-preview"
      data-font-size={preferences.font_size}
      data-density={preferences.density}
      data-reduced-motion={preferences.reduced_motion}
    >
      <h2>{t("auth.personal.preview")}</h2>
      <p className="hn-personal-muted">{t("auth.personal.previewSample")}</p>
      <UiTextField
        label={t("auth.personal.previewCode")}
        value="PN-000123"
        fullWidth
        slotProps={{ htmlInput: { readOnly: true } }}
      />
      <div className="hn-personal-preview-toolbar">
        <button type="button" tabIndex={-1} aria-hidden="true" disabled>
          {t("auth.personal.save")}
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>{t("auth.personal.previewCode")}</th>
            <th>{t("auth.personal.previewStatus")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>PN-000123</td>
            <td>
              <span className="hn-personal-sample-success">
                {t("auth.personal.previewComplete")}
              </span>
            </td>
          </tr>
          <tr>
            <td>PN-000124</td>
            <td>
              <span className="hn-personal-sample-warning">
                {t("auth.personal.previewPending")}
              </span>
            </td>
          </tr>
          <tr>
            <td>PN-000125</td>
            <td>
              <span className="hn-personal-sample-error">
                {t("auth.personal.previewError")}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
