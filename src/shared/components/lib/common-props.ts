import React from "react";

export type Size = "small" | "middle" | "large";

// Common props convention for shared components
export interface CommonProps {
  size?: Size;
  variant?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean | string;
  helperText?: string;
  required?: boolean;
  className?: string;
  children?: React.ReactNode;
  onChange?: (value: unknown) => void;
  onSubmit?: (event?: React.FormEvent<HTMLFormElement>) => void;
}

// A light extension for form fields
export interface FieldProps extends CommonProps {
  name?: string;
  label?: string;
  placeholder?: string;
}
