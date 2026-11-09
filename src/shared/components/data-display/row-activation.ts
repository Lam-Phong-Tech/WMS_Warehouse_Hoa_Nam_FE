import type { HTMLAttributes, KeyboardEvent, MouseEvent } from "react";

const NESTED_CONTROL_SELECTOR =
  "a, button, input, select, textarea, [role='button'], [contenteditable='true']";

type RowActivationProps<T extends HTMLElement> = Pick<
  HTMLAttributes<T>,
  "onClick" | "onKeyDown" | "tabIndex"
> & { "data-clickable"?: "true" };

export function isNestedControlTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest(NESTED_CONTROL_SELECTOR))
  );
}

/**
 * Makes a table row (or mobile list card) activate on a normal click, Enter or
 * Space while leaving nested links/buttons/fields to handle their own
 * interaction.
 */
export function rowActivationProps<
  T extends HTMLElement = HTMLTableRowElement,
>(
  onActivate: () => void,
  enabled = true,
): RowActivationProps<T> {
  if (!enabled) return {};
  return {
    "data-clickable": "true",
    tabIndex: 0,
    onClick: (event: MouseEvent<T>) => {
      if (isNestedControlTarget(event.target)) return;
      onActivate();
    },
    onKeyDown: (event: KeyboardEvent<T>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
