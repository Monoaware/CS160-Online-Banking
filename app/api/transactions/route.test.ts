import { describe, it, expect, vi, beforeEach } from "vitest";
// Update the import path to the correct location of the route handler
import { GET } from "./route";

// Mock the Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
  },
};

// Mock the getPrisma function
vi.mock("@/app/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

// Mock auth helper
vi.mock("@/lib/auth", () => ({
  getAuthUserFromRequest: vi.fn(),
}));

import { getAuthUserFromRequest } from "@/lib/auth";

describe("GET /api/transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    } as never);

    const request = new Request("http://localhost:3000/api/transactions");
    const response = await GET(request);
    const data = (await response.json()) as { message: string };

    expect(response.status).toBe(401);
    expect(data).toEqual({ message: "Unauthorized" });
  });

  it("returns 404 when user is not onboarded", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/transactions");
    const response = await GET(request);
    const data = (await response.json()) as { message: string };

    expect(response.status).toBe(404);
    expect(data).toEqual({ message: "User not onboarded" });
  });

  it("returns transactions for authenticated user", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [{ id: 10 }, { id: 11 }],
    };

    const mockTransactions = [
      {
        id: 1,
        internal_account_id: 10,
        amount: 100,
        status: "approved",
        transaction_type: "deposit",
        direction: "inbound",
        created_at: "2024-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        internal_account_id: 11,
        amount: 50,
        status: "pending",
        transaction_type: "withdrawal",
        direction: "outbound",
        created_at: "2024-01-02T00:00:00.000Z",
      },
    ];

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

    const request = new Request("http://localhost:3000/api/transactions");
    const response = await GET(request);
    const data = (await response.json()) as {
      transactions: typeof mockTransactions;
    };

    expect(response.status).toBe(200);
    expect(data.transactions).toEqual(mockTransactions);

    // Verify correct query parameters
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        internal_account_id: {
          in: [10, 11],
        },
      },
      orderBy: {
        created_at: "desc",
      },
      take: 10,
    });
  });

  it("filters transactions by user's internal accounts only", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [{ id: 10 }],
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/transactions");
    await GET(request);

    // Ensure transactions are filtered by account IDs
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          internal_account_id: {
            in: [10],
          },
        },
      }),
    );
  });

  it("handles user with no internal accounts", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [],
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/transactions");
    const response = await GET(request);
    const data = (await response.json()) as { transactions: unknown[] };

    expect(response.status).toBe(200);
    expect(data.transactions).toEqual([]);
    // When user has no accounts, findMany is not called (early return)
    expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
  });
});
