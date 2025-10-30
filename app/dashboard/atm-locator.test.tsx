import { render, screen } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import { AtmLocator } from "./atm-locator";
import { searchNearbyATMs, geocodeAddress } from "./atm-actions";

// Mock the server actions
vi.mock("./atm-actions", () => ({
  searchNearbyATMs: vi.fn(),
  geocodeAddress: vi.fn(),
}));

// Mock the Google Maps components
vi.mock("@vis.gl/react-google-maps", () => ({
  Map: ({
    children,
    ...props
  }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="google-map" {...props}>
      {children}
    </div>
  ),
  Marker: ({ ...props }: Record<string, unknown>) => (
    <div data-testid="map-marker" {...props} />
  ),
  APIProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="api-provider">{children}</div>
  ),
}));

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

Object.defineProperty(global.navigator, "geolocation", {
  value: mockGeolocation,
  writable: true,
});

describe("AtmLocator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (searchNearbyATMs as Mock).mockResolvedValue([]);
    (geocodeAddress as Mock).mockResolvedValue({
      lat: 37.7749,
      lng: -122.4194,
      formatted_address: "San Francisco, CA",
    });
  });

  it("renders the location permission dialog on mount", () => {
    render(<AtmLocator />);

    expect(screen.getByText("Find ATMs Near You")).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => {
        return (
          element?.textContent ===
          "We can help you find the nearest Chase ATMs by using your current location. This will make it easier to locate ATMs in your area."
        );
      }),
    ).toBeInTheDocument();
  });

  it("renders the main interface elements", () => {
    render(<AtmLocator />);

    expect(screen.getAllByText("Use My Location")).toHaveLength(2); // One in dialog, one in main interface
    expect(
      screen.getByPlaceholderText("Enter an address..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("shows API key not configured message when key is missing", () => {
    // Mock missing API key
    const originalEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    render(<AtmLocator />);

    expect(
      screen.getByText("Google Maps API key not configured"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file",
      ),
    ).toBeInTheDocument();

    // Restore original env
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalEnv;
  });

  it("renders Google Maps components when API key is present", () => {
    render(<AtmLocator />);

    expect(screen.getByTestId("api-provider")).toBeInTheDocument();
    expect(screen.getByTestId("google-map")).toBeInTheDocument();
  });

  it("shows no results message by default", () => {
    render(<AtmLocator />);

    expect(
      screen.getByText("No Chase ATMs found in this area."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Try searching a different location."),
    ).toBeInTheDocument();
  });
});
