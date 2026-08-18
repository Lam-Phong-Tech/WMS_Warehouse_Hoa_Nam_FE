import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  UI_STATE,
  UI_STATE_ORDER,
  UI_STATE_SELECTOR,
  uiStateProps,
  uiStateTestId,
} from "./ui-state";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { ErrorState } from "@/shared/components/ui-states/ErrorState";
import { PageSkeleton } from "@/shared/components/ui-states/PageSkeleton";
import { NoPermissionState } from "@/shared/components/feedback/NoPermissionState";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { SubmitButton } from "@/shared/components/forms/SubmitButton";

/**
 * WWHN-268 · FE268-D01 — hợp đồng trạng thái UI.
 *
 * Bằng chứng QA2 theo từng trạng thái (loading/empty/error/success/disabled/
 * confirm/permission-denied) chỉ tái lập được khi mỗi surface phát ra một
 * selector ổn định. Test này khoá hợp đồng đó lại để không tái phát.
 */
describe("WWHN-268 UI state contract", () => {
  it("phủ đúng 7 trạng thái theo Annex D và không trùng key", () => {
    expect(UI_STATE_ORDER).toHaveLength(7);
    expect(new Set(UI_STATE_ORDER).size).toBe(7);
    expect(UI_STATE_ORDER).toEqual([
      "loading",
      "empty",
      "error",
      "success",
      "disabled",
      "confirm",
      "permission-denied",
    ]);
  });

  it("mọi trạng thái đều có selector và testid xác định", () => {
    for (const state of UI_STATE_ORDER) {
      expect(UI_STATE_SELECTOR[state]).toBeTruthy();
      expect(uiStateTestId(state)).toBe(`ui-state-${state}`);
    }
  });

  it("uiStateProps phát đồng thời data-ui-state và data-testid", () => {
    expect(uiStateProps(UI_STATE.EMPTY)).toEqual({
      "data-ui-state": "empty",
      "data-testid": "ui-state-empty",
    });
    expect(uiStateProps(UI_STATE.LOADING, "custom-id")).toEqual({
      "data-ui-state": "loading",
      "data-testid": "custom-id",
    });
  });

  it("LoadingState / PageSkeleton phát trạng thái loading", () => {
    const { container, rerender } = render(<LoadingState />);
    expect(
      container.querySelector(UI_STATE_SELECTOR[UI_STATE.LOADING]),
    ).not.toBeNull();

    rerender(<PageSkeleton />);
    expect(
      container.querySelector(UI_STATE_SELECTOR[UI_STATE.LOADING]),
    ).not.toBeNull();
  });

  it("EmptyState phát trạng thái empty", () => {
    const { container } = render(<EmptyState />);
    expect(
      container.querySelector(UI_STATE_SELECTOR[UI_STATE.EMPTY]),
    ).not.toBeNull();
  });

  it("ErrorState và ApiErrorAlert phát trạng thái error", () => {
    const { container } = render(<ErrorState />);
    expect(
      container.querySelector(UI_STATE_SELECTOR[UI_STATE.ERROR]),
    ).not.toBeNull();

    const alert = render(<ApiErrorAlert error={{ message: "Lỗi máy chủ" }} />);
    expect(
      alert.container.querySelector(UI_STATE_SELECTOR[UI_STATE.ERROR]),
    ).not.toBeNull();
  });

  it("NoPermissionState phát trạng thái permission-denied", () => {
    const { container } = render(
      <MemoryRouter>
        <NoPermissionState />
      </MemoryRouter>,
    );
    expect(
      container.querySelector(UI_STATE_SELECTOR[UI_STATE.PERMISSION_DENIED]),
    ).not.toBeNull();
  });

  it("SubmitButton chỉ phát trạng thái disabled khi thật sự bị chặn", () => {
    const enabled = render(<SubmitButton />);
    expect(
      enabled.container.querySelector(UI_STATE_SELECTOR[UI_STATE.DISABLED]),
    ).toBeNull();
    enabled.unmount();

    const blocked = render(<SubmitButton disabled />);
    expect(
      blocked.container.querySelector(UI_STATE_SELECTOR[UI_STATE.DISABLED]),
    ).not.toBeNull();
    expect(screen.getByTestId("ui-state-disabled")).toBeDisabled();
  });
});
