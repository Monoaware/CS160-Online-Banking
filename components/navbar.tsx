"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { createClient } from "@/utils/supabase/client";
import type { UserProfile } from "@/lib/auth";

export function Navbar() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Set authentication state based on Supabase auth
        const isAuth = !!user;
        setIsAuthenticated(isAuth);

        if (!user) {
          setUserProfile(null);
          setLoading(false);
          return;
        }

        // Fetch user profile from API for role-specific features
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setUserProfile(null);
          setLoading(false);
          return;
        }

        const response = await fetch("/api/user/profile", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = (await response.json()) as { user: UserProfile };
          setUserProfile(data.user);
        } else {
          // User is authenticated but profile might not be fully set up
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();

    // Listen for auth state changes
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUserProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Navigation items based on authentication and role
  const getNavItems = () => {
    // Show dashboard for any authenticated user
    if (!isAuthenticated) return [];

    const items = [{ href: "/dashboard", label: "Dashboard" }];

    // Add role-specific items if we have the full profile
    if (userProfile?.role === "bank_manager") {
      items.push({ href: "/manager", label: "Manager" });
      items.push({ href: "/api-doc", label: "API Docs" });
    }

    return items;
  };

  const navItems = getNavItems();

  return (
    <nav className="border-b">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold">
            CS160 Bank
          </Link>
          {mounted && !loading && navItems.length > 0 && (
            <div className="flex items-center gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathname === item.href
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mounted &&
            !loading &&
            !isAuthenticated &&
            pathname !== "/login" &&
            pathname !== "/signup" && (
              <Link
                href="/signup"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Sign up
              </Link>
            )}
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}
