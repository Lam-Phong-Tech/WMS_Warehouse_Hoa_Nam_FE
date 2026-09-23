import dayjs from "dayjs";
import type { ReactNode } from "react";
import { UiDatePicker } from "@/shared/ui/forms/UiDatePicker";

export interface IamDateFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  min?: string;
  max?: string;
}

function parseIsoDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = dayjs(value);
  return date.isValid() && date.format("YYYY-MM-DD") === value ? date : null;
}

// Keep the popup inside the active dialog's focus boundary. The dialog paper
// owns this portal, outside its scrolling content so the calendar is not clipped.
function popupContainer(trigger: HTMLElement) {
  return trigger.closest<HTMLElement>('[role="dialog"]') ?? document.body;
}

/** Present an editable calendar while preserving IAM's existing ISO date contract. */
export function IamDateField({
  id,
  label,
  value,
  onChange,
  disabled = false,
  error = false,
  helperText,
  min,
  max,
}: IamDateFieldProps) {
  const helperId = helperText ? `${id}-helper-text` : undefined;

  return (
    <div
      className={`hn-iam-date-field${error ? " is-error" : ""}${disabled ? " is-disabled" : ""}`}
    >
      <label className="hn-iam-date-label" htmlFor={id}>
        {label}
      </label>
      <UiDatePicker
        id={id}
        value={parseIsoDate(value)}
        onChange={(next) => onChange(next?.format("YYYY-MM-DD") ?? "")}
        format="DD/MM/YYYY"
        placeholder="DD/MM/YYYY"
        minDate={parseIsoDate(min)}
        maxDate={parseIsoDate(max)}
        disabled={disabled}
        status={error ? "error" : undefined}
        aria-label={label}
        aria-describedby={helperId}
        aria-invalid={error || undefined}
        popupClassName="hn-iam-date-popover"
        popupAlign={{
          overflow: {
            adjustX: true,
            adjustY: true,
            shiftX: true,
            shiftY: true,
          },
        }}
        getPopupContainer={popupContainer}
      />
      {helperText ? (
        <p id={helperId} className="hn-iam-date-help">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
