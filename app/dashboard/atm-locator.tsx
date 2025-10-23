"use client";

import { useState, useCallback, useEffect } from "react";
import { Map, Marker, APIProvider } from "@vis.gl/react-google-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchNearbyATMs, geocodeAddress } from "./atm-actions";

interface AtmLocation {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  distance?: number;
}

export function AtmLocator() {
  const [atms, setAtms] = useState<AtmLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchAddress, setSearchAddress] = useState("");
  const [selectedAtm, setSelectedAtm] = useState<AtmLocation | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 37.7749, lng: -122.4194 }); // Default to San Francisco
  const [showLocationDialog, setShowLocationDialog] = useState(false);

  // Custom map theme
  const mapTheme = {
    styles: [
      {
        featureType: "all",
        elementType: "geometry.fill",
        stylers: [{ weight: "2.00" }],
      },
      {
        featureType: "all",
        elementType: "geometry.stroke",
        stylers: [{ color: "#9c9c9c" }],
      },
      {
        featureType: "all",
        elementType: "labels.text",
        stylers: [{ visibility: "on" }],
      },
      {
        featureType: "landscape",
        elementType: "all",
        stylers: [{ color: "#f2f2f2" }],
      },
      {
        featureType: "landscape.man_made",
        elementType: "geometry.fill",
        stylers: [{ color: "#ffffff" }],
      },
      {
        featureType: "landscape.natural.terrain",
        elementType: "geometry.fill",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi",
        elementType: "all",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "road",
        elementType: "all",
        stylers: [{ saturation: -100 }, { lightness: 45 }],
      },
      {
        featureType: "road",
        elementType: "geometry.fill",
        stylers: [{ color: "#eeeeee" }],
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#7b7b7b" }],
      },
      {
        featureType: "road",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#ffffff" }],
      },
      {
        featureType: "road.highway",
        elementType: "all",
        stylers: [{ visibility: "simplified" }],
      },
      {
        featureType: "road.arterial",
        elementType: "labels.icon",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "transit",
        elementType: "all",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "water",
        elementType: "all",
        stylers: [{ color: "#46bcec" }, { visibility: "on" }],
      },
      {
        featureType: "water",
        elementType: "geometry.fill",
        stylers: [{ color: "#c8d7d4" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#070707" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#ffffff" }],
      },
    ],
  };

  // Show location permission dialog when component mounts
  useEffect(() => {
    setShowLocationDialog(true);
  }, []);

  // Request user's current location
  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    setLoading(true);
    setError(null);
    setShowLocationDialog(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        setMapCenter(location);
        await searchATMs(location.lat, location.lng);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setError(
          "Unable to access your location. Please try entering an address instead.",
        );
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      },
    );
  }, []);

  // Handle declining location permission
  const handleDeclineLocation = useCallback(() => {
    setShowLocationDialog(false);
  }, []);

  // Search for ATMs at given coordinates
  const searchATMs = async (lat: number, lng: number) => {
    try {
      setLoading(true);
      setError(null);
      const results = await searchNearbyATMs(lat, lng);
      setAtms(results);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to search for ATMs",
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle address search
  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchAddress.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const result = await geocodeAddress(searchAddress);
      const location = { lat: result.lat, lng: result.lng };
      setUserLocation(location);
      setMapCenter(location);
      await searchATMs(location.lat, location.lng);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find address");
      setLoading(false);
    }
  };

  // Format distance for display
  const formatDistance = (distance?: number) => {
    if (!distance) return "";
    return distance < 1
      ? `${Math.round(distance * 5280)} ft`
      : `${distance.toFixed(1)} mi`;
  };

  // Format rating for display
  const formatRating = (rating?: number, totalRatings?: number) => {
    if (!rating) return "";
    return `${rating.toFixed(1)}${totalRatings ? ` (${totalRatings})` : ""}`;
  };

  return (
    <div className="space-y-6">
      {/* Location Permission Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Find ATMs Near You</DialogTitle>
            <DialogDescription>
              We can help you find the nearest Chase ATMs by using your current
              location. This will make it easier to locate ATMs in your area.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleDeclineLocation}
              className="w-full sm:w-auto"
            >
              Enter Address Instead
            </Button>
            <Button
              onClick={requestLocation}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? "Getting Location..." : "Use My Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button
          onClick={requestLocation}
          disabled={loading}
          className="flex-1 sm:flex-none"
        >
          {loading ? "Getting Location..." : "Use My Location"}
        </Button>

        <form onSubmit={handleAddressSearch} className="flex flex-1 gap-2">
          <Input
            type="text"
            placeholder="Enter an address..."
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !searchAddress.trim()}>
            Search
          </Button>
        </form>
      </div>

      {error && (
        <div
          className="rounded-md bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Map */}
        <div className="h-[600px] w-full rounded-lg border">
          {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
              <Map
                center={mapCenter}
                zoom={13}
                gestureHandling="greedy"
                disableDefaultUI={false}
                className="h-full w-full rounded-lg"
                styles={mapTheme.styles}
              >
                {atms.map((atm) => (
                  <Marker
                    key={atm.place_id}
                    position={atm.geometry.location}
                    onClick={() => setSelectedAtm(atm)}
                  />
                ))}
              </Map>
            </APIProvider>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="mb-2">Google Maps API key not configured</p>
                <p className="text-sm">
                  Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local
                  file
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ATM List */}
        <div className="space-y-4 h-[600px] flex flex-col">
          <h3 className="text-lg font-semibold">
            Chase ATMs{" "}
            {userLocation && `near ${searchAddress || "your location"}`}
          </h3>
          {loading ? (
            <div className="space-y-3 flex-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border p-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : atms.length > 0 ? (
            <div className="flex-1 space-y-3 overflow-y-auto">
              {atms.map((atm) => (
                <div
                  key={atm.place_id}
                  className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                    selectedAtm?.place_id === atm.place_id
                      ? "border-blue-500 bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedAtm(atm)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm">{atm.name}</h4>
                    <span className="text-xs text-gray-500">
                      {formatDistance(atm.distance)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{atm.vicinity}</p>
                  {atm.rating && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>
                        ⭐ {formatRating(atm.rating, atm.user_ratings_total)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <div className="flex-1 flex items-center justify-center text-center py-8 text-gray-500">
                <div>
                  <p>No Chase ATMs found in this area.</p>
                  <p className="text-sm">Try searching a different location.</p>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Selected ATM Details */}
      {selectedAtm && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <h4 className="font-semibold mb-2">{selectedAtm.name}</h4>
          <p className="text-sm text-gray-600 mb-2">{selectedAtm.vicinity}</p>
          <div className="flex justify-between text-sm">
            <span>Distance: {formatDistance(selectedAtm.distance)}</span>
            {selectedAtm.rating && (
              <span>
                Rating:{" "}
                {formatRating(
                  selectedAtm.rating,
                  selectedAtm.user_ratings_total,
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
