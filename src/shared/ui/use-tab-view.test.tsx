import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Suspense } from "react";
import { useTabView } from "./use-tab-view";
import { CoordinatedLoadingBoundary } from "./loading/CoordinatedLoadingBoundary";

afterEach(cleanup);

it("keeps tab controls interactive while the deferred panel is prepared", async () => {
  let ready = false;
  let finish!: () => void;
  const work = new Promise<void>((resolve) => { finish = resolve; });
  function NextPanel() {
    if (!ready) throw work;
    return <p>new-panel</p>;
  }
  function Tabs() {
    const tab = useTabView("first");
    return <>
      <button onClick={() => tab.select("next")}>Next tab</button>
      <span data-testid="selected">{tab.shown}</span>
      <Suspense fallback={<p>panel-pending</p>}>
        {tab.view === "first" ? <p>first-panel</p> : <NextPanel />}
      </Suspense>
    </>;
  }
  const { container } = render(<CoordinatedLoadingBoundary><Tabs /></CoordinatedLoadingBoundary>);
  await waitFor(() => expect(screen.getByText("first-panel")).toBeVisible());
  fireEvent.click(screen.getByText("Next tab"));
  expect(container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "loading");
  expect(screen.getByTestId("selected")).toHaveTextContent("next");
  expect(screen.getByText("first-panel")).toBeVisible();
  expect(screen.getByText("Next tab")).toBeVisible();
  expect(container.querySelector(".hn-loading-boundary__cover")).toBeNull();
  await act(async () => { ready = true; finish(); });
  await waitFor(() => expect(screen.getByText("new-panel")).toBeVisible());
});

it("selecting the already active tab is a no-op", async () => {
  function Tabs() {
    const tab = useTabView("first");
    return <button onClick={() => tab.select("first")}>Same tab</button>;
  }
  const { container } = render(<CoordinatedLoadingBoundary><Tabs /></CoordinatedLoadingBoundary>);
  await waitFor(() => expect(screen.getByText("Same tab")).toBeVisible());
  fireEvent.click(screen.getByText("Same tab"));
  expect(container.querySelector(".hn-loading-boundary")).toHaveAttribute("data-loading-phase", "ready");
});
