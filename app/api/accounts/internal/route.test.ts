import { describe, expect, it, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { getAuthUserFromRequest } from "@/lib/auth";

// Mock the Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  internalAccount: {
    findUnique: vi.fn(),
    create: vi.fn(),
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

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

describe("POST /api/accounts/internal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    } as never);

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_type: "checking" }),
      }),
    );

    expect(response.status).toBe(401);
    const data = (await response.json()) as { message: string };
    expect(data).toEqual({ message: "Unauthorized" });
  });

  it("returns 404 when user is not onboarded", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_type: "checking" }),
      }),
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { error: { message: string } };
    expect(data).toEqual({ error: { message: "User not onboarded" } });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { auth_user_id: "test-uuid" },
    });
  });

  it("returns 400 when account type is invalid", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true,
    });

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_type: "invalid-type" }),
      }),
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: { message: string } };
    expect(data.error.message).toBe("Invalid account type");
  });

  it("creates checking account successfully", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    const mockUser = {
      id: 1,
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true,
    };

    const mockAccount = {
      id: 1,
      user_id: 1,
      account_number: "12345678901234567",
      routing_number: "123456789",
      account_type: "checking",
      balance: 100,
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true,
    };

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.internalAccount.findUnique.mockResolvedValue(null);
    mockPrisma.internalAccount.create.mockResolvedValue(mockAccount);

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_type: "checking",
          initial_deposit: 100,
        }),
      }),
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as {
      account: {
        id: number;
        account_number: string;
        account_type: "checking" | "savings";
        balance: number;
        is_active: boolean;
      };
    };
    expect(data.account).toEqual(
      expect.objectContaining({
        id: 1,
        account_number: "12345678901234567",
        account_type: "checking",
        balance: 100,
        is_active: true,
      }),
    );

    expect(mockPrisma.internalAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 1,
        account_type: "checking",
        balance: 100,
      }),
    });
  });

  it("creates savings account successfully", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "test-uuid", email: "test@example.com" },
    });

    const mockUser = {
      id: 1,
      auth_user_id: "test-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true,
    };

    const mockAccount = {
      id: 1,
      user_id: 1,
      account_number: "12345678901234567",
      routing_number: "123456789",
      account_type: "savings",
      balance: 0,
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true,
    };

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.internalAccount.findUnique.mockResolvedValue(null);
    mockPrisma.internalAccount.create.mockResolvedValue(mockAccount);

    const response = await POST(
      new Request("http://localhost:3000/api/accounts/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_type: "savings",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as {
      account: {
        id: number;
        account_number: string;
        account_type: "checking" | "savings";
        balance: number;
        is_active: boolean;
      };
    };
    expect(data.account).toEqual(
      expect.objectContaining({
        id: 1,
        account_number: "12345678901234567",
        account_type: "savings",
        balance: 0,
        is_active: true,
      }),
    );

    expect(mockPrisma.internalAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 1,
        account_type: "savings",
        balance: 0,
      }),
    });
  });
});
