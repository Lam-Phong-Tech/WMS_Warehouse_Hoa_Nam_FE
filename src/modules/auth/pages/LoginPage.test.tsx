import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { LoginPage } from "./LoginPage";
import { rememberLoginThrottle } from "../utils/login-feedback";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { useThemeStore } from "@/shared/ui/theme/theme.store";
describe("LoginPage — TC_UI_LOGIN_01/02", () => {
  beforeEach(() => {
    localStorage.clear();
    rememberLoginThrottle(null);
    useLanguageStore.getState().setLanguage("vi");
    useThemeStore.getState().setPreference("light");
  });
  it("renders the canonical login form and filled access shield", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole("heading")).toHaveAttribute("id", "login-title");
    expect(screen.getByRole("button", { name: /đăng nhập/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /tên đăng nhập/i })).toBeInTheDocument();
    expect(screen.getByTestId("auth-access-shield").querySelector("path")).toHaveAttribute("fill", "#9DDDF2");
  });
  it("validates both empty fields", async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    expect(await screen.findByText(/vui lòng nhập tên đăng nhập/i)).toBeInTheDocument();
    expect(await screen.findByText(/vui lòng nhập mật khẩu/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Tên đăng nhập")).toHaveAttribute("aria-invalid", "true");
  });
  it("validates email only when the identifier contains @", async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "not-an-email@");
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    expect(await screen.findByText(/định dạng email không hợp lệ/i)).toBeInTheDocument();
  });
  it("opens a language menu and allows Chinese selection", async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Ngôn ngữ" }));
    expect(screen.getByRole("menuitemradio", { name: "Tiếng Việt" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "English" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "简体中文" }));
    expect(useLanguageStore.getState().language).toBe("zh");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("switches the login shell to the dark palette", async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Bật giao diện tối" }));
    expect(useThemeStore.getState().mode).toBe("dark");
    expect(screen.getByRole("main")).toHaveStyle("--auth-panel: #102544");
    expect(screen.getByRole("button", { name: "Bật giao diện sáng" })).toBeInTheDocument();
  });
});
