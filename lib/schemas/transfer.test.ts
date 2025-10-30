import { describe, it, expect } from "vitest";
import {
  InternalTransferSchema,
  ExternalTransferSchema,
  ExternalAccountSchema,
  TransferHistoryQuerySchema,
} from "./transfer";

describe("Transfer Schemas", () => {
  describe("InternalTransferSchema", () => {
    it("should validate correct internal transfer data", () => {
      const validData = {
        source_account_id: 1,
        destination_account_id: 2,
        amount: "100.00", // $100.00 as string
      };

      const result = InternalTransferSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(10000); // Should be converted to cents
      }
    });

    it("should reject when source and destination are the same", () => {
      const invalidData = {
        source_account_id: 1,
        destination_account_id: 1,
        amount: "100.00",
      };

      const result = InternalTransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Source and destination accounts must be different",
        );
      }
    });

    it("should reject invalid amount", () => {
      const invalidData = {
        source_account_id: 1,
        destination_account_id: 2,
        amount: "0", // Invalid: must be at least 1 cent
      };

      const result = InternalTransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Amount must be at least $0.01",
        );
      }
    });

    it("should reject non-numeric amount", () => {
      const invalidData = {
        source_account_id: 1,
        destination_account_id: 2,
        amount: "abc", // Invalid: not a number
      };

      const result = InternalTransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Amount must be a valid number",
        );
      }
    });

    it("should reject negative account IDs", () => {
      const invalidData = {
        source_account_id: -1,
        destination_account_id: 2,
        amount: "100.00",
      };

      const result = InternalTransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("ExternalTransferSchema", () => {
    it("should validate external transfer with recipient email", () => {
      const validData = {
        source_account_id: 1,
        amount: "100.00",
        recipient_email: "recipient@example.com",
      };

      const result = ExternalTransferSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(10000); // Should be converted to cents
        expect(result.data.recipient_email).toBe("recipient@example.com");
      }
    });

    it("should validate external transfer with recipient phone", () => {
      const validData = {
        source_account_id: 1,
        amount: "100.00",
        recipient_phone: "+1234567890",
      };

      const result = ExternalTransferSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recipient_phone).toBe("+1234567890");
      }
    });

    it("should validate external transfer with destination account ID", () => {
      const validData = {
        source_account_id: 1,
        amount: "100.00",
        destination_account_id: 5,
      };

      const result = ExternalTransferSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.destination_account_id).toBe(5);
      }
    });

    it("should reject when neither recipient email, phone, nor destination account ID provided", () => {
      const invalidData = {
        source_account_id: 1,
        amount: "100.00",
      };

      const result = ExternalTransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Must provide recipient email, phone, or destination account ID",
        );
      }
    });

    it("should reject invalid email format", () => {
      const invalidData = {
        source_account_id: 1,
        amount: "100.00",
        recipient_email: "invalid-email",
      };

      const result = ExternalTransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("ExternalAccountSchema", () => {
    it("should validate external account with nickname", () => {
      const validData = {
        nickname: "My Savings Account",
        account_number: "1234567890",
        routing_number: "123456789",
      };

      const result = ExternalAccountSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate external account without nickname", () => {
      const validData = {
        account_number: "1234567890",
        routing_number: "123456789",
      };

      const result = ExternalAccountSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject nickname that is too long", () => {
      const invalidData = {
        nickname:
          "This nickname is way too long and exceeds the 30 character limit",
        account_number: "1234567890",
        routing_number: "123456789",
      };

      const result = ExternalAccountSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Nickname cannot exceed 30 characters",
        );
      }
    });

    it("should reject invalid routing number", () => {
      const invalidData = {
        account_number: "1234567890",
        routing_number: "12345678", // Invalid: not 9 digits
      };

      const result = ExternalAccountSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("TransferHistoryQuerySchema", () => {
    it("should validate query with all parameters", () => {
      const validData = {
        page: 1,
        limit: 20,
        type: "internal_transfer" as const,
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-12-31T23:59:59Z",
      };

      const result = TransferHistoryQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate query with minimal parameters", () => {
      const validData = {};

      const result = TransferHistoryQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it("should reject invalid page number", () => {
      const invalidData = {
        page: 0, // Invalid: must be at least 1
      };

      const result = TransferHistoryQuerySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid limit", () => {
      const invalidData = {
        limit: 101, // Invalid: must be at most 100
      };

      const result = TransferHistoryQuerySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid transfer type", () => {
      const invalidData = {
        type: "invalid_type",
      };

      const result = TransferHistoryQuerySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid date format", () => {
      const invalidData = {
        start_date: "2024-01-01", // Invalid: not ISO datetime
      };

      const result = TransferHistoryQuerySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
