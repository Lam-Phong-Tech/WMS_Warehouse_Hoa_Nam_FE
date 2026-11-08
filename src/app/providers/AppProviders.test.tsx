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
      offset: { top: 84, right: "clamp(12px, 2.2vw, 32px)" },
      mobileOffset: { top: 74, right: 12 },
      duration: 3000,
      gap: 10,
      expand: true,
      richColors: true,
      swipeDirections: ["right"],
      visibleToasts: 4,
      closeButton: true,
    });
  });
});
