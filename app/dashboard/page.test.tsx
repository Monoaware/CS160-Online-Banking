import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DashboardPage from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path) => {
    throw new Error(`Redirect to ${path}`);
  }),
}));

// Mock next/headers - this will throw in test context, which we handle
vi.mock("next/headers", () => ({
  headers: vi.fn(() => {
    throw new Error("headers() called outside request context");
  }),
}));

// Mock next/cache - unstable_cache needs to be mocked for tests
vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn) => {
    // Return the function directly for testing (bypassing cache)
    return async () => await fn();
  }),
}));

// Mock supabase server client
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  })),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock DashboardClient component
vi.mock("./dashboard-client", () => ({
  DashboardClient: ({ initialData }: { initialData: unknown }) => (
    <div data-testid="dashboard-client">
      Dashboard Client - Data: {initialData ? "present" : "null"}
    </div>
  ),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(async () => {
      await DashboardPage();
    }).rejects.toThrow("Redirect to /login");
  });

  it("redirects to login when session is not available", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    await expect(async () => {
      await DashboardPage();
    }).rejects.toThrow("Redirect to /login");
  });

  it("fetches dashboard data and renders DashboardClient", async () => {
    const mockSession = {
      access_token: "mock-token",
    };

    const mockAccounts = [
      {
        id: 1,
        account_number: "12345678901234567",
        routing_number: "724722907",
        account_type: "checking",
        balance: 1000.0,
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ];

    const mockTransactions = [
      {
        id: 1,
        amount: 100.0,
        transaction_type: "deposit",
        direction: "inbound",
        status: "approved",
        created_at: "2024-01-01T00:00:00Z",
        internal_account_id: 1,
      },
    ];

    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: mockAccounts }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactions: mockTransactions }),
      } as Response);

    const PageComponent = await DashboardPage();
    render(PageComponent);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-client")).toBeInTheDocument();
      expect(screen.getByText(/Data: present/)).toBeInTheDocument();
    });
  });
});
