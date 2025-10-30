"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SignupSchema, USStateTerritorySchema } from "@/lib/schemas/user";
import { z } from "zod";

// Get US states/territories from schema
const US_STATES = USStateTerritorySchema.options;

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.push("/dashboard");
      }
    };
    checkAuth();
  }, [router]);

  const form = useForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      phoneNumber: "",
      streetAddress: "",
      addressLine2: "",
      city: "",
      stateOrTerritory: "" as
        | ""
        | "AL"
        | "AK"
        | "AZ"
        | "AR"
        | "CA"
        | "CO"
        | "CT"
        | "DE"
        | "DC"
        | "FL"
        | "GA"
        | "HI"
        | "ID"
        | "IL"
        | "IN"
        | "IA"
        | "KS"
        | "KY"
        | "LA"
        | "ME"
        | "MD"
        | "MA"
        | "MI"
        | "MN"
        | "MS"
        | "MO"
        | "MT"
        | "NE"
        | "NV"
        | "NH"
        | "NJ"
        | "NM"
        | "NY"
        | "NC"
        | "ND"
        | "OH"
        | "OK"
        | "OR"
        | "PA"
        | "RI"
        | "SC"
        | "SD"
        | "TN"
        | "TX"
        | "UT"
        | "VT"
        | "VA"
        | "WA"
        | "WV"
        | "WI"
        | "WY"
        | "PR"
        | "GU"
        | "VI"
        | "AS"
        | "MP",
      postalCode: "",
    },
    onSubmit: async ({ value }) => {
      // Validate with Zod
      const result = SignupSchema.safeParse(value);
      if (!result.success) {
        const firstError = result.error.issues[0];
        setError(firstError?.message || "Validation failed");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        // Create auth user with Supabase
        const { error: authError } = await supabase.auth.signUp({
          email: value.email,
          password: value.password,
        });

        if (authError) {
          console.log(authError.message);
          setError(authError.message);
          return;
        }

        // POST user to database
        // Strip non-digit characters from phone number before sending
        const cleanPhoneNumber = value.phoneNumber.replace(/\D/g, "");
        const response = await fetch("/api/users/onboard", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: value.username,
            first_name: value.firstName,
            last_name: value.lastName,
            email: value.email,
            phone_number: `+1${cleanPhoneNumber}`,
            street_address: value.streetAddress,
            address_line_2: value.addressLine2 || null,
            city: value.city,
            state_or_territory: value.stateOrTerritory,
            postal_code: value.postalCode,
            country: "USA",
            role: "customer",
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { message?: string };
          throw new Error(errorData.message || "Failed to create user profile");
        }

        // Redirect on success
        window.location.assign("/dashboard");
      } catch (error) {
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="w-full max-w-sm space-y-4"
      >
        <form.Field
          name="username"
          validators={{
            onChange: ({ value }) => {
              const result = z
                .string()
                .min(3, "Username must be at least 3 characters")
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="username" className="text-sm font-medium">
                Username
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="username"
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              const result = z
                .string()
                .email("Invalid email address")
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium">
                Email
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="email"
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) => {
              const result = z
                .string()
                .min(8, "Password must be at least 8 characters")
                .regex(
                  /[A-Z]/,
                  "Password must contain at least one uppercase letter",
                )
                .regex(
                  /[a-z]/,
                  "Password must contain at least one lowercase letter",
                )
                .regex(/[0-9]/, "Password must contain at least one number")
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium">
                Password
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="password"
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="confirmPassword"
          validators={{
            onChangeListenTo: ["password"],
            onChange: ({ value, fieldApi }) => {
              const password = fieldApi.form.getFieldValue("password");
              if (value !== password) {
                return "Passwords do not match";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="firstName"
          validators={{
            onChange: ({ value }) => {
              const result = z
                .string()
                .min(1, "First name is required")
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="firstName" className="text-sm font-medium">
                First Name
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="firstName"
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="lastName"
          validators={{
            onChange: ({ value }) => {
              const result = z
                .string()
                .min(1, "Last name is required")
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last Name
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="lastName"
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="phoneNumber"
          validators={{
            onChange: ({ value }) => {
              const result = z
                .string()
                .min(10, "Phone number must contain at least 10 digits")
                .regex(/\d/, "Phone number must contain digits")
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="phoneNumber" className="text-sm font-medium">
                Phone Number
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="phoneNumber"
                type="tel"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                placeholder="(555) 123-4567 or 555-123-4567"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="streetAddress"
          validators={{
            onChange: ({ value }) => {
              const result = z
                .string()
                .min(1, "Street address is required")
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="streetAddress" className="text-sm font-medium">
                Street Address
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="streetAddress"
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="addressLine2">
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="addressLine2" className="text-sm font-medium">
                Address Line 2
                <span className="text-gray-500 text-xs ml-1">(optional)</span>
              </label>
              <Input
                id="addressLine2"
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>

        <form.Field
          name="city"
          validators={{
            onChange: ({ value }) => {
              const result = z
                .string()
                .min(1, "City is required")
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="city" className="text-sm font-medium">
                City
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="city"
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="stateOrTerritory"
          validators={{
            onChange: ({ value }) => {
              if (!value) {
                return "State/Territory is required";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="stateOrTerritory" className="text-sm font-medium">
                State/Territory
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <select
                id="stateOrTerritory"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) =>
                  field.handleChange(e.target.value as typeof field.state.value)
                }
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select State/Territory</option>
                {US_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="postalCode"
          validators={{
            onChange: ({ value }) => {
              const result = z
                .string()
                .regex(
                  /^\d{5}(-?\d{4})?$/,
                  "Postal code must be 5 digits or ZIP+4 format",
                )
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="postalCode" className="text-sm font-medium">
                Postal Code
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="postalCode"
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
                placeholder="12345 or 12345-6789"
                maxLength={10}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing up..." : "Sign up"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="text-primary hover:underline font-medium">
            Log in
          </a>
        </p>
      </form>
    </div>
  );
}
