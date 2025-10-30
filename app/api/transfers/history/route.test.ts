import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { getAuthUserFromRequest } from "@/lib/auth";

// Mock the Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
    count: vi.fn(),
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

describe("GET /api/transfers/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    } as never);

    const request = new Request("http://localhost:3000/api/transfers/history");
    const response = await GET(request);
    const data = (await response.json()) as { error: { message: string } };

    expect(response.status).toBe(401);
    expect(data).toEqual({ message: "Unauthorized" });
  });

  it("returns 404 when user is not onboarded", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/transfers/history");
    const response = await GET(request);
    const data = (await response.json()) as { error: { message: string } };

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: { message: "User not onboarded" } });
  });

  it("returns transfer history with amounts converted from dollars to cents", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [
        { id: 10, account_number: "10000001" },
        { id: 11, account_number: "10000002" },
      ],
    };

    const mockTransactions = [
      {
        id: 1,
        internal_account_id: 10,
        amount: 500.0, // $500 in database (dollars)
        status: "approved" as const,
        transaction_type: "internal_transfer" as const,
        direction: "outbound" as const,
        created_at: new Date("2024-01-01T00:00:00.000Z"),
        external_routing_number: null,
        external_account_number: null,
        external_nickname: null,
        transfer_rule: {
          id: 1,
          source_internal_id: 10,
          destination_internal_id: 11,
          source_internal: { id: 10, account_number: "10000001" },
          destination_internal: { id: 11, account_number: "10000002" },
        },
      },
      {
        id: 2,
        internal_account_id: 11,
        amount: 500.0, // $500 in database (dollars)
        status: "approved" as const,
        transaction_type: "internal_transfer" as const,
        direction: "inbound" as const,
        created_at: new Date("2024-01-01T00:00:01.000Z"),
        external_routing_number: null,
        external_account_number: null,
        external_nickname: null,
        transfer_rule: {
          id: 1,
          source_internal_id: 10,
          destination_internal_id: 11,
          source_internal: { id: 10, account_number: "10000001" },
          destination_internal: { id: 11, account_number: "10000002" },
        },
      },
    ];

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.transaction.count.mockResolvedValue(2);
    mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

    const request = new Request("http://localhost:3000/api/transfers/history");
    const response = await GET(request);
    const data = (await response.json()) as {
      transfers: Array<{
        id: number;
        amount: number;
        transaction_type: string;
        direction: string;
      }>;
      pagination: { total: number };
    };

    expect(response.status).toBe(200);
    expect(data.transfers).toHaveLength(2);
    // Amount should be converted from dollars (500.0) to cents (50000)
    expect(data.transfers[0].amount).toBe(50000);
    expect(data.transfers[1].amount).toBe(50000);
    expect(data.pagination.total).toBe(2);
  });

  it("handles pagination correctly", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [{ id: 10, account_number: "10000001" }],
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.transaction.count.mockResolvedValue(25);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3000/api/transfers/history?page=2&limit=10",
    );
    await GET(request);

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10, // (page 2 - 1) * limit 10
        take: 10,
      }),
    );
  });

  it("filters by transfer type when provided", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [{ id: 10, account_number: "10000001" }],
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3000/api/transfers/history?type=internal_transfer",
    );
    await GET(request);

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          transaction_type: { in: ["internal_transfer"] },
        }),
      }),
    );
  });

  it("filters by date range when provided", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [{ id: 10, account_number: "10000001" }],
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const startDate = "2024-01-01T00:00:00.000Z";
    const endDate = "2024-01-31T23:59:59.999Z";
    const request = new Request(
      `http://localhost:3000/api/transfers/history?start_date=${startDate}&end_date=${endDate}`,
    );
    await GET(request);

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          created_at: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      }),
    );
  });

  it("returns empty array when user has no transfers", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [{ id: 10, account_number: "10000001" }],
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/transfers/history");
    const response = await GET(request);
    const data = (await response.json()) as {
      transfers: unknown[];
      pagination: { total: number };
    };

    expect(response.status).toBe(200);
    expect(data.transfers).toEqual([]);
    expect(data.pagination.total).toBe(0);
  });

  it("converts decimal amounts correctly to cents", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [{ id: 10, account_number: "10000001" }],
    };

    const mockTransaction = {
      id: 1,
      internal_account_id: 10,
      amount: 123.45, // $123.45 in database
      status: "approved" as const,
      transaction_type: "internal_transfer" as const,
      direction: "outbound" as const,
      created_at: new Date("2024-01-01T00:00:00.000Z"),
      external_routing_number: null,
      external_account_number: null,
      external_nickname: null,
      transfer_rule: {
        id: 1,
        source_internal_id: 10,
        destination_internal_id: 11,
        source_internal: { id: 10, account_number: "10000001" },
        destination_internal: { id: 11, account_number: "10000002" },
      },
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.transaction.count.mockResolvedValue(1);
    mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);

    const request = new Request("http://localhost:3000/api/transfers/history");
    const response = await GET(request);
    const data = (await response.json()) as {
      transfers: Array<{ amount: number }>;
    };

    expect(response.status).toBe(200);
    // $123.45 should become 12345 cents
    expect(data.transfers[0].amount).toBe(12345);
  });

  it("returns 422 for invalid query parameters", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      internal_accounts: [{ id: 10, account_number: "10000001" }],
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    // Invalid page number (should return 422)
    const request = new Request(
      "http://localhost:3000/api/transfers/history?page=invalid",
    );
    const response = await GET(request);
    const data = (await response.json()) as {
      error: string;
      details?: unknown;
    };

    expect(response.status).toBe(422);
    expect(data.error).toBe("Invalid query parameters");
    expect(data.details).toBeDefined();
  });
});
