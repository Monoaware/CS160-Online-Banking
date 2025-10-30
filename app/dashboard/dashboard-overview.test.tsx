import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardOverview } from "./dashboard-overview";

describe("DashboardOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading state when data is null", () => {
    render(<DashboardOverview initialData={null} />);
    // While loading, the real content headings shouldn't be present
    expect(screen.queryByText(/Total Balance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Your Accounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recent Activity/i)).not.toBeInTheDocument();
  });

  it("should display dashboard data when provided", () => {
    const mockAccounts = [
      {
        id: 1,
        account_number: "12345678901234567",
        routing_number: "724722907",
        account_type: "checking" as const,
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
        direction: "inbound" as const,
        status: "approved" as const,
        created_at: "2024-01-01T00:00:00Z",
        internal_account_id: 1,
      },
    ];

    const mockData = {
      accounts: mockAccounts,
      transactions: mockTransactions,
      totalBalance: 1000.0,
    };

    render(<DashboardOverview initialData={mockData} />);

    expect(screen.getAllByText("$1,000.00")).toHaveLength(2);
    expect(screen.getByText("1")).toBeInTheDocument(); // Active accounts count
    expect(screen.getByText(/checking Account/i)).toBeInTheDocument();
  });

  it("should show no accounts message when user has no accounts", () => {
    const mockData = {
      accounts: [],
      transactions: [],
      totalBalance: 0,
    };

    render(<DashboardOverview initialData={mockData} />);

    expect(screen.getByText("No accounts found")).toBeInTheDocument();
  });
});
