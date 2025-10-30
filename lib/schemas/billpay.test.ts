import { describe, it, expect } from "vitest";
import {
  BillPayPayeeSchema,
  BillPayRuleCreateSchema,
} from "@/lib/schemas/billpay";

describe("Billpay Schemas", () => {
  describe("BillPayPayeeSchema", () => {
    it("should validate correct payee data", () => {
      const validData = {
        business_name: "Test Company",
        email: "test@example.com",
        phone: "+1234567890",
        street_address: "123 Main St",
        city: "San Francisco",
        state_or_territory: "CA",
        postal_code: "94102",
        country: "United States",
        account_number: "1234567890",
        routing_number: "123456789",
      };

      const result = BillPayPayeeSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate payee with optional address_line_2", () => {
      const validData = {
        business_name: "Test Company",
        email: "test@example.com",
        phone: "+1234567890",
        street_address: "123 Main St",
        address_line_2: "Suite 100",
        city: "San Francisco",
        state_or_territory: "CA",
        postal_code: "94102",
        account_number: "1234567890",
        routing_number: "123456789",
      };

      const result = BillPayPayeeSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email format", () => {
      const invalidData = {
        business_name: "Test Company",
        email: "invalid-email",
        phone: "+1234567890",
        street_address: "123 Main St",
        city: "San Francisco",
        state_or_territory: "CA",
        postal_code: "94102",
        account_number: "1234567890",
        routing_number: "123456789",
      };

      const result = BillPayPayeeSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid routing number", () => {
      const invalidData = {
        business_name: "Test Company",
        email: "test@example.com",
        phone: "+1234567890",
        street_address: "123 Main St",
        city: "San Francisco",
        state_or_territory: "CA",
        postal_code: "94102",
        account_number: "1234567890",
        routing_number: "12345678", // Invalid: not 9 digits
      };

      const result = BillPayPayeeSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid account number (non-numeric)", () => {
      const invalidData = {
        business_name: "Test Company",
        email: "test@example.com",
        phone: "+1234567890",
        street_address: "123 Main St",
        city: "San Francisco",
        state_or_territory: "CA",
        postal_code: "94102",
        account_number: "abc123", // Invalid: not all digits
        routing_number: "123456789",
      };

      const result = BillPayPayeeSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("BillPayRuleCreateSchema", () => {
    it("should validate correct rule data with payee_id", () => {
      const validData = {
        source_account_id: 1,
        payee_id: 1,
        amount: "100.00",
        frequency: "0 9 * * 1", // Every Monday at 9 AM
        start_time: "2025-12-01T09:00:00Z",
      };

      const result = BillPayRuleCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(10000); // Should be converted to cents
      }
    });

    it("should validate correct rule data with payee object", () => {
      const validData = {
        source_account_id: 1,
        payee: {
          business_name: "Test Company",
          email: "test@example.com",
          phone: "+1234567890",
          street_address: "123 Main St",
          city: "San Francisco",
          state_or_territory: "CA",
          postal_code: "94102",
          account_number: "1234567890",
          routing_number: "123456789",
        },
        amount: "50.50",
        frequency: "0 0 * * *", // Daily at midnight
        start_time: "2025-12-01T00:00:00Z",
        end_time: "2026-12-01T00:00:00Z",
      };

      const result = BillPayRuleCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(5050); // Should be converted to cents
      }
    });

    it("should reject when neither payee_id nor payee provided", () => {
      const invalidData = {
        source_account_id: 1,
        amount: "100.00",
        frequency: "0 9 * * 1",
        start_time: "2025-12-01T09:00:00Z",
      };

      const result = BillPayRuleCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid cron expression", () => {
      const invalidData = {
        source_account_id: 1,
        payee_id: 1,
        amount: "100.00",
        frequency: "invalid cron", // Invalid cron expression
        start_time: "2025-12-01T09:00:00Z",
      };

      const result = BillPayRuleCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid start_time format", () => {
      const invalidData = {
        source_account_id: 1,
        payee_id: 1,
        amount: "100.00",
        frequency: "0 9 * * 1",
        start_time: "2025-12-01", // Invalid: not ISO datetime
      };

      const result = BillPayRuleCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should validate valid cron expressions", () => {
      const validCrons = [
        "0 9 * * 1", // Every Monday at 9 AM
        "0 0 * * *", // Daily at midnight
        "0 12 1 * *", // First day of month at noon
        "*/5 * * * *", // Every 5 minutes
        "0 9-17 * * 1-5", // 9 AM to 5 PM on weekdays
      ];

      validCrons.forEach((cron) => {
        const validData = {
          source_account_id: 1,
          payee_id: 1,
          amount: "100.00",
          frequency: cron,
          start_time: "2025-12-01T09:00:00Z",
        };

        const result = BillPayRuleCreateSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });
  });
});
