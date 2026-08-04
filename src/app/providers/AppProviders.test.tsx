import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./AppProviders";

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
});
