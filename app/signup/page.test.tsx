import { render, screen } from "@testing-library/react";
import SignupPage from "./page";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: null },
          error: null,
        }),
      signUp: () =>
        Promise.resolve({
          data: { user: { id: "test-user-id" } },
          error: null,
        }),
    },
  }),
}));

// Mock fetch for the API call
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ message: "User created successfully" }),
  } as Response),
);

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all required form fields", () => {
    render(<SignupPage />);

    // Basic auth fields
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(document.getElementById("password")).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

    // Personal info fields
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();

    // Address fields
    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address line 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/state\/territory/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();

    // Submit button
    expect(
      screen.getByRole("button", { name: /sign up/i }),
    ).toBeInTheDocument();
  });

  it("shows required field indicators", () => {
    render(<SignupPage />);

    // Check for required field asterisks
    const requiredFields = screen.getAllByText("*");
    expect(requiredFields.length).toBeGreaterThan(0);

    // Check that optional field shows "(optional)"
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });

  it("has proper input types and attributes", () => {
    render(<SignupPage />);

    // Check input types
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("type", "email");
    expect(document.getElementById("password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText(/phone number/i)).toHaveAttribute(
      "type",
      "tel",
    );

    // Check placeholders
    expect(
      screen.getByPlaceholderText(/\(555\) 123-4567 or 555-123-4567/),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/12345 or 12345-6789/),
    ).toBeInTheDocument();
  });
});
