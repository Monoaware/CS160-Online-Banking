"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => <div>Loading Swagger UI...</div>,
});

export default function ApiDoc() {
  const [spec, setSpec] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Suppress React warnings from swagger-ui-react library
    const originalError = console.error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error = (...args: any[]) => {
      if (
        typeof args[0] === "string" &&
        (args[0].includes("UNSAFE_componentWillReceiveProps") ||
          args[0].includes("componentWillReceiveProps"))
      ) {
        return;
      }
      originalError.apply(console, args);
    };

    // Only allow access in development mode
    if (process.env.NODE_ENV !== "development") {
      window.location.href = "/404";
      return;
    }

    // Fetch the OpenAPI spec from our API route
    fetch("/api/doc")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("Loaded spec:", data);
        setSpec(data as object);
      })
      .catch((error) => {
        console.error("Failed to load API spec:", error);
        setError(error.message);
      });

    // Cleanup: restore original console.error when component unmounts
    return () => {
      console.error = originalError;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-destructive">
          Error loading API documentation: {error}
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading API Documentation...</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <SwaggerUI spec={spec} />
    </div>
  );
}
