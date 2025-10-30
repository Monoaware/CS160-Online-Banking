import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CurrencyInputField } from "./currency-input";

const user = userEvent.setup();

// Test wrapper component with state
function TestCurrencyInput({
  onValueChange,
}: {
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <CurrencyInputField
      value={value}
      onChange={(newValue) => {
        setValue(newValue);
        onValueChange?.(newValue);
      }}
    />
  );
}

describe("CurrencyInputField", () => {
  it("should render with default placeholder", () => {
    render(<CurrencyInputField />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "0.00");
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("should allow free typing", async () => {
    const mockOnChange = vi.fn();
    render(<TestCurrencyInput onValueChange={mockOnChange} />);

    const input = screen.getByRole("textbox");

    // Type "500" - should pass through as string
    await user.type(input, "500");

    expect(input).toHaveValue("500");
    expect(mockOnChange).toHaveBeenLastCalledWith("500");
  });

  it("should handle decimal input", async () => {
    const mockOnChange = vi.fn();
    render(<TestCurrencyInput onValueChange={mockOnChange} />);

    const input = screen.getByRole("textbox");

    // Type "5.50" - should pass through as string
    await user.type(input, "5.50");
    expect(input).toHaveValue("5.50");
    expect(mockOnChange).toHaveBeenLastCalledWith("5.50");
  });

  it("should allow letters and symbols (validation handled elsewhere)", async () => {
    const mockOnChange = vi.fn();
    render(<TestCurrencyInput onValueChange={mockOnChange} />);

    const input = screen.getByRole("textbox");

    // Type "abc123" - should pass through as string
    await user.type(input, "abc123");
    expect(input).toHaveValue("abc123");
    expect(mockOnChange).toHaveBeenLastCalledWith("abc123");
  });

  it("should display existing value as string", () => {
    render(<CurrencyInputField value="500.00" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("500.00");
  });

  it("should handle empty value", () => {
    render(<CurrencyInputField value="" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
  });

  it("should handle undefined value", () => {
    render(<CurrencyInputField value={undefined} />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
  });

  it("should select all text on focus", async () => {
    render(<CurrencyInputField value="500.00" />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.click(input);

    // Check if text is selected (selectionStart should be 0 and selectionEnd should be length)
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("should pass through disabled prop", () => {
    render(<CurrencyInputField disabled />);

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("should pass through id prop", () => {
    render(<CurrencyInputField id="test-amount" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("id", "test-amount");
  });

  it("should handle clearing input", async () => {
    const mockOnChange = vi.fn();
    render(<TestCurrencyInput onValueChange={mockOnChange} />);

    const input = screen.getByRole("textbox");

    // Type something first
    await user.type(input, "5");
    expect(mockOnChange).toHaveBeenLastCalledWith("5");

    // Clear the input
    await user.clear(input);

    expect(input).toHaveValue("");
    expect(mockOnChange).toHaveBeenLastCalledWith("");
  });

  it("should allow any input characters", async () => {
    const mockOnChange = vi.fn();
    render(<TestCurrencyInput onValueChange={mockOnChange} />);

    const input = screen.getByRole("textbox");

    // Type various characters - should all pass through
    await user.type(input, "12.34abc!@#");
    expect(input).toHaveValue("12.34abc!@#");
    expect(mockOnChange).toHaveBeenLastCalledWith("12.34abc!@#");
  });
});
