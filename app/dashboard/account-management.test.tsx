import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountManagement } from "./account-management";

// Mock supabase client
const mockGetSession = vi.fn();
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe("AccountManagement", () => {
  const mockSession = {
    access_token: "mock-token-123",
    user: { id: "user-123" },
  };

  const mockAccounts = {
    accounts: [
      {
        id: 1,
        account_number: "12345678901234567",
        routing_number: "724722907",
        account_type: "checking" as const,
        balance: 10000, // $100.00 in cents
        is_active: true,
        created_at: "2024-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        account_number: "98765432109876543",
        routing_number: "724722907",
        account_type: "savings" as const,
        balance: 50000, // $500.00 in cents
        is_active: true,
        created_at: "2024-01-02T00:00:00.000Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("shows loading state initially", () => {
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>(() => {
        /* never resolves */
      }),
    );

    render(<AccountManagement />);
    expect(screen.getByText("Loading accounts...")).toBeInTheDocument();
  });

  it("fetches and displays accounts", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccounts,
    } as Response);

    render(<AccountManagement />);

    await waitFor(() => {
      expect(screen.getByText(/Checking Account/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Savings Account/)).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByText("12345678901234567")).toBeInTheDocument();
    // Multiple accounts have same routing number, so check first one
    const routingNumbers = screen.getAllByText("724722907");
    expect(routingNumbers.length).toBeGreaterThan(0);
  });

  it("displays error when fetch fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Failed to fetch accounts" } }),
    } as Response);

    render(<AccountManagement />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch accounts")).toBeInTheDocument();
    });
  });

  it.skip("shows create form when button is clicked", async () => {
    // Skipped: Create New Account functionality removed from component
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccounts,
    } as Response);

    render(<AccountManagement />);

    await waitFor(() => {
      expect(screen.getByText("Your Accounts")).toBeInTheDocument();
    });
  });

  it.skip("creates account successfully", async () => {
    // Skipped: Create New Account functionality removed from component
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccounts,
    } as Response);

    render(<AccountManagement />);

    await waitFor(() => {
      expect(screen.getByText("Your Accounts")).toBeInTheDocument();
    });
  });

  it("copies account number to clipboard", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccounts,
    } as Response);

    render(<AccountManagement />);

    await waitFor(() => {
      expect(screen.getByText(/Checking Account/)).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByRole("button");
    const accountCopyButton = copyButtons.find((button) =>
      button.querySelector('[class*="copy"]'),
    );

    expect(accountCopyButton).toBeDefined();
    if (accountCopyButton) {
      fireEvent.click(accountCopyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          "12345678901234567",
        );
      });
    }
  });

  it("shows message when no accounts exist", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    } as Response);

    render(<AccountManagement />);

    await waitFor(() => {
      expect(
        screen.getByText(/You don't have any accounts yet\./),
      ).toBeInTheDocument();
    });
  });

  it.skip("handles account creation error", async () => {
    // Skipped: Create New Account functionality removed from component
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccounts,
    } as Response);

    render(<AccountManagement />);

    await waitFor(() => {
      expect(screen.getByText("Your Accounts")).toBeInTheDocument();
    });
  });
});
