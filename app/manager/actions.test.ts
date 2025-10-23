import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getUsers,
  getUserById,
  getTransactions,
  getTransactionById,
  getUserTransactions,
} from "./actions";

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  transaction: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

// Mock getPrisma function
vi.mock("@/app/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

// Mock auth functions
vi.mock("@/lib/auth", () => ({
  getAuthUserFromRequest: vi.fn(),
}));

// Mock headers
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import { getAuthUserFromRequest } from "@/lib/auth";
import { headers } from "next/headers";

describe("Manager Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful auth by default
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-user-id", email: "manager@test.com" },
    });
    vi.mocked(headers).mockResolvedValue(new Headers());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getUsers", () => {
    it("should return users when manager is authenticated", async () => {
      const mockUsers = [
        {
          id: 1,
          username: "testuser",
          first_name: "Test",
          last_name: "User",
          email: "test@example.com",
          role: "customer" as const,
          created_at: new Date("2023-01-01"),
          state_or_territory: "CA",
          _count: { internal_accounts: 2 },
        },
      ];

      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await getUsers({ page: 1, limit: 10 });

      expect(result).toEqual({
        users: mockUsers,
        total: 1,
      });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object),
        orderBy: { created_at: "desc" },
        skip: 0,
        take: 10,
      });
    });

    it("should apply search filter", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await getUsers({ search: "test", page: 1, limit: 10 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { username: { contains: "test", mode: "insensitive" } },
              { first_name: { contains: "test", mode: "insensitive" } },
              { last_name: { contains: "test", mode: "insensitive" } },
              { email: { contains: "test", mode: "insensitive" } },
            ],
          },
        }),
      );
    });

    it("should apply role filter", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await getUsers({ role: "customer", page: 1, limit: 10 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: "customer" },
        }),
      );
    });

    it("should throw error when user is not a manager", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "customer" });

      await expect(getUsers({ page: 1, limit: 10 })).rejects.toThrow(
        "Unauthorized: Manager role required",
      );
    });

    it("should throw error when auth fails", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValue({
        ok: false,
        status: 401,
        body: { message: "Unauthorized" },
      });

      await expect(getUsers({ page: 1, limit: 10 })).rejects.toThrow(
        "Unauthorized: Manager role required",
      );
    });
  });

  describe("getUserById", () => {
    it("should return user details when manager is authenticated", async () => {
      const mockUser = {
        id: 1,
        username: "testuser",
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
        phone_number: "+1234567890",
        street_address: "123 Main St",
        address_line_2: null,
        city: "Test City",
        state_or_territory: "CA",
        postal_code: "12345",
        country: "United States",
        role: "customer" as const,
        created_at: new Date("2023-01-01"),
        internal_accounts: [
          {
            id: 1,
            account_number: "1234567890",
            account_type: "checking",
            balance: 1000,
            is_active: true,
          },
        ],
        _count: { internal_accounts: 1 },
      };

      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        role: "bank_manager",
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      const result = await getUserById(1);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.any(Object),
      });
    });

    it("should return null when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        role: "bank_manager",
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await getUserById(999);

      expect(result).toBeNull();
    });

    it("should throw error when user is not a manager", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "customer" });

      await expect(getUserById(1)).rejects.toThrow(
        "Unauthorized: Manager role required",
      );
    });
  });

  describe("getTransactions", () => {
    it("should return transactions when manager is authenticated", async () => {
      const mockTransactions = [
        {
          id: 1,
          created_at: new Date("2023-01-01"),
          amount: 100,
          status: "approved" as const,
          transaction_type: "internal_transfer" as const,
          direction: "inbound" as const,
          internal_account: {
            account_number: "1234567890",
            user: {
              id: 1,
              username: "testuser",
              first_name: "Test",
              last_name: "User",
            },
          },
        },
      ];

      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const result = await getTransactions({ page: 1, limit: 10 });

      expect(result).toEqual({
        transactions: mockTransactions,
        total: 1,
      });
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object),
        orderBy: { created_at: "desc" },
        skip: 0,
        take: 10,
      });
    });

    it("should apply search filter for user names", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await getTransactions({ search: "test", page: 1, limit: 10 });

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              {
                internal_account: {
                  user: {
                    OR: [
                      { username: { contains: "test", mode: "insensitive" } },
                      { first_name: { contains: "test", mode: "insensitive" } },
                      { last_name: { contains: "test", mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
        }),
      );
    });

    it("should apply transaction type filter", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await getTransactions({ type: "internal_transfer", page: 1, limit: 10 });

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transaction_type: "internal_transfer" },
        }),
      );
    });

    it("should throw error when user is not a manager", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "customer" });

      await expect(getTransactions({ page: 1, limit: 10 })).rejects.toThrow(
        "Unauthorized: Manager role required",
      );
    });
  });

  describe("getTransactionById", () => {
    it("should return transaction details when manager is authenticated", async () => {
      const mockTransaction = {
        id: 1,
        created_at: new Date("2023-01-01"),
        amount: 100,
        status: "approved" as const,
        transaction_type: "internal_transfer" as const,
        direction: "inbound" as const,
        check_number: null,
        external_routing_number: null,
        external_account_number: null,
        external_nickname: null,
        internal_account: {
          account_number: "1234567890",
          user: {
            id: 1,
            username: "testuser",
            first_name: "Test",
            last_name: "User",
            email: "test@example.com",
          },
        },
      };

      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      const result = await getTransactionById(1);

      expect(result).toEqual(mockTransaction);
      expect(mockPrisma.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.any(Object),
      });
    });

    it("should return null when transaction not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      const result = await getTransactionById(999);

      expect(result).toBeNull();
    });

    it("should throw error when user is not a manager", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "customer" });

      await expect(getTransactionById(1)).rejects.toThrow(
        "Unauthorized: Manager role required",
      );
    });
  });

  describe("getUserTransactions", () => {
    it("should return user transactions when manager is authenticated", async () => {
      const mockTransactions = [
        {
          id: 1,
          created_at: new Date("2023-01-01"),
          amount: 100,
          status: "approved" as const,
          transaction_type: "internal_transfer" as const,
          direction: "inbound" as const,
          internal_account: {
            account_number: "1234567890",
            user: {
              id: 1,
              username: "testuser",
              first_name: "Test",
              last_name: "User",
            },
          },
        },
      ];

      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await getUserTransactions(1, 5);

      expect(result).toEqual(mockTransactions);
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          internal_account: {
            user_id: 1,
          },
        },
        select: expect.any(Object),
        orderBy: { created_at: "desc" },
        take: 5,
      });
    });

    it("should use default limit when not provided", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "bank_manager" });
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      await getUserTransactions(1);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it("should throw error when user is not a manager", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "customer" });

      await expect(getUserTransactions(1)).rejects.toThrow(
        "Unauthorized: Manager role required",
      );
    });
  });
});
