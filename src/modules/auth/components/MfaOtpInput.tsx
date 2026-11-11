import {
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Box, UiTextField } from "@/shared/ui";
import { AUTH_BASELINE } from "@/shared/ui/tokens";

export const MFA_OTP_LENGTH = 6;

/** Keep the existing MFA input, paste, recovery-code and keyboard behaviours. */
export function MfaOtpInput({
  digits,
  onChange,
  disabled,
  label,
}: {
  digits: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  label: string;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const writeDigits = (startIndex: number, rawValue: string) => {
    const numeric = rawValue.replace(/\D/g, "");
    const next = [...digits];
    if (numeric === "") {
      next[startIndex] = "";
      onChange(next);
      return;
    }
    const chunk = numeric.slice(0, MFA_OTP_LENGTH - startIndex);
    chunk.split("").forEach((digit, offset) => {
      next[startIndex + offset] = digit;
    });
    onChange(next);
    inputRefs.current[
      Math.min(startIndex + chunk.length, MFA_OTP_LENGTH - 1)
    ]?.focus();
  };
  const handleChange = (
    index: number,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    writeDigits(index, event.target.value);
  };
  const handlePaste = (index: number, event: ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!/\d/.test(pasted)) return;
    event.preventDefault();
    writeDigits(index, pasted);
  };
  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Backspace" && digits[index] === "" && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      onChange(next);
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < MFA_OTP_LENGTH - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };
  return (
    <Box
      component="fieldset"
      sx={{ minWidth: 0, margin: 0, padding: 0, border: 0 }}
    >
      <Box
        component="legend"
        sx={{
          marginBottom: "8px",
          padding: 0,
          color: AUTH_BASELINE.ink,
          fontSize: { xs: 14, sm: 15 },
          fontWeight: 700,
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: "6px", sm: "8px" },
        }}
      >
        {digits.map((digit, index) => (
          <UiTextField
            key={index}
            value={digit}
            inputRef={(node) => {
              inputRefs.current[index] = node;
            }}
            onChange={(event) => handleChange(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            autoFocus={index === 0}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            disabled={disabled}
            slotProps={{
              htmlInput: {
                maxLength: 1,
                pattern: "[0-9]*",
                "aria-label": `${label} ${index + 1}`,
              },
            }}
            sx={{
              width: { xs: 40, sm: 48 },
              flex: "0 0 auto",
              "& .MuiOutlinedInput-root": {
                minHeight: { xs: 44, sm: 48 },
                borderRadius: "8px",
              },
              "& .MuiInputBase-input": {
                boxSizing: "border-box",
                height: { xs: 44, sm: 48 },
                padding: "0 !important",
                textAlign: "center",
                fontSize: { xs: 18, sm: 20 },
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
