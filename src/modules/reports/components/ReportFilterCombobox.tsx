import { useEffect, useRef, useState } from "react";
import { CheckOutlined } from "@/shared/components/icons";
import { VuexyDemoIcon } from "@/shared/ui";
import { tStatic as tUi } from "@/shared/i18n/useT";
import "./report-filter-combobox.css";
function Icon({ name }: { name: Parameters<typeof VuexyDemoIcon>[0]["name"] }) {
  return <VuexyDemoIcon name={name} />;
}

export type FilterOption = { value: string; label: string };

function normalizedSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi");
}

export function ReportFilterCombobox({
  id,
  value,
  onChange,
  options,
  icon,
  searchPlaceholder,
  ariaLabel,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  icon: Parameters<typeof VuexyDemoIcon>[0]["name"];
  searchPlaceholder: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const current =
    options.find((option) => option.value === value) ?? options[0];
  const needle = normalizedSearch(search.trim());
  const filteredOptions = needle
    ? options.filter((option) =>
        normalizedSearch(option.label).includes(needle),
      )
    : options;

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() =>
      searchRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  const moveOptionFocus = (
    event: React.KeyboardEvent<HTMLElement>,
    direction: 1 | -1,
  ) => {
    event.preventDefault();
    const optionButtons = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>(
        ".inbound-filter-combobox__option:not([disabled])",
      ) ?? [],
    );
    if (optionButtons.length === 0) return;
    const activeIndex = optionButtons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const nextIndex =
      activeIndex < 0
        ? direction > 0
          ? 0
          : optionButtons.length - 1
        : (activeIndex + direction + optionButtons.length) %
          optionButtons.length;
    optionButtons[nextIndex]?.focus();
  };

  return (
    <span
      ref={rootRef}
      className="inbound-filter-combobox"
      data-open={open}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          close();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
          rootRef.current
            ?.querySelector<HTMLButtonElement>("[role=combobox]")
            ?.focus();
        }
      }}
    >
      <span className="inbound-filter-select__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={`${id}-listbox`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className="inbound-filter-combobox__trigger"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{current?.label ?? ""}</span>
        <Icon name="chevron-down" />
      </button>
      <span className="inbound-filter-combobox__menu" aria-hidden={!open}>
        <span className="inbound-filter-combobox__search">
          <Icon name="search" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") moveOptionFocus(event, 1);
              if (event.key === "ArrowUp") moveOptionFocus(event, -1);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            tabIndex={open ? 0 : -1}
          />
          {search ? (
            <button
              type="button"
              aria-label={tUi("updatedUi.text_431466c48cf0")}
              onClick={() => {
                setSearch("");
                searchRef.current?.focus();
              }}
              tabIndex={open ? 0 : -1}
            >
              ×
            </button>
          ) : null}
        </span>
        <span
          id={`${id}-listbox`}
          className="inbound-filter-combobox__options"
          role="listbox"
          aria-label={ariaLabel}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="inbound-filter-combobox__option"
                key={option.value || "all"}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") moveOptionFocus(event, 1);
                  if (event.key === "ArrowUp") moveOptionFocus(event, -1);
                }}
                tabIndex={open ? 0 : -1}
              >
                <span>{option.label}</span>
                {option.value === value ? (
                  <b
                    className="inbound-filter-combobox__check"
                    aria-hidden="true"
                  >
                    <CheckOutlined />
                  </b>
                ) : null}
              </button>
            ))
          ) : (
            <span className="inbound-filter-combobox__empty">
              {tUi("updatedUi.text_8a4f82f9ad45")}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
