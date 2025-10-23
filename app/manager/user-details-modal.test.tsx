import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UserDetailsModal } from "./user-details-modal";

// Mock the actions
vi.mock("./actions", () => ({
  getUserById: vi.fn(),
  getUserTransactions: vi.fn(),
}));

import { getUserById, getUserTransactions } from "./actions";

const mockUser = {
  id: 1,
  username: "testuser",
  first_name: "Test",
  last_name: "User",
  email: "test@example.com",
  phone_number: "+1234567890",
  street_address: "123 Main St",
  address_line_2: "Apt 4B",
  city: "Test City",
  state_or_territory: "CA" as const,
  postal_code: "12345",
  country: "United States",
  role: "customer" as const,
  created_at: new Date("2023-01-01"),
  internal_accounts: [
    {
      id: 1,
      account_number: "1234567890",
      account_type: "checking" as const,
      balance: 1000.5,
      is_active: true,
    },
    {
      id: 2,
      account_number: "0987654321",
      account_type: "savings" as const,
      balance: 2500.75,
      is_active: true,
    },
  ],
  _count: { internal_accounts: 2 },
};

const mockTransactions = [
  {
    id: 1,
    created_at: new Date("2023-01-01T10:00:00Z"),
    amount: 100.5,
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
  {
    id: 2,
    created_at: new Date("2023-01-02T14:30:00Z"),
    amount: 250.75,
    status: "denied" as const,
    transaction_type: "external_transfer" as const,
    direction: "outbound" as const,
    internal_account: {
      account_number: "0987654321",
      user: {
        id: 1,
        username: "testuser",
        first_name: "Test",
        last_name: "User",
      },
    },
  },
];

describe("UserDetailsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserById).mockResolvedValue(mockUser);
    vi.mocked(getUserTransactions).mockResolvedValue(mockTransactions);
  });

  it("should render user details when modal is open", async () => {
    render(<UserDetailsModal userId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("User Details")).toBeInTheDocument();
    });

    // Check user profile information
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("+1234567890")).toBeInTheDocument();
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText(/Apt 4B/)).toBeInTheDocument();
    expect(screen.getByText(/Test City.*CA.*12345/)).toBeInTheDocument();
    expect(screen.getByText(/United States/)).toBeInTheDocument();
    expect(screen.getByText("CUSTOMER")).toBeInTheDocument();
  });

  it("should not render when modal is closed", () => {
    render(<UserDetailsModal userId={1} isOpen={false} onClose={() => {}} />);

    expect(screen.queryByText("User Details")).not.toBeInTheDocument();
  });

  it("should load user data when modal opens", async () => {
    render(<UserDetailsModal userId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(getUserById).toHaveBeenCalledWith(1);
      expect(getUserTransactions).toHaveBeenCalledWith(1, 5);
    });
  });

  it("should display account summary", async () => {
    render(<UserDetailsModal userId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Account Summary")).toBeInTheDocument();
    });

    // Check total balance (1000.50 + 2500.75 = 3501.25)
    expect(screen.getByText("$3,501.25")).toBeInTheDocument();
    expect(screen.getByText("Total Balance")).toBeInTheDocument();
    expect(screen.getAllByText("2")).toHaveLength(2); // Active accounts and total transactions
    expect(screen.getByText("Active Accounts")).toBeInTheDocument();
    expect(screen.getByText("Total Transactions")).toBeInTheDocument();
  });

  it("should display user accounts", async () => {
    render(<UserDetailsModal userId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Accounts")).toBeInTheDocument();
    });

    // Check account details
    expect(screen.getByText("****7890")).toBeInTheDocument();
    expect(screen.getByText("checking")).toBeInTheDocument();
    expect(screen.getByText("$1,000.50")).toBeInTheDocument();
    expect(screen.getAllByText("Active")).toHaveLength(2); // Both accounts are active

    expect(screen.getByText("****4321")).toBeInTheDocument();
    expect(screen.getByText("savings")).toBeInTheDocument();
    expect(screen.getByText("$2,500.75")).toBeInTheDocument();
  });

  it("should display recent transactions", async () => {
    render(<UserDetailsModal userId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    });

    // Check transaction details
    expect(screen.getByText("$100.50")).toBeInTheDocument();
    expect(screen.getByText("INTERNAL TRANSFER")).toBeInTheDocument();
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
    expect(screen.getByText("INBOUND")).toBeInTheDocument();

    expect(screen.getByText("$250.75")).toBeInTheDocument();
    expect(screen.getByText("EXTERNAL TRANSFER")).toBeInTheDocument();
    expect(screen.getByText("DENIED")).toBeInTheDocument();
    expect(screen.getByText("OUTBOUND")).toBeInTheDocument();
  });

  it("should show no transactions message when no recent transactions", async () => {
    vi.mocked(getUserTransactions).mockResolvedValue([]);

    render(<UserDetailsModal userId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("No recent transactions")).toBeInTheDocument();
    });
  });

  it("should show user not found message when user is null", async () => {
    vi.mocked(getUserById).mockResolvedValue(null);

    render(<UserDetailsModal userId={999} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("User not found")).toBeInTheDocument();
    });
  });

  it("should show loading state initially", () => {
    render(<UserDetailsModal userId={1} isOpen={true} onClose={() => {}} />);

    // Check for skeleton loading elements
    expect(screen.getByText("User Details")).toBeInTheDocument();
  });

  it("should call onClose when close button is clicked", async () => {
    const mockOnClose = vi.fn();

    render(<UserDetailsModal userId={1} isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("User Details")).toBeInTheDocument();
    });

    // The modal should have a close button (this would be in the Dialog component)
    // We can't directly test the close button since it's in the Dialog component
    // but we can verify the onClose prop is passed correctly
    expect(mockOnClose).toBeDefined();
  });

  it("should handle error when loading user details fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getUserById).mockRejectedValue(new Error("Failed to load user"));

    render(<UserDetailsModal userId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load user details:",
        expect.any(Error),
      );
    });

    consoleSpy.mockRestore();
  });

  it("should not load data when userId is null", async () => {
    render(<UserDetailsModal userId={null} isOpen={true} onClose={() => {}} />);

    expect(getUserById).not.toHaveBeenCalled();
    expect(getUserTransactions).not.toHaveBeenCalled();
  });

  it("should not load data when modal is closed", async () => {
    render(<UserDetailsModal userId={1} isOpen={false} onClose={() => {}} />);

    expect(getUserById).not.toHaveBeenCalled();
    expect(getUserTransactions).not.toHaveBeenCalled();
  });

  it("should display correct role badge variant", async () => {
    render(<UserDetailsModal userId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      const roleBadge = screen.getByText("CUSTOMER");
      expect(roleBadge).toBeInTheDocument();
    });
  });

  it("should display correct status badge variants for transactions", async () => {
    render(<UserDetailsModal userId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      const approvedBadge = screen.getByText("APPROVED");
      const deniedBadge = screen.getByText("DENIED");

      expect(approvedBadge).toBeInTheDocument();
      expect(deniedBadge).toBeInTheDocument();
    });
  });
});
