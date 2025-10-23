// Mock Next.js components
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock Supabase client
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock Prisma
vi.mock("@/app/lib/prisma", () => ({
  getPrisma: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import ManagerLayout from "./layout";

// Mock Navbar component
vi.mock("@/components/navbar", () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

import { createClient } from "@/utils/supabase/server";
import { getPrisma } from "@/app/lib/prisma";
import { notFound } from "next/navigation";

describe("ManagerLayout", () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
  };

  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof createClient>,
    );
    vi.mocked(getPrisma).mockReturnValue(
      mockPrisma as unknown as ReturnType<typeof getPrisma>,
    );
    // Reset notFound mock to default behavior
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("notFound called");
    });
  });

  it("should show 404 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    // Mock notFound to throw an error to stop execution
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("notFound called");
    });

    // Check if the mock is working
    const result = await mockSupabase.auth.getUser();
    expect(result.data.user).toBeNull();

    await expect(ManagerLayout({ children: <div>Test</div> })).rejects.toThrow(
      "notFound called",
    );

    expect(notFound).toHaveBeenCalled();
  });

  it("should show 404 when user is not a manager", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "customer",
    });

    // Mock notFound to throw an error to stop execution
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("notFound called");
    });

    await expect(ManagerLayout({ children: <div>Test</div> })).rejects.toThrow(
      "notFound called",
    );

    expect(notFound).toHaveBeenCalled();
  });

  it("should show 404 when user is not found in database", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    // Mock notFound to throw an error to stop execution
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("notFound called");
    });

    await expect(ManagerLayout({ children: <div>Test</div> })).rejects.toThrow(
      "notFound called",
    );

    expect(notFound).toHaveBeenCalled();
  });

  it("should render manager dashboard when user is a bank manager", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "bank_manager",
      first_name: "John",
      last_name: "Manager",
    });

    // Mock notFound to do nothing for this test (successful case)
    vi.mocked(notFound).mockImplementation((): never => {
      // Do nothing - this should not be called in successful cases
      throw new Error("This should not be called");
    });

    await ManagerLayout({ children: <div>Test Content</div> });

    // Since this is a server component, we can't directly test the rendered output
    // But we can verify that notFound was not called
    expect(notFound).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { auth_user_id: "test-user-id" },
      select: { role: true, first_name: true, last_name: true },
    });
  });

  it("should call Supabase auth to get user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "bank_manager",
      first_name: "John",
      last_name: "Manager",
    });

    // Mock notFound to do nothing for this test (successful case)
    vi.mocked(notFound).mockImplementation((): never => {
      // Do nothing - this should not be called in successful cases
      throw new Error("This should not be called");
    });

    await ManagerLayout({ children: <div>Test</div> });

    expect(mockSupabase.auth.getUser).toHaveBeenCalled();
  });

  it("should query database for user role", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "bank_manager",
      first_name: "John",
      last_name: "Manager",
    });

    // Mock notFound to do nothing for this test (successful case)
    vi.mocked(notFound).mockImplementation((): never => {
      // Do nothing - this should not be called in successful cases
      throw new Error("This should not be called");
    });

    await ManagerLayout({ children: <div>Test</div> });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { auth_user_id: "test-user-id" },
      select: { role: true, first_name: true, last_name: true },
    });
  });
});
