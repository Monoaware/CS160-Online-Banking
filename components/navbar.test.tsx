import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Navbar } from "./navbar";

// Create mock functions
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

// Mock dependencies
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

vi.mock("./user-menu", () => ({
  UserMenu: () => <div>User Menu</div>,
}));

// Mock fetch
global.fetch = vi.fn();

describe("Navbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("renders app brand", () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    render(<Navbar />);
    expect(
      screen.getByRole("link", { name: /CS160 Bank/i }),
    ).toBeInTheDocument();
  });

  it("renders UserMenu component", () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    render(<Navbar />);
    expect(screen.getByText("User Menu")).toBeInTheDocument();
  });

  it("displays Dashboard link for customer role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123", email: "test@example.com" } },
      error: null,
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token123",
          refresh_token: "refresh",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: "bearer",
          user: {
            id: "123",
            email: "test@example.com",
            aud: "authenticated",
            role: "authenticated",
            created_at: new Date().toISOString(),
          },
        },
      },
      error: null,
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: 1,
          role: "customer",
          username: "testuser",
          email: "test@example.com",
        },
      }),
    } as Response);

    render(<Navbar />);

    await waitFor(
      () => {
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Customer should not see Manager or API Docs links
    expect(screen.queryByText("Manager")).not.toBeInTheDocument();
    expect(screen.queryByText("API Docs")).not.toBeInTheDocument();
  });

  it("displays Dashboard, Manager, and API Docs links for bank_manager role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123", email: "manager@example.com" } },
      error: null,
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token123",
          refresh_token: "refresh",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: "bearer",
          user: {
            id: "123",
            email: "manager@example.com",
            aud: "authenticated",
            role: "authenticated",
            created_at: new Date().toISOString(),
          },
        },
      },
      error: null,
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: 1,
          role: "bank_manager",
          username: "manager",
          email: "manager@example.com",
        },
      }),
    } as Response);

    render(<Navbar />);

    await waitFor(
      () => {
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("API Docs")).toBeInTheDocument();
  });

  it("Manager link has correct href for bank_manager role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123", email: "manager@example.com" } },
      error: null,
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token123",
          refresh_token: "refresh",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: "bearer",
          user: {
            id: "123",
            email: "manager@example.com",
            aud: "authenticated",
            role: "authenticated",
            created_at: new Date().toISOString(),
          },
        },
      },
      error: null,
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: 1,
          role: "bank_manager",
          username: "manager",
          email: "manager@example.com",
        },
      }),
    } as Response);

    render(<Navbar />);

    await waitFor(
      () => {
        expect(screen.getByText("Manager")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    const managerLink = screen.getByRole("link", { name: "Manager" });
    expect(managerLink).toHaveAttribute("href", "/manager");
  });

  it("does not display navigation links when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    render(<Navbar />);

    await waitFor(
      () => {
        expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    expect(screen.queryByText("Manager")).not.toBeInTheDocument();
    expect(screen.queryByText("API Docs")).not.toBeInTheDocument();
  });

  it("displays Dashboard link even when profile fetch fails (authenticated user)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123", email: "test@example.com" } },
      error: null,
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token123",
          refresh_token: "refresh",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: "bearer",
          user: {
            id: "123",
            email: "test@example.com",
            aud: "authenticated",
            role: "authenticated",
            created_at: new Date().toISOString(),
          },
        },
      },
      error: null,
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    render(<Navbar />);

    // Dashboard should still appear for authenticated users even if profile fetch fails
    await waitFor(
      () => {
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // But role-specific links like Manager and API Docs should not appear without profile
    expect(screen.queryByText("Manager")).not.toBeInTheDocument();
    expect(screen.queryByText("API Docs")).not.toBeInTheDocument();
  });

  it("displays Sign up link for unauthenticated users", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    render(<Navbar />);

    await waitFor(
      () => {
        expect(screen.getByText("Sign up")).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it("does not display Sign up link for authenticated users", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "123", email: "test@example.com" } },
      error: null,
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token123",
          refresh_token: "refresh",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: "bearer",
          user: {
            id: "123",
            email: "test@example.com",
            aud: "authenticated",
            role: "authenticated",
            created_at: new Date().toISOString(),
          },
        },
      },
      error: null,
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: 1,
          role: "customer",
          username: "testuser",
          email: "test@example.com",
        },
      }),
    } as Response);

    render(<Navbar />);

    await waitFor(
      () => {
        expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });
});
