import "@testing-library/jest-dom/vitest";
import React from "react";

// Make React available globally for test files using JSX
// This is necessary because test files use JSX syntax which requires React in scope
global.React = React;

// Next.js router/navigation minimal mocks for component tests
vi.mock("next/navigation", async () => {
  const actual =
    await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    usePathname: () => "/",
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});

// Supabase browser client mock to avoid env requirement in tests
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: () => Promise.resolve({}),
      signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
    },
  }),
}));
