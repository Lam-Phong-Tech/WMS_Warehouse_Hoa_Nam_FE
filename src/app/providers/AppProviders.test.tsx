import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ToasterProps } from "sonner";
import { AppProviders } from "./AppProviders";

const toasterProps = vi.hoisted(() => ({
  current: null as ToasterProps | null,
}));

vi.mock("sonner", () => ({
  Toaster: (props: ToasterProps) => {
    toasterProps.current = props;
    return null;
  },
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function QueryProbe() {
  const queryClient = useQueryClient();
  return <div>{queryClient ? "Provider ready" : "Provider missing"}</div>;
}

describe("AppProviders", () => {
  it("renders children with shared app contexts", () => {
    render(
      <AppProviders>
        <QueryProbe />
      </AppProviders>,
    );

    expect(screen.getByText("Provider ready")).toBeInTheDocument();
  });

  it("uses one shared, responsive top-right feedback surface", () => {
    render(
      <AppProviders>
        <QueryProbe />
      </AppProviders>,
    );

    expect(toasterProps.current).toMatchObject({
      position: "top-right",
      className: "app-toaster",
      offset: { top: 20, right: 20 },
      mobileOffset: { top: 12, right: 12 },
      visibleToasts: 4,
      closeButton: true,
    });
  });
});
