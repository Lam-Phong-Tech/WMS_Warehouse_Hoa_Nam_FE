import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { DownOutlined } from "@/shared/components/icons";

/** Select-only combobox. Its absolutely positioned list never changes page geometry. */
export function SelectControl<T extends string>({
  ariaLabel,
  value,
  options,
  icon,
  disabled = false,
  readonly = false,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  icon: ReactNode;
  disabled?: boolean;
  readonly?: boolean;
  onChange: (value: T) => void;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const typing = useRef({ text: "", at: 0 });
  const selected = options.findIndex((option) => option.value === value);
  const active = Math.max(0, Math.min(highlighted, options.length - 1));
  const expanded = open && !disabled && !readonly && options.length > 0;
  const current = options[selected];

  const show = () => {
    if (disabled || readonly || options.length === 0) return;
    setHighlighted(Math.max(0, selected));
    setOpen(true);
  };
  const choose = (index: number) => {
    if (!expanded || !options[index]) return;
    onChange(options[index].value);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const menu = menuRef.current;
    const option = menu?.children[active] as HTMLElement | undefined;
    if (!menu || !option) return;
    // Scroll only the options, not the document or its report container.
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < menu.scrollTop) menu.scrollTop = top;
    else if (bottom > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = bottom - menu.clientHeight;
    }
  }, [expanded, active]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || readonly || options.length === 0) return;
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "Escape") {
      if (expanded) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!expanded) show();
      else if (event.key === "ArrowDown")
        setHighlighted(Math.min(active + 1, options.length - 1));
      else if (event.key === "ArrowUp") setHighlighted(Math.max(active - 1, 0));
      if (event.key === "Home") setHighlighted(0);
      if (event.key === "End") setHighlighted(options.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (expanded) choose(active);
      else show();
      return;
    }
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const now = Date.now();
      const text =
        (now - typing.current.at < 650 ? typing.current.text : "") + event.key;
      typing.current = { text, at: now };
      const normalize = (s: string) =>
        s
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLocaleLowerCase();
      const index = options.findIndex((option) =>
        normalize(option.label).startsWith(normalize(text)),
      );
      if (index >= 0) {
        event.preventDefault();
        setHighlighted(index);
        setOpen(true);
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className={
        "rpt08-select" +
        (expanded ? " is-open" : "") +
        (readonly ? " is-readonly" : "")
      }
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="rpt08-select__button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={`${id}-listbox`}
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-readonly={readonly || undefined}
        aria-activedescendant={expanded ? `${id}-option-${active}` : undefined}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onClick={() => {
          if (expanded) setOpen(false);
          else show();
        }}
      >
        <span className="rpt08-select__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="rpt08-select__value">{current?.label ?? "—"}</span>
        {!readonly ? <DownOutlined className="rpt08-select__chevron" /> : null}
      </button>
      <div
        ref={menuRef}
        id={`${id}-listbox`}
        className="rpt08-select__menu"
        role="listbox"
        aria-label={ariaLabel}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            id={`${id}-option-${index}`}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={option.value === value}
            className={
              (option.value === value ? "is-selected" : "") +
              (index === active ? " is-highlighted" : "")
            }
            onMouseDown={(event) => event.preventDefault()}
            onPointerMove={() => setHighlighted(index)}
            onClick={() => choose(index)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
