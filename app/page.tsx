"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Boxes } from "@/components/ui/background-boxes";
import {
  Wallet,
  CreditCard,
  MapPin,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function Page() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setIsAuthenticated(!!user);
      } catch (error) {
        console.error("Error checking auth:", error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center text-center py-24 px-4 bg-background overflow-hidden">
        {/* Background Boxes Effect */}
        <div className="absolute inset-0 z-0">
          <Boxes />
        </div>
        {/* Content overlay */}
        <div className="relative z-10">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 backdrop-blur-sm">
              <Shield className="h-4 w-4" />
              Bank-Grade Security
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
              Simple, Secure, and Smart Banking
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience next-generation digital banking with CS160 Bank —
              secure accounts, seamless transfers, and financial tools that work
              for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              {!loading && (
                <>
                  {isAuthenticated ? (
                    <Button asChild size="lg" className="text-base">
                      <Link href="/dashboard">
                        Go to Dashboard
                        <LayoutDashboard className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild size="lg" className="text-base">
                        <Link href="/signup">
                          Get Started
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="text-base"
                      >
                        <Link href="/login">Sign In</Link>
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Everything you need in one place
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to make managing your finances simple
              and secure
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <Card className="border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Account Management</CardTitle>
                <CardDescription>
                  Open or close checking and savings accounts with instant
                  balance visibility and real-time updates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Multiple account types</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Real-time balance tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Easy account management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Automated Bill Pay</CardTitle>
                <CardDescription>
                  Schedule recurring payments easily and stay on top of your
                  bills with automated reminders.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Recurring payments</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Payment reminders</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Secure transactions</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">ATM Locator</CardTitle>
                <CardDescription>
                  Locate nearby ATMs with live map integration powered by Google
                  Maps.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Interactive maps</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Real-time locations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Distance calculation</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                Bank-Grade Security
              </h3>
              <p className="text-muted-foreground">
                Your financial data is protected with industry-leading
                encryption and security protocols.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                Lightning Fast
              </h3>
              <p className="text-muted-foreground">
                Transfer money instantly between accounts and manage your
                finances with speed and efficiency.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                Always Available
              </h3>
              <p className="text-muted-foreground">
                Access your accounts 24/7 from any device, anywhere in the
                world.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="border-2 border-primary/20 bg-card">
            <CardHeader>
              <CardTitle className="text-3xl md:text-4xl mb-4">
                Ready to get started?
              </CardTitle>
              <CardDescription className="text-lg">
                Join thousands of satisfied customers and take control of your
                finances today.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col sm:flex-row gap-4 justify-center">
              {!loading && (
                <>
                  {isAuthenticated ? (
                    <Button asChild size="lg" className="text-base">
                      <Link href="/dashboard">
                        Go to Dashboard
                        <LayoutDashboard className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild size="lg" className="text-base">
                        <Link href="/signup">
                          Create Your Account
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="text-base"
                      >
                        <Link href="/login">Sign In to Existing Account</Link>
                      </Button>
                    </>
                  )}
                </>
              )}
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-card border-t border-border">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CS160 Bank. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
