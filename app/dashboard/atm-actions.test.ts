import { vi, type Mock } from "vitest";
import { searchNearbyATMs, geocodeAddress } from "./atm-actions";

// Mock fetch
global.fetch = vi.fn();

// Mock environment variable
const originalEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

describe("ATM Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-api-key";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalEnv;
  });

  describe("searchNearbyATMs", () => {
    const mockPlacesResponse = {
      status: "OK",
      results: [
        {
          place_id: "1",
          name: "Chase ATM 1",
          vicinity: "123 Main St",
          geometry: { location: { lat: 37.7749, lng: -122.4194 } },
          rating: 4.5,
          user_ratings_total: 100,
        },
        {
          place_id: "2",
          name: "Chase ATM 2",
          vicinity: "456 Oak Ave",
          geometry: { location: { lat: 37.7849, lng: -122.4194 } },
          rating: 3.8,
          user_ratings_total: 25,
        },
      ],
    };

    it("should search for nearby ATMs successfully", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesResponse,
      });

      const result = await searchNearbyATMs(37.7749, -122.4194);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        ),
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("location=37.7749,-122.4194"),
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("keyword=Chase ATM"),
      );
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("type=atm"));
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("key=test-api-key"),
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("distance");
      expect(result[0].distance).toBeGreaterThanOrEqual(0);
      expect(result[1].distance!).toBeGreaterThanOrEqual(result[0].distance!); // Should be sorted by distance
    });

    it("should throw error when API key is not configured", async () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      await expect(searchNearbyATMs(37.7749, -122.4194)).rejects.toThrow(
        "Google Maps API key not configured",
      );
    });

    it("should throw error when API request fails", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(searchNearbyATMs(37.7749, -122.4194)).rejects.toThrow(
        "Failed to search for nearby ATMs",
      );
    });

    it("should throw error when API returns error status", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "REQUEST_DENIED" }),
      });

      await expect(searchNearbyATMs(37.7749, -122.4194)).rejects.toThrow(
        "Failed to search for nearby ATMs",
      );
    });

    it("should handle ZERO_RESULTS status", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ZERO_RESULTS", results: [] }),
      });

      const result = await searchNearbyATMs(37.7749, -122.4194);

      expect(result).toEqual([]);
    });

    it("should handle network errors", async () => {
      (fetch as Mock).mockRejectedValueOnce(new Error("Network error"));

      await expect(searchNearbyATMs(37.7749, -122.4194)).rejects.toThrow(
        "Failed to search for nearby ATMs",
      );
    });

    it("should calculate distances correctly", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlacesResponse,
      });

      const result = await searchNearbyATMs(37.7749, -122.4194);

      // First ATM should be closer (same coordinates)
      expect(result[0].distance).toBeCloseTo(0, 1);
      // Second ATM is ~1 mile north
      expect(result[1].distance).toBeCloseTo(0.7, 1);
    });
  });

  describe("geocodeAddress", () => {
    const mockGeocodeResponse = {
      status: "OK",
      results: [
        {
          geometry: { location: { lat: 40.7128, lng: -74.006 } },
          formatted_address: "New York, NY, USA",
        },
      ],
    };

    it("should geocode address successfully", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodeResponse,
      });

      const result = await geocodeAddress("New York, NY");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://maps.googleapis.com/maps/api/geocode/json",
        ),
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("address=New%20York%2C%20NY"),
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("key=test-api-key"),
      );
      expect(result).toEqual({
        lat: 40.7128,
        lng: -74.006,
        formatted_address: "New York, NY, USA",
      });
    });

    it("should throw error when API key is not configured", async () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      await expect(geocodeAddress("New York, NY")).rejects.toThrow(
        "Google Maps API key not configured",
      );
    });

    it("should throw error when API request fails", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(geocodeAddress("New York, NY")).rejects.toThrow(
        "Failed to geocode address",
      );
    });

    it("should throw error when geocoding fails", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ZERO_RESULTS", results: [] }),
      });

      await expect(geocodeAddress("Invalid Address")).rejects.toThrow(
        "Failed to geocode address",
      );
    });

    it("should handle network errors", async () => {
      (fetch as Mock).mockRejectedValueOnce(new Error("Network error"));

      await expect(geocodeAddress("New York, NY")).rejects.toThrow(
        "Failed to geocode address",
      );
    });

    it("should URL encode address properly", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodeResponse,
      });

      await geocodeAddress("123 Main St, San Francisco, CA 94102");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "address=123%20Main%20St%2C%20San%20Francisco%2C%20CA%2094102",
        ),
      );
    });
  });

  describe("distance calculation", () => {
    it("should calculate distance between two points correctly", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "OK",
          results: [
            {
              place_id: "1",
              name: "Test ATM",
              vicinity: "Test Address",
              geometry: {
                location: {
                  lat: 37.7849, // ~1 mile north
                  lng: -122.4194,
                },
              },
            },
          ],
        }),
      });

      const result = await searchNearbyATMs(37.7749, -122.4194);

      // Distance should be approximately 0.7 miles (within reasonable tolerance)
      expect(result[0].distance).toBeCloseTo(0.7, 1);
    });

    it("should handle same coordinates (zero distance)", async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "OK",
          results: [
            {
              place_id: "1",
              name: "Test ATM",
              vicinity: "Test Address",
              geometry: {
                location: {
                  lat: 37.7749, // Same coordinates
                  lng: -122.4194,
                },
              },
            },
          ],
        }),
      });

      const result = await searchNearbyATMs(37.7749, -122.4194);

      expect(result[0].distance).toBeCloseTo(0, 2);
    });
  });
});
