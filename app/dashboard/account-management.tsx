"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2 } from "lucide-react";

interface InternalAccount {
  id: number;
  account_number: string;
  routing_number: string;
  account_type: "checking" | "savings";
  balance: number;
  is_active: boolean;
  created_at: string;
}

export function AccountManagement() {
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
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

      const response = await fetch("/api/accounts/internal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: { message: string } };
        throw new Error(data.error?.message || "Failed to fetch accounts");
      }

      const data = (await response.json()) as { accounts: InternalAccount[] };
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p>Loading accounts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="rounded-md bg-destructive/20 border border-destructive/50 p-4 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>You don&apos;t have any accounts yet.</p>
              <p className="mt-2 text-sm">
                Click &quot;Create New Account&quot; to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <Card key={account.id} className="border-2 bg-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg text-card-foreground">
                          {account.account_type.charAt(0).toUpperCase() +
                            account.account_type.slice(1)}{" "}
                          Account
                        </CardTitle>
                        <Badge
                          variant={account.is_active ? "default" : "secondary"}
                        >
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 text-sm font-medium text-muted-foreground">
                          Account Number
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm text-card-foreground">
                            {account.account_number}
                          </code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(
                                account.account_number,
                                `account-${account.id}`,
                              )
                            }
                            className="shrink-0"
                          >
                            {copiedField === `account-${account.id}` ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 text-sm font-medium text-muted-foreground">
                          Routing Number
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm text-card-foreground">
                            {account.routing_number}
                          </code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(
                                account.routing_number,
                                `routing-${account.id}`,
                              )
                            }
                            className="shrink-0"
                          >
                            {copiedField === `routing-${account.id}` ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Available Balance
                        </span>
                        <span className="text-2xl font-bold text-card-foreground">
                          {formatCurrency(account.balance)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Account created:{" "}
                        {new Date(account.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
