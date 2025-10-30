import { describe, it, expect, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import {
  json,
  Amount,
  createDeniedTransaction,
  findExistingTransaction,
  createApprovedTransaction,
} from "./transactions";

describe("Transaction Library Helpers", () => {
  describe("json", () => {
    it("should return a Response with correct status and JSON body", () => {
      const response = json(200, { message: "Success" });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("should serialize the body to JSON", async () => {
      const body = { foo: "bar", num: 42 };
      const response = json(201, body);
      const data = await response.json();

      expect(data).toEqual(body);
    });

    it("should handle error status codes", () => {
      const response = json(404, { error: "Not Found" });

      expect(response.status).toBe(404);
    });
  });

  describe("Amount schema", () => {
    it("should parse valid string amounts", () => {
      const result = Amount.safeParse("100.50");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeInstanceOf(Decimal);
        expect(result.data.toString()).toBe("100.5");
      }
    });

    it("should parse valid number amounts", () => {
      const result = Amount.safeParse(100.5);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeInstanceOf(Decimal);
        expect(result.data.toString()).toBe("100.5");
      }
    });

    it("should trim whitespace from string amounts", () => {
      const result = Amount.safeParse("  50.25  ");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.toString()).toBe("50.25");
      }
    });

    it("should reject amounts with more than 2 decimal places", () => {
      const result = Amount.safeParse("100.555");
      expect(result.success).toBe(false);
    });

    it("should reject zero amounts", () => {
      const result = Amount.safeParse("0");
      expect(result.success).toBe(false);
    });

    it("should reject negative amounts", () => {
      const result = Amount.safeParse("-50");
      expect(result.success).toBe(false);
    });

    it("should accept amounts with one decimal place", () => {
      const result = Amount.safeParse("100.5");
      expect(result.success).toBe(true);
    });

    it("should accept whole number amounts", () => {
      const result = Amount.safeParse("100");
      expect(result.success).toBe(true);
    });

    it("should reject invalid string formats", () => {
      const result = Amount.safeParse("abc");
      expect(result.success).toBe(false);
    });
  });

  describe("createDeniedTransaction", () => {
    it("should create a denied transaction with correct data", async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
      const mockTx = {
        transaction: {
          create: mockCreate,
        },
      };

      const data = {
        internal_account_id: 1,
        amount: new Decimal(100),
        transaction_type: "deposit",
        direction: "inbound",
        idempotency_key: "test-key",
      };

      await createDeniedTransaction(mockTx, data);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          ...data,
          status: "denied",
        },
      });
    });

    it("should handle transactions with bill_pay_rule_id", async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
      const mockTx = {
        transaction: {
          create: mockCreate,
        },
      };

      const data = {
        internal_account_id: 1,
        amount: new Decimal(50),
        transaction_type: "billpay",
        direction: "outbound",
        bill_pay_rule_id: 5,
        idempotency_key: null,
      };

      await createDeniedTransaction(mockTx, data);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          ...data,
          status: "denied",
        },
      });
    });

    it("should handle transactions with transfer_rule_id", async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
      const mockTx = {
        transaction: {
          create: mockCreate,
        },
      };

      const data = {
        internal_account_id: 1,
        amount: new Decimal(200),
        transaction_type: "internal_transfer",
        direction: "outbound",
        transfer_rule_id: 10,
      };

      await createDeniedTransaction(mockTx, data);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          ...data,
          status: "denied",
        },
      });
    });
  });

  describe("findExistingTransaction", () => {
    it("should return null if no idempotency_key provided", async () => {
      const mockTx = {
        transaction: {
          findFirst: vi.fn(),
        },
      };

      const result = await findExistingTransaction(mockTx, {
        transaction_type: "deposit",
        internal_account_id: 1,
        amount: new Decimal(100),
      });

      expect(result).toBeNull();
      expect(mockTx.transaction.findFirst).not.toHaveBeenCalled();
    });

    it("should search for existing transaction with idempotency key", async () => {
      const mockTransaction = { id: 1, status: "approved" };
      const mockFindFirst = vi.fn().mockResolvedValue(mockTransaction);
      const mockTx = {
        transaction: {
          findFirst: mockFindFirst,
        },
      };

      const params = {
        idempotency_key: "test-key-123",
        transaction_type: "deposit",
        internal_account_id: 1,
        amount: new Decimal(100),
      };

      const result = await findExistingTransaction(mockTx, params);

      expect(result).toEqual(mockTransaction);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          idempotency_key: "test-key-123",
          transaction_type: "deposit",
          internal_account_id: 1,
          amount: new Decimal(100),
        },
      });
    });

    it("should include bill_pay_rule_id in search when provided", async () => {
      const mockFindFirst = vi.fn().mockResolvedValue(null);
      const mockTx = {
        transaction: {
          findFirst: mockFindFirst,
        },
      };

      const params = {
        idempotency_key: "test-key",
        transaction_type: "billpay",
        internal_account_id: 1,
        amount: new Decimal(50),
        bill_pay_rule_id: 5,
      };

      await findExistingTransaction(mockTx, params);

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          bill_pay_rule_id: 5,
        }),
      });
    });

    it("should include transfer_rule_id in search when provided", async () => {
      const mockFindFirst = vi.fn().mockResolvedValue(null);
      const mockTx = {
        transaction: {
          findFirst: mockFindFirst,
        },
      };

      const params = {
        idempotency_key: "test-key",
        transaction_type: "internal_transfer",
        internal_account_id: 1,
        amount: new Decimal(200),
        transfer_rule_id: 10,
      };

      await findExistingTransaction(mockTx, params);

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          transfer_rule_id: 10,
        }),
      });
    });

    it("should return null when no existing transaction found", async () => {
      const mockFindFirst = vi.fn().mockResolvedValue(null);
      const mockTx = {
        transaction: {
          findFirst: mockFindFirst,
        },
      };

      const result = await findExistingTransaction(mockTx, {
        idempotency_key: "non-existent",
        transaction_type: "withdrawal",
        internal_account_id: 1,
        amount: new Decimal(50),
      });

      expect(result).toBeNull();
    });
  });

  describe("createApprovedTransaction", () => {
    it("should create an approved transaction and return success", async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
      const mockTx = {
        transaction: {
          create: mockCreate,
        },
      };

      const data = {
        internal_account_id: 1,
        amount: new Decimal(100),
        transaction_type: "deposit",
        direction: "inbound",
        idempotency_key: "test-key",
      };

      const result = await createApprovedTransaction(
        mockTx,
        data,
        "Deposit successful",
      );

      expect(result).toEqual({
        success: true,
        message: "Deposit successful",
        transaction: { id: 1 },
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          ...data,
          status: "approved",
        },
      });
    });

    it("should handle duplicate idempotency key (P2002 error)", async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint",
        {
          code: "P2002",
          clientVersion: "5.0.0",
        },
      );
      const mockCreate = vi.fn().mockRejectedValue(error);
      const mockExistingTransaction = { id: 1, status: "approved" };
      const mockFindFirst = vi.fn().mockResolvedValue(mockExistingTransaction);
      const mockTx = {
        transaction: {
          create: mockCreate,
          findFirst: mockFindFirst,
        },
      };

      const data = {
        internal_account_id: 1,
        amount: new Decimal(100),
        transaction_type: "deposit",
        direction: "inbound",
        idempotency_key: "duplicate-key",
      };

      const result = await createApprovedTransaction(
        mockTx,
        data,
        "Deposit successful",
      );

      expect(result).toEqual({
        success: true,
        message: "Deposit successful (idempotency key found).",
        duplicate: true,
        transaction: mockExistingTransaction,
      });
    });

    it("should not catch P2002 error if no idempotency_key", async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint",
        {
          code: "P2002",
          clientVersion: "5.0.0",
        },
      );
      const mockCreate = vi.fn().mockRejectedValue(error);
      const mockTx = {
        transaction: {
          create: mockCreate,
        },
      };

      const data = {
        internal_account_id: 1,
        amount: new Decimal(100),
        transaction_type: "deposit",
        direction: "inbound",
      };

      await expect(
        createApprovedTransaction(mockTx, data, "Deposit successful"),
      ).rejects.toThrow(error);
    });

    it("should rethrow non-P2002 errors", async () => {
      const error = new Error("Database connection failed");
      const mockCreate = vi.fn().mockRejectedValue(error);
      const mockTx = {
        transaction: {
          create: mockCreate,
        },
      };

      const data = {
        internal_account_id: 1,
        amount: new Decimal(100),
        transaction_type: "deposit",
        direction: "inbound",
        idempotency_key: "test-key",
      };

      await expect(
        createApprovedTransaction(mockTx, data, "Deposit successful"),
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle transactions with bill_pay_rule_id", async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
      const mockTx = {
        transaction: {
          create: mockCreate,
        },
      };

      const data = {
        internal_account_id: 1,
        amount: new Decimal(50),
        transaction_type: "billpay",
        direction: "outbound",
        bill_pay_rule_id: 5,
        idempotency_key: "test-key",
      };

      await createApprovedTransaction(mockTx, data, "Bill pay successful");

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          ...data,
          status: "approved",
        },
      });
    });

    it("should handle transactions with transfer_rule_id", async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
      const mockTx = {
        transaction: {
          create: mockCreate,
        },
      };

      const data = {
        internal_account_id: 1,
        amount: new Decimal(200),
        transaction_type: "internal_transfer",
        direction: "outbound",
        transfer_rule_id: 10,
      };

      await createApprovedTransaction(mockTx, data, "Transfer successful");

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          ...data,
          status: "approved",
        },
      });
    });
  });
});
