import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: null },
          error: null,
        }),
      signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
    },
  }),
}));

describe("LoginPage", () => {
  it("renders form controls", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });
});
