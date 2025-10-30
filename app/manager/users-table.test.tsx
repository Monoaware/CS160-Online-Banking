import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsersTable } from "./users-table";

const user = userEvent.setup();

// Mock the actions
vi.mock("./actions", () => ({
  getUsers: vi.fn(),
}));

// Mock the user details modal
vi.mock("./user-details-modal", () => ({
  UserDetailsModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="user-details-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

// Mock the export utilities
vi.mock("./export-utils", () => ({
  exportUsersToCSV: vi.fn(),
  exportUsersToPDF: vi.fn(),
}));

import { getUsers } from "./actions";
import * as exportUtils from "./export-utils";

const mockUsers = [
  {
    id: 1,
    username: "testuser",
    first_name: "Test",
    last_name: "User",
    email: "test@example.com",
    role: "customer" as const,
    created_at: new Date("2023-01-01"),
    state_or_territory: "CA" as const,
    _count: { internal_accounts: 2 },
  },
  {
    id: 2,
    username: "manager",
    first_name: "Bank",
    last_name: "Manager",
    email: "manager@example.com",
    role: "bank_manager" as const,
    created_at: new Date("2023-01-02"),
    state_or_territory: "NY" as const,
    _count: { internal_accounts: 1 },
  },
];

describe("UsersTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUsers).mockResolvedValue({
      users: mockUsers,
      total: 2,
    });
  });

  it("should render users table with data", async () => {
    render(<UsersTable />);

    await waitFor(() => {
      expect(screen.getByText("Users")).toBeInTheDocument();
    });

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("CUSTOMER")).toBeInTheDocument();
    expect(screen.getByText("CA")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    expect(screen.getByText("Bank Manager")).toBeInTheDocument();
    expect(screen.getByText("@manager")).toBeInTheDocument();
    expect(screen.getByText("manager@example.com")).toBeInTheDocument();
    expect(screen.getByText("BANK MANAGER")).toBeInTheDocument();
    expect(screen.getByText("NY")).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    render(<UsersTable />);
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("should handle search input", async () => {
    render(<UsersTable />);

    const searchInput = screen.getByPlaceholderText(
      "Search by name, username, or email...",
    );
    fireEvent.change(searchInput, { target: { value: "test" } });

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledWith({
        search: "test",
        role: undefined,
        state: undefined,
        page: 1,
        limit: 10,
      });
    });
  });

  it("should handle role filter", async () => {
    vi.mocked(getUsers).mockResolvedValue({
      users: mockUsers,
      total: 10,
    });

    render(<UsersTable />);

    // Wait for component to load and verify initial call
    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledWith({
        search: undefined,
        role: undefined,
        state: undefined,
        page: 1,
        limit: 10,
      });
    });
  });

  it("should handle state filter", async () => {
    vi.mocked(getUsers).mockResolvedValue({
      users: mockUsers,
      total: 10,
    });

    render(<UsersTable />);

    // Wait for component to load and verify initial call
    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledWith({
        search: undefined,
        role: undefined,
        state: undefined,
        page: 1,
        limit: 10,
      });
    });
  });

  it("should open user details modal when row is clicked", async () => {
    render(<UsersTable />);

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    const userRow = screen.getByText("Test User").closest("tr");
    fireEvent.click(userRow!);

    expect(screen.getByTestId("user-details-modal")).toBeInTheDocument();
  });

  it("should handle pagination", async () => {
    vi.mocked(getUsers).mockResolvedValue({
      users: mockUsers,
      total: 25, // More than one page
    });

    render(<UsersTable />);

    await waitFor(() => {
      expect(
        screen.getByText("Showing 1 to 10 of 25 users"),
      ).toBeInTheDocument();
    });

    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledWith({
        search: undefined,
        role: undefined,
        state: undefined,
        page: 2,
        limit: 10,
      });
    });
  });

  it("should disable previous button on first page", async () => {
    vi.mocked(getUsers).mockResolvedValue({
      users: mockUsers,
      total: 25,
    });

    render(<UsersTable />);

    await waitFor(() => {
      const prevButton = screen.getByText("Previous");
      expect(prevButton).toBeDisabled();
    });
  });

  it("should disable next button on last page", async () => {
    vi.mocked(getUsers).mockResolvedValue({
      users: mockUsers,
      total: 5, // Less than one page
    });

    render(<UsersTable />);

    await waitFor(() => {
      // When there's only one page, pagination controls should not be shown
      const nextButton = screen.queryByText("Next");
      expect(nextButton).not.toBeInTheDocument();
    });
  });

  it("should show no users message when no data", async () => {
    vi.mocked(getUsers).mockResolvedValue({
      users: [],
      total: 0,
    });

    render(<UsersTable />);

    await waitFor(() => {
      expect(screen.getByText("No users found")).toBeInTheDocument();
    });
  });

  it("should close modal when close button is clicked", async () => {
    render(<UsersTable />);

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    // Open modal
    const userRow = screen.getByText("Test User").closest("tr");
    fireEvent.click(userRow!);

    expect(screen.getByTestId("user-details-modal")).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);

    expect(screen.queryByTestId("user-details-modal")).not.toBeInTheDocument();
  });

  it("should reset page to 1 when search changes", async () => {
    vi.mocked(getUsers).mockResolvedValue({
      users: mockUsers,
      total: 25, // More than one page
    });

    render(<UsersTable />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    // Go to page 2
    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });

    // Search should reset to page 1
    const searchInput = screen.getByPlaceholderText(
      "Search by name, username, or email...",
    );
    fireEvent.change(searchInput, { target: { value: "test" } });

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });
  });

  it("should handle error when loading users fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getUsers).mockRejectedValue(new Error("Failed to load users"));

    render(<UsersTable />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load users:",
        expect.any(Error),
      );
    });

    consoleSpy.mockRestore();
  });

  it("should render export button", async () => {
    render(<UsersTable />);

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });
  });

  it("should call exportUsersToCSV when CSV option is clicked", async () => {
    render(<UsersTable />);

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    // Click the export button to open dropdown
    const exportButton = screen.getByText("Export");
    await user.click(exportButton);

    // Click CSV option
    const csvOption = screen.getByText("Export as CSV");
    await user.click(csvOption);

    expect(exportUtils.exportUsersToCSV).toHaveBeenCalledWith(mockUsers);
  });

  it("should call exportUsersToPDF when PDF option is clicked", async () => {
    render(<UsersTable />);

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    // Click the export button to open dropdown
    const exportButton = screen.getByText("Export");
    await user.click(exportButton);

    // Click PDF option
    const pdfOption = screen.getByText("Export as PDF");
    await user.click(pdfOption);

    expect(exportUtils.exportUsersToPDF).toHaveBeenCalledWith(mockUsers);
  });
});
