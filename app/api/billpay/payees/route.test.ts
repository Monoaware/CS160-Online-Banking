import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/billpay/payees/route";
import { getAuthUserFromRequest } from "@/lib/auth";

// Mock the Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  billPayPayee: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

// Mock the getPrisma function
vi.mock("@/app/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

// Mock auth helper
vi.mock("@/lib/auth", () => ({
  getAuthUserFromRequest: vi.fn(),
}));

describe("Billpay Payees API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/billpay/payees", () => {
    it("returns 401 when user is not authenticated", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValue({
        ok: false,
        status: 401,
        body: { message: "Unauthorized" },
      } as never);

      const request = new Request("http://localhost:3000/api/billpay/payees");
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

      const request = new Request("http://localhost:3000/api/billpay/payees");
      const response = await GET(request);
      const data = (await response.json()) as { error: { message: string } };

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: { message: "User not onboarded" } });
    });

    it("returns list of payees", async () => {
      const mockUser = { id: 1, username: "testuser" };
      const mockPayees = [
        {
          id: 1,
          business_name: "Test Company",
          email: "test@example.com",
          phone: "+1234567890",
          street_address: "123 Main St",
          address_line_2: null,
          city: "San Francisco",
          state_or_territory: "CA",
          postal_code: "94102",
          country: "United States",
          account_number: "1234567890",
          routing_number: "123456789",
          is_active: true,
        },
      ];

      vi.mocked(getAuthUserFromRequest).mockResolvedValue({
        ok: true,
        supabaseUser: { id: "user-123" },
      } as never);

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.billPayPayee.findMany.mockResolvedValue(mockPayees);

      const request = new Request("http://localhost:3000/api/billpay/payees");
      const response = await GET(request);
      const data = (await response.json()) as { payees: unknown[] };

      expect(response.status).toBe(200);
      expect(data.payees).toHaveLength(1);
      expect(data.payees[0]).toMatchObject({
        id: 1,
        business_name: "Test Company",
      });
    });

    it("filters payees by business name", async () => {
      const mockUser = { id: 1, username: "testuser" };

      vi.mocked(getAuthUserFromRequest).mockResolvedValue({
        ok: true,
        supabaseUser: { id: "user-123" },
      } as never);

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.billPayPayee.findMany.mockResolvedValue([]);

      const request = new Request(
        "http://localhost:3000/api/billpay/payees?business_name=Test",
      );
      await GET(request);

      expect(mockPrisma.billPayPayee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            business_name: {
              contains: "Test",
              mode: "insensitive",
            },
          }),
        }),
      );
    });
  });

  describe("POST /api/billpay/payees", () => {
    it("creates a new payee", async () => {
      const mockUser = { id: 1, username: "testuser" };
      const mockPayee = {
        id: 1,
        business_name: "Test Company",
        email: "test@example.com",
        phone: "+1234567890",
        street_address: "123 Main St",
        address_line_2: null,
        city: "San Francisco",
        state_or_territory: "CA",
        postal_code: "94102",
        country: "United States",
        account_number: "1234567890",
        routing_number: "123456789",
        is_active: true,
      };

      vi.mocked(getAuthUserFromRequest).mockResolvedValue({
        ok: true,
        supabaseUser: { id: "user-123" },
      } as never);

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.billPayPayee.findFirst.mockResolvedValue(null); // No existing payee
      mockPrisma.billPayPayee.create.mockResolvedValue(mockPayee);

      const request = new Request("http://localhost:3000/api/billpay/payees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: "Test Company",
          email: "test@example.com",
          phone: "+1234567890",
          street_address: "123 Main St",
          city: "San Francisco",
          state_or_territory: "CA",
          postal_code: "94102",
          account_number: "1234567890",
          routing_number: "123456789",
        }),
      });

      const response = await POST(request);
      const data = (await response.json()) as { payee: unknown };

      expect(response.status).toBe(201);
      expect(data.payee).toMatchObject({
        id: 1,
        business_name: "Test Company",
      });
    });

    it("returns existing payee if already exists (idempotent)", async () => {
      const mockUser = { id: 1, username: "testuser" };
      const existingPayee = {
        id: 1,
        business_name: "Test Company",
        email: "test@example.com",
        phone: "+1234567890",
        street_address: "123 Main St",
        address_line_2: null,
        city: "San Francisco",
        state_or_territory: "CA",
        postal_code: "94102",
        country: "United States",
        account_number: "1234567890",
        routing_number: "123456789",
        is_active: true,
      };

      vi.mocked(getAuthUserFromRequest).mockResolvedValue({
        ok: true,
        supabaseUser: { id: "user-123" },
      } as never);

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.billPayPayee.findFirst.mockResolvedValue(existingPayee);

      const request = new Request("http://localhost:3000/api/billpay/payees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: "Test Company",
          email: "test@example.com",
          phone: "+1234567890",
          street_address: "123 Main St",
          city: "San Francisco",
          state_or_territory: "CA",
          postal_code: "94102",
          account_number: "1234567890",
          routing_number: "123456789",
        }),
      });

      const response = await POST(request);
      const data = (await response.json()) as { payee: unknown };

      expect(response.status).toBe(200);
      expect(data.payee).toMatchObject({
        id: 1,
        business_name: "Test Company",
      });
      // Should not create a new payee
      expect(mockPrisma.billPayPayee.create).not.toHaveBeenCalled();
    });

    it("supports black hole - creates payee even if external account doesn't exist", async () => {
      const mockUser = { id: 1, username: "testuser" };
      const mockPayee = {
        id: 1,
        business_name: "Nonexistent Company",
        email: "fake@example.com",
        phone: "+1234567890",
        street_address: "123 Fake St",
        address_line_2: null,
        city: "Nowhere",
        state_or_territory: "CA",
        postal_code: "00000",
        country: "United States",
        account_number: "9999999999", // Fake account number
        routing_number: "999999999", // Fake routing number
        is_active: true,
      };

      vi.mocked(getAuthUserFromRequest).mockResolvedValue({
        ok: true,
        supabaseUser: { id: "user-123" },
      } as never);

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.billPayPayee.findFirst.mockResolvedValue(null);
      mockPrisma.billPayPayee.create.mockResolvedValue(mockPayee);

      const request = new Request("http://localhost:3000/api/billpay/payees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: "Nonexistent Company",
          email: "fake@example.com",
          phone: "+1234567890",
          street_address: "123 Fake St",
          city: "Nowhere",
          state_or_territory: "CA",
          postal_code: "00000",
          account_number: "9999999999", // Fake account - black hole
          routing_number: "999999999", // Fake routing - black hole
        }),
      });

      const response = await POST(request);
      const data = (await response.json()) as { payee: unknown };

      expect(response.status).toBe(201);
      expect(data.payee).toMatchObject({
        account_number: "9999999999",
        routing_number: "999999999",
      });
      // Should create payee even with fake account info (black hole)
      expect(mockPrisma.billPayPayee.create).toHaveBeenCalled();
    });
  });
});
