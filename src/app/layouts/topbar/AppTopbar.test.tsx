import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
 * đủ 5 điều khiển của demo, tìm kiếm chỉ gợi ý màn người dùng CÓ QUYỀN, và hai
 * công tắc Ngôn ngữ / Giao diện phải đổi thật chứ không chỉ đổi hình.
 */

function renderTopbar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AppTopbar showMenuButton={false} onOpenMenu={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
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
    user: { name: "Super Admin" } as never,
  });
});

afterEach(() => {
  cleanup();
  useLanguageStore.setState({ language: "vi" });
  useThemeStore.setState({ preference: "light", mode: "light" });
  localStorage.clear();
});

describe("AppTopbar", () => {
  it("dựng đủ 5 điều khiển của demo", () => {
    renderTopbar();
    expect(
      screen.getByPlaceholderText("Tìm kiếm chức năng"),
    ).toBeInTheDocument();
    for (const label of [
      "Ngôn ngữ",
      "Giao diện",
      "Lối tắt nghiệp vụ",
      "Thông báo",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: /Tài khoản Super Admin/ }),
    ).toBeInTheDocument();
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
    expect(container.querySelector(".topbar-profile-summary .presence-dot")).toBeNull();
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
    expect(useLanguageStore.getState().language).toBe("en");
    // `persist` của zustand ghi cả bao JSON, không phải chuỗi trần — đọc đúng
    // hình dạng đã lưu để test không xanh giả khi khoá đổi kiểu.
    expect(
      JSON.parse(localStorage.getItem("erp-language") ?? "null")?.state
        ?.language,
    ).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("đổi giao diện thì đặt data-theme và ghi nhớ lựa chọn", () => {
    renderTopbar();
    fireEvent.click(screen.getByRole("button", { name: "Giao diện" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Tối" }));

    expect(useThemeStore.getState().mode).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("hoa-nam-theme")).toBe("dark");
  });

  it("icon đánh dấu tất cả đã đọc gọi mutation và giữ bảng thông báo mở", () => {
    useNotificationStore.getState().setUnreadCount(24);
    renderTopbar();
    fireEvent.click(screen.getByRole("button", { name: "Thông báo, 24" }));
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
