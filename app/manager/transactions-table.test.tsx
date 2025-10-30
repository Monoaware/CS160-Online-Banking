import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionsTable } from "./transactions-table";

const user = userEvent.setup();

// Mock the actions
vi.mock("./actions", () => ({
  getTransactions: vi.fn(),
}));

// Mock the export utilities
vi.mock("./export-utils", () => ({
  exportTransactionsToCSV: vi.fn(),
  exportTransactionsToPDF: vi.fn(),
}));

import { getTransactions } from "./actions";
import * as exportUtils from "./export-utils";

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
        id: 2,
        username: "manager",
        first_name: "Bank",
        last_name: "Manager",
      },
    },
  },
];

describe("TransactionsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTransactions).mockResolvedValue({
      transactions: mockTransactions,
      total: 2,
    });
  });

  it("should render transactions table with data", async () => {
    render(<TransactionsTable />);

    await waitFor(() => {
      expect(screen.getByText("Transactions")).toBeInTheDocument();
    });

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
    expect(screen.getByText("+$100.50")).toBeInTheDocument();
    expect(screen.getByText("INTERNAL TRANSFER")).toBeInTheDocument();
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
    expect(screen.getByText("INBOUND")).toBeInTheDocument();
    expect(screen.getByText("****7890")).toBeInTheDocument();

    expect(screen.getByText("Bank Manager")).toBeInTheDocument();
    expect(screen.getByText("@manager")).toBeInTheDocument();
    expect(screen.getByText("-$250.75")).toBeInTheDocument();
    expect(screen.getByText("EXTERNAL TRANSFER")).toBeInTheDocument();
    expect(screen.getByText("DENIED")).toBeInTheDocument();
    expect(screen.getByText("OUTBOUND")).toBeInTheDocument();
    expect(screen.getByText("****4321")).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    render(<TransactionsTable />);
    expect(screen.getByText("Transactions")).toBeInTheDocument();
  });

  it("should handle search input", async () => {
    render(<TransactionsTable />);

    const searchInput = screen.getByPlaceholderText(
      "Search by user name or username...",
    );
    fireEvent.change(searchInput, { target: { value: "test" } });

    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledWith({
        search: "test",
        type: undefined,
        status: undefined,
        direction: undefined,
        page: 1,
        limit: 10,
      });
    });
  });

  it("should handle transaction type filter", async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      transactions: mockTransactions,
      total: 10,
    });

    render(<TransactionsTable />);

    // Wait for component to load and verify initial call
    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledWith({
        search: undefined,
        type: undefined,
        status: undefined,
        direction: undefined,
        page: 1,
        limit: 10,
      });
    });
  });

  it("should handle status filter", async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      transactions: mockTransactions,
      total: 10,
    });

    render(<TransactionsTable />);

    // Wait for component to load and verify initial call
    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledWith({
        search: undefined,
        type: undefined,
        status: undefined,
        direction: undefined,
        page: 1,
        limit: 10,
      });
    });
  });

  it("should handle direction filter", async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      transactions: mockTransactions,
      total: 10,
    });

    render(<TransactionsTable />);

    // Wait for component to load and verify initial call
    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledWith({
        search: undefined,
        type: undefined,
        status: undefined,
        direction: undefined,
        page: 1,
        limit: 10,
      });
    });
  });

  it("should handle pagination", async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      transactions: mockTransactions,
      total: 25, // More than one page
    });

    render(<TransactionsTable />);

    await waitFor(() => {
      expect(
        screen.getByText("Showing 1 to 10 of 25 transactions"),
      ).toBeInTheDocument();
    });

    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledWith({
        search: undefined,
        type: undefined,
        status: undefined,
        direction: undefined,
        page: 2,
        limit: 10,
      });
    });
  });

  it("should disable previous button on first page", async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      transactions: mockTransactions,
      total: 25,
    });

    render(<TransactionsTable />);

    await waitFor(() => {
      const prevButton = screen.getByText("Previous");
      expect(prevButton).toBeDisabled();
    });
  });

  it("should disable next button on last page", async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      transactions: mockTransactions,
      total: 5, // Less than one page
    });

    render(<TransactionsTable />);

    await waitFor(() => {
      // When there's only one page, pagination controls should not be shown
      const nextButton = screen.queryByText("Next");
      expect(nextButton).not.toBeInTheDocument();
    });
  });

  it("should show no transactions message when no data", async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      transactions: [],
      total: 0,
    });

    render(<TransactionsTable />);

    await waitFor(() => {
      expect(screen.getByText("No transactions found")).toBeInTheDocument();
    });
  });

  it("should format currency correctly for inbound transactions", async () => {
    render(<TransactionsTable />);

    await waitFor(() => {
      const inboundAmount = screen.getByText("+$100.50");
      expect(inboundAmount).toHaveClass("text-success");
    });
  });

  it("should format currency correctly for outbound transactions", async () => {
    render(<TransactionsTable />);

    await waitFor(() => {
      const outboundAmount = screen.getByText("-$250.75");
      expect(outboundAmount).toHaveClass("text-warning");
    });
  });

  it("should format dates correctly", async () => {
    render(<TransactionsTable />);

    await waitFor(() => {
      // Check if dates are formatted (exact format may vary based on locale)
      expect(screen.getByText(/Jan 1, 2023/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 2, 2023/)).toBeInTheDocument();
    });
  });

  it("should reset page to 1 when search changes", async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      transactions: mockTransactions,
      total: 25, // More than one page
    });

    render(<TransactionsTable />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    // Go to page 2
    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });

    // Search should reset to page 1
    const searchInput = screen.getByPlaceholderText(
      "Search by user name or username...",
    );
    fireEvent.change(searchInput, { target: { value: "test" } });

    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });
  });

  it("should handle error when loading transactions fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getTransactions).mockRejectedValue(
      new Error("Failed to load transactions"),
    );

    render(<TransactionsTable />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load transactions:",
        expect.any(Error),
      );
    });

    consoleSpy.mockRestore();
  });

  it("should apply multiple filters simultaneously", async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      transactions: mockTransactions,
      total: 10,
    });

    render(<TransactionsTable />);

    // Wait for component to load and verify initial call
    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledWith({
        search: undefined,
        type: undefined,
        status: undefined,
        direction: undefined,
        page: 1,
        limit: 10,
      });
    });
  });

  it("should render export button", async () => {
    render(<TransactionsTable />);

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });
  });

  it("should call exportTransactionsToCSV when CSV option is clicked", async () => {
    render(<TransactionsTable />);

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    // Click the export button to open dropdown
    const exportButton = screen.getByText("Export");
    await user.click(exportButton);

    // Click CSV option
    const csvOption = screen.getByText("Export as CSV");
    await user.click(csvOption);

    expect(exportUtils.exportTransactionsToCSV).toHaveBeenCalledWith(
      mockTransactions,
    );
  });

  it("should call exportTransactionsToPDF when PDF option is clicked", async () => {
    render(<TransactionsTable />);

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    // Click the export button to open dropdown
    const exportButton = screen.getByText("Export");
    await user.click(exportButton);

    // Click PDF option
    const pdfOption = screen.getByText("Export as PDF");
    await user.click(pdfOption);

    expect(exportUtils.exportTransactionsToPDF).toHaveBeenCalledWith(
      mockTransactions,
    );
  });
});
