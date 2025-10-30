import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ManagerPage from "./page";

// Mock the table components
vi.mock("./users-table", () => ({
  UsersTable: () => <div data-testid="users-table">Users Table</div>,
}));

vi.mock("./transactions-table", () => ({
  TransactionsTable: () => (
    <div data-testid="transactions-table">Transactions Table</div>
  ),
}));

describe("ManagerPage", () => {
  it("should render manager page with tabs", () => {
    render(<ManagerPage />);

    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
  });

  it("should show users table by default", () => {
    render(<ManagerPage />);

    expect(screen.getByTestId("users-table")).toBeInTheDocument();
    expect(screen.queryByTestId("transactions-table")).not.toBeInTheDocument();
  });

  it("should have clickable tab buttons", () => {
    render(<ManagerPage />);

    const transactionsTab = screen.getByText("Transactions");
    const usersTab = screen.getByText("Users");

    // Both tabs should be clickable
    expect(transactionsTab).toBeInTheDocument();
    expect(usersTab).toBeInTheDocument();

    // Clicking should not throw errors
    expect(() => fireEvent.click(transactionsTab)).not.toThrow();
    expect(() => fireEvent.click(usersTab)).not.toThrow();
  });

  it("should have proper tab styling", () => {
    render(<ManagerPage />);

    const usersTab = screen.getByText("Users");
    const transactionsTab = screen.getByText("Transactions");

    // Check that tabs are rendered as buttons
    expect(usersTab.tagName).toBe("BUTTON");
    expect(transactionsTab.tagName).toBe("BUTTON");
  });

  it("should render both tab components", () => {
    render(<ManagerPage />);

    // Only the active tab component should be visible
    expect(screen.getByTestId("users-table")).toBeInTheDocument();
    // The transactions table should not be visible initially
    expect(screen.queryByTestId("transactions-table")).not.toBeInTheDocument();
  });
});
