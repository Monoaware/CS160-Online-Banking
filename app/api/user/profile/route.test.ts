import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "./route";
import { USStateTerritory } from "@prisma/client";

// Mock the Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
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
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => {
    // Return the function directly for testing
    return async () => await fn();
  }),
}));

import { getAuthUserFromRequest } from "@/lib/auth";

describe("GET /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    } as never);

    const request = new Request("http://localhost:3000/api/user/profile");
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

    const request = new Request("http://localhost:3000/api/user/profile");
    const response = await GET(request);
    const data = (await response.json()) as { message: string };

    expect(response.status).toBe(404);
    expect(data).toEqual({ message: "User not onboarded" });
  });

  it("returns user profile for authenticated user", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      auth_user_id: "user-123",
      email: "test@example.com",
      first_name: "John",
      last_name: "Doe",
      phone_number: "+15555555555",
      street_address: "123 Main St",
      address_line_2: "Apt 4",
      city: "San Francisco",
      state_or_territory: "CA",
      postal_code: "94102",
      country: "United States",
      role: "customer",
      created_at: new Date("2024-01-01"),
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    // First call: get dbUser.id, second call: get full user profile (from cache function)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 1 }) // For cache key
      .mockResolvedValueOnce(mockUser); // For cached profile

    const request = new Request("http://localhost:3000/api/user/profile");
    const response = await GET(request);
    const data = (await response.json()) as { user: typeof mockUser };

    expect(response.status).toBe(200);
    expect(data.user.first_name).toBe("John");
    expect(data.user.last_name).toBe("Doe");
    expect(data.user.email).toBe("test@example.com");
    expect(data.user.city).toBe("San Francisco");
  });
});

describe("PUT /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: "Unauthorized" },
    } as never);

    const request = new Request("http://localhost:3000/api/user/profile", {
      method: "PUT",
      body: JSON.stringify({}),
    });
    const response = await PUT(request);
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

    const request = new Request("http://localhost:3000/api/user/profile", {
      method: "PUT",
      body: JSON.stringify({}),
    });
    const response = await PUT(request);
    const data = (await response.json()) as { message: string };

    expect(response.status).toBe(404);
    expect(data).toEqual({ message: "User not onboarded" });
  });

  it("returns 422 when required fields are missing", async () => {
    const mockUser = {
      id: 1,
      auth_user_id: "user-123",
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const request = new Request("http://localhost:3000/api/user/profile", {
      method: "PUT",
      body: JSON.stringify({
        first_name: "John",
        // Missing other required fields
      }),
    });
    const response = await PUT(request);
    const data = (await response.json()) as {
      message: string;
      errors: unknown;
    };

    expect(response.status).toBe(422);
    expect(data.message).toBe("Validation failed");
    expect(data.errors).toBeDefined();
  });

  it("returns 422 when state_or_territory is invalid", async () => {
    const mockUser = {
      id: 1,
      auth_user_id: "user-123",
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const request = new Request("http://localhost:3000/api/user/profile", {
      method: "PUT",
      body: JSON.stringify({
        first_name: "John",
        last_name: "Doe",
        phone_number: "+15555555555",
        street_address: "123 Main St",
        city: "San Francisco",
        state_or_territory: "INVALID",
        postal_code: "94102",
      }),
    });
    const response = await PUT(request);
    const data = (await response.json()) as {
      message: string;
      errors: unknown;
    };

    expect(response.status).toBe(422);
    expect(data.message).toBe("Validation failed");
    expect(data.errors).toBeDefined();
  });

  it("successfully updates user profile", async () => {
    const mockUser = {
      id: 1,
      auth_user_id: "user-123",
      email: "test@example.com",
      username: "testuser",
      first_name: "John",
      last_name: "Doe",
      phone_number: "+15555555555",
      street_address: "123 Main St",
      address_line_2: null,
      city: "San Francisco",
      state_or_territory: USStateTerritory.CA,
      postal_code: "94102",
      country: "United States",
      role: "customer",
      created_at: new Date("2024-01-01"),
    };

    const updatedData = {
      first_name: "Jane",
      last_name: "Smith",
      phone_number: "+15559999999",
      street_address: "456 Oak Ave",
      address_line_2: "Suite 200",
      city: "Los Angeles",
      state_or_territory: USStateTerritory.CA,
      postal_code: "90001",
    };

    const updatedUser = {
      ...mockUser,
      ...updatedData,
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue(updatedUser);

    const request = new Request("http://localhost:3000/api/user/profile", {
      method: "PUT",
      body: JSON.stringify(updatedData),
    });
    const response = await PUT(request);
    const data = (await response.json()) as { user: typeof updatedUser };

    expect(response.status).toBe(200);
    expect(data.user.first_name).toBe("Jane");
    expect(data.user.last_name).toBe("Smith");
    expect(data.user.city).toBe("Los Angeles");

    // Verify update was called with correct data
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: expect.objectContaining({
        first_name: "Jane",
        last_name: "Smith",
        city: "Los Angeles",
      }),
    });
  });

  it("handles null address_line_2", async () => {
    const mockUser = {
      id: 1,
      auth_user_id: "user-123",
    };

    const updatedUser = {
      id: 1,
      auth_user_id: "user-123",
      address_line_2: null,
    };

    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      ok: true,
      supabaseUser: { id: "user-123" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue(updatedUser);

    const request = new Request("http://localhost:3000/api/user/profile", {
      method: "PUT",
      body: JSON.stringify({
        first_name: "John",
        last_name: "Doe",
        phone_number: "+15555555555",
        street_address: "123 Main St",
        city: "San Francisco",
        state_or_territory: USStateTerritory.CA,
        postal_code: "94102",
        // address_line_2 not provided
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: expect.objectContaining({
        address_line_2: null,
      }),
    });
  });
});
