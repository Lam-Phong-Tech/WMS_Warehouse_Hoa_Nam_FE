import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useLanguageStore } from "./language.store";

const loading = vi.hoisted(() => ({
  messages: null as Record<string, string> | null,
  status: "idle" as "idle" | "loading" | "ready" | "error",
  ensure: vi.fn(() => Promise.resolve()),
}));
const chineseLoading = vi.hoisted(() => ({
  messages: null as Record<string, string> | null,
  status: "idle" as "idle" | "loading" | "ready" | "error",
  ensure: vi.fn(() => Promise.resolve()),
}));

vi.mock("./english-messages", () => ({
  useEnglishMessages: () => loading.messages,
  useEnglishMessagesStatus: () => loading.status,
  ensureEnglishMessages: loading.ensure,
}));
vi.mock("./chinese-messages", () => ({
  useChineseMessages: () => chineseLoading.messages,
  useChineseMessagesStatus: () => chineseLoading.status,
  ensureChineseMessages: chineseLoading.ensure,
}));

import { EnglishLanguageBoundary } from "./EnglishLanguageBoundary";

function content() {
  return (
    <EnglishLanguageBoundary>
      <div data-testid="protected-page">Page content</div>
    </EnglishLanguageBoundary>
  );
}

describe("English language bootstrap", () => {
  beforeEach(() => {
    loading.messages = null;
    loading.status = "idle";
    loading.ensure.mockClear();
    chineseLoading.messages = null;
    chineseLoading.status = "idle";
    chineseLoading.ensure.mockClear();
    useLanguageStore.setState({ language: "vi" });
  });

  afterEach(() => {
    cleanup();
    useLanguageStore.setState({ language: "vi" });
    document.documentElement.lang = "vi";
  });

  it("does not download or block the default Vietnamese interface", () => {
    render(content());
    expect(screen.getByTestId("protected-page")).toBeInTheDocument();
    expect(loading.ensure).not.toHaveBeenCalled();
  });

  it("waits for English before mounting screens with render-time labels", () => {
    useLanguageStore.setState({ language: "en" });
    const view = render(content());
    expect(screen.getByRole("status")).toHaveTextContent("Loading English");
    expect(screen.queryByTestId("protected-page")).not.toBeInTheDocument();
    expect(loading.ensure).toHaveBeenCalledTimes(1);

    loading.status = "loading";
    view.rerender(content());
    expect(loading.ensure).toHaveBeenCalledTimes(1);

    loading.messages = { loaded: "ready" };
    loading.status = "ready";
    view.rerender(content());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("protected-page")).toBeInTheDocument();
  });

  it("shows a retryable English error rather than silently mixing languages", () => {
    useLanguageStore.setState({ language: "en" });
    loading.status = "error";
    render(content());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load English",
    );
    expect(screen.queryByTestId("protected-page")).not.toBeInTheDocument();
    expect(loading.ensure).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(loading.ensure).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(useLanguageStore.getState().language).toBe("vi");
    expect(screen.getByTestId("protected-page")).toBeInTheDocument();
  });

  it("waits for Simplified Chinese and can retry its download", () => {
    useLanguageStore.setState({ language: "zh" });
    chineseLoading.status = "error";
    const view = render(content());
    expect(screen.getByRole("alert")).toHaveTextContent("无法加载简体中文");
    expect(screen.queryByTestId("protected-page")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(chineseLoading.ensure).toHaveBeenCalledTimes(1);
    chineseLoading.messages = { loaded: "ready" };
    chineseLoading.status = "ready";
    view.rerender(content());
    expect(screen.getByTestId("protected-page")).toBeInTheDocument();
  });
});
