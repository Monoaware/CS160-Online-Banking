"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { revalidateDashboard } from "./actions";

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "PR", label: "Puerto Rico" },
  { value: "GU", label: "Guam" },
  { value: "VI", label: "U.S. Virgin Islands" },
  { value: "AS", label: "American Samoa" },
  { value: "MP", label: "Northern Mariana Islands" },
];

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  street_address: string;
  address_line_2?: string;
  city: string;
  state_or_territory: string;
  postal_code: string;
}

export function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    street_address: "",
    address_line_2: "",
    city: "",
    state_or_territory: "",
    postal_code: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch("/api/user/profile", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = (await response.json()) as { message: string };
        throw new Error(data.message || "Failed to fetch profile");
      }

      const data = (await response.json()) as { user: UserProfile };
      setProfile({
        first_name: data.user.first_name,
        last_name: data.user.last_name,
        email: data.user.email,
        phone_number: data.user.phone_number,
        street_address: data.user.street_address,
        address_line_2: data.user.address_line_2 || "",
        city: data.user.city,
        state_or_territory: data.user.state_or_territory,
        postal_code: data.user.postal_code,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone_number: profile.phone_number,
          street_address: profile.street_address,
          address_line_2: profile.address_line_2 || undefined,
          city: profile.city,
          state_or_territory: profile.state_or_territory,
          postal_code: profile.postal_code,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message: string };
        throw new Error(data.message || "Failed to update profile");
      }

      // Invalidate cache after successful update
      await revalidateDashboard();

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value,
    });
  };

  if (loading) {
    return (
      <div className="rounded-lg border p-6">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6">
      <h2 className="mb-6 text-2xl font-semibold">Account Information</h2>

      {error && (
        <div
          className="mb-4 rounded-md bg-destructive/20 border border-destructive/50 p-4 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="mb-4 rounded-md bg-success/20 border border-success/50 p-4 text-sm text-success"
          role="alert"
        >
          Profile updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="first_name"
              className="mb-2 block text-sm font-medium"
            >
              First Name
            </label>
            <Input
              id="first_name"
              name="first_name"
              value={profile.first_name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label
              htmlFor="last_name"
              className="mb-2 block text-sm font-medium"
            >
              Last Name
            </label>
            <Input
              id="last_name"
              name="last_name"
              value={profile.last_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              value={profile.email}
              disabled
              className="bg-muted"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Email is managed by your account authentication
            </p>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="phone_number"
              className="mb-2 block text-sm font-medium"
            >
              Phone Number
            </label>
            <Input
              id="phone_number"
              name="phone_number"
              type="tel"
              value={profile.phone_number}
              onChange={handleChange}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="street_address"
              className="mb-2 block text-sm font-medium"
            >
              Street Address
            </label>
            <Input
              id="street_address"
              name="street_address"
              value={profile.street_address}
              onChange={handleChange}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="address_line_2"
              className="mb-2 block text-sm font-medium"
            >
              Address Line 2 (Optional)
            </label>
            <Input
              id="address_line_2"
              name="address_line_2"
              value={profile.address_line_2}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="city" className="mb-2 block text-sm font-medium">
              City
            </label>
            <Input
              id="city"
              name="city"
              value={profile.city}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label
              htmlFor="state_or_territory"
              className="mb-2 block text-sm font-medium"
            >
              State/Territory
            </label>
            <select
              id="state_or_territory"
              name="state_or_territory"
              value={profile.state_or_territory}
              onChange={handleChange}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a state</option>
              {US_STATES.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="postal_code"
              className="mb-2 block text-sm font-medium"
            >
              Postal Code
            </label>
            <Input
              id="postal_code"
              name="postal_code"
              value={profile.postal_code}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
