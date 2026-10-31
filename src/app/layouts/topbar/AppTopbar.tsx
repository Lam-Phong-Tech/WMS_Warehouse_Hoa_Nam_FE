/**
 * THANH TOPBAR — dựng 1:1 theo demo UI/UX đã chốt
 * `10.WMS_Hoa_Nam_Trang_Tong_Quan.html`: ô tìm kiếm, và 5 điều
 * khiển bên phải (Ngôn ngữ · Giao diện · Lối tắt nghiệp vụ · Thông báo · Tài khoản).
 *
 * KHÁC DEMO: demo chạy trên fixture cứng, ở đây mọi thứ nối vào dữ liệu THẬT —
 * tìm kiếm quét nav-data đã lọc theo RBAC, lối tắt/menu tài khoản điều hướng
 * thật, thông báo đọc từ store thông báo, Đăng xuất gọi đúng mutation đăng xuất.
 * Vì vậy số dòng thông báo và nội dung là thật chứ không phải 3 dòng mẫu.
 *
 * Hành vi bàn phím giữ nguyên demo: Ctrl/⌘ K để nhảy vào ô tìm kiếm, Enter mở
 * kết quả đầu tiên, ↓ chuyển focus xuống danh sách, Esc đóng mọi menu, bấm ra
 * ngoài thì đóng.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UiIcon, VuexyDemoIcon, type VuexyDemoIconName } from "@/shared/ui";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { useNavLabel } from "@/shared/i18n/nav-labels";
import { tStatic, useT } from "@/shared/i18n/useT";
import {
  useThemeStore,
  type ThemePreference,
} from "@/shared/ui/theme/theme.store";
import { getVisibleNavGroups } from "@/app/layouts/nav-data";
import { useNotificationStore } from "@/shared/store/notification.store";
import {
  useMarkAllNotificationsRead,
  useNotificationsQuery,
  useUnreadCountQuery,
} from "@/modules/notifications/hooks/useNotifications";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";
import "./app-topbar.css";

type MenuId =
  | "search"
  | "language"
  | "theme"
  | "shortcut"
  | "notification"
  | "account";

/** Bỏ dấu để gõ "ton kho" vẫn ra "Tồn kho" — đúng cách demo chuẩn hoá. */
function normalize(text: string): string {
  return text.toLocaleLowerCase("vi").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Chữ cái đầu cho avatar, tối đa 2 ký tự — demo hiển thị "SA". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("vi");
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase("vi");
}

/** "22′" / "9d" như demo: phút khi dưới 1 giờ, giờ trong ngày, còn lại là ngày. */
function shortAge(iso: string): string {
  const created = new Date(iso).getTime();
  if (!Number.isFinite(created)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - created) / 60000));
  if (minutes < 60) return `${minutes}′`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const SEVERITY_CLASS: Record<NotificationItem["severity"], string> = {
  critical: "is-danger",
  warning: "is-warning",
  info: "is-info",
};

const SEVERITY_ICON: Record<NotificationItem["severity"], VuexyDemoIconName> = {
  critical: "triangle-alert",
  warning: "briefcase-medical",
  info: "info",
};

/** Sáu ô lối tắt của demo, trỏ vào route THẬT của dự án. */
const SHORTCUTS = [
  {
    route: ROUTES.INBOUND,
    icon: "package-plus",
    tone: "shortcut-inbound",
    titleKey: "topbar.shortcutInbound",
    subKey: "topbar.shortcutInboundSub",
  },
  {
    route: ROUTES.OUTBOUND,
    icon: "package-minus",
    tone: "shortcut-outbound",
    titleKey: "topbar.shortcutOutbound",
    subKey: "topbar.shortcutOutboundSub",
  },
  {
    route: ROUTES.REPORTS_STOCK_RECONCILE,
    icon: "warehouse",
    tone: "shortcut-stock",
    titleKey: "topbar.shortcutReconcile",
    subKey: "topbar.shortcutReconcileSub",
  },
  {
    route: ROUTES.WARRANTY,
    icon: "briefcase-medical",
    tone: "shortcut-warranty",
    titleKey: "topbar.shortcutWarranty",
    subKey: "topbar.shortcutWarrantySub",
  },
  {
    route: ROUTES.INVENTORY,
    icon: "package-search",
    tone: "",
    titleKey: "topbar.shortcutInventory",
    subKey: "topbar.shortcutInventorySub",
  },
  {
    route: ROUTES.REPORTS_IMPORT_QUALITY,
    icon: "chart-column-big",
    tone: "",
    titleKey: "topbar.shortcutReport",
    subKey: "topbar.shortcutReportSub",
  },
] as const;

export function AppTopbar({
  showMenuButton,
  onOpenMenu,
}: {
  showMenuButton: boolean;
  onOpenMenu: () => void;
}) {
  const navigate = useNavigate();
  const t = useT();
  const navLabel = useNavLabel();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const themePreference = useThemeStore((state) => state.preference);
  const themeMode = useThemeStore((state) => state.mode);
  const setThemePreference = useThemeStore((state) => state.setPreference);

  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useLogout();

  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchResultsRef = useRef<HTMLDivElement | null>(null);
  const topbarRef = useRef<HTMLElement | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);

  const rawUnread = useNotificationStore((state) => state.unreadCount);
  const unreadCount = Number.isFinite(rawUnread) ? rawUnread : 0;
  useUnreadCountQuery(isAuthenticated);
  // Danh sách 5 thông báo chỉ được VẼ bên trong dropdown, nên chỉ gọi khi người
  // dùng mở chuông — trước đây nó là một request trên MỌI lần F5 của MỌI màn,
  // bắn cùng nhịp với các request dữ liệu của trang.
  const notifications = useNotificationsQuery(
    { per_page: 5 },
    { enabled: openMenu === "notification" },
  );
  const markAllRead = useMarkAllNotificationsRead();
  const notificationItems = Array.isArray(notifications.data?.data)
    ? notifications.data.data
    : [];

  const displayName =
    profile?.name ??
    user?.name ??
    user?.code ??
    user?.email ??
    t("shared.user.fallbackName");
  const initials = initialsOf(displayName);
  const roleLabel = isSuperAdmin
    ? t("topbar.accountRoleSuperAdmin")
    : t("topbar.accountRoleUser");
  const scopeLabel = [
    profile?.position?.name,
    profile?.department?.name,
    profile?.branch?.name ?? profile?.company?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  /**
   * Nguồn tìm kiếm là chính cây điều hướng ĐÃ LỌC THEO QUYỀN — không bao giờ
   * gợi ý một màn mà người dùng mở ra sẽ ăn 403.
   */
  const searchEntries = useMemo(() => {
    return getVisibleNavGroups(permissionCodes, isSuperAdmin).flatMap((group) =>
      group.items.map((item) => {
        const label = navLabel(item.screen, item.label);
        const groupLabel = navLabel(group.icon, group.name);
        return {
          label,
          group: groupLabel,
          route: item.path,
          // Gõ tiếng Việt KHÔNG DẤU vẫn ra kết quả kể cả khi giao diện đang là
          // tiếng Anh: chuỗi tra gộp cả nhãn gốc lẫn nhãn đã dịch.
          haystack: normalize(
            `${label} ${groupLabel} ${item.label} ${group.name} ${item.path}`,
          ),
        };
      }),
    );
  }, [permissionCodes, isSuperAdmin, navLabel]);

  const matches = useMemo(() => {
    const needle = normalize(query.trim());
    return searchEntries
      .filter((entry) => !needle || entry.haystack.includes(needle))
      .slice(0, 6);
  }, [searchEntries, query]);

  const announce = (message: string) => {
    if (liveRef.current) liveRef.current.textContent = message;
  };

  const closeMenus = () => setOpenMenu(null);

  const go = (route: string) => {
    closeMenus();
    navigate(route);
  };

  // Bấm ra ngoài đóng menu; Esc đóng menu; Ctrl/⌘ K nhảy vào ô tìm kiếm.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!topbarRef.current?.contains(event.target as Node)) closeMenus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLocaleLowerCase() === "k"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setOpenMenu("search");
        return;
      }
      if (event.key === "Escape") {
        searchInputRef.current?.blur();
        closeMenus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const toggleMenu = (id: MenuId) =>
    setOpenMenu((current) => (current === id ? null : id));

  const chooseLanguage = (next: "vi" | "en") => {
    setLanguage(next);
    closeMenus();
    // tStatic (không phải `t` của closure): đọc NGÔN NGỮ VỪA CHỌN từ store —
    // vi → "Đã chuyển sang Tiếng Việt", en → bản EN của khoá này.
    announce(tStatic("topbar.languageChanged"));
  };

  const chooseTheme = (next: ThemePreference) => {
    setThemePreference(next);
    closeMenus();
    const name = t(
      next === "light"
        ? "topbar.themeLight"
        : next === "dark"
          ? "topbar.themeDark"
          : "topbar.themeSystem",
    );
    announce(`${t("topbar.themeChanged")} ${name}`);
  };

  const handleLogout = () => {
    closeMenus();
    logout.mutate(undefined, {
      onSuccess: () => toast.success(t("shared.user.logoutSuccess")),
    });
  };

  const renderNotificationBody = () => {
    if (notifications.isLoading)
      return (
        <div className="notification-empty">
          {t("topbar.notificationLoading")}
        </div>
      );
    if (notifications.isError)
      return (
        <div className="notification-empty">
          {t("topbar.notificationError")}
        </div>
      );
    if (notificationItems.length === 0)
      return (
        <div className="notification-empty">
          {t("topbar.notificationEmpty")}
        </div>
      );
    return notificationItems.map((item) => (
      <button
        className="notification-row"
        type="button"
        role="menuitem"
        key={item.id}
        onClick={() => go(ROUTES.NOTIFICATIONS)}
      >
        <span
          className={`notification-icon ${SEVERITY_CLASS[item.severity]}`}
          aria-hidden="true"
        >
          <VuexyDemoIcon name={SEVERITY_ICON[item.severity]} />
        </span>
        <span>
          <strong>{item.title}</strong>
          <small>{item.body}</small>
        </span>
        <time dateTime={item.created_at}>{shortAge(item.created_at)}</time>
      </button>
    ));
  };

  return (
    <header
      className="hn-topbar"
      ref={topbarRef}
      aria-label={t("topbar.searchTitle")}
    >
      {showMenuButton ? (
        <button
          className="icon-button mobile-menu"
          type="button"
          aria-label={t("topbar.menuLabel")}
          data-testid="mobile-nav-toggle"
          onClick={onOpenMenu}
        >
          <VuexyDemoIcon name="menu" />
        </button>
      ) : null}

      <div className="topbar-search-wrap">
        <label
          className="topbar-search"
          htmlFor="global-search"
          onClick={() => searchInputRef.current?.focus()}
        >
          <span className="topbar-search-icon" aria-hidden="true">
            <VuexyDemoIcon name="search" />
          </span>
          <input
            id="global-search"
            ref={searchInputRef}
            type="search"
            autoComplete="off"
            placeholder={t("topbar.searchPlaceholder")}
            aria-label={t("topbar.searchPlaceholder")}
            aria-controls="search-menu"
            aria-expanded={openMenu === "search"}
            value={query}
            onFocus={() => setOpenMenu("search")}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpenMenu("search");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) {
                event.preventDefault();
                searchInputRef.current?.blur();
                go(matches[0].route);
              }
              if (event.key === "ArrowDown") {
                const first =
                  searchResultsRef.current?.querySelector<HTMLButtonElement>(
                    ".search-result",
                  );
                if (first) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
          />
        </label>
        {openMenu === "search" ? (
          <div
            id="search-menu"
            className="header-menu search-menu"
            role="listbox"
            aria-label={t("topbar.searchTitle")}
          >
            <div className="header-menu-heading">
              <strong>{t("topbar.searchTitle")}</strong>
              <span>{t("topbar.searchHint")}</span>
            </div>
            <div className="search-results" ref={searchResultsRef}>
              {matches.length === 0 ? (
                <div className="search-empty">{t("topbar.searchEmpty")}</div>
              ) : (
                matches.map((entry) => (
                  <button
                    className="search-result"
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={entry.route}
                    onClick={() => go(entry.route)}
                  >
                    <span className="search-result-icon" aria-hidden="true">
                      <VuexyDemoIcon name="layout-dashboard" />
                    </span>
                    <span>
                      <strong>{entry.label}</strong>
                      <small>{entry.group}</small>
                    </span>
                    <span className="search-result-arrow" aria-hidden="true">
                      <VuexyDemoIcon name="arrow-right" />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="topbar-actions">
        {/* Ngôn ngữ */}
        <div className="header-control">
          <button
            className="icon-button header-menu-toggle language-toggle"
            type="button"
            aria-expanded={openMenu === "language"}
            aria-controls="language-menu"
            aria-label={t("topbar.languageLabel")}
            title={t("topbar.languageLabel")}
            onClick={() => toggleMenu("language")}
          >
            <span className="toggle-glyph" aria-hidden="true">
              <VuexyDemoIcon name="languages" />
            </span>
            <span className="control-code">{language === "vi" ? "VIE" : "ENG"}</span>
          </button>
          {openMenu === "language" ? (
            <div
              id="language-menu"
              className="header-menu compact-menu"
              role="menu"
            >
              <div className="header-menu-heading">
                <strong>{t("topbar.languageTitle")}</strong>
                <span>{t("topbar.languageHint")}</span>
              </div>
              {(["vi", "en"] as const).map((code) => (
                <button
                  key={code}
                  className={`header-menu-item ${language === code ? "is-active" : ""}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={language === code}
                  onClick={() => chooseLanguage(code)}
                >
                  <span className="language-symbol">{code === "vi" ? "VIE" : "ENG"}</span>
                  <span>
                    <strong>
                      {t(
                        code === "vi"
                          ? "topbar.languageVi"
                          : "topbar.languageEn",
                      )}
                    </strong>
                    <small>
                      {t(
                        code === "vi"
                          ? "topbar.languageViSub"
                          : "topbar.languageEnSub",
                      )}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Giao diện */}
        <div className="header-control">
          <button
            className="icon-button header-menu-toggle"
            type="button"
            aria-expanded={openMenu === "theme"}
            aria-controls="theme-menu"
            aria-label={t("topbar.themeLabel")}
            title={t("topbar.themeLabel")}
            onClick={() => toggleMenu("theme")}
          >
            <span className="toggle-glyph" aria-hidden="true">
              <VuexyDemoIcon name={themeMode === "dark" ? "moon" : "sun"} />
            </span>
          </button>
          {openMenu === "theme" ? (
            <div
              id="theme-menu"
              className="header-menu compact-menu"
              role="menu"
            >
              <div className="header-menu-heading">
                <strong>{t("topbar.themeTitle")}</strong>
                <span>{t("topbar.themeHint")}</span>
              </div>
              {(
                [
                  ["light", "sun", "topbar.themeLight"],
                  ["dark", "moon", "topbar.themeDark"],
                  ["system", "monitor", "topbar.themeSystem"],
                ] as const
              ).map(([value, icon, labelKey]) => (
                <button
                  key={value}
                  className={`header-menu-item ${themePreference === value ? "is-active" : ""}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={themePreference === value}
                  onClick={() => chooseTheme(value)}
                >
                  <span className="menu-item-icon" aria-hidden="true">
                    <VuexyDemoIcon name={icon} />
                  </span>
                  <span>{t(labelKey)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Lối tắt nghiệp vụ */}
        <div className="header-control">
          <button
            className="icon-button header-menu-toggle"
            type="button"
            aria-expanded={openMenu === "shortcut"}
            aria-controls="shortcut-menu"
            aria-label={t("topbar.shortcutLabel")}
            title={t("topbar.shortcutLabel")}
            onClick={() => toggleMenu("shortcut")}
          >
            <span className="toggle-glyph" aria-hidden="true">
              <VuexyDemoIcon name="grid-2x2-plus" />
            </span>
          </button>
          {openMenu === "shortcut" ? (
            <div
              id="shortcut-menu"
              className="header-menu shortcut-menu"
              role="menu"
            >
              <div className="header-menu-heading">
                <strong>{t("topbar.shortcutTitle")}</strong>
                <span>{t("topbar.shortcutHint")}</span>
              </div>
              <div className="shortcut-grid">
                {SHORTCUTS.map((shortcut) => (
                  <button
                    key={shortcut.route}
                    type="button"
                    role="menuitem"
                    onClick={() => go(shortcut.route)}
                  >
                    <span
                      className={`shortcut-icon ${shortcut.tone}`}
                      aria-hidden="true"
                    >
                      <VuexyDemoIcon name={shortcut.icon} />
                    </span>
                    <strong>{t(shortcut.titleKey)}</strong>
                    <small>{t(shortcut.subKey)}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Thông báo */}
        <div className="header-control">
          <button
            className="icon-button header-menu-toggle"
            type="button"
            aria-expanded={openMenu === "notification"}
            aria-controls="notification-menu"
            aria-label={
              unreadCount > 0
                ? `${t("topbar.notificationLabel")}, ${unreadCount}`
                : t("topbar.notificationLabel")
            }
            title={t("topbar.notificationLabel")}
            onClick={() => toggleMenu("notification")}
          >
            <span className="toggle-glyph" aria-hidden="true">
              <VuexyDemoIcon name="bell" />
            </span>
            {unreadCount > 0 ? (
              <span className="notification-dot">{unreadCount}</span>
            ) : null}
          </button>
          {openMenu === "notification" ? (
            <div
              id="notification-menu"
              className="header-menu notification-menu"
              role="menu"
            >
              <div className="header-menu-heading header-menu-heading-row">
                <div>
                  <strong>{t("topbar.notificationTitle")}</strong>
                  <span>{t("topbar.notificationHint")}</span>
                </div>
                <span className="notification-menu-actions">
                  {unreadCount > 0 ? (
                    <span className="chip chip-error">{unreadCount}</span>
                  ) : null}
                  <button
                    className="notification-mark-read"
                    type="button"
                    role="menuitem"
                    aria-label={t("notifications.page.markAll")}
                    title={t("notifications.page.markAll")}
                    aria-busy={markAllRead.isPending}
                    disabled={unreadCount === 0 || markAllRead.isPending}
                    onClick={() => markAllRead.mutate()}
                  >
                    <UiIcon name="check-double" />
                  </button>
                </span>
              </div>
              {renderNotificationBody()}
              <button
                className="header-menu-footer"
                type="button"
                onClick={() => go(ROUTES.NOTIFICATIONS)}
              >
                <span>{t("topbar.notificationAll")}</span>
                <VuexyDemoIcon name="arrow-right" />
              </button>
            </div>
          ) : null}
        </div>

        {/* Tài khoản */}
        <div className="header-control">
          <button
            className="avatar-button header-menu-toggle"
            type="button"
            aria-expanded={openMenu === "account"}
            aria-controls="account-menu"
            aria-label={`${t("topbar.accountLabel")} ${displayName}`}
            onClick={() => toggleMenu("account")}
          >
            <span className="avatar-status" aria-hidden="true">
              <span className="avatar">{initials}</span>
              <span className="presence-dot" />
            </span>
            <span className="topbar-profile-summary" aria-hidden="true">
              <strong>{displayName}</strong>
              <small>{roleLabel}</small>
            </span>
          </button>
          {openMenu === "account" ? (
            <div
              id="account-menu"
              className="header-menu account-menu"
              role="menu"
            >
              <div className="account-summary">
                <span className="avatar avatar-large">{initials}</span>
                <div>
                  <strong>{displayName}</strong>
                  <span>{roleLabel}</span>
                  {scopeLabel ? <small>{scopeLabel}</small> : null}
                </div>
              </div>
              <div className="menu-separator" />
              <button
                className="header-menu-item"
                type="button"
                role="menuitem"
                onClick={() => go(ROUTES.PROFILE)}
              >
                <span className="menu-item-icon" aria-hidden="true">
                  <VuexyDemoIcon name="user-round" />
                </span>
                <span>{t("topbar.accountProfile")}</span>
              </button>
              <button
                className="header-menu-item"
                type="button"
                role="menuitem"
                onClick={() => go(ROUTES.IAM_USERS)}
              >
                <span className="menu-item-icon" aria-hidden="true">
                  <VuexyDemoIcon name="settings-2" />
                </span>
                <span>{t("topbar.accountUsers")}</span>
              </button>
              <button
                className="header-menu-item"
                type="button"
                role="menuitem"
                onClick={() => go(ROUTES.WAREHOUSE_CONFIG)}
              >
                <span className="menu-item-icon" aria-hidden="true">
                  <VuexyDemoIcon name="warehouse" />
                </span>
                <span>{t("topbar.accountWarehouse")}</span>
              </button>
              <button
                className="header-menu-item"
                type="button"
                role="menuitem"
                onClick={() => go(ROUTES.AUDIT_LOGS)}
              >
                <span className="menu-item-icon" aria-hidden="true">
                  <VuexyDemoIcon name="file-clock" />
                </span>
                <span>{t("topbar.accountAudit")}</span>
              </button>
              <div className="menu-separator" />
              <button
                className="logout-button"
                type="button"
                disabled={logout.isPending}
                onClick={handleLogout}
              >
                <VuexyDemoIcon name="log-out" />
                <span>{t("topbar.accountLogout")}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div ref={liveRef} className="sr-only" aria-live="polite" />
    </header>
  );
}
