import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Profile } from "./profile";

// Mock supabase client
const mockGetSession = vi.fn();
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

// Mock server actions
vi.mock("./actions", () => ({
  revalidateDashboard: vi.fn().mockResolvedValue(undefined),
  revalidateUserCache: vi.fn().mockResolvedValue(undefined),
}));

// Mock fetch
global.fetch = vi.fn();

describe("Profile", () => {
  const mockSession = {
    access_token: "mock-token-123",
    user: { id: "user-123" },
  };

  const mockProfile = {
    user: {
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@example.com",
      phone_number: "+15555555555",
      street_address: "123 Main St",
      address_line_2: "Apt 4",
      city: "San Francisco",
      state_or_territory: "CA",
      postal_code: "94102",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
  });

  it("shows loading state initially", () => {
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>(() => {
        /* never resolves */
      }),
    );

    render(<Profile />);
    expect(screen.getByText("Loading profile...")).toBeInTheDocument();
  });

  it("fetches and displays user profile", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    } as Response);

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("john.doe@example.com"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("+15555555555")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123 Main St")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Apt 4")).toBeInTheDocument();
    expect(screen.getByDisplayValue("San Francisco")).toBeInTheDocument();
    expect(screen.getByDisplayValue("94102")).toBeInTheDocument();

    // Verify fetch was called with auth header
    expect(fetch).toHaveBeenCalledWith(
      "/api/user/profile",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer mock-token-123",
        },
      }),
    );
  });

  it("displays error when profile fetch fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "User not onboarded" }),
    } as Response);

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("User not onboarded");
    });
  });

  it("renders all form fields", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    } as Response);

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByLabelText("First Name")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Last Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone Number")).toBeInTheDocument();
    expect(screen.getByLabelText("Street Address")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Address Line 2 (Optional)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByLabelText("State/Territory")).toBeInTheDocument();
    expect(screen.getByLabelText("Postal Code")).toBeInTheDocument();
  });

  it("email field is disabled", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    } as Response);

    render(<Profile />);

    await waitFor(() => {
      const emailInput = screen.getByLabelText("Email");
      expect(emailInput).toBeDisabled();
    });
  });

  it("handles form submission successfully", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockProfile.user }),
      } as Response);

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    // Change first name
    const firstNameInput = screen.getByLabelText("First Name");
    fireEvent.change(firstNameInput, { target: { value: "Jane" } });

    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Profile updated successfully!"),
      ).toBeInTheDocument();
    });

    // Verify PUT request was made
    expect(fetch).toHaveBeenCalledWith(
      "/api/user/profile",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer mock-token-123",
        }),
        body: expect.stringContaining("Jane"),
      }),
    );
  });

  it("displays error when form submission fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Update failed" }),
      } as Response);

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    // Submit form
    const submitButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Update failed");
    });
  });

  it("shows saving state during submission", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ user: mockProfile.user }),
                } as Response),
              100,
            ),
          ),
      );

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(submitButton);

    // Check for saving state
    expect(screen.getByRole("button", { name: /saving.../i })).toBeDisabled();

    await waitFor(
      () => {
        expect(
          screen.getByText("Profile updated successfully!"),
        ).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("handles missing optional address_line_2", async () => {
    const profileWithoutAddress2 = {
      user: {
        ...mockProfile.user,
        address_line_2: null,
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => profileWithoutAddress2,
    } as Response);

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    const address2Input = screen.getByLabelText("Address Line 2 (Optional)");
    expect(address2Input).toHaveValue("");
  });

  it("renders state dropdown with all US states and territories", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    } as Response);

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    const stateSelect = screen.getByLabelText("State/Territory");
    expect(stateSelect).toBeInTheDocument();

    // Check for some specific states
    expect(
      screen.getByRole("option", { name: "California" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Texas" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "New York" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Puerto Rico" }),
    ).toBeInTheDocument();
  });

  it("allows changing form fields", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    } as Response);

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    const firstNameInput = screen.getByLabelText("First Name");
    fireEvent.change(firstNameInput, { target: { value: "Jane" } });
    expect(firstNameInput).toHaveValue("Jane");

    const cityInput = screen.getByLabelText("City");
    fireEvent.change(cityInput, { target: { value: "Los Angeles" } });
    expect(cityInput).toHaveValue("Los Angeles");
  });
});
