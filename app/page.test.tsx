import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Page from "./page";

describe("Landing Page", () => {
  it("renders the main headline", () => {
    render(<Page />);
    expect(
      screen.getByText(/Simple, Secure, and Smart Banking/i),
    ).toBeInTheDocument();
  });

  it("renders the Get Started button", async () => {
    render(<Page />);
    await waitFor(() => {
      const buttons = screen.getAllByText(/Get Started/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("renders the Sign In button", async () => {
    render(<Page />);
    await waitFor(
      () => {
        const buttons = screen.getAllByText(/Sign In/i);
        expect(buttons.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it("renders the footer", () => {
    render(<Page />);
    const footerText = screen.getAllByText(/CS160 Bank/i);
    expect(footerText.length).toBeGreaterThan(0);
    // Check that footer copyright text exists
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it("renders feature cards", () => {
    render(<Page />);
    // Use getAllByText since "Account Management" appears multiple times
    const accountManagement = screen.getAllByText(/Account Management/i);
    expect(accountManagement.length).toBeGreaterThan(0);
    expect(screen.getByText(/Automated Bill Pay/i)).toBeInTheDocument();
    expect(screen.getByText(/ATM Locator/i)).toBeInTheDocument();
  });

  it("renders the CTA section", () => {
    render(<Page />);
    expect(screen.getByText(/Ready to get started\?/i)).toBeInTheDocument();
  });
});
