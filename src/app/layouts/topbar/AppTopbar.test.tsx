import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shortcutPreferences = {
  version: 1,
  locale: "vi",
  timezone: "Asia/Ho_Chi_Minh",
  date_format: "DD/MM/YYYY",
  default_homepage: "dashboard",
  theme: "light",
  accent: "ocean",
  font_size: "medium",
  density: "comfortable",
  reduced_motion: false,
  notifications: { account: { in_app: true, email: false } },
};
vi.mock("@/modules/auth/services/profile.service", () => ({
  profileService: {
    getPreferences: vi.fn(async () => ({ ...shortcutPreferences })),
    updatePreferences: vi.fn(
      async (changes: Record<string, unknown>, version: number) => ({
        ...shortcutPreferences,
        ...changes,
        version: version + 1,
      }),
    ),
    getAvatar: vi.fn(),
  },
}));
const markAllRead = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));

vi.mock("@/modules/notifications/hooks/useNotifications", () => ({
  useMarkAllNotificationsRead: () => markAllRead,
  useUnreadCountQuery: vi.fn(),
  useNotificationsQuery: () => ({
    data: { data: [] },
    isLoading: false,
    isError: false,
  }),
}));

import { AppTopbar } from "./AppTopbar";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { useThemeStore } from "@/shared/ui/theme/theme.store";
import { useNotificationStore } from "@/shared/store/notification.store";
import { MESSAGES_VI } from "@/shared/i18n/messages";
import { MESSAGES_EN } from "@/shared/i18n/messages.en";

/**
 * Topbar là thứ hiện trên MỌI màn nên test ở đây khoá đúng những điều dễ vỡ:
 * các điều khiển còn lại, tìm kiếm chỉ gợi ý màn người dùng CÓ QUYỀN, và hai
 * công tắc Ngôn ngữ / Giao diện phải đổi thật chứ không chỉ đổi hình.
 */

function renderTopbar(isDashboard = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[isDashboard ? "/dashboard" : "/master-data/skus"]}
      >
        <AppTopbar
          showMenuButton={false}
          onOpenMenu={() => {}}
          isDashboard={isDashboard}
        />
        <CurrentPath />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function CurrentPath() {
  const location = useLocation();
  return (
    <span data-testid="current-path" hidden>
      {location.pathname}
      {location.search}
    </span>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  markAllRead.isPending = false;
  useNotificationStore.getState().reset();
  useAuthStore.setState({
    isProfileLoaded: true,
    isSuperAdmin: true,
    permissionCodes: [],
    isAuthenticated: true,
    token: "test-topbar-token",
    profile: null,
    user: {
      id: "topbar-user",
      user_id: "topbar-user",
      name: "Super Admin",
    } as never,
  });
});

afterEach(() => {
  cleanup();
  useLanguageStore.setState({ language: "vi" });
  useThemeStore.setState({ preference: "light", mode: "light" });
  localStorage.clear();
});

describe("AppTopbar", () => {
  it("không lặp tên và vai trò trong menu khi thanh trên đã hiển thị", () => {
    renderTopbar();
    const accountButton = screen.getByRole("button", {
      name: /Tài khoản Super Admin/,
    });
    expect(accountButton).toHaveTextContent("Super Admin");
    fireEvent.click(accountButton);

    const menu = screen.getByRole("menu", { name: "Tài khoản" });
    expect(within(menu).queryByText("Super Admin")).not.toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Thông tin tài khoản", "Đổi mật khẩu"]);
    expect(
      within(menu).getByRole("button", { name: "Đăng xuất" }),
    ).toBeInTheDocument();
    expect(
      within(menu).queryByText("Người dùng & phân quyền"),
    ).not.toBeInTheDocument();
    expect(within(menu).queryByText("Cấu hình kho")).not.toBeInTheDocument();
    expect(
      within(menu).queryByText("Nhật ký hoạt động"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Đổi mật khẩu" }),
    );
    expect(screen.getByTestId("current-path")).toHaveTextContent(
      "/profile?section=security",
    );
    expect(
      screen.queryByRole("menu", { name: "Tài khoản" }),
    ).not.toBeInTheDocument();
  });

  it("hiển thị menu ngôn ngữ gọn như mẫu với đúng lựa chọn đang dùng", async () => {
    useLanguageStore.getState().setLanguage("en");
    renderTopbar();

    const trigger = await screen.findByRole("button", { name: "Language" });
    expect(trigger).toHaveTextContent("EN");
    fireEvent.click(trigger);

    const menu = screen.getByRole("menu", { name: "Language" });
    const options = within(menu).getAllByRole("menuitemradio");
    expect(options).toHaveLength(3);
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      "Tiếng Việt",
      "English",
      "简体中文",
    ]);
    expect(
      within(menu).getByRole("menuitemradio", { name: "English" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(menu).queryByText("Vietnamese is the default"),
    ).not.toBeInTheDocument();
  });

  it("hiện breadcrumb và các điều khiển cần dùng, không hiện lối tắt", () => {
    renderTopbar();
    expect(
      screen.getByPlaceholderText("Tìm kiếm chức năng"),
    ).toBeInTheDocument();
    for (const label of ["Ngôn ngữ", "Giao diện", "Thông báo"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: /Tài khoản Super Admin/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lối tắt nghiệp vụ" }),
    ).not.toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Danh mục");
    expect(breadcrumb).toHaveTextContent("Danh sách SKU");
  });

  it("giữ kiểu thanh tổng quan riêng", () => {
    const { container } = renderTopbar(true);
    expect(container.querySelector(".hn-topbar-content")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lối tắt nghiệp vụ" }),
    ).not.toBeInTheDocument();
  });

  it("neo chấm trạng thái vào avatar, không vào toàn bộ nút tài khoản", () => {
    const { container } = renderTopbar();
    const accountButton = screen.getByRole("button", {
      name: /Tài khoản Super Admin/,
    });
    const avatarStatus = accountButton.querySelector(".avatar-status");
    const presenceDot = accountButton.querySelector(".presence-dot");

    expect(avatarStatus).not.toBeNull();
    expect(avatarStatus?.querySelector(".avatar")).not.toBeNull();
    expect(presenceDot).not.toBeNull();
    expect(presenceDot?.parentElement).toBe(avatarStatus);
    expect(
      container.querySelector(".topbar-profile-summary .presence-dot"),
    ).toBeNull();
  });

  it("tìm kiếm chỉ gợi ý màn mà người dùng có quyền", () => {
    // Không quyền nào: Tổng quan không đòi quyền nên còn, còn màn quản trị
    // người dùng phải biến mất — gợi ý một màn sẽ ăn 403 là gợi ý sai.
    useAuthStore.setState({ isSuperAdmin: false, permissionCodes: [] });
    renderTopbar();

    fireEvent.focusIn(screen.getByPlaceholderText("Tìm kiếm chức năng"));
    expect(screen.getByText("Tổng quan vận hành")).toBeInTheDocument();
    expect(
      screen.queryByText("Danh sách người dùng & phân quyền"),
    ).not.toBeInTheDocument();
  });

  it("gõ không dấu vẫn ra kết quả có dấu", () => {
    renderTopbar();
    const input = screen.getByPlaceholderText("Tìm kiếm chức năng");
    fireEvent.focusIn(input);
    fireEvent.change(input, { target: { value: "tong quan" } });
    expect(screen.getByText("Tổng quan vận hành")).toBeInTheDocument();
  });

  it("đổi ngôn ngữ thì đổi chuỗi thật và ghi nhớ lựa chọn", async () => {
    renderTopbar();
    fireEvent.click(screen.getByRole("button", { name: "Ngôn ngữ" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /English/ }));

    // Từ điển EN nạp động nên chuỗi tiếng Anh về SAU một nhịp; trong lúc chờ
    // giao diện giữ tiếng Việt chứ không hiện khoá thô.
    expect(
      await screen.findByPlaceholderText("Search functions"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(useLanguageStore.getState().language).toBe("en"),
    );
    // `persist` của zustand ghi cả bao JSON, không phải chuỗi trần — đọc đúng
    // hình dạng đã lưu để test không xanh giả khi khoá đổi kiểu.
    expect(
      JSON.parse(localStorage.getItem("erp-language") ?? "null")?.state
        ?.language,
    ).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("chọn tiếng Trung và lưu lựa chọn", async () => {
    renderTopbar();
    fireEvent.click(screen.getByRole("button", { name: "Ngôn ngữ" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /简体中文/ }));
    expect(await screen.findByPlaceholderText("搜索功能")).toBeInTheDocument();
    await waitFor(() =>
      expect(useLanguageStore.getState().language).toBe("zh"),
    );
    expect(
      JSON.parse(localStorage.getItem("erp-language") ?? "null")?.state
        ?.language,
    ).toBe("zh");
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it("đổi giao diện thì đặt data-theme và ghi nhớ lựa chọn", async () => {
    renderTopbar();
    fireEvent.click(screen.getByRole("button", { name: "Giao diện" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Tối" }));

    await waitFor(() => expect(useThemeStore.getState().mode).toBe("dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("hoa-nam-theme")).toBe("dark");
  });

  it("icon đánh dấu tất cả đã đọc gọi mutation và giữ bảng thông báo mở", () => {
    useNotificationStore.getState().setUnreadCount(24);
    renderTopbar();
    const notificationButton = screen.getByRole("button", {
      name: "Thông báo, 24",
    });
    expect(
      notificationButton.querySelector(".notification-dot"),
    ).toHaveTextContent("24");
    fireEvent.click(notificationButton);
    const markReadButton = screen.getByRole("menuitem", {
      name: "Đánh dấu tất cả đã đọc",
    });

    expect(markReadButton).toHaveAttribute("title", "Đánh dấu tất cả đã đọc");
    expect(markReadButton).toBeEnabled();
    fireEvent.click(markReadButton);

    expect(markAllRead.mutate).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Thông báo, 24" }),
    ).toHaveAttribute("aria-expanded", "true");
    // The existing mutation updates this shared count after the API succeeds.
    act(() => useNotificationStore.getState().setUnreadCount(0));
    expect(markReadButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Thông báo" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("khóa icon khi không còn thông báo chưa đọc", () => {
    renderTopbar();
    fireEvent.click(screen.getByRole("button", { name: "Thông báo" }));
    const markReadButton = screen.getByRole("menuitem", {
      name: "Đánh dấu tất cả đã đọc",
    });

    expect(markReadButton).toBeDisabled();
    fireEvent.click(markReadButton);
    expect(markAllRead.mutate).not.toHaveBeenCalled();
  });

  it("khóa icon trong khi đang gửi yêu cầu để tránh bấm lặp", () => {
    useNotificationStore.getState().setUnreadCount(3);
    markAllRead.isPending = true;
    renderTopbar();
    fireEvent.click(screen.getByRole("button", { name: "Thông báo, 3" }));
    const markReadButton = screen.getByRole("menuitem", {
      name: "Đánh dấu tất cả đã đọc",
    });

    expect(markReadButton).toBeDisabled();
    expect(markReadButton).toHaveAttribute("aria-busy", "true");
    fireEvent.click(markReadButton);
    expect(markAllRead.mutate).not.toHaveBeenCalled();
  });
});

/**
 * Chỉ soi namespace `topbar` ở đây. Parity toàn bộ từ điển VI/EN (đệ quy, mọi
 * namespace) và phủ khoá cây menu là việc của `src/shared/i18n/i18n.test.ts` —
 * không nhân bản sang đây để khỏi có hai guard lệch nhau.
 */
describe("từ điển topbar", () => {
  it("mọi khoá topbar tiếng Anh đều tồn tại ở bản tiếng Việt", () => {
    const vi: Record<string, string> = MESSAGES_VI.topbar;
    const missing = Object.keys(MESSAGES_EN.topbar ?? {}).filter(
      (key) => !(key in vi),
    );
    expect(missing).toEqual([]);
  });

  it("không bản dịch topbar nào rỗng — chuỗi rỗng còn tệ hơn giữ tiếng Việt", () => {
    const empty = Object.entries(MESSAGES_EN.topbar ?? {})
      .filter(([, value]) => String(value).trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });
});
