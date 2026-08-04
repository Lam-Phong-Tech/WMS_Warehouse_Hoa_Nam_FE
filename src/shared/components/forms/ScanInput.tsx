import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Typography } from "antd";
import type { InputRef } from "antd";
import { BarcodeOutlined } from "@ant-design/icons";

export interface ScanInputProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: "small" | "middle" | "large";
  recentCodes?: string[];
  duplicateMessage?: string;
  error?: string | null;
  onChange?: (value: string) => void;
  onScan: (code: string) => void;
}

function normalizeScanCode(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Shared barcode/QR/manual scan field. It keeps scanner focus stable and blocks
 * accidental duplicate submits before the page-specific handler runs.
 */
export function ScanInput({
  value,
  placeholder = "Scan/nhập mã...",
  disabled = false,
  autoFocus = true,
  size = "large",
  recentCodes = [],
  duplicateMessage = "Mã này vừa được scan",
  error,
  onChange,
  onScan,
}: ScanInputProps) {
  const inputRef = useRef<InputRef>(null);
  const [innerValue, setInnerValue] = useState(value ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : innerValue;

  const recentCodeSet = useMemo(
    () => new Set(recentCodes.map(normalizeScanCode)),
    [recentCodes],
  );

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRef.current?.focus();
    }
  }, [autoFocus, disabled]);

  const setValue = (next: string) => {
    setLocalError(null);
    if (!controlled) setInnerValue(next);
    onChange?.(next);
  };

  const submit = (rawValue: string) => {
    const code = normalizeScanCode(rawValue);
    if (!code) {
      setLocalError("Vui lòng scan hoặc nhập mã");
      inputRef.current?.focus();
      return;
    }

    if (recentCodeSet.has(code)) {
      setLocalError(duplicateMessage);
      inputRef.current?.focus();
      return;
    }

    setLocalError(null);
    onScan(code);
    if (!controlled) setInnerValue("");
    onChange?.("");
    inputRef.current?.focus();
  };

  const helpText = error ?? localError;

  return (
    <div>
      <Input
        ref={inputRef}
        aria-label="Scan code"
        value={currentValue}
        placeholder={placeholder}
        disabled={disabled}
        size={size}
        prefix={<BarcodeOutlined aria-hidden="true" />}
        suffix={
          <Button
            type="primary"
            size={size}
            disabled={disabled}
            onClick={() => submit(currentValue)}
          >
            Scan
          </Button>
        }
        status={helpText ? "error" : undefined}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit(currentValue);
          }
        }}
      />
      {helpText && (
        <Typography.Text
          type="danger"
          role="alert"
          style={{ display: "block", marginTop: 6 }}
        >
          {helpText}
        </Typography.Text>
      )}
    </div>
  );
}
