"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export const CurrencyInputField = forwardRef<
  HTMLInputElement,
  CurrencyInputProps
>(
  (
    {
      value,
      onChange,
      placeholder = "0.00",
      className,
      disabled,
      id,
      ...props
    },
    ref,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.value);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Select all on focus for easy replacement
      e.target.select();
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10">
          $
        </span>
        <input
          id={id}
          ref={ref}
          type="text"
          inputMode="numeric"
          value={value || ""}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-8",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);

CurrencyInputField.displayName = "CurrencyInputField";
