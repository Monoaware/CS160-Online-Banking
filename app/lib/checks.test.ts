import { describe, it, expect } from "vitest";
import { validateExtractedCheck } from "./checks";
import type { CheckExtractionResult } from "./groq";

describe("validateExtractedCheck", () => {
  it("should return valid for successful extraction with positive amount", () => {
    const result: CheckExtractionResult = {
      success: true,
      data: {
        amount: 100.5,
        routing_number: "123456789",
        account_number: "987654321",
        check_number: undefined,
      },
    };

    const validation = validateExtractedCheck(result);
    expect(validation.valid).toBe(true);
  });

  it("should return invalid for failed extraction", () => {
    const result: CheckExtractionResult = {
      success: false,
      error: "Failed to extract check data",
    };

    const validation = validateExtractedCheck(result);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error).toBe("Failed to extract check data");
    }
  });

  it("should return invalid for zero amount", () => {
    const result: CheckExtractionResult = {
      success: true,
      data: {
        amount: 0,
        routing_number: undefined,
        account_number: undefined,
        check_number: undefined,
      },
    };

    const validation = validateExtractedCheck(result);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error).toBe(
        "Could not extract a valid amount from the check",
      );
    }
  });

  it("should return invalid for negative amount", () => {
    const result: CheckExtractionResult = {
      success: true,
      data: {
        amount: -10,
        routing_number: undefined,
        account_number: undefined,
        check_number: undefined,
      },
    };

    const validation = validateExtractedCheck(result);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error).toBe(
        "Could not extract a valid amount from the check",
      );
    }
  });

  it("should return invalid for missing amount", () => {
    const result: CheckExtractionResult = {
      success: true,
      data: {
        amount: 0, // Amount is required by schema, so we use 0 to simulate missing
        routing_number: "123456789",
        account_number: undefined,
        check_number: undefined,
      },
    };

    const validation = validateExtractedCheck(result);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error).toBe(
        "Could not extract a valid amount from the check",
      );
    }
  });
});
